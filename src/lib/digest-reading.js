import { getMarkdownHeadings, markdownToHtml } from "./content.js";

const provenanceTitles = new Set([
  "筛选口径", "筛选与证据口径", "检索与检查口径", "可靠性评估", "本次系统更新"
]);

export function digestReadingSections(markdown = "") {
  // Render once so repeated heading IDs stay identical when sections move.
  const html = markdownToHtml(markdown, { headingIds: true });
  const headings = getMarkdownHeadings(markdown).filter((heading) => heading.level === 2);
  const starts = [...html.matchAll(/<h2 id="[^"]+">/g)].map((match) => match.index);
  if (!starts.length) return { introHtml: html, intro: null, discussion: [], provenance: [] };
  const sections = headings.map((heading, index) => ({
    ...heading,
    html: html.slice(starts[index], starts[index + 1])
  }));
  const intro = sections.find((section) => !provenanceTitles.has(section.text)) || null;
  return {
    intro,
    introHtml: html.slice(0, starts[0]) + (intro?.html || ""),
    discussion: sections.filter((section) => section !== intro && !provenanceTitles.has(section.text)),
    provenance: sections.filter((section) => provenanceTitles.has(section.text))
  };
}

export function digestPaperGroups(digest) {
  const papers = [...new Map(digest.papers.map((paper) => [paper.id, paper])).values()];
  const tagIds = new Set(digest.tags.map((tag) => tag.id));
  for (const paper of papers) {
    if (!tagIds.has(paper.tag)) throw new Error(`Missing primary direction for ${paper.id}`);
  }
  return digest.tags.map((tag) => ({
    tag,
    papers: papers.filter((paper) => paper.tag === tag.id),
    related: papers.filter((paper) => paper.tag !== tag.id && paper.tags.includes(tag.id))
  }));
}
