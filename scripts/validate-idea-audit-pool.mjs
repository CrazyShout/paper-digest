import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const AUDIT_ROOT = path.join(ROOT, "content", "idea-audits");
const WORKFLOW_PATH = path.join(ROOT, "config", "idea-exploration-workflow.json");
const RUNTIME_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertValid(condition, message) {
  if (!condition) throw new Error(message);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function asNonEmptyStrings(value) {
  if (isNonEmptyString(value)) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value.filter(isNonEmptyString).map((entry) => entry.trim());
}

function hasMeaningfulValue(value) {
  if (isNonEmptyString(value)) return true;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function itemId(item) {
  return typeof item === "string" ? item : item?.candidateId || item?.id;
}

function familyId(run) {
  return run?.familyId || run?.family || run?.id;
}

function assetVersion(asset) {
  return asset?.fixedCommit
    || asset?.commit
    || asset?.digest
    || asset?.sha256
    || asset?.version;
}

function assetType(asset) {
  return asset?.type || asset?.assetType || asset?.kind;
}

function sourceUrl(source) {
  return source?.url || source?.primaryUrl || source?.officialUrl;
}

function sourceOrigin(source) {
  return source?.sourceFamily || source?.sourceOrigin || source?.provenance;
}

function isHttpsUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && isNonEmptyString(parsed.hostname);
  } catch {
    return false;
  }
}

function assertTimestamp(value, label) {
  assertValid(isNonEmptyString(value), `${label} is required.`);
  const timestamp = Date.parse(value);
  assertValid(Number.isFinite(timestamp), `${label} must be a valid timestamp.`);
  assertValid(timestamp <= Date.now() + 60_000, `${label} cannot be future-dated.`);
  return timestamp;
}

function assertUnique(values, label) {
  assertValid(
    values.length === new Set(values).size,
    `${label} must be unique.`
  );
}

function assertRuntimeAgentId(value, label) {
  assertValid(
    isNonEmptyString(value) && RUNTIME_UUID_PATTERN.test(value.trim()),
    `${label} must be a runtime UUID.`
  );
  return value.trim().toLowerCase();
}

function queryTexts(run) {
  return asNonEmptyStrings(run?.query || run?.actualQuery || run?.queries);
}

function querySources(run) {
  return asNonEmptyStrings(run?.source || run?.sourceFamily || run?.sourceFamilies);
}

function queryResultCount(run) {
  return run?.resultCount
    ?? run?.verifiedPrimaryCount
    ?? run?.inspectedPrimaryCount;
}

function queryCanonicalSample(run) {
  const aliases = [
    run?.canonicalIdSample,
    run?.resultIdSample,
    run?.acceptedPrimaryIds,
    run?.retainedCanonicalIds,
    run?.retainedEvidenceIds
  ];
  const present = aliases.find((value) => value !== undefined);
  return present === undefined ? null : asNonEmptyStrings(present);
}

function hasReproducibleRetrievalMetadata(run) {
  if (hasMeaningfulValue(run?.retrievalMetadata)
    || hasMeaningfulValue(run?.reproducibleRetrievalMetadata)) {
    return true;
  }
  const rawCount = run?.rawHitCount;
  const hasRawCount = Number.isInteger(rawCount) && rawCount >= 0;
  const hasRawCountMap = run?.rawHitCounts
    && typeof run.rawHitCounts === "object"
    && Object.values(run.rawHitCounts).length > 0
    && Object.values(run.rawHitCounts).every((count) => Number.isInteger(count) && count >= 0);
  return (hasRawCount || hasRawCountMap) && isNonEmptyString(run?.screeningNote);
}

function normalizeSourceFamily(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (/(^|[^a-z])local([^a-z]|$)|local-corpus/.test(normalized)) return "local-corpus";
  if (/arxiv|preprint/.test(normalized)) return "arxiv";
  if (/standard|publisher|venue|doi|ieee|acm|cvf|neurips|iclr|aaai/.test(normalized)) {
    return "publisher-and-venue";
  }
  if (/official-code|official-data|github|gitlab|repository|dataset|project-page/.test(normalized)) {
    return "official-code-and-data";
  }
  if (/external|primary-source|web-search|semantic-scholar|openalex/.test(normalized)) {
    return "external-primary-sources";
  }
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isLocalFamily(family) {
  return family === "local-corpus";
}

function isExternalFamily(family) {
  return Boolean(family) && !isLocalFamily(family);
}

function sourceFamilyIsCovered(family, attemptedFamilies) {
  if (attemptedFamilies.has(family)) return true;
  if (family === "external-primary-sources") {
    return [...attemptedFamilies].some(isExternalFamily);
  }
  return isExternalFamily(family) && attemptedFamilies.has("external-primary-sources");
}

function requirement(requirements, key) {
  const value = requirements?.[key];
  assertValid(
    Number.isInteger(value) && value >= 0,
    `Idea workflow requirements.${key} must be a non-negative integer.`
  );
  return value;
}

function collectAgentLedger(pool, label) {
  const rolesByAgent = new Map();
  const record = (agentId, role, fieldLabel) => {
    const normalizedId = assertRuntimeAgentId(agentId, `${label}: ${fieldLabel}`);
    if (!rolesByAgent.has(normalizedId)) rolesByAgent.set(normalizedId, new Set());
    rolesByAgent.get(normalizedId).add(role);
  };
  const recordOptionalList = (value, role, fieldLabel) => {
    if (value === undefined) return;
    assertValid(Array.isArray(value) && value.length > 0, `${label}: ${fieldLabel} must be a non-empty array.`);
    const ids = value.map((agentId, index) => {
      const normalizedId = assertRuntimeAgentId(agentId, `${label}: ${fieldLabel}[${index}]`);
      record(normalizedId, role, `${fieldLabel}[${index}]`);
      return normalizedId;
    });
    assertUnique(ids, `${label}: ${fieldLabel}`);
  };

  record(pool.reviewerAgentId, "pool-reviewer", "reviewerAgentId");
  if (pool.retrievalAgentId !== undefined) {
    record(pool.retrievalAgentId, "retrieval", "retrievalAgentId");
  }
  recordOptionalList(pool.retrievalAgentIds, "retrieval", "retrievalAgentIds");
  if (pool.selectionAgentId !== undefined) {
    record(pool.selectionAgentId, "selection", "selectionAgentId");
  }
  recordOptionalList(pool.selectionAgentIds, "selection", "selectionAgentIds");
  recordOptionalList(pool.reviewerAgentIds, "pool-reviewer", "reviewerAgentIds");

  return [...rolesByAgent.entries()].map(([agentId, roles]) => ({
    agentId,
    roles: [...roles].sort()
  }));
}

function validateSourceAttempts(sourceAttempts, label) {
  assertValid(
    Array.isArray(sourceAttempts) && sourceAttempts.length > 0,
    `${label}: searchAudit.sourceAttempts must be a non-empty array.`
  );
  const attemptedFamilies = new Set();
  for (const [index, attempt] of sourceAttempts.entries()) {
    const attemptLabel = `${label}: searchAudit.sourceAttempts[${index}]`;
    const rawFamily = attempt?.sourceFamily || attempt?.sourceOrigin || attempt?.family || attempt?.source;
    assertValid(isNonEmptyString(rawFamily), `${attemptLabel}.sourceFamily is required.`);
    const normalizedFamily = normalizeSourceFamily(rawFamily);
    assertValid(normalizedFamily, `${attemptLabel}.sourceFamily is invalid.`);
    if (attempt.attempted !== undefined) {
      assertValid(typeof attempt.attempted === "boolean", `${attemptLabel}.attempted must be boolean.`);
    }
    assertValid(
      attempt.attempted !== undefined
        || isNonEmptyString(attempt.status)
        || hasMeaningfulValue(attempt.result)
        || hasMeaningfulValue(attempt.note)
        || hasMeaningfulValue(attempt.method),
      `${attemptLabel} needs an attempted flag, status, result, note, or method.`
    );
    const attemptTimestamp = attempt.attemptedAt || attempt.checkedAt || attempt.executedAt;
    if (attemptTimestamp !== undefined) assertTimestamp(attemptTimestamp, `${attemptLabel} timestamp`);
    if (attempt.attempted !== false) attemptedFamilies.add(normalizedFamily);
  }
  return attemptedFamilies;
}

export function validateIdeaAuditPool(pool, workflow, relativePath = "Idea candidate pool") {
  const label = relativePath;
  assertValid(pool && typeof pool === "object" && !Array.isArray(pool), `${label}: audit must be an object.`);
  const requirements = workflow?.requirements;
  assertValid(requirements && typeof requirements === "object", `${label}: workflow requirements are required.`);

  const timestamp = pool.searchedAt || pool.reviewedAt;
  assertTimestamp(timestamp, `${label}: audit timestamp`);
  for (const field of ["searchedAt", "reviewedAt", "generatedAt"]) {
    if (pool[field] !== undefined) assertTimestamp(pool[field], `${label}: ${field}`);
  }
  const agentLedger = collectAgentLedger(pool, label);

  const queryRuns = pool.searchAudit?.queryRuns;
  assertValid(Array.isArray(queryRuns), `${label}: searchAudit.queryRuns is required.`);
  const queryFamilyIds = queryRuns.map(familyId);
  assertValid(
    queryFamilyIds.every(isNonEmptyString),
    `${label}: every query run needs a family identifier.`
  );
  assertUnique(queryFamilyIds, `${label}: query family identifiers`);
  assertValid(
    queryFamilyIds.length >= requirement(requirements, "minQueryFamilies"),
    `${label}: expected at least ${requirements.minQueryFamilies} query families.`
  );

  const normalizedQuerySources = [];
  for (const [index, run] of queryRuns.entries()) {
    const runLabel = `${label}: searchAudit.queryRuns[${index}]`;
    assertValid(queryTexts(run).length > 0, `${runLabel} needs a non-empty actual query.`);
    assertValid(
      isNonEmptyString(run.scopeRationale || run.focus),
      `${runLabel} needs a non-empty scope rationale.`
    );
    const sources = querySources(run);
    assertValid(sources.length > 0, `${runLabel} needs a source.`);
    normalizedQuerySources.push(...sources.map(normalizeSourceFamily));
    assertTimestamp(run.executedAt, `${runLabel}.executedAt`);
    const resultCount = queryResultCount(run);
    assertValid(
      Number.isInteger(resultCount) && resultCount >= 0,
      `${runLabel}.resultCount must be a non-negative integer.`
    );

    const canonicalSample = queryCanonicalSample(run);
    if (canonicalSample !== null) {
      assertValid(
        canonicalSample.length > 0 || resultCount === 0 || hasReproducibleRetrievalMetadata(run),
        `${runLabel} needs a non-empty canonical ID sample or reproducible retrieval metadata.`
      );
      assertUnique(canonicalSample.map((id) => id.toLowerCase()), `${runLabel}: canonical ID sample`);
    } else {
      assertValid(
        resultCount === 0 || hasReproducibleRetrievalMetadata(run),
        `${runLabel} needs a canonical ID sample or reproducible retrieval metadata.`
      );
    }
  }

  const attemptedFamilies = validateSourceAttempts(pool.searchAudit?.sourceAttempts, label);
  for (const sourceFamily of normalizedQuerySources) {
    assertValid(
      sourceFamilyIsCovered(sourceFamily, attemptedFamilies),
      `${label}: query source family ${sourceFamily} is missing from searchAudit.sourceAttempts.`
    );
  }

  const references = pool.verifiedReferences || pool.searchAudit?.references;
  assertValid(Array.isArray(references), `${label}: verifiedReferences is required.`);
  assertValid(
    references.length >= requirement(requirements, "minVerifiedReferences"),
    `${label}: expected at least ${requirements.minVerifiedReferences} references.`
  );
  const canonicalIds = [];
  const currentYear = new Date().getUTCFullYear();
  let recentReferenceCount = 0;
  let localReferenceCount = 0;
  let externalReferenceCount = 0;

  for (const [index, source] of references.entries()) {
    const sourceLabel = `${label}: verifiedReferences[${index}]`;
    assertValid(isNonEmptyString(source?.canonicalId), `${sourceLabel}.canonicalId is required.`);
    canonicalIds.push(source.canonicalId.trim().toLowerCase());
    assertValid(isNonEmptyString(source?.title), `${sourceLabel}.title is required.`);
    assertValid(
      isHttpsUrl(sourceUrl(source)),
      `${sourceLabel}.url must be HTTPS.`
    );
    assertValid(
      Number.isInteger(source?.year) && source.year >= 1900 && source.year <= currentYear,
      `${sourceLabel}.year must be an integer between 1900 and ${currentYear}.`
    );
    const rawOrigin = sourceOrigin(source);
    assertValid(
      isNonEmptyString(rawOrigin),
      `${sourceLabel} needs sourceFamily or sourceOrigin (legacy provenance is accepted).`
    );
    const normalizedOrigin = normalizeSourceFamily(rawOrigin);
    assertValid(
      sourceFamilyIsCovered(normalizedOrigin, attemptedFamilies),
      `${sourceLabel} source family ${normalizedOrigin} is missing from searchAudit.sourceAttempts.`
    );
    if (source.year >= requirement(requirements, "recentSinceYear")) recentReferenceCount += 1;
    if (isNonEmptyString(source.localPaperId) || isLocalFamily(normalizedOrigin)) localReferenceCount += 1;
    if (isExternalFamily(normalizedOrigin)) externalReferenceCount += 1;

    if (source.queryFamilyIds !== undefined) {
      const referenceQueryFamilies = asNonEmptyStrings(source.queryFamilyIds);
      assertValid(
        Array.isArray(source.queryFamilyIds) && referenceQueryFamilies.length > 0,
        `${sourceLabel}.queryFamilyIds must be a non-empty array when present.`
      );
      assertValid(
        referenceQueryFamilies.every((id) => queryFamilyIds.includes(id)),
        `${sourceLabel}.queryFamilyIds contains an unknown query family.`
      );
    }
  }
  assertUnique(canonicalIds, `${label}: canonical reference IDs`);
  assertValid(
    recentReferenceCount >= requirement(requirements, "minRecentReferences"),
    `${label}: expected at least ${requirements.minRecentReferences} references from ${requirements.recentSinceYear} or later.`
  );
  assertValid(
    localReferenceCount >= requirement(requirements, "minLocalReferences"),
    `${label}: expected at least ${requirements.minLocalReferences} local references.`
  );
  assertValid(
    externalReferenceCount >= requirement(requirements, "minExternalReferences"),
    `${label}: expected at least ${requirements.minExternalReferences} external references.`
  );

  const assets = pool.assetChecks || pool.assetAudit?.assets;
  assertValid(Array.isArray(assets), `${label}: assetChecks is required.`);
  assertValid(
    assets.length >= requirement(requirements, "minOfficialCodeOrDataAssets"),
    `${label}: expected at least ${requirements.minOfficialCodeOrDataAssets} asset checks.`
  );
  for (const [index, asset] of assets.entries()) {
    const assetLabel = `${label}: assetChecks[${index}]`;
    assertValid(isNonEmptyString(assetType(asset)), `${assetLabel}.type is required.`);
    assertValid(
      isHttpsUrl(sourceUrl(asset)),
      `${assetLabel}.url must be HTTPS.`
    );
    assertValid(
      hasMeaningfulValue(
        asset.availability
          || asset.availabilityNote
          || asset.status
          || asset.accessBoundary
          || asset.boundary
          || asset.notVerified
          || asset.verifiedCapability
          || asset.verifiedEntrypoints
          || asset.verifiedEntry
          || asset.reuse
      ),
      `${assetLabel} needs an availability or usability explanation.`
    );
    if (asset.commitDate !== undefined) {
      assertTimestamp(asset.commitDate, `${assetLabel}.commitDate`);
    }
  }
  assertValid(
    assets.filter((asset) => isNonEmptyString(assetVersion(asset))).length
      >= requirements.minOfficialCodeOrDataAssets,
    `${label}: too few assets are pinned to an immutable commit, digest, or version.`
  );

  const ledger = pool.candidateLedger;
  assertValid(Array.isArray(ledger), `${label}: candidateLedger is required.`);
  assertValid(
    ledger.length >= requirement(requirements, "minGeneratedCandidates"),
    `${label}: expected at least ${requirements.minGeneratedCandidates} candidates.`
  );
  const ledgerIds = ledger.map(itemId);
  assertValid(ledgerIds.every(isNonEmptyString), `${label}: every ledger row needs candidateId.`);
  assertUnique(ledgerIds, `${label}: candidate IDs`);

  const shortlist = pool.shortlist || [];
  const rejected = pool.rejected || [];
  const shortlistIds = shortlist.map(itemId);
  const rejectedIds = rejected.map(itemId);
  assertValid(shortlistIds.every(isNonEmptyString), `${label}: every shortlist row needs candidateId.`);
  assertValid(rejectedIds.every(isNonEmptyString), `${label}: every rejected row needs candidateId.`);
  assertUnique(shortlistIds, `${label}: shortlist IDs`);
  assertUnique(rejectedIds, `${label}: rejected IDs`);
  assertValid(
    shortlistIds.length <= requirement(requirements, "maxPublishedIdeas"),
    `${label}: shortlist exceeds the configured publication maximum.`
  );
  assertValid(
    rejectedIds.length >= requirement(requirements, "minRejectedCandidates"),
    `${label}: too few candidates have explicit rejection records.`
  );
  assertValid(
    shortlistIds.every((id) => !rejectedIds.includes(id)),
    `${label}: shortlist and rejected sets overlap.`
  );
  assertValid(
    ledgerIds.length === shortlistIds.length + rejectedIds.length
      && ledgerIds.every((id) => shortlistIds.includes(id) || rejectedIds.includes(id)),
    `${label}: shortlist and rejected records must exactly partition candidateLedger.`
  );

  for (const candidate of ledger) {
    const id = itemId(candidate);
    assertValid(
      isNonEmptyString(candidate.title || candidate.canonicalClaim || candidate.coreClaim),
      `${label}/${id}: title or canonical claim is required.`
    );
    const normalizedDisposition = candidate.disposition === "shortlisted"
      ? "shortlist"
      : candidate.disposition;
    assertValid(
      ["shortlist", "rejected"].includes(normalizedDisposition),
      `${label}/${id}: disposition must be shortlist or rejected.`
    );
    assertValid(
      normalizedDisposition === (shortlistIds.includes(id) ? "shortlist" : "rejected"),
      `${label}/${id}: disposition disagrees with the top-level partition.`
    );
  }

  for (const entry of rejected) {
    const reasons = entry.reasons || entry.mechanicalReasons || entry.reason;
    assertValid(
      (Array.isArray(reasons) && reasons.some(isNonEmptyString)) || isNonEmptyString(reasons),
      `${label}/${itemId(entry)}: rejected candidate needs an explicit reason.`
    );
  }

  assertValid(
    isNonEmptyString(pool.conclusion)
      || (pool.conclusion && typeof pool.conclusion === "object"
        && isNonEmptyString(pool.conclusion.summary)),
    `${label}: conclusion must be substantive text or an object with a substantive summary.`
  );
  return {
    queries: queryRuns.length,
    references: references.length,
    recentReferences: recentReferenceCount,
    localReferences: localReferenceCount,
    externalReferences: externalReferenceCount,
    sourceAttempts: pool.searchAudit.sourceAttempts.length,
    assets: assets.length,
    candidates: ledger.length,
    shortlisted: shortlist.length,
    rejected: rejected.length,
    agentLedger
  };
}

export async function resolveAuditInputPath(
  inputPath,
  { root = ROOT, auditRoot = AUDIT_ROOT } = {}
) {
  const absolutePath = path.resolve(root, inputPath);
  const lexicalRelative = path.relative(auditRoot, absolutePath);
  assertValid(
    lexicalRelative && !lexicalRelative.startsWith(`..${path.sep}`) && lexicalRelative !== ".." && !path.isAbsolute(lexicalRelative),
    `${inputPath}: audit must stay inside content/idea-audits.`
  );

  const [auditRootRealPath, inputStat] = await Promise.all([
    realpath(auditRoot),
    lstat(absolutePath)
  ]);
  assertValid(!inputStat.isSymbolicLink(), `${inputPath}: audit file must not be a symbolic link.`);
  assertValid(inputStat.isFile(), `${inputPath}: audit path must be a regular file.`);

  const absoluteRealPath = await realpath(absolutePath);
  const realRelative = path.relative(auditRootRealPath, absoluteRealPath);
  assertValid(
    realRelative && !realRelative.startsWith(`..${path.sep}`) && realRelative !== ".." && !path.isAbsolute(realRelative),
    `${inputPath}: resolved audit path escapes content/idea-audits.`
  );
  return absoluteRealPath;
}

async function main() {
  const inputPaths = process.argv.slice(2);
  assertValid(
    inputPaths.length > 0,
    "Usage: node scripts/validate-idea-audit-pool.mjs <audit.json> [...]"
  );
  const workflow = JSON.parse(await readFile(WORKFLOW_PATH, "utf8"));

  for (const inputPath of inputPaths) {
    const absolutePath = await resolveAuditInputPath(inputPath);
    const relativePath = path.relative(ROOT, absolutePath);
    const pool = JSON.parse(await readFile(absolutePath, "utf8"));
    const counts = validateIdeaAuditPool(pool, workflow, relativePath);
    console.log(
      `OK ${relativePath}: ${counts.queries} queries, ${counts.references} references, `
        + `${counts.assets} assets, ${counts.candidates} candidates, `
        + `${counts.shortlisted} shortlisted, ${counts.rejected} rejected.`
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
