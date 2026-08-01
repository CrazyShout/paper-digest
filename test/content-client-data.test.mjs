import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClientDigestData,
  buildPaperSourceLinks,
  buildPaperSearchIndex,
  buildReviewSourceLinks,
  getMarkdownHeadings,
  isAffiliationPlaceholder,
  markdownToHtml,
  sourceLinkLabelMatches
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

test("paper report headings receive stable unique anchors", () => {
  const markdown = "## Method Overview\n\nBody.\n\n## Method Overview";
  const headings = getMarkdownHeadings(markdown);
  const html = markdownToHtml(markdown, { headingIds: true });

  assert.deepEqual(headings.map(({ id }) => id), [
    "method-overview",
    "method-overview-2"
  ]);
  assert.match(html, /id="method-overview"/);
  assert.match(html, /id="method-overview-2"/);
});

test("generic Markdown rendering does not inject heading anchors", () => {
  assert.equal(markdownToHtml("## Digest Note"), "<h2>Digest Note</h2>");
});

test("affiliation placeholder detection is case-insensitive and specific", () => {
  for (const value of [
    "作者单位见论文 PDF",
    "unknown",
    "Not Confirmed",
    "unconfirmed affiliation",
    "see pdf"
  ]) {
    assert.equal(isAffiliationPlaceholder(value), true, value);
  }

  assert.equal(isAffiliationPlaceholder("PDF Solutions GmbH"), false);
  assert.equal(isAffiliationPlaceholder("The Hong Kong University of Science and Technology"), false);
});

test("review links preserve verified dataset and archive semantics", () => {
  const links = buildReviewSourceLinks({
    url: "https://doi.org/10.1038/s41597-026-07929-2",
    links: [
      { label: "数据集", url: "https://huggingface.co/datasets/Egikk/IEDD" },
      { label: "数据归档", url: "https://doi.org/10.5281/zenodo.18742437" },
      { label: "作者仓库（待发布）", url: "https://github.com/russellyq/ObsDriveBench" }
    ]
  });

  assert.deepEqual(links.slice(1), [
    { label: "数据集", url: "https://huggingface.co/datasets/Egikk/IEDD" },
    { label: "数据归档", url: "https://doi.org/10.5281/zenodo.18742437" },
    { label: "作者仓库（待发布）", url: "https://github.com/russellyq/ObsDriveBench" }
  ]);
  assert.equal(
    sourceLinkLabelMatches("数据归档", "https://doi.org/10.1038/s41597-026-07929-2"),
    false
  );
  assert.deepEqual(
    buildPaperSourceLinks(
      "Scientific Data / https://doi.org/10.1038/s41597-026-07929-2 / "
        + "Data: https://huggingface.co/datasets/Egikk/IEDD / "
        + "Zenodo: https://doi.org/10.5281/zenodo.18742437"
    ).map((link) => link.label),
    ["正式版", "数据集", "数据归档"]
  );
});
