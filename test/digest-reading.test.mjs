import assert from "node:assert/strict";
import test from "node:test";
import { digestPaperGroups, digestReadingSections } from "../src/lib/digest-reading.js";
import { formalPrimaryLinkIsCanonical, getDigests, sourceLinkLabel } from "../src/lib/content.js";
import { sourceDisplayLabel } from "../src/lib/reading-ui.js";
import { readingPrintState, revealReadingFragment } from "../src/lib/reading-disclosures.js";

test("digest projection preserves every section and globally unique heading IDs", () => {
  const reading = digestReadingSections("前言。\n\n## 本期判断\n\n导读。\n\n### 同名\n\n说明。\n\n## 筛选口径\n\n审计全文。\n\n## 讨论\n\n### 同名\n\n讨论全文。");
  assert.match(reading.introHtml, /^<p>前言。<\/p>/);
  assert.equal(reading.intro.text, "本期判断");
  assert.equal(reading.discussion.length, 1);
  assert.equal(reading.provenance.length, 1);
  assert.match(reading.introHtml, /id="同名"/);
  assert.match(reading.discussion[0].html, /id="同名-2"/);
  assert.match(reading.provenance[0].html, /审计全文/);
  const all = [reading.introHtml, ...reading.discussion.map(x => x.html), ...reading.provenance.map(x => x.html)].join("");
  assert.equal((all.match(/<h2 /g) || []).length, 3);
});

test("legacy and topic issues retain their first substantive section without truncation", () => {
  assert.deepEqual(digestReadingSections("只有正文。"), {
    introHtml: "<p>只有正文。</p>", intro: null, discussion: [], provenance: []
  });
  const reading = digestReadingSections("## 检索与检查口径\n\n来源。\n\n## 先回答是否值得做\n\n保留完整问题。\n\n## 优先验证的问题\n\n具体实验。");
  assert.equal(reading.intro.text, "先回答是否值得做");
  assert.equal(reading.discussion[0].text, "优先验证的问题");
  assert.equal(reading.provenance[0].id, "检索与检查口径");
});

test("each paper has exactly one full card and every secondary tag has a cross-link", () => {
  const digest = {
    tags: [{ id: "a" }, { id: "b" }, { id: "c" }],
    papers: [
      { id: "first", tag: "a", tags: ["a", "b", "c"] },
      { id: "second", tag: "b", tags: ["b", "c"] }
    ]
  };
  const groups = digestPaperGroups(digest);
  assert.deepEqual(groups.map(x => x.papers.map(p => p.id)), [["first"], ["second"], []]);
  assert.deepEqual(groups.map(x => x.related.map(p => p.id)), [[], ["first"], ["first", "second"]]);
  assert.throws(() => digestPaperGroups({ ...digest, tags: [{ id: "c" }] }), /Missing primary direction/);
});

test("all current digests have complete, unique primary cards and valid related targets", async () => {
  for (const digest of await getDigests({ includeAudit: true })) {
    const groups = digestPaperGroups(digest);
    const ids = groups.flatMap(group => group.papers.map(paper => paper.id));
    assert.equal(new Set(ids).size, digest.papers.length, digest.id);
    assert.equal(ids.length, digest.papers.length, digest.id);
    assert.ok(groups.every(group => group.related.every(paper => ids.includes(paper.id))), digest.id);
    if (digest.id === "2026-09-29") {
      assert.equal(ids.length, 8);
      assert.equal(groups.reduce((n, group) => n + group.related.length, 0), 5);
    }
  }
});

test("display labels do not change formal-source validation or publication status", () => {
  const urls = [
    ["https://openreview.net/forum?id=test", "评审页"],
    ["https://eccv.ecva.net/virtual/2026/poster/4951", "会议页"],
    ["https://conf.researchr.org/track/example", "会议页"],
    ["https://openaccess.thecvf.com/content/CVPR2026/html/example.html", "论文页"],
    ["https://doi.org/10.1000/example", "DOI"]
  ];
  for (const [url, label] of urls) {
    assert.equal(sourceDisplayLabel({ url, label: sourceLinkLabel(url) }), label);
    assert.equal(sourceLinkLabel(url), "正式版");
    assert.equal(formalPrimaryLinkIsCanonical({ publicationStatus: "peer-reviewed", url }), true);
  }
  assert.equal(sourceDisplayLabel({ url: "https://github.com/example/repo", label: "代码" }), "仓库");
  assert.equal(sourceDisplayLabel({ url: "https://github.com/example/repo", label: "作者仓库（待发布）" }), "仓库（待发布）");
  assert.equal(sourceDisplayLabel({ url: "https://openreview.net.evil.test/forum", label: sourceLinkLabel("https://openreview.net.evil.test/forum") }), "项目页");
});

test("a fragment reveals every closed ancestor while malformed and missing IDs are harmless", () => {
  const outer = { tagName: "DETAILS", open: false, parentElement: null };
  const inner = { tagName: "DETAILS", open: false, parentElement: outer };
  const target = { tagName: "H2", parentElement: inner };
  const doc = { getElementById: id => id === "筛选口径" ? target : null };
  assert.equal(revealReadingFragment(doc, "#%E7%AD%9B%E9%80%89%E5%8F%A3%E5%BE%84"), target);
  assert.equal(outer.open, true);
  assert.equal(inner.open, true);
  assert.equal(revealReadingFragment(doc, "#%zz"), null);
  assert.equal(revealReadingFragment(doc, "#missing"), null);
});

test("printing exposes all disclosures and direction panels, then restores the reader's state", () => {
  const details = [{ open: true }, { open: false }];
  const panels = [{ hidden: false }, { hidden: true }];
  const controller = readingPrintState({ querySelectorAll: selector => selector === "details" ? details : panels });
  controller.before();
  controller.before();
  assert.deepEqual(details.map(x => x.open), [true, true]);
  assert.deepEqual(panels.map(x => x.hidden), [false, false]);
  controller.after();
  assert.deepEqual(details.map(x => x.open), [true, false]);
  assert.deepEqual(panels.map(x => x.hidden), [false, true]);
  controller.after();
});
