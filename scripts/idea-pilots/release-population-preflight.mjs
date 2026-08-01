#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import {
  fileURLToPath,
  pathToFileURL,
} from "node:url";

export const CERTIFICATE_SCHEMA_VERSION =
  "cooperative-perception-release-population-preflight/v1";
export const RECORD_SCHEMA_VERSION =
  "cooperative-perception-physical-event-ego-available-agent-contract/v1";
export const BINDING_SCHEMA_VERSION =
  "cooperative-perception-release-binding/v1";
export const METAINFO_SCHEMA_VERSION =
  "cooperative-perception-metainfo/v1";
export const FIXED_CONVERTER_COMMIT =
  "0945b52ce7a9765ae17d9c8ffa5e2e8573fef19a";
export const SPLIT = "test";
export const VEHICLE_EGO_IDS = Object.freeze(["1", "2", "3"]);
export const CANONICAL_AGENT_IDS = Object.freeze(["0", "1", "2", "3"]);

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(SCRIPT_PATH), "../..");
const DEFAULT_RELEASE_ARTIFACT = resolve(
  REPOSITORY_ROOT,
  "content/idea-audits/"
    + "cooperative-autonomous-driving-release-population-lineage-pilot-v4.json",
);
const DEFAULT_GENERATOR_ARTIFACT = resolve(
  REPOSITORY_ROOT,
  "content/idea-audits/"
    + "cooperative-autonomous-driving-converter-execution-smoke-v5.json",
);
const DEFAULT_OUTPUT = resolve(
  REPOSITORY_ROOT,
  "content/idea-audits/"
    + "cooperative-autonomous-driving-release-population-preflight-v6.json",
);
const TEST_PATH = resolve(
  REPOSITORY_ROOT,
  "test/release-population-preflight.test.mjs",
);

export const PINNED_ARTIFACTS = Object.freeze({
  released: Object.freeze({
    path: DEFAULT_RELEASE_ARTIFACT,
    sha256:
      "b745c3acf8f3cc579ee6ba57698874f9d3d8ac639149d2a7867e6cc99906f62e",
  }),
  generator: Object.freeze({
    path: DEFAULT_GENERATOR_ARTIFACT,
    sha256:
      "a891fb791a21449690bd50cf77ae0319aebe334c1b2ed6fb37763180eac325cc",
  }),
});

const RELEASE_RAW_METAINFO = Object.freeze({
  categories: { vehicle: 0 },
  classes: ["vehicle"],
  cooperative: true,
  dataset: "OPV2V",
  info_version: "1.0",
});
const GENERATOR_RAW_METAINFO = Object.freeze({
  categories: { vehicle: 0 },
  classes: ["vehicle"],
  cooperative: true,
  dataset: "CooperScene",
  info_version: "1.0",
});
const CANONICAL_METAINFO = Object.freeze({
  schemaVersion: METAINFO_SCHEMA_VERSION,
  normalizationPolicy:
    "pinned-release-opv2v-label-to-cooperscene-alias/v1",
  categories: { vehicle: 0 },
  classes: ["vehicle"],
  cooperative: true,
  dataset: "CooperScene",
  infoVersion: "1.0",
});

const HEX_SHA256 = /^[0-9a-f]{64}$/;
const KEY_COMPONENT = /^[A-Za-z0-9_.-]+$/;

export class PreflightError extends Error {
  constructor(code, message, witness = null) {
    super(message);
    this.name = "PreflightError";
    this.code = code;
    this.witness = witness;
  }
}

function fail(code, message, witness = null) {
  throw new PreflightError(code, message, witness);
}

function ensure(condition, code, message, witness = null) {
  if (!condition) fail(code, message, witness);
}

export function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalDigest(value) {
  return sha256(Buffer.from(stableJson(value), "utf8"));
}

function deepEqual(left, right) {
  return stableJson(left) === stableJson(right);
}

function clone(value) {
  return structuredClone(value);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function exactKeys(value, expected, location) {
  ensure(
    value && typeof value === "object" && !Array.isArray(value),
    "SCHEMA_VIOLATION",
    `${location} must be an object`,
    { location },
  );
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  ensure(
    deepEqual(actual, wanted),
    "SCHEMA_VIOLATION",
    `${location} has unexpected keys`,
    { location, expected: wanted, actual },
  );
}

function exactValue(actual, expected, code, location) {
  ensure(
    deepEqual(actual, expected),
    code,
    `${location} does not match the pinned contract`,
    { location, expected, actual },
  );
}

function requireSha256(value, location) {
  ensure(
    typeof value === "string" && HEX_SHA256.test(value),
    "SCHEMA_VIOLATION",
    `${location} must be a lowercase SHA-256`,
    { location, actual: value },
  );
  return value;
}

function artifactIdentity(items, role, location) {
  ensure(Array.isArray(items), "SCHEMA_VIOLATION", `${location} must be an array`);
  const matches = items.filter((item) => item.role === role);
  ensure(
    matches.length === 1,
    "BOUND_IDENTITY_MISMATCH",
    `${location} must contain exactly one ${role} identity`,
    { location, role, count: matches.length },
  );
  return matches[0];
}

function canonicalComponent(value, location) {
  const result = String(value);
  ensure(
    KEY_COMPONENT.test(result),
    "SCHEMA_VIOLATION",
    `${location} is not a canonical key component`,
    { location, actual: value },
  );
  return result;
}

function eventKey(physicalEvent) {
  return `${physicalEvent.scenario}/${physicalEvent.timestamp}`;
}

export function recordKey(record) {
  return `${SPLIT}/${eventKey(record.physicalEvent)}/${record.egoAgentId}`;
}

function compareRecords(left, right) {
  const leftKey = recordKey(left);
  const rightKey = recordKey(right);
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

function canonicalRecord({
  physicalEvent,
  egoAgentId,
  availableAgentCohortContractIds,
}) {
  const scenario = canonicalComponent(
    physicalEvent?.scenario,
    "record.physicalEvent.scenario",
  );
  const timestamp = canonicalComponent(
    physicalEvent?.timestamp,
    "record.physicalEvent.timestamp",
  );
  const ego = canonicalComponent(egoAgentId, "record.egoAgentId");
  const cohort = availableAgentCohortContractIds.map((agentId, index) =>
    canonicalComponent(
      agentId,
      `record.availableAgentCohortContractIds[${index}]`,
    ));
  return {
    schemaVersion: RECORD_SCHEMA_VERSION,
    split: SPLIT,
    physicalEvent: { scenario, timestamp },
    egoAgentId: ego,
    availableAgentCohortContractIds: [...cohort].sort(),
  };
}

function firstObjectDifference(left, right, location = "$") {
  if (deepEqual(left, right)) return null;
  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const found = firstObjectDifference(
        left[index],
        right[index],
        `${location}[${index}]`,
      );
      if (found) return found;
    }
  }
  if (
    left
    && right
    && typeof left === "object"
    && typeof right === "object"
    && !Array.isArray(left)
    && !Array.isArray(right)
  ) {
    const keys = sortedUnique([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      const found = firstObjectDifference(
        left[key],
        right[key],
        `${location}.${key}`,
      );
      if (found) return found;
    }
  }
  return { path: location, released: left, generator: right };
}

function projectionManifests(records, canonicalMetainfo, boundIdentity) {
  const keys = records.map(recordKey);
  const cohorts = records.map((record) => ({
    key: recordKey(record),
    availableAgentCohortContractIds:
      record.availableAgentCohortContractIds,
  }));
  return {
    keyManifestSha256: canonicalDigest(keys),
    availableAgentCohortContractManifestSha256: canonicalDigest(cohorts),
    recordManifestSha256: canonicalDigest(records),
    metainfoManifestSha256: canonicalDigest(canonicalMetainfo),
    boundIdentityManifestSha256: canonicalDigest(boundIdentity),
  };
}

export function createProjection({
  role,
  records,
  rawMetainfo,
  canonicalMetainfo,
  boundIdentity,
  provenance,
}) {
  const canonicalRecords = records.map(canonicalRecord).sort(compareRecords);
  const projection = {
    role,
    recordSchemaVersion: RECORD_SCHEMA_VERSION,
    split: SPLIT,
    records: canonicalRecords,
    rawMetainfo: clone(rawMetainfo),
    canonicalMetainfo: clone(canonicalMetainfo),
    boundIdentity: clone(boundIdentity),
    manifests: projectionManifests(
      canonicalRecords,
      canonicalMetainfo,
      boundIdentity,
    ),
    provenance: clone(provenance),
  };
  validateProjection(projection);
  return projection;
}

export function validateProjection(projection, expectedRole = null) {
  exactKeys(
    projection,
    [
      "role",
      "recordSchemaVersion",
      "split",
      "records",
      "rawMetainfo",
      "canonicalMetainfo",
      "boundIdentity",
      "manifests",
      "provenance",
    ],
    "projection",
  );
  if (expectedRole) {
    ensure(
      projection.role === expectedRole,
      "ONE_SIDED_PROJECTION",
      `expected ${expectedRole} projection, received ${projection.role}`,
      { expectedRole, actualRole: projection.role },
    );
  }
  exactValue(
    projection.recordSchemaVersion,
    RECORD_SCHEMA_VERSION,
    "SCHEMA_VERSION_MISMATCH",
    "projection.recordSchemaVersion",
  );
  exactValue(projection.split, SPLIT, "SPLIT_MISMATCH", "projection.split");
  ensure(
    Array.isArray(projection.records) && projection.records.length > 0,
    "SCHEMA_VIOLATION",
    "projection.records must be a non-empty array",
  );

  const keys = [];
  const firstIndexByKey = new Map();
  for (const [index, record] of projection.records.entries()) {
    exactKeys(
      record,
      [
        "schemaVersion",
        "split",
        "physicalEvent",
        "egoAgentId",
        "availableAgentCohortContractIds",
      ],
      `projection.records[${index}]`,
    );
    exactKeys(
      record.physicalEvent,
      ["scenario", "timestamp"],
      `projection.records[${index}].physicalEvent`,
    );
    exactValue(
      record.schemaVersion,
      RECORD_SCHEMA_VERSION,
      "SCHEMA_VERSION_MISMATCH",
      `projection.records[${index}].schemaVersion`,
    );
    exactValue(
      record.split,
      SPLIT,
      "SPLIT_MISMATCH",
      `projection.records[${index}].split`,
    );
    ensure(
      Array.isArray(record.availableAgentCohortContractIds),
      "SCHEMA_VIOLATION",
      `projection.records[${index}].availableAgentCohortContractIds `
        + "must be an array",
    );
    exactValue(
      record.availableAgentCohortContractIds,
      sortedUnique(record.availableAgentCohortContractIds),
      "NON_CANONICAL_AVAILABLE_AGENT_COHORT_CONTRACT",
      `projection.records[${index}].availableAgentCohortContractIds`,
    );
    ensure(
      !record.availableAgentCohortContractIds.includes(record.egoAgentId),
      "NON_CANONICAL_AVAILABLE_AGENT_COHORT_CONTRACT",
      "ego agent must not occur in its available-agent cohort contract",
      { key: recordKey(record), egoAgentId: record.egoAgentId },
    );
    const key = recordKey(record);
    if (firstIndexByKey.has(key)) {
      fail("DUPLICATE_KEY", "projection contains a duplicate canonical key", {
        key,
        firstIndex: firstIndexByKey.get(key),
        duplicateIndex: index,
      });
    }
    firstIndexByKey.set(key, index);
    keys.push(key);
  }
  exactValue(
    keys,
    [...keys].sort(),
    "NON_CANONICAL_SORT",
    "projection canonical key order",
  );
  exactValue(
    projection.manifests,
    projectionManifests(
      projection.records,
      projection.canonicalMetainfo,
      projection.boundIdentity,
    ),
    "MANIFEST_MISMATCH",
    "projection.manifests",
  );
  return projection;
}

function canonicalizeMetainfo(raw, role) {
  const expected = role === "released"
    ? RELEASE_RAW_METAINFO
    : GENERATOR_RAW_METAINFO;
  exactValue(
    raw,
    expected,
    "METAINFO_SOURCE_MISMATCH",
    `${role}.rawMetainfo`,
  );
  return clone(CANONICAL_METAINFO);
}

function validateReleaseEvidence(artifact, artifactSha256) {
  exactValue(
    artifact.schemaVersion,
    1,
    "SCHEMA_VERSION_MISMATCH",
    "releasedArtifact.schemaVersion",
  );
  exactValue(
    artifact.certificateId,
    "cooperative-autonomous-driving-release-population-lineage-pilot-v4",
    "SCHEMA_VIOLATION",
    "releasedArtifact.certificateId",
  );
  const inspection = artifact.releasedTestIndex;
  exactValue(
    inspection.safetyBoundary.classLookupPolicy,
    "deny-all",
    "RESTRICTED_PARSE_EVIDENCE_MISSING",
    "releasedArtifact.releasedTestIndex.safetyBoundary.classLookupPolicy",
  );
  exactValue(
    inspection.archiveMemberIdentityVerification.deserializedInThisPilot,
    true,
    "RESTRICTED_PARSE_EVIDENCE_MISSING",
    "releasedArtifact.releasedTestIndex.deserializedInThisPilot",
  );
  exactValue(
    inspection.pickleSha256,
    inspection.archiveMemberIdentityVerification.observedSha256,
    "BOUND_IDENTITY_MISMATCH",
    "released pickle identity",
  );
  requireSha256(
    inspection.population.rowManifestSha256,
    "releasedArtifact.releasedTestIndex.population.rowManifestSha256",
  );
  exactValue(
    inspection.population,
    artifact.populationContract.comparison.released,
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
    "released restricted population summary",
  );

  const events = artifact.archivePrefixValidation.eventManifest;
  ensure(
    Array.isArray(events) && events.length === 30,
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
    "released event manifest must contain 30 events",
    { actualCount: events?.length },
  );
  exactValue(
    canonicalDigest(events),
    artifact.archivePrefixValidation.yamlExtraction.eventManifestSha256,
    "MANIFEST_MISMATCH",
    "released event manifest SHA-256",
  );
  const eventStrings = events.map((event) =>
    `${event.physicalEvent.scenario}/${event.physicalEvent.timestamp}`);
  exactValue(
    canonicalDigest(eventStrings),
    artifact.archivePrefixValidation.yamlExtraction.eventKeyManifestSha256,
    "MANIFEST_MISMATCH",
    "released event-key manifest SHA-256",
  );
  exactValue(
    canonicalDigest(artifact.archivePrefixValidation.sourceMemberIdentities),
    artifact.archivePrefixValidation
      .suppliedCentralInventory
      .sourceMemberManifestSha256,
    "MANIFEST_MISMATCH",
    "released source-member manifest SHA-256",
  );
  exactValue(
    artifact.archivePrefixValidation.yamlExtraction.agentsPerEvent,
    CANONICAL_AGENT_IDS,
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
    "released agents-per-event contract",
  );
  exactValue(
    artifact.archivePrefixValidation.yamlExtraction.everyEventHasAllFourAgents,
    true,
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
    "released every-event cohort assertion",
  );

  const fullRecords = [];
  const eventKeys = new Set();
  for (const [eventIndex, event] of events.entries()) {
    exactKeys(
      event,
      ["physicalEvent", "agents"],
      `releasedArtifact.eventManifest[${eventIndex}]`,
    );
    const scenario = canonicalComponent(
      event.physicalEvent.scenario,
      `releasedArtifact.eventManifest[${eventIndex}].scenario`,
    );
    const timestamp = canonicalComponent(
      event.physicalEvent.timestamp,
      `releasedArtifact.eventManifest[${eventIndex}].timestamp`,
    );
    const currentEventKey = `${scenario}/${timestamp}`;
    ensure(
      !eventKeys.has(currentEventKey),
      "DUPLICATE_KEY",
      "released event manifest contains a duplicate physical event",
      { key: currentEventKey },
    );
    eventKeys.add(currentEventKey);
    const agents = event.agents.map((agent) => String(agent.agentId)).sort();
    exactValue(
      agents,
      CANONICAL_AGENT_IDS,
      "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
      `released event ${currentEventKey} agent cohort`,
    );
    for (const agent of event.agents) {
      ensure(
        typeof agent.pcdMember === "string"
          && agent.pcdMember
            === `mini/${SPLIT}/${scenario}/${agent.agentId}/${timestamp}.pcd`,
        "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
        "released event PCD identity is not canonical",
        {
          event: currentEventKey,
          agentId: agent.agentId,
          pcdMember: agent.pcdMember,
        },
      );
      fullRecords.push(canonicalRecord({
        physicalEvent: { scenario, timestamp },
        egoAgentId: agent.agentId,
        availableAgentCohortContractIds:
          agents.filter((agentId) => agentId !== String(agent.agentId)),
      }));
    }
  }

  const population = inspection.population;
  exactValue(population.rowCount, 120, "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
    "released row count");
  exactValue(population.physicalEventCount, 30,
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH", "released physical-event count");
  exactValue(population.rowsPerEventDistribution, { 4: 30 },
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH", "released rows-per-event distribution");
  exactValue(population.egoRowsByAgent, { 0: 30, 1: 30, 2: 30, 3: 30 },
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH", "released ego distribution");

  const parity = artifact.populationContract.comparison.parityChecks;
  exactValue(
    parity.releasedVehicleKeysEqualDryRunKeys,
    true,
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
    "released vehicle-key restricted-parser bridge",
  );
  exactValue(
    parity.sourcePcdIdentitySetsEqual,
    true,
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
    "released PCD identity bridge",
  );
  exactValue(
    parity.dryRunOnlyKeys,
    [],
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
    "released dry-run-only keys",
  );
  const expectedReleaseOnly = fullRecords
    .filter((record) => record.egoAgentId === "0")
    .map((record) => [
      record.physicalEvent.scenario,
      record.physicalEvent.timestamp,
      record.egoAgentId,
    ].join("\u001f"));
  exactValue(
    parity.releaseOnlyKeys,
    expectedReleaseOnly,
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
    "released infrastructure-only keys",
  );
  exactValue(
    parity.releaseOnlyRowCount,
    expectedReleaseOnly.length,
    "RELEASE_EVIDENCE_BRIDGE_MISMATCH",
    "released infrastructure-only row count",
  );

  const fixedCommit = artifact.publicGeneratorStaticEvidence
    .inspectedHead.identity.commit.commit;
  exactValue(
    fixedCommit,
    FIXED_CONVERTER_COMMIT,
    "WRONG_FIXED_COMMIT",
    "released fixed converter commit",
  );
  const central = artifactIdentity(
    artifact.inputIdentities,
    "central-directory-inventory",
    "releasedArtifact.inputIdentities",
  );
  const archive = artifactIdentity(
    artifact.inputIdentities,
    "official-archive-prefix",
    "releasedArtifact.inputIdentities",
  );
  const releasedIndex = artifactIdentity(
    artifact.inputIdentities,
    "released-test-index",
    "releasedArtifact.inputIdentities",
  );

  return {
    fullRecords,
    rawMetainfo: population.metainfo,
    boundIdentity: {
      schemaVersion: BINDING_SCHEMA_VERSION,
      split: SPLIT,
      releaseEvidenceArtifactSha256: artifactSha256,
      centralInventorySha256: requireSha256(
        central.sha256,
        "released central inventory SHA-256",
      ),
      officialArchivePrefixSha256: requireSha256(
        archive.sha256,
        "released archive-prefix SHA-256",
      ),
      releasedTestIndexSha256: requireSha256(
        releasedIndex.sha256,
        "released test-index SHA-256",
      ),
      fixedConverterCommit: fixedCommit,
    },
    evidenceBinding: {
      restrictedParserClassLookupPolicy:
        inspection.safetyBoundary.classLookupPolicy,
      restrictedParserPlainValuePolicy:
        inspection.safetyBoundary.plainValuePolicy,
      releasedPickleSha256: inspection.pickleSha256,
      releasedPayloadSha256: inspection.payloadSha256,
      releasedRestrictedRowManifestSha256:
        inspection.population.rowManifestSha256,
      eventManifestSha256:
        artifact.archivePrefixValidation.yamlExtraction.eventManifestSha256,
      eventKeyManifestSha256:
        artifact.archivePrefixValidation.yamlExtraction.eventKeyManifestSha256,
      sourceMemberManifestSha256:
        artifact.archivePrefixValidation
          .suppliedCentralInventory
          .sourceMemberManifestSha256,
      restrictedParserBridge: {
        releasedVehicleKeysEqualIndependentProjection: true,
        releaseOnlyInfrastructureKeysManifestSha256:
          canonicalDigest(expectedReleaseOnly),
        sourcePcdIdentitySetsEqual: true,
        availableAgentCohortContractDerivation: {
          source: "v4 independently bound official event manifest",
          canonicalAgentIds: CANONICAL_AGENT_IDS,
          rule: "all event agents except the current ego",
        },
      },
    },
  };
}

export function deriveReleasedProjection(
  artifact,
  {
    artifactSha256 = PINNED_ARTIFACTS.released.sha256,
    scope = "vehicle-egos",
  } = {},
) {
  exactValue(
    artifactSha256,
    PINNED_ARTIFACTS.released.sha256,
    "SOURCE_ARTIFACT_HASH_MISMATCH",
    "released source artifact SHA-256",
  );
  const evidence = validateReleaseEvidence(artifact, artifactSha256);
  ensure(
    scope === "vehicle-egos" || scope === "full-released",
    "SCHEMA_VIOLATION",
    "released projection scope must be vehicle-egos or full-released",
    { scope },
  );
  const records = scope === "vehicle-egos"
    ? evidence.fullRecords.filter((record) =>
      VEHICLE_EGO_IDS.includes(record.egoAgentId))
    : evidence.fullRecords;
  return createProjection({
    role: "released",
    records,
    rawMetainfo: evidence.rawMetainfo,
    canonicalMetainfo: canonicalizeMetainfo(
      evidence.rawMetainfo,
      "released",
    ),
    boundIdentity: evidence.boundIdentity,
    provenance: {
      sourceArtifactRole: "released-population-lineage-pilot-v4",
      sourceArtifactSha256: artifactSha256,
      projectionScope: scope,
      derivation:
        "v4 restricted-parser population/key bridge plus its independently "
        + "bound official event/cohort manifest; no v5 generated keys read",
      evidenceBinding: evidence.evidenceBinding,
      projectionEvidenceSha256: canonicalDigest({
        artifactSha256,
        scope,
        evidenceBinding: evidence.evidenceBinding,
      }),
    },
  });
}

function validateGeneratorEvidence(artifact, artifactSha256) {
  exactValue(
    artifact.schemaVersion,
    1,
    "SCHEMA_VERSION_MISMATCH",
    "generatorArtifact.schemaVersion",
  );
  exactValue(
    artifact.certificateId,
    "cooperative-autonomous-driving-converter-execution-smoke-v5",
    "SCHEMA_VIOLATION",
    "generatorArtifact.certificateId",
  );
  const converter = artifact.fixedPublicConverter;
  exactValue(
    converter.fixedCommit,
    FIXED_CONVERTER_COMMIT,
    "WRONG_FIXED_COMMIT",
    "generator fixed converter commit",
  );
  exactValue(
    converter.checkoutHead,
    FIXED_CONVERTER_COMMIT,
    "WRONG_FIXED_COMMIT",
    "generator checkout HEAD",
  );
  exactValue(
    converter.sourceFilesUnchangedDuringRun,
    true,
    "WRONG_FIXED_COMMIT",
    "generator source-files-unchanged assertion",
  );
  for (const [index, source] of converter.sourceFilesBefore.entries()) {
    exactValue(
      source.worktreeMatchesFixedCommitObject,
      true,
      "WRONG_FIXED_COMMIT",
      `generator sourceFilesBefore[${index}] identity`,
    );
    exactValue(
      source.worktreeSha256,
      source.fixedCommitObjectSha256,
      "WRONG_FIXED_COMMIT",
      `generator sourceFilesBefore[${index}] SHA-256`,
    );
  }
  exactValue(
    converter.sourceFilesAfter,
    converter.sourceFilesBefore,
    "WRONG_FIXED_COMMIT",
    "generator source files before/after execution",
  );

  const execution = artifact.converterExecution;
  exactValue(
    execution.classification,
    "actual-public-converter-main-execution",
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator execution classification",
  );
  exactValue(
    execution.exitCode,
    0,
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator execution exit code",
  );
  exactValue(
    execution.signal,
    null,
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator execution signal",
  );
  exactValue(
    execution.stderr,
    "",
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator execution stderr",
  );
  ensure(
    execution.argv.at(-2) === "--data-root"
      && execution.argv.at(-1).endsWith("/mini"),
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator execution must target the materialized mini root",
    { argv: execution.argv },
  );
  ensure(
    execution.stdout.includes("30 (scenario, timestamp) groups")
      && execution.stdout.includes("wrote 90 samples"),
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator execution stdout lacks the fixed population observations",
  );
  requireSha256(
    execution.generatedTestPickle.sha256,
    "generator generated test pickle SHA-256",
  );
  requireSha256(
    execution.generatedTestPickle.payloadSha256,
    "generator generated payload SHA-256",
  );

  const inspection = artifact.restrictedGeneratedIndexInspection;
  exactValue(
    inspection.classLookupPolicy,
    "deny-all",
    "RESTRICTED_PARSE_EVIDENCE_MISSING",
    "generator restricted parser class-lookup policy",
  );
  exactValue(
    inspection.rowCount,
    90,
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator restricted row count",
  );
  exactValue(
    inspection.physicalEventCount,
    30,
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator physical-event count",
  );
  exactValue(
    inspection.egoRowsByAgent,
    { 1: 30, 2: 30, 3: 30 },
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator ego distribution",
  );
  exactValue(
    inspection.metainfoMatchesExpectedPublicLiteral,
    true,
    "METAINFO_SOURCE_MISMATCH",
    "generator expected metainfo assertion",
  );

  const materialization = artifact.materialization;
  exactValue(
    materialization.memberCounts,
    { directory: 6, pcd: 120, png: 90, yaml: 120 },
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator materialized member counts",
  );
  exactValue(
    materialization.realYaml.eachMemberValidatedAgainstCentralLocalNameSizeAndCrc32,
    true,
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator official YAML identity validation",
  );
  exactValue(
    materialization.existenceStubs.converterStubReadEvents,
    0,
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator PCD/PNG stub read count",
  );

  const comparison = artifact.releasedVehicleProjectionComparison;
  const generatedKeys = comparison.generatedKeys;
  ensure(
    Array.isArray(generatedKeys) && generatedKeys.length === 90,
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "generator actual generated-key evidence must contain 90 keys",
    { actualCount: generatedKeys?.length },
  );
  exactValue(
    generatedKeys,
    sortedUnique(generatedKeys),
    "DUPLICATE_KEY",
    "generator generated keys",
  );
  exactValue(
    canonicalDigest(generatedKeys),
    comparison.generatedManifestSha256,
    "MANIFEST_MISMATCH",
    "generator actual generated-key manifest SHA-256",
  );
  const eventStrings = sortedUnique(generatedKeys.map((key) =>
    key.split("/").slice(0, 2).join("/")));
  exactValue(
    canonicalDigest(eventStrings),
    inspection.eventManifestSha256,
    "MANIFEST_MISMATCH",
    "generator actual event manifest SHA-256",
  );

  const records = generatedKeys.map((key, index) => {
    const components = key.split("/");
    ensure(
      components.length === 3,
      "SCHEMA_VIOLATION",
      "generator key must contain scenario/timestamp/ego",
      { index, key },
    );
    const [scenario, timestamp, egoAgentId] = components;
    ensure(
      VEHICLE_EGO_IDS.includes(egoAgentId),
      "ACTUAL_EXECUTION_EVIDENCE_MISSING",
      "generator emitted an ego outside the fixed vehicle candidates",
      { index, key, egoAgentId },
    );
    return canonicalRecord({
      physicalEvent: { scenario, timestamp },
      egoAgentId,
      availableAgentCohortContractIds:
        CANONICAL_AGENT_IDS.filter((agentId) => agentId !== egoAgentId),
    });
  });

  const central = artifactIdentity(
    artifact.officialInputs.identities,
    "central-directory-inventory",
    "generatorArtifact.officialInputs.identities",
  );
  const archive = artifactIdentity(
    artifact.officialInputs.identities,
    "official-archive-prefix",
    "generatorArtifact.officialInputs.identities",
  );
  const releasedIndex = artifactIdentity(
    artifact.officialInputs.identities,
    "released-test-index",
    "generatorArtifact.officialInputs.identities",
  );
  exactValue(
    artifact.officialInputs.priorFullMemberVerification.sha256,
    PINNED_ARTIFACTS.released.sha256,
    "BOUND_IDENTITY_MISMATCH",
    "generator prior release-evidence artifact SHA-256",
  );
  exactValue(
    comparison.releasedPickleSha256,
    releasedIndex.sha256,
    "BOUND_IDENTITY_MISMATCH",
    "generator bound released test-index SHA-256",
  );

  return {
    records,
    rawMetainfo: inspection.metainfo,
    boundIdentity: {
      schemaVersion: BINDING_SCHEMA_VERSION,
      split: SPLIT,
      releaseEvidenceArtifactSha256:
        artifact.officialInputs.priorFullMemberVerification.sha256,
      centralInventorySha256: requireSha256(
        central.sha256,
        "generator central inventory SHA-256",
      ),
      officialArchivePrefixSha256: requireSha256(
        archive.sha256,
        "generator archive-prefix SHA-256",
      ),
      releasedTestIndexSha256: requireSha256(
        releasedIndex.sha256,
        "generator released test-index SHA-256",
      ),
      fixedConverterCommit: converter.fixedCommit,
    },
    evidenceBinding: {
      executionClassification: execution.classification,
      generatedPickleSha256: execution.generatedTestPickle.sha256,
      generatedPayloadSha256: execution.generatedTestPickle.payloadSha256,
      restrictedParserClassLookupPolicy: inspection.classLookupPolicy,
      restrictedParserPlainValuePolicy: inspection.plainValuePolicy,
      generatedKeyManifestSha256: comparison.generatedManifestSha256,
      generatedEventManifestSha256: inspection.eventManifestSha256,
      materializedYamlManifestSha256:
        materialization.realYaml.manifestSha256,
      availableAgentCohortContractDerivation: {
        source:
          "v5 actual generated event/ego keys plus its fixed four-agent mini "
          + "materialization contract",
        materializedYamlCount: materialization.realYaml.count,
        generatedPhysicalEventCount: inspection.physicalEventCount,
        canonicalAgentIds: CANONICAL_AGENT_IDS,
        rule: "all fixed event agents except the current ego",
      },
      converterSourceManifestSha256: canonicalDigest(
        converter.sourceFilesBefore.map((source) => ({
          path: source.path,
          blobObjectId: source.blobObjectId,
          sha256: source.fixedCommitObjectSha256,
        })),
      ),
      sourceArtifactSha256: artifactSha256,
    },
  };
}

export function deriveGeneratorProjection(
  artifact,
  {
    artifactSha256 = PINNED_ARTIFACTS.generator.sha256,
  } = {},
) {
  exactValue(
    artifactSha256,
    PINNED_ARTIFACTS.generator.sha256,
    "SOURCE_ARTIFACT_HASH_MISMATCH",
    "generator source artifact SHA-256",
  );
  const evidence = validateGeneratorEvidence(artifact, artifactSha256);
  return createProjection({
    role: "generator",
    records: evidence.records,
    rawMetainfo: evidence.rawMetainfo,
    canonicalMetainfo: canonicalizeMetainfo(
      evidence.rawMetainfo,
      "generator",
    ),
    boundIdentity: evidence.boundIdentity,
    provenance: {
      sourceArtifactRole: "converter-execution-smoke-v5",
      sourceArtifactSha256: artifactSha256,
      projectionScope: "actual-generated-vehicle-egos",
      derivation:
        "v5 actual fixed-converter execution generatedKeys plus its restricted "
        + "generated-index inspection; no v4 released records read",
      evidenceBinding: evidence.evidenceBinding,
      projectionEvidenceSha256: canonicalDigest({
        artifactSha256,
        evidenceBinding: evidence.evidenceBinding,
      }),
    },
  });
}

function populationDifferenceWitness(releasedRecords, generatorRecords) {
  const releasedByKey = new Map(releasedRecords.map((record) => [
    recordKey(record),
    record,
  ]));
  const generatorByKey = new Map(generatorRecords.map((record) => [
    recordKey(record),
    record,
  ]));
  const releasedOnly = [...releasedByKey.keys()]
    .filter((key) => !generatorByKey.has(key))
    .sort();
  const generatorOnly = [...generatorByKey.keys()]
    .filter((key) => !releasedByKey.has(key))
    .sort();
  const eventDeltas = new Map();
  function add(keys, field) {
    for (const key of keys) {
      const [, scenario, timestamp, egoAgentId] = key.split("/");
      const currentEvent = `${scenario}/${timestamp}`;
      if (!eventDeltas.has(currentEvent)) {
        eventDeltas.set(currentEvent, {
          physicalEvent: { scenario, timestamp },
          releasedOnlyEgoAgentIds: [],
          generatorOnlyEgoAgentIds: [],
        });
      }
      eventDeltas.get(currentEvent)[field].push(egoAgentId);
    }
  }
  add(releasedOnly, "releasedOnlyEgoAgentIds");
  add(generatorOnly, "generatorOnlyEgoAgentIds");
  return {
    mismatch: "canonical-record-set",
    releasedRecordCount: releasedRecords.length,
    generatorRecordCount: generatorRecords.length,
    releasedOnlyCount: releasedOnly.length,
    generatorOnlyCount: generatorOnly.length,
    firstDifference: releasedOnly.length > 0
      ? { side: "released-only", key: releasedOnly[0] }
      : { side: "generator-only", key: generatorOnly[0] },
    perEvent: [...eventDeltas.values()],
  };
}

export function runMandatoryGate(released, generator) {
  validateProjection(released, "released");
  validateProjection(generator, "generator");
  ensure(
    released !== generator
      && released.provenance.sourceArtifactSha256
        !== generator.provenance.sourceArtifactSha256
      && released.provenance.sourceArtifactRole
        !== generator.provenance.sourceArtifactRole,
    "ONE_SIDED_PROJECTION",
    "released and generator projections must have distinct evidence producers",
    {
      releasedSource: released.provenance.sourceArtifactRole,
      generatorSource: generator.provenance.sourceArtifactRole,
    },
  );

  if (
    released.manifests.keyManifestSha256
    !== generator.manifests.keyManifestSha256
  ) {
    fail(
      "CANONICAL_RECORD_SET_MISMATCH",
      "released and generator canonical record sets differ",
      populationDifferenceWitness(released.records, generator.records),
    );
  }
  if (
    released.manifests.availableAgentCohortContractManifestSha256
    !== generator.manifests.availableAgentCohortContractManifestSha256
  ) {
    const generatorByKey = new Map(generator.records.map((record) => [
      recordKey(record),
      record,
    ]));
    const releasedRecord = released.records.find((record) => {
      const other = generatorByKey.get(recordKey(record));
      return other && !deepEqual(
        record.availableAgentCohortContractIds,
        other.availableAgentCohortContractIds,
      );
    });
    const generatorRecord = releasedRecord
      ? generatorByKey.get(recordKey(releasedRecord))
      : null;
    fail(
      "AVAILABLE_AGENT_COHORT_CONTRACT_MISMATCH",
      "released and generator available-agent cohort contracts differ",
      {
        mismatch: "available-agent-cohort-contract",
        key: releasedRecord ? recordKey(releasedRecord) : null,
        released:
          releasedRecord?.availableAgentCohortContractIds ?? null,
        generator:
          generatorRecord?.availableAgentCohortContractIds ?? null,
      },
    );
  }
  if (
    released.manifests.metainfoManifestSha256
    !== generator.manifests.metainfoManifestSha256
  ) {
    fail(
      "METAINFO_MISMATCH",
      "released and generator canonical metainfo differ",
      {
        mismatch: "canonical-metainfo",
        firstDifference: firstObjectDifference(
          released.canonicalMetainfo,
          generator.canonicalMetainfo,
        ),
      },
    );
  }
  if (
    released.manifests.boundIdentityManifestSha256
    !== generator.manifests.boundIdentityManifestSha256
  ) {
    fail(
      "BOUND_IDENTITY_MISMATCH",
      "released and generator bound identities differ",
      {
        mismatch: "bound-identity",
        firstDifference: firstObjectDifference(
          released.boundIdentity,
          generator.boundIdentity,
        ),
      },
    );
  }
  return {
    result: "pass",
    mandatoryChecks: {
      canonicalRecordSetEqual: true,
      availableAgentCohortContractManifestEqual: true,
      canonicalMetainfoEqual: true,
      boundIdentityEqual: true,
    },
    recordCount: released.records.length,
    physicalEventCount: new Set(
      released.records.map((record) => eventKey(record.physicalEvent)),
    ).size,
    egoRowsByAgent: Object.fromEntries(
      VEHICLE_EGO_IDS.map((egoAgentId) => [
        egoAgentId,
        released.records.filter((record) =>
          record.egoAgentId === egoAgentId).length,
      ]),
    ),
  };
}

function errorResult(error) {
  ensure(
    error instanceof PreflightError,
    "NEGATIVE_CONTROL_DID_NOT_FAIL_CLOSED",
    "negative control raised a non-preflight error",
    { name: error?.name, message: error?.message },
  );
  return {
    status: "passed",
    observedCode: error.code,
    witness: error.witness,
  };
}

function expectFailure(id, callback, expectedCode = null) {
  try {
    callback();
  } catch (error) {
    const result = errorResult(error);
    if (expectedCode) {
      exactValue(
        result.observedCode,
        expectedCode,
        "NEGATIVE_CONTROL_WRONG_FAILURE",
        `negative control ${id} failure code`,
      );
    }
    return { id, ...result };
  }
  fail(
    "NEGATIVE_CONTROL_DID_NOT_FAIL_CLOSED",
    `negative control ${id} unexpectedly passed`,
    { id },
  );
}

function rebuildProjection(projection, overrides = {}) {
  return createProjection({
    role: overrides.role ?? projection.role,
    records: overrides.records ?? projection.records,
    rawMetainfo: overrides.rawMetainfo ?? projection.rawMetainfo,
    canonicalMetainfo:
      overrides.canonicalMetainfo ?? projection.canonicalMetainfo,
    boundIdentity: overrides.boundIdentity ?? projection.boundIdentity,
    provenance: overrides.provenance ?? projection.provenance,
  });
}

export function parsePinnedJson(buffer, expectedSha256, role) {
  const actualSha256 = sha256(buffer);
  exactValue(
    actualSha256,
    expectedSha256,
    "SOURCE_ARTIFACT_HASH_MISMATCH",
    `${role} artifact SHA-256`,
  );
  let value;
  try {
    value = JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    fail("SOURCE_ARTIFACT_PARSE_FAILURE", `${role} artifact is not valid JSON`, {
      role,
      message: error.message,
    });
  }
  return { value, sha256: actualSha256, bytes: buffer.length };
}

export function readPinnedArtifacts({
  releaseArtifactPath = DEFAULT_RELEASE_ARTIFACT,
  generatorArtifactPath = DEFAULT_GENERATOR_ARTIFACT,
} = {}) {
  const releasedBuffer = readFileSync(releaseArtifactPath);
  const generatorBuffer = readFileSync(generatorArtifactPath);
  const released = parsePinnedJson(
    releasedBuffer,
    PINNED_ARTIFACTS.released.sha256,
    "released",
  );
  const generator = parsePinnedJson(
    generatorBuffer,
    PINNED_ARTIFACTS.generator.sha256,
    "generator",
  );
  return {
    released: {
      ...released,
      path: resolve(releaseArtifactPath),
      buffer: releasedBuffer,
    },
    generator: {
      ...generator,
      path: resolve(generatorArtifactPath),
      buffer: generatorBuffer,
    },
  };
}

function buildNegativeControls({
  artifacts,
  releasedProjection,
  generatorProjection,
}) {
  const firstGeneratorRecord = generatorProjection.records[0];
  const injectedRecord = canonicalRecord({
    physicalEvent: firstGeneratorRecord.physicalEvent,
    egoAgentId: "0",
    availableAgentCohortContractIds: ["1", "2", "3"],
  });
  const controls = [];

  controls.push(expectFailure("source-artifact-hash-mutation", () => {
    const mutated = Buffer.from(artifacts.generator.buffer);
    mutated[Math.floor(mutated.length / 2)] ^= 0x01;
    parsePinnedJson(
      mutated,
      PINNED_ARTIFACTS.generator.sha256,
      "mutated-generator",
    );
  }, "SOURCE_ARTIFACT_HASH_MISMATCH"));

  controls.push(expectFailure("ego-injection", () => {
    const injected = rebuildProjection(generatorProjection, {
      records: [...generatorProjection.records, injectedRecord],
    });
    runMandatoryGate(releasedProjection, injected);
  }, "CANONICAL_RECORD_SET_MISMATCH"));

  controls.push(expectFailure("ego-drop", () => {
    const dropped = rebuildProjection(generatorProjection, {
      records: generatorProjection.records.slice(1),
    });
    runMandatoryGate(releasedProjection, dropped);
  }, "CANONICAL_RECORD_SET_MISMATCH"));

  controls.push(expectFailure("cohort-mutation", () => {
    const records = clone(generatorProjection.records);
    records[0].availableAgentCohortContractIds =
      records[0].availableAgentCohortContractIds.slice(1);
    const mutated = rebuildProjection(generatorProjection, { records });
    runMandatoryGate(releasedProjection, mutated);
  }, "AVAILABLE_AGENT_COHORT_CONTRACT_MISMATCH"));

  controls.push(expectFailure("metainfo-mutation", () => {
    const canonicalMetainfo = clone(generatorProjection.canonicalMetainfo);
    canonicalMetainfo.dataset = "mutated";
    const mutated = rebuildProjection(generatorProjection, {
      canonicalMetainfo,
    });
    runMandatoryGate(releasedProjection, mutated);
  }, "METAINFO_MISMATCH"));

  controls.push(expectFailure("raw-metainfo-alias-input-mutation", () => {
    const mutatedArtifact = clone(artifacts.generator.value);
    mutatedArtifact.restrictedGeneratedIndexInspection.metainfo.dataset =
      "OPV2V";
    deriveGeneratorProjection(mutatedArtifact);
  }, "METAINFO_SOURCE_MISMATCH"));

  controls.push(expectFailure("duplicate-key", () => {
    rebuildProjection(generatorProjection, {
      records: [
        ...generatorProjection.records,
        clone(generatorProjection.records[0]),
      ],
    });
  }, "DUPLICATE_KEY"));

  controls.push(expectFailure("wrong-fixed-converter-commit", () => {
    const mutatedArtifact = clone(artifacts.generator.value);
    mutatedArtifact.fixedPublicConverter.fixedCommit = "0".repeat(40);
    deriveGeneratorProjection(mutatedArtifact);
  }, "WRONG_FIXED_COMMIT"));

  controls.push(expectFailure("one-sided-projection", () => {
    runMandatoryGate(releasedProjection, releasedProjection);
  }, "ONE_SIDED_PROJECTION"));

  return controls;
}

function relativePath(path) {
  return relative(REPOSITORY_ROOT, path);
}

function requireGeneratedAt(value) {
  ensure(
    typeof value === "string"
      && value.length > 0
      && Number.isFinite(Date.parse(value)),
    "SCHEMA_VIOLATION",
    "--generated-at must be an ISO-compatible timestamp",
    { value },
  );
  return value;
}

export function verifyCertificate(certificate) {
  const payload = clone(certificate);
  const observed = payload.certificateSha256;
  delete payload.certificateSha256;
  requireSha256(observed, "certificate.certificateSha256");
  exactValue(
    observed,
    canonicalDigest(payload),
    "CERTIFICATE_HASH_MISMATCH",
    "certificate content address",
  );
  return true;
}

export function buildCertificate({
  artifacts,
  generatedAt,
  scriptPath = SCRIPT_PATH,
  testPath = TEST_PATH,
}) {
  requireGeneratedAt(generatedAt);
  const releasedProjection = deriveReleasedProjection(
    artifacts.released.value,
    { artifactSha256: artifacts.released.sha256 },
  );
  const generatorProjection = deriveGeneratorProjection(
    artifacts.generator.value,
    { artifactSha256: artifacts.generator.sha256 },
  );
  const passingGate = runMandatoryGate(
    releasedProjection,
    generatorProjection,
  );
  const fullReleasedProjection = deriveReleasedProjection(
    artifacts.released.value,
    {
      artifactSha256: artifacts.released.sha256,
      scope: "full-released",
    },
  );
  let fullReleasedProbe;
  try {
    runMandatoryGate(fullReleasedProjection, generatorProjection);
    fail(
      "NEGATIVE_CONTROL_DID_NOT_FAIL_CLOSED",
      "full released population unexpectedly matched the current generator",
    );
  } catch (error) {
    const observed = errorResult(error);
    exactValue(
      observed.observedCode,
      "CANONICAL_RECORD_SET_MISMATCH",
      "NEGATIVE_CONTROL_WRONG_FAILURE",
      "full released population failure code",
    );
    fullReleasedProbe = {
      result: "fail",
      exitSemantics:
        "runMandatoryGate throws PreflightError and the CLI exits non-zero",
      ...observed,
    };
  }

  const negativeControls = buildNegativeControls({
    artifacts,
    releasedProjection,
    generatorProjection,
  });
  const rawMetainfoDifference = firstObjectDifference(
    releasedProjection.rawMetainfo,
    generatorProjection.rawMetainfo,
  );
  exactValue(
    rawMetainfoDifference,
    {
      path: "$.dataset",
      released: "OPV2V",
      generator: "CooperScene",
    },
    "METAINFO_SOURCE_MISMATCH",
    "pinned raw metainfo mismatch witness",
  );
  const payload = {
    schemaVersion: CERTIFICATE_SCHEMA_VERSION,
    certificateId:
      "cooperative-autonomous-driving-release-population-preflight-v6",
    certificateType:
      "fail-closed-content-addressed-release-population-preflight",
    generatedAt,
    result:
      "vehicle-ego-key-and-available-agent-contract-replayable-under-pinned-"
      + "preflight",
    sourceArtifacts: {
      released: {
        path: relativePath(artifacts.released.path),
        bytes: artifacts.released.bytes,
        sha256: artifacts.released.sha256,
        expectedSha256: PINNED_ARTIFACTS.released.sha256,
      },
      generator: {
        path: relativePath(artifacts.generator.path),
        bytes: artifacts.generator.bytes,
        sha256: artifacts.generator.sha256,
        expectedSha256: PINNED_ARTIFACTS.generator.sha256,
      },
    },
    canonicalContracts: {
      certificateSchemaVersion: CERTIFICATE_SCHEMA_VERSION,
      recordSchemaVersion: RECORD_SCHEMA_VERSION,
      bindingSchemaVersion: BINDING_SCHEMA_VERSION,
      metainfoSchemaVersion: METAINFO_SCHEMA_VERSION,
      split: SPLIT,
      fixedConverterCommit: FIXED_CONVERTER_COMMIT,
      keySchema: [
        "split",
        "physicalEvent.scenario",
        "physicalEvent.timestamp",
        "egoAgentId",
      ],
      availableAgentCohortContractSchema: [
        "canonicalKey",
        "sortedUniqueAvailableAgentCohortContractIds",
      ],
      availableAgentCohortContractBoundary: {
        released:
          "derived from the v4 official event manifest after its restricted "
          + "release-population key and source-identity bridge is verified",
        generator:
          "derived without reading v4 records, from v5 actual generated "
          + "event/ego keys under the pinned fixed four-agent mini "
          + "materialization contract",
        limitation:
          "v5 retains generated keys and restricted population summaries, not "
          + "the per-row cooperator arrays; this is available-agent contract "
          + "replay, not actual generated-cooperator, row-payload, or annotation "
          + "equality",
      },
      ordering:
        "ascending UTF-16 code-unit order of canonical "
        + "split/scenario/timestamp/ego keys",
      uniqueness: "exactly one record per canonical key",
      canonicalAgentIds: CANONICAL_AGENT_IDS,
      vehicleEgoIds: VEHICLE_EGO_IDS,
      metainfoNormalization: {
        policy: CANONICAL_METAINFO.normalizationPolicy,
        releasedRawDatasetLabelRequired: RELEASE_RAW_METAINFO.dataset,
        generatorRawDatasetLabelRequired: GENERATOR_RAW_METAINFO.dataset,
        canonicalDatasetLabel: CANONICAL_METAINFO.dataset,
        boundary:
          "The raw mismatch remains recorded as a failed equality observation. "
          + "This exact alias is accepted only under the two pinned artifact "
          + "hashes and exact OPV2V/CooperScene label pair; all other raw "
          + "metainfo fields remain exact and mutations fail closed.",
      },
    },
    metainfoComparison: {
      rawMetainfoEquality: {
        result: "fail",
        equal: false,
        witness: rawMetainfoDifference,
      },
      aliasApplication: {
        applied: true,
        policy: CANONICAL_METAINFO.normalizationPolicy,
        allowedOnlyForSourceArtifactSha256: {
          released: artifacts.released.sha256,
          generator: artifacts.generator.sha256,
        },
        exactRawDatasetLabelPair: {
          released: RELEASE_RAW_METAINFO.dataset,
          generator: GENERATOR_RAW_METAINFO.dataset,
        },
        canonicalMetainfoEqualAfterAlias: true,
        silentMismatchSuppression: false,
      },
    },
    mandatoryGate: {
      scope: "current-vehicle-ego-subpopulation",
      rule:
        "pass only when canonical record set, available-agent cohort contract "
        + "manifest, canonical metainfo after the explicit pinned alias, and "
        + "bound identity are all equal",
      ...passingGate,
    },
    projections: {
      releasedVehicleEgos: releasedProjection,
      fixedConverterExecutionVehicleEgoAvailableAgentContract:
        generatorProjection,
    },
    fullReleasedPopulationProbe: fullReleasedProbe,
    negativeControls,
    conclusions: {
      supported: [
        "For the pinned mini test evidence, the actually executed fixed public "
          + "converter reproduces the 30-event, 90-record vehicle-ego key set. "
          + "The two independently derived available-agent cohort contracts, "
          + "explicitly aliased canonical metainfo, split, and bound identities "
          + "also match.",
        "The complete released 120-record population is not equal to the current "
          + "90-record generator population; each of the 30 events has one "
          + "released-only ego-0 record.",
      ],
      unsupported: [
        "No AP, benchmark metric, model output, ranking, paper result, or "
          + "performance direction is read or inferred.",
        "No historical generator for the released pickle is identified.",
        "No full-release population consistency is claimed.",
        "No equality of actual per-row generated cooperatorAgentIds is claimed; "
          + "v5 did not persist those rows or a cooperator manifest.",
        "No raw metainfo equality is claimed; the pinned raw dataset labels are "
          + "OPV2V and CooperScene and are explicitly unequal.",
        "No annotation, bounding-box, point-cloud, image, or byte-for-byte "
          + "pickle parity is claimed.",
      ],
    },
    blockedClaims: {
      actualGeneratedCooperatorManifestParity: {
        status: "blocked",
        reason:
          "The v5 restricted parser extracted cooperatorAgentIds while the "
          + "temporary generated pickle existed, but restrictedGeneratedIndex"
          + "Inspection did not persist row-level cooperator IDs or a cooperator "
          + "manifest, and the temporary generated pickle was removed.",
        requiredEvidence:
          "A new independent fixed-converter execution that persists a "
          + "content-addressed generated cooperator manifest without sourcing "
          + "cooperators from the released projection.",
        prohibitedInference:
          "availableAgentCohortContractIds must not be described as actual "
          + "generated cooperators.",
      },
    },
    integrityBoundary: {
      mechanism:
        "SHA-256 content address over every certificate field except "
        + "certificateSha256 itself",
      statement:
        "This is a local integrity proof for pinned evidence and canonical "
        + "manifests. It is not an author, publisher, dataset-owner, or official "
        + "identity signature.",
      signature: "none",
    },
    reproducibility: {
      runner: {
        path: relativePath(scriptPath),
        sha256: sha256(readFileSync(scriptPath)),
      },
      test: {
        path: relativePath(testPath),
        sha256: sha256(readFileSync(testPath)),
      },
      passingCommand:
        "node scripts/idea-pilots/release-population-preflight.mjs "
        + `--generated-at ${generatedAt} --output `
        + "content/idea-audits/"
        + "cooperative-autonomous-driving-release-population-preflight-v6.json",
      failingFullPopulationCommand:
        "node scripts/idea-pilots/release-population-preflight.mjs "
        + "--scope full-released",
      outputContract:
        "passing scope emits certificate JSON; any mismatch emits a structured "
        + "PreflightError JSON witness on stderr and exits non-zero",
    },
  };
  const certificate = {
    ...payload,
    certificateSha256: canonicalDigest(payload),
  };
  verifyCertificate(certificate);
  return certificate;
}

function parseArgs(argv) {
  const options = {
    releaseArtifactPath: DEFAULT_RELEASE_ARTIFACT,
    generatorArtifactPath: DEFAULT_GENERATOR_ARTIFACT,
    output: null,
    generatedAt: new Date().toISOString(),
    scope: "vehicle-egos",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    if (option === "--release-artifact") {
      options.releaseArtifactPath = resolve(value);
    } else if (option === "--generator-artifact") {
      options.generatorArtifactPath = resolve(value);
    } else if (option === "--output") {
      options.output = resolve(value);
    } else if (option === "--generated-at") {
      options.generatedAt = value;
    } else if (option === "--scope") {
      options.scope = value;
    } else {
      fail("CLI_USAGE", `unknown option: ${option}`, { option });
    }
    index += 1;
  }
  ensure(
    options.scope === "vehicle-egos" || options.scope === "full-released",
    "CLI_USAGE",
    "--scope must be vehicle-egos or full-released",
    { scope: options.scope },
  );
  return options;
}

export function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const artifacts = readPinnedArtifacts(options);
  if (options.scope === "full-released") {
    const released = deriveReleasedProjection(artifacts.released.value, {
      artifactSha256: artifacts.released.sha256,
      scope: "full-released",
    });
    const generator = deriveGeneratorProjection(artifacts.generator.value, {
      artifactSha256: artifacts.generator.sha256,
    });
    runMandatoryGate(released, generator);
    fail(
      "FAIL_CLOSED_INVARIANT",
      "full-released scope unexpectedly passed",
    );
  }
  const certificate = buildCertificate({
    artifacts,
    generatedAt: options.generatedAt,
  });
  const output = `${JSON.stringify(certificate, null, 2)}\n`;
  if (options.output) writeFileSync(options.output, output);
  process.stdout.write(output);
  return certificate;
}

function formatCliError(error) {
  if (error instanceof PreflightError) {
    return {
      result: "fail",
      error: {
        name: error.name,
        code: error.code,
        message: error.message,
        witness: error.witness,
      },
    };
  }
  return {
    result: "fail",
    error: {
      name: error?.name ?? "Error",
      code: "UNEXPECTED_ERROR",
      message: error?.message ?? String(error),
      witness: null,
    },
  };
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${JSON.stringify(formatCliError(error), null, 2)}\n`);
    process.exitCode = 1;
  }
}
