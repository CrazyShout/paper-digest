import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  CERTIFICATE_SCHEMA_VERSION,
  FIXED_CONVERTER_COMMIT,
  PINNED_ARTIFACTS,
  PreflightError,
  buildCertificate,
  createProjection,
  deriveGeneratorProjection,
  deriveReleasedProjection,
  parsePinnedJson,
  readPinnedArtifacts,
  runMandatoryGate,
  verifyCertificate,
} from "../scripts/idea-pilots/release-population-preflight.mjs";

const SCRIPT_PATH = resolve(
  "scripts/idea-pilots/release-population-preflight.mjs",
);
const CERTIFICATE_PATH = resolve(
  "content/idea-audits/"
    + "cooperative-autonomous-driving-release-population-preflight-v6.json",
);

const artifacts = readPinnedArtifacts();

function clone(value) {
  return structuredClone(value);
}

function projections() {
  return {
    released: deriveReleasedProjection(artifacts.released.value, {
      artifactSha256: artifacts.released.sha256,
    }),
    generator: deriveGeneratorProjection(artifacts.generator.value, {
      artifactSha256: artifacts.generator.sha256,
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

function assertPreflightCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof PreflightError);
    assert.equal(error.code, code);
    return true;
  });
}

test("both source artifacts are pinned by their exact SHA-256", () => {
  assert.equal(artifacts.released.sha256, PINNED_ARTIFACTS.released.sha256);
  assert.equal(artifacts.generator.sha256, PINNED_ARTIFACTS.generator.sha256);
  assert.equal(artifacts.released.bytes, 207361);
  assert.equal(artifacts.generator.bytes, 22537);
});

test("independent released and actual-generator exports pass for 90 vehicle egos", () => {
  const { released, generator } = projections();
  const gate = runMandatoryGate(released, generator);

  assert.equal(gate.result, "pass");
  assert.equal(gate.recordCount, 90);
  assert.equal(gate.physicalEventCount, 30);
  assert.deepEqual(gate.egoRowsByAgent, { 1: 30, 2: 30, 3: 30 });
  assert.deepEqual(gate.mandatoryChecks, {
    canonicalRecordSetEqual: true,
    availableAgentCohortContractManifestEqual: true,
    canonicalMetainfoEqual: true,
    boundIdentityEqual: true,
  });
  assert.notEqual(released, generator);
  assert.notEqual(
    released.provenance.sourceArtifactSha256,
    generator.provenance.sourceArtifactSha256,
  );
  assert.match(released.provenance.derivation, /no v5 generated keys read/i);
  assert.match(generator.provenance.derivation, /no v4 released records read/i);
  assert.equal(
    released.manifests.recordManifestSha256,
    generator.manifests.recordManifestSha256,
  );
  assert.deepEqual(released.records[0], {
    schemaVersion:
      "cooperative-perception-physical-event-ego-available-agent-contract/v1",
    split: "test",
    physicalEvent: { scenario: "1", timestamp: "481410" },
    egoAgentId: "1",
    availableAgentCohortContractIds: ["0", "2", "3"],
  });
  assert.equal("cooperatorAgentIds" in released.records[0], false);
  assert.equal("cooperatorAgentIds" in generator.records[0], false);
});

test("full 120-row released population fails with ego0 for every event", () => {
  const released = deriveReleasedProjection(artifacts.released.value, {
    artifactSha256: artifacts.released.sha256,
    scope: "full-released",
  });
  const generator = deriveGeneratorProjection(artifacts.generator.value, {
    artifactSha256: artifacts.generator.sha256,
  });

  assert.throws(
    () => runMandatoryGate(released, generator),
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
        assert.deepEqual(item.releasedOnlyEgoAgentIds, ["0"]) === undefined));
      assert.ok(error.witness.perEvent.every((item) =>
        item.generatorOnlyEgoAgentIds.length === 0));
      return true;
    },
  );
});

test("source artifact hash mutation fails before JSON evidence is used", () => {
  const mutated = Buffer.from(artifacts.generator.buffer);
  mutated[100] ^= 0x01;
  assertPreflightCode(
    () => parsePinnedJson(
      mutated,
      PINNED_ARTIFACTS.generator.sha256,
      "mutated-generator",
    ),
    "SOURCE_ARTIFACT_HASH_MISMATCH",
  );
});

test("ego injection and drop both fail the canonical set gate", () => {
  const { released, generator } = projections();
  const first = generator.records[0];
  const injected = rebuild(generator, {
    records: [
      ...generator.records,
      {
        ...clone(first),
        egoAgentId: "0",
        availableAgentCohortContractIds: ["1", "2", "3"],
      },
    ],
  });
  const dropped = rebuild(generator, {
    records: generator.records.slice(1),
  });

  assertPreflightCode(
    () => runMandatoryGate(released, injected),
    "CANONICAL_RECORD_SET_MISMATCH",
  );
  assertPreflightCode(
    () => runMandatoryGate(released, dropped),
    "CANONICAL_RECORD_SET_MISMATCH",
  );
});

test("available-agent cohort contract mutation fails with a key witness", () => {
  const { released, generator } = projections();
  const records = clone(generator.records);
  records[0].availableAgentCohortContractIds = ["2", "3"];
  const mutated = rebuild(generator, { records });

  assert.throws(
    () => runMandatoryGate(released, mutated),
    (error) => {
      assert.equal(
        error.code,
        "AVAILABLE_AGENT_COHORT_CONTRACT_MISMATCH",
      );
      assert.equal(error.witness.key, "test/1/481410/1");
      assert.deepEqual(error.witness.released, ["0", "2", "3"]);
      assert.deepEqual(error.witness.generator, ["2", "3"]);
      return true;
    },
  );
});

test("metainfo mutation fails when keys and available-agent contracts match", () => {
  const { released, generator } = projections();
  const canonicalMetainfo = clone(generator.canonicalMetainfo);
  canonicalMetainfo.cooperative = false;
  const mutated = rebuild(generator, { canonicalMetainfo });

  assert.throws(
    () => runMandatoryGate(released, mutated),
    (error) => {
      assert.equal(error.code, "METAINFO_MISMATCH");
      assert.equal(
        error.witness.firstDifference.path,
        "$.cooperative",
      );
      return true;
    },
  );
});

test("the pinned metainfo alias rejects any unexpected raw label", () => {
  const mutated = clone(artifacts.generator.value);
  mutated.restrictedGeneratedIndexInspection.metainfo.dataset = "OPV2V";
  assertPreflightCode(
    () => deriveGeneratorProjection(mutated),
    "METAINFO_SOURCE_MISMATCH",
  );
});

test("duplicate key fails before a projection can reach the gate", () => {
  const { generator } = projections();
  assertPreflightCode(
    () => rebuild(generator, {
      records: [...generator.records, clone(generator.records[0])],
    }),
    "DUPLICATE_KEY",
  );
});

test("wrong converter commit fails the generator evidence export", () => {
  const mutated = clone(artifacts.generator.value);
  mutated.fixedPublicConverter.fixedCommit = "0".repeat(40);
  assertPreflightCode(
    () => deriveGeneratorProjection(mutated),
    "WRONG_FIXED_COMMIT",
  );
});

test("one-sided projection cannot satisfy the two-producer gate", () => {
  const { released } = projections();
  assertPreflightCode(
    () => runMandatoryGate(released, released),
    "ONE_SIDED_PROJECTION",
  );
});

test("full-released CLI emits a structured witness and exits non-zero", () => {
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

test("checked certificate is script-generated, content-addressed, and narrow", () => {
  const certificate = JSON.parse(readFileSync(CERTIFICATE_PATH, "utf8"));
  assert.equal(certificate.schemaVersion, CERTIFICATE_SCHEMA_VERSION);
  assert.equal(
    certificate.canonicalContracts.fixedConverterCommit,
    FIXED_CONVERTER_COMMIT,
  );
  assert.equal(certificate.mandatoryGate.result, "pass");
  assert.equal(certificate.mandatoryGate.recordCount, 90);
  assert.equal(
    certificate.fullReleasedPopulationProbe.observedCode,
    "CANONICAL_RECORD_SET_MISMATCH",
  );
  assert.equal(
    certificate.fullReleasedPopulationProbe.witness.perEvent.length,
    30,
  );
  assert.deepEqual(
    certificate.negativeControls.map((item) => item.id),
    [
      "source-artifact-hash-mutation",
      "ego-injection",
      "ego-drop",
      "cohort-mutation",
      "metainfo-mutation",
      "raw-metainfo-alias-input-mutation",
      "duplicate-key",
      "wrong-fixed-converter-commit",
      "one-sided-projection",
    ],
  );
  assert.ok(certificate.negativeControls.every((item) =>
    item.status === "passed"));
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
    certificate.metainfoComparison
      .aliasApplication
      .silentMismatchSuppression,
    false,
  );
  assert.equal(
    certificate.blockedClaims
      .actualGeneratedCooperatorManifestParity
      .status,
    "blocked",
  );
  assert.match(
    certificate.blockedClaims
      .actualGeneratedCooperatorManifestParity
      .prohibitedInference,
    /must not be described as actual generated cooperators/,
  );
  assert.doesNotMatch(
    certificate.conclusions.supported.join("\n"),
    /actual (?:generated )?cooperator/i,
  );
  assert.equal(certificate.integrityBoundary.signature, "none");
  assert.match(
    certificate.integrityBoundary.statement,
    /not an author, publisher, dataset-owner, or official identity signature/,
  );
  assert.match(
    certificate.conclusions.unsupported.join("\n"),
    /No AP.*ranking.*paper result/,
  );
  assert.match(
    certificate.conclusions.unsupported.join("\n"),
    /No historical generator/,
  );
  assert.equal(verifyCertificate(certificate), true);

  const regenerated = buildCertificate({
    artifacts,
    generatedAt: certificate.generatedAt,
  });
  assert.deepEqual(regenerated, certificate);
});
