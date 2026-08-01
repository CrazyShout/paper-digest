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

import {
  CERTIFICATE_SCHEMA_VERSION as GENERATOR_CERTIFICATE_SCHEMA_VERSION,
  FIXED_COMMIT,
  RECORD_SCHEMA_VERSION,
  verifyEvidence as verifyGeneratorEvidence,
} from "./cooperscene-converter-cohort-smoke-v7.mjs";
import {
  inspectReleasedPickle,
} from "./cooperscene-release-lineage.mjs";

export { FIXED_COMMIT };
export const CERTIFICATE_SCHEMA_VERSION =
  "cooperative-perception-release-population-actual-cooperator-preflight/v7";
export const PROJECTION_SCHEMA_VERSION =
  "cooperative-perception-actual-cooperator-projection/v1";
export const BINDING_SCHEMA_VERSION =
  "cooperative-perception-release-binding/v2";
export const METAINFO_SCHEMA_VERSION =
  "cooperative-perception-metainfo/v1";
export const SPLIT = "test";
export const VEHICLE_EGO_IDS = Object.freeze(["1", "2", "3"]);
export const CANONICAL_AGENT_IDS = Object.freeze(["0", "1", "2", "3"]);

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(SCRIPT_PATH), "../..");
const DEFAULT_RELEASE_LINEAGE_ARTIFACT = resolve(
  REPOSITORY_ROOT,
  "content/idea-audits/"
    + "cooperative-autonomous-driving-release-population-lineage-pilot-v4.json",
);
const DEFAULT_GENERATOR_ARTIFACT = resolve(
  REPOSITORY_ROOT,
  "content/idea-audits/"
    + "cooperative-autonomous-driving-converter-cohort-execution-v7.json",
);
const DEFAULT_RELEASED_PICKLE = "/private/tmp/cooperscene-mini-test.pkl";
const DEFAULT_OUTPUT = resolve(
  REPOSITORY_ROOT,
  "content/idea-audits/"
    + "cooperative-autonomous-driving-release-population-preflight-v7.json",
);
const TEST_PATH = resolve(
  REPOSITORY_ROOT,
  "test/release-population-preflight-v7.test.mjs",
);

export const PINNED_ARTIFACTS = Object.freeze({
  releaseLineage: Object.freeze({
    path: DEFAULT_RELEASE_LINEAGE_ARTIFACT,
    bytes: 207361,
    sha256:
      "b745c3acf8f3cc579ee6ba57698874f9d3d8ac639149d2a7867e6cc99906f62e",
  }),
  generator: Object.freeze({
    path: DEFAULT_GENERATOR_ARTIFACT,
    bytes: 42578,
    sha256:
      "7aa77053030492bf2f633f7917fc964ca824934fc833d01e4dc30c532298ca03",
  }),
  releasedPickle: Object.freeze({
    path: DEFAULT_RELEASED_PICKLE,
    bytes: 182702,
    sha256:
      "d1d6c1f74f1159f99098534c5243a7e59722a2820d514394805c597a0a312789",
  }),
});

const RELEASED_RAW_METAINFO = Object.freeze({
  categories: { vehicle: 0 },
  classes: ["vehicle"],
  cooperative: true,
  dataset: "OPV2V",
  info_version: "1.0",
});
const GENERATED_RAW_METAINFO = Object.freeze({
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
const KEY_COMPONENT = /^[A-Za-z0-9_.-]+$/;
const HEX_SHA256 = /^[0-9a-f]{64}$/;

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

function clone(value) {
  return structuredClone(value);
}

function deepEqual(left, right) {
  return stableJson(left) === stableJson(right);
}

function exact(actual, expected, code, location) {
  ensure(
    deepEqual(actual, expected),
    code,
    `${location} does not match the pinned contract`,
    { location, expected, actual },
  );
}

function exactKeys(value, expected, location) {
  ensure(
    value && typeof value === "object" && !Array.isArray(value),
    "SCHEMA_VIOLATION",
    `${location} must be an object`,
    { location },
  );
  exact(
    Object.keys(value).sort(),
    [...expected].sort(),
    "SCHEMA_VIOLATION",
    `${location} keys`,
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

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function eventKey(record) {
  return [
    record.physicalEvent.scenario,
    record.physicalEvent.timestamp,
  ].join("/");
}

export function recordKey(record) {
  return [
    record.split,
    eventKey(record),
    record.egoAgentId,
  ].join("/");
}

function compareRecords(left, right) {
  return recordKey(left).localeCompare(recordKey(right));
}

function canonicalRecord(row) {
  const scenario = canonicalComponent(
    row.scenario ?? row.physicalEvent?.scenario,
    "record.physicalEvent.scenario",
  );
  const timestamp = canonicalComponent(
    row.timestamp ?? row.physicalEvent?.timestamp,
    "record.physicalEvent.timestamp",
  );
  const egoAgentId = canonicalComponent(
    row.egoAgentId,
    "record.egoAgentId",
  );
  ensure(
    Array.isArray(
      row.cooperatorAgentIds ?? row.actualCooperatorAgentIds,
    ),
    "SCHEMA_VIOLATION",
    "record actual cooperator IDs must be an array",
  );
  const actualCooperatorAgentIds = (
    row.cooperatorAgentIds ?? row.actualCooperatorAgentIds
  ).map((agentId, index) => canonicalComponent(
    agentId,
    `record.actualCooperatorAgentIds[${index}]`,
  )).sort();
  return {
    schemaVersion: RECORD_SCHEMA_VERSION,
    split: SPLIT,
    physicalEvent: { scenario, timestamp },
    egoAgentId,
    actualCooperatorAgentIds,
  };
}

function projectionManifests(
  records,
  rawMetainfo,
  canonicalMetainfo,
  boundIdentity,
) {
  const keys = records.map(recordKey);
  const cooperators = records.map((record) => ({
    key: recordKey(record),
    actualCooperatorAgentIds: record.actualCooperatorAgentIds,
  }));
  return {
    keyManifestSha256: canonicalDigest(keys),
    actualCooperatorManifestSha256: canonicalDigest(cooperators),
    recordManifestSha256: canonicalDigest(records),
    rawMetainfoManifestSha256: canonicalDigest(rawMetainfo),
    canonicalMetainfoManifestSha256: canonicalDigest(canonicalMetainfo),
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
    projectionSchemaVersion: PROJECTION_SCHEMA_VERSION,
    recordSchemaVersion: RECORD_SCHEMA_VERSION,
    role,
    split: SPLIT,
    records: canonicalRecords,
    rawMetainfo: clone(rawMetainfo),
    canonicalMetainfo: clone(canonicalMetainfo),
    boundIdentity: clone(boundIdentity),
    manifests: projectionManifests(
      canonicalRecords,
      rawMetainfo,
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
      "projectionSchemaVersion",
      "recordSchemaVersion",
      "role",
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
  exact(
    projection.projectionSchemaVersion,
    PROJECTION_SCHEMA_VERSION,
    "SCHEMA_VERSION_MISMATCH",
    "projection schema",
  );
  exact(
    projection.recordSchemaVersion,
    RECORD_SCHEMA_VERSION,
    "SCHEMA_VERSION_MISMATCH",
    "projection record schema",
  );
  exact(projection.split, SPLIT, "SPLIT_MISMATCH", "projection split");
  if (expectedRole) {
    exact(
      projection.role,
      expectedRole,
      "ONE_SIDED_PROJECTION",
      "projection role",
    );
  }
  ensure(
    Array.isArray(projection.records) && projection.records.length > 0,
    "SCHEMA_VIOLATION",
    "projection records must be a non-empty array",
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
        "actualCooperatorAgentIds",
      ],
      `projection.records[${index}]`,
    );
    exactKeys(
      record.physicalEvent,
      ["scenario", "timestamp"],
      `projection.records[${index}].physicalEvent`,
    );
    exact(
      record.schemaVersion,
      RECORD_SCHEMA_VERSION,
      "SCHEMA_VERSION_MISMATCH",
      `projection.records[${index}].schemaVersion`,
    );
    exact(
      record.split,
      SPLIT,
      "SPLIT_MISMATCH",
      `projection.records[${index}].split`,
    );
    exact(
      record.actualCooperatorAgentIds,
      sortedUnique(record.actualCooperatorAgentIds),
      "NON_CANONICAL_ACTUAL_COOPERATORS",
      `${recordKey(record)} actual cooperator IDs`,
    );
    ensure(
      !record.actualCooperatorAgentIds.includes(record.egoAgentId),
      "NON_CANONICAL_ACTUAL_COOPERATORS",
      "ego agent must not occur in its actual cooperator set",
      { key: recordKey(record), egoAgentId: record.egoAgentId },
    );
    const key = recordKey(record);
    if (firstIndexByKey.has(key)) {
      fail("DUPLICATE_KEY", "projection contains a duplicate key", {
        key,
        firstIndex: firstIndexByKey.get(key),
        duplicateIndex: index,
      });
    }
    firstIndexByKey.set(key, index);
    keys.push(key);
  }
  exact(
    keys,
    [...keys].sort((left, right) => left.localeCompare(right)),
    "NON_CANONICAL_SORT",
    "projection key order",
  );
  exact(
    projection.manifests,
    projectionManifests(
      projection.records,
      projection.rawMetainfo,
      projection.canonicalMetainfo,
      projection.boundIdentity,
    ),
    "MANIFEST_MISMATCH",
    "projection manifests",
  );
  return projection;
}

function canonicalizeMetainfo(raw, role) {
  const expected = role === "released"
    ? RELEASED_RAW_METAINFO
    : GENERATED_RAW_METAINFO;
  exact(
    raw,
    expected,
    "METAINFO_SOURCE_MISMATCH",
    `${role} raw metainfo`,
  );
  return clone(CANONICAL_METAINFO);
}

function artifactIdentity(items, role, location) {
  ensure(
    Array.isArray(items),
    "BOUND_IDENTITY_MISMATCH",
    `${location} must be an array`,
  );
  const matches = items.filter((identity) => identity.role === role);
  ensure(
    matches.length === 1,
    "BOUND_IDENTITY_MISMATCH",
    `${location} must contain exactly one ${role}`,
    { role, count: matches.length },
  );
  return matches[0];
}

function commonBoundIdentity({
  releaseLineageArtifactSha256,
  centralInventorySha256,
  officialArchivePrefixSha256,
  releasedTestIndexSha256,
  fixedConverterCommit,
}) {
  return {
    schemaVersion: BINDING_SCHEMA_VERSION,
    split: SPLIT,
    releaseLineageArtifactSha256:
      requireSha256(
        releaseLineageArtifactSha256,
        "release lineage artifact SHA-256",
      ),
    centralInventorySha256:
      requireSha256(centralInventorySha256, "central inventory SHA-256"),
    officialArchivePrefixSha256:
      requireSha256(
        officialArchivePrefixSha256,
        "official archive prefix SHA-256",
      ),
    releasedTestIndexSha256:
      requireSha256(
        releasedTestIndexSha256,
        "released test index SHA-256",
      ),
    fixedConverterCommit,
  };
}

function validateReleaseLineage(artifact, artifactSha256) {
  exact(
    artifactSha256,
    PINNED_ARTIFACTS.releaseLineage.sha256,
    "SOURCE_ARTIFACT_HASH_MISMATCH",
    "release lineage artifact SHA-256",
  );
  exact(artifact.schemaVersion, 1, "SCHEMA_VERSION_MISMATCH",
    "release lineage schema");
  exact(
    artifact.certificateId,
    "cooperative-autonomous-driving-release-population-lineage-pilot-v4",
    "SCHEMA_VIOLATION",
    "release lineage certificate ID",
  );
  const inspection = artifact.releasedTestIndex;
  exact(
    inspection.safetyBoundary.classLookupPolicy,
    "deny-all",
    "RESTRICTED_PARSE_EVIDENCE_MISSING",
    "v4 released parser class lookup policy",
  );
  exact(
    inspection.archiveMemberIdentityVerification.deserializedInThisPilot,
    true,
    "RESTRICTED_PARSE_EVIDENCE_MISSING",
    "v4 released pickle deserialization",
  );
  exact(
    inspection.pickleSha256,
    PINNED_ARTIFACTS.releasedPickle.sha256,
    "BOUND_IDENTITY_MISMATCH",
    "v4 released pickle SHA-256",
  );
  const fixedCommit = artifact.publicGeneratorStaticEvidence
    .inspectedHead.identity.commit.commit;
  exact(
    fixedCommit,
    FIXED_COMMIT,
    "WRONG_FIXED_COMMIT",
    "v4 fixed converter commit",
  );
  const central = artifactIdentity(
    artifact.inputIdentities,
    "central-directory-inventory",
    "v4 input identities",
  );
  const archive = artifactIdentity(
    artifact.inputIdentities,
    "official-archive-prefix",
    "v4 input identities",
  );
  const released = artifactIdentity(
    artifact.inputIdentities,
    "released-test-index",
    "v4 input identities",
  );
  exact(
    released.sha256,
    PINNED_ARTIFACTS.releasedPickle.sha256,
    "BOUND_IDENTITY_MISMATCH",
    "v4 released test index identity",
  );
  return {
    fixedCommit,
    centralInventorySha256: central.sha256,
    officialArchivePrefixSha256: archive.sha256,
    releasedTestIndexSha256: released.sha256,
    releasedPayloadSha256: inspection.payloadSha256,
    v4RestrictedParser: clone(inspection.safetyBoundary),
  };
}

function validateActualRows(records, expectedEgoIds, location) {
  const egoRowsByAgent = Object.fromEntries(expectedEgoIds.map((ego) => [
    ego,
    records.filter((record) => record.egoAgentId === ego).length,
  ]));
  const expectedRowsPerEgo = records.length / expectedEgoIds.length;
  exact(
    egoRowsByAgent,
    Object.fromEntries(expectedEgoIds.map((ego) => [ego, expectedRowsPerEgo])),
    "POPULATION_MISMATCH",
    `${location} ego distribution`,
  );
  for (const record of records) {
    ensure(
      expectedEgoIds.includes(record.egoAgentId),
      "POPULATION_MISMATCH",
      `${location} contains an unexpected ego`,
      { key: recordKey(record) },
    );
    exact(
      record.actualCooperatorAgentIds,
      CANONICAL_AGENT_IDS.filter(
        (agentId) => agentId !== record.egoAgentId,
      ),
      "ACTUAL_COOPERATOR_SET_MISMATCH",
      `${location} ${recordKey(record)} actual cooperator set`,
    );
  }
  return egoRowsByAgent;
}

export function deriveReleasedProjection({
  releaseLineageArtifact,
  releaseLineageArtifactSha256 =
    PINNED_ARTIFACTS.releaseLineage.sha256,
  releasedInspection,
  releasedPickleSha256 = PINNED_ARTIFACTS.releasedPickle.sha256,
  scope = "vehicle-egos",
}) {
  exact(
    releasedPickleSha256,
    PINNED_ARTIFACTS.releasedPickle.sha256,
    "SOURCE_ARTIFACT_HASH_MISMATCH",
    "released pickle SHA-256",
  );
  const lineage = validateReleaseLineage(
    releaseLineageArtifact,
    releaseLineageArtifactSha256,
  );
  exact(
    releasedInspection.pickleSha256,
    releasedPickleSha256,
    "BOUND_IDENTITY_MISMATCH",
    "independently parsed released pickle SHA-256",
  );
  exact(
    releasedInspection.payloadSha256,
    lineage.releasedPayloadSha256,
    "BOUND_IDENTITY_MISMATCH",
    "independently parsed released payload SHA-256",
  );
  exact(
    releasedInspection.classLookupPolicy,
    "deny-all",
    "RESTRICTED_PARSE_EVIDENCE_MISSING",
    "current released parser class lookup policy",
  );
  exact(
    releasedInspection.metainfo,
    RELEASED_RAW_METAINFO,
    "METAINFO_SOURCE_MISMATCH",
    "released pickle raw metainfo",
  );
  ensure(
    scope === "vehicle-egos" || scope === "full-released",
    "SCHEMA_VIOLATION",
    "released scope must be vehicle-egos or full-released",
    { scope },
  );
  const allRecords = releasedInspection.rows.map(canonicalRecord);
  exact(
    allRecords.length,
    120,
    "POPULATION_MISMATCH",
    "released full row count",
  );
  exact(
    new Set(allRecords.map(eventKey)).size,
    30,
    "POPULATION_MISMATCH",
    "released physical-event count",
  );
  validateActualRows(
    allRecords,
    CANONICAL_AGENT_IDS,
    "released pickle",
  );
  const records = scope === "vehicle-egos"
    ? allRecords.filter((record) =>
      VEHICLE_EGO_IDS.includes(record.egoAgentId))
    : allRecords;
  return createProjection({
    role: "released",
    records,
    rawMetainfo: releasedInspection.metainfo,
    canonicalMetainfo: canonicalizeMetainfo(
      releasedInspection.metainfo,
      "released",
    ),
    boundIdentity: commonBoundIdentity({
      releaseLineageArtifactSha256,
      centralInventorySha256: lineage.centralInventorySha256,
      officialArchivePrefixSha256: lineage.officialArchivePrefixSha256,
      releasedTestIndexSha256: lineage.releasedTestIndexSha256,
      fixedConverterCommit: lineage.fixedCommit,
    }),
    provenance: {
      sourceArtifactRole: "released-test-pickle-restricted-parse-v7",
      sourceArtifactSha256: releasedPickleSha256,
      supportingReleaseLineageArtifactSha256:
        releaseLineageArtifactSha256,
      projectionScope: scope,
      actualCooperatorDerivation:
        "directly from each independently restricted-parsed released pickle "
        + "row's cooperators[].agent_id values; no generated records, v4 "
        + "event-manifest cohort, or available-agent substitution",
      parser: {
        classLookupPolicy: releasedInspection.classLookupPolicy,
        plainValuePolicy: releasedInspection.plainValuePolicy,
        protocol: releasedInspection.protocol,
        payloadSha256: releasedInspection.payloadSha256,
      },
    },
  });
}

function translateGeneratorVerification(callback) {
  try {
    return callback();
  } catch (error) {
    fail(
      error?.code ?? "GENERATOR_EVIDENCE_INVALID",
      error?.message ?? String(error),
      error?.witness ?? null,
    );
  }
}

export function deriveGeneratorProjection(
  artifact,
  {
    artifactSha256 = PINNED_ARTIFACTS.generator.sha256,
  } = {},
) {
  exact(
    artifactSha256,
    PINNED_ARTIFACTS.generator.sha256,
    "SOURCE_ARTIFACT_HASH_MISMATCH",
    "generator artifact SHA-256",
  );
  exact(
    artifact.schemaVersion,
    GENERATOR_CERTIFICATE_SCHEMA_VERSION,
    "SCHEMA_VERSION_MISMATCH",
    "generator certificate schema",
  );
  exact(
    artifact.certificateId,
    "cooperative-autonomous-driving-converter-cohort-execution-v7",
    "SCHEMA_VIOLATION",
    "generator certificate ID",
  );
  exact(
    artifact.fixedPublicConverter.fixedCommit,
    FIXED_COMMIT,
    "WRONG_FIXED_COMMIT",
    "generator fixed converter commit",
  );
  exact(
    artifact.fixedPublicConverter.checkoutHead,
    FIXED_COMMIT,
    "WRONG_FIXED_COMMIT",
    "generator checkout HEAD",
  );
  translateGeneratorVerification(() => verifyGeneratorEvidence(artifact));
  exact(
    artifact.artifactBindings.releaseLineageCertificateSha256,
    PINNED_ARTIFACTS.releaseLineage.sha256,
    "BOUND_IDENTITY_MISMATCH",
    "generator release lineage binding",
  );
  exact(
    artifact.artifactBindings.releasedTestIndexSha256,
    PINNED_ARTIFACTS.releasedPickle.sha256,
    "BOUND_IDENTITY_MISMATCH",
    "generator released pickle binding",
  );
  exact(
    artifact.actualExecution.restrictedPickleInspection.sourceField,
    "data_list[].cooperators[].agent_id",
    "ACTUAL_COOPERATOR_EVIDENCE_MISSING",
    "generator actual cooperator source field",
  );
  exact(
    artifact.observations.releasedProjectionUsedToPopulateCooperators,
    false,
    "ONE_SIDED_PROJECTION",
    "generator released-projection dependency",
  );
  exact(
    artifact.observations.availableAgentSetUsedAsCooperatorSubstitute,
    false,
    "ACTUAL_COOPERATOR_EVIDENCE_MISSING",
    "generator available-agent substitution",
  );
  const records = artifact.generatedCooperatorManifest.records;
  exact(
    records.length,
    90,
    "POPULATION_MISMATCH",
    "generator record count",
  );
  validateActualRows(records, VEHICLE_EGO_IDS, "generated pickle");
  return createProjection({
    role: "generator",
    records,
    rawMetainfo: artifact.rawMetainfo,
    canonicalMetainfo: canonicalizeMetainfo(
      artifact.rawMetainfo,
      "generator",
    ),
    boundIdentity: commonBoundIdentity({
      releaseLineageArtifactSha256:
        artifact.artifactBindings.releaseLineageCertificateSha256,
      centralInventorySha256:
        artifact.artifactBindings.centralInventorySha256,
      officialArchivePrefixSha256:
        artifact.artifactBindings.officialArchivePrefixSha256,
      releasedTestIndexSha256:
        artifact.artifactBindings.releasedTestIndexSha256,
      fixedConverterCommit:
        artifact.artifactBindings.fixedConverterCommit,
    }),
    provenance: {
      sourceArtifactRole:
        "actual-fixed-public-converter-generated-cooperator-manifest-v7",
      sourceArtifactSha256: artifactSha256,
      projectionScope: "actual-generated-vehicle-egos",
      actualCooperatorDerivation:
        "from the v7 content-addressed records independently extracted from "
        + "the newly generated pickle's per-row cooperators[].agent_id; no "
        + "released records or available-agent substitution",
      generatedPickleSha256:
        artifact.artifactBindings.generatedTestPickleSha256,
      generatedPayloadSha256:
        artifact.artifactBindings.generatedPayloadSha256,
      actualCooperatorManifestSha256:
        artifact.generatedCooperatorManifest.manifests
          .actualCooperatorManifestSha256,
    },
  });
}

function populationDifferenceWitness(releasedRecords, generatorRecords) {
  const releasedKeys = new Set(releasedRecords.map(recordKey));
  const generatorKeys = new Set(generatorRecords.map(recordKey));
  const releasedOnly = [...releasedKeys]
    .filter((key) => !generatorKeys.has(key))
    .sort();
  const generatorOnly = [...generatorKeys]
    .filter((key) => !releasedKeys.has(key))
    .sort();
  const perEvent = new Map();
  function add(keys, field) {
    for (const key of keys) {
      const [, scenario, timestamp, egoAgentId] = key.split("/");
      const currentEvent = `${scenario}/${timestamp}`;
      if (!perEvent.has(currentEvent)) {
        perEvent.set(currentEvent, {
          physicalEvent: { scenario, timestamp },
          releasedOnlyEgoAgentIds: [],
          generatorOnlyEgoAgentIds: [],
        });
      }
      perEvent.get(currentEvent)[field].push(egoAgentId);
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
    perEvent: [...perEvent.values()],
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

export function compareProjections(released, generator) {
  validateProjection(released, "released");
  validateProjection(generator, "generator");
  ensure(
    released !== generator
      && released.provenance.sourceArtifactRole
        !== generator.provenance.sourceArtifactRole
      && released.provenance.sourceArtifactSha256
        !== generator.provenance.sourceArtifactSha256,
    "ONE_SIDED_PROJECTION",
    "released and generator projections require distinct evidence producers",
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
    released.manifests.actualCooperatorManifestSha256
    !== generator.manifests.actualCooperatorManifestSha256
  ) {
    const generatorByKey = new Map(generator.records.map((record) => [
      recordKey(record),
      record,
    ]));
    const releasedRecord = released.records.find((record) => {
      const other = generatorByKey.get(recordKey(record));
      return other && !deepEqual(
        record.actualCooperatorAgentIds,
        other.actualCooperatorAgentIds,
      );
    });
    const generatorRecord = releasedRecord
      ? generatorByKey.get(recordKey(releasedRecord))
      : null;
    fail(
      "ACTUAL_COOPERATOR_SET_MISMATCH",
      "released and generator actual per-row cooperator sets differ",
      {
        mismatch: "actual-per-row-cooperator-set",
        key: releasedRecord ? recordKey(releasedRecord) : null,
        released: releasedRecord?.actualCooperatorAgentIds ?? null,
        generator: generatorRecord?.actualCooperatorAgentIds ?? null,
      },
    );
  }
  if (
    released.manifests.canonicalMetainfoManifestSha256
    !== generator.manifests.canonicalMetainfoManifestSha256
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
      "released and generator artifact bindings differ",
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
    passedClaim:
      "90 vehicle-ego key plus actual per-row cooperator semantic parity "
      + "under pinned mini evidence",
    mandatoryChecks: {
      splitEqual: true,
      canonicalRecordKeySetEqual: true,
      actualPerRowCooperatorManifestEqual: true,
      canonicalMetainfoEqualAfterPinnedAlias: true,
      fixedCommitAndArtifactBindingsEqual: true,
    },
    recordCount: released.records.length,
    physicalEventCount: new Set(released.records.map(eventKey)).size,
    egoRowsByAgent: Object.fromEntries(VEHICLE_EGO_IDS.map((ego) => [
      ego,
      released.records.filter((record) => record.egoAgentId === ego).length,
    ])),
  };
}

export function runMandatoryGate(released, generator, inputs) {
  ensure(
    inputs?.releaseLineage?.value
      && inputs?.releasedPickle?.inspection
      && inputs?.generator?.value,
    "UNVERIFIED_PROJECTION",
    "mandatory gate requires the pinned source bundle",
  );
  const releasedScope =
    released?.provenance?.projectionScope === "full-released"
      ? "full-released"
      : "vehicle-egos";
  const expectedReleased = deriveReleasedProjection({
    releaseLineageArtifact: inputs.releaseLineage.value,
    releaseLineageArtifactSha256: inputs.releaseLineage.sha256,
    releasedInspection: inputs.releasedPickle.inspection,
    releasedPickleSha256: inputs.releasedPickle.sha256,
    scope: releasedScope,
  });
  const expectedGenerator = deriveGeneratorProjection(
    inputs.generator.value,
    { artifactSha256: inputs.generator.sha256 },
  );
  ensure(
    deepEqual(released, expectedReleased),
    "UNVERIFIED_PROJECTION",
    "released projection was not derived from the pinned source bytes",
    {
      role: "released",
      expectedProjectionSha256: canonicalDigest(expectedReleased),
      actualProjectionSha256: canonicalDigest(released),
    },
  );
  ensure(
    deepEqual(generator, expectedGenerator),
    "UNVERIFIED_PROJECTION",
    "generator projection was not derived from the pinned source bytes",
    {
      role: "generator",
      expectedProjectionSha256: canonicalDigest(expectedGenerator),
      actualProjectionSha256: canonicalDigest(generator),
    },
  );
  return compareProjections(released, generator);
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

function expectFailure(id, callback, expectedCode) {
  try {
    callback();
  } catch (error) {
    const result = errorResult(error);
    exact(
      result.observedCode,
      expectedCode,
      "NEGATIVE_CONTROL_WRONG_FAILURE",
      `${id} failure code`,
    );
    return { id, ...result };
  }
  fail(
    "NEGATIVE_CONTROL_DID_NOT_FAIL_CLOSED",
    `${id} unexpectedly passed`,
    { id },
  );
}

export function parsePinnedJson(buffer, expectedSha256, role) {
  exact(
    sha256(buffer),
    expectedSha256,
    "SOURCE_ARTIFACT_HASH_MISMATCH",
    `${role} artifact SHA-256`,
  );
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    fail(
      "SOURCE_ARTIFACT_PARSE_FAILURE",
      `${role} artifact is not valid JSON`,
      { role, message: error.message },
    );
  }
}

export function readPinnedInputs({
  releaseLineageArtifactPath = DEFAULT_RELEASE_LINEAGE_ARTIFACT,
  generatorArtifactPath = DEFAULT_GENERATOR_ARTIFACT,
  releasedPicklePath = DEFAULT_RELEASED_PICKLE,
} = {}) {
  const releaseLineageBuffer = readFileSync(releaseLineageArtifactPath);
  const generatorBuffer = readFileSync(generatorArtifactPath);
  const releasedPickleBuffer = readFileSync(releasedPicklePath);
  exact(
    releaseLineageBuffer.length,
    PINNED_ARTIFACTS.releaseLineage.bytes,
    "SOURCE_ARTIFACT_HASH_MISMATCH",
    "release lineage artifact bytes",
  );
  exact(
    generatorBuffer.length,
    PINNED_ARTIFACTS.generator.bytes,
    "SOURCE_ARTIFACT_HASH_MISMATCH",
    "generator artifact bytes",
  );
  exact(
    releasedPickleBuffer.length,
    PINNED_ARTIFACTS.releasedPickle.bytes,
    "SOURCE_ARTIFACT_HASH_MISMATCH",
    "released pickle bytes",
  );
  const releaseLineageArtifact = parsePinnedJson(
    releaseLineageBuffer,
    PINNED_ARTIFACTS.releaseLineage.sha256,
    "release-lineage",
  );
  const generatorArtifact = parsePinnedJson(
    generatorBuffer,
    PINNED_ARTIFACTS.generator.sha256,
    "generator",
  );
  exact(
    sha256(releasedPickleBuffer),
    PINNED_ARTIFACTS.releasedPickle.sha256,
    "SOURCE_ARTIFACT_HASH_MISMATCH",
    "released pickle SHA-256",
  );
  const releasedInspection = inspectReleasedPickle(releasedPicklePath);
  return {
    releaseLineage: {
      path: resolve(releaseLineageArtifactPath),
      bytes: releaseLineageBuffer.length,
      sha256: PINNED_ARTIFACTS.releaseLineage.sha256,
      buffer: releaseLineageBuffer,
      value: releaseLineageArtifact,
    },
    generator: {
      path: resolve(generatorArtifactPath),
      bytes: generatorBuffer.length,
      sha256: PINNED_ARTIFACTS.generator.sha256,
      buffer: generatorBuffer,
      value: generatorArtifact,
    },
    releasedPickle: {
      path: resolve(releasedPicklePath),
      bytes: releasedPickleBuffer.length,
      sha256: PINNED_ARTIFACTS.releasedPickle.sha256,
      buffer: releasedPickleBuffer,
      inspection: releasedInspection,
    },
  };
}

function buildNegativeControls({
  inputs,
  releasedProjection,
  generatorProjection,
}) {
  const controls = [];
  const firstGenerator = generatorProjection.records[0];

  controls.push(expectFailure(
    "generator-source-artifact-hash-mutation",
    () => {
      const mutated = Buffer.from(inputs.generator.buffer);
      mutated[Math.floor(mutated.length / 2)] ^= 0x01;
      parsePinnedJson(
        mutated,
        PINNED_ARTIFACTS.generator.sha256,
        "mutated-generator",
      );
    },
    "SOURCE_ARTIFACT_HASH_MISMATCH",
  ));
  controls.push(expectFailure(
    "generated-cooperator-drop",
    () => {
      const records = clone(generatorProjection.records);
      records[0].actualCooperatorAgentIds =
        records[0].actualCooperatorAgentIds.slice(1);
      compareProjections(
        releasedProjection,
        rebuildProjection(generatorProjection, { records }),
      );
    },
    "ACTUAL_COOPERATOR_SET_MISMATCH",
  ));
  controls.push(expectFailure(
    "generated-cooperator-add",
    () => {
      const records = clone(generatorProjection.records);
      records[0].actualCooperatorAgentIds.push("4");
      compareProjections(
        releasedProjection,
        rebuildProjection(generatorProjection, { records }),
      );
    },
    "ACTUAL_COOPERATOR_SET_MISMATCH",
  ));
  controls.push(expectFailure(
    "generated-cooperator-swap",
    () => {
      const records = clone(generatorProjection.records);
      records[0].actualCooperatorAgentIds[0] = "4";
      compareProjections(
        releasedProjection,
        rebuildProjection(generatorProjection, { records }),
      );
    },
    "ACTUAL_COOPERATOR_SET_MISMATCH",
  ));
  controls.push(expectFailure(
    "released-cooperator-mutation",
    () => {
      const records = clone(releasedProjection.records);
      records[0].actualCooperatorAgentIds =
        records[0].actualCooperatorAgentIds.slice(1);
      compareProjections(
        rebuildProjection(releasedProjection, { records }),
        generatorProjection,
      );
    },
    "ACTUAL_COOPERATOR_SET_MISMATCH",
  ));
  controls.push(expectFailure(
    "key-drop",
    () => compareProjections(
      releasedProjection,
      rebuildProjection(generatorProjection, {
        records: generatorProjection.records.slice(1),
      }),
    ),
    "CANONICAL_RECORD_SET_MISMATCH",
  ));
  controls.push(expectFailure(
    "key-injection",
    () => compareProjections(
      releasedProjection,
      rebuildProjection(generatorProjection, {
        records: [
          ...generatorProjection.records,
          {
            ...clone(firstGenerator),
            egoAgentId: "0",
            actualCooperatorAgentIds: ["1", "2", "3"],
          },
        ],
      }),
    ),
    "CANONICAL_RECORD_SET_MISMATCH",
  ));
  controls.push(expectFailure(
    "duplicate-key",
    () => rebuildProjection(generatorProjection, {
      records: [
        ...generatorProjection.records,
        clone(generatorProjection.records[0]),
      ],
    }),
    "DUPLICATE_KEY",
  ));
  controls.push(expectFailure(
    "generated-cooperator-duplicate",
    () => {
      const records = clone(generatorProjection.records);
      records[0].actualCooperatorAgentIds.push(
        records[0].actualCooperatorAgentIds[0],
      );
      rebuildProjection(generatorProjection, { records });
    },
    "NON_CANONICAL_ACTUAL_COOPERATORS",
  ));
  controls.push(expectFailure(
    "generated-ego-in-cooperator-set",
    () => {
      const records = clone(generatorProjection.records);
      records[0].actualCooperatorAgentIds.push(records[0].egoAgentId);
      rebuildProjection(generatorProjection, { records });
    },
    "NON_CANONICAL_ACTUAL_COOPERATORS",
  ));
  controls.push(expectFailure(
    "released-cooperator-duplicate",
    () => {
      const records = clone(releasedProjection.records);
      records[0].actualCooperatorAgentIds.push(
        records[0].actualCooperatorAgentIds[0],
      );
      rebuildProjection(releasedProjection, { records });
    },
    "NON_CANONICAL_ACTUAL_COOPERATORS",
  ));
  controls.push(expectFailure(
    "released-ego-in-cooperator-set",
    () => {
      const records = clone(releasedProjection.records);
      records[0].actualCooperatorAgentIds.push(records[0].egoAgentId);
      rebuildProjection(releasedProjection, { records });
    },
    "NON_CANONICAL_ACTUAL_COOPERATORS",
  ));
  controls.push(expectFailure(
    "wrong-fixed-converter-commit",
    () => {
      const mutated = clone(inputs.generator.value);
      mutated.fixedPublicConverter.fixedCommit = "0".repeat(40);
      deriveGeneratorProjection(mutated);
    },
    "WRONG_FIXED_COMMIT",
  ));
  controls.push(expectFailure(
    "artifact-binding-mutation",
    () => {
      const boundIdentity = clone(generatorProjection.boundIdentity);
      boundIdentity.releasedTestIndexSha256 = "0".repeat(64);
      compareProjections(
        releasedProjection,
        rebuildProjection(generatorProjection, { boundIdentity }),
      );
    },
    "BOUND_IDENTITY_MISMATCH",
  ));
  controls.push(expectFailure(
    "generated-raw-metainfo-mutation",
    () => {
      const mutated = clone(inputs.generator.value);
      mutated.rawMetainfo.dataset = "OPV2V";
      deriveGeneratorProjection(mutated);
    },
    "CERTIFICATE_HASH_MISMATCH",
  ));
  controls.push(expectFailure(
    "released-raw-metainfo-mutation",
    () => {
      const releasedInspection = clone(inputs.releasedPickle.inspection);
      releasedInspection.metainfo.dataset = "CooperScene";
      deriveReleasedProjection({
        releaseLineageArtifact: inputs.releaseLineage.value,
        releaseLineageArtifactSha256: inputs.releaseLineage.sha256,
        releasedInspection,
        releasedPickleSha256: inputs.releasedPickle.sha256,
      });
    },
    "METAINFO_SOURCE_MISMATCH",
  ));
  controls.push(expectFailure(
    "one-sided-projection",
    () => runMandatoryGate(
      releasedProjection,
      releasedProjection,
      inputs,
    ),
    "UNVERIFIED_PROJECTION",
  ));
  controls.push(expectFailure(
    "forged-distinct-provenance",
    () => {
      const provenance = {
        ...clone(releasedProjection.provenance),
        sourceArtifactRole:
          "actual-fixed-public-converter-generated-cooperator-manifest-v7",
        sourceArtifactSha256: inputs.generator.sha256,
        projectionScope: "actual-generated-vehicle-egos",
      };
      runMandatoryGate(
        releasedProjection,
        rebuildProjection(releasedProjection, {
          role: "generator",
          rawMetainfo: generatorProjection.rawMetainfo,
          canonicalMetainfo: generatorProjection.canonicalMetainfo,
          provenance,
        }),
        inputs,
      );
    },
    "UNVERIFIED_PROJECTION",
  ));
  return controls;
}

function buildPositiveControls({
  releasedProjection,
  generatorProjection,
}) {
  const releasedRecords = clone(releasedProjection.records);
  const generatorRecords = clone(generatorProjection.records);
  releasedRecords[0].actualCooperatorAgentIds.reverse();
  generatorRecords[0].actualCooperatorAgentIds.reverse();
  const canonicalReleased = rebuildProjection(releasedProjection, {
    records: releasedRecords,
  });
  const canonicalGenerator = rebuildProjection(generatorProjection, {
    records: generatorRecords,
  });
  exact(
    canonicalReleased,
    releasedProjection,
    "MANIFEST_MISMATCH",
    "released cooperator order metamorphic control",
  );
  exact(
    canonicalGenerator,
    generatorProjection,
    "MANIFEST_MISMATCH",
    "generator cooperator order metamorphic control",
  );
  return [{
    id: "cooperator-order-permutation",
    status: "passed",
    invariant:
      "actual cooperator IDs are set-semantic and canonicalize to sorted order",
    releasedRecordManifestSha256:
      canonicalReleased.manifests.recordManifestSha256,
    generatorRecordManifestSha256:
      canonicalGenerator.manifests.recordManifestSha256,
  }];
}

function rawMetainfoDifference(released, generator) {
  const difference = firstObjectDifference(released, generator);
  exact(
    difference,
    {
      path: "$.dataset",
      released: "OPV2V",
      generator: "CooperScene",
    },
    "METAINFO_SOURCE_MISMATCH",
    "pinned raw metainfo mismatch witness",
  );
  return difference;
}

function relativePath(path) {
  return relative(REPOSITORY_ROOT, path);
}

export function verifyCertificate(certificate) {
  const payload = clone(certificate);
  const observed = payload.certificateSha256;
  delete payload.certificateSha256;
  requireSha256(observed, "certificate SHA-256");
  exact(
    observed,
    canonicalDigest(payload),
    "CERTIFICATE_HASH_MISMATCH",
    "certificate content address",
  );
  exact(
    certificate.schemaVersion,
    CERTIFICATE_SCHEMA_VERSION,
    "SCHEMA_VERSION_MISMATCH",
    "certificate schema",
  );
  exact(
    certificate.mandatoryGate.result,
    "pass",
    "MANDATORY_GATE_FAILED",
    "certificate mandatory gate",
  );
  exact(
    certificate.mandatoryGate.passedClaim,
    "90 vehicle-ego key plus actual per-row cooperator semantic parity "
      + "under pinned mini evidence",
    "CLAIM_BOUNDARY_VIOLATION",
    "certificate passed claim",
  );
  const sourcePath = (value) => resolve(REPOSITORY_ROOT, value);
  const inputs = readPinnedInputs({
    releaseLineageArtifactPath: sourcePath(
      certificate.sourceArtifacts.releaseLineage.path,
    ),
    generatorArtifactPath: sourcePath(
      certificate.sourceArtifacts.generatedCooperatorEvidence.path,
    ),
    releasedPicklePath: sourcePath(
      certificate.sourceArtifacts.releasedPickle.path,
    ),
  });
  const regenerated = buildCertificate(
    {
      inputs,
      generatedAt: certificate.generatedAt,
    },
    { verify: false },
  );
  exact(
    certificate,
    regenerated,
    "CERTIFICATE_SEMANTIC_MISMATCH",
    "certificate independently regenerated from pinned source bytes",
  );
  return true;
}

export function buildCertificate({
  inputs,
  generatedAt,
  scriptPath = SCRIPT_PATH,
  testPath = TEST_PATH,
}, { verify = true } = {}) {
  ensure(
    typeof generatedAt === "string"
      && Number.isFinite(Date.parse(generatedAt)),
    "SCHEMA_VIOLATION",
    "generatedAt must be an ISO-compatible timestamp",
    { generatedAt },
  );
  const releasedProjection = deriveReleasedProjection({
    releaseLineageArtifact: inputs.releaseLineage.value,
    releaseLineageArtifactSha256: inputs.releaseLineage.sha256,
    releasedInspection: inputs.releasedPickle.inspection,
    releasedPickleSha256: inputs.releasedPickle.sha256,
  });
  const generatorProjection = deriveGeneratorProjection(
    inputs.generator.value,
    { artifactSha256: inputs.generator.sha256 },
  );
  const passingGate = runMandatoryGate(
    releasedProjection,
    generatorProjection,
    inputs,
  );
  const fullReleasedProjection = deriveReleasedProjection({
    releaseLineageArtifact: inputs.releaseLineage.value,
    releaseLineageArtifactSha256: inputs.releaseLineage.sha256,
    releasedInspection: inputs.releasedPickle.inspection,
    releasedPickleSha256: inputs.releasedPickle.sha256,
    scope: "full-released",
  });
  let fullReleasedPopulationProbe;
  try {
    runMandatoryGate(fullReleasedProjection, generatorProjection, inputs);
    fail(
      "NEGATIVE_CONTROL_DID_NOT_FAIL_CLOSED",
      "full released population unexpectedly matched generator population",
    );
  } catch (error) {
    const result = errorResult(error);
    exact(
      result.observedCode,
      "CANONICAL_RECORD_SET_MISMATCH",
      "NEGATIVE_CONTROL_WRONG_FAILURE",
      "full released population failure code",
    );
    fullReleasedPopulationProbe = {
      result: "fail",
      exitSemantics:
        "runMandatoryGate throws PreflightError and CLI exits non-zero",
      ...result,
    };
  }
  const negativeControls = buildNegativeControls({
    inputs,
    releasedProjection,
    generatorProjection,
  });
  const positiveControls = buildPositiveControls({
    releasedProjection,
    generatorProjection,
  });
  const rawMismatch = rawMetainfoDifference(
    releasedProjection.rawMetainfo,
    generatorProjection.rawMetainfo,
  );
  const payload = {
    schemaVersion: CERTIFICATE_SCHEMA_VERSION,
    certificateId:
      "cooperative-autonomous-driving-release-population-preflight-v7",
    certificateType:
      "fail-closed-actual-per-row-cooperator-semantic-preflight",
    generatedAt,
    result:
      "pinned-mini-90-vehicle-ego-actual-cooperator-semantic-parity",
    sourceArtifacts: {
      releaseLineage: {
        path: relativePath(inputs.releaseLineage.path),
        bytes: inputs.releaseLineage.bytes,
        sha256: inputs.releaseLineage.sha256,
      },
      generatedCooperatorEvidence: {
        path: relativePath(inputs.generator.path),
        bytes: inputs.generator.bytes,
        sha256: inputs.generator.sha256,
      },
      releasedPickle: {
        path: inputs.releasedPickle.path,
        bytes: inputs.releasedPickle.bytes,
        sha256: inputs.releasedPickle.sha256,
        payloadSha256:
          inputs.releasedPickle.inspection.payloadSha256,
      },
    },
    extractionIndependence: {
      released: {
        source:
          "restricted parse of pinned released pickle data_list rows",
        field: "data_list[].cooperators[].agent_id",
        classLookupPolicy:
          inputs.releasedPickle.inspection.classLookupPolicy,
        rowCount: inputs.releasedPickle.inspection.rows.length,
        generatedManifestReadToPopulateCooperators: false,
        v4EventManifestUsedToPopulateCooperators: false,
        availableAgentSetUsedAsCooperatorSubstitute: false,
      },
      generator: {
        source:
          "v7 content-addressed records extracted from newly generated pickle",
        field: "data_list[].cooperators[].agent_id",
        releasedPickleReadToPopulateCooperators: false,
        availableAgentSetUsedAsCooperatorSubstitute: false,
      },
    },
    canonicalContracts: {
      projectionSchemaVersion: PROJECTION_SCHEMA_VERSION,
      recordSchemaVersion: RECORD_SCHEMA_VERSION,
      bindingSchemaVersion: BINDING_SCHEMA_VERSION,
      metainfoSchemaVersion: METAINFO_SCHEMA_VERSION,
      split: SPLIT,
      fixedConverterCommit: FIXED_COMMIT,
      keySchema: [
        "split",
        "physicalEvent.scenario",
        "physicalEvent.timestamp",
        "egoAgentId",
      ],
      actualCooperatorSchema: [
        "canonicalKey",
        "sortedUniqueActualCooperatorAgentIdsFromRow",
      ],
      vehicleEgoIds: VEHICLE_EGO_IDS,
      canonicalAgentIds: CANONICAL_AGENT_IDS,
      ordering: "ascending canonical split/scenario/timestamp/ego key",
      uniqueness: "exactly one record per canonical key",
      metainfoNormalization: {
        policy: CANONICAL_METAINFO.normalizationPolicy,
        releasedRawDatasetLabelRequired: "OPV2V",
        generatorRawDatasetLabelRequired: "CooperScene",
        canonicalDatasetLabel: "CooperScene",
        boundary:
          "Raw equality is an explicit observed failure. The alias is allowed "
          + "only for the exact pinned artifacts and exact OPV2V/CooperScene "
          + "label pair; either label or any other metainfo mutation fails "
          + "closed.",
      },
    },
    metainfoComparison: {
      rawMetainfoEquality: {
        result: "fail",
        equal: false,
        witness: rawMismatch,
      },
      aliasApplication: {
        applied: true,
        policy: CANONICAL_METAINFO.normalizationPolicy,
        allowedOnlyForPinnedArtifacts: {
          releaseLineageSha256: inputs.releaseLineage.sha256,
          generatorEvidenceSha256: inputs.generator.sha256,
          releasedPickleSha256: inputs.releasedPickle.sha256,
        },
        exactRawDatasetLabelPair: {
          released: "OPV2V",
          generator: "CooperScene",
        },
        canonicalMetainfoEqualAfterAlias: true,
        silentMismatchSuppression: false,
      },
    },
    mandatoryGate: {
      scope: "current-vehicle-ego-subpopulation",
      rule:
        "rederive both projections from exact pinned source bytes, then pass "
        + "only when split, 90 canonical vehicle-ego keys, actual per-row "
        + "cooperator manifests, canonical metainfo after the explicit pinned "
        + "alias, fixed commit, and artifact bindings all match",
      ...passingGate,
    },
    projections: {
      independentlyParsedReleasedVehicleEgos: releasedProjection,
      actuallyGeneratedVehicleEgos: generatorProjection,
    },
    fullReleasedPopulationProbe,
    negativeControls,
    positiveControls,
    conclusions: {
      supported: [
        "90 vehicle-ego key plus actual per-row cooperator semantic parity "
          + "under pinned mini evidence.",
        "The complete released 120-row population still differs from the "
          + "current 90-row generator population by one released-only ego-0 "
          + "row for each of the 30 physical events.",
        "Released raw metainfo says OPV2V while generated raw metainfo says "
          + "CooperScene; raw equality fails and the exact pinned alias is "
          + "recorded separately.",
      ],
      unsupported: [
        "No annotation, bounding-box, point-cloud, image, or byte-for-byte "
          + "pickle parity is claimed.",
        "No AP, benchmark metric, model output, ranking, paper result, or "
          + "performance direction is read or inferred.",
        "No historical generator for the released pickle is identified.",
        "No full released 120-row population parity is claimed.",
        "No author, publisher, dataset-owner, or official identity signature "
          + "is claimed.",
      ],
    },
    integrityBoundary: {
      mechanism:
        "SHA-256 content address over every certificate field except "
        + "certificateSha256 itself",
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
        "node scripts/idea-pilots/release-population-preflight-v7.mjs "
        + `--generated-at ${generatedAt} --output `
        + "content/idea-audits/"
        + "cooperative-autonomous-driving-release-population-preflight-v7.json",
      failingFullPopulationCommand:
        "node scripts/idea-pilots/release-population-preflight-v7.mjs "
        + "--scope full-released",
      testCommand:
        "node --test test/release-population-preflight-v7.test.mjs",
    },
  };
  const certificate = {
    ...payload,
    certificateSha256: canonicalDigest(payload),
  };
  if (verify) verifyCertificate(certificate);
  return certificate;
}

function parseArgs(argv) {
  const options = {
    releaseLineageArtifactPath: DEFAULT_RELEASE_LINEAGE_ARTIFACT,
    generatorArtifactPath: DEFAULT_GENERATOR_ARTIFACT,
    releasedPicklePath: DEFAULT_RELEASED_PICKLE,
    output: null,
    generatedAt: new Date().toISOString(),
    scope: "vehicle-egos",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    const key = {
      "--release-lineage-artifact": "releaseLineageArtifactPath",
      "--generator-artifact": "generatorArtifactPath",
      "--released-pickle": "releasedPicklePath",
      "--output": "output",
      "--generated-at": "generatedAt",
      "--scope": "scope",
    }[option];
    ensure(
      key && value,
      "CLI_USAGE",
      `unknown or incomplete option: ${option}`,
      { option },
    );
    options[key] = ["generatedAt", "scope"].includes(key)
      ? value
      : resolve(value);
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
  const inputs = readPinnedInputs(options);
  if (options.scope === "full-released") {
    const released = deriveReleasedProjection({
      releaseLineageArtifact: inputs.releaseLineage.value,
      releaseLineageArtifactSha256: inputs.releaseLineage.sha256,
      releasedInspection: inputs.releasedPickle.inspection,
      releasedPickleSha256: inputs.releasedPickle.sha256,
      scope: "full-released",
    });
    const generator = deriveGeneratorProjection(
      inputs.generator.value,
      { artifactSha256: inputs.generator.sha256 },
    );
    runMandatoryGate(released, generator, inputs);
    fail(
      "FAIL_CLOSED_INVARIANT",
      "full released population unexpectedly passed",
    );
  }
  const certificate = buildCertificate({
    inputs,
    generatedAt: options.generatedAt,
  });
  const output = `${JSON.stringify(certificate, null, 2)}\n`;
  if (options.output) writeFileSync(options.output, output);
  process.stdout.write(output);
  return certificate;
}

function formatError(error) {
  return {
    result: "fail",
    error: {
      name: error?.name ?? "Error",
      code: error?.code ?? "UNEXPECTED_ERROR",
      message: error?.message ?? String(error),
      witness: error?.witness ?? null,
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
    process.stderr.write(`${JSON.stringify(formatError(error), null, 2)}\n`);
    process.exitCode = 1;
  }
}
