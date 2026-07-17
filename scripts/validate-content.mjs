import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const CONTENT = path.join(ROOT, "content");
const CONFIG = path.join(ROOT, "config");
const PUBLIC = path.join(ROOT, "public");

const errors = [];
const LEGACY_AFFILIATION_PLACEHOLDER_FILES = new Set([
  "caad-causality-aware-driving.md",
  "cars-responsibility-testing.md",
  "copad-v2x-trajectory-prediction.md",
  "dawn-world-action-model.md",
  "driving-world-model-video-gpt.md",
  "driving-world-model-video.md",
  "real2sim-physics-4dgs.md",
  "revisiting-adversarial-attacks-gpt.md",
  "revisiting-adversarial-attacks.md",
  "safer-safety-scenario-gpt.md",
  "safer-safety-scenario.md",
  "swarmdrive-v2v-coordination.md",
  "v2x-cooperative-planning-gpt.md",
  "v2x-cooperative-planning.md",
  "view-induced-trajectory-manipulation.md"
]);
const LEGACY_IMAGELESS_FILES = new Set([
  "revisiting-adversarial-attacks.md",
  "vla-end-to-end-driving.md"
]);

function addError(message) {
  errors.push(message);
}

function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMarkdownFile(text, filePath) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    addError(`${filePath} is missing JSON frontmatter`);
    return { data: {}, body: "" };
  }

  try {
    return { data: JSON.parse(match[1]), body: match[2].trim() };
  } catch (error) {
    addError(`${filePath} has invalid JSON frontmatter: ${error.message}`);
    return { data: {}, body: match[2].trim() };
  }
}

async function readMarkdownDir(dir) {
  const entries = await readdir(dir);
  const docs = [];

  for (const file of entries.filter((entry) => entry.endsWith(".md")).sort()) {
    const filePath = path.join(dir, file);
    const text = await readFile(filePath, "utf8");
    docs.push({ file, filePath, ...parseMarkdownFile(text, filePath) });
  }

  return docs;
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

function extractArxivIds(...values) {
  const ids = new Set();
  const text = values.filter(Boolean).join(" ");
  const patterns = [
    /arXiv:?\s*(\d{4}\.\d{4,5})(?:v\d+)?/gi,
    /arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})(?:v\d+)?/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      ids.add(match[1]);
    }
  }

  return [...ids].sort();
}

function parseReportedPapers(text) {
  const rows = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 4 || cells[0] === "论文 ID" || /^-+$/.test(cells[0])) continue;

    rows.push({
      paperId: cells[0],
      title: cells[1],
      arxivId: cells[2],
      digests: cells[3].split(",").map((item) => item.trim()).filter(Boolean)
    });
  }

  return rows;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim());
}

function validateStringField(data, field, file) {
  if (typeof data[field] !== "string" || !data[field].trim()) {
    addError(`${file} must define a non-empty ${field} string`);
  }
}

function validateStringArrayField(data, field, file) {
  if (!isStringArray(data[field])) {
    addError(`${file} must define ${field} as a non-empty string array`);
  }
}

function validateAffiliations(data, file) {
  validateStringArrayField(data, "affiliations", file);

  if (LEGACY_AFFILIATION_PLACEHOLDER_FILES.has(file)) return;

  const placeholders = data.affiliations.filter((item) => /作者单位|见论文|PDF/.test(item));
  if (placeholders.length) {
    addError(`${file} must use verified affiliations, not placeholders: ${placeholders.join(", ")}`);
  }
}

function validateNotes(notes, file) {
  if (!Array.isArray(notes)) {
    addError(`${file} must define notes as an array`);
    return;
  }

  for (const [index, note] of notes.entries()) {
    if (!note || typeof note !== "object" || Array.isArray(note)) {
      addError(`${file} notes[${index}] must be an object`);
      continue;
    }

    for (const field of ["user", "time", "text"]) {
      if (typeof note[field] !== "string" || !note[field].trim()) {
        addError(`${file} notes[${index}] must define a non-empty ${field} string`);
      }
    }
  }
}

function validateObjectArrayField(data, field, requiredFields, file) {
  const items = data[field];
  if (!Array.isArray(items) || !items.length) {
    addError(`${file} must define ${field} as a non-empty array`);
    return [];
  }

  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      addError(`${file} ${field}[${index}] must be an object`);
      continue;
    }

    for (const requiredField of requiredFields) {
      if (typeof item[requiredField] !== "string" || !item[requiredField].trim()) {
        addError(`${file} ${field}[${index}] must define a non-empty ${requiredField} string`);
      }
    }
  }

  return items.filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function validateLandscapeTagArrays(items, field, knownTags, file) {
  for (const [index, item] of items.entries()) {
    if (!isStringArray(item.tags) || !item.tags.length) {
      addError(`${file} ${field}[${index}] must define tags as a non-empty string array`);
      continue;
    }

    for (const tag of item.tags) {
      if (!knownTags.has(tag)) {
        addError(`${file} ${field}[${index}] references unknown tag: ${tag}`);
      }
    }
  }
}

function validateImageUrls(markdown, file) {
  const imagePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let count = 0;
  let match;

  while ((match = imagePattern.exec(markdown)) !== null) {
    const url = match[1];
    count += 1;

    const duplicatedArxivHtmlAsset = url.match(
      /^https:\/\/arxiv\.org\/html\/(\d{4}\.\d{4,5}v\d+)\/\1\//
    );

    if (duplicatedArxivHtmlAsset) {
      addError(`${file} has duplicated arXiv HTML asset path: ${url}`);
    }

    if (/^(?:\.\.?\/)+/.test(url)) {
      if (!url.startsWith("../../assets/")) {
        addError(`${file} uses unsupported relative image path: ${url}`);
        continue;
      }

      const publicPath = path.join(PUBLIC, url.replace(/^(?:\.\.\/)+/, ""));
      if (!existsSync(publicPath)) {
        addError(`${file} references missing local image asset: ${url}`);
      }
    }
  }

  if (!count && !LEGACY_IMAGELESS_FILES.has(file)) {
    addError(`${file} must include at least one official figure image`);
  }
}

const interestConfig = JSON.parse(await readFile(path.join(CONFIG, "research-interests.json"), "utf8"));
const knownTags = new Set(interestConfig.interests.map((interest) => interest.id));
const landscapeFile = "research-landscape.json";
let landscapeConfig = {};

try {
  landscapeConfig = JSON.parse(await readFile(path.join(CONTENT, landscapeFile), "utf8"));
} catch (error) {
  addError(`${landscapeFile} has invalid JSON: ${error.message}`);
}

validateStringField(landscapeConfig, "title", landscapeFile);
validateStringField(landscapeConfig, "summary", landscapeFile);
validateStringField(landscapeConfig, "updatedAt", landscapeFile);

if (!/^\d{4}-\d{2}-\d{2}$/.test(landscapeConfig.updatedAt || "")) {
  addError(`${landscapeFile} updatedAt must use YYYY-MM-DD`);
}

if (!Number.isInteger(landscapeConfig.analysisWindowIssues) || landscapeConfig.analysisWindowIssues < 1) {
  addError(`${landscapeFile} analysisWindowIssues must be a positive integer`);
}

const landscapeTrends = validateObjectArrayField(
  landscapeConfig,
  "trends",
  ["id", "title", "evidence", "judgement"],
  landscapeFile
);
const landscapeHotspots = validateObjectArrayField(
  landscapeConfig,
  "hotspots",
  ["level", "title", "evidence", "whyItMatters"],
  landscapeFile
);
const landscapeOpportunities = validateObjectArrayField(
  landscapeConfig,
  "opportunities",
  ["priority", "title", "question", "whyNow", "minimumStudy", "risk"],
  landscapeFile
);
const landscapeDirections = validateObjectArrayField(
  landscapeConfig,
  "directions",
  ["tag", "signal", "focus", "gap", "ideaTitle", "idea", "method", "validation", "novelty"],
  landscapeFile
);

validateLandscapeTagArrays(landscapeTrends, "trends", knownTags, landscapeFile);
validateLandscapeTagArrays(landscapeHotspots, "hotspots", knownTags, landscapeFile);
validateLandscapeTagArrays(landscapeOpportunities, "opportunities", knownTags, landscapeFile);

const landscapeDirectionTags = new Set();
for (const [index, direction] of landscapeDirections.entries()) {
  if (!knownTags.has(direction.tag)) {
    addError(`${landscapeFile} directions[${index}] references unknown tag: ${direction.tag}`);
  } else if (landscapeDirectionTags.has(direction.tag)) {
    addError(`${landscapeFile} has duplicate direction analysis for tag: ${direction.tag}`);
  } else {
    landscapeDirectionTags.add(direction.tag);
  }
}

for (const tag of knownTags) {
  if (!landscapeDirectionTags.has(tag)) {
    addError(`${landscapeFile} is missing direction analysis for tag: ${tag}`);
  }
}

const paperDocs = await readMarkdownDir(path.join(CONTENT, "papers"));
const digestDocs = await readMarkdownDir(path.join(CONTENT, "digests"));

const papers = paperDocs.map((doc) => {
  const expectedId = path.basename(doc.file, ".md");
  const id = doc.data.id;
  const revisionOf = typeof doc.data.revisionOf === "string" ? doc.data.revisionOf.trim() : "";
  const tags = normalizePaperTags(doc.data);
  const arxivIds = extractArxivIds(doc.data.source, doc.body);
  const normalizedTitle = normalizeTitle(doc.data.title);

  if (id !== expectedId) {
    addError(`${doc.file} has id "${id}", expected "${expectedId}"`);
  }

  validateStringField(doc.data, "title", doc.file);
  validateStringField(doc.data, "source", doc.file);
  validateStringField(doc.data, "comment", doc.file);
  validateStringArrayField(doc.data, "authors", doc.file);
  validateAffiliations(doc.data, doc.file);
  validateImageUrls(doc.body, doc.file);

  if (!tags.length) {
    addError(`${doc.file} is missing tag/tags`);
  }

  for (const tag of tags) {
    if (!knownTags.has(tag)) {
      addError(`${doc.file} references unknown tag: ${tag}`);
    }
  }

  return { ...doc, id, revisionOf, tags, arxivIds, normalizedTitle };
});

const paperById = new Map();
for (const paper of papers) {
  if (paperById.has(paper.id)) {
    addError(`duplicate paper id: ${paper.id}`);
  } else {
    paperById.set(paper.id, paper);
  }
}

for (const paper of papers) {
  if (!paper.revisionOf) continue;
  const sourcePaper = paperById.get(paper.revisionOf);
  if (!sourcePaper) {
    addError(`${paper.file} revisionOf references missing paper: ${paper.revisionOf}`);
  } else if (sourcePaper.revisionOf) {
    addError(`${paper.file} revisionOf must point to an original paper, not another revision: ${paper.revisionOf}`);
  }
}

const papersByArxiv = new Map();
for (const paper of papers) {
  for (const arxivId of paper.arxivIds) {
    const existing = papersByArxiv.get(arxivId) || new Map();
    const canonicalId = paper.revisionOf || paper.id;
    const existingIds = existing.get(canonicalId) || [];
    existingIds.push(paper.id);
    existing.set(canonicalId, existingIds);
    papersByArxiv.set(arxivId, existing);
  }
}

for (const [arxivId, papersByCanonicalId] of papersByArxiv) {
  if (papersByCanonicalId.size > 1) {
    const paperIds = [...papersByCanonicalId.values()].flat();
    addError(`duplicate arXiv id ${arxivId}: ${paperIds.join(", ")}`);
  }
}

const papersByTitle = new Map();
for (const paper of papers) {
  if (!paper.normalizedTitle) continue;
  const existing = papersByTitle.get(paper.normalizedTitle) || new Map();
  const canonicalId = paper.revisionOf || paper.id;
  const existingIds = existing.get(canonicalId) || [];
  existingIds.push(paper.id);
  existing.set(canonicalId, existingIds);
  papersByTitle.set(paper.normalizedTitle, existing);
}

for (const papersByCanonicalId of papersByTitle.values()) {
  if (papersByCanonicalId.size > 1) {
    const paperIds = [...papersByCanonicalId.values()].flat();
    addError(`duplicate paper title: ${paperIds.join(", ")}`);
  }
}

const digestById = new Map();
const paperDigestMap = new Map();

for (const digest of digestDocs) {
  const expectedId = path.basename(digest.file, ".md");
  const id = digest.data.id;
  const date = digest.data.date;
  const dateFromId = expectedId.match(/^(\d{4}-\d{2}-\d{2})(?:-[a-z0-9-]+)?$/)?.[1];

  if (id !== expectedId) {
    addError(`${digest.file} has id "${id}", expected "${expectedId}"`);
  }

  if (!dateFromId || date !== dateFromId) {
    addError(`${digest.file} date must match the YYYY-MM-DD prefix in file id`);
  }

  validateStringField(digest.data, "title", digest.file);
  validateStringField(digest.data, "summary", digest.file);
  validateStringArrayField(digest.data, "keywords", digest.file);
  validateNotes(digest.data.notes, digest.file);

  if (!Array.isArray(digest.data.papers)) {
    addError(`${digest.file} must define a papers array`);
    continue;
  }

  digestById.set(id, digest);

  for (const paperId of digest.data.papers) {
    if (!paperById.has(paperId)) {
      addError(`${digest.file} references missing paper: ${paperId}`);
      continue;
    }

    const existingDigest = paperDigestMap.get(paperId);
    if (existingDigest) {
      addError(`${paperId} appears in multiple digests: ${existingDigest}, ${id}`);
    } else {
      paperDigestMap.set(paperId, id);
    }
  }
}

for (const paper of papers) {
  if (!paperDigestMap.has(paper.id)) {
    addError(`${paper.file} is not referenced by any digest`);
  }
}

const reportedPath = path.join(CONTENT, "reported-papers.md");
const reportedRows = parseReportedPapers(await readFile(reportedPath, "utf8"));
const reportedById = new Map();
const reportedByArxiv = new Map();

for (const row of reportedRows) {
  if (reportedById.has(row.paperId)) {
    addError(`reported-papers.md has duplicate paper id: ${row.paperId}`);
  } else {
    reportedById.set(row.paperId, row);
  }

  if (row.arxivId && row.arxivId !== "-") {
    if (reportedByArxiv.has(row.arxivId)) {
      addError(`reported-papers.md has duplicate arXiv id ${row.arxivId}`);
    } else {
      reportedByArxiv.set(row.arxivId, row);
    }
  }

  if (row.digests.length !== 1) {
    addError(`reported-papers.md row ${row.paperId} must list exactly one digest`);
  }

  for (const digestId of row.digests) {
    if (!digestById.has(digestId)) {
      addError(`reported-papers.md row ${row.paperId} references missing digest: ${digestId}`);
    }
  }
}

for (const paper of papers.filter((paper) => !paper.revisionOf)) {
  const row = reportedById.get(paper.id);
  if (!row) {
    addError(`reported-papers.md is missing row for ${paper.id}`);
    continue;
  }

  if (paper.arxivIds.length && !paper.arxivIds.includes(row.arxivId)) {
    addError(`reported-papers.md row ${paper.id} has arXiv ${row.arxivId}, expected ${paper.arxivIds.join(" or ")}`);
  }

  if (!paper.arxivIds.length && normalizeTitle(row.title) !== paper.normalizedTitle) {
    addError(`reported-papers.md row ${paper.id} title does not match paper title`);
  }

  const digestId = paperDigestMap.get(paper.id);
  if (digestId && row.digests[0] !== digestId) {
    addError(`reported-papers.md row ${paper.id} lists digest ${row.digests[0]}, expected ${digestId}`);
  }
}

for (const row of reportedRows) {
  if (!paperById.has(row.paperId)) {
    addError(`reported-papers.md references missing paper file: ${row.paperId}`);
  } else if (paperById.get(row.paperId).revisionOf) {
    addError(`reported-papers.md should not list revision paper: ${row.paperId}`);
  }
}

if (errors.length) {
  console.error("Content validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Content validation passed: ${digestDocs.length} digests, ${paperDocs.length} papers.`);
