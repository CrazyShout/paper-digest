import assert from "node:assert/strict";
import test from "node:test";
import { explorationSnapshotFingerprint, validateExploration } from "../src/lib/idea-exploration.js";
import { buildNotebookSearchIndex } from "../src/lib/notebook-search.js";

function fixture() {
  const round = {
    version: 1, id: "2026-11-06", title: "Research round", summary: "A testable proposal.",
    authorAgentIds: ["author"], retrievalAgentIds: ["retriever"],
    directions: [{ id: "sensing", progress: "A new representation.", opportunity: "Learn its temporal structure." }],
    sources: [
      { id: "local", title: "Local paper", url: "https://arxiv.org/abs/2601.00001", localPaperId: "local-paper", finding: "Temporal features.", readingDepth: "method" },
      { id: "external", title: "External paper", url: "https://arxiv.org/abs/2601.00002", sourceOrigin: "external", finding: "A related mechanism.", readingDepth: "method" },
      { id: "benchmark", title: "Benchmark", url: "https://arxiv.org/abs/2601.00003", sourceOrigin: "external", finding: "Evaluation protocol.", readingDepth: "protocol" }
    ],
    candidates: [{
      id: "temporal-map", directionId: "sensing", title: "Temporal map", hypothesis: "History improves prediction.",
      method: ["Encode observations.", "Predict changes."], whyNow: "Comparable data exists.",
      upside: "Better temporal learning.", risk: "History may be redundant.",
      priorWork: [
        { sourceId: "local", overlap: "Temporal input.", difference: "Learn the update." },
        { sourceId: "external", overlap: "Predictive model.", difference: "Test observed motion." }
      ],
      implementation: { reuse: ["Dataset"], build: ["Prediction head"] },
      evidenceIds: ["local", "external", "benchmark"],
      firstExperiment: {
        question: "Does history help?", setup: "Fixed split.", baselines: ["Single frame", "Temporal baseline"],
        measurement: "Paired sequence error.", positive: "Consistent reduction.", negative: "No gain at sufficient power.",
        unclear: "Wide confidence interval.", budget: "One GPU day, estimate."
      },
      pilot: { status: "not-run", reason: "Literature-stage proposal." }
    }]
  };
  round.review = {
    status: "passed", reviewerAgentId: "independent-reviewer", summary: "Worth testing; results remain unknown.",
    snapshotFingerprint: explorationSnapshotFingerprint(round),
    recommendations: [{ candidateId: "temporal-map", decision: "pilot", reason: "Cheap and informative experiment." }]
  };
  return round;
}

const context = { directionIds: ["sensing"], paperIds: ["local-paper"] };

test("an independently reviewed proposal can be worth a pilot without claiming completed results", () => {
  assert.deepEqual(validateExploration(fixture(), context), { directions: 1, candidates: 1, sources: 3 });
});

test("exploration reviews expire when a method or its supporting evidence changes", () => {
  const round = fixture();
  round.candidates[0].method.push("An unreviewed component.");
  assert.throws(() => validateExploration(round, context), /changed after review/);
});

test("current proposals require external evidence, all-candidate decisions and independent review", () => {
  const localOnly = fixture();
  localOnly.candidates[0].evidenceIds = ["local", "local", "local"];
  assert.throws(() => validateExploration(localOnly, context), /beyond the local corpus/);
  const missingDecision = fixture();
  missingDecision.review.recommendations = [];
  assert.throws(() => validateExploration(missingDecision, context), /every candidate/);
  const authorReview = fixture();
  authorReview.review.reviewerAgentId = "author";
  assert.throws(() => validateExploration(authorReview, context), /independent/);
  const fakeResult = fixture();
  fakeResult.candidates[0].pilot.status = "passed";
  assert.throws(() => validateExploration(fakeResult, context), /must not imply completed experiments/);
  const unrenderable = fixture();
  unrenderable.candidates[0].firstExperiment.baselines = "Single frame; temporal baseline";
  assert.throws(() => validateExploration(unrenderable, context), /baselines must be a list/);
});

test("search exposes current methods and experiment details without indexing review ledgers", () => {
  const round = fixture();
  round.review.summary = "PRIVATE_AUDIT_SENTINEL";
  const records = buildNotebookSearchIndex({
    base: "/paper-digest/", digests: [], papers: [], tags: [{ id: "sensing", label: "Sensing" }],
    reviewCenter: { title: "Reviews", summary: "Summary", directions: [] },
    landscape: { summary: "Landscape", directions: [], trends: [], hotspots: [], opportunities: [] },
    ideaCenter: { title: "Ideas", summary: "Summary", directions: [], currentExploration: round }
  });
  const candidate = records.find((entry) => entry.id === "exploration-temporal-map");
  assert.equal(candidate.url, "/paper-digest/ideas/#explore-temporal-map");
  assert.match(candidate.content, /Predict changes/);
  assert.match(candidate.content, /Wide confidence interval/);
  assert.doesNotMatch(JSON.stringify(records), /PRIVATE_AUDIT_SENTINEL|snapshotFingerprint/);
});
