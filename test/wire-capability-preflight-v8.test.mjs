import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  CANDIDATE_ID,
  PreflightError,
  createEnvelope,
  fullContractAdmission,
  makeFixtures,
  modelConfigAdmission,
  runProbe,
  selectFallback,
  shapeOnlyAdmission,
  validateEnvelope,
  validateExecutionAudit,
  verifyArtifactBinding,
} from "../scripts/idea-pilots/wire-capability-preflight-v8.mjs";

const RUNNER_PATH = resolve(
  "scripts/idea-pilots/wire-capability-preflight-v8.mjs",
);
const AUDIT_PATH = resolve(
  "content/idea-audits/"
    + "cooperative-autonomous-driving-wire-capability-execution-gate-v8.json",
);
const RUNNER_SHA256 =
  "694625894253590eacdd96fef5b5338fb003f83b625be8c1b76e3afd2ca5b841";
const AUDIT_SHA256 =
  "6fdd8216b75c81231e60e458a8aaacbd14e35d449f47e3684979abc9b05bff9d";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function clone(value) {
  return structuredClone(value);
}

function assertCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof PreflightError);
    assert.equal(error.code, code);
    return true;
  });
}

test("test suite binds exact runner and execution-audit bytes", () => {
  const runner = readFileSync(RUNNER_PATH);
  const audit = readFileSync(AUDIT_PATH);
  assert.equal(runner.length, 40390);
  assert.equal(sha256(runner), RUNNER_SHA256);
  assert.equal(sha256(audit), AUDIT_SHA256);
});

test("legal manifest passes shape, allowlist, and full-contract admission", () => {
  const fixtures = makeFixtures();
  const envelope = createEnvelope(fixtures.manifest);
  const shape = shapeOnlyAdmission(envelope, fixtures.receiver);
  const allowlist = modelConfigAdmission(
    envelope,
    fixtures.receiver,
    fixtures.registry,
  );
  const full = fullContractAdmission(
    envelope,
    fixtures.receiver,
    fixtures.registry,
    fixtures.now,
  );
  assert.equal(shape.accepted, true);
  assert.equal(allowlist.accepted, true);
  assert.equal(full.accepted, true);
  assert.equal(full.reason, "REGISTERED_DIRECT_RELATION");
  assert.deepEqual(selectFallback(envelope, fixtures.receiver, full), {
    tier: "verified-intermediate",
    reason: "REGISTERED_DIRECT_RELATION",
    adapterId: null,
  });
});

test("same-shape semantic mismatch passes weak baselines and fails full contract", () => {
  const fixtures = makeFixtures();
  const manifest = clone(fixtures.manifest);
  manifest.feature.normalization = "channelwise-zscore/v2";
  manifest.sensor.calibrationEpoch = "unknown-rolling-epoch";
  manifest.spatial.transformProvenanceSha256 = "0".repeat(64);
  const envelope = createEnvelope(manifest);
  assert.equal(shapeOnlyAdmission(envelope, fixtures.receiver).accepted, true);
  assert.equal(
    modelConfigAdmission(envelope, fixtures.receiver, fixtures.registry).accepted,
    true,
  );
  const full = fullContractAdmission(
    envelope,
    fixtures.receiver,
    fixtures.registry,
    fixtures.now,
  );
  assert.equal(full.accepted, false);
  assert.equal(full.reason, "SEMANTIC_CONTRACT_MISMATCH");
  assert.equal(
    full.mismatches.some(({ field }) => field === "sensor.calibrationEpoch"),
    true,
  );
  assert.equal(
    full.mismatches.some(({ field }) =>
      field === "spatial.transformProvenanceSha256"),
    true,
  );
  assert.deepEqual(selectFallback(envelope, fixtures.receiver, full), {
    tier: "object-level",
    reason: "SEMANTIC_CONTRACT_MISMATCH",
    adapterId: null,
  });
});

test("registered adapter relation is accepted without hash equality", () => {
  const fixtures = makeFixtures();
  const manifest = clone(fixtures.manifest);
  manifest.producer.checkpointSha256 = fixtures.adapter.checkpointSha256;
  manifest.producer.configSha256 = fixtures.adapter.configSha256;
  manifest.feature.stride = 8;
  manifest.feature.shape = [320, 8, 8];
  manifest.feature.channelSemanticsSha256 =
    fixtures.adapter.channelSemanticsSha256;
  manifest.feature.normalization = "second-backbone-batchnorm/v1";
  manifest.compatibility.adapterIds = [fixtures.adapter.adapterId];
  const envelope = createEnvelope(manifest);
  assert.equal(shapeOnlyAdmission(envelope, fixtures.receiver).accepted, false);
  assert.equal(
    modelConfigAdmission(envelope, fixtures.receiver, fixtures.registry).accepted,
    false,
  );
  const full = fullContractAdmission(
    envelope,
    fixtures.receiver,
    fixtures.registry,
    fixtures.now,
  );
  assert.equal(full.accepted, true);
  assert.equal(full.reason, "REGISTERED_ADAPTER_RELATION");
  assert.equal(full.adapterId, fixtures.adapter.adapterId);
});

test("future issuance fails closed with no grace interval", () => {
  const fixtures = makeFixtures();
  const manifest = clone(fixtures.manifest);
  manifest.temporal.issuedAt = "2026-07-31T12:00:00.001Z";
  manifest.temporal.expiresAt = "2026-07-31T12:05:00.001Z";
  const envelope = createEnvelope(manifest);
  assertCode(
    () => fullContractAdmission(
      envelope,
      fixtures.receiver,
      fixtures.registry,
      fixtures.now,
    ),
    "FUTURE_MANIFEST",
  );
});

test("payload hash and byte drift fail before semantic admission", () => {
  const fixtures = makeFixtures();
  const envelope = createEnvelope(fixtures.manifest);
  const hashDrift = clone(fixtures.receiver);
  hashDrift.payloadSha256 = "0".repeat(64);
  assertCode(
    () => shapeOnlyAdmission(envelope, hashDrift),
    "PAYLOAD_HASH_DRIFT",
  );
  const sizeDrift = clone(fixtures.receiver);
  sizeDrift.payloadBytes += 1;
  assertCode(
    () => fullContractAdmission(
      envelope,
      sizeDrift,
      fixtures.registry,
      fixtures.now,
    ),
    "PAYLOAD_SIZE_DRIFT",
  );
});

test("tampered manifest digest fails before any admission decision", () => {
  const fixtures = makeFixtures();
  const envelope = createEnvelope(fixtures.manifest);
  envelope.manifest.feature.normalization = "mutated-after-signing";
  assertCode(() => validateEnvelope(envelope), "INTEGRITY_DIGEST_MISMATCH");
});

test("unknown manifest field fails closed", () => {
  const fixtures = makeFixtures();
  const manifest = clone(fixtures.manifest);
  manifest.feature.futureMeaning = "not-registered";
  assertCode(
    () => createEnvelope(manifest),
    "UNKNOWN_OR_MISSING_FIELD",
  );
});

test("unknown relation type fails closed", () => {
  const fixtures = makeFixtures();
  const registry = clone(fixtures.registry);
  registry.relations[0].relation = "implicit-conversion";
  const envelope = createEnvelope(fixtures.manifest);
  assertCode(
    () => fullContractAdmission(
      envelope,
      fixtures.receiver,
      registry,
      fixtures.now,
    ),
    "UNKNOWN_RELATION",
  );
});

test("unknown and misordered fallbacks fail closed", () => {
  const fixtures = makeFixtures();
  const unknown = clone(fixtures.manifest);
  unknown.fallbacks[0].tier = "unknown-fallback";
  assertCode(() => createEnvelope(unknown), "UNKNOWN_FALLBACK");

  const misordered = clone(fixtures.manifest);
  misordered.fallbacks.reverse();
  assertCode(() => createEnvelope(misordered), "FALLBACK_ORDER_MISMATCH");

  const envelope = createEnvelope(fixtures.manifest);
  assertCode(
    () => selectFallback(envelope, fixtures.receiver, {
      baseline: "full-contract",
      accepted: true,
      reason: "TRUST_ME",
      mismatches: [],
      adapterId: null,
    }),
    "UNKNOWN_ADMISSION_REASON",
  );
});

test("artifact byte and hash drift fail closed", () => {
  const pinned = { bytes: 40390, sha256: RUNNER_SHA256 };
  assert.equal(verifyArtifactBinding(clone(pinned), pinned), true);
  assertCode(
    () => verifyArtifactBinding({ ...pinned, bytes: 4328 }, pinned),
    "ARTIFACT_SIZE_DRIFT",
  );
  assertCode(
    () => verifyArtifactBinding({ ...pinned, sha256: "0".repeat(64) }, pinned),
    "ARTIFACT_HASH_DRIFT",
  );
});

test("probe contains every mandatory negative control", () => {
  const probe = runProbe();
  assert.equal(probe.candidateId, CANDIDATE_ID);
  assert.deepEqual(probe.failClosedControls, {
    futureManifest: "FUTURE_MANIFEST",
    payloadHashDrift: "PAYLOAD_HASH_DRIFT",
    tamperedManifestHash: "INTEGRITY_DIGEST_MISMATCH",
    unknownFallback: "UNKNOWN_FALLBACK",
    unknownRelation: "UNKNOWN_RELATION",
    unknownField: "UNKNOWN_OR_MISSING_FIELD",
  });
  assert.equal(
    probe.shapeCompatibleSemanticMismatch.selectedTier.tier,
    "object-level",
  );
  assert.equal(
    probe.registeredAdapterRelation.fullContract.accepted,
    true,
  );
});

test("execution audit is strict, current, and rejects the missing-asset gate", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
  validateExecutionAudit(audit, "2026-08-01T00:00:00.000Z");
  assert.equal(audit.verdict, "reject");
  assert.equal(audit.officialCodeExecuted.executed, true);
  assert.equal(audit.officialCodeExecuted.checkpointLoaded, false);
  assert.equal(audit.fixtureBoundary.taskEvidenceEligible, false);
  assert.equal(
    audit.checkpointAudit.officialNonSyntheticExecutablePairCount,
    0,
  );
  assert.equal(audit.results.perceptionBenefitClaimed, false);

  const unknown = clone(audit);
  unknown.futureField = true;
  assertCode(
    () => validateExecutionAudit(unknown, "2026-08-01T00:00:00.000Z"),
    "UNKNOWN_OR_MISSING_FIELD",
  );
  const future = clone(audit);
  future.checkedAt = "2026-08-01T00:00:00.001Z";
  assertCode(
    () => validateExecutionAudit(future, "2026-08-01T00:00:00.000Z"),
    "FUTURE_AUDIT",
  );
});

test("runner CLI emits the same deterministic probe", () => {
  const result = spawnSync(process.execPath, [RUNNER_PATH], {
    cwd: resolve("."),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), runProbe());
});
