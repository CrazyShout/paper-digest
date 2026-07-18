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

const interestConfig = JSON.parse(await readFile(path.join(CONFIG, "research-interests.json"), "utf8"));
const knownTags = new Set(interestConfig.interests.map((interest) => interest.id));
const landscapeFile = "research-landscape.json";
let landscapeConfig = {};
const ideaCenterFile = "idea-center.json";
let ideaCenterConfig = {};

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

console.log(`Content validation passed: ${digestDocs.length} digests, ${paperDocs.length} papers.`);
