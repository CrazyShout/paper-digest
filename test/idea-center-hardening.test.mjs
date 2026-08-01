import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  validateIdeaCenter,
  validateReviewedCenter,
  validateSelectionReport
} from "../scripts/validate-idea-center.mjs";
import { validateIdeaDossier } from "../scripts/validate-idea-dossier.mjs";
import { validateIdeaReview } from "../scripts/validate-idea-review.mjs";

const ROOT = new URL("../", import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, ROOT), "utf8"));
}

test("unknown exploration status cannot bypass strict Idea validation", async () => {
  const center = {
    explorationStatus: "unset",
    directions: [{ id: "only-direction" }]
  };
  const interests = { interests: [{ id: "only-direction" }] };

  await assert.rejects(
    validateIdeaCenter(center, {}, interests),
    /Unknown or missing explorationStatus/
  );
});

test("draft status cannot expose reviewed candidates", async () => {
  const center = {
    explorationStatus: "draft",
    directions: [{
      id: "only-direction",
      status: "reviewed",
      candidateRefs: [{ rank: 1 }]
    }]
  };
  const interests = { interests: [{ id: "only-direction" }] };

  await assert.rejects(
    validateIdeaCenter(center, {}, interests),
    /draft center cannot expose a completed direction/
  );
});

test("reviewed direction cannot fall back to embedded legacy ideas", async () => {
  await assert.rejects(
    validateReviewedCenter({
      directions: [{
        id: "only-direction",
        status: "reviewed",
        ideas: [{ id: "legacy-idea" }]
      }]
    }, {}),
    /cannot retain embedded legacy ideas/
  );
});

test("future-dated dossiers and reviews are rejected", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const dossier = {
    candidateId: "future-dossier",
    frozenAt: "2999-01-01T00:00:00Z"
  };
  assert.throws(
    () => validateIdeaDossier(dossier, workflow),
    /frozenAt cannot be future-dated/
  );

  const review = {
    candidateId: "future-review",
    reviewerAgentId: "019fbb32-330c-7a62-add9-1c00bd35be00",
    lens: "novelty-reviewer",
    reviewedAt: "2999-01-01T00:00:00Z",
    dossierSnapshotFingerprint: "a".repeat(64)
  };
  assert.throws(
    () => validateIdeaReview(review, workflow),
    /reviewedAt cannot be future-dated/
  );
});

test("independent selection is bound to the exact candidate-pool snapshot", () => {
  const pool = {
    directionId: "only-direction",
    searchedAt: "2026-08-01T02:00:00Z",
    candidateLedger: [
      { candidateId: "candidate-a" },
      { candidateId: "candidate-b" }
    ],
    shortlist: [{ candidateId: "candidate-a" }]
  };
  const poolArtifact = {
    path: "content/idea-audits/only-direction-pool.json",
    fingerprint: "e".repeat(64)
  };
  const report = {
    selectionAgentId: "019fbbe7-eb0c-7931-95b6-6553d39073da",
    selectedAt: "2026-08-01T03:00:00Z",
    directionId: "only-direction",
    candidatePoolPath: poolArtifact.path,
    candidatePoolSnapshotFingerprint: poolArtifact.fingerprint,
    selectedCandidateIds: ["candidate-a"],
    candidateDecisions: [
      {
        candidateId: "candidate-a",
        decision: "shortlist",
        reason: "The frozen evidence leaves a narrow identifiable experiment and a direct comparison path."
      },
      {
        candidateId: "candidate-b",
        decision: "reject",
        reason: "The proposed contribution is already functionally covered by the recorded direct competitor."
      }
    ],
    crossDirectionFinding: "Neither candidate duplicates the estimand assigned to another configured research direction."
  };

  assert.equal(
    validateSelectionReport(report, poolArtifact, pool, {
      requirements: { maxPublishedIdeas: 2 }
    }, "selection-report").agentId,
    report.selectionAgentId
  );

  const stale = structuredClone(report);
  stale.candidatePoolSnapshotFingerprint = "f".repeat(64);
  assert.throws(
    () => validateSelectionReport(stale, poolArtifact, pool, {
      requirements: { maxPublishedIdeas: 2 }
    }, "selection-report"),
    /not bound to the current candidate-pool snapshot/
  );
});
