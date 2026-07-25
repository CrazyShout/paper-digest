import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getInterestConfig,
  getPapers,
  getReviewCenter,
  isValidIsoDate
} from "../src/lib/content.js";

test("review dates must be real calendar dates", () => {
  assert.equal(isValidIsoDate("2026-07-26"), true);
  assert.equal(isValidIsoDate("2024-02-29"), true);
  assert.equal(isValidIsoDate("2026-02-29"), false);
  assert.equal(isValidIsoDate("2026-13-01"), false);
  assert.equal(isValidIsoDate("2026-7-26"), false);
});

test("review center covers every configured research direction", async () => {
  const [center, interests] = await Promise.all([
    getReviewCenter(),
    getInterestConfig()
  ]);
  const reviewIds = center.directions.map((direction) => direction.id);
  const configuredIds = interests.interests.map((interest) => interest.id);

  assert.deepEqual(reviewIds, configuredIds);
  assert.equal(new Set(reviewIds).size, reviewIds.length);
});

test("every direction has a complete narrative and mixed-source reading list", async () => {
  const center = await getReviewCenter();
  const requiredKinds = [
    "scope",
    "evolution",
    "taxonomy",
    "evidence",
    "challenges",
    "outlook"
  ];

  for (const direction of center.directions) {
    assert.deepEqual(
      direction.sections.map((section) => section.kind).sort(),
      [...requiredKinds].sort(),
      direction.id
    );
    assert.ok(direction.references.length >= 6, direction.id);
    assert.ok(direction.references.some((reference) => reference.origin === "local"), direction.id);
    assert.ok(direction.references.some((reference) => reference.origin === "external"), direction.id);
    assert.ok(
      direction.references.some((reference) =>
        ["survey", "tutorial"].includes(reference.publicationType)
      ),
      direction.id
    );

    const usedReferences = new Set(
      direction.sections.flatMap((section) => section.referenceIds)
    );
    for (const reference of direction.references) {
      assert.ok(usedReferences.has(reference.id), `${direction.id}:${reference.id}`);
    }
  }
});

test("reference origin and destinations are derived from localPaperId", async () => {
  const [center, papers] = await Promise.all([getReviewCenter(), getPapers()]);
  const paperMap = new Map(papers.map((paper) => [paper.id, paper]));

  for (const direction of center.directions) {
    for (const reference of direction.references) {
      if (reference.localPaperId) {
        const paper = paperMap.get(reference.localPaperId);
        assert.ok(paper, reference.localPaperId);
        assert.equal(reference.origin, "local");
        assert.equal(reference.badge, "本库已报告");
        assert.equal(reference.title, paper.title);
        assert.equal(reference.href, `../../papers/${paper.id}/`);
      } else {
        assert.equal(reference.origin, "external");
        assert.equal(reference.badge, "外部文献");
        assert.equal(reference.href, reference.url);
        assert.match(reference.href, /^https:\/\//);
      }
    }
  }
});
