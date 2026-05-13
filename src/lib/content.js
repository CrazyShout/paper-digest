import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const CONFIG = path.join(ROOT, "config");
const CONTENT = path.join(ROOT, "content");

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseMarkdownFile(text, filePath) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filePath} is missing JSON frontmatter`);
  }

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`${filePath} has invalid JSON frontmatter: ${error.message}`);
  }

  return { data, body: match[2].trim() };
}

async function readMarkdownDir(dir) {
  const entries = await readdir(dir);
  const files = entries.filter((entry) => entry.endsWith(".md")).sort();
  const docs = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const text = await readFile(filePath, "utf8");
    docs.push({ file, ...parseMarkdownFile(text, filePath) });
  }

  return docs;
}

export function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let list = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${paragraph.map(escapeHtml).join(" ")}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
    list = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length, 3);
      html.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return html.join("\n");
}

export async function getInterestConfig() {
  return JSON.parse(await readFile(path.join(CONFIG, "research-interests.json"), "utf8"));
}

export async function getRuntimeConfig() {
  return JSON.parse(await readFile(path.join(CONFIG, "runtime.json"), "utf8"));
}

export async function getTags() {
  const interestConfig = await getInterestConfig();
  return interestConfig.interests.map((interest) => ({
    id: interest.id,
    label: interest.label,
    color: interest.color,
    description: interest.description,
    priority: interest.priority
  }));
}

export async function getPapers() {
  const paperDocs = await readMarkdownDir(path.join(CONTENT, "papers"));
  return paperDocs.map((doc) => ({
    ...doc.data,
    body: doc.body,
    link: `papers/${doc.data.id}/`
  }));
}

export async function getDigests() {
  const tags = await getTags();
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const papers = await getPapers();
  const paperMap = new Map(papers.map((paper) => [paper.id, paper]));
  const digestDocs = await readMarkdownDir(path.join(CONTENT, "digests"));

  return digestDocs.map((doc) => {
    const digestPapers = doc.data.papers.map((paperId) => {
      const paper = paperMap.get(paperId);
      if (!paper) throw new Error(`${doc.file} references missing paper: ${paperId}`);
      return paper;
    });

    const digestTags = [];
    for (const paper of digestPapers) {
      if (!tagMap.has(paper.tag)) throw new Error(`${paper.id} references missing tag: ${paper.tag}`);
      if (!digestTags.some((tag) => tag.id === paper.tag)) {
        digestTags.push(tagMap.get(paper.tag));
      }
    }

    return {
      ...doc.data,
      body: doc.body,
      bodyHtml: markdownToHtml(doc.body),
      tags: digestTags,
      papers: digestPapers
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPaperWithTag(id) {
  const tags = await getTags();
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const papers = await getPapers();
  const paper = papers.find((item) => item.id === id);
  if (!paper) return null;

  return {
    paper,
    tag: tagMap.get(paper.tag)
  };
}
