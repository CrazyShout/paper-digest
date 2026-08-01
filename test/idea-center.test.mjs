import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateIdeaScore,
  getIdeaCenter,
  getInterestConfig,
  projectIdeaCenterData
} from "../src/lib/content.js";

const REVIEW_DIMENSIONS = [
  "novelty",
  "feasibility",
  "success-probability",
  "impact",
  "comparison-readiness"
];

const SYNTHETIC_SCORING = {
  maxScore: 10,
  dimensions: REVIEW_DIMENSIONS.map((id) => ({ id, label: id, weight: 20 }))
};

const SYNTHETIC_WORKFLOW = {
  evaluation: {
    publicationScore: 10,
    reviewerLenses: [{ id: "novelty" }]
  },
  requirements: {
    minBlindReviewersPerIdea: 1
  }
};

function syntheticCenter(direction) {
  return {
    title: "Synthetic Idea Center",
    scoring: SYNTHETIC_SCORING,
    directions: [direction]
  };
}

test("idea center covers every configured research direction", async () => {
  const [center, interests] = await Promise.all([getIdeaCenter(), getInterestConfig()]);
  const directionIds = center.directions.map((direction) => direction.id).sort();
  const configuredIds = interests.interests.map((interest) => interest.id).sort();

  assert.deepEqual(directionIds, configuredIds);
  assert.equal(new Set(directionIds).size, directionIds.length);
});

test("reviewed directions project their candidate-pool evidence and rejection ledger", async () => {
  const center = await getIdeaCenter();
  const reviewedDirections = center.directions.filter((direction) => direction.status === "reviewed");

  if (center.explorationStatus === "reviewed") {
    assert.equal(reviewedDirections.length, center.directions.length);
  }
  for (const direction of reviewedDirections) {
    assert.ok(direction.candidatePool);
    assert.ok(direction.candidatePool.counts.queries >= 6, direction.id);
    assert.ok(direction.candidatePool.counts.references >= 14, direction.id);
    assert.ok(direction.candidatePool.counts.assets >= 2, direction.id);
    assert.ok(direction.candidatePool.counts.candidates >= 8, direction.id);
    assert.equal(direction.candidatePool.counts.shortlisted, direction.ideas.length);
    assert.ok(direction.candidatePool.rejected.length >= 3, direction.id);
    assert.equal(direction.outcome.reviewedCount, direction.ideas.length);
  }
});

test("reviewed Idea scores are the minimums of stored independent reports", async () => {
  const center = await getIdeaCenter();

  for (const direction of center.directions) {
    for (const idea of direction.ideas || []) {
      if (!idea.blindReview) {
        const computed = calculateIdeaScore(center.scoring, idea.score.dimensions);
        assert.equal(computed, idea.score.overall, idea.id);
        assert.equal(idea.computedScore, idea.score.overall, idea.id);
        continue;
      }

      const reviewers = idea.blindReview.reviewers;
      assert.ok(reviewers.length >= 2, idea.id);
      assert.equal(idea.score.overall, Math.min(...reviewers.map((review) => review.overall)));
      assert.equal(idea.computedScore, idea.score.overall);
      for (const dimension of REVIEW_DIMENSIONS) {
        assert.equal(
          idea.score.dimensions[dimension],
          Math.min(...reviewers.map((review) => review.scores[dimension])),
          `${idea.id}/${dimension}`
        );
      }
    }
  }
});

test("Idea evidence keeps exclusive provenance and local reports resolve", async () => {
  const center = await getIdeaCenter();

  for (const direction of center.directions.filter((item) => ["ready", "reviewed"].includes(item.status))) {
    for (const idea of direction.ideas) {
      const minimum = idea.blindReview ? 4 : 3;
      const maximum = idea.blindReview ? 7 : 5;
      assert.ok(idea.evidence.length >= minimum && idea.evidence.length <= maximum, idea.id);
      for (const source of idea.evidence) {
        assert.match(source.url, /^https:\/\//);
        if (idea.blindReview) {
          assert.notEqual(Boolean(source.localPaperId), source.sourceOrigin === "external", idea.id);
        }
        if (source.localPaperId) {
          assert.match(source.localLink, /^papers\/.+\/$/, source.localPaperId);
        }
      }
    }
  }
});

test("no candidate is marked passed without a complete exact-score panel", async () => {
  const center = await getIdeaCenter();

  for (const direction of center.directions) {
    for (const idea of direction.ideas || []) {
      if (idea.reviewStatus !== "passed") continue;
      const reviewers = idea.blindReview?.reviewers || [];
      assert.ok(reviewers.length >= 5, idea.id);
      assert.equal(new Set(reviewers.map((reviewer) => reviewer.lens)).size, 5, idea.id);
      for (const reviewer of reviewers) {
        assert.equal(reviewer.overall, 10, idea.id);
        assert.ok(REVIEW_DIMENSIONS.every((dimension) => reviewer.scores[dimension] === 10));
      }
    }
  }
});

test("planned directions do not present unreviewed ideas", async () => {
  const center = await getIdeaCenter();

  for (const direction of center.directions.filter((item) => item.status === "planned")) {
    assert.equal(direction.ideas?.length || 0, 0);
    assert.equal(direction.candidatePool, null);
  }
});

test("reviewed directions with zero shortlisted candidates never fall back to embedded ideas", async () => {
  const center = await projectIdeaCenterData(syntheticCenter({
    id: "synthetic-direction",
    status: "reviewed",
    candidateRefs: [],
    candidatePoolPaths: [],
    ideas: [{ id: "legacy-unreviewed-idea", title: "Must stay hidden" }]
  }), {
    papers: [],
    workflow: SYNTHETIC_WORKFLOW,
    readAudit: async (auditPath) => {
      throw new Error(`Unexpected audit read: ${auditPath}`);
    }
  });

  assert.deepEqual(center.directions[0].ideas, []);
  assert.match(
    center.directions[0].projectionWarnings[0],
    /ignored 1 embedded idea\(s\).*only project candidateRefs/
  );
});

test("reviewed candidate projection reports missing review fields with candidate context", async () => {
  const artifacts = new Map([
    ["dossier.json", {
      candidateId: "synthetic-candidate",
      evidence: []
    }],
    ["review.json", {
      candidateId: "synthetic-candidate",
      reviewerAgentId: "synthetic-reviewer",
      lens: "novelty",
      overall: 7
    }]
  ]);
  const center = syntheticCenter({
    id: "synthetic-direction",
    status: "reviewed",
    candidatePoolPaths: [],
    candidateRefs: [{
      dossierPath: "dossier.json",
      reviewPaths: ["review.json"]
    }]
  });

  await assert.rejects(
    projectIdeaCenterData(center, {
      papers: [],
      workflow: SYNTHETIC_WORKFLOW,
      readAudit: async (auditPath) => artifacts.get(auditPath)
    }),
    /candidateRefs\[0\].*reviews\[0\]\.scores must be an object/
  );
});

test("reviewed candidate projection diagnoses an empty review panel", async () => {
  const center = syntheticCenter({
    id: "synthetic-direction",
    status: "reviewed",
    candidatePoolPaths: [],
    candidateRefs: [{
      dossierPath: "dossier.json",
      reviewPaths: []
    }]
  });

  await assert.rejects(
    projectIdeaCenterData(center, {
      papers: [],
      workflow: SYNTHETIC_WORKFLOW,
      readAudit: async () => ({ candidateId: "synthetic-candidate", evidence: [] })
    }),
    /reviewPaths must contain at least one review report/
  );
});
