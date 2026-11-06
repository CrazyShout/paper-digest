import assert from "node:assert/strict";
import test from "node:test";
import { projectReviewCitations } from "../src/lib/review-citations.js";
import { getReviewCenter, markdownToHtml } from "../src/lib/content.js";
const references = [{ id: "first-2020" }, { id: "later-2026" }];

test("review citation numbers follow bibliography order and stay in the same page", () => {
  const text = projectReviewCitations("Conclusion [later-2026, first-2020].", references);
  assert.equal(text, "Conclusion ([2](#reference-later-2026), [1](#reference-first-2020)).");
  const html = markdownToHtml(text);
  assert.match(html, /href="#reference-later-2026">2<\/a>/);
  assert.doesNotMatch(html, /target="_blank"/);
  assert.equal(projectReviewCitations("[later-2026, first-2020]", references, { links: false }), "[2, 1]");
});

test("citations preserve ordinary links, code, math, escapes and unknown groups", () => {
  const text = String.raw`[first-2020](https://example.org) ` + "`[first-2020]` "
    + String.raw`$x[first-2020]$ $$[later-2026]$$ \[first-2020] [unknown] [first-2020, unknown]`;
  assert.equal(projectReviewCitations(text, references), text);
  assert.match(markdownToHtml("[external](https://example.org)"), /target="_blank"/);
});

test("published review raw evidence is unchanged while visible citation IDs are resolved", async () => {
  const center = await getReviewCenter();
  const direction = center.directions.find((entry) => entry.id === "end-to-end-autonomous-driving");
  assert.match(direction.abstract, /\[driftingplanner-2026/);
  assert.doesNotMatch(direction.abstractText, /driftingplanner-2026/);
  assert.ok(direction.sections.some((section) => /href="#reference-/.test(section.bodyHtml)));
  assert.ok(direction.sections.some((section) => /\[alvinn-1988/.test(section.body)));
});
