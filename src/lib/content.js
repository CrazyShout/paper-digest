import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { reviewSnapshotFingerprint } from "./review-fingerprint.js";
import {
  canonicalUrlHostname,
  urlMatchesHostname
} from "./source-url.js";

const ROOT = path.resolve(process.cwd());
const CONFIG = path.join(ROOT, "config");
const CONTENT = path.join(ROOT, "content");

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

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

async function readJsonDir(dir) {
  const entries = await readdir(dir);
  const files = entries.filter((entry) => entry.endsWith(".json")).sort();
  const docs = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const data = JSON.parse(await readFile(filePath, "utf8"));
    docs.push({ file, data });
  }

  return docs;
}

function markdownHeadingId(value, counts) {
  const base = value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section";
  const occurrence = (counts.get(base) || 0) + 1;
  counts.set(base, occurrence);
  return occurrence === 1 ? base : `${base}-${occurrence}`;
}

export function getMarkdownHeadings(markdown) {
  const counts = new Map();
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^(#{1,3})\s+(.+)$/))
    .filter(Boolean)
    .map((heading) => ({
      level: Math.min(heading[1].length, 3),
      text: heading[2].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, ""),
      id: markdownHeadingId(heading[2], counts)
    }));
}

export function markdownToHtml(markdown, { headingIds = false } = {}) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  const headingCounts = new Map();
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
      const id = headingIds ? ` id="${escapeHtml(markdownHeadingId(heading[2], headingCounts))}"` : "";
      html.push(`<h${level}${id}>${renderInlineMarkdown(heading[2])}</h${level}>`);
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

export function sourceLinkLabel(url) {
  const matchesHost = (domain) => urlMatchesHostname(url, domain);
  if (matchesHost("arxiv.org")) return "arXiv";
  if (matchesHost("huggingface.co") && new URL(url).pathname.startsWith("/datasets/")) {
    return "数据集";
  }
  if (matchesHost("zenodo.org")) return "数据归档";
  if (matchesHost("doi.org")) {
    const doi = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, "");
    return /^10\.5281\/zenodo\./i.test(doi) ? "数据归档" : "正式版";
  }
  if (matchesHost("github.com")) return "代码";
  if ([
    "openaccess.thecvf.com",
    "proceedings.neurips.cc",
    "papers.nips.cc",
    "openreview.net",
    "aclanthology.org",
    "proceedings.mlr.press",
    "ieeexplore.ieee.org",
    "dl.acm.org",
    "ecva.net",
    "iclr.cc",
    "icml.cc",
    "link.springer.com",
    "aaai.org",
    "usenix.org",
    "conf.researchr.org"
  ].some(matchesHost)) {
    return "正式版";
  }
  return "项目页";
}

export function sourceLinkLabelMatches(label, url) {
  if (label === sourceLinkLabel(url)) return true;
  if (label === "作者仓库（待发布）" && urlMatchesHostname(url, "github.com")) {
    return true;
  }
  if (label !== "数据归档") return false;
  if (urlMatchesHostname(url, "zenodo.org")) return true;
  if (!urlMatchesHostname(url, "doi.org")) return false;
  const doi = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, "");
  return /^10\.5281\/zenodo\./i.test(doi);
}

export function formalPrimaryLinkIsCanonical(reference) {
  if (!["peer-reviewed", "workshop"].includes(reference?.publicationStatus)) {
    return true;
  }

  const urls = [
    reference?.url,
    ...(Array.isArray(reference?.links)
      ? reference.links.map((link) => link?.url)
      : [])
  ].filter(Boolean);

  try {
    const hasFormalDestination = urls.some(
      (url) => sourceLinkLabel(url) === "正式版"
    );
    return hasFormalDestination
      && sourceLinkLabel(reference.url) === "正式版";
  } catch {
    return false;
  }
}

export function sourceLinkIdentity(value) {
  const url = new URL(value);
  const hostname = canonicalUrlHostname(value);
  if (hostname === "arxiv.org" || hostname.endsWith(".arxiv.org")) {
    const match = decodeURIComponent(url.pathname).match(
      /^\/(?:abs|pdf|html)\/(.+?)(?:\.pdf)?\/?$/i
    );
    if (match) {
      return `arxiv:${match[1].replace(/v\d+$/i, "").toLowerCase()}`;
    }
  }
  if (hostname === "doi.org" || hostname.endsWith(".doi.org")) {
    return `doi:${decodeURIComponent(url.pathname).replace(/^\/+/, "").toLowerCase()}`;
  }
  url.hostname = hostname;
  url.hash = "";
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

function uniqueSourceLinks(links) {
  const seen = new Set();
  return links.filter((link) => {
    if (!link?.url) return false;
    const identity = sourceLinkIdentity(link.url);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function buildPaperSourceLinks(source) {
  const sourceText = String(source || "");
  const urls = sourceText
    .match(/https:\/\/[^\s;]+/g)
    ?.map((url) => url.replace(/[),.\]]+$/, "")) || [];
  const arxivIds = [
    ...sourceText.matchAll(/arXiv:?\s*(\d{4}\.\d{4,5})(?:v\d+)?/gi)
  ].map((match) => match[1]);

  return uniqueSourceLinks(
    [
      ...urls.map((url) => ({
        label: (() => {
          const urlIndex = sourceText.indexOf(url);
          const segmentStart = Math.max(
            sourceText.lastIndexOf(" / ", urlIndex),
            sourceText.lastIndexOf(";", urlIndex)
          );
          const context = sourceText
            .slice(segmentStart < 0 ? 0 : segmentStart + 1, urlIndex)
            .toLowerCase();
          if (
            urlMatchesHostname(url, "github.com")
            && /release\s+pending|planned\s+(?:code|release)|待发布|即将发布/.test(context)
          ) {
            return "仓库（待发布）";
          }
          return sourceLinkLabel(url);
        })(),
        url
      })),
      ...arxivIds.map((arxivId) => ({
        label: "arXiv",
        url: `https://arxiv.org/abs/${arxivId}`
      }))
    ]
  );
}

export function isAffiliationPlaceholder(value) {
  const normalized = String(value || "").trim();
  return /作者单位|见论文|\b(?:unknown|unconfirmed|not\s+confirmed)\b|^\s*pdf\s*$|\b(?:see|refer\s+to|in)\s+(?:the\s+)?(?:paper\s+)?pdf\b|\baffiliations?\s+(?:are\s+)?in\s+(?:the\s+)?pdf\b/i.test(normalized);
}

export function buildReviewSourceLinks(reference) {
  const links = [];

  if (reference.url) {
    links.push({
      label: sourceLinkLabel(reference.url),
      url: reference.url
    });
  }

  const arxivId = String(reference.canonicalId || "").match(/^arxiv:(\d{4}\.\d{4,5})$/i)?.[1];
  if (arxivId) {
    links.push({
      label: "arXiv",
      url: `https://arxiv.org/abs/${arxivId}`
    });
  }

  if (Array.isArray(reference.links)) {
    for (const link of reference.links) {
      if (link && typeof link.url === "string") {
        links.push({
          label: typeof link.label === "string" && link.label.trim()
            ? link.label.trim()
            : sourceLinkLabel(link.url),
          url: link.url
        });
      }
    }
  }

  return uniqueSourceLinks(links);
}

export async function getPapers() {
  const paperDocs = await readMarkdownDir(path.join(CONTENT, "papers"));
  return paperDocs.map((doc) => {
    const tags = normalizePaperTags(doc.data);
    return {
      ...doc.data,
      tag: tags[0],
      tags,
      sourceLinks: buildPaperSourceLinks(doc.data.source),
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

async function resolveIdeaAuditPath(relativePath) {
  if (!/^content\/idea-audits\/[a-z0-9][a-z0-9-]*\.json$/.test(relativePath || "")) {
    throw new Error(`Invalid Idea audit path: ${relativePath}`);
  }
  const absolutePath = path.resolve(ROOT, String(relativePath || ""));
  const auditRoot = path.join(CONTENT, "idea-audits");
  const fileStat = await lstat(absolutePath);
  if (fileStat.isSymbolicLink()) {
    throw new Error(`Idea audit path cannot be a symbolic link: ${relativePath}`);
  }
  const [resolvedRoot, resolvedTarget] = await Promise.all([
    realpath(auditRoot),
    realpath(absolutePath)
  ]);
  const traversal = path.relative(resolvedRoot, resolvedTarget);
  if (!traversal || traversal === ".." || traversal.startsWith(`..${path.sep}`)
    || path.isAbsolute(traversal)) {
    throw new Error(`Idea audit path must stay inside content/idea-audits: ${relativePath}`);
  }
  return resolvedTarget;
}

async function readIdeaAudit(relativePath) {
  return JSON.parse(await readFile(await resolveIdeaAuditPath(relativePath), "utf8"));
}

function projectionArray(value, label, { optional = false } = {}) {
  if (value == null && optional) return [];
  if (!Array.isArray(value)) {
    throw new TypeError(`Idea Center projection: ${label} must be an array.`);
  }
  return value;
}

function projectionObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Idea Center projection: ${label} must be an object.`);
  }
  return value;
}

function projectionString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`Idea Center projection: ${label} must be a non-empty string.`);
  }
  return value;
}

function projectionNumber(value, label) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") {
    throw new TypeError(`Idea Center projection: ${label} must be a finite number.`);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`Idea Center projection: ${label} must be a finite number.`);
  }
  return number;
}

function reviewedIdeaScore(scoring, reviews, context = "reviewed idea") {
  const reviewList = projectionArray(reviews, `${context}.reviews`);
  if (!reviewList.length) return null;

  const scoringConfig = projectionObject(scoring, "scoring");
  const scoringDimensions = projectionArray(scoringConfig.dimensions, "scoring.dimensions");
  if (!scoringDimensions.length) {
    throw new Error("Idea Center projection: scoring.dimensions must not be empty.");
  }

  const dimensionIds = scoringDimensions.map((dimension, index) => {
    const item = projectionObject(dimension, `scoring.dimensions[${index}]`);
    return projectionString(item.id, `scoring.dimensions[${index}].id`);
  });
  const maxScore = projectionNumber(scoringConfig.maxScore ?? 10, "scoring.maxScore");
  const normalizedReviews = reviewList.map((review, reviewIndex) => {
    const item = projectionObject(review, `${context}.reviews[${reviewIndex}]`);
    const scores = projectionObject(item.scores, `${context}.reviews[${reviewIndex}].scores`);
    const normalizedScores = Object.fromEntries(dimensionIds.map((dimensionId) => [
      dimensionId,
      projectionNumber(
        scores[dimensionId],
        `${context}.reviews[${reviewIndex}].scores.${dimensionId}`
      )
    ]));

    return {
      ...item,
      overall: projectionNumber(item.overall, `${context}.reviews[${reviewIndex}].overall`),
      scores: normalizedScores
    };
  });
  const dimensions = Object.fromEntries(dimensionIds.map((dimensionId) => [
    dimensionId,
    Math.min(...normalizedReviews.map((review) => review.scores[dimensionId]))
  ]));
  const overall = Math.min(...normalizedReviews.map((review) => review.overall));

  return {
    overall,
    band: overall === maxScore && Object.values(dimensions).every((score) => score === maxScore)
      ? "全项通过"
      : "仍有缺口",
    dimensions
  };
}

function ideaPoolItemId(item) {
  return typeof item === "string" ? item : item?.candidateId || item?.id;
}

function ideaPoolSourceUrl(source) {
  return source?.url || source?.primaryUrl || source?.officialUrl;
}

function projectIdeaCandidatePool(pool) {
  const references = pool.verifiedReferences || pool.searchAudit?.references || [];
  const assets = pool.assetChecks || pool.assetAudit?.assets || [];
  const candidateLedger = pool.candidateLedger || [];
  const ledgerMap = new Map(candidateLedger.map((entry) => [ideaPoolItemId(entry), entry]));
  const shortlist = pool.shortlist || [];
  const rejected = pool.rejected || [];

  return {
    searchedAt: pool.searchedAt || pool.reviewedAt,
    conclusion: typeof pool.conclusion === "string"
      ? pool.conclusion
      : pool.conclusion?.summary,
    latestDelta: pool.searchAudit?.latestDelta || pool.latestDelta,
    counts: {
      queries: pool.searchAudit?.queryRuns?.length || 0,
      references: references.length,
      assets: assets.length,
      candidates: candidateLedger.length,
      shortlisted: shortlist.length,
      rejected: rejected.length
    },
    candidateIds: candidateLedger.map(ideaPoolItemId),
    shortlistIds: shortlist.map(ideaPoolItemId),
    queryRuns: (pool.searchAudit?.queryRuns || []).map((run) => ({
      id: run.familyId || run.family || run.id,
      query: run.query,
      source: run.source,
      rationale: run.scopeRationale || run.rationale,
      resultCount: run.resultCount
    })),
    references: references.map((source) => ({
      id: source.canonicalId || source.id,
      title: source.title || source.name || source.id,
      url: ideaPoolSourceUrl(source),
      venue: source.venue,
      year: source.year,
      provenance: source.sourceFamily || source.sourceOrigin || source.provenance
        || (source.localPaperId ? "local-corpus" : "external-primary")
    })),
    assets: assets.map((asset) => ({
      name: asset.name || asset.title || asset.id,
      type: asset.type,
      url: ideaPoolSourceUrl(asset),
      version: asset.fixedCommit || asset.commit || asset.digest || asset.sha256 || asset.version,
      finding: asset.finding || asset.result || asset.usability || asset.verifiedCapability
        || asset.reuse || asset.status || asset.notes
    })),
    rejected: rejected.map((entry) => {
      const id = ideaPoolItemId(entry);
      const ledgerEntry = ledgerMap.get(id) || {};
      const rawReasons = entry.reasons || entry.mechanicalReasons || entry.reason || [];
      return {
        id,
        title: entry.title || ledgerEntry.title || ledgerEntry.canonicalClaim
          || ledgerEntry.coreClaim || id,
        category: entry.category || ledgerEntry.category || "未通过硬门槛",
        reasons: Array.isArray(rawReasons) ? rawReasons : [rawReasons],
        primaryUrl: entry.primaryUrl || ideaPoolSourceUrl(entry)
          || ledgerEntry.primaryUrl || ideaPoolSourceUrl(ledgerEntry)
      };
    })
  };
}

function newestIdeaAuditTimestamp(pools) {
  return pools.map((pool) => pool.searchedAt).filter(Boolean).sort().at(-1);
}

function uniqueIdeaPoolItems(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function projectIdeaCandidatePools(rawPools) {
  const pools = rawPools.map(projectIdeaCandidatePool);
  if (pools.length === 1) return { ...pools[0], rounds: 1 };

  const queryRuns = uniqueIdeaPoolItems(
    pools.flatMap((pool) => pool.queryRuns),
    (run) => `${run.id || "query"}:${run.query || ""}`
  );
  const references = uniqueIdeaPoolItems(
    pools.flatMap((pool) => pool.references),
    (source) => source.id || source.url
  );
  const assets = uniqueIdeaPoolItems(
    pools.flatMap((pool) => pool.assets),
    (asset) => `${asset.url || asset.name}:${asset.version || ""}`
  );
  const candidateIds = [...new Set(pools.flatMap((pool) => pool.candidateIds))];
  const shortlistIds = [...new Set(pools.flatMap((pool) => pool.shortlistIds))];
  const rejected = uniqueIdeaPoolItems(
    pools.flatMap((pool) => pool.rejected),
    (candidate) => candidate.id
  ).filter((candidate) => !shortlistIds.includes(candidate.id));

  return {
    searchedAt: newestIdeaAuditTimestamp(pools),
    conclusion: pools.map((pool) => pool.conclusion).filter(Boolean).join(" "),
    latestDelta: pools.map((pool) => pool.latestDelta).filter(Boolean).join(" "),
    rounds: pools.length,
    counts: {
      queries: queryRuns.length,
      references: references.length,
      assets: assets.length,
      candidates: candidateIds.length,
      shortlisted: shortlistIds.length,
      rejected: rejected.length
    },
    candidateIds,
    shortlistIds,
    queryRuns,
    references,
    assets,
    rejected
  };
}

function projectLegacyIdeaAudit(audit) {
  const sources = new Map((audit.sourceLedger || []).map((source) => [source.canonicalId, source]));
  return {
    reviewedAt: audit.reviewedAt,
    summary: audit.closureSummary?.interpretation,
    ideas: (audit.ideas || []).map((idea) => ({
      id: idea.originalIdeaId,
      title: idea.originalClaim?.title || idea.originalIdeaId,
      decision: idea.decision,
      rationale: idea.rationale,
      residualBoundary: idea.residualBoundary,
      requiredNextAction: idea.requiredNextAction,
      nearestWorks: (idea.nearestWorks || []).map((work) => ({
        ...work,
        title: sources.get(work.canonicalId)?.title || work.canonicalId,
        url: sources.get(work.canonicalId)?.url
      }))
    }))
  };
}

function projectIdeaSelectionAudit(reports) {
  const normalized = reports.map((report) => ({
    selectedAt: report.selectedAt,
    selectionAgentId: report.selectionAgentId,
    candidatePoolPath: report.candidatePoolPath,
    selectedCount: (report.selectedCandidateIds || []).length,
    decisionCount: (report.candidateDecisions || []).length,
    crossDirectionFinding: report.crossDirectionFinding
  }));
  return {
    rounds: normalized.length,
    selectedAt: normalized.map((report) => report.selectedAt).filter(Boolean).sort().at(-1),
    reviewerCount: new Set(normalized.map((report) => report.selectionAgentId)).size,
    decisionCount: normalized.reduce((sum, report) => sum + report.decisionCount, 0),
    selectedCount: normalized.reduce((sum, report) => sum + report.selectedCount, 0),
    reports: normalized
  };
}

async function loadReviewedIdea(candidate, scoring, paperMap, workflow, readAudit, context) {
  const candidateRef = projectionObject(candidate, context);
  const dossierPath = projectionString(candidateRef.dossierPath, `${context}.dossierPath`);
  const reviewPaths = projectionArray(candidateRef.reviewPaths, `${context}.reviewPaths`);
  const [dossier, ...reviews] = await Promise.all([
    readAudit(dossierPath),
    ...reviewPaths.map((reviewPath, index) => (
      readAudit(projectionString(reviewPath, `${context}.reviewPaths[${index}]`))
    ))
  ]);
  const dossierRecord = projectionObject(dossier, `${context}.dossier`);
  const dossierId = projectionString(
    dossierRecord.id || dossierRecord.candidateId,
    `${context}.dossier.candidateId`
  );
  const score = reviewedIdeaScore(scoring, reviews, `${context} (${dossierId})`);
  if (!score) {
    throw new Error(
      `Idea Center projection: ${context}.reviewPaths must contain at least one review report.`
    );
  }

  const workflowConfig = projectionObject(workflow, "idea exploration workflow");
  const evaluation = projectionObject(workflowConfig.evaluation, "idea exploration workflow.evaluation");
  const requirements = projectionObject(
    workflowConfig.requirements,
    "idea exploration workflow.requirements"
  );
  const reviewerLenses = projectionArray(
    evaluation.reviewerLenses,
    "idea exploration workflow.evaluation.reviewerLenses"
  );
  const requiredLenses = reviewerLenses.map((lens, index) => {
    const item = projectionObject(
      lens,
      `idea exploration workflow.evaluation.reviewerLenses[${index}]`
    );
    return projectionString(
      item.id,
      `idea exploration workflow.evaluation.reviewerLenses[${index}].id`
    );
  });
  const minimumReviewers = projectionNumber(
    requirements.minBlindReviewersPerIdea,
    "idea exploration workflow.requirements.minBlindReviewersPerIdea"
  );
  const panelComplete = reviews.length >= minimumReviewers
    && requiredLenses.every((lens) => reviews.some((review) => review.lens === lens));
  const publicationScore = projectionNumber(
    evaluation.publicationScore,
    "idea exploration workflow.evaluation.publicationScore"
  );
  const passed = panelComplete
    && score.overall === publicationScore
    && Object.values(score.dimensions).every((value) => value === publicationScore);
  score.band = passed ? "全项通过" : "仍有缺口";
  if (candidateRef.reviewStatus === "passed" && !passed) {
    throw new Error(`${dossierId}: incomplete or non-perfect panel cannot be marked passed.`);
  }
  const reviewStatus = passed ? "passed" : candidateRef.reviewStatus || "rejected";

  return {
    ...dossierRecord,
    id: dossierId,
    rank: candidateRef.rank,
    decision: candidateRef.decision,
    reviewStatus,
    score,
    computedScore: score.overall,
    blindReview: reviews.length ? {
      status: reviewStatus,
      round: candidateRef.round || 1,
      summary: candidateRef.summary,
      nextAction: candidateRef.nextAction,
      reviewers: reviews.map((review, index) => ({
        agentId: review.reviewerAgentId,
        lens: review.lens,
        reviewedAt: review.reviewedAt,
        scores: review.scores,
        rationales: review.rationales,
        strongestObjection: review.strongestObjection,
        requiredExperiment: review.requiredExperiment,
        overall: review.overall,
        reportPath: reviewPaths[index]
      }))
    } : null,
    evidence: projectionArray(
      dossierRecord.evidence,
      `${context}.dossier.evidence`,
      { optional: true }
    ).map((source, sourceIndex) => {
      const sourceRecord = projectionObject(
        source,
        `${context}.dossier.evidence[${sourceIndex}]`
      );
      return {
        ...sourceRecord,
        localLink: sourceRecord.localPaperId
          ? paperMap.get(sourceRecord.localPaperId)?.link
          : undefined
      };
    })
  };
}

export async function projectIdeaCenterData(
  ideaCenter,
  { papers = [], workflow, readAudit = readIdeaAudit } = {}
) {
  const center = projectionObject(ideaCenter, "ideaCenter");
  const directionRecords = projectionArray(center.directions, "ideaCenter.directions");
  const paperRecords = projectionArray(papers, "papers");
  if (typeof readAudit !== "function") {
    throw new TypeError("Idea Center projection: readAudit must be a function.");
  }
  const paperMap = new Map(paperRecords.map((paper, paperIndex) => {
    const paperRecord = projectionObject(paper, `papers[${paperIndex}]`);
    return [paperRecord.id, paperRecord];
  }));

  const directions = await Promise.all(directionRecords.map(async (direction, directionIndex) => {
    const directionRecord = projectionObject(direction, `ideaCenter.directions[${directionIndex}]`);
    const directionId = projectionString(
      directionRecord.id,
      `ideaCenter.directions[${directionIndex}].id`
    );
    const directionContext = `ideaCenter.directions[${directionIndex}] (${directionId})`;
    const isReviewed = directionRecord.status === "reviewed";
    const candidateRefs = projectionArray(
      directionRecord.candidateRefs,
      `${directionContext}.candidateRefs`,
      { optional: !isReviewed }
    );
    const candidatePoolPaths = projectionArray(
      directionRecord.candidatePoolPaths
        ?? (directionRecord.candidatePoolPath ? [directionRecord.candidatePoolPath] : []),
      `${directionContext}.candidatePoolPaths`
    ).map((auditPath, pathIndex) => projectionString(
      auditPath,
      `${directionContext}.candidatePoolPaths[${pathIndex}]`
    ));
    const selectionReportPaths = projectionArray(
      directionRecord.selectionReportPaths,
      `${directionContext}.selectionReportPaths`,
      { optional: true }
    ).map((auditPath, pathIndex) => projectionString(
      auditPath,
      `${directionContext}.selectionReportPaths[${pathIndex}]`
    ));
    const [reviewedIdeas, candidatePool, legacyAudit, selectionReports] = await Promise.all([
      Promise.all((isReviewed ? candidateRefs : []).map((candidate, candidateIndex) => (
        loadReviewedIdea(
          candidate,
          center.scoring,
          paperMap,
          workflow,
          readAudit,
          `${directionContext}.candidateRefs[${candidateIndex}]`
        )
      ))),
      candidatePoolPaths.length
        ? Promise.all(candidatePoolPaths.map((auditPath) => readAudit(auditPath)))
        : null,
      directionRecord.legacyAuditPath ? readAudit(directionRecord.legacyAuditPath) : null,
      Promise.all(selectionReportPaths.map((auditPath) => readAudit(auditPath)))
    ]);
    const embeddedIdeaRecords = projectionArray(
      directionRecord.ideas,
      `${directionContext}.ideas`,
      { optional: true }
    );
    const embeddedIdeas = (isReviewed ? [] : embeddedIdeaRecords).map((idea, ideaIndex) => {
      const ideaRecord = projectionObject(idea, `${directionContext}.ideas[${ideaIndex}]`);
      return {
        ...ideaRecord,
        computedScore: calculateIdeaScore(center.scoring, ideaRecord.score?.dimensions),
        evidence: projectionArray(
          ideaRecord.evidence,
          `${directionContext}.ideas[${ideaIndex}].evidence`,
          { optional: true }
        ).map((source, sourceIndex) => {
          const sourceRecord = projectionObject(
            source,
            `${directionContext}.ideas[${ideaIndex}].evidence[${sourceIndex}]`
          );
          return {
            ...sourceRecord,
            localLink: sourceRecord.localPaperId
              ? paperMap.get(sourceRecord.localPaperId)?.link
              : undefined
          };
        })
      };
    });
    const projectionWarnings = isReviewed && embeddedIdeaRecords.length
      ? [
          `${directionContext}: ignored ${embeddedIdeaRecords.length} embedded idea(s); `
          + "reviewed directions only project candidateRefs."
        ]
      : [];

    return {
      ...directionRecord,
      ideas: isReviewed ? reviewedIdeas : embeddedIdeas,
      projectionWarnings,
      candidatePool: candidatePool ? projectIdeaCandidatePools(candidatePool) : null,
      legacyAudit: legacyAudit ? projectLegacyIdeaAudit(legacyAudit) : null,
      selectionAudit: selectionReports.length
        ? projectIdeaSelectionAudit(selectionReports)
        : null
    };
  }));

  const finalReview = center.finalReview?.reportPath
    ? {
        ...center.finalReview,
        report: {
          ...await readAudit(projectionString(
            center.finalReview.reportPath,
            "ideaCenter.finalReview.reportPath"
          )),
          status: center.finalReview.status
        }
      }
    : center.finalReview;

  return {
    ...center,
    directions,
    finalReview
  };
}

export async function getIdeaCenter() {
  const [ideaCenter, papers, workflow] = await Promise.all([
    readFile(path.join(CONTENT, "idea-center.json"), "utf8").then(JSON.parse),
    getPapers(),
    readFile(path.join(CONFIG, "idea-exploration-workflow.json"), "utf8").then(JSON.parse)
  ]);

  return projectIdeaCenterData(ideaCenter, { papers, workflow });
}

const REVIEW_TYPE_LABELS = {
  survey: "综述",
  tutorial: "教程",
  method: "方法",
  benchmark: "基准",
  dataset: "数据集",
  standard: "标准",
  position: "观点"
};

const REVIEW_STATUS_LABELS = {
  "peer-reviewed": "已同行评审",
  accepted: "已录用，正式页待发布",
  workshop: "正式 Workshop",
  "workshop-accepted": "Workshop 已录用，正式页待发布",
  preprint: "预印本",
  "technical-report": "技术报告",
  standard: "标准",
  dataset: "数据集发布"
};

export async function getReviewCenter() {
  const [center, tags, papers, reviewDocs] = await Promise.all([
    readFile(path.join(CONTENT, "review-center.json"), "utf8").then(JSON.parse),
    getTags(),
    getPapers(),
    readJsonDir(path.join(CONTENT, "reviews"))
  ]);
  const paperMap = new Map(papers.map((paper) => [paper.id, paper]));
  const reviewMap = new Map(reviewDocs.map((doc) => [doc.data.id, doc.data]));

  const directions = tags.map((tag) => {
    const review = reviewMap.get(tag.id);
    if (!review) throw new Error(`Missing review for configured direction: ${tag.id}`);

    const references = review.references.map((reference) => {
      const localPaper = reference.localPaperId
        ? paperMap.get(reference.localPaperId)
        : undefined;
      if (reference.localPaperId && !localPaper) {
        throw new Error(
          `${review.id} review references missing local paper: ${reference.localPaperId}`
        );
      }
      const origin = reference.localPaperId ? "local" : "external";
      const sourceLinks = buildReviewSourceLinks(reference);

      return {
        ...reference,
        title: localPaper?.title || reference.title,
        origin,
        badge: origin === "local" ? "本库已报告" : "外部文献",
        href: origin === "local"
          ? `../../papers/${localPaper.id}/`
          : reference.url,
        sourceHref: sourceLinks[0]?.url || reference.url,
        sourceLinks,
        publicationTypeLabel: REVIEW_TYPE_LABELS[reference.publicationType] || reference.publicationType,
        publicationStatusLabel:
          REVIEW_STATUS_LABELS[reference.publicationStatus] || reference.publicationStatus
      };
    });
    const referenceMap = new Map(references.map((reference) => [reference.id, reference]));

    return {
      ...tag,
      ...review,
      currentSnapshotFingerprint: reviewSnapshotFingerprint(review),
      sections: review.sections.map((section) => ({
        ...section,
        bodyHtml: markdownToHtml(section.body),
        references: section.referenceIds
          .map((referenceId) => referenceMap.get(referenceId))
          .filter(Boolean)
      })),
      references
    };
  });

  return {
    ...center,
    directions
  };
}

export async function getDirectionReview(id) {
  const center = await getReviewCenter();
  return center.directions.find((direction) => direction.id === id) || null;
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
