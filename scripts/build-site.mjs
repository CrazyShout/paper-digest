import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "content");
const SRC = path.join(ROOT, "src");
const DOCS = path.join(ROOT, "docs");

function escapeHtml(value) {
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

function markdownToHtml(markdown) {
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

function renderVisual(paper) {
  return `
    <div class="paper-visual ${escapeHtml(paper.visual)}" data-label="${escapeHtml(paper.visualLabel)}" aria-label="${escapeHtml(paper.visualLabel)}">
      <span></span><span></span><span></span>
    </div>
  `;
}

function renderIndexHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paper Digest</title>
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <div class="site-shell">
    <aside class="library" aria-label="简报目录">
      <div class="brand">
        <div class="mark" aria-hidden="true">PD</div>
        <div>
          <p class="eyebrow">Group Briefing</p>
          <h1>Paper Digest</h1>
        </div>
      </div>
      <nav class="digest-list" id="digestList"></nav>
      <div class="library-foot">
        <strong>Markdown source</strong><br>
        内容来自 content/，页面由模板构建到 docs/。
      </div>
    </aside>

    <main class="reader">
      <header class="topbar">
        <div>
          <p class="eyebrow" id="activeDate">Latest Issue</p>
          <h2 id="activeTitle">Weekly Paper Digest</h2>
        </div>
        <div class="searchbar" role="search">
          <input id="paperSearch" type="search" placeholder="搜索论文、作者、机构、关键词" autocomplete="off">
          <select id="tagFilter" aria-label="按研究方向筛选">
            <option value="">全部方向</option>
          </select>
        </div>
      </header>

      <section class="search-results" id="searchResults" hidden></section>
      <article class="issue" id="digestArticle"></article>
    </main>

    <button class="notes-toggle" id="notesToggle" aria-label="打开组内笔记" aria-controls="notesDrawer" aria-expanded="false">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
      </svg>
    </button>

    <aside class="notes-drawer" id="notesDrawer" aria-hidden="true">
      <div class="notes-head">
        <div>
          <p class="eyebrow" id="notesIssue">Current Issue</p>
          <h3>组内笔记</h3>
        </div>
        <button class="close-notes" id="closeNotes" aria-label="关闭组内笔记">×</button>
      </div>
      <div class="note-stream" id="noteStream"></div>
      <form class="note-composer" id="noteComposer">
        <input id="githubHandle" placeholder="@github" autocomplete="off">
        <textarea id="noteText" placeholder="写一条简短笔记"></textarea>
        <button class="save-note" type="submit">保存本地草稿</button>
        <p class="note-hint">当前原型把新增笔记保存在本机浏览器；接入带认证边界的共享评论服务后可变成组内笔记。</p>
      </form>
    </aside>
  </div>

  <script src="assets/data.js"></script>
  <script src="assets/site.js"></script>
</body>
</html>
`;
}

function renderPaperPage({ paper, tag, reportHtml }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(paper.title)} · Paper Digest</title>
  <link rel="stylesheet" href="../../assets/styles.css">
</head>
<body>
  <main class="paper-page">
    <a class="back-link" href="../../">返回简报</a>
    <section class="paper-hero">
      <span class="paper-tag" style="--tag-color: ${escapeHtml(tag.color)}">${escapeHtml(tag.label)}</span>
      <h1>${escapeHtml(paper.title)}</h1>
      <p>${escapeHtml(paper.comment)}</p>
    </section>

    <section class="paper-detail-grid">
      <aside class="paper-detail-meta">
        ${renderVisual(paper)}
        <dl>
          <div>
            <dt>抓取位置</dt>
            <dd>${escapeHtml(paper.source)}</dd>
          </div>
          <div>
            <dt>作者</dt>
            <dd>${escapeHtml(paper.authors.join(", "))}</dd>
          </div>
          <div>
            <dt>单位</dt>
            <dd>${escapeHtml(paper.affiliations.join("; "))}</dd>
          </div>
        </dl>
      </aside>
      <article class="paper-report">
        ${reportHtml}
      </article>
    </section>
  </main>
</body>
</html>
`;
}

async function main() {
  const tags = JSON.parse(await readFile(path.join(CONTENT, "tags.json"), "utf8"));
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));

  const paperDocs = await readMarkdownDir(path.join(CONTENT, "papers"));
  const papers = new Map();
  for (const doc of paperDocs) {
    const paper = {
      ...doc.data,
      body: doc.body,
      link: `papers/${doc.data.id}/`
    };
    papers.set(paper.id, paper);
  }

  const digestDocs = await readMarkdownDir(path.join(CONTENT, "digests"));
  const digests = digestDocs.map((doc) => {
    const digestPapers = doc.data.papers.map((paperId) => {
      const paper = papers.get(paperId);
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
      tags: digestTags,
      papers: digestPapers
    };
  }).sort((a, b) => b.date.localeCompare(a.date));

  await rm(DOCS, { recursive: true, force: true });
  await mkdir(path.join(DOCS, "assets"), { recursive: true });
  await mkdir(path.join(DOCS, "papers"), { recursive: true });

  await writeFile(path.join(DOCS, "index.html"), renderIndexHtml());
  await writeFile(path.join(DOCS, ".nojekyll"), "");
  await writeFile(path.join(DOCS, "assets", "styles.css"), await readFile(path.join(SRC, "styles.css"), "utf8"));
  await writeFile(path.join(DOCS, "assets", "site.js"), await readFile(path.join(SRC, "site.js"), "utf8"));
  await writeFile(
    path.join(DOCS, "assets", "data.js"),
    `window.PAPER_DIGESTS = ${JSON.stringify(digests, null, 2)};\n`
  );

  for (const paper of papers.values()) {
    const tag = tagMap.get(paper.tag);
    const dir = path.join(DOCS, "papers", paper.id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), renderPaperPage({
      paper,
      tag,
      reportHtml: markdownToHtml(paper.body)
    }));
  }

  console.log(`Built ${digests.length} digests and ${papers.size} paper pages into docs/`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
