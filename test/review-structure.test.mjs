import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { reviewStructureErrors, reviewSectionAliases, reviewFigureDimensionErrors } from "../src/lib/review-structure.js";
import { reviewCitedReferenceIds } from "../src/lib/review-citations.js";
import { revealReadingFragment } from "../src/lib/reading-disclosures.js";
import { getReviewCenter } from "../src/lib/content.js";

function article() {
  return { structureVersion: 2, references: [{ id: "source-2020" }], legacyAnchors: { scope: "problem", "scope-title": "problem" }, sections: [
    { id: "problem", title: "Problem", body: "[source-2020]", covers: ["scope", "evolution"], referenceIds: ["source-2020"] },
    { id: "methods", title: "Methods", body: "Comparison", covers: ["taxonomy", "evidence"], referenceIds: ["source-2020"] },
    { id: "limits", title: "Limits", body: "Open questions", covers: ["challenges", "outlook"], referenceIds: ["source-2020"] }
  ] };
}

test("article coverage follows content and permits both combined and split dimensions", () => {
  const review = article();
  assert.deepEqual(reviewStructureErrors(review, ["scope", "scope-title"]), []);
  review.sections.push({ id: "further-results", title: "Further results", body: "Evidence", covers: ["evidence"] });
  assert.deepEqual(reviewStructureErrors(review), []);
  review.sections[2].covers = ["challenges"];
  assert.ok(reviewStructureErrors(review).some(error => error.includes("outlook")));
});

test("historical anchors cannot disappear, collide or target absent sections", () => {
  const review = article();
  assert.deepEqual(reviewSectionAliases(review, "problem"), ["scope", "scope-title"]);
  delete review.legacyAnchors.scope;
  assert.ok(reviewStructureErrors(review, ["scope"]).some(error => error.includes("missing historical")));
  review.legacyAnchors.scope = "gone";
  review.legacyAnchors["methods-title"] = "problem";
  review.legacyAnchors["reference-source-2020"] = "problem";
  const errors = reviewStructureErrors(review);
  assert.ok(errors.some(error => error.includes("target: gone")));
  assert.ok(errors.some(error => error.includes("methods-title")));
  assert.ok(errors.some(error => error.includes("reference-source-2020")));
});

test("new article anchors remain revealable through the shared fragment controller", () => {
  const review = article();
  const aliases = new Map(reviewSectionAliases(review, "problem").map(id => [id, { id, tagName: "SPAN", parentElement: null }]));
  assert.equal(revealReadingFragment({ getElementById: id => aliases.get(id) }, "#scope-title"), aliases.get("scope-title"));
});

test("SVG dimensions are read from the root, never a background rectangle", () => {
  const figure = { width: 720, height: 840 };
  assert.deepEqual(reviewFigureDimensionErrors('<svg width="720" height="840" viewBox="0 0 720 840"><rect width="1" height="1"/></svg>', figure), []);
  const masked = '<svg width="900" height="600" viewBox="0 0 900 600"><rect width="720" height="840"/></svg>';
  assert.ok(reviewFigureDimensionErrors(masked, figure).some(error => error.startsWith("width")));
  assert.ok(reviewFigureDimensionErrors('<svg width="720" height="840" viewBox="0 0 100 100"/>', figure).some(error => error.includes("aspect")));
});

test("inline citation membership ignores links, formulas, code and escaped brackets", () => {
  const refs = [{ id: "first-2020" }, { id: "second-2021" }];
  const input = '[first-2020, second-2021] ` [first-2020] ` $x[second-2021]$ [first-2020](https://example.test) \\[second-2021]';
  assert.deepEqual(reviewCitedReferenceIds(input, refs), ["first-2020", "second-2021"]);
  assert.deepEqual(reviewCitedReferenceIds('`[first-2020]` $x[second-2021]$ \\[first-2020]', refs), []);
});

test("every retained reference has a reading destination and historical anchors survive", async () => {
  const center = await getReviewCenter();
  const anchors = JSON.parse(await readFile("config/review-anchors.json", "utf8"));
  for (const review of center.directions) {
    assert.deepEqual(reviewStructureErrors(review, anchors[review.id]), [], review.id);
    const cited = new Set(review.sections.flatMap(section => section.referenceIds));
    for (const id of review.additionalReferenceIds || []) assert.equal(cited.has(id), false, `${review.id}/${id}`);
    assert.deepEqual(new Set([...cited, ...(review.additionalReferenceIds || [])]), new Set(review.references.map(reference => reference.id)));
    for (const figure of review.figures || []) assert.ok(review.sections.some(section => section.bodyHtml.includes(`width="${figure.width}" height="${figure.height}"`)));
  }
});
