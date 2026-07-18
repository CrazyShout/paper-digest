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

function safeContentUrl(value) {
  const url = String(value || "").trim();
  if (/^https?:\/\//i.test(url) || url.startsWith("/") || url.startsWith("#")) return url;
  if (/^(?:\.\.?\/)+[A-Za-z0-9._~!$&'()*+,;=:@/-]+$/i.test(url)) return url;
  return "";
}

function renderStrong(value) {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderInlineMarkdown(value) {
  const text = String(value);
  const links = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let html = "";
  let lastIndex = 0;
  let match;

  while ((match = links.exec(text)) !== null) {
    html += renderStrong(text.slice(lastIndex, match.index));
    const href = safeContentUrl(match[2]);
    const label = renderStrong(match[1]);
    html += href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label;
    lastIndex = match.index + match[0].length;
  }

  html += renderStrong(text.slice(lastIndex));
  return html;
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
    html.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
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
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (image) {
      flushParagraph();
      flushList();
      const src = safeContentUrl(image[2]);
      if (src) {
        const alt = image[1].trim();
        html.push(`
          <figure class="paper-figure">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">
            ${alt ? `<figcaption>${renderInlineMarkdown(alt)}</figcaption>` : ""}
          </figure>
        `.trim());
      }
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

function normalizePaperTags(data) {
  const tags = [];

  if (typeof data.tag === "string" && data.tag.trim()) {
    tags.push(data.tag.trim());
  }

  if (Array.isArray(data.tags)) {
    for (const tag of data.tags) {
      if (typeof tag === "string" && tag.trim() && !tags.includes(tag.trim())) {
        tags.push(tag.trim());
      }
    }
  }

  return tags;
}

export async function getPapers() {
  const paperDocs = await readMarkdownDir(path.join(CONTENT, "papers"));
  return paperDocs.map((doc) => {
    const tags = normalizePaperTags(doc.data);
    return {
      ...doc.data,
      tag: tags[0],
      tags,
      body: doc.body,
      link: `papers/${doc.data.id}/`
    };
  });
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
      if (!paper.tags.length) throw new Error(`${paper.id} is missing tag/tags`);
      for (const tagId of paper.tags) {
        if (!tagMap.has(tagId)) throw new Error(`${paper.id} references missing tag: ${tagId}`);
        if (!digestTags.some((tag) => tag.id === tagId)) {
          digestTags.push(tagMap.get(tagId));
        }
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

export function buildClientDigestData(digests) {
  return digests.map((digest) => ({
    id: digest.id,
    date: digest.date,
    displayDate: digest.displayDate,
    title: digest.title,
    summary: digest.summary,
    keywords: digest.keywords,
    notes: digest.notes,
    bodyHtml: digest.bodyHtml,
    tags: digest.tags,
    papers: digest.papers.map((paper) => ({
      id: paper.id,
      title: paper.title,
      source: paper.source,
      authors: paper.authors,
      affiliations: paper.affiliations,
      comment: paper.comment,
      tag: paper.tag,
      tags: paper.tags,
      link: paper.link
    }))
  }));
}

export function buildPaperSearchIndex(digests) {
  return digests.flatMap((digest) => digest.papers.map((paper) => {
    const tagLabels = digest.tags
      .filter((tag) => paper.tags.includes(tag.id))
      .map((tag) => tag.label);

    return {
      digestId: digest.id,
      paperId: paper.id,
      text: [
        ...tagLabels,
        paper.title,
        paper.source,
        ...paper.authors,
        ...paper.affiliations,
        paper.comment,
        paper.body
      ].filter(Boolean).join(" ").toLowerCase()
    };
  }));
}

export async function getPaperWithTag(id) {
  const tags = await getTags();
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const papers = await getPapers();
  const paper = papers.find((item) => item.id === id);
  if (!paper) return null;
  const paperTags = paper.tags.map((tagId) => tagMap.get(tagId)).filter(Boolean);

  return {
    paper,
    tag: paperTags[0],
    tags: paperTags
  };
}

export function calculateIdeaScore(scoring, values = {}) {
  const dimensions = Array.isArray(scoring?.dimensions) ? scoring.dimensions : [];
  const totalWeight = dimensions.reduce((sum, dimension) => sum + Number(dimension.weight || 0), 0);
  if (!totalWeight) return 0;

  const weightedScore = dimensions.reduce((sum, dimension) => {
    return sum + Number(values[dimension.id] || 0) * Number(dimension.weight || 0);
  }, 0);

  return Math.round(weightedScore / totalWeight);
}

export async function getIdeaCenter() {
  const [ideaCenter, papers] = await Promise.all([
    readFile(path.join(CONTENT, "idea-center.json"), "utf8").then(JSON.parse),
    getPapers()
  ]);
  const paperMap = new Map(papers.map((paper) => [paper.id, paper]));

  return {
    ...ideaCenter,
    directions: ideaCenter.directions.map((direction) => ({
      ...direction,
      ideas: (direction.ideas || []).map((idea) => ({
        ...idea,
        computedScore: calculateIdeaScore(ideaCenter.scoring, idea.score?.dimensions),
        evidence: idea.evidence.map((source) => ({
          ...source,
          localLink: source.localPaperId ? paperMap.get(source.localPaperId)?.link : undefined
        }))
      }))
    }))
  };
}

function roundPercentage(value) {
  return Math.round(value * 10) / 10;
}

function countPapersWithTag(papers, tagId) {
  return papers.filter((paper) => paper.tags.includes(tagId)).length;
}

function uniquePapersFromDigests(digests) {
  return [...new Map(
    digests.flatMap((digest) => digest.papers.map((paper) => [paper.id, paper]))
  ).values()];
}

export async function getResearchLandscape() {
  const [landscapeConfig, tags, papers, digests] = await Promise.all([
    readFile(path.join(CONTENT, "research-landscape.json"), "utf8").then(JSON.parse),
    getTags(),
    getPapers(),
    getDigests()
  ]);

  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const canonicalPapers = papers.filter((paper) => !paper.revisionOf);
  const canonicalPaperMap = new Map(canonicalPapers.map((paper) => [paper.id, paper]));
  const canonicalPaperIds = new Set(canonicalPapers.map((paper) => paper.id));
  const effectiveDigests = digests
    .map((digest) => ({
      ...digest,
      papers: digest.papers.filter((paper) => canonicalPaperIds.has(paper.id))
    }))
    .filter((digest) => digest.papers.length);

  const windowSize = Math.max(1, Number(landscapeConfig.analysisWindowIssues) || 3);
  const recentDigests = effectiveDigests.slice(0, windowSize);
  const previousDigests = effectiveDigests.slice(windowSize, windowSize * 2);
  const recentPapers = uniquePapersFromDigests(recentDigests);
  const previousPapers = uniquePapersFromDigests(previousDigests);
  const directionAnalysis = new Map(
    landscapeConfig.directions.map((direction) => [direction.tag, direction])
  );

  function evidencePapersFor(item = {}) {
    return (item.evidencePaperIds || [])
      .map((paperId) => canonicalPaperMap.get(paperId))
      .filter(Boolean)
      .map((paper) => ({
        id: paper.id,
        title: paper.title,
        link: paper.link
      }));
  }
  const maxDirectionCount = Math.max(
    1,
    ...tags.map((tag) => countPapersWithTag(canonicalPapers, tag.id))
  );

  const directions = tags.map((tag) => {
    const analysis = directionAnalysis.get(tag.id) || {};
    const total = countPapersWithTag(canonicalPapers, tag.id);
    const recentCount = countPapersWithTag(recentPapers, tag.id);
    const previousCount = countPapersWithTag(previousPapers, tag.id);
    const recentShare = recentPapers.length ? (recentCount / recentPapers.length) * 100 : 0;
    const previousShare = previousPapers.length ? (previousCount / previousPapers.length) * 100 : 0;
    const countDelta = recentCount - previousCount;
    const motion = countDelta >= 3 ? "up" : countDelta <= -3 ? "down" : "steady";

    return {
      ...tag,
      ...analysis,
      total,
      coverage: roundPercentage((total / canonicalPapers.length) * 100),
      barWidth: roundPercentage((total / maxDirectionCount) * 100),
      recentCount,
      previousCount,
      recentShare: roundPercentage(recentShare),
      previousShare: roundPercentage(previousShare),
      shareDelta: roundPercentage(recentShare - previousShare),
      motion,
      motionLabel: motion === "up" ? "近期收录上升" : motion === "down" ? "近期收录回落" : "近期收录稳定",
      evidencePapers: evidencePapersFor(analysis),
      issueCounts: effectiveDigests.slice(0, 6).reverse().map((digest) => ({
        date: digest.date,
        count: countPapersWithTag(digest.papers, tag.id)
      }))
    };
  });

  function attachTagInfo(item) {
    return {
      ...item,
      tagInfos: item.tags.map((tagId) => tagMap.get(tagId)).filter(Boolean),
      evidencePapers: evidencePapersFor(item)
    };
  }

  const dates = effectiveDigests.map((digest) => digest.date).sort();
  const recentDateRange = recentDigests.length
    ? `${recentDigests.at(-1).date} 至 ${recentDigests[0].date}`
    : "";
  const previousDateRange = previousDigests.length
    ? `${previousDigests.at(-1).date} 至 ${previousDigests[0].date}`
    : "";

  return {
    version: landscapeConfig.version,
    updatedAt: landscapeConfig.updatedAt,
    title: landscapeConfig.title,
    summary: landscapeConfig.summary,
    corpus: {
      paperCount: canonicalPapers.length,
      directionCount: tags.length,
      digestCount: effectiveDigests.length,
      scopeStart: dates[0] || "",
      scopeEnd: dates.at(-1) || "",
      recentPaperCount: recentPapers.length,
      previousPaperCount: previousPapers.length,
      recentDateRange,
      previousDateRange,
      windowSize
    },
    directions,
    trends: landscapeConfig.trends.map(attachTagInfo),
    hotspots: landscapeConfig.hotspots.map((hotspot) => ({
      ...attachTagInfo(hotspot),
      jointCount: canonicalPapers.filter((paper) =>
        hotspot.tags.every((tagId) => paper.tags.includes(tagId))
      ).length
    })),
    opportunities: landscapeConfig.opportunities.map(attachTagInfo)
  };
}
