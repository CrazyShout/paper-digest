import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getReviewCenter } from "../src/lib/content.js";
import { reviewSnapshotFingerprint } from "../src/lib/review-fingerprint.js";
import { sortedSurveyReadings, surveyReadingErrors, surveyReadingSearchText } from "../src/lib/survey-reading.js";

function reading() {
  return { checkedAt: "2026-11-12", entries: [{
    id: "survey-a", canonicalId: "doi:10.1234/survey-a", title: "Recent Survey",
    authors: "A. Author", publicationLabel: "Journal", publishedAt: "2025-12-01",
    dateBasis: "online", dateSource: "https://publisher.example/article", url: "https://doi.org/10.1234/survey-a",
    readingNote: "Explains representation and evaluation protocols.",
    citation: { provider: "OpenAlex", workId: "W123", count: 0, checkedAt: "2026-11-12", url: "https://openalex.org/W123" }
  }] };
}

test("survey ordering uses publication dates, keeps ties deterministic and does not mutate input", () => {
  const input = { entries: [{ id: "old", publishedAt: "2024-01-01" }, { id: "z", publishedAt: "2026-10-01" }, { id: "a", publishedAt: "2026-10-01" }] };
  assert.deepEqual(sortedSurveyReadings(input).map(x => x.id), ["a", "z", "old"]);
  assert.equal(input.entries[0].id, "old");
});

test("citation snapshots preserve zero and reject missing counts, wrong work IDs and undated counts", () => {
  assert.deepEqual(surveyReadingErrors(reading(), "2026-11-12"), []);
  for (const patch of [{ count: null }, { count: -1 }, { checkedAt: "2026-11-01" }, { workId: "W456" }]) {
    const input = reading(); Object.assign(input.entries[0].citation, patch);
    assert.ok(surveyReadingErrors(input, "2026-11-12").length > 0);
  }
});

test("recommendations reject older, future and impossible dates and canonical duplicates", () => {
  for (const date of ["2023-11-12", "2026-11-13", "2025-02-29"]) {
    const input = reading(); input.entries[0].publishedAt = date;
    assert.ok(surveyReadingErrors(input, "2026-11-12").some(x => x.includes("publication date")));
  }
  const duplicate = reading(); duplicate.entries.push({ ...duplicate.entries[0], id: "survey-b", canonicalId: " DOI:10.1234/SURVEY-A " });
  assert.ok(surveyReadingErrors(duplicate, "2026-11-12").some(x => x.includes("canonicalId")));
});

test("verified issue months retain their precision instead of inventing an online date", () => {
  const input = reading(); input.entries[0].publishedAt = "2025-02"; input.entries[0].dateBasis = "issue";
  assert.deepEqual(surveyReadingErrors(input, "2026-11-12"), []);
  input.entries[0].dateBasis = "online";
  assert.ok(surveyReadingErrors(input, "2026-11-12").some(x => x.includes("publication date")));
});

test("formal and preprint aliases cannot create two recommendations for one paper", () => {
  const input = reading();
  input.entries[0].links = [{ label: "arXiv", url: "https://arxiv.org/abs/2405.05173v3" }];
  input.entries.push({ ...structuredClone(input.entries[0]), id: "survey-b", canonicalId: "arxiv:2405.05173", url: "https://arxiv.org/abs/2405.05173" });
  const errors = surveyReadingErrors(input, "2026-11-12");
  assert.ok(errors.some(x => x.includes("duplicate DOI/arXiv identity")));
  assert.ok(errors.some(x => x.includes("duplicate OpenAlex work")));
});

test("reading prose is searchable without indexing citation audit metadata", () => {
  const text = surveyReadingSearchText(reading());
  assert.ok(text.includes("Recent Survey") && text.includes("evaluation protocols"));
  assert.equal(text.includes("OpenAlex"), false);
  assert.equal(text.includes("W123"), false);
});

test("recommendation or citation changes invalidate the article approval fingerprint", () => {
  const review = { id: "direction", surveyReading: reading(), searchAudit: { independentReview: { status: "passed" } } };
  const initial = reviewSnapshotFingerprint(review);
  review.searchAudit.independentReview.status = "pending";
  assert.equal(reviewSnapshotFingerprint(review), initial);
  review.surveyReading.entries[0].citation.count = 1;
  assert.notEqual(reviewSnapshotFingerprint(review), initial);
});

test("all ten reviews have valid recent reading lists and a visible opening section", async () => {
  const center = await getReviewCenter();
  assert.equal(center.directions.length, 10);
  for (const direction of center.directions) {
    assert.deepEqual(surveyReadingErrors(direction.surveyReading, "2026-11-12"), [], direction.id);
  }
  const page = await readFile("src/pages/reviews/[id]/index.astro", "utf8");
  assert.ok(page.indexOf("<ReviewSurveyReading") < page.indexOf("{direction.sections.map"));
});
