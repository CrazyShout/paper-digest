import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPaperSourceLinks,
  formalPrimaryLinkIsCanonical,
  isValidIsoDate,
  sourceLinkIdentity,
  sourceLinkLabel
} from "../src/lib/content.js";
import {
  extractArxivIds,
  extractDois,
  legacySearchAuditCountFields,
  localCorpusRipgrepFlagsMatch,
  localCorpusSearchSnapshot,
  missingSourceAttemptFamilies,
  normalizeCanonicalId,
  registerCanonicalAlias,
  unusedAuditedSourceFamilies
} from "../src/lib/review-audit.js";
import { reviewSnapshotFingerprint } from "../src/lib/review-fingerprint.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const CONTENT = path.join(ROOT, "content");
const CONFIG = path.join(ROOT, "config");
const PUBLIC = path.join(ROOT, "public");

const errors = [];
const LEGACY_AFFILIATION_PLACEHOLDER_FILES = new Set([
  "caad-causality-aware-driving.md",
  "copad-v2x-trajectory-prediction.md",
  "dawn-world-action-model.md",
  "driving-world-model-video-gpt.md",
  "driving-world-model-video.md",
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

function isoDateInTimeZone(date = new Date(), timeZone = "Asia/Shanghai") {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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

async function readJsonDir(dir) {
  let entries = [];
  try {
    entries = await readdir(dir);
  } catch (error) {
    addError(`${path.relative(CONTENT, dir)} could not be read: ${error.message}`);
    return [];
  }

  const docs = [];
  for (const file of entries.filter((entry) => entry.endsWith(".json")).sort()) {
    const filePath = path.join(dir, file);
    try {
      docs.push({
        file,
        filePath,
        data: JSON.parse(await readFile(filePath, "utf8"))
      });
    } catch (error) {
      addError(`${path.relative(CONTENT, filePath)} has invalid JSON: ${error.message}`);
      docs.push({ file, filePath, data: {} });
    }
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

function localPaperCanonicalIds(paper) {
  return [
    ...extractArxivIds(paper?.data?.source).map((id) => `arxiv:${id}`),
    ...extractDois(paper?.data?.source).map((doi) => `doi:${doi}`)
  ].map(normalizeCanonicalId);
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
  return (
    Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string" && item.trim())
  );
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

function validateLandscapeEvidenceArrays(items, field, file) {
  for (const [index, item] of items.entries()) {
    if (!isStringArray(item.evidencePaperIds) || !item.evidencePaperIds.length) {
      addError(`${file} ${field}[${index}] must define evidencePaperIds as a non-empty string array`);
      continue;
    }

    if (item.evidencePaperIds.length < 2 || item.evidencePaperIds.length > 4) {
      addError(`${file} ${field}[${index}] must cite between 2 and 4 evidence papers`);
    }

    if (new Set(item.evidencePaperIds).size !== item.evidencePaperIds.length) {
      addError(`${file} ${field}[${index}] has duplicate evidencePaperIds`);
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateRequiredStrings(item, fields, label) {
  if (!isPlainObject(item)) {
    addError(`${label} must be an object`);
    return false;
  }

  for (const field of fields) {
    if (typeof item[field] !== "string" || !item[field].trim()) {
      addError(`${label} must define a non-empty ${field} string`);
    }
  }
  return true;
}

function validateIdeaCenter(config, knownTags, paperById, latestDigestDate, file) {
  validateStringField(config, "title", file);
  validateStringField(config, "summary", file);
  validateStringField(config, "updatedAt", file);

  if (!Number.isInteger(config.version) || config.version < 1) {
    addError(`${file} version must be a positive integer`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.updatedAt || "")) {
    addError(`${file} updatedAt must use YYYY-MM-DD`);
  } else if (latestDigestDate && config.updatedAt < latestDigestDate) {
    addError(`${file} updatedAt ${config.updatedAt} is older than latest digest ${latestDigestDate}`);
  }

  const workflow = isPlainObject(config.workflow) ? config.workflow : {};
  validateRequiredStrings(workflow, ["label", "principle"], `${file} workflow`);
  const searchPolicy = isPlainObject(workflow.searchPolicy) ? workflow.searchPolicy : {};
  validateRequiredStrings(searchPolicy, ["localCorpusRole", "dateWindow"], `${file} workflow.searchPolicy`);
  for (const field of ["sourcePriority", "venueScope", "queryExpansion"]) {
    if (!isStringArray(searchPolicy[field]) || !searchPolicy[field].length) {
      addError(`${file} workflow.searchPolicy.${field} must be a non-empty string array`);
    }
  }

  const workflowSteps = Array.isArray(workflow.steps) ? workflow.steps : [];
  if (workflowSteps.length < 6) {
    addError(`${file} workflow must define at least 6 exploration steps`);
  }
  const workflowStepIds = new Set();
  for (const [index, step] of workflowSteps.entries()) {
    validateRequiredStrings(
      step,
      ["id", "number", "title", "question", "deliverable", "failAction"],
      `${file} workflow.steps[${index}]`
    );
    if (workflowStepIds.has(step?.id)) addError(`${file} has duplicate workflow step id: ${step.id}`);
    workflowStepIds.add(step?.id);
  }

  const workflowGates = Array.isArray(workflow.gates) ? workflow.gates : [];
  if (workflowGates.length !== 4) {
    addError(`${file} workflow must define exactly 4 hard gates`);
  }
  const gateById = new Map();
  for (const [index, gate] of workflowGates.entries()) {
    validateRequiredStrings(gate, ["id", "label", "description"], `${file} workflow.gates[${index}]`);
    if (!Number.isFinite(gate?.threshold) || gate.threshold < 0 || gate.threshold > 100) {
      addError(`${file} workflow.gates[${index}] threshold must be between 0 and 100`);
    }
    if (gateById.has(gate?.id)) addError(`${file} has duplicate workflow gate id: ${gate.id}`);
    gateById.set(gate?.id, gate);
  }

  if (!isStringArray(workflow.stopRules) || workflow.stopRules.length < 3) {
    addError(`${file} workflow.stopRules must contain at least 3 rules`);
  }

  const scoring = isPlainObject(config.scoring) ? config.scoring : {};
  validateRequiredStrings(scoring, ["label", "disclaimer"], `${file} scoring`);
  const dimensions = Array.isArray(scoring.dimensions) ? scoring.dimensions : [];
  if (!dimensions.length) addError(`${file} scoring.dimensions must be a non-empty array`);
  const dimensionById = new Map();
  let totalWeight = 0;
  for (const [index, dimension] of dimensions.entries()) {
    validateRequiredStrings(
      dimension,
      ["id", "label", "description"],
      `${file} scoring.dimensions[${index}]`
    );
    if (!Number.isFinite(dimension?.weight) || dimension.weight <= 0) {
      addError(`${file} scoring.dimensions[${index}] weight must be positive`);
    } else {
      totalWeight += dimension.weight;
    }
    if (dimensionById.has(dimension?.id)) addError(`${file} has duplicate scoring dimension: ${dimension.id}`);
    dimensionById.set(dimension?.id, dimension);
  }
  if (totalWeight !== 100) addError(`${file} scoring dimension weights must total 100, got ${totalWeight}`);

  const directions = Array.isArray(config.directions) ? config.directions : [];
  if (!directions.length) addError(`${file} directions must be a non-empty array`);
  const directionIds = new Set();
  const allIdeaIds = new Set();

  for (const [directionIndex, direction] of directions.entries()) {
    const directionLabel = `${file} directions[${directionIndex}]`;
    validateRequiredStrings(direction, ["id", "label", "color", "status", "subtitle"], directionLabel);
    if (!knownTags.has(direction?.id)) addError(`${directionLabel} references unknown direction: ${direction?.id}`);
    if (directionIds.has(direction?.id)) addError(`${file} has duplicate direction: ${direction?.id}`);
    directionIds.add(direction?.id);
    if (!["ready", "planned"].includes(direction?.status)) {
      addError(`${directionLabel} status must be ready or planned`);
    }
    if (!/^#[0-9a-f]{6}$/i.test(direction?.color || "")) {
      addError(`${directionLabel} color must be a six-digit hex value`);
    }

    if (direction?.status !== "ready") continue;
    validateRequiredStrings(direction, ["scope"], directionLabel);

    const run = isPlainObject(direction.explorationRun) ? direction.explorationRun : {};
    validateRequiredStrings(
      run,
      ["runId", "searchedAt", "searchWindow", "sourcePolicy", "verdict"],
      `${directionLabel}.explorationRun`
    );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(run.searchedAt || "")) {
      addError(`${directionLabel}.explorationRun searchedAt must use YYYY-MM-DD`);
    }
    for (const field of ["venueScope", "queryFamilies"]) {
      if (!isStringArray(run[field]) || !run[field].length) {
        addError(`${directionLabel}.explorationRun.${field} must be a non-empty string array`);
      }
    }
    if (!Number.isInteger(run.coreEvidenceCount) || run.coreEvidenceCount < 1) {
      addError(`${directionLabel}.explorationRun.coreEvidenceCount must be a positive integer`);
    }

    const runGates = Array.isArray(run.gates) ? run.gates : [];
    const runGateIds = new Set();
    for (const [gateIndex, gate] of runGates.entries()) {
      const gateLabel = `${directionLabel}.explorationRun.gates[${gateIndex}]`;
      validateRequiredStrings(gate, ["id", "label", "result", "judgement"], gateLabel);
      if (!gateById.has(gate?.id)) addError(`${gateLabel} references unknown hard gate: ${gate?.id}`);
      if (runGateIds.has(gate?.id)) addError(`${directionLabel} has duplicate run gate: ${gate?.id}`);
      runGateIds.add(gate?.id);
      if (!Number.isFinite(gate?.score) || gate.score < 0 || gate.score > 100) {
        addError(`${gateLabel} score must be between 0 and 100`);
      } else if (gateById.has(gate.id) && gate.score < gateById.get(gate.id).threshold) {
        addError(`${gateLabel} score ${gate.score} does not pass threshold ${gateById.get(gate.id).threshold}`);
      }
    }
    for (const gateId of gateById.keys()) {
      if (!runGateIds.has(gateId)) addError(`${directionLabel} is missing exploration gate: ${gateId}`);
    }

    const saturation = isPlainObject(run.saturation) ? run.saturation : {};
    validateRequiredStrings(saturation, ["verdict"], `${directionLabel}.explorationRun.saturation`);
    const crowdedZones = Array.isArray(saturation.crowdedZones) ? saturation.crowdedZones : [];
    const openZones = Array.isArray(saturation.openZones) ? saturation.openZones : [];
    if (!crowdedZones.length) addError(`${directionLabel} must identify at least one crowded zone`);
    if (!openZones.length) addError(`${directionLabel} must identify at least one open zone`);
    for (const [index, zone] of crowdedZones.entries()) {
      validateRequiredStrings(zone, ["title", "evidence", "decision"], `${directionLabel} crowdedZones[${index}]`);
    }
    for (const [index, zone] of openZones.entries()) {
      validateRequiredStrings(zone, ["title", "whyOpen"], `${directionLabel} openZones[${index}]`);
    }

    const solutionFamilies = Array.isArray(run.solutionFamilies) ? run.solutionFamilies : [];
    if (solutionFamilies.length < 3) addError(`${directionLabel} must explore at least 3 solution families`);
    for (const [index, family] of solutionFamilies.entries()) {
      validateRequiredStrings(
        family,
        ["title", "borrowedFrom", "use"],
        `${directionLabel} solutionFamilies[${index}]`
      );
    }

    const frontierEvidence = Array.isArray(run.frontierEvidence) ? run.frontierEvidence : [];
    if (frontierEvidence.length < 5) addError(`${directionLabel} must cite at least 5 frontier sources`);
    const frontierUrls = new Set();
    for (const [index, source] of frontierEvidence.entries()) {
      const sourceLabel = `${directionLabel} frontierEvidence[${index}]`;
      validateRequiredStrings(source, ["title", "venue", "url", "finding"], sourceLabel);
      if (!Number.isInteger(source?.year)) addError(`${sourceLabel} year must be an integer`);
      if (!/^https:\/\//.test(source?.url || "")) addError(`${sourceLabel} must use an HTTPS primary-source URL`);
      if (frontierUrls.has(source?.url)) addError(`${directionLabel} has duplicate frontier URL: ${source?.url}`);
      frontierUrls.add(source?.url);
    }

    const problemSignals = Array.isArray(direction.problemSignals) ? direction.problemSignals : [];
    if (problemSignals.length < 5) addError(`${directionLabel} must define at least 5 problem signals`);
    for (const [index, signal] of problemSignals.entries()) {
      validateRequiredStrings(signal, ["title", "status", "detail"], `${directionLabel} problemSignals[${index}]`);
    }

    const ideas = Array.isArray(direction.ideas) ? direction.ideas : [];
    if (!ideas.length) addError(`${directionLabel} must define at least one idea`);
    const ranks = new Set();
    const evidenceUrls = new Set();

    for (const [ideaIndex, idea] of ideas.entries()) {
      const ideaLabel = `${directionLabel} ideas[${ideaIndex}]`;
      validateRequiredStrings(
        idea,
        [
          "id", "title", "hook", "decision", "effort", "timeline", "output", "whyNow",
          "unresolved", "hypothesis"
        ],
        ideaLabel
      );
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(idea?.id || "")) {
        addError(`${ideaLabel} id must use lowercase letters, numbers, and hyphens`);
      }
      if (allIdeaIds.has(idea?.id)) addError(`${file} has duplicate idea id: ${idea?.id}`);
      allIdeaIds.add(idea?.id);
      if (!Number.isInteger(idea?.rank) || idea.rank < 1) addError(`${ideaLabel} rank must be a positive integer`);
      if (ranks.has(idea?.rank)) addError(`${directionLabel} has duplicate idea rank: ${idea?.rank}`);
      ranks.add(idea?.rank);
      for (const field of ["method", "minimumStudy", "successCriteria", "killCriteria", "risks"]) {
        if (!isStringArray(idea?.[field]) || !idea[field].length) {
          addError(`${ideaLabel}.${field} must be a non-empty string array`);
        }
      }

      const score = isPlainObject(idea.score) ? idea.score : {};
      validateRequiredStrings(score, ["band"], `${ideaLabel}.score`);
      if (!Number.isInteger(score.overall) || score.overall < 0 || score.overall > 100) {
        addError(`${ideaLabel}.score.overall must be an integer between 0 and 100`);
      }
      const values = isPlainObject(score.dimensions) ? score.dimensions : {};
      let weightedScore = 0;
      for (const [dimensionId, dimension] of dimensionById.entries()) {
        const value = values[dimensionId];
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          addError(`${ideaLabel}.score.dimensions.${dimensionId} must be between 0 and 100`);
        } else {
          weightedScore += value * dimension.weight;
        }
      }
      const computedScore = totalWeight ? Math.round(weightedScore / totalWeight) : 0;
      if (Number.isInteger(score.overall) && score.overall !== computedScore) {
        addError(`${ideaLabel}.score.overall ${score.overall} does not match weighted score ${computedScore}`);
      }

      const evidence = Array.isArray(idea.evidence) ? idea.evidence : [];
      if (evidence.length < 3 || evidence.length > 5) {
        addError(`${ideaLabel} must cite between 3 and 5 evidence sources`);
      }
      const ideaEvidenceUrls = new Set();
      for (const [sourceIndex, source] of evidence.entries()) {
        const sourceLabel = `${ideaLabel}.evidence[${sourceIndex}]`;
        validateRequiredStrings(source, ["title", "venue", "url", "role"], sourceLabel);
        if (!Number.isInteger(source?.year)) addError(`${sourceLabel} year must be an integer`);
        if (!/^https:\/\//.test(source?.url || "")) addError(`${sourceLabel} must use an HTTPS primary-source URL`);
        if (ideaEvidenceUrls.has(source?.url)) addError(`${ideaLabel} has duplicate evidence URL: ${source?.url}`);
        ideaEvidenceUrls.add(source?.url);
        evidenceUrls.add(source?.url);
        if (source?.localPaperId && !paperById.has(source.localPaperId)) {
          addError(`${sourceLabel} references missing local paper: ${source.localPaperId}`);
        }
      }
    }

    for (let rank = 1; rank <= ideas.length; rank += 1) {
      if (!ranks.has(rank)) addError(`${directionLabel} idea ranks must be contiguous; missing ${rank}`);
    }
    if (Number.isInteger(run.coreEvidenceCount) && run.coreEvidenceCount !== evidenceUrls.size) {
      addError(`${directionLabel}.explorationRun.coreEvidenceCount ${run.coreEvidenceCount} does not match ${evidenceUrls.size} unique idea sources`);
    }
  }

  for (const tag of knownTags) {
    if (!directionIds.has(tag)) addError(`${file} is missing direction: ${tag}`);
  }
}

const REVIEW_SECTION_KINDS = [
  "scope",
  "evolution",
  "taxonomy",
  "evidence",
  "challenges",
  "outlook"
];
const REVIEW_PUBLICATION_STATUSES = new Set([
  "peer-reviewed",
  "accepted",
  "workshop",
  "workshop-accepted",
  "preprint",
  "technical-report",
  "standard",
  "dataset"
]);
const REVIEW_PUBLICATION_TYPES = new Set([
  "survey",
  "tutorial",
  "method",
  "benchmark",
  "dataset",
  "standard",
  "position"
]);
const REQUIRED_REVIEW_QUALITY_CHECK_CODES = [
  "query-family-alignment",
  "source-fanout-trace",
  "raw-hit-candidate-separation",
  "local-candidate-closure",
  "canonical-id-casefold",
  "single-count-schema",
  "publication-status-primary-source",
  "formal-arxiv-link-retention",
  "physical-evidence-boundary",
  "independent-review-current-snapshot"
];

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function validateLiteratureReviewWorkflow(workflow, knownTags, file) {
  validateRequiredStrings(workflow, ["name"], file);
  if (!Number.isInteger(workflow.version) || workflow.version < 1) {
    addError(`${file} version must be a positive integer`);
  }

  const upstream = isPlainObject(workflow.upstream) ? workflow.upstream : {};
  validateRequiredStrings(upstream, ["repository", "commit", "syncedAt"], `${file} upstream`);
  if (!isHttpsUrl(upstream.repository)) {
    addError(`${file} upstream.repository must be HTTPS`);
  }
  if (!/^[0-9a-f]{40}$/i.test(upstream.commit || "")) {
    addError(`${file} upstream.commit must be a full Git commit SHA`);
  }
  if (!isValidIsoDate(upstream.syncedAt)) {
    addError(`${file} upstream.syncedAt must be a real YYYY-MM-DD calendar date`);
  }

  const requiredSkills = Array.isArray(workflow.requiredSkills)
    ? workflow.requiredSkills
    : [];
  if (!requiredSkills.length) {
    addError(`${file} requiredSkills must be a non-empty array`);
  }
  const skillNames = new Set();
  for (const [index, skill] of requiredSkills.entries()) {
    const label = `${file} requiredSkills[${index}]`;
    validateRequiredStrings(skill, ["name", "scope"], label);
    if (skillNames.has(skill?.name)) addError(`${file} has duplicate required skill: ${skill?.name}`);
    skillNames.add(skill?.name);
  }

  for (const field of ["requiredReferences", "requiredHelpers", "stages", "sourceFamilies"]) {
    if (!isStringArray(workflow[field])) {
      addError(`${file} ${field} must be a non-empty string array`);
    } else if (new Set(workflow[field]).size !== workflow[field].length) {
      addError(`${file} ${field} must not contain duplicates`);
    }
  }

  const requiredStages = [
    "scope",
    "retrieve",
    "deduplicate",
    "verify",
    "synthesize",
    "independent-review",
    "publish"
  ];
  for (const stage of requiredStages) {
    if (!workflow.stages?.includes(stage)) {
      addError(`${file} stages is missing required stage: ${stage}`);
    }
  }

  const requirements = isPlainObject(workflow.requirements)
    ? workflow.requirements
    : {};
  const positiveIntegerFields = [
    "minQueryFamilies",
    "minSourceFamilies",
    "minReferences",
    "minRecentReferences",
    "recentSinceYear",
    "minFoundationalReferences",
    "foundationalBeforeYear",
    "minFormalReferences",
    "minSurveyOrTutorialReferences",
    "minLocalReferences",
    "minExternalReferences",
    "minExcludedCandidates",
    "minQueryResultSamples",
    "maxReviewAgeDays"
  ];
  for (const field of positiveIntegerFields) {
    if (!Number.isInteger(requirements[field]) || requirements[field] < 1) {
      addError(`${file} requirements.${field} must be a positive integer`);
    }
  }
  if (!isValidIsoDate(requirements.candidateLedgerRequiredFrom)) {
    addError(
      `${file} requirements.candidateLedgerRequiredFrom must be a real YYYY-MM-DD calendar date`
    );
  }
  if (
    Number.isInteger(requirements.minSourceFamilies)
    && Array.isArray(workflow.sourceFamilies)
    && requirements.minSourceFamilies > workflow.sourceFamilies.length
  ) {
    addError(`${file} requirements.minSourceFamilies exceeds sourceFamilies.length`);
  }
  if (
    Number.isInteger(requirements.foundationalBeforeYear)
    && Number.isInteger(requirements.recentSinceYear)
    && requirements.foundationalBeforeYear > requirements.recentSinceYear
  ) {
    addError(`${file} foundationalBeforeYear cannot exceed recentSinceYear`);
  }

  const qualityChecks = Array.isArray(workflow.qualityChecks)
    ? workflow.qualityChecks
    : [];
  if (!qualityChecks.length) {
    addError(`${file} qualityChecks must be a non-empty array`);
  }
  const qualityCheckCodes = new Set();
  for (const [index, qualityCheck] of qualityChecks.entries()) {
    const label = `${file} qualityChecks[${index}]`;
    validateRequiredStrings(qualityCheck, ["code", "instruction"], label);
    if (typeof qualityCheck?.automated !== "boolean") {
      addError(`${label}.automated must be a boolean`);
    }
    if (qualityCheckCodes.has(qualityCheck?.code)) {
      addError(`${file} has duplicate quality check: ${qualityCheck?.code}`);
    }
    qualityCheckCodes.add(qualityCheck?.code);
  }
  for (const code of REQUIRED_REVIEW_QUALITY_CHECK_CODES) {
    if (!qualityCheckCodes.has(code)) {
      addError(`${file} qualityChecks is missing required check: ${code}`);
    }
  }

  const directions = isPlainObject(workflow.directions) ? workflow.directions : {};
  for (const tag of knownTags) {
    const direction = directions[tag];
    const label = `${file} directions.${tag}`;
    validateRequiredStrings(direction, ["profile"], label);
    if (!isStringArray(direction?.queryFamilies)) {
      addError(`${label}.queryFamilies must be a non-empty string array`);
    } else {
      if (
        Number.isInteger(requirements.minQueryFamilies)
        && direction.queryFamilies.length < requirements.minQueryFamilies
      ) {
        addError(`${label}.queryFamilies must contain at least ${requirements.minQueryFamilies} entries`);
      }
      if (new Set(direction.queryFamilies).size !== direction.queryFamilies.length) {
        addError(`${label}.queryFamilies must not contain duplicates`);
      }
    }
  }
  for (const directionId of Object.keys(directions)) {
    if (!knownTags.has(directionId)) {
      addError(`${file} has workflow for unknown direction: ${directionId}`);
    }
  }
}

function validateReviewCenter(
  center,
  reviewDocs,
  knownTags,
  paperById,
  centerFile,
  workflow
) {
  validateStringField(center, "title", centerFile);
  validateStringField(center, "summary", centerFile);
  validateStringField(center, "updatedAt", centerFile);

  if (!Number.isInteger(center.version) || center.version < 1) {
    addError(`${centerFile} version must be a positive integer`);
  }
  if (!isValidIsoDate(center.updatedAt)) {
    addError(`${centerFile} updatedAt must be a real YYYY-MM-DD calendar date`);
  }
  if (center.workflowVersion !== workflow.version) {
    addError(`${centerFile} workflowVersion must match literature-review-workflow.json`);
  }

  const writingModel = isPlainObject(center.writingModel) ? center.writingModel : {};
  validateRequiredStrings(writingModel, ["note"], `${centerFile} writingModel`);
  if (!isStringArray(writingModel.principles) || writingModel.principles.length < 4) {
    addError(`${centerFile} writingModel.principles must contain at least 4 strings`);
  }
  const sample = isPlainObject(writingModel.sampleSurvey) ? writingModel.sampleSurvey : {};
  validateRequiredStrings(
    sample,
    ["title", "authors", "venue", "url"],
    `${centerFile} writingModel.sampleSurvey`
  );
  if (!Number.isInteger(sample.year)) {
    addError(`${centerFile} writingModel.sampleSurvey.year must be an integer`);
  }
  if (!isHttpsUrl(sample.url)) {
    addError(`${centerFile} writingModel.sampleSurvey.url must be an HTTPS primary-source URL`);
  }
  const citation = isPlainObject(sample.citationSnapshot) ? sample.citationSnapshot : {};
  validateRequiredStrings(
    citation,
    ["provider", "checkedAt", "url", "note"],
    `${centerFile} writingModel.sampleSurvey.citationSnapshot`
  );
  if (!Number.isInteger(citation.count) || citation.count < 0) {
    addError(`${centerFile} writingModel.sampleSurvey.citationSnapshot.count must be a non-negative integer`);
  }
  if (!isValidIsoDate(citation.checkedAt)) {
    addError(`${centerFile} writingModel.sampleSurvey.citationSnapshot.checkedAt must be a real YYYY-MM-DD calendar date`);
  }
  if (!isHttpsUrl(citation.url)) {
    addError(`${centerFile} writingModel.sampleSurvey.citationSnapshot.url must be HTTPS`);
  }

  const reviewIds = new Set();
  const requirements = isPlainObject(workflow.requirements)
    ? workflow.requirements
    : {};
  const allowedSourceFamilies = new Set(
    Array.isArray(workflow.sourceFamilies) ? workflow.sourceFamilies : []
  );
  const today = isoDateInTimeZone();
  const currentYear = Number(today.slice(0, 4));
  const localTitles = new Set(
    [...paperById.values()]
      .filter((paper) => !paper.revisionOf)
      .map((paper) => paper.normalizedTitle)
      .filter(Boolean)
  );
  const localArxivIds = new Set(
    [...paperById.values()]
      .filter((paper) => !paper.revisionOf)
      .flatMap((paper) => extractArxivIds(paper.data.source))
  );
  const localDois = new Set(
    [...paperById.values()]
      .filter((paper) => !paper.revisionOf)
      .flatMap((paper) => extractDois(paper.data.source))
  );

  for (const doc of reviewDocs) {
    const review = doc.data;
    const file = `reviews/${doc.file}`;
    const expectedId = path.basename(doc.file, ".json");
    const label = file;

    validateRequiredStrings(
      review,
      ["id", "title", "subtitle", "abstract", "reviewedAt", "searchWindow"],
      label
    );
    if (!Number.isInteger(review.version) || review.version < 1) {
      addError(`${label} version must be a positive integer`);
    }
    if (review.id !== expectedId) {
      addError(`${label} has id "${review.id}", expected "${expectedId}"`);
    }
    if (!knownTags.has(review.id)) {
      addError(`${label} references unknown direction: ${review.id}`);
    }
    if (reviewIds.has(review.id)) {
      addError(`${centerFile} has duplicate review direction: ${review.id}`);
    }
    reviewIds.add(review.id);
    if (!isValidIsoDate(review.reviewedAt)) {
      addError(`${label} reviewedAt must be a real YYYY-MM-DD calendar date`);
    }
    if (review.reviewedAt > today) {
      addError(`${label} reviewedAt cannot be in the future`);
    }
    const reviewAgeDays = Math.floor(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${review.reviewedAt}T00:00:00Z`))
      / 86400000
    );
    if (
      Number.isInteger(requirements.maxReviewAgeDays)
      && reviewAgeDays > requirements.maxReviewAgeDays
    ) {
      addError(`${label} is stale by workflow policy (${reviewAgeDays} days)`);
    }
    if (!isStringArray(review.researchQuestions) || review.researchQuestions.length < 2) {
      addError(`${label} researchQuestions must contain at least 2 strings`);
    }
    if (!isStringArray(review.takeaways) || review.takeaways.length < 3) {
      addError(`${label} takeaways must contain at least 3 strings`);
    }

    const references = Array.isArray(review.references) ? review.references : [];
    if (references.length < requirements.minReferences) {
      addError(`${label} must define at least ${requirements.minReferences} references`);
    }
    const referenceById = new Map();
    const canonicalIds = new Set();
    const referenceAliasCanonicalIds = new Set();
    const referencePrimaryIdByAlias = new Map();
    const referenceTitles = new Set();
    const referenceUrls = new Set();
    const referenceSourceFamilies = new Set();
    const referenceSourceCounts = new Map();
    const registerReferenceAlias = (aliasId, primaryId) => {
      const normalizedAliasId = normalizeCanonicalId(aliasId);
      if (!registerCanonicalAlias(
        referencePrimaryIdByAlias,
        normalizedAliasId,
        primaryId
      )) {
        addError(
          `${label} references reuse canonical alias across different papers: ${normalizedAliasId}`
        );
      }
      referenceAliasCanonicalIds.add(normalizedAliasId);
    };
    let localCount = 0;
    let externalCount = 0;
    let surveyCount = 0;
    let recentCount = 0;
    let foundationalCount = 0;
    let formalCount = 0;

    for (const [index, reference] of references.entries()) {
      const referenceLabel = `${label} references[${index}]`;
      validateRequiredStrings(
        reference,
        [
          "id",
          "title",
          "authors",
          "venue",
          "publicationType",
          "publicationStatus",
          "canonicalId",
          "sourceFamily",
          "supports",
          "limitation",
          "url"
        ],
        referenceLabel
      );
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reference?.id || "")) {
        addError(`${referenceLabel} id must use lowercase letters, numbers, and hyphens`);
      }
      if (referenceById.has(reference?.id)) {
        addError(`${label} has duplicate reference id: ${reference?.id}`);
      } else {
        referenceById.set(reference?.id, reference);
      }
      if (!Number.isInteger(reference?.year) || reference.year < 1900 || reference.year > currentYear) {
        addError(`${referenceLabel} year must be between 1900 and the current year`);
      }
      if (!REVIEW_PUBLICATION_TYPES.has(reference?.publicationType)) {
        addError(`${referenceLabel} has unsupported publicationType: ${reference?.publicationType}`);
      }
      if (!REVIEW_PUBLICATION_STATUSES.has(reference?.publicationStatus)) {
        addError(`${referenceLabel} has unsupported publicationStatus: ${reference?.publicationStatus}`);
      }
      if (!/^[a-z0-9-]+:[^\s]+$/i.test(reference?.canonicalId || "")) {
        addError(`${referenceLabel} canonicalId must use a namespaced identifier`);
      }
      if (reference?.publicationStatus === "peer-reviewed" && reference?.venue === "arXiv") {
        addError(`${referenceLabel} cannot mark an arXiv-only record as peer-reviewed`);
      }
      if (
        (reference?.publicationType === "standard")
        !== (reference?.publicationStatus === "standard")
      ) {
        addError(`${referenceLabel} standard type and status must be used together`);
      }
      if (!allowedSourceFamilies.has(reference?.sourceFamily)) {
        addError(`${referenceLabel} has unsupported sourceFamily: ${reference?.sourceFamily}`);
      } else {
        referenceSourceFamilies.add(reference.sourceFamily);
        referenceSourceCounts.set(
          reference.sourceFamily,
          (referenceSourceCounts.get(reference.sourceFamily) || 0) + 1
        );
      }
      if (!isHttpsUrl(reference?.url)) {
        addError(`${referenceLabel} must use an HTTPS primary-source URL`);
      }
      if (reference?.links !== undefined) {
        if (!Array.isArray(reference.links) || reference.links.length === 0) {
          addError(`${referenceLabel}.links must be a non-empty array when present`);
        } else {
          const linkUrls = new Set(
            isHttpsUrl(reference?.url)
              ? [sourceLinkIdentity(reference.url)]
              : []
          );
          for (const [linkIndex, link] of reference.links.entries()) {
            const linkLabel = `${referenceLabel}.links[${linkIndex}]`;
            validateRequiredStrings(link, ["label", "url"], linkLabel);
            if (!isHttpsUrl(link?.url)) {
              addError(`${linkLabel}.url must be an HTTPS primary-source URL`);
              continue;
            }
            if (link?.label !== sourceLinkLabel(link.url)) {
              addError(`${linkLabel}.label must match its destination`);
            }
            const linkIdentity = sourceLinkIdentity(link.url);
            if (linkUrls.has(linkIdentity)) {
              addError(`${referenceLabel}.links has a duplicate URL: ${link?.url}`);
            }
            linkUrls.add(linkIdentity);
          }
        }
      }
      if (!formalPrimaryLinkIsCanonical(reference)) {
        addError(
          `${referenceLabel} must use the formal publication destination as url when both formal and arXiv links are recorded`
        );
      }
      const normalizedCanonicalId = normalizeCanonicalId(reference?.canonicalId);
      if (canonicalIds.has(normalizedCanonicalId)) {
        addError(`${label} has duplicate canonicalId: ${reference?.canonicalId}`);
      }
      canonicalIds.add(normalizedCanonicalId);
      registerReferenceAlias(normalizedCanonicalId, normalizedCanonicalId);
      const referenceSourceUrls = [
        reference?.url,
        ...(Array.isArray(reference?.links)
          ? reference.links.map((link) => link?.url)
          : [])
      ];
      for (const arxivId of extractArxivIds(...referenceSourceUrls)) {
        const aliasId = normalizeCanonicalId(`arxiv:${arxivId}`);
        registerReferenceAlias(aliasId, normalizedCanonicalId);
      }
      for (const doi of extractDois(...referenceSourceUrls)) {
        const aliasId = normalizeCanonicalId(`doi:${doi}`);
        registerReferenceAlias(aliasId, normalizedCanonicalId);
      }

      const normalizedReferenceTitle = normalizeTitle(reference?.title);
      if (referenceTitles.has(normalizedReferenceTitle)) {
        addError(`${label} has duplicate reference title: ${reference?.title}`);
      }
      referenceTitles.add(normalizedReferenceTitle);
      const referenceUrlIdentity = isHttpsUrl(reference?.url)
        ? sourceLinkIdentity(reference.url)
        : reference?.url;
      if (referenceUrls.has(referenceUrlIdentity)) {
        addError(`${label} has duplicate reference URL: ${reference?.url}`);
      }
      referenceUrls.add(referenceUrlIdentity);

      if (["survey", "tutorial"].includes(reference?.publicationType)) {
        surveyCount += 1;
      }
      if (reference?.year >= requirements.recentSinceYear) {
        recentCount += 1;
      }
      if (reference?.year < requirements.foundationalBeforeYear) {
        foundationalCount += 1;
      }
      if (["peer-reviewed", "standard"].includes(reference?.publicationStatus)) {
        formalCount += 1;
      }

      if (reference?.localPaperId) {
        localCount += 1;
        if (reference.sourceFamily !== "local-corpus") {
          addError(`${referenceLabel} local references must use sourceFamily local-corpus`);
        }
        const paper = paperById.get(reference.localPaperId);
        if (!paper) {
          addError(`${referenceLabel} references missing local paper: ${reference.localPaperId}`);
        } else {
          if (paper.revisionOf) {
            addError(`${referenceLabel} must reference a canonical local paper: ${reference.localPaperId}`);
          }
          if (paper.data.title !== reference.title) {
            addError(`${referenceLabel} title must exactly match local paper ${reference.localPaperId}`);
          }
          if (!paper.tags.includes(review.id)) {
            addError(`${referenceLabel} local paper ${reference.localPaperId} is not tagged ${review.id}`);
          }
          if (["peer-reviewed", "workshop"].includes(reference.publicationStatus)) {
            const paperSourceLinks = buildPaperSourceLinks(paper.data.source);
            const referenceSourceIdentities = new Set([
              reference.url,
              ...(reference.links || []).map((link) => link.url)
            ].map(sourceLinkIdentity));
            const sourceArxivIds = extractArxivIds(paper.data.source);
            const referenceArxivIds = new Set(extractArxivIds(
              reference.canonicalId,
              reference.url,
              ...(reference.links || []).map((link) => link.url)
            ));
            for (const arxivId of sourceArxivIds) {
              if (!referenceArxivIds.has(arxivId)) {
                addError(
                  `${referenceLabel} must retain arXiv ${arxivId} alongside the formal URL`
                );
              }
            }
            for (const sourceLink of paperSourceLinks) {
              if (
                sourceLink.label === "正式版"
                && !referenceSourceIdentities.has(sourceLinkIdentity(sourceLink.url))
              ) {
                addError(
                  `${referenceLabel} must retain formal URL ${sourceLink.url} from the local paper source`
                );
              }
            }
          }
        }
      } else {
        externalCount += 1;
        if (reference?.sourceFamily === "local-corpus") {
          addError(`${referenceLabel} external references cannot use sourceFamily local-corpus`);
        }
        if (localTitles.has(normalizedReferenceTitle)) {
          addError(`${referenceLabel} is already reported locally and must define localPaperId`);
        }
        const referenceLinkUrls = (reference?.links || []).map((link) => link.url);
        const arxivIds = extractArxivIds(
          reference?.url,
          reference?.title,
          ...referenceLinkUrls
        );
        for (const arxivId of arxivIds) {
          if (localArxivIds.has(arxivId)) {
            addError(`${referenceLabel} arXiv ${arxivId} is already reported locally and must define localPaperId`);
          }
        }
        const dois = extractDois(reference?.url, ...referenceLinkUrls);
        for (const doi of dois) {
          if (localDois.has(doi)) {
            addError(`${referenceLabel} DOI ${doi} is already reported locally and must define localPaperId`);
          }
        }
      }
    }
    if (localCount < requirements.minLocalReferences) {
      addError(`${label} must cite at least ${requirements.minLocalReferences} local papers`);
    }
    if (externalCount < requirements.minExternalReferences) {
      addError(`${label} must cite at least ${requirements.minExternalReferences} external papers`);
    }
    if (surveyCount < requirements.minSurveyOrTutorialReferences) {
      addError(`${label} must cite at least ${requirements.minSurveyOrTutorialReferences} surveys or tutorials`);
    }
    if (recentCount < requirements.minRecentReferences) {
      addError(`${label} must cite at least ${requirements.minRecentReferences} references from ${requirements.recentSinceYear} onward`);
    }
    if (foundationalCount < requirements.minFoundationalReferences) {
      addError(`${label} must cite at least ${requirements.minFoundationalReferences} references before ${requirements.foundationalBeforeYear}`);
    }
    if (formalCount < requirements.minFormalReferences) {
      addError(`${label} must cite at least ${requirements.minFormalReferences} peer-reviewed or standard references`);
    }

    const searchAudit = isPlainObject(review.searchAudit) ? review.searchAudit : {};
    const searchAuditLabel = `${label} searchAudit`;
    validateRequiredStrings(
      searchAudit,
      ["searchedAt", "cutoffDate", "evidenceBoundary"],
      searchAuditLabel
    );
    if (searchAudit.workflowVersion !== workflow.version) {
      addError(`${searchAuditLabel}.workflowVersion must match literature-review-workflow.json`);
    }
    for (const legacyCountField of legacySearchAuditCountFields(searchAudit)) {
      addError(
        `${searchAuditLabel}.${legacyCountField} is obsolete; use searchAudit.counts only`
      );
    }
    const requiredQualityChecks = (workflow.qualityChecks || []).map(
      (check) => check.code
    );
    if (!isStringArray(searchAudit.qualityChecksApplied)) {
      addError(`${searchAuditLabel}.qualityChecksApplied must be a non-empty string array`);
    } else {
      const appliedChecks = new Set(searchAudit.qualityChecksApplied);
      if (appliedChecks.size !== searchAudit.qualityChecksApplied.length) {
        addError(`${searchAuditLabel}.qualityChecksApplied must not contain duplicates`);
      }
      for (const check of requiredQualityChecks) {
        if (!appliedChecks.has(check)) {
          addError(`${searchAuditLabel}.qualityChecksApplied is missing: ${check}`);
        }
      }
    }
    if (!isValidIsoDate(searchAudit.searchedAt) || searchAudit.searchedAt > today) {
      addError(`${searchAuditLabel}.searchedAt must be a non-future real calendar date`);
    }
    if (!isValidIsoDate(searchAudit.cutoffDate) || searchAudit.cutoffDate > today) {
      addError(`${searchAuditLabel}.cutoffDate must be a non-future real calendar date`);
    }
    if (
      isValidIsoDate(searchAudit.cutoffDate)
      && isValidIsoDate(searchAudit.searchedAt)
      && searchAudit.cutoffDate > searchAudit.searchedAt
    ) {
      addError(`${searchAuditLabel}.cutoffDate cannot be later than searchedAt`);
    }
    if (searchAudit.searchedAt !== review.reviewedAt) {
      addError(`${searchAuditLabel}.searchedAt must equal reviewedAt`);
    }

    const directionWorkflow = workflow.directions?.[review.id];
    const requiredSkills = (workflow.requiredSkills || [])
      .filter((skill) => skill.scope === "all" || skill.scope === directionWorkflow?.profile)
      .map((skill) => skill.name);
    if (!isStringArray(searchAudit.skills)) {
      addError(`${searchAuditLabel}.skills must be a non-empty string array`);
    } else {
      for (const skill of requiredSkills) {
        if (!searchAudit.skills.includes(skill)) {
          addError(`${searchAuditLabel}.skills is missing required skill: ${skill}`);
        }
      }
    }

    if (!isStringArray(searchAudit.queryFamilies)) {
      addError(`${searchAuditLabel}.queryFamilies must be a non-empty string array`);
    } else {
      const uniqueQueryFamilies = new Set(searchAudit.queryFamilies);
      if (uniqueQueryFamilies.size !== searchAudit.queryFamilies.length) {
        addError(`${searchAuditLabel}.queryFamilies must not contain duplicates`);
      }
      if (uniqueQueryFamilies.size < requirements.minQueryFamilies) {
        addError(`${searchAuditLabel}.queryFamilies must contain at least ${requirements.minQueryFamilies} entries`);
      }
      for (const queryFamily of directionWorkflow?.queryFamilies || []) {
        if (!searchAudit.queryFamilies.includes(queryFamily)) {
          addError(`${searchAuditLabel}.queryFamilies is missing configured family: ${queryFamily}`);
        }
      }
    }

    const auditedSourceFamilies = new Set(
      Array.isArray(searchAudit.sourceFamilies) ? searchAudit.sourceFamilies : []
    );
    if (!isStringArray(searchAudit.sourceFamilies)) {
      addError(`${searchAuditLabel}.sourceFamilies must be a non-empty string array`);
    } else {
      if (auditedSourceFamilies.size !== searchAudit.sourceFamilies.length) {
        addError(`${searchAuditLabel}.sourceFamilies must not contain duplicates`);
      }
      if (auditedSourceFamilies.size < requirements.minSourceFamilies) {
        addError(`${searchAuditLabel}.sourceFamilies must contain at least ${requirements.minSourceFamilies} entries`);
      }
      for (const sourceFamily of searchAudit.sourceFamilies) {
        if (!allowedSourceFamilies.has(sourceFamily)) {
          addError(`${searchAuditLabel} has unsupported source family: ${sourceFamily}`);
        }
      }
      for (const sourceFamily of referenceSourceFamilies) {
        if (!auditedSourceFamilies.has(sourceFamily)) {
          addError(`${searchAuditLabel}.sourceFamilies is missing included reference family: ${sourceFamily}`);
        }
      }
    }

    const configuredQueryFamilies = directionWorkflow?.queryFamilies || [];
    const queryRuns = Array.isArray(searchAudit.queryRuns) ? searchAudit.queryRuns : [];
    if (queryRuns.length !== configuredQueryFamilies.length) {
      addError(
        `${searchAuditLabel}.queryRuns must contain exactly one run for each configured query family`
      );
    }
    const queryRunFamilies = new Set();
    const queryRunSourceFamilies = new Set();
    const sampledCanonicalIds = new Set();
    const deferredLocalPaperIds = new Set();
    const deferredLocalCanonicalIds = new Set();
    let queryResultCount = 0;
    for (const [index, queryRun] of queryRuns.entries()) {
      const queryRunLabel = `${searchAuditLabel}.queryRuns[${index}]`;
      validateRequiredStrings(
        queryRun,
        ["family", "sourceFamily", "query", "scopeRationale", "executedAt"],
        queryRunLabel
      );
      const retrieval = isPlainObject(queryRun?.retrieval)
        ? queryRun.retrieval
        : {};
      validateRequiredStrings(
        retrieval,
        ["provider", "endpoint", "sort"],
        `${queryRunLabel}.retrieval`
      );
      if (!isPlainObject(retrieval.parameters)) {
        addError(`${queryRunLabel}.retrieval.parameters must be an object`);
      } else if (retrieval.parameters.query !== queryRun?.query) {
        addError(`${queryRunLabel}.retrieval.parameters.query must match query`);
      } else if (queryRun?.sourceFamily === "local-corpus") {
        if (retrieval.provider !== "ripgrep-local-corpus") {
          addError(`${queryRunLabel}.retrieval.provider must identify ripgrep for local corpus runs`);
        }
        if (
          retrieval.parameters.path !== "content/papers"
          || !localCorpusRipgrepFlagsMatch(retrieval.parameters.flags)
        ) {
          addError(
            `${queryRunLabel}.retrieval.parameters must record path content/papers and exact rg -l -i flags`
          );
        }
        if (!Number.isInteger(queryRun.rawHitCount) || queryRun.rawHitCount < 0) {
          addError(`${queryRunLabel}.rawHitCount must be a non-negative integer`);
        }
        if (!Number.isInteger(queryRun.screenedOutCount) || queryRun.screenedOutCount < 0) {
          addError(`${queryRunLabel}.screenedOutCount must be a non-negative integer`);
        }
        if (typeof queryRun.screeningNote !== "string" || !queryRun.screeningNote.trim()) {
          addError(`${queryRunLabel}.screeningNote must explain local hit screening`);
        }

        let localSnapshot;
        try {
          localSnapshot = localCorpusSearchSnapshot(
            [...paperById.values()],
            review.id,
            queryRun.query,
            { corpusPath: path.join(CONTENT, "papers") }
          );
        } catch (error) {
          addError(`${queryRunLabel}.query is not a valid regular expression: ${error.message}`);
        }

        const disposition = isPlainObject(queryRun.localCandidateDisposition)
          ? queryRun.localCandidateDisposition
          : {};
        const candidateLocalPaperIds = Array.isArray(disposition.candidateLocalPaperIds)
          ? disposition.candidateLocalPaperIds
          : [];
        if (!isStringArray(disposition.candidateLocalPaperIds)) {
          addError(
            `${queryRunLabel}.localCandidateDisposition.candidateLocalPaperIds must be a non-empty string array`
          );
        }
        const candidateLocalPaperIdSet = new Set(candidateLocalPaperIds);
        if (candidateLocalPaperIdSet.size !== candidateLocalPaperIds.length) {
          addError(
            `${queryRunLabel}.localCandidateDisposition.candidateLocalPaperIds must not contain duplicates`
          );
        }
        if (
          JSON.stringify(candidateLocalPaperIds)
          !== JSON.stringify([...candidateLocalPaperIds].sort())
        ) {
          addError(
            `${queryRunLabel}.localCandidateDisposition.candidateLocalPaperIds must be sorted`
          );
        }

        if (localSnapshot) {
          const expectedCandidateIds = localSnapshot.candidateLocalPaperIds;
          if (queryRun.rawHitCount !== localSnapshot.rawHitPaperIds.length) {
            addError(`${queryRunLabel}.rawHitCount does not match the reproducible local search`);
          }
          if (
            candidateLocalPaperIds.length !== expectedCandidateIds.length
            || expectedCandidateIds.some((id) => !candidateLocalPaperIdSet.has(id))
          ) {
            addError(
              `${queryRunLabel}.localCandidateDisposition.candidateLocalPaperIds must exactly match tagged canonical local hits`
            );
          }
          if (queryRun.resultCount !== expectedCandidateIds.length) {
            addError(`${queryRunLabel}.resultCount must equal tagged canonical local hits`);
          }
          if (
            queryRun.screenedOutCount
            !== localSnapshot.rawHitPaperIds.length - expectedCandidateIds.length
          ) {
            addError(
              `${queryRunLabel}.screenedOutCount must equal raw files minus tagged canonical local hits`
            );
          }
          const localCandidateCanonicalIds = new Set(
            expectedCandidateIds.flatMap((id) =>
              localPaperCanonicalIds(paperById.get(id))
            )
          );
          for (const canonicalId of queryRun.resultIdSample || []) {
            if (!localCandidateCanonicalIds.has(normalizeCanonicalId(canonicalId))) {
              addError(
                `${queryRunLabel}.resultIdSample must come from the reproducible local candidate set: ${canonicalId}`
              );
            }
          }
        }

        const deferredGroups = Array.isArray(disposition.deferredGroups)
          ? disposition.deferredGroups
          : [];
        if (!Array.isArray(disposition.deferredGroups)) {
          addError(
            `${queryRunLabel}.localCandidateDisposition.deferredGroups must be an array`
          );
        }
        const deferredInRun = new Set();
        for (const [groupIndex, group] of deferredGroups.entries()) {
          const groupLabel = `${queryRunLabel}.localCandidateDisposition.deferredGroups[${groupIndex}]`;
          validateRequiredStrings(group, ["reasonCode", "reason"], groupLabel);
          if (!["direct-scope-deferred", "cross-direction-support"].includes(group?.reasonCode)) {
            addError(`${groupLabel}.reasonCode is unsupported: ${group?.reasonCode}`);
          }
          if (!isStringArray(group?.localPaperIds)) {
            addError(`${groupLabel}.localPaperIds must be a non-empty string array`);
            continue;
          }
          if (new Set(group.localPaperIds).size !== group.localPaperIds.length) {
            addError(`${groupLabel}.localPaperIds must not contain duplicates`);
          }
          if (
            JSON.stringify(group.localPaperIds)
            !== JSON.stringify([...group.localPaperIds].sort())
          ) {
            addError(`${groupLabel}.localPaperIds must be sorted`);
          }
          for (const localPaperId of group.localPaperIds) {
            if (deferredInRun.has(localPaperId)) {
              addError(`${queryRunLabel} defers local paper more than once: ${localPaperId}`);
            }
            deferredInRun.add(localPaperId);
            deferredLocalPaperIds.add(localPaperId);
            const paper = paperById.get(localPaperId);
            if (!paper) {
              addError(`${groupLabel} references missing local paper: ${localPaperId}`);
              continue;
            }
            if (paper.revisionOf) {
              addError(`${groupLabel} must reference a canonical local paper: ${localPaperId}`);
            }
            if (!paper.tags.includes(review.id)) {
              addError(`${groupLabel} local paper is not tagged ${review.id}: ${localPaperId}`);
            }
            if (!candidateLocalPaperIdSet.has(localPaperId)) {
              addError(`${groupLabel} references a paper outside the local candidate set: ${localPaperId}`);
            }
            const isDirect = paper.data.tag === review.id;
            if (group.reasonCode === "direct-scope-deferred" && !isDirect) {
              addError(`${groupLabel} direct-scope paper has another primary direction: ${localPaperId}`);
            }
            if (group.reasonCode === "cross-direction-support" && isDirect) {
              addError(`${groupLabel} cross-direction paper has this review as its primary direction: ${localPaperId}`);
            }
            for (const canonicalId of localPaperCanonicalIds(paper)) {
              deferredLocalCanonicalIds.add(canonicalId);
            }
          }
        }

        const includedCandidateIds = new Set(
          references
            .map((reference) => reference.localPaperId)
            .filter((localPaperId) => candidateLocalPaperIdSet.has(localPaperId))
        );
        const disposedCandidateIds = new Set([
          ...includedCandidateIds,
          ...deferredInRun
        ]);
        if (
          disposedCandidateIds.size !== candidateLocalPaperIdSet.size
          || [...candidateLocalPaperIdSet].some((id) => !disposedCandidateIds.has(id))
        ) {
          addError(
            `${queryRunLabel}.localCandidateDisposition must place every candidate in references or one deferred group`
          );
        }
      }
      if (!Number.isInteger(retrieval.limit) || retrieval.limit < 1) {
        addError(`${queryRunLabel}.retrieval.limit must be a positive integer`);
      }
      if (!configuredQueryFamilies.includes(queryRun?.family)) {
        addError(`${queryRunLabel}.family is not configured for ${review.id}`);
      }
      if (queryRunFamilies.has(queryRun?.family)) {
        addError(`${searchAuditLabel}.queryRuns has duplicate family: ${queryRun?.family}`);
      }
      queryRunFamilies.add(queryRun?.family);
      if (!allowedSourceFamilies.has(queryRun?.sourceFamily)) {
        addError(`${queryRunLabel}.sourceFamily is unsupported: ${queryRun?.sourceFamily}`);
      } else if (!auditedSourceFamilies.has(queryRun.sourceFamily)) {
        addError(`${queryRunLabel}.sourceFamily is missing from searchAudit.sourceFamilies`);
      } else {
        queryRunSourceFamilies.add(queryRun.sourceFamily);
      }
      if (
        !isValidIsoDate(queryRun?.executedAt)
        || queryRun.executedAt < searchAudit.cutoffDate
        || queryRun.executedAt > searchAudit.searchedAt
      ) {
        addError(
          `${queryRunLabel}.executedAt must be a real date between cutoffDate and searchedAt`
        );
      }
      if (!Number.isInteger(queryRun?.resultCount) || queryRun.resultCount < 0) {
        addError(`${queryRunLabel}.resultCount must be a non-negative integer`);
      } else {
        queryResultCount += queryRun.resultCount;
        if (
          Number.isInteger(retrieval.limit)
          && queryRun.resultCount > retrieval.limit
        ) {
          addError(`${queryRunLabel}.resultCount cannot exceed retrieval.limit`);
        }
      }
      if (queryRun?.sourceFamily === "local-corpus") {
        if (
          Number.isInteger(queryRun.rawHitCount)
          && Number.isInteger(retrieval.limit)
          && queryRun.rawHitCount > retrieval.limit
        ) {
          addError(`${queryRunLabel}.rawHitCount cannot exceed retrieval.limit`);
        }
        if (
          Number.isInteger(queryRun.rawHitCount)
          && Number.isInteger(queryRun.screenedOutCount)
          && Number.isInteger(queryRun.resultCount)
          && queryRun.rawHitCount !== queryRun.resultCount + queryRun.screenedOutCount
        ) {
          addError(
            `${queryRunLabel}.rawHitCount must equal resultCount plus screenedOutCount`
          );
        }
      }
      if (!isStringArray(queryRun?.resultIdSample)) {
        addError(`${queryRunLabel}.resultIdSample must be a non-empty string array`);
        continue;
      }
      if (queryRun.resultIdSample.length < requirements.minQueryResultSamples) {
        addError(
          `${queryRunLabel}.resultIdSample must contain at least ${requirements.minQueryResultSamples} IDs`
        );
      }
      if (queryRun.resultCount < queryRun.resultIdSample.length) {
        addError(`${queryRunLabel}.resultCount cannot be smaller than resultIdSample.length`);
      }
      const uniqueSampleIds = new Set(
        queryRun.resultIdSample.map(normalizeCanonicalId)
      );
      if (uniqueSampleIds.size !== queryRun.resultIdSample.length) {
        addError(`${queryRunLabel}.resultIdSample must not contain duplicates`);
      }
      for (const canonicalId of queryRun.resultIdSample) {
        if (!/^[a-z0-9-]+:[^\s]+$/i.test(canonicalId)) {
          addError(`${queryRunLabel}.resultIdSample has invalid canonical ID: ${canonicalId}`);
        }
        const normalizedSampleId = normalizeCanonicalId(canonicalId);
        sampledCanonicalIds.add(normalizedSampleId);
      }
    }
    for (const queryFamily of configuredQueryFamilies) {
      if (!queryRunFamilies.has(queryFamily)) {
        addError(`${searchAuditLabel}.queryRuns is missing configured family: ${queryFamily}`);
      }
    }
    for (const sourceFamily of unusedAuditedSourceFamilies(
      auditedSourceFamilies,
      queryRunSourceFamilies,
      referenceSourceFamilies
    )) {
      addError(
        `${searchAuditLabel}.sourceFamilies declares unused family: ${sourceFamily}`
      );
    }

    const sourceAttempts = Array.isArray(searchAudit.sourceAttempts)
      ? searchAudit.sourceAttempts
      : [];
    const sourceAttemptFamilies = new Set();
    if (sourceAttempts.length !== allowedSourceFamilies.size) {
      addError(
        `${searchAuditLabel}.sourceAttempts must contain exactly one attempt for every configured source family`
      );
    }
    for (const [index, attempt] of sourceAttempts.entries()) {
      const attemptLabel = `${searchAuditLabel}.sourceAttempts[${index}]`;
      validateRequiredStrings(
        attempt,
        ["sourceFamily", "status", "executedAt", "query", "endpoint", "note"],
        attemptLabel
      );
      if (!allowedSourceFamilies.has(attempt?.sourceFamily)) {
        addError(`${attemptLabel}.sourceFamily is unsupported: ${attempt?.sourceFamily}`);
      }
      if (sourceAttemptFamilies.has(attempt?.sourceFamily)) {
        addError(`${searchAuditLabel}.sourceAttempts has duplicate sourceFamily: ${attempt?.sourceFamily}`);
      }
      sourceAttemptFamilies.add(attempt?.sourceFamily);
      if (!["success", "limited"].includes(attempt?.status)) {
        addError(`${attemptLabel}.status must be success or limited`);
      }
      if (
        !isValidIsoDate(attempt?.executedAt)
        || attempt.executedAt < searchAudit.cutoffDate
        || attempt.executedAt > searchAudit.searchedAt
      ) {
        addError(
          `${attemptLabel}.executedAt must be a real date between cutoffDate and searchedAt`
        );
      }
      if (!Number.isInteger(attempt?.limit) || attempt.limit < 1) {
        addError(`${attemptLabel}.limit must be a positive integer`);
      }
      if (!Number.isInteger(attempt?.acceptedCount) || attempt.acceptedCount < 0) {
        addError(`${attemptLabel}.acceptedCount must be a non-negative integer`);
      } else if (
        allowedSourceFamilies.has(attempt?.sourceFamily)
        && attempt.acceptedCount !== (referenceSourceCounts.get(attempt.sourceFamily) || 0)
      ) {
        addError(
          `${attemptLabel}.acceptedCount must match included references for its sourceFamily`
        );
      }
      if (attempt?.status === "limited" && attempt?.acceptedCount !== 0) {
        addError(`${attemptLabel}.acceptedCount must be 0 when status is limited`);
      }
    }
    for (const sourceFamily of missingSourceAttemptFamilies(
      allowedSourceFamilies,
      sourceAttempts
    )) {
      addError(`${searchAuditLabel}.sourceAttempts is missing: ${sourceFamily}`);
    }

    const expectedDeduplicationKeys = ["doi", "arxiv", "venue-id", "normalized-title"];
    if (!isStringArray(searchAudit.deduplicationKeys)) {
      addError(`${searchAuditLabel}.deduplicationKeys must be a non-empty string array`);
    } else {
      const actualKeys = new Set(searchAudit.deduplicationKeys);
      if (
        actualKeys.size !== expectedDeduplicationKeys.length
        || expectedDeduplicationKeys.some((key) => !actualKeys.has(key))
      ) {
        addError(
          `${searchAuditLabel}.deduplicationKeys must contain doi, arxiv, venue-id, and normalized-title`
        );
      }
    }

    const retainedCanonicalIds = Array.isArray(searchAudit.retainedCanonicalIds)
      ? searchAudit.retainedCanonicalIds
      : [];
    if (!isStringArray(searchAudit.retainedCanonicalIds)) {
      addError(`${searchAuditLabel}.retainedCanonicalIds must be a non-empty string array`);
    }
    const retainedIdSet = new Set(
      retainedCanonicalIds.map(normalizeCanonicalId)
    );
    if (retainedIdSet.size !== retainedCanonicalIds.length) {
      addError(`${searchAuditLabel}.retainedCanonicalIds must not contain duplicates`);
    }
    if (
      retainedIdSet.size !== canonicalIds.size
      || [...canonicalIds].some((canonicalId) => !retainedIdSet.has(canonicalId))
    ) {
      addError(`${searchAuditLabel}.retainedCanonicalIds must exactly match references`);
    }

    if (
      !isStringArray(searchAudit.exclusionCriteria)
      || searchAudit.exclusionCriteria.length < 3
    ) {
      addError(`${searchAuditLabel}.exclusionCriteria must contain at least 3 rules`);
    }

    const excludedCandidates = Array.isArray(searchAudit.excludedCandidates)
      ? searchAudit.excludedCandidates
      : [];
    if (excludedCandidates.length < requirements.minExcludedCandidates) {
      addError(
        `${searchAuditLabel}.excludedCandidates must contain at least ${requirements.minExcludedCandidates} records`
      );
    }
    const excludedIdSet = new Set();
    const excludedAliasIdSet = new Set();
    const excludedPrimaryIdByAlias = new Map();
    const excludedTitles = new Set();
    const excludedUrls = new Set();
    for (const [index, candidate] of excludedCandidates.entries()) {
      const candidateLabel = `${searchAuditLabel}.excludedCandidates[${index}]`;
      validateRequiredStrings(
        candidate,
        ["canonicalId", "title", "url", "reasonCode", "reason"],
        candidateLabel
      );
      if (!/^[a-z0-9-]+:[^\s]+$/i.test(candidate?.canonicalId || "")) {
        addError(`${candidateLabel}.canonicalId must use a namespaced identifier`);
      }
      if (!isHttpsUrl(candidate?.url)) {
        addError(`${candidateLabel}.url must be an HTTPS primary-source URL`);
      }
      const normalizedCandidateId = normalizeCanonicalId(candidate?.canonicalId);
      if (excludedIdSet.has(normalizedCandidateId)) {
        addError(`${searchAuditLabel}.excludedCandidates has duplicate canonicalId: ${candidate?.canonicalId}`);
      }
      excludedIdSet.add(normalizedCandidateId);
      const candidateAliasIds = new Set([
        normalizedCandidateId,
        ...extractArxivIds(candidate?.url).map(
          (arxivId) => normalizeCanonicalId(`arxiv:${arxivId}`)
        ),
        ...extractDois(candidate?.url).map(
          (doi) => normalizeCanonicalId(`doi:${doi}`)
        )
      ]);
      for (const aliasId of candidateAliasIds) {
        if (!registerCanonicalAlias(
          excludedPrimaryIdByAlias,
          aliasId,
          normalizedCandidateId
        )) {
          addError(`${candidateLabel} reuses an alias from another excluded paper: ${aliasId}`);
        }
        excludedAliasIdSet.add(aliasId);
        if (referenceAliasCanonicalIds.has(aliasId)) {
          addError(`${candidateLabel} alias is also retained: ${aliasId}`);
        }
      }
      const normalizedExcludedTitle = normalizeTitle(candidate?.title);
      if (excludedTitles.has(normalizedExcludedTitle)) {
        addError(`${searchAuditLabel}.excludedCandidates has duplicate title: ${candidate?.title}`);
      }
      excludedTitles.add(normalizedExcludedTitle);
      if (referenceTitles.has(normalizedExcludedTitle)) {
        addError(`${candidateLabel}.title is also retained`);
      }
      const excludedUrlIdentity = isHttpsUrl(candidate?.url)
        ? sourceLinkIdentity(candidate.url)
        : candidate?.url;
      if (excludedUrls.has(excludedUrlIdentity)) {
        addError(`${searchAuditLabel}.excludedCandidates has duplicate URL: ${candidate?.url}`);
      }
      excludedUrls.add(excludedUrlIdentity);
    }

    for (const canonicalId of deferredLocalCanonicalIds) {
      if (
        referenceAliasCanonicalIds.has(canonicalId)
        || excludedAliasIdSet.has(canonicalId)
      ) {
        addError(
          `${searchAuditLabel} local deferred candidate is also retained or externally excluded: ${canonicalId}`
        );
      }
    }

    const auditedCandidateIds = new Set([
      ...referenceAliasCanonicalIds,
      ...excludedAliasIdSet,
      ...deferredLocalCanonicalIds
    ]);
    for (const canonicalId of sampledCanonicalIds) {
      if (!auditedCandidateIds.has(canonicalId)) {
        addError(
          `${searchAuditLabel}.queryRuns samples unaudited candidate ID: ${canonicalId}`
        );
      }
    }

    if (!isStringArray(searchAudit.openSearchGaps)) {
      addError(`${searchAuditLabel}.openSearchGaps must be a non-empty string array`);
    }
    if (
      searchAudit.sourceLimitations !== undefined
      && !isStringArray(searchAudit.sourceLimitations)
    ) {
      addError(`${searchAuditLabel}.sourceLimitations must be a non-empty string array when present`);
    }

    const ledgerRequired = isValidIsoDate(requirements.candidateLedgerRequiredFrom)
      && isValidIsoDate(searchAudit.searchedAt)
      && searchAudit.searchedAt >= requirements.candidateLedgerRequiredFrom;
    const candidateLedger = Array.isArray(searchAudit.candidateLedger)
      ? searchAudit.candidateLedger
      : [];
    let candidateLedgerOccurrenceCount = 0;
    if (
      (ledgerRequired || searchAudit.candidateLedger !== undefined)
      && (!Array.isArray(searchAudit.candidateLedger) || candidateLedger.length === 0)
    ) {
      addError(
        `${searchAuditLabel}.candidateLedger must be a non-empty array for searches on or after ${requirements.candidateLedgerRequiredFrom}`
      );
    }
    if (candidateLedger.length > 0) {
      const ledgerIds = new Set();
      const ledgerEntryByCanonicalId = new Map();
      const ledgerFamilyCounts = new Map();
      const ledgerPrimaryIdByAlias = new Map(referencePrimaryIdByAlias);
      const includedLedgerIds = new Set();
      const excludedLedgerIds = new Set();
      const deferredLedgerPaperIds = new Set();
      for (const [aliasId, primaryId] of excludedPrimaryIdByAlias) {
        if (!registerCanonicalAlias(
          ledgerPrimaryIdByAlias,
          aliasId,
          primaryId
        )) {
          addError(
            `${searchAuditLabel}.candidateLedger cannot merge retained and excluded alias: ${aliasId}`
          );
        }
      }
      for (const [index, entry] of candidateLedger.entries()) {
        const entryLabel = `${searchAuditLabel}.candidateLedger[${index}]`;
        validateRequiredStrings(
          entry,
          ["canonicalId", "disposition"],
          entryLabel
        );
        const normalizedLedgerId = normalizeCanonicalId(entry?.canonicalId);
        if (!/^[a-z0-9-]+:[^\s]+$/i.test(entry?.canonicalId || "")) {
          addError(`${entryLabel}.canonicalId must use a namespaced identifier`);
        }
        if (ledgerIds.has(normalizedLedgerId)) {
          addError(`${searchAuditLabel}.candidateLedger has duplicate canonicalId: ${entry?.canonicalId}`);
        }
        ledgerIds.add(normalizedLedgerId);
        ledgerEntryByCanonicalId.set(normalizedLedgerId, entry);
        if (!Number.isInteger(entry?.occurrences) || entry.occurrences < 1) {
          addError(`${entryLabel}.occurrences must be a positive integer`);
        } else {
          candidateLedgerOccurrenceCount += entry.occurrences;
        }
        if (!isStringArray(entry?.queryFamilies)) {
          addError(`${entryLabel}.queryFamilies must be a non-empty string array`);
        } else {
          const uniqueLedgerFamilies = new Set(entry.queryFamilies);
          if (uniqueLedgerFamilies.size !== entry.queryFamilies.length) {
            addError(`${entryLabel}.queryFamilies must not contain duplicates`);
          }
          if (
            Number.isInteger(entry?.occurrences)
            && entry.occurrences !== entry.queryFamilies.length
          ) {
            addError(`${entryLabel}.occurrences must equal queryFamilies.length`);
          }
          for (const family of entry.queryFamilies) {
            if (!configuredQueryFamilies.includes(family)) {
              addError(`${entryLabel}.queryFamilies contains an unconfigured family: ${family}`);
            }
            ledgerFamilyCounts.set(
              family,
              (ledgerFamilyCounts.get(family) || 0) + 1
            );
          }
        }
        if (!auditedCandidateIds.has(normalizedLedgerId)) {
          addError(`${entryLabel}.canonicalId is not retained, excluded, or deferred`);
        }

        if (entry?.disposition === "included") {
          includedLedgerIds.add(normalizedLedgerId);
          if (entry.localPaperId !== undefined) {
            addError(`${entryLabel}.localPaperId is only allowed for deferred candidates`);
          }
        } else if (entry?.disposition === "excluded") {
          excludedLedgerIds.add(normalizedLedgerId);
          if (entry.localPaperId !== undefined) {
            addError(`${entryLabel}.localPaperId is only allowed for deferred candidates`);
          }
        } else if (entry?.disposition === "deferred") {
          if (typeof entry.localPaperId !== "string" || !entry.localPaperId.trim()) {
            addError(`${entryLabel}.localPaperId is required for deferred candidates`);
          } else {
            deferredLedgerPaperIds.add(entry.localPaperId);
            const paper = paperById.get(entry.localPaperId);
            if (
              !paper
              || !localPaperCanonicalIds(paper).includes(normalizedLedgerId)
            ) {
              addError(`${entryLabel}.canonicalId must identify its deferred local paper`);
            } else {
              for (const aliasId of localPaperCanonicalIds(paper)) {
                ledgerPrimaryIdByAlias.set(aliasId, normalizedLedgerId);
              }
            }
          }
        } else {
          addError(`${entryLabel}.disposition must be included, excluded, or deferred`);
        }
      }

      if (
        includedLedgerIds.size !== retainedIdSet.size
        || [...retainedIdSet].some((id) => !includedLedgerIds.has(id))
      ) {
        addError(`${searchAuditLabel}.candidateLedger included entries must exactly match retainedCanonicalIds`);
      }
      if (
        excludedLedgerIds.size !== excludedIdSet.size
        || [...excludedIdSet].some((id) => !excludedLedgerIds.has(id))
      ) {
        addError(`${searchAuditLabel}.candidateLedger excluded entries must exactly match excludedCandidates`);
      }
      if (
        deferredLedgerPaperIds.size !== deferredLocalPaperIds.size
        || [...deferredLocalPaperIds].some((id) => !deferredLedgerPaperIds.has(id))
      ) {
        addError(`${searchAuditLabel}.candidateLedger deferred entries must exactly match deferred local papers`);
      }
      const sampledFamiliesByPrimaryId = new Map();
      for (const queryRun of queryRuns) {
        for (const sampleId of queryRun.resultIdSample || []) {
          const normalizedSampleId = normalizeCanonicalId(sampleId);
          const primaryId = ledgerPrimaryIdByAlias.get(normalizedSampleId);
          const ledgerEntry = primaryId
            ? ledgerEntryByCanonicalId.get(primaryId)
            : undefined;
          if (!ledgerEntry) {
            addError(
              `${searchAuditLabel}.candidateLedger cannot resolve query sample alias: ${sampleId}`
            );
            continue;
          }
          if (!ledgerEntry.queryFamilies?.includes(queryRun.family)) {
            addError(
              `${searchAuditLabel}.candidateLedger ${ledgerEntry.canonicalId} is missing sampled family: ${queryRun.family}`
            );
          }
          const sampledFamilies = sampledFamiliesByPrimaryId.get(primaryId)
            || new Set();
          sampledFamilies.add(queryRun.family);
          sampledFamiliesByPrimaryId.set(primaryId, sampledFamilies);
        }
      }
      for (const [canonicalId, entry] of ledgerEntryByCanonicalId) {
        if (
          entry.occurrences > 1
          && (sampledFamiliesByPrimaryId.get(canonicalId)?.size || 0) < 2
        ) {
          addError(
            `${searchAuditLabel}.candidateLedger ${entry.canonicalId} duplicate occurrences must be demonstrated in at least two query samples`
          );
        }
      }
      for (const queryRun of queryRuns) {
        if ((ledgerFamilyCounts.get(queryRun.family) || 0) !== queryRun.resultCount) {
          addError(
            `${searchAuditLabel}.candidateLedger entries for ${queryRun.family} must equal its resultCount`
          );
        }
      }
    }

    const counts = isPlainObject(searchAudit.counts) ? searchAudit.counts : {};
    for (const field of ["candidates", "deduplicated", "included", "excluded"]) {
      if (!Number.isInteger(counts[field]) || counts[field] < 0) {
        addError(`${searchAuditLabel}.counts.${field} must be a non-negative integer`);
      }
    }
    if (counts.candidates < counts.deduplicated) {
      addError(`${searchAuditLabel}.counts.candidates cannot be smaller than deduplicated`);
    }
    if (counts.candidates !== queryResultCount) {
      addError(`${searchAuditLabel}.counts.candidates must equal the sum of queryRuns.resultCount`);
    }
    if (counts.deduplicated < counts.included) {
      addError(`${searchAuditLabel}.counts.deduplicated cannot be smaller than included`);
    }
    if (
      counts.deduplicated
      !== retainedIdSet.size + excludedIdSet.size + deferredLocalPaperIds.size
    ) {
      addError(
        `${searchAuditLabel}.counts.deduplicated must equal retained, externally excluded, and deferred local candidates`
      );
    }
    if (counts.included !== references.length) {
      addError(`${searchAuditLabel}.counts.included must equal references.length`);
    }
    if (counts.excluded !== excludedCandidates.length + deferredLocalPaperIds.size) {
      addError(
        `${searchAuditLabel}.counts.excluded must equal external exclusions plus deferred local candidates`
      );
    }
    if (counts.excluded !== counts.deduplicated - counts.included) {
      addError(`${searchAuditLabel}.counts.excluded must equal deduplicated minus included`);
    }
    if (candidateLedger.length > 0) {
      if (counts.deduplicated !== candidateLedger.length) {
        addError(`${searchAuditLabel}.counts.deduplicated must equal candidateLedger.length`);
      }
      if (counts.candidates !== candidateLedgerOccurrenceCount) {
        addError(`${searchAuditLabel}.counts.candidates must equal candidateLedger occurrences`);
      }
    }

    const independentReview = isPlainObject(searchAudit.independentReview)
      ? searchAudit.independentReview
      : {};
    validateRequiredStrings(
      independentReview,
      ["completedAt", "status"],
      `${searchAuditLabel}.independentReview`
    );
    if (!isValidIsoDate(independentReview.completedAt) || independentReview.completedAt > today) {
      addError(`${searchAuditLabel}.independentReview.completedAt must be a non-future real calendar date`);
    }
    if (
      isValidIsoDate(independentReview.completedAt)
      && isValidIsoDate(searchAudit.searchedAt)
      && independentReview.completedAt < searchAudit.searchedAt
    ) {
      addError(`${searchAuditLabel}.independentReview.completedAt cannot be earlier than searchedAt`);
    }
    if (independentReview.status !== "passed") {
      addError(`${searchAuditLabel}.independentReview.status must be passed`);
    } else {
      if (!/^[0-9a-f]{64}$/.test(independentReview.snapshotFingerprint || "")) {
        addError(
          `${searchAuditLabel}.independentReview.snapshotFingerprint must be a SHA-256 digest`
        );
      } else if (independentReview.snapshotFingerprint !== reviewSnapshotFingerprint(review)) {
        addError(
          `${searchAuditLabel}.independentReview.snapshotFingerprint does not match the current review`
        );
      }
    }
    if (!Number.isInteger(independentReview.reviewers) || independentReview.reviewers < 1) {
      addError(`${searchAuditLabel}.independentReview.reviewers must be a positive integer`);
    }
    if (!Number.isInteger(independentReview.rounds) || independentReview.rounds < 1) {
      addError(`${searchAuditLabel}.independentReview.rounds must be a positive integer`);
    }

    const sections = Array.isArray(review.sections) ? review.sections : [];
    if (sections.length !== REVIEW_SECTION_KINDS.length) {
      addError(`${label} must define exactly ${REVIEW_SECTION_KINDS.length} review sections`);
    }
    const sectionIds = new Set();
    const sectionKinds = new Set();
    const usedReferenceIds = new Set();
    for (const [index, section] of sections.entries()) {
      const sectionLabel = `${label} sections[${index}]`;
      validateRequiredStrings(
        section,
        ["id", "kind", "title", "thesis", "body"],
        sectionLabel
      );
      if (sectionIds.has(section?.id)) addError(`${label} has duplicate section id: ${section?.id}`);
      sectionIds.add(section?.id);
      if (!REVIEW_SECTION_KINDS.includes(section?.kind)) {
        addError(`${sectionLabel} has unsupported kind: ${section?.kind}`);
      }
      if (sectionKinds.has(section?.kind)) {
        addError(`${label} has duplicate section kind: ${section?.kind}`);
      }
      sectionKinds.add(section?.kind);
      if (!isStringArray(section?.referenceIds) || !section.referenceIds.length) {
        addError(`${sectionLabel}.referenceIds must be a non-empty string array`);
        continue;
      }
      if (new Set(section.referenceIds).size !== section.referenceIds.length) {
        addError(`${sectionLabel} has duplicate referenceIds`);
      }
      for (const referenceId of section.referenceIds) {
        if (!referenceById.has(referenceId)) {
          addError(`${sectionLabel} references missing reference: ${referenceId}`);
        }
        usedReferenceIds.add(referenceId);
      }
    }
    for (const kind of REVIEW_SECTION_KINDS) {
      if (!sectionKinds.has(kind)) addError(`${label} is missing section kind: ${kind}`);
    }
    for (const referenceId of referenceById.keys()) {
      if (!usedReferenceIds.has(referenceId)) {
        addError(`${label} reference ${referenceId} is not cited by any section`);
      }
    }
  }

  for (const tag of knownTags) {
    if (!reviewIds.has(tag)) addError(`${centerFile} is missing review for direction: ${tag}`);
  }
  for (const reviewId of reviewIds) {
    if (!knownTags.has(reviewId)) addError(`${centerFile} has extra review direction: ${reviewId}`);
  }
}

const interestConfig = JSON.parse(await readFile(path.join(CONFIG, "research-interests.json"), "utf8"));
const interests = Array.isArray(interestConfig.interests) ? interestConfig.interests : [];
if (!interests.length) {
  addError("research-interests.json must define a non-empty interests array");
}
const knownTags = new Set();
for (const [index, interest] of interests.entries()) {
  const label = `research-interests.json interests[${index}]`;
  validateRequiredStrings(interest, ["id", "label", "color", "description"], label);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(interest?.id || "")) {
    addError(`${label} id must use lowercase letters, numbers, and hyphens`);
  }
  if (knownTags.has(interest?.id)) {
    addError(`research-interests.json has duplicate interest id: ${interest?.id}`);
  }
  knownTags.add(interest?.id);
}
const landscapeFile = "research-landscape.json";
let landscapeConfig = {};
const ideaCenterFile = "idea-center.json";
let ideaCenterConfig = {};
const reviewCenterFile = "review-center.json";
let reviewCenterConfig = {};
let literatureReviewWorkflow = {};
const reviewDocs = await readJsonDir(path.join(CONTENT, "reviews"));

try {
  landscapeConfig = JSON.parse(await readFile(path.join(CONTENT, landscapeFile), "utf8"));
} catch (error) {
  addError(`${landscapeFile} has invalid JSON: ${error.message}`);
}

try {
  ideaCenterConfig = JSON.parse(await readFile(path.join(CONTENT, ideaCenterFile), "utf8"));
} catch (error) {
  addError(`${ideaCenterFile} has invalid JSON: ${error.message}`);
}

try {
  reviewCenterConfig = JSON.parse(await readFile(path.join(CONTENT, reviewCenterFile), "utf8"));
} catch (error) {
  addError(`${reviewCenterFile} has invalid JSON: ${error.message}`);
}

try {
  literatureReviewWorkflow = JSON.parse(
    await readFile(path.join(CONFIG, "literature-review-workflow.json"), "utf8")
  );
} catch (error) {
  addError(`literature-review-workflow.json has invalid JSON: ${error.message}`);
}

validateStringField(landscapeConfig, "title", landscapeFile);
validateStringField(landscapeConfig, "summary", landscapeFile);
validateStringField(landscapeConfig, "updatedAt", landscapeFile);

if (!Number.isInteger(landscapeConfig.version) || landscapeConfig.version < 1) {
  addError(`${landscapeFile} version must be a positive integer`);
}

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
validateLandscapeEvidenceArrays(landscapeTrends, "trends", landscapeFile);
validateLandscapeEvidenceArrays(landscapeHotspots, "hotspots", landscapeFile);
validateLandscapeEvidenceArrays(landscapeOpportunities, "opportunities", landscapeFile);
validateLandscapeEvidenceArrays(landscapeDirections, "directions", landscapeFile);

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

const latestDigestDate = digestDocs
  .map((digest) => digest.data.date)
  .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date || ""))
  .sort()
  .at(-1);

if (latestDigestDate && landscapeConfig.updatedAt < latestDigestDate) {
  addError(`${landscapeFile} updatedAt ${landscapeConfig.updatedAt} is older than latest digest ${latestDigestDate}`);
}

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

validateIdeaCenter(ideaCenterConfig, knownTags, paperById, latestDigestDate, ideaCenterFile);
validateLiteratureReviewWorkflow(
  literatureReviewWorkflow,
  knownTags,
  "literature-review-workflow.json"
);
validateReviewCenter(
  reviewCenterConfig,
  reviewDocs,
  knownTags,
  paperById,
  reviewCenterFile,
  literatureReviewWorkflow
);

const canonicalPaperIds = new Set(papers.filter((paper) => !paper.revisionOf).map((paper) => paper.id));
const effectiveEvidenceDigests = digestDocs
  .map((digest) => ({
    id: digest.data.id,
    date: digest.data.date,
    paperIds: Array.isArray(digest.data.papers)
      ? digest.data.papers.filter((paperId) => canonicalPaperIds.has(paperId))
      : []
  }))
  .filter((digest) => digest.paperIds.length)
  .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
const recentEvidencePaperIds = new Set(
  effectiveEvidenceDigests
    .slice(0, landscapeConfig.analysisWindowIssues || 1)
    .flatMap((digest) => digest.paperIds)
);

for (const [field, items] of [
  ["trends", landscapeTrends],
  ["hotspots", landscapeHotspots],
  ["opportunities", landscapeOpportunities],
  ["directions", landscapeDirections]
]) {
  for (const [index, item] of items.entries()) {
    const evidenceIds = Array.isArray(item.evidencePaperIds) ? item.evidencePaperIds : [];
    const itemTags = field === "directions"
      ? [item.tag].filter(Boolean)
      : (Array.isArray(item.tags) ? item.tags : []);

    for (const paperId of evidenceIds) {
      const paper = paperById.get(paperId);
      if (!paper) {
        addError(`${landscapeFile} ${field}[${index}] references missing evidence paper: ${paperId}`);
      } else if (paper.revisionOf) {
        addError(`${landscapeFile} ${field}[${index}] evidence must reference canonical paper: ${paperId}`);
      } else if (!paper.tags.some((tag) => itemTags.includes(tag))) {
        addError(`${landscapeFile} ${field}[${index}] evidence paper ${paperId} does not match its direction tags`);
      }
    }

    if (evidenceIds.length && !evidenceIds.some((paperId) => recentEvidencePaperIds.has(paperId))) {
      addError(`${landscapeFile} ${field}[${index}] must cite at least one paper from the latest analysis window`);
    }
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

console.log(
  `Content validation passed: ${digestDocs.length} digests, ${paperDocs.length} papers, ${reviewDocs.length} direction reviews.`
);
