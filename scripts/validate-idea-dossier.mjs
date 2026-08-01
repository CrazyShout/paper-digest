import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { resolveIdeaAuditArtifact } from "./idea-artifact-path.mjs";

const ROOT = process.cwd();
const AUDIT_ROOT = path.join(ROOT, "content", "idea-audits");
const WORKFLOW_PATH = path.join(ROOT, "config", "idea-exploration-workflow.json");

function assertValid(condition, message) {
  if (!condition) throw new Error(message);
}

function substantiveString(value, minimum = 24) {
  return typeof value === "string" && value.trim().length >= minimum;
}

function substantiveListEntry(value) {
  if (substantiveString(value, 8)) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return Object.values(value).filter((field) => substantiveString(field, 8)).length >= 2;
}

function assertStringList(dossier, field, minimum, label) {
  const values = dossier[field];
  assertValid(
    Array.isArray(values)
      && values.length >= minimum
      && values.every(substantiveListEntry),
    `${label}: ${field} must contain at least ${minimum} substantive entries.`
  );
}

export function validateIdeaDossier(dossier, workflow, label = "Idea dossier") {
  const id = dossier.candidateId || dossier.id;
  assertValid(/^[a-z0-9][a-z0-9-]*$/.test(id || ""), `${label}: invalid candidateId.`);
  const frozenAt = Date.parse(dossier.frozenAt);
  assertValid(Number.isFinite(frozenAt), `${label}/${id}: frozenAt must be a valid timestamp.`);
  assertValid(frozenAt <= Date.now() + 60_000, `${label}/${id}: frozenAt cannot be future-dated.`);

  for (const field of [
    "title",
    "hook",
    "output",
    "effort",
    "timeline",
    "whyNow",
    "keyProblem",
    "currentLimitations",
    "hypothesis",
    "impact"
  ]) {
    const minimum = ["output", "effort", "timeline"].includes(field) ? 2 : 16;
    assertValid(
      substantiveString(dossier[field], minimum),
      `${label}/${id}: ${field} must be a substantive string.`
    );
  }

  const listRequirements = {
    noveltyClaims: 2,
    method: 2,
    implementationPath: 3,
    minimumStudy: 3,
    strongBaselines: 3,
    metrics: 3,
    successCriteria: 2,
    killCriteria: 2,
    risks: 2
  };
  for (const [field, minimum] of Object.entries(listRequirements)) {
    assertStringList(dossier, field, minimum, `${label}/${id}`);
  }

  const evidence = dossier.evidence;
  const requirements = workflow.requirements;
  assertValid(
    Array.isArray(evidence)
      && evidence.length >= requirements.minEvidencePerIdea
      && evidence.length <= requirements.maxEvidencePerIdea,
    `${label}/${id}: evidence must contain ${requirements.minEvidencePerIdea}-`
      + `${requirements.maxEvidencePerIdea} sources.`
  );
  assertValid(
    new Set(evidence.map((source) => source.url)).size === evidence.length,
    `${label}/${id}: evidence URLs must be unique.`
  );
  for (const source of evidence) {
    assertValid(substantiveString(source.title, 4), `${label}/${id}: evidence title is required.`);
    assertValid(/^https:\/\//.test(source.url || ""), `${label}/${id}: evidence must use HTTPS.`);
    assertValid(substantiveString(source.role, 12), `${label}/${id}: evidence role is required.`);
    const isLocal = Boolean(source.localPaperId);
    const isExternal = source.sourceOrigin === "external";
    assertValid(
      isLocal !== isExternal,
      `${label}/${id}: evidence must declare exactly one provenance marker.`
    );
    if (isLocal) {
      assertValid(
        /^papers\/[^/]+\/$/.test(source.localLink || ""),
        `${label}/${id}: local evidence must include a canonical paper-report link.`
      );
    }
  }

  assertValid(!dossier.blindReview, `${label}/${id}: pre-review dossier cannot contain blindReview.`);
  assertValid(!dossier.scores, `${label}/${id}: pre-review dossier cannot contain scores.`);
  return {
    candidateId: id,
    evidence: evidence.length,
    methodSteps: dossier.method.length,
    studySteps: dossier.minimumStudy.length
  };
}

async function main() {
  const inputPaths = process.argv.slice(2);
  assertValid(
    inputPaths.length > 0,
    "Usage: node scripts/validate-idea-dossier.mjs <dossier.json> [...]"
  );
  const workflow = JSON.parse(await readFile(WORKFLOW_PATH, "utf8"));

  for (const inputPath of inputPaths) {
    const absolutePath = await resolveIdeaAuditArtifact(ROOT, inputPath, inputPath);
    const dossier = JSON.parse(await readFile(absolutePath, "utf8"));
    const result = validateIdeaDossier(dossier, workflow, inputPath);
    console.log(
      `OK ${inputPath}: ${result.candidateId}, ${result.evidence} evidence sources, `
        + `${result.methodSteps} method steps, ${result.studySteps} study steps.`
    );
  }
}

const isDirect = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
