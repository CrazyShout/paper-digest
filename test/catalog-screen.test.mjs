import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BROAD_TITLE_PATTERN, screenCatalogTitles } from "../src/lib/catalog-screen.js";

test("configured keywords recover the actual AgentNorm title missed by the old broad pattern", async () => {
  const config = JSON.parse(await readFile("config/research-interests.json", "utf8"));
  const row = { canonicalId: "arxiv:2610.39505", title: "Agent-Wise Test-Time Normalization for Camera-Based Cooperative Perception with Corrupted Collaborators" };
  assert.equal(new RegExp(BROAD_TITLE_PATTERN, "i").test(row.title), false);
  const result = screenCatalogTitles([row], config.interests);
  assert.equal(result.counts.additionalKeywordMatches, 1);
  assert.ok(result.matched[0].keywordMatches.some((entry) => entry.directionId === "cooperative-autonomous-driving" && entry.terms.includes("cooperative perception")));
});

test("known WAM acronym is discovered without treating a substring as the acronym", () => {
  const rows = ["Utility-WAM: Correcting Future-Induced Action Changes", "An XWAMX controller"].map((title, i) => ({ id: String(i), title }));
  const result = screenCatalogTitles(rows, [{ id: "world-models", includeKeywords: ["WAM"] }]);
  assert.equal(result.matched.length, 1);
  assert.equal(result.unmatchedSample[0].canonicalId, "1");
});

test("string categories stay whole and invalid category metadata fails clearly", () => {
  const row = { id: "example", title: "Unrelated study", categories: "cs.CV" };
  assert.deepEqual(screenCatalogTitles([row], []).unmatchedSample[0].categories, ["cs.CV"]);
  assert.throws(() => screenCatalogTitles([{ ...row, categories: 42 }], []), /Catalog categories/);
  assert.throws(() => screenCatalogTitles([{ ...row, categories: [null] }], []), /Catalog categories/);
});

test("broad recall is preserved; duplicated categories are sampled once and reproducibly", () => {
  const rows = [{ id: "0", title: "LiDAR model" },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `u${i}`, title: `Unrelated ${i}`, categories: [i % 2 ? "cs.AI" : "cs.CV"] })),
    { id: "u1", title: "Unrelated 1", categories: ["cs.CV"] }];
  const options = { sampleSize: 4, seed: "fixed" };
  const a = screenCatalogTitles(rows, [], options);
  const b = screenCatalogTitles([...rows].reverse(), [], options);
  assert.equal(a.counts.broadMatches, 1);
  assert.equal(a.counts.uniqueRecords, 9);
  assert.deepEqual(a.unmatchedSample.map((row) => row.canonicalId), b.unmatchedSample.map((row) => row.canonicalId));
  assert.equal(new Set(a.unmatchedSample.map((row) => row.canonicalId)).size, 4);
  assert.match(a.boundary, /not accepted papers/);
});
