import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  CERTIFICATE_SCHEMA_VERSION,
  FIXED_COMMIT,
  PINNED_ARTIFACTS,
  PreflightError,
  buildCertificate,
  canonicalDigest,
  compareProjections,
  createProjection,
  deriveGeneratorProjection,
  deriveReleasedProjection,
  parsePinnedJson,
  readPinnedInputs,
  recordKey,
  runMandatoryGate,
  verifyCertificate,
} from "../scripts/idea-pilots/release-population-preflight-v7.mjs";

const SCRIPT_PATH = resolve(
  "scripts/idea-pilots/release-population-preflight-v7.mjs",
);
const TEST_PATH = resolve(
  "test/release-population-preflight-v7.test.mjs",
);
const CERTIFICATE_PATH = resolve(
  "content/idea-audits/"
    + "cooperative-autonomous-driving-release-population-preflight-v7.json",
);

const inputs = readPinnedInputs();

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function clone(value) {
  return structuredClone(value);
}

function projections() {
  return {
    released: deriveReleasedProjection({
      releaseLineageArtifact: inputs.releaseLineage.value,
      releaseLineageArtifactSha256: inputs.releaseLineage.sha256,
      releasedInspection: inputs.releasedPickle.inspection,
      releasedPickleSha256: inputs.releasedPickle.sha256,
    }),
    generator: deriveGeneratorProjection(inputs.generator.value, {
      artifactSha256: inputs.generator.sha256,
    }),
  };
}

function rebuild(projection, overrides = {}) {
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

function assertCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof PreflightError);
    assert.equal(error.code, code);
    return true;
  });
}

test("v7 inputs are pinned by exact byte count and SHA-256", () => {
  assert.equal(
    inputs.releaseLineage.bytes,
    PINNED_ARTIFACTS.releaseLineage.bytes,
  );
  assert.equal(
    inputs.releaseLineage.sha256,
    PINNED_ARTIFACTS.releaseLineage.sha256,
  );
  assert.equal(inputs.generator.bytes, PINNED_ARTIFACTS.generator.bytes);
  assert.equal(inputs.generator.sha256, PINNED_ARTIFACTS.generator.sha256);
  assert.equal(
    inputs.releasedPickle.bytes,
    PINNED_ARTIFACTS.releasedPickle.bytes,
  );
  assert.equal(
    inputs.releasedPickle.sha256,
    PINNED_ARTIFACTS.releasedPickle.sha256,
  );
});

test("independent actual cooperator exports pass for 90 vehicle egos", () => {
  const { released, generator } = projections();
  const gate = runMandatoryGate(released, generator, inputs);
  assert.equal(gate.result, "pass");
  assert.equal(
    gate.passedClaim,
    "90 vehicle-ego key plus actual per-row cooperator semantic parity "
      + "under pinned mini evidence",
  );
  assert.equal(gate.recordCount, 90);
  assert.equal(gate.physicalEventCount, 30);
  assert.deepEqual(gate.egoRowsByAgent, { 1: 30, 2: 30, 3: 30 });
  assert.deepEqual(gate.mandatoryChecks, {
    splitEqual: true,
    canonicalRecordKeySetEqual: true,
    actualPerRowCooperatorManifestEqual: true,
    canonicalMetainfoEqualAfterPinnedAlias: true,
    fixedCommitAndArtifactBindingsEqual: true,
  });
  assert.notEqual(released, generator);
  assert.notEqual(
    released.provenance.sourceArtifactSha256,
    generator.provenance.sourceArtifactSha256,
  );
  assert.match(
    released.provenance.actualCooperatorDerivation,
    /released pickle.*cooperators\[\]\.agent_id/i,
  );
  assert.match(
    released.provenance.actualCooperatorDerivation,
    /no generated records.*available-agent substitution/i,
  );
  assert.match(
    generator.provenance.actualCooperatorDerivation,
    /newly generated pickle.*cooperators\[\]\.agent_id/i,
  );
  assert.match(
    generator.provenance.actualCooperatorDerivation,
    /no released records.*available-agent substitution/i,
  );
  assert.equal(
    released.manifests.keyManifestSha256,
    generator.manifests.keyManifestSha256,
  );
  assert.equal(
    released.manifests.actualCooperatorManifestSha256,
    generator.manifests.actualCooperatorManifestSha256,
  );
  assert.deepEqual(released.records[0], generator.records[0]);
  assert.deepEqual(released.records[0], {
    schemaVersion:
      "cooperative-perception-physical-event-ego-actual-cooperators/v1",
    split: "test",
    physicalEvent: { scenario: "1", timestamp: "481410" },
    egoAgentId: "1",
    actualCooperatorAgentIds: ["0", "2", "3"],
  });
});

test("full 120 released rows still fail with 30 ego0 witnesses", () => {
  const released = deriveReleasedProjection({
    releaseLineageArtifact: inputs.releaseLineage.value,
    releaseLineageArtifactSha256: inputs.releaseLineage.sha256,
    releasedInspection: inputs.releasedPickle.inspection,
    releasedPickleSha256: inputs.releasedPickle.sha256,
    scope: "full-released",
  });
  const generator = deriveGeneratorProjection(inputs.generator.value, {
    artifactSha256: inputs.generator.sha256,
  });
  assert.throws(
    () => runMandatoryGate(released, generator, inputs),
    (error) => {
      assert.ok(error instanceof PreflightError);
      assert.equal(error.code, "CANONICAL_RECORD_SET_MISMATCH");
      assert.equal(error.witness.releasedRecordCount, 120);
      assert.equal(error.witness.generatorRecordCount, 90);
      assert.equal(error.witness.releasedOnlyCount, 30);
      assert.equal(error.witness.generatorOnlyCount, 0);
      assert.equal(error.witness.perEvent.length, 30);
      assert.deepEqual(
        error.witness.perEvent.map((item) =>
          item.physicalEvent.timestamp),
        Array.from({ length: 30 }, (_, index) => String(481410 + index)),
      );
      assert.ok(error.witness.perEvent.every((item) =>
        item.releasedOnlyEgoAgentIds.length === 1
          && item.releasedOnlyEgoAgentIds[0] === "0"
          && item.generatorOnlyEgoAgentIds.length === 0));
      return true;
    },
  );
});

test("generated cooperator drop, add, and swap fail at semantic parity", () => {
  const { released, generator } = projections();
  const mutations = [
    (records) => records[0].actualCooperatorAgentIds.shift(),
    (records) => records[0].actualCooperatorAgentIds.push("4"),
    (records) => {
      records[0].actualCooperatorAgentIds[0] = "4";
    },
  ];
  for (const mutate of mutations) {
    const records = clone(generator.records);
    mutate(records);
    assertCode(
      () => compareProjections(
        released,
        rebuild(generator, { records }),
      ),
      "ACTUAL_COOPERATOR_SET_MISMATCH",
    );
  }
});

test("released cooperator mutation fails with a row-key witness", () => {
  const { released, generator } = projections();
  const records = clone(released.records);
  records[0].actualCooperatorAgentIds.shift();
  assert.throws(
    () => compareProjections(
      rebuild(released, { records }),
      generator,
    ),
    (error) => {
      assert.equal(error.code, "ACTUAL_COOPERATOR_SET_MISMATCH");
      assert.equal(error.witness.key, "test/1/481410/1");
      assert.deepEqual(error.witness.released, ["2", "3"]);
      assert.deepEqual(error.witness.generator, ["0", "2", "3"]);
      return true;
    },
  );
});

test("key drop, key injection, and duplicate all fail closed", () => {
  const { released, generator } = projections();
  assertCode(
    () => compareProjections(
      released,
      rebuild(generator, { records: generator.records.slice(1) }),
    ),
    "CANONICAL_RECORD_SET_MISMATCH",
  );
  assertCode(
    () => compareProjections(
      released,
      rebuild(generator, {
        records: [
          ...generator.records,
          {
            ...clone(generator.records[0]),
            egoAgentId: "0",
            actualCooperatorAgentIds: ["1", "2", "3"],
          },
        ],
      }),
    ),
    "CANONICAL_RECORD_SET_MISMATCH",
  );
  assertCode(
    () => rebuild(generator, {
      records: [...generator.records, clone(generator.records[0])],
    }),
    "DUPLICATE_KEY",
  );
});

test("wrong hash, commit, and artifact binding fail closed", () => {
  const mutatedBuffer = Buffer.from(inputs.generator.buffer);
  mutatedBuffer[200] ^= 0x01;
  assertCode(
    () => parsePinnedJson(
      mutatedBuffer,
      PINNED_ARTIFACTS.generator.sha256,
      "mutated-generator",
    ),
    "SOURCE_ARTIFACT_HASH_MISMATCH",
  );

  const wrongCommit = clone(inputs.generator.value);
  wrongCommit.fixedPublicConverter.fixedCommit = "0".repeat(40);
  assertCode(
    () => deriveGeneratorProjection(wrongCommit),
    "WRONG_FIXED_COMMIT",
  );

  const { released, generator } = projections();
  const boundIdentity = clone(generator.boundIdentity);
  boundIdentity.releasedTestIndexSha256 = "0".repeat(64);
  assertCode(
    () => compareProjections(
      released,
      rebuild(generator, { boundIdentity }),
    ),
    "BOUND_IDENTITY_MISMATCH",
  );
});

test("either raw metainfo label mutation fails before aliasing", () => {
  const generatedMutation = clone(inputs.generator.value);
  generatedMutation.rawMetainfo.dataset = "OPV2V";
  assertCode(
    () => deriveGeneratorProjection(generatedMutation),
    "CERTIFICATE_HASH_MISMATCH",
  );

  const releasedMutation = clone(inputs.releasedPickle.inspection);
  releasedMutation.metainfo.dataset = "CooperScene";
  assertCode(
    () => deriveReleasedProjection({
      releaseLineageArtifact: inputs.releaseLineage.value,
      releaseLineageArtifactSha256: inputs.releaseLineage.sha256,
      releasedInspection: releasedMutation,
      releasedPickleSha256: inputs.releasedPickle.sha256,
    }),
    "METAINFO_SOURCE_MISMATCH",
  );
});

test("one-sided and forged-provenance projections cannot satisfy the source-bound gate", () => {
  const { released } = projections();
  assertCode(
    () => runMandatoryGate(released, released, inputs),
    "UNVERIFIED_PROJECTION",
  );

  const forged = rebuild(released, {
    role: "generator",
    rawMetainfo: {
      categories: { vehicle: 0 },
      classes: ["vehicle"],
      cooperative: true,
      dataset: "CooperScene",
      info_version: "1.0",
    },
    provenance: {
      ...clone(released.provenance),
      sourceArtifactRole:
        "actual-fixed-public-converter-generated-cooperator-manifest-v7",
      sourceArtifactSha256: inputs.generator.sha256,
      projectionScope: "actual-generated-vehicle-egos",
    },
  });
  assertCode(
    () => runMandatoryGate(released, forged, inputs),
    "UNVERIFIED_PROJECTION",
  );
});

test("full-released CLI emits ego0 witnesses and exits non-zero", () => {
  const result = spawnSync(
    process.execPath,
    [SCRIPT_PATH, "--scope", "full-released"],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  const failure = JSON.parse(result.stderr);
  assert.equal(failure.result, "fail");
  assert.equal(
    failure.error.code,
    "CANONICAL_RECORD_SET_MISMATCH",
  );
  assert.equal(failure.error.witness.perEvent.length, 30);
  assert.ok(failure.error.witness.perEvent.every((item) =>
    item.releasedOnlyEgoAgentIds.length === 1
      && item.releasedOnlyEgoAgentIds[0] === "0"));
});

test("checked certificate is content-addressed and narrowly claimed", () => {
  const certificate = JSON.parse(readFileSync(CERTIFICATE_PATH, "utf8"));
  assert.equal(certificate.schemaVersion, CERTIFICATE_SCHEMA_VERSION);
  assert.equal(
    certificate.canonicalContracts.fixedConverterCommit,
    FIXED_COMMIT,
  );
  assert.equal(certificate.mandatoryGate.result, "pass");
  assert.equal(certificate.mandatoryGate.recordCount, 90);
  assert.equal(
    certificate.mandatoryGate.passedClaim,
    "90 vehicle-ego key plus actual per-row cooperator semantic parity "
      + "under pinned mini evidence",
  );
  assert.equal(
    certificate.fullReleasedPopulationProbe.observedCode,
    "CANONICAL_RECORD_SET_MISMATCH",
  );
  assert.equal(
    certificate.fullReleasedPopulationProbe.witness.perEvent.length,
    30,
  );
  assert.deepEqual(certificate.metainfoComparison.rawMetainfoEquality, {
    result: "fail",
    equal: false,
    witness: {
      path: "$.dataset",
      released: "OPV2V",
      generator: "CooperScene",
    },
  });
  assert.equal(
    certificate.metainfoComparison.aliasApplication.silentMismatchSuppression,
    false,
  );
  assert.equal(
    certificate.extractionIndependence.released
      .availableAgentSetUsedAsCooperatorSubstitute,
    false,
  );
  assert.equal(
    certificate.extractionIndependence.generator
      .availableAgentSetUsedAsCooperatorSubstitute,
    false,
  );
  assert.match(
    certificate.conclusions.unsupported.join("\n"),
    /No annotation.*byte-for-byte/i,
  );
  assert.match(
    certificate.conclusions.unsupported.join("\n"),
    /No AP.*ranking.*paper result/i,
  );
  assert.match(
    certificate.conclusions.unsupported.join("\n"),
    /No historical generator/i,
  );
  assert.equal(certificate.integrityBoundary.signature, "none");
  assert.equal(verifyCertificate(certificate), true);
});

test("certificate records every mandatory negative control", () => {
  const certificate = JSON.parse(readFileSync(CERTIFICATE_PATH, "utf8"));
  assert.deepEqual(
    certificate.negativeControls.map((control) => control.id),
    [
      "generator-source-artifact-hash-mutation",
      "generated-cooperator-drop",
      "generated-cooperator-add",
      "generated-cooperator-swap",
      "released-cooperator-mutation",
      "key-drop",
      "key-injection",
      "duplicate-key",
      "generated-cooperator-duplicate",
      "generated-ego-in-cooperator-set",
      "released-cooperator-duplicate",
      "released-ego-in-cooperator-set",
      "wrong-fixed-converter-commit",
      "artifact-binding-mutation",
      "generated-raw-metainfo-mutation",
      "released-raw-metainfo-mutation",
      "one-sided-projection",
      "forged-distinct-provenance",
    ],
  );
  assert.ok(certificate.negativeControls.every((control) =>
    control.status === "passed"));
  assert.deepEqual(
    certificate.positiveControls.map((control) => control.id),
    ["cooperator-order-permutation"],
  );
});

test("standalone certificate verifier rejects rehashed semantic forgeries", () => {
  const certificate = JSON.parse(readFileSync(CERTIFICATE_PATH, "utf8"));

  const fullPopulationForgery = clone(certificate);
  fullPopulationForgery.fullReleasedPopulationProbe.result = "pass";
  fullPopulationForgery.negativeControls = [];
  delete fullPopulationForgery.certificateSha256;
  fullPopulationForgery.certificateSha256 = canonicalDigest(
    fullPopulationForgery,
  );
  assertCode(
    () => verifyCertificate(fullPopulationForgery),
    "CERTIFICATE_SEMANTIC_MISMATCH",
  );
});

test("certificate binds the v7 runner and test bytes", () => {
  const certificate = JSON.parse(readFileSync(CERTIFICATE_PATH, "utf8"));
  assert.equal(
    certificate.reproducibility.runner.sha256,
    sha256(readFileSync(SCRIPT_PATH)),
  );
  assert.equal(
    certificate.reproducibility.test.sha256,
    sha256(readFileSync(TEST_PATH)),
  );
  const regenerated = buildCertificate({
    inputs,
    generatedAt: certificate.generatedAt,
  });
  assert.deepEqual(regenerated, certificate);
});

test("projection records remain one-to-one by canonical key", () => {
  const { released, generator } = projections();
  assert.equal(new Set(released.records.map(recordKey)).size, 90);
  assert.equal(new Set(generator.records.map(recordKey)).size, 90);
});
