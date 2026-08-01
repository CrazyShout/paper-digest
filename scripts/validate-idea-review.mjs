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

function reopenedUrl(entry) {
  return typeof entry === "string" ? entry : entry?.url;
}

export function validateIdeaReview(review, workflow, label = "Idea review") {
  const dimensions = workflow.evaluation.dimensions.map((dimension) => dimension.id);
  const lenses = new Set(workflow.evaluation.reviewerLenses.map((lens) => lens.id));
  const scale = workflow.evaluation.scale;

  assertValid(
    /^[a-z0-9][a-z0-9-]*$/.test(review.candidateId || ""),
    `${label}: invalid candidateId.`
  );
  assertValid(lenses.has(review.lens), `${label}: unknown reviewer lens ${review.lens}.`);
  assertValid(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      review.reviewerAgentId || ""
    ),
    `${label}: reviewerAgentId must be the runtime agent UUID.`
  );
  assertValid(
    typeof review.reviewedAt === "string" && Number.isFinite(Date.parse(review.reviewedAt)),
    `${label}: reviewedAt must be an ISO-compatible timestamp.`
  );
  assertValid(
    Date.parse(review.reviewedAt) <= Date.now() + 60_000,
    `${label}: reviewedAt cannot be future-dated.`
  );
  assertValid(
    /^[0-9a-f]{64}$/.test(review.dossierSnapshotFingerprint || ""),
    `${label}: dossierSnapshotFingerprint must be a SHA-256 digest.`
  );

  for (const field of ["scores", "rationales"]) {
    assertValid(
      review[field] && typeof review[field] === "object" && !Array.isArray(review[field]),
      `${label}: ${field} must be an object.`
    );
    assertValid(
      JSON.stringify(Object.keys(review[field]).sort()) === JSON.stringify([...dimensions].sort()),
      `${label}: ${field} must contain exactly the five configured dimensions.`
    );
  }

  for (const dimension of dimensions) {
    const score = review.scores[dimension];
    assertValid(
      Number.isInteger(score) && score >= scale.min && score <= scale.max,
      `${label}: ${dimension} score must be an integer from ${scale.min} to ${scale.max}.`
    );
    assertValid(
      substantiveString(review.rationales[dimension], 32),
      `${label}: ${dimension} rationale must be substantive.`
    );
  }
  assertValid(
    Number.isInteger(review.overall) && review.overall >= scale.min && review.overall <= scale.max,
    `${label}: overall must be an integer from ${scale.min} to ${scale.max}.`
  );
  assertValid(
    substantiveString(review.strongestObjection, 32),
    `${label}: strongestObjection must be substantive.`
  );
  assertValid(
    substantiveString(review.requiredExperiment, 32),
    `${label}: requiredExperiment must be substantive.`
  );

  const evidence = review.evidenceReopened;
  assertValid(
    Array.isArray(evidence) && evidence.length >= 2 && evidence.length <= 8,
    `${label}: evidenceReopened must contain 2-8 primary-source entries.`
  );
  const urls = evidence.map(reopenedUrl);
  assertValid(
    urls.every((url) => /^https:\/\//.test(url || "")),
    `${label}: every reopened evidence entry must include an HTTPS URL.`
  );
  assertValid(new Set(urls).size === urls.length, `${label}: reopened evidence URLs must be unique.`);
  for (const entry of evidence) {
    if (typeof entry === "object" && entry !== null) {
      assertValid(
        substantiveString(entry.finding || entry.checked || entry.reopenedFinding, 16),
        `${label}: structured reopened evidence must include a substantive finding.`
      );
    }
  }

  for (const forbidden of ["decision", "verdict", "accepted", "threshold", "passScore"]) {
    assertValid(!(forbidden in review), `${label}: blind review cannot contain ${forbidden}.`);
  }

  return {
    candidateId: review.candidateId,
    lens: review.lens,
    overall: review.overall,
    evidence: evidence.length
  };
}

async function main() {
  const inputPaths = process.argv.slice(2);
  assertValid(
    inputPaths.length > 0,
    "Usage: node scripts/validate-idea-review.mjs <review.json> [...]"
  );
  const workflow = JSON.parse(await readFile(WORKFLOW_PATH, "utf8"));

  for (const inputPath of inputPaths) {
    const absolutePath = await resolveIdeaAuditArtifact(ROOT, inputPath, inputPath);
    const review = JSON.parse(await readFile(absolutePath, "utf8"));
    const result = validateIdeaReview(review, workflow, inputPath);
    console.log(
      `OK ${inputPath}: ${result.candidateId}, ${result.lens}, `
        + `overall ${result.overall}, ${result.evidence} reopened sources.`
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
