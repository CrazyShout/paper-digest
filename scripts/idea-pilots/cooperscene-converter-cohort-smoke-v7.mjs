#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import {
  fileURLToPath,
  pathToFileURL,
} from "node:url";

import {
  FIXED_COMMIT,
  PINNED_INPUTS,
  inspectPlainPickle,
} from "./cooperscene-converter-smoke.mjs";

export { FIXED_COMMIT };
export const CERTIFICATE_SCHEMA_VERSION =
  "cooperscene-generated-cooperator-evidence/v7";
export const RECORD_SCHEMA_VERSION =
  "cooperative-perception-physical-event-ego-actual-cooperators/v1";
export const SPLIT = "test";
export const VEHICLE_EGO_IDS = Object.freeze(["1", "2", "3"]);
export const CANONICAL_AGENT_IDS = Object.freeze(["0", "1", "2", "3"]);

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(SCRIPT_PATH), "../..");
const V5_RUNNER_PATH = resolve(
  REPOSITORY_ROOT,
  "scripts/idea-pilots/cooperscene-converter-smoke.mjs",
);
const TEST_PATH = resolve(
  REPOSITORY_ROOT,
  "test/cooperscene-converter-cohort-smoke-v7.test.mjs",
);
const DEFAULT_OUTPUT = resolve(
  REPOSITORY_ROOT,
  "content/idea-audits/"
    + "cooperative-autonomous-driving-converter-cohort-execution-v7.json",
);
const DEFAULT_RELEASE_CERTIFICATE = resolve(
  REPOSITORY_ROOT,
  "content/idea-audits/"
    + "cooperative-autonomous-driving-release-population-lineage-pilot-v4.json",
);

const EXPECTED_GENERATED_METAINFO = Object.freeze({
  categories: { vehicle: 0 },
  classes: ["vehicle"],
  cooperative: true,
  dataset: "CooperScene",
  info_version: "1.0",
});
const KEY_COMPONENT = /^[A-Za-z0-9_.-]+$/;
const HEX_SHA256 = /^[0-9a-f]{64}$/;

export class CohortEvidenceError extends Error {
  constructor(code, message, witness = null) {
    super(message);
    this.name = "CohortEvidenceError";
    this.code = code;
    this.witness = witness;
  }
}

function fail(code, message, witness = null) {
  throw new CohortEvidenceError(code, message, witness);
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

export function recordKey(record) {
  return [
    record.split,
    record.physicalEvent.scenario,
    record.physicalEvent.timestamp,
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

function projectionManifests(records) {
  const keys = records.map(recordKey);
  const actualCooperators = records.map((record) => ({
    key: recordKey(record),
    actualCooperatorAgentIds: record.actualCooperatorAgentIds,
  }));
  return {
    keyManifestSha256: canonicalDigest(keys),
    actualCooperatorManifestSha256: canonicalDigest(actualCooperators),
    recordManifestSha256: canonicalDigest(records),
  };
}

export function createGeneratedCooperatorManifest(rows) {
  ensure(
    Array.isArray(rows) && rows.length > 0,
    "SCHEMA_VIOLATION",
    "generated rows must be a non-empty array",
  );
  const records = rows.map(canonicalRecord).sort(compareRecords);
  const firstIndexByKey = new Map();
  for (const [index, record] of records.entries()) {
    const key = recordKey(record);
    if (firstIndexByKey.has(key)) {
      fail("DUPLICATE_KEY", "generated rows contain a duplicate key", {
        key,
        firstIndex: firstIndexByKey.get(key),
        duplicateIndex: index,
      });
    }
    firstIndexByKey.set(key, index);
    exact(
      record.actualCooperatorAgentIds,
      [...new Set(record.actualCooperatorAgentIds)].sort(),
      "NON_CANONICAL_ACTUAL_COOPERATORS",
      `${key} actual cooperator IDs`,
    );
    ensure(
      !record.actualCooperatorAgentIds.includes(record.egoAgentId),
      "NON_CANONICAL_ACTUAL_COOPERATORS",
      "ego agent must not occur in its actual cooperator set",
      { key, egoAgentId: record.egoAgentId },
    );
  }
  return {
    recordSchemaVersion: RECORD_SCHEMA_VERSION,
    split: SPLIT,
    records,
    manifests: projectionManifests(records),
  };
}

function validatePinnedGeneratedManifest(manifest) {
  exact(
    manifest.recordSchemaVersion,
    RECORD_SCHEMA_VERSION,
    "SCHEMA_VERSION_MISMATCH",
    "generated manifest record schema",
  );
  exact(manifest.split, SPLIT, "SPLIT_MISMATCH", "generated manifest split");
  const rebuilt = createGeneratedCooperatorManifest(manifest.records);
  exact(
    manifest,
    rebuilt,
    "MANIFEST_MISMATCH",
    "generated actual-cooperator manifest",
  );
  exact(
    manifest.records.length,
    90,
    "POPULATION_MISMATCH",
    "generated record count",
  );
  const eventCount = new Set(manifest.records.map((record) => [
    record.physicalEvent.scenario,
    record.physicalEvent.timestamp,
  ].join("/"))).size;
  exact(
    eventCount,
    30,
    "POPULATION_MISMATCH",
    "generated physical-event count",
  );
  const egoRowsByAgent = Object.fromEntries(VEHICLE_EGO_IDS.map((ego) => [
    ego,
    manifest.records.filter((record) => record.egoAgentId === ego).length,
  ]));
  exact(
    egoRowsByAgent,
    { 1: 30, 2: 30, 3: 30 },
    "POPULATION_MISMATCH",
    "generated ego distribution",
  );
  for (const record of manifest.records) {
    ensure(
      VEHICLE_EGO_IDS.includes(record.egoAgentId),
      "POPULATION_MISMATCH",
      "generated record contains a non-vehicle ego",
      { key: recordKey(record) },
    );
    const pinnedExpected = CANONICAL_AGENT_IDS.filter(
      (agentId) => agentId !== record.egoAgentId,
    );
    exact(
      record.actualCooperatorAgentIds,
      pinnedExpected,
      "ACTUAL_COOPERATOR_SET_MISMATCH",
      `${recordKey(record)} actual generated cooperator set`,
    );
  }
  return { eventCount, egoRowsByAgent };
}

function inputIdentity(v5Evidence, role) {
  const matches = v5Evidence.officialInputs.identities.filter(
    (identity) => identity.role === role,
  );
  ensure(
    matches.length === 1,
    "BOUND_IDENTITY_MISMATCH",
    `v5 execution must contain exactly one ${role} identity`,
    { role, count: matches.length },
  );
  return matches[0];
}

function sanitizeExecutionText(value, temporaryRoot) {
  return String(value).split(temporaryRoot).join("<temporary-root>");
}

function observedFailure(id, callback, expectedCode) {
  try {
    callback();
  } catch (error) {
    ensure(
      error instanceof CohortEvidenceError,
      "NEGATIVE_CONTROL_WRONG_FAILURE",
      `${id} raised a non-cohort error`,
      { name: error?.name, message: error?.message },
    );
    exact(
      error.code,
      expectedCode,
      "NEGATIVE_CONTROL_WRONG_FAILURE",
      `${id} failure code`,
    );
    return {
      id,
      status: "passed",
      observedCode: error.code,
      witness: error.witness,
    };
  }
  fail(
    "NEGATIVE_CONTROL_DID_NOT_FAIL_CLOSED",
    `${id} unexpectedly passed`,
  );
}

function buildNegativeControls(manifest) {
  const controls = [];
  controls.push(observedFailure(
    "generated-actual-cooperator-drop",
    () => {
      const mutated = clone(manifest);
      mutated.records[0].actualCooperatorAgentIds =
        mutated.records[0].actualCooperatorAgentIds.slice(1);
      validatePinnedGeneratedManifest(
        createGeneratedCooperatorManifest(mutated.records),
      );
    },
    "ACTUAL_COOPERATOR_SET_MISMATCH",
  ));
  controls.push(observedFailure(
    "generated-actual-cooperator-add",
    () => {
      const mutated = clone(manifest);
      mutated.records[0].actualCooperatorAgentIds.push("4");
      validatePinnedGeneratedManifest(
        createGeneratedCooperatorManifest(mutated.records),
      );
    },
    "ACTUAL_COOPERATOR_SET_MISMATCH",
  ));
  controls.push(observedFailure(
    "generated-actual-cooperator-swap",
    () => {
      const mutated = clone(manifest);
      mutated.records[0].actualCooperatorAgentIds[0] = "4";
      validatePinnedGeneratedManifest(
        createGeneratedCooperatorManifest(mutated.records),
      );
    },
    "ACTUAL_COOPERATOR_SET_MISMATCH",
  ));
  controls.push(observedFailure(
    "generated-key-duplicate",
    () => createGeneratedCooperatorManifest([
      ...manifest.records,
      clone(manifest.records[0]),
    ]),
    "DUPLICATE_KEY",
  ));
  controls.push(observedFailure(
    "generated-cooperator-duplicate",
    () => {
      const mutated = clone(manifest);
      mutated.records[0].actualCooperatorAgentIds.push(
        mutated.records[0].actualCooperatorAgentIds[0],
      );
      createGeneratedCooperatorManifest(mutated.records);
    },
    "NON_CANONICAL_ACTUAL_COOPERATORS",
  ));
  controls.push(observedFailure(
    "generated-ego-in-cooperator-set",
    () => {
      const mutated = clone(manifest);
      mutated.records[0].actualCooperatorAgentIds.push(
        mutated.records[0].egoAgentId,
      );
      createGeneratedCooperatorManifest(mutated.records);
    },
    "NON_CANONICAL_ACTUAL_COOPERATORS",
  ));
  return controls;
}

function buildPositiveControls(manifest) {
  const mutated = clone(manifest);
  mutated.records[0].actualCooperatorAgentIds.reverse();
  const rebuilt = createGeneratedCooperatorManifest(mutated.records);
  return [{
    id: "generated-cooperator-order-permutation",
    status: "passed",
    invariant: "set order canonicalizes without changing the record manifest",
    observedRecordManifestSha256: rebuilt.manifests.recordManifestSha256,
    expectedRecordManifestSha256: manifest.manifests.recordManifestSha256,
  }];
}

function validateV5Execution(v5Evidence, generatedInspection) {
  exact(
    v5Evidence.certificateId,
    "cooperative-autonomous-driving-converter-execution-smoke-v5",
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "delegated v5 runner certificate ID",
  );
  exact(
    v5Evidence.fixedPublicConverter.fixedCommit,
    FIXED_COMMIT,
    "WRONG_FIXED_COMMIT",
    "fixed public converter commit",
  );
  exact(
    v5Evidence.fixedPublicConverter.checkoutHead,
    FIXED_COMMIT,
    "WRONG_FIXED_COMMIT",
    "fixed public converter checkout HEAD",
  );
  exact(
    v5Evidence.fixedPublicConverter.sourceFilesUnchangedDuringRun,
    true,
    "WRONG_FIXED_COMMIT",
    "fixed public converter source stability",
  );
  exact(
    v5Evidence.converterExecution.classification,
    "actual-public-converter-main-execution",
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "converter execution classification",
  );
  exact(
    v5Evidence.converterExecution.exitCode,
    0,
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "converter exit code",
  );
  exact(
    v5Evidence.converterExecution.stderr,
    "",
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "converter stderr",
  );
  exact(
    v5Evidence.converterExecution.generatedTestPickle.sha256,
    generatedInspection.pickleSha256,
    "BOUND_IDENTITY_MISMATCH",
    "generated pickle SHA-256",
  );
  exact(
    v5Evidence.converterExecution.generatedTestPickle.payloadSha256,
    generatedInspection.payloadSha256,
    "BOUND_IDENTITY_MISMATCH",
    "generated pickle payload SHA-256",
  );
  exact(
    v5Evidence.converterExecution.fileAccess.stubReadEventCount,
    0,
    "STUB_READ_BOUNDARY_VIOLATION",
    "converter PCD/PNG stub read count",
  );
  exact(
    v5Evidence.converterExecution.fileAccess.uniqueYamlPathsRead,
    120,
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "converter YAML read count",
  );
  exact(
    generatedInspection.classLookupPolicy,
    "deny-all",
    "RESTRICTED_PARSE_EVIDENCE_MISSING",
    "generated pickle class lookup policy",
  );
  exact(
    generatedInspection.metainfo,
    EXPECTED_GENERATED_METAINFO,
    "METAINFO_SOURCE_MISMATCH",
    "generated raw metainfo",
  );
}

export function buildEvidence({
  v5Evidence,
  generatedInspection,
  generatedAt,
  scriptPath = SCRIPT_PATH,
  testPath = TEST_PATH,
}) {
  ensure(
    typeof generatedAt === "string"
      && Number.isFinite(Date.parse(generatedAt)),
    "SCHEMA_VIOLATION",
    "generatedAt must be an ISO-compatible timestamp",
    { generatedAt },
  );
  validateV5Execution(v5Evidence, generatedInspection);
  const generatedManifest = createGeneratedCooperatorManifest(
    generatedInspection.rows,
  );
  const summary = validatePinnedGeneratedManifest(generatedManifest);
  const negativeControls = buildNegativeControls(generatedManifest);
  const positiveControls = buildPositiveControls(generatedManifest);
  const central = inputIdentity(v5Evidence, "central-directory-inventory");
  const archive = inputIdentity(v5Evidence, "official-archive-prefix");
  const released = inputIdentity(v5Evidence, "released-test-index");
  const releaseCertificateSha256 = requireSha256(
    v5Evidence.officialInputs.priorFullMemberVerification.sha256,
    "release lineage certificate SHA-256",
  );
  const temporaryRoot = v5Evidence.materialization.temporaryRoot;
  const sourceManifest = v5Evidence.fixedPublicConverter.sourceFilesBefore
    .map((source) => ({
      path: source.path,
      blobObjectId: source.blobObjectId,
      sha256: source.fixedCommitObjectSha256,
    }));

  const payload = {
    schemaVersion: CERTIFICATE_SCHEMA_VERSION,
    certificateId:
      "cooperative-autonomous-driving-converter-cohort-execution-v7",
    certificateType:
      "actual-fixed-public-converter-generated-cooperator-manifest",
    generatedAt,
    result:
      "actual-generated-90-row-vehicle-ego-cooperator-manifest-persisted",
    fixedPublicConverter: {
      repository: v5Evidence.fixedPublicConverter.repository,
      fixedCommit: FIXED_COMMIT,
      checkoutHead: v5Evidence.fixedPublicConverter.checkoutHead,
      sourceManifest,
      sourceManifestSha256: canonicalDigest(sourceManifest),
      sourceFilesUnchangedDuringRun:
        v5Evidence.fixedPublicConverter.sourceFilesUnchangedDuringRun,
    },
    artifactBindings: {
      split: SPLIT,
      centralInventorySha256: central.sha256,
      officialArchivePrefixSha256: archive.sha256,
      releasedTestIndexSha256: released.sha256,
      releaseLineageCertificateSha256: releaseCertificateSha256,
      generatedTestPickleSha256: generatedInspection.pickleSha256,
      generatedPayloadSha256: generatedInspection.payloadSha256,
      fixedConverterCommit: FIXED_COMMIT,
      bindingManifestSha256: canonicalDigest({
        split: SPLIT,
        centralInventorySha256: central.sha256,
        officialArchivePrefixSha256: archive.sha256,
        releasedTestIndexSha256: released.sha256,
        releaseLineageCertificateSha256: releaseCertificateSha256,
        generatedTestPickleSha256: generatedInspection.pickleSha256,
        generatedPayloadSha256: generatedInspection.payloadSha256,
        fixedConverterCommit: FIXED_COMMIT,
      }),
    },
    actualExecution: {
      classification: "actual-public-converter-main-execution",
      delegatedReadOnlyRunner: relative(REPOSITORY_ROOT, V5_RUNNER_PATH),
      delegatedRunnerSha256: sha256(readFileSync(V5_RUNNER_PATH)),
      converterExitCode: v5Evidence.converterExecution.exitCode,
      converterSignal: v5Evidence.converterExecution.signal,
      converterStdout: sanitizeExecutionText(
        v5Evidence.converterExecution.stdout,
        temporaryRoot,
      ),
      converterStderr: v5Evidence.converterExecution.stderr,
      restrictedPickleInspection: {
        parser: "pickletools pre-screen plus deny-all find_class unpickler",
        sourceField: "data_list[].cooperators[].agent_id",
        pickleBytes: generatedInspection.pickleBytes,
        pickleSha256: generatedInspection.pickleSha256,
        payloadSha256: generatedInspection.payloadSha256,
        protocol: generatedInspection.protocol,
        allowedOpcodes: generatedInspection.allowedOpcodes,
        observedOpcodeCounts: generatedInspection.opcodeCounts,
        classLookupPolicy: generatedInspection.classLookupPolicy,
        plainValuePolicy: generatedInspection.plainValuePolicy,
      },
      fileAccess: v5Evidence.converterExecution.fileAccess,
      temporaryGeneratedPickleReadBeforeCleanup: true,
      temporaryDirectoryRemovedByV7RunnerAfterInspection: true,
    },
    inputBoundary: {
      realYamlCount: v5Evidence.materialization.realYaml.count,
      realYamlManifestSha256:
        v5Evidence.materialization.realYaml.manifestSha256,
      yamlIdentityValidation:
        "each member checked against central local name, size, and CRC32",
      pcdExistenceStubCount:
        v5Evidence.materialization.existenceStubs.pcdCount,
      pngExistenceStubCount:
        v5Evidence.materialization.existenceStubs.pngCount,
      existenceStubBytes: 0,
      converterStubReadEvents:
        v5Evidence.materialization.existenceStubs.converterStubReadEvents,
      compatibilityClassification:
        v5Evidence.temporaryCompatibility.classification,
      compatibilityModules:
        v5Evidence.temporaryCompatibility.modules.map((module) => ({
          name: module.name,
          sha256: module.sha256,
          boundary: module.boundary,
        })),
      accessAuditSha256:
        v5Evidence.temporaryCompatibility.accessAudit.sha256,
    },
    rawMetainfo: clone(generatedInspection.metainfo),
    generatedCooperatorManifest: generatedManifest,
    observations: {
      physicalEventCount: summary.eventCount,
      recordCount: generatedManifest.records.length,
      egoRowsByAgent: summary.egoRowsByAgent,
      everyRecordHasPinnedMiniActualCooperatorSet: true,
      cooperatorSource:
        "restricted parsing of the newly generated pickle in this execution",
      releasedProjectionUsedToPopulateCooperators: false,
      availableAgentSetUsedAsCooperatorSubstitute: false,
    },
    negativeControls,
    positiveControls,
    claimBoundary: [
      "This v7 runner actually re-executes the fixed public converter through the read-only v5 materialization runner and reads the newly generated pickle before deleting its temporary directory.",
      "The persisted actualCooperatorAgentIds values are independently copied from each newly generated data_list row's cooperators[].agent_id field. They are not copied from the released pickle, the v4 event manifest, or a merely available-agent set.",
      "The public converter still runs with the recorded minimal mmengine and tqdm compatibility shims plus open-event instrumentation; this is not an official CooperScene environment or dependency lock.",
      "Official CRC-checked YAML bytes are real. PCD and PNG files remain zero-byte existence stubs, are not opened for reading by the converter, and no --convert-pcd path is exercised.",
      "This evidence covers only the pinned mini test split's 30 physical events, 90 vehicle-ego rows, raw generated metainfo, and actual per-row cooperator IDs.",
      "It does not establish annotation, bounding-box, point-cloud, image, byte-for-byte released-pickle, AP, benchmark, ranking, paper-result, historical-generator, or full-release parity.",
    ],
    reproducibility: {
      runner: {
        path: relative(REPOSITORY_ROOT, scriptPath),
        sha256: sha256(readFileSync(scriptPath)),
      },
      test: {
        path: relative(REPOSITORY_ROOT, testPath),
        sha256: existsSync(testPath) ? sha256(readFileSync(testPath)) : null,
      },
      command:
        "node scripts/idea-pilots/cooperscene-converter-cohort-smoke-v7.mjs "
        + `--generated-at ${generatedAt} --output `
        + "content/idea-audits/"
        + "cooperative-autonomous-driving-converter-cohort-execution-v7.json",
      testCommand:
        "node --test test/cooperscene-converter-cohort-smoke-v7.test.mjs",
    },
  };
  const certificate = {
    ...payload,
    certificateSha256: canonicalDigest(payload),
  };
  verifyEvidence(certificate);
  return certificate;
}

export function verifyEvidence(certificate) {
  exactKeys(
    certificate,
    [
      "schemaVersion",
      "certificateId",
      "certificateType",
      "generatedAt",
      "result",
      "fixedPublicConverter",
      "artifactBindings",
      "actualExecution",
      "inputBoundary",
      "rawMetainfo",
      "generatedCooperatorManifest",
      "observations",
      "negativeControls",
      "positiveControls",
      "claimBoundary",
      "reproducibility",
      "certificateSha256",
    ],
    "certificate",
  );
  const payload = clone(certificate);
  const observedCertificateSha256 = payload.certificateSha256;
  delete payload.certificateSha256;
  requireSha256(
    observedCertificateSha256,
    "certificate.certificateSha256",
  );
  exact(
    observedCertificateSha256,
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
    certificate.certificateId,
    "cooperative-autonomous-driving-converter-cohort-execution-v7",
    "SCHEMA_VIOLATION",
    "certificate ID",
  );
  exact(
    certificate.certificateType,
    "actual-fixed-public-converter-generated-cooperator-manifest",
    "SCHEMA_VIOLATION",
    "certificate type",
  );
  exact(
    certificate.result,
    "actual-generated-90-row-vehicle-ego-cooperator-manifest-persisted",
    "CLAIM_BOUNDARY_VIOLATION",
    "certificate result",
  );
  exactKeys(
    certificate.fixedPublicConverter,
    [
      "repository",
      "fixedCommit",
      "checkoutHead",
      "sourceManifest",
      "sourceManifestSha256",
      "sourceFilesUnchangedDuringRun",
    ],
    "certificate.fixedPublicConverter",
  );
  exact(
    certificate.fixedPublicConverter.fixedCommit,
    FIXED_COMMIT,
    "WRONG_FIXED_COMMIT",
    "certificate fixed converter commit",
  );
  exact(
    certificate.fixedPublicConverter.checkoutHead,
    FIXED_COMMIT,
    "WRONG_FIXED_COMMIT",
    "certificate checkout HEAD",
  );
  exact(
    certificate.fixedPublicConverter.sourceManifestSha256,
    canonicalDigest(certificate.fixedPublicConverter.sourceManifest),
    "MANIFEST_MISMATCH",
    "certificate source manifest SHA-256",
  );
  exactKeys(
    certificate.artifactBindings,
    [
      "split",
      "centralInventorySha256",
      "officialArchivePrefixSha256",
      "releasedTestIndexSha256",
      "releaseLineageCertificateSha256",
      "generatedTestPickleSha256",
      "generatedPayloadSha256",
      "fixedConverterCommit",
      "bindingManifestSha256",
    ],
    "certificate.artifactBindings",
  );
  const {
    bindingManifestSha256,
    ...bindingManifest
  } = certificate.artifactBindings;
  exact(
    bindingManifestSha256,
    canonicalDigest(bindingManifest),
    "MANIFEST_MISMATCH",
    "certificate binding manifest SHA-256",
  );
  exact(
    certificate.artifactBindings.fixedConverterCommit,
    FIXED_COMMIT,
    "WRONG_FIXED_COMMIT",
    "certificate binding fixed converter commit",
  );
  exact(
    certificate.rawMetainfo,
    EXPECTED_GENERATED_METAINFO,
    "METAINFO_SOURCE_MISMATCH",
    "certificate generated raw metainfo",
  );
  validatePinnedGeneratedManifest(certificate.generatedCooperatorManifest);
  exact(
    certificate.artifactBindings.generatedTestPickleSha256,
    certificate.actualExecution.restrictedPickleInspection.pickleSha256,
    "BOUND_IDENTITY_MISMATCH",
    "generated pickle binding",
  );
  exact(
    certificate.artifactBindings.generatedPayloadSha256,
    certificate.actualExecution.restrictedPickleInspection.payloadSha256,
    "BOUND_IDENTITY_MISMATCH",
    "generated payload binding",
  );
  exact(
    certificate.negativeControls,
    buildNegativeControls(certificate.generatedCooperatorManifest),
    "NEGATIVE_CONTROL_DID_NOT_FAIL_CLOSED",
    "converter cohort negative controls",
  );
  exact(
    certificate.positiveControls,
    buildPositiveControls(certificate.generatedCooperatorManifest),
    "NEGATIVE_CONTROL_DID_NOT_FAIL_CLOSED",
    "converter cohort metamorphic controls",
  );
  exact(
    certificate.actualExecution.delegatedReadOnlyRunner,
    relative(REPOSITORY_ROOT, V5_RUNNER_PATH),
    "BOUND_IDENTITY_MISMATCH",
    "delegated runner path",
  );
  exact(
    certificate.actualExecution.delegatedRunnerSha256,
    sha256(readFileSync(V5_RUNNER_PATH)),
    "BOUND_IDENTITY_MISMATCH",
    "delegated runner bytes",
  );
  exact(
    certificate.reproducibility.runner.path,
    relative(REPOSITORY_ROOT, SCRIPT_PATH),
    "BOUND_IDENTITY_MISMATCH",
    "runner path",
  );
  exact(
    certificate.reproducibility.runner.sha256,
    sha256(readFileSync(SCRIPT_PATH)),
    "BOUND_IDENTITY_MISMATCH",
    "runner bytes",
  );
  exact(
    certificate.reproducibility.test.path,
    relative(REPOSITORY_ROOT, TEST_PATH),
    "BOUND_IDENTITY_MISMATCH",
    "test path",
  );
  exact(
    certificate.reproducibility.test.sha256,
    sha256(readFileSync(TEST_PATH)),
    "BOUND_IDENTITY_MISMATCH",
    "test bytes",
  );
  return true;
}

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    generatedAt: new Date().toISOString(),
    central: PINNED_INPUTS.central.path,
    archivePrefix: PINNED_INPUTS.archivePrefix.path,
    releasedTestIndex: PINNED_INPUTS.releasedTestIndex.path,
    priorCertificate: DEFAULT_RELEASE_CERTIFICATE,
    sourceRepo: existsSync("/private/tmp/paper-digest-cooperscene-audit")
      ? "/private/tmp/paper-digest-cooperscene-audit"
      : "/private/tmp/cooperscene-official",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    const key = {
      "--output": "output",
      "--generated-at": "generatedAt",
      "--central": "central",
      "--archive-prefix": "archivePrefix",
      "--released-test-index": "releasedTestIndex",
      "--prior-certificate": "priorCertificate",
      "--source-repo": "sourceRepo",
    }[option];
    ensure(
      key && value,
      "CLI_USAGE",
      `unknown or incomplete option: ${option}`,
      { option },
    );
    options[key] = key === "generatedAt" ? value : resolve(value);
    index += 1;
  }
  return options;
}

export function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const v5Args = [
    V5_RUNNER_PATH,
    "--generated-at",
    options.generatedAt,
    "--keep-temp",
    "--compact",
    "--central",
    options.central,
    "--archive-prefix",
    options.archivePrefix,
    "--released-test-index",
    options.releasedTestIndex,
    "--prior-certificate",
    options.priorCertificate,
    "--source-repo",
    options.sourceRepo,
  ];
  const result = spawnSync(process.execPath, v5Args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  ensure(
    result.status === 0,
    "ACTUAL_EXECUTION_FAILED",
    "delegated v5 converter execution failed",
    {
      status: result.status,
      signal: result.signal,
      stderr: result.stderr,
      error: result.error?.message ?? null,
    },
  );
  let v5Evidence;
  try {
    v5Evidence = JSON.parse(result.stdout);
  } catch (error) {
    fail(
      "ACTUAL_EXECUTION_EVIDENCE_MISSING",
      "delegated v5 runner did not emit valid JSON",
      { message: error.message },
    );
  }
  const temporaryRoot = v5Evidence.materialization?.temporaryRoot;
  ensure(
    typeof temporaryRoot === "string" && temporaryRoot.length > 0,
    "ACTUAL_EXECUTION_EVIDENCE_MISSING",
    "delegated v5 runner did not retain its temporary root",
  );
  try {
    const generatedPath =
      v5Evidence.converterExecution.generatedTestPickle.path;
    ensure(
      existsSync(generatedPath),
      "ACTUAL_EXECUTION_EVIDENCE_MISSING",
      "newly generated pickle is absent before v7 inspection",
      { generatedPath },
    );
    const generatedInspection = inspectPlainPickle(generatedPath);
    const certificate = buildEvidence({
      v5Evidence,
      generatedInspection,
      generatedAt: options.generatedAt,
    });
    const output = `${JSON.stringify(certificate, null, 2)}\n`;
    if (options.output) writeFileSync(options.output, output);
    process.stdout.write(output);
    return certificate;
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
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
