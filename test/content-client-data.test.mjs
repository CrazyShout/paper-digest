import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClientDigestData,
  buildPaperSearchIndex
} from "../src/lib/content.js";

const digest = {
  id: "2026-07-18",
  date: "2026-07-18",
  displayDate: "2026-07-18",
  title: "Test digest",
  summary: "Summary",
  keywords: ["testing"],
  notes: [],
  bodyHtml: "<p>Digest note</p>",
  tags: [{ id: "evaluation", label: "Evaluation", color: "#123456" }],
  papers: [{
    id: "paper-one",
    title: "Paper One",
    source: "arXiv",
    authors: ["A. Author"],
    affiliations: ["Test University"],
    comment: "Short summary",
    tag: "evaluation",
    tags: ["evaluation"],
    link: "papers/paper-one/",
    body: "A detailed discussion of counterfactual robustness."
  }]
};

test("client digest payload excludes full paper reports", () => {
  const [clientDigest] = buildClientDigestData([digest]);

  assert.equal(clientDigest.papers[0].body, undefined);
  assert.equal(clientDigest.papers[0].comment, "Short summary");
  assert.equal(clientDigest.bodyHtml, "<p>Digest note</p>");
});

test("lazy search index retains full-report terms", () => {
  const [entry] = buildPaperSearchIndex([digest]);

  assert.equal(entry.digestId, digest.id);
  assert.equal(entry.paperId, "paper-one");
  assert.match(entry.text, /counterfactual robustness/);
  assert.match(entry.text, /evaluation/);
});
