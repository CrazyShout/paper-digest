import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CERTIFICATE_SCHEMA_VERSION,
  CohortEvidenceError,
  FIXED_COMMIT,
  RECORD_SCHEMA_VERSION,
  canonicalDigest,
  createGeneratedCooperatorManifest,
  recordKey,
  verifyEvidence,
} from "../scripts/idea-pilots/cooperscene-converter-cohort-smoke-v7.mjs";

const SCRIPT_PATH = resolve(
  "scripts/idea-pilots/cooperscene-converter-cohort-smoke-v7.mjs",
);
const TEST_PATH = resolve(
  "test/cooperscene-converter-cohort-smoke-v7.test.mjs",
);
const AUDIT_PATH = resolve(
  "content/idea-audits/"
    + "cooperative-autonomous-driving-converter-cohort-execution-v7.json",
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fixtureRows() {
  return [
    {
      scenario: "1",
      timestamp: "10",
      egoAgentId: "2",
      cooperatorAgentIds: ["3", "0", "1"],
    },
    {
      scenario: "1",
      timestamp: "10",
      egoAgentId: "1",
      cooperatorAgentIds: ["3", "2", "0"],
    },
  ];
}

function assertCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof CohortEvidenceError);
    assert.equal(error.code, code);
    return true;
  });
}

test("actual cooperator rows canonicalize independently of input order", () => {
  const manifest = createGeneratedCooperatorManifest(fixtureRows());
  assert.equal(manifest.recordSchemaVersion, RECORD_SCHEMA_VERSION);
  assert.equal(manifest.split, "test");
  assert.deepEqual(
    manifest.records.map(recordKey),
    ["test/1/10/1", "test/1/10/2"],
  );
  assert.deepEqual(
    manifest.records[0].actualCooperatorAgentIds,
    ["0", "2", "3"],
  );
  assert.equal(
    manifest.manifests.keyManifestSha256,
    canonicalDigest(["test/1/10/1", "test/1/10/2"]),
  );
  assert.equal(
    manifest.manifests.actualCooperatorManifestSha256,
    canonicalDigest([
      {
        key: "test/1/10/1",
        actualCooperatorAgentIds: ["0", "2", "3"],
      },
      {
        key: "test/1/10/2",
        actualCooperatorAgentIds: ["0", "1", "3"],
      },
    ]),
  );
});

test("duplicate keys and non-canonical cooperator payloads fail closed", () => {
  const rows = fixtureRows();
  assertCode(
    () => createGeneratedCooperatorManifest([rows[0], rows[0]]),
    "DUPLICATE_KEY",
  );
  assertCode(
    () => createGeneratedCooperatorManifest([{
      ...rows[0],
      cooperatorAgentIds: ["0", "0", "1"],
    }]),
    "NON_CANONICAL_ACTUAL_COOPERATORS",
  );
  assertCode(
    () => createGeneratedCooperatorManifest([{
      ...rows[0],
      cooperatorAgentIds: ["0", "1", "2"],
    }]),
    "NON_CANONICAL_ACTUAL_COOPERATORS",
  );
});

test("checked v7 audit persists actual generated cooperator records", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
  assert.equal(audit.schemaVersion, CERTIFICATE_SCHEMA_VERSION);
  assert.equal(
    audit.certificateId,
    "cooperative-autonomous-driving-converter-cohort-execution-v7",
  );
  assert.equal(
    audit.result,
    "actual-generated-90-row-vehicle-ego-cooperator-manifest-persisted",
  );
  assert.equal(audit.fixedPublicConverter.fixedCommit, FIXED_COMMIT);
  assert.equal(audit.fixedPublicConverter.checkoutHead, FIXED_COMMIT);
  assert.equal(
    audit.fixedPublicConverter.sourceFilesUnchangedDuringRun,
    true,
  );
  assert.equal(
    audit.actualExecution.classification,
    "actual-public-converter-main-execution",
  );
  assert.equal(audit.actualExecution.converterExitCode, 0);
  assert.equal(audit.actualExecution.converterStderr, "");
  assert.equal(
    audit.actualExecution.restrictedPickleInspection.sourceField,
    "data_list[].cooperators[].agent_id",
  );
  assert.equal(
    audit.actualExecution.restrictedPickleInspection.classLookupPolicy,
    "deny-all",
  );
  assert.equal(
    audit.actualExecution.temporaryGeneratedPickleReadBeforeCleanup,
    true,
  );
  assert.equal(
    audit.actualExecution.temporaryDirectoryRemovedByV7RunnerAfterInspection,
    true,
  );

  const manifest = audit.generatedCooperatorManifest;
  assert.equal(manifest.recordSchemaVersion, RECORD_SCHEMA_VERSION);
  assert.equal(manifest.records.length, 90);
  assert.equal(new Set(manifest.records.map(recordKey)).size, 90);
  assert.equal(
    new Set(manifest.records.map((record) => [
      record.physicalEvent.scenario,
      record.physicalEvent.timestamp,
    ].join("/"))).size,
    30,
  );
  assert.deepEqual(manifest.records[0], {
    schemaVersion: RECORD_SCHEMA_VERSION,
    split: "test",
    physicalEvent: { scenario: "1", timestamp: "481410" },
    egoAgentId: "1",
    actualCooperatorAgentIds: ["0", "2", "3"],
  });
  assert.ok(manifest.records.every((record) => {
    const expected = ["0", "1", "2", "3"].filter(
      (agentId) => agentId !== record.egoAgentId,
    );
    return assert.deepEqual(
      record.actualCooperatorAgentIds,
      expected,
    ) === undefined;
  }));
  assert.equal(
    audit.observations.releasedProjectionUsedToPopulateCooperators,
    false,
  );
  assert.equal(
    audit.observations.availableAgentSetUsedAsCooperatorSubstitute,
    false,
  );
});

test("generated pickle and content-addressed manifests are mutually bound", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
  assert.equal(
    audit.artifactBindings.generatedTestPickleSha256,
    audit.actualExecution.restrictedPickleInspection.pickleSha256,
  );
  assert.equal(
    audit.artifactBindings.generatedPayloadSha256,
    audit.actualExecution.restrictedPickleInspection.payloadSha256,
  );
  assert.equal(
    audit.generatedCooperatorManifest.manifests.recordManifestSha256,
    canonicalDigest(audit.generatedCooperatorManifest.records),
  );
  assert.equal(
    audit.generatedCooperatorManifest.manifests
      .actualCooperatorManifestSha256,
    canonicalDigest(audit.generatedCooperatorManifest.records.map(
      (record) => ({
        key: recordKey(record),
        actualCooperatorAgentIds: record.actualCooperatorAgentIds,
      }),
    )),
  );
  assert.equal(verifyEvidence(audit), true);

  const mutated = structuredClone(audit);
  mutated.generatedCooperatorManifest.records[0]
    .actualCooperatorAgentIds.shift();
  assertCode(() => verifyEvidence(mutated), "CERTIFICATE_HASH_MISMATCH");
});

test("audit records all generated cohort negative controls", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
  assert.deepEqual(
    audit.negativeControls.map((control) => control.id),
    [
      "generated-actual-cooperator-drop",
      "generated-actual-cooperator-add",
      "generated-actual-cooperator-swap",
      "generated-key-duplicate",
      "generated-cooperator-duplicate",
      "generated-ego-in-cooperator-set",
    ],
  );
  assert.ok(audit.negativeControls.every((control) =>
    control.status === "passed"));
  assert.deepEqual(
    audit.negativeControls.slice(0, 3).map((control) =>
      control.observedCode),
    [
      "ACTUAL_COOPERATOR_SET_MISMATCH",
      "ACTUAL_COOPERATOR_SET_MISMATCH",
      "ACTUAL_COOPERATOR_SET_MISMATCH",
    ],
  );
  assert.deepEqual(
    audit.positiveControls.map((control) => control.id),
    ["generated-cooperator-order-permutation"],
  );
  assert.ok(audit.positiveControls.every((control) =>
    control.status === "passed"));
});

test("standalone verifier rejects rehashed manifest and control forgeries", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));

  const bindingForgery = structuredClone(audit);
  bindingForgery.artifactBindings.bindingManifestSha256 = "0".repeat(64);
  delete bindingForgery.certificateSha256;
  bindingForgery.certificateSha256 = canonicalDigest(bindingForgery);
  assertCode(() => verifyEvidence(bindingForgery), "MANIFEST_MISMATCH");

  const controlForgery = structuredClone(audit);
  controlForgery.negativeControls = [];
  delete controlForgery.certificateSha256;
  controlForgery.certificateSha256 = canonicalDigest(controlForgery);
  assertCode(
    () => verifyEvidence(controlForgery),
    "NEGATIVE_CONTROL_DID_NOT_FAIL_CLOSED",
  );
});

test("shim, stub, and unsupported-claim boundaries remain explicit", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
  assert.match(
    audit.inputBoundary.compatibilityClassification,
    /not an official CooperScene environment/,
  );
  assert.equal(audit.inputBoundary.realYamlCount, 120);
  assert.equal(audit.inputBoundary.pcdExistenceStubCount, 120);
  assert.equal(audit.inputBoundary.pngExistenceStubCount, 90);
  assert.equal(audit.inputBoundary.existenceStubBytes, 0);
  assert.equal(audit.inputBoundary.converterStubReadEvents, 0);
  assert.deepEqual(
    audit.inputBoundary.compatibilityModules.map((module) => module.name),
    ["mmengine.py", "tqdm.py"],
  );
  const boundary = audit.claimBoundary.join("\n");
  assert.match(boundary, /actualCooperatorAgentIds/);
  assert.match(boundary, /not an official CooperScene environment/);
  assert.match(boundary, /zero-byte existence stubs/);
  assert.match(boundary, /annotation.*AP.*ranking.*historical-generator/i);
  assert.doesNotMatch(
    audit.observations.cooperatorSource,
    /available-agent contract/i,
  );
});

test("checked audit binds the v7 runner and test bytes", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
  assert.equal(
    audit.reproducibility.runner.sha256,
    sha256(readFileSync(SCRIPT_PATH)),
  );
  assert.equal(
    audit.reproducibility.test.sha256,
    sha256(readFileSync(TEST_PATH)),
  );
  assert.equal(
    audit.actualExecution.delegatedRunnerSha256,
    sha256(readFileSync(resolve(
      "scripts/idea-pilots/cooperscene-converter-smoke.mjs",
    ))),
  );
});
