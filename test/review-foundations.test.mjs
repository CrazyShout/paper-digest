import assert from "node:assert/strict";
import test from "node:test";
import { validateFoundationsAudit } from "../src/lib/review-foundations.js";
import { reviewSnapshotFingerprint } from "../src/lib/review-fingerprint.js";

const options = { requiredFrom: "2026-11-06", today: "2026-11-06" };
function example() {
  return {
    reviewedAt: "2026-11-06",
    references: [
      { id: "survey-a", publicationType: "survey", canonicalId: "doi:10.1000/survey-a" },
      { id: "survey-b", publicationType: "survey", canonicalId: "arxiv:2601.00001" },
      { id: "origin", publicationType: "method", canonicalId: "doi:10.1000/origin" }
    ],
    searchAudit: {
      excludedCandidates: [{ canonicalId: "arxiv:2501.00002" }],
      foundationsAudit: {
        auditedAt: "2026-11-06",
        scope: "Representation and benchmark lineage",
        surveyAnchors: ["established", "frontier"].map((role, i) => ({
          referenceId: `survey-${i ? "b" : "a"}`, role,
          sectionsRead: ["Section 2: taxonomy", "References"],
          use: "Compare the method families", coverageCutoff: "Stated bibliography cutoff"
        })),
        milestones: [{ referenceId: "origin", branch: "representation", role: "origin", reason: "Defines the model" }],
        coverage: [{ branch: "representation", status: "covered", rationale: "Compared the origin and later taxonomy", foundationalReferenceIds: ["origin"], surveyReferenceIds: ["survey-a", "survey-b"] }],
        citationTrace: [{ surveyReferenceId: "survey-a", sourceLocator: "Section 2, reference 7", candidateCanonicalId: "doi:10.1000/origin", primaryUrl: "https://doi.org/10.1000/origin", disposition: "included", reason: "Method origin missing from prior review" }],
        limitations: ["Related applications are outside this review"]
      }
    }
  };
}

test("foundations audit follows its effective date and accepts traceable coverage", () => {
  assert.deepEqual(validateFoundationsAudit(example(), options), []);
  assert.deepEqual(validateFoundationsAudit({ reviewedAt: "2026-11-05" }, options), []);
  assert.match(validateFoundationsAudit({ reviewedAt: "2026-11-06" }, options).join(), /missing foundationsAudit/);
});

test("survey reading must reference real survey entries and identify read sections", () => {
  const review = example();
  review.searchAudit.foundationsAudit.surveyAnchors[0].referenceId = "origin";
  review.searchAudit.foundationsAudit.surveyAnchors[1].sectionsRead = [];
  const errors = validateFoundationsAudit(review, options).join();
  assert.match(errors, /not a cited survey/);
  assert.match(errors, /reading evidence incomplete/);
});

test("a genuine survey gap needs search and primary-source evidence", () => {
  const review = example();
  review.searchAudit.foundationsAudit.surveyAnchors.pop();
  review.searchAudit.foundationsAudit.coverage[0].surveyReferenceIds = ["survey-a"];
  assert.match(validateFoundationsAudit(review, options).join(), /complementary survey anchors/);
  review.searchAudit.foundationsAudit.surveyGap = {
    reason: "No newer review covering the required sensor protocol was found",
    queries: ["sensor protocol survey"], primaryUrls: ["https://example.org/survey"]
  };
  assert.deepEqual(validateFoundationsAudit(review, options), []);
});

test("a traced excluded paper cannot silently become an included milestone", () => {
  const review = example();
  const trace = review.searchAudit.foundationsAudit.citationTrace[0];
  trace.candidateCanonicalId = "arxiv:2501.00002";
  assert.match(validateFoundationsAudit(review, options).join(), /no matching disposition/);
  trace.disposition = "excluded";
  assert.deepEqual(validateFoundationsAudit(review, options), []);
});

test("covered branches need both milestone and survey support", () => {
  const review = example();
  review.searchAudit.foundationsAudit.coverage[0].foundationalReferenceIds = [];
  assert.match(validateFoundationsAudit(review, options).join(), /covered branch lacks/);
  review.searchAudit.foundationsAudit.coverage[0].status = "gap";
  assert.deepEqual(validateFoundationsAudit(review, options), []);
});

test("audit date is a real past date and changes invalidate review fingerprints", () => {
  const review = example();
  const before = reviewSnapshotFingerprint(review);
  review.searchAudit.foundationsAudit.auditedAt = "2026-02-30";
  assert.match(validateFoundationsAudit(review, options).join(), /invalid foundations audit date/);
  assert.notEqual(reviewSnapshotFingerprint(review), before);
});
