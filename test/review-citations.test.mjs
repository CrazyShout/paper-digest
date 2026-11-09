import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
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
  for (const direction of center.directions) {
    const raw = JSON.parse(await readFile(new URL(`../content/reviews/${direction.id}.json`, import.meta.url), "utf8"));
    assert.equal(direction.abstract, raw.abstract);
    assert.equal(direction.abstractText, projectReviewCitations(raw.abstract, raw.references, { links: false }));
    assert.deepEqual(direction.sections.map(section => section.body), raw.sections.map(section => section.body));
    for (const section of direction.sections) {
      assert.equal(section.bodyHtml, markdownToHtml(projectReviewCitations(section.body, raw.references)), `${direction.id}/${section.id}`);
    }
  }
});
