#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CANDIDATE_ID = "rolling-model-wire-capability-negotiation";
export const MANIFEST_SCHEMA_VERSION = "wire-capability-manifest/v1";
export const REGISTRY_SCHEMA_VERSION = "wire-capability-registry/v1";
export const RECEIVER_SCHEMA_VERSION = "wire-capability-receiver/v1";
export const FALLBACK_PRIORITY = Object.freeze([
  "verified-intermediate",
  "raw-sensor",
  "object-level",
  "ego-only",
]);

const HEX_SHA256 = /^[0-9a-f]{64}$/;
const MANIFEST_KEYS = Object.freeze([
  "schemaVersion",
  "message",
  "task",
  "spatial",
  "temporal",
  "codec",
  "producer",
  "feature",
  "sensor",
  "compatibility",
  "fallbacks",
]);
const AUDIT_KEYS = Object.freeze([
  "schemaVersion",
  "auditId",
  "checkedAt",
  "candidateId",
  "fixedAssets",
  "environment",
  "officialCodeExecuted",
  "fixtureBoundary",
  "checkpointAudit",
  "tests",
  "results",
  "controls",
  "limitations",
  "hashes",
  "verdict",
  "nextActions",
]);

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

function clone(value) {
  return structuredClone(value);
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

function exactKeys(value, expected, location) {
  ensure(
    value && typeof value === "object" && !Array.isArray(value),
    "SCHEMA_VIOLATION",
    `${location} must be an object`,
  );
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  ensure(
    stableJson(actual) === stableJson(wanted),
    "UNKNOWN_OR_MISSING_FIELD",
    `${location} has unknown or missing fields`,
    { location, expected: wanted, actual },
  );
}

function requireString(value, location) {
  ensure(
    typeof value === "string" && value.length > 0,
    "SCHEMA_VIOLATION",
    `${location} must be a non-empty string`,
  );
  return value;
}

function requireInteger(value, location, { minimum = 0 } = {}) {
  ensure(
    Number.isSafeInteger(value) && value >= minimum,
    "SCHEMA_VIOLATION",
    `${location} must be an integer >= ${minimum}`,
  );
  return value;
}

function requireSha256(value, location, { nullable = false } = {}) {
  if (nullable && value === null) return value;
  ensure(
    typeof value === "string" && HEX_SHA256.test(value),
    "SCHEMA_VIOLATION",
    `${location} must be a lowercase SHA-256`,
  );
  return value;
}

function requireIsoInstant(value, location) {
  requireString(value, location);
  const milliseconds = Date.parse(value);
  ensure(
    Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value,
    "SCHEMA_VIOLATION",
    `${location} must be a canonical ISO-8601 UTC instant`,
  );
  return milliseconds;
}

function requireStringArray(value, location, { nonEmpty = false } = {}) {
  ensure(Array.isArray(value), "SCHEMA_VIOLATION", `${location} must be an array`);
  if (nonEmpty) {
    ensure(value.length > 0, "SCHEMA_VIOLATION", `${location} must not be empty`);
  }
  value.forEach((item, index) => requireString(item, `${location}[${index}]`));
  ensure(
    new Set(value).size === value.length,
    "SCHEMA_VIOLATION",
    `${location} must not contain duplicates`,
  );
  return value;
}

function requireShape(value, location) {
  ensure(
    Array.isArray(value) && value.length === 3,
    "SCHEMA_VIOLATION",
    `${location} must be a C/H/W triple`,
  );
  value.forEach((item, index) =>
    requireInteger(item, `${location}[${index}]`, { minimum: 1 }));
  return value;
}

function same(left, right) {
  return stableJson(left) === stableJson(right);
}

function exactValue(actual, expected, code, location) {
  ensure(
    same(actual, expected),
    code,
    `${location} does not match`,
    { location, expected, actual },
  );
}

function validateFallback(fallback, index) {
  const location = `manifest.fallbacks[${index}]`;
  exactKeys(
    fallback,
    ["tier", "schema", "decoderSha256", "bytes"],
    location,
  );
  requireString(fallback.tier, `${location}.tier`);
  ensure(
    FALLBACK_PRIORITY.slice(1).includes(fallback.tier),
    "UNKNOWN_FALLBACK",
    `${location}.tier is not registered`,
    { tier: fallback.tier },
  );
  requireString(fallback.schema, `${location}.schema`);
  requireSha256(fallback.decoderSha256, `${location}.decoderSha256`, {
    nullable: true,
  });
  requireInteger(fallback.bytes, `${location}.bytes`);
  if (fallback.tier === "raw-sensor") {
    ensure(
      fallback.decoderSha256 !== null,
      "SCHEMA_VIOLATION",
      "raw-sensor fallback requires an exact decoder digest",
    );
  }
  if (fallback.tier === "ego-only") {
    exactValue(fallback.bytes, 0, "SCHEMA_VIOLATION", `${location}.bytes`);
  }
}

export function validateManifestSchema(manifest) {
  exactKeys(manifest, MANIFEST_KEYS, "manifest");
  exactValue(
    manifest.schemaVersion,
    MANIFEST_SCHEMA_VERSION,
    "SCHEMA_VERSION_MISMATCH",
    "manifest.schemaVersion",
  );

  exactKeys(
    manifest.message,
    ["schema", "serialization", "payloadSha256", "payloadBytes"],
    "manifest.message",
  );
  requireString(manifest.message.schema, "manifest.message.schema");
  requireString(manifest.message.serialization, "manifest.message.serialization");
  requireSha256(manifest.message.payloadSha256, "manifest.message.payloadSha256");
  requireInteger(manifest.message.payloadBytes, "manifest.message.payloadBytes", {
    minimum: 1,
  });

  exactKeys(manifest.task, ["id", "outputOntology"], "manifest.task");
  requireString(manifest.task.id, "manifest.task.id");
  requireString(manifest.task.outputOntology, "manifest.task.outputOntology");

  exactKeys(
    manifest.spatial,
    ["coordinateFrame", "transformProvenanceSha256"],
    "manifest.spatial",
  );
  requireString(manifest.spatial.coordinateFrame, "manifest.spatial.coordinateFrame");
  requireSha256(
    manifest.spatial.transformProvenanceSha256,
    "manifest.spatial.transformProvenanceSha256",
  );

  exactKeys(
    manifest.temporal,
    ["clockDomain", "referenceInstant", "issuedAt", "expiresAt", "maxAgeMs"],
    "manifest.temporal",
  );
  requireString(manifest.temporal.clockDomain, "manifest.temporal.clockDomain");
  requireString(
    manifest.temporal.referenceInstant,
    "manifest.temporal.referenceInstant",
  );
  const issuedAt = requireIsoInstant(
    manifest.temporal.issuedAt,
    "manifest.temporal.issuedAt",
  );
  const expiresAt = requireIsoInstant(
    manifest.temporal.expiresAt,
    "manifest.temporal.expiresAt",
  );
  ensure(
    expiresAt >= issuedAt,
    "INVALID_TIME_WINDOW",
    "manifest expiration precedes issuance",
  );
  requireInteger(manifest.temporal.maxAgeMs, "manifest.temporal.maxAgeMs", {
    minimum: 1,
  });

  exactKeys(
    manifest.codec,
    ["id", "parametersSha256", "codebookSha256"],
    "manifest.codec",
  );
  requireString(manifest.codec.id, "manifest.codec.id");
  requireSha256(manifest.codec.parametersSha256, "manifest.codec.parametersSha256");
  requireSha256(manifest.codec.codebookSha256, "manifest.codec.codebookSha256", {
    nullable: true,
  });

  exactKeys(
    manifest.producer,
    ["modelFamily", "checkpointSha256", "configSha256"],
    "manifest.producer",
  );
  requireString(manifest.producer.modelFamily, "manifest.producer.modelFamily");
  requireSha256(
    manifest.producer.checkpointSha256,
    "manifest.producer.checkpointSha256",
  );
  requireSha256(manifest.producer.configSha256, "manifest.producer.configSha256");

  exactKeys(
    manifest.feature,
    [
      "stage",
      "stride",
      "shape",
      "channelSemanticsSha256",
      "quantization",
      "normalization",
    ],
    "manifest.feature",
  );
  requireString(manifest.feature.stage, "manifest.feature.stage");
  requireInteger(manifest.feature.stride, "manifest.feature.stride", { minimum: 1 });
  requireShape(manifest.feature.shape, "manifest.feature.shape");
  requireSha256(
    manifest.feature.channelSemanticsSha256,
    "manifest.feature.channelSemanticsSha256",
  );
  requireString(manifest.feature.quantization, "manifest.feature.quantization");
  requireString(manifest.feature.normalization, "manifest.feature.normalization");

  exactKeys(
    manifest.sensor,
    ["calibrationBundleSha256", "calibrationEpoch"],
    "manifest.sensor",
  );
  requireSha256(
    manifest.sensor.calibrationBundleSha256,
    "manifest.sensor.calibrationBundleSha256",
  );
  requireString(manifest.sensor.calibrationEpoch, "manifest.sensor.calibrationEpoch");

  exactKeys(
    manifest.compatibility,
    ["receiverFamilies", "adapterIds"],
    "manifest.compatibility",
  );
  requireStringArray(
    manifest.compatibility.receiverFamilies,
    "manifest.compatibility.receiverFamilies",
    { nonEmpty: true },
  );
  requireStringArray(
    manifest.compatibility.adapterIds,
    "manifest.compatibility.adapterIds",
  );

  ensure(
    Array.isArray(manifest.fallbacks),
    "SCHEMA_VIOLATION",
    "manifest.fallbacks must be an array",
  );
  manifest.fallbacks.forEach(validateFallback);
  const fallbackTiers = manifest.fallbacks.map(({ tier }) => tier);
  ensure(
    new Set(fallbackTiers).size === fallbackTiers.length,
    "SCHEMA_VIOLATION",
    "manifest fallback tiers must be unique",
  );
  const priorityIndexes = fallbackTiers.map((tier) =>
    FALLBACK_PRIORITY.indexOf(tier));
  ensure(
    same(priorityIndexes, [...priorityIndexes].sort((a, b) => a - b)),
    "FALLBACK_ORDER_MISMATCH",
    "manifest fallbacks must follow the fixed safety priority",
  );
  return manifest;
}

export function createEnvelope(manifest) {
  validateManifestSchema(manifest);
  return {
    manifest: clone(manifest),
    manifestSha256: canonicalDigest(manifest),
  };
}

export function validateEnvelope(envelope) {
  exactKeys(envelope, ["manifest", "manifestSha256"], "envelope");
  requireSha256(envelope.manifestSha256, "envelope.manifestSha256");
  validateManifestSchema(envelope.manifest);
  exactValue(
    canonicalDigest(envelope.manifest),
    envelope.manifestSha256,
    "INTEGRITY_DIGEST_MISMATCH",
    "envelope manifest digest",
  );
  return envelope.manifest;
}

function validateReceiver(receiver) {
  exactKeys(
    receiver,
    [
      "schemaVersion",
      "family",
      "checkpointSha256",
      "configSha256",
      "messageSchema",
      "serialization",
      "taskId",
      "outputOntology",
      "coordinateFrame",
      "transformProvenanceSha256",
      "clockDomain",
      "referenceInstant",
      "codecId",
      "codecParametersSha256",
      "codebookSha256",
      "featureStage",
      "featureStride",
      "expectedShape",
      "channelSemanticsSha256",
      "quantization",
      "normalization",
      "calibrationBundleSha256",
      "calibrationEpoch",
      "payloadSha256",
      "payloadBytes",
      "supportedFallbacks",
    ],
    "receiver",
  );
  exactValue(
    receiver.schemaVersion,
    RECEIVER_SCHEMA_VERSION,
    "SCHEMA_VERSION_MISMATCH",
    "receiver.schemaVersion",
  );
  [
    "family",
    "messageSchema",
    "serialization",
    "taskId",
    "outputOntology",
    "coordinateFrame",
    "clockDomain",
    "referenceInstant",
    "codecId",
    "featureStage",
    "quantization",
    "normalization",
    "calibrationEpoch",
  ].forEach((key) => requireString(receiver[key], `receiver.${key}`));
  [
    "checkpointSha256",
    "configSha256",
    "codecParametersSha256",
    "channelSemanticsSha256",
    "calibrationBundleSha256",
    "payloadSha256",
    "transformProvenanceSha256",
  ].forEach((key) => requireSha256(receiver[key], `receiver.${key}`));
  requireSha256(receiver.codebookSha256, "receiver.codebookSha256", {
    nullable: true,
  });
  requireInteger(receiver.featureStride, "receiver.featureStride", { minimum: 1 });
  requireShape(receiver.expectedShape, "receiver.expectedShape");
  requireInteger(receiver.payloadBytes, "receiver.payloadBytes", { minimum: 1 });
  ensure(
    Array.isArray(receiver.supportedFallbacks),
    "SCHEMA_VIOLATION",
    "receiver.supportedFallbacks must be an array",
  );
  receiver.supportedFallbacks.forEach((fallback, index) => {
    const location = `receiver.supportedFallbacks[${index}]`;
    exactKeys(
      fallback,
      ["tier", "schema", "decoderSha256", "maxBytes"],
      location,
    );
    requireString(fallback.tier, `${location}.tier`);
    ensure(
      FALLBACK_PRIORITY.slice(1).includes(fallback.tier),
      "UNKNOWN_FALLBACK",
      `${location}.tier is not registered`,
    );
    requireString(fallback.schema, `${location}.schema`);
    requireSha256(fallback.decoderSha256, `${location}.decoderSha256`, {
      nullable: true,
    });
    requireInteger(fallback.maxBytes, `${location}.maxBytes`);
  });
  return receiver;
}

function validateRegistry(registry) {
  exactKeys(
    registry,
    ["schemaVersion", "modelConfigAllowlist", "relations"],
    "registry",
  );
  exactValue(
    registry.schemaVersion,
    REGISTRY_SCHEMA_VERSION,
    "SCHEMA_VERSION_MISMATCH",
    "registry.schemaVersion",
  );
  ensure(
    Array.isArray(registry.modelConfigAllowlist),
    "SCHEMA_VIOLATION",
    "registry.modelConfigAllowlist must be an array",
  );
  registry.modelConfigAllowlist.forEach((entry, index) => {
    const location = `registry.modelConfigAllowlist[${index}]`;
    exactKeys(
      entry,
      ["producerModelFamily", "producerConfigSha256", "receiverFamily"],
      location,
    );
    requireString(entry.producerModelFamily, `${location}.producerModelFamily`);
    requireSha256(entry.producerConfigSha256, `${location}.producerConfigSha256`);
    requireString(entry.receiverFamily, `${location}.receiverFamily`);
  });
  ensure(
    Array.isArray(registry.relations),
    "SCHEMA_VIOLATION",
    "registry.relations must be an array",
  );
  registry.relations.forEach((relation, index) => {
    const location = `registry.relations[${index}]`;
    exactKeys(
      relation,
      [
        "relation",
        "producerCheckpointSha256",
        "producerConfigSha256",
        "receiverFamily",
        "receiverCheckpointSha256",
        "receiverConfigSha256",
        "adapterId",
        "adapterSha256",
        "producerStage",
        "producerStride",
        "producerShape",
        "producerChannelSemanticsSha256",
        "producerQuantization",
        "producerNormalization",
        "receiverStage",
        "receiverStride",
        "receiverShape",
        "receiverChannelSemanticsSha256",
        "receiverQuantization",
        "receiverNormalization",
      ],
      location,
    );
    ensure(
      relation.relation === "direct" || relation.relation === "adapter",
      "UNKNOWN_RELATION",
      `${location}.relation is not registered`,
      { relation: relation.relation },
    );
    [
      "producerCheckpointSha256",
      "producerConfigSha256",
      "receiverCheckpointSha256",
      "receiverConfigSha256",
      "producerChannelSemanticsSha256",
      "receiverChannelSemanticsSha256",
    ].forEach((key) => requireSha256(relation[key], `${location}.${key}`));
    requireSha256(relation.adapterSha256, `${location}.adapterSha256`, {
      nullable: true,
    });
    [
      "receiverFamily",
      "producerStage",
      "producerQuantization",
      "producerNormalization",
      "receiverStage",
      "receiverQuantization",
      "receiverNormalization",
    ].forEach((key) => requireString(relation[key], `${location}.${key}`));
    requireInteger(relation.producerStride, `${location}.producerStride`, {
      minimum: 1,
    });
    requireInteger(relation.receiverStride, `${location}.receiverStride`, {
      minimum: 1,
    });
    requireShape(relation.producerShape, `${location}.producerShape`);
    requireShape(relation.receiverShape, `${location}.receiverShape`);
    if (relation.relation === "adapter") {
      requireString(relation.adapterId, `${location}.adapterId`);
      ensure(
        relation.adapterSha256 !== null,
        "SCHEMA_VIOLATION",
        "adapter relation requires adapterSha256",
      );
    } else {
      exactValue(relation.adapterId, null, "SCHEMA_VIOLATION", `${location}.adapterId`);
      exactValue(
        relation.adapterSha256,
        null,
        "SCHEMA_VIOLATION",
        `${location}.adapterSha256`,
      );
    }
  });
  return registry;
}

function verifyFreshness(manifest, now) {
  const nowMs = requireIsoInstant(now, "now");
  const issuedAt = Date.parse(manifest.temporal.issuedAt);
  const expiresAt = Date.parse(manifest.temporal.expiresAt);
  ensure(
    issuedAt <= nowMs,
    "FUTURE_MANIFEST",
    "manifest issuance is in the future",
    { issuedAt: manifest.temporal.issuedAt, now },
  );
  ensure(
    nowMs <= expiresAt,
    "EXPIRED_MANIFEST",
    "manifest has expired",
    { expiresAt: manifest.temporal.expiresAt, now },
  );
  ensure(
    nowMs - issuedAt <= manifest.temporal.maxAgeMs,
    "STALE_MANIFEST",
    "manifest exceeds its declared freshness policy",
  );
}

function verifyPayload(manifest, receiver) {
  exactValue(
    manifest.message.payloadSha256,
    receiver.payloadSha256,
    "PAYLOAD_HASH_DRIFT",
    "received payload SHA-256",
  );
  exactValue(
    manifest.message.payloadBytes,
    receiver.payloadBytes,
    "PAYLOAD_SIZE_DRIFT",
    "received payload bytes",
  );
}

export function verifyArtifactBinding(observed, pinned) {
  exactKeys(observed, ["bytes", "sha256"], "observed artifact");
  exactKeys(pinned, ["bytes", "sha256"], "pinned artifact");
  requireInteger(observed.bytes, "observed artifact bytes", { minimum: 1 });
  requireInteger(pinned.bytes, "pinned artifact bytes", { minimum: 1 });
  requireSha256(observed.sha256, "observed artifact SHA-256");
  requireSha256(pinned.sha256, "pinned artifact SHA-256");
  exactValue(
    observed.bytes,
    pinned.bytes,
    "ARTIFACT_SIZE_DRIFT",
    "artifact bytes",
  );
  exactValue(
    observed.sha256,
    pinned.sha256,
    "ARTIFACT_HASH_DRIFT",
    "artifact SHA-256",
  );
  return true;
}

export function shapeOnlyAdmission(envelope, receiver) {
  const manifest = validateEnvelope(envelope);
  validateReceiver(receiver);
  verifyPayload(manifest, receiver);
  const accepted = same(manifest.feature.shape, receiver.expectedShape);
  return {
    baseline: "shape-only",
    accepted,
    reason: accepted ? "SHAPE_MATCH" : "SHAPE_MISMATCH",
  };
}

export function modelConfigAdmission(envelope, receiver, registry) {
  const manifest = validateEnvelope(envelope);
  validateReceiver(receiver);
  validateRegistry(registry);
  verifyPayload(manifest, receiver);
  const shapeMatch = same(manifest.feature.shape, receiver.expectedShape);
  const allowed = registry.modelConfigAllowlist.some((entry) =>
    entry.producerModelFamily === manifest.producer.modelFamily
      && entry.producerConfigSha256 === manifest.producer.configSha256
      && entry.receiverFamily === receiver.family);
  return {
    baseline: "model-config-allowlist",
    accepted: shapeMatch && allowed,
    reason: shapeMatch && allowed ? "ALLOWLIST_MATCH" : "ALLOWLIST_MISS",
  };
}

function relationIdentityMatches(relation, manifest, receiver) {
  return relation.producerCheckpointSha256 === manifest.producer.checkpointSha256
    && relation.producerConfigSha256 === manifest.producer.configSha256
    && relation.receiverFamily === receiver.family
    && relation.receiverCheckpointSha256 === receiver.checkpointSha256
    && relation.receiverConfigSha256 === receiver.configSha256;
}

function relationSemanticsMatch(relation, manifest, receiver) {
  return same(
    {
      stage: relation.producerStage,
      stride: relation.producerStride,
      shape: relation.producerShape,
      channelSemanticsSha256: relation.producerChannelSemanticsSha256,
      quantization: relation.producerQuantization,
      normalization: relation.producerNormalization,
    },
    manifest.feature,
  ) && same(
    {
      stage: relation.receiverStage,
      stride: relation.receiverStride,
      shape: relation.receiverShape,
      channelSemanticsSha256: relation.receiverChannelSemanticsSha256,
      quantization: relation.receiverQuantization,
      normalization: relation.receiverNormalization,
    },
    {
      stage: receiver.featureStage,
      stride: receiver.featureStride,
      shape: receiver.expectedShape,
      channelSemanticsSha256: receiver.channelSemanticsSha256,
      quantization: receiver.quantization,
      normalization: receiver.normalization,
    },
  );
}

function commonContractMismatches(manifest, receiver) {
  const pairs = [
    ["message.schema", manifest.message.schema, receiver.messageSchema],
    ["message.serialization", manifest.message.serialization, receiver.serialization],
    ["task.id", manifest.task.id, receiver.taskId],
    ["task.outputOntology", manifest.task.outputOntology, receiver.outputOntology],
    ["spatial.coordinateFrame", manifest.spatial.coordinateFrame, receiver.coordinateFrame],
    [
      "spatial.transformProvenanceSha256",
      manifest.spatial.transformProvenanceSha256,
      receiver.transformProvenanceSha256,
    ],
    ["temporal.clockDomain", manifest.temporal.clockDomain, receiver.clockDomain],
    ["temporal.referenceInstant", manifest.temporal.referenceInstant, receiver.referenceInstant],
    ["codec.id", manifest.codec.id, receiver.codecId],
    [
      "codec.parametersSha256",
      manifest.codec.parametersSha256,
      receiver.codecParametersSha256,
    ],
    ["codec.codebookSha256", manifest.codec.codebookSha256, receiver.codebookSha256],
    [
      "sensor.calibrationBundleSha256",
      manifest.sensor.calibrationBundleSha256,
      receiver.calibrationBundleSha256,
    ],
    [
      "sensor.calibrationEpoch",
      manifest.sensor.calibrationEpoch,
      receiver.calibrationEpoch,
    ],
  ];
  return pairs.filter(([, actual, expected]) => !same(actual, expected))
    .map(([field, actual, expected]) => ({ field, actual, expected }));
}

export function fullContractAdmission(envelope, receiver, registry, now) {
  const manifest = validateEnvelope(envelope);
  validateReceiver(receiver);
  validateRegistry(registry);
  verifyPayload(manifest, receiver);
  verifyFreshness(manifest, now);

  const commonMismatches = commonContractMismatches(manifest, receiver);
  if (commonMismatches.length > 0) {
    return {
      baseline: "full-contract",
      accepted: false,
      reason: "SEMANTIC_CONTRACT_MISMATCH",
      mismatches: commonMismatches,
      adapterId: null,
    };
  }
  if (!manifest.compatibility.receiverFamilies.includes(receiver.family)) {
    return {
      baseline: "full-contract",
      accepted: false,
      reason: "RECEIVER_FAMILY_NOT_DECLARED",
      mismatches: [],
      adapterId: null,
    };
  }

  const identityRelations = registry.relations.filter((relation) =>
    relationIdentityMatches(relation, manifest, receiver));
  if (identityRelations.length === 0) {
    return {
      baseline: "full-contract",
      accepted: false,
      reason: "UNREGISTERED_RELATION",
      mismatches: [],
      adapterId: null,
    };
  }
  const relation = identityRelations.find((candidate) =>
    relationSemanticsMatch(candidate, manifest, receiver));
  if (!relation) {
    return {
      baseline: "full-contract",
      accepted: false,
      reason: "SEMANTIC_CONTRACT_MISMATCH",
      mismatches: [{ field: "feature", actual: manifest.feature, expected: "registered relation" }],
      adapterId: null,
    };
  }
  if (relation.relation === "adapter"
      && !manifest.compatibility.adapterIds.includes(relation.adapterId)) {
    return {
      baseline: "full-contract",
      accepted: false,
      reason: "ADAPTER_NOT_DECLARED",
      mismatches: [],
      adapterId: null,
    };
  }
  return {
    baseline: "full-contract",
    accepted: true,
    reason: relation.relation === "adapter"
      ? "REGISTERED_ADAPTER_RELATION"
      : "REGISTERED_DIRECT_RELATION",
    mismatches: [],
    adapterId: relation.adapterId,
  };
}

export function selectFallback(envelope, receiver, admission) {
  const manifest = validateEnvelope(envelope);
  validateReceiver(receiver);
  exactKeys(
    admission,
    ["baseline", "accepted", "reason", "mismatches", "adapterId"],
    "full admission result",
  );
  exactValue(
    admission.baseline,
    "full-contract",
    "INVALID_ADMISSION_RESULT",
    "admission baseline",
  );
  ensure(
    typeof admission.accepted === "boolean",
    "INVALID_ADMISSION_RESULT",
    "admission accepted must be boolean",
  );
  const acceptedReasons = new Set([
    "REGISTERED_DIRECT_RELATION",
    "REGISTERED_ADAPTER_RELATION",
  ]);
  const rejectedReasons = new Set([
    "SEMANTIC_CONTRACT_MISMATCH",
    "RECEIVER_FAMILY_NOT_DECLARED",
    "UNREGISTERED_RELATION",
    "ADAPTER_NOT_DECLARED",
  ]);
  ensure(
    (admission.accepted && acceptedReasons.has(admission.reason))
      || (!admission.accepted && rejectedReasons.has(admission.reason)),
    "UNKNOWN_ADMISSION_REASON",
    "admission reason is unknown or inconsistent with its decision",
    { accepted: admission.accepted, reason: admission.reason },
  );
  ensure(
    Array.isArray(admission.mismatches),
    "INVALID_ADMISSION_RESULT",
    "admission mismatches must be an array",
  );
  if (admission.reason === "REGISTERED_ADAPTER_RELATION") {
    requireString(admission.adapterId, "admission.adapterId");
  } else {
    exactValue(
      admission.adapterId,
      null,
      "INVALID_ADMISSION_RESULT",
      "admission.adapterId",
    );
  }
  if (admission.accepted) {
    return {
      tier: "verified-intermediate",
      reason: admission.reason,
      adapterId: admission.adapterId,
    };
  }

  for (const tier of FALLBACK_PRIORITY.slice(1)) {
    const offered = manifest.fallbacks.find((fallback) => fallback.tier === tier);
    const supported = receiver.supportedFallbacks.find((fallback) =>
      fallback.tier === tier);
    if (!offered || !supported) continue;
    if (offered.schema !== supported.schema || offered.bytes > supported.maxBytes) {
      continue;
    }
    if (tier === "raw-sensor"
        && offered.decoderSha256 !== supported.decoderSha256) {
      continue;
    }
    return { tier, reason: admission.reason, adapterId: null };
  }
  return { tier: "hard-reject", reason: admission.reason, adapterId: null };
}

function digestLabel(label) {
  return sha256(Buffer.from(`wire-capability-v8:${label}`, "utf8"));
}

export function makeFixtures() {
  const payloadSha256 = digestLabel("payload");
  const receiverCheckpointSha256 = digestLabel("receiver-checkpoint");
  const receiverConfigSha256 = digestLabel("receiver-config");
  const directChannelSemanticsSha256 = digestLabel("channels-direct");
  const adapterChannelSemanticsSha256 = digestLabel("channels-adapter-source");
  const calibrationBundleSha256 = digestLabel("calibration-bundle");
  const rawDecoderSha256 = digestLabel("raw-decoder-receiver");
  const offeredWrongRawDecoderSha256 = digestLabel("raw-decoder-producer");
  const directCheckpointSha256 = digestLabel("producer-direct-checkpoint");
  const directConfigSha256 = digestLabel("producer-direct-config");
  const adapterCheckpointSha256 = digestLabel("producer-adapter-checkpoint");
  const adapterConfigSha256 = digestLabel("producer-adapter-config");
  const adapterId = "mpda-pp320-to-v2xvit256/v1";

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    message: {
      schema: "mpda-feature-array/v1",
      serialization: "numpy-npz-arr0",
      payloadSha256,
      payloadBytes: 1048576,
    },
    task: {
      id: "cooperative-3d-object-detection",
      outputOntology: "v2xset-vehicle-boxes/v1",
    },
    spatial: {
      coordinateFrame: "ego-lidar-right-handed/v1",
      transformProvenanceSha256: digestLabel("transform-provenance"),
    },
    temporal: {
      clockDomain: "v2xset-scenario-clock/v1",
      referenceInstant: "lidar-capture-end",
      issuedAt: "2026-07-31T11:59:30.000Z",
      expiresAt: "2026-07-31T12:04:30.000Z",
      maxAgeMs: 60000,
    },
    codec: {
      id: "npz-deflate-arr0",
      parametersSha256: digestLabel("npz-parameters"),
      codebookSha256: null,
    },
    producer: {
      modelFamily: "mpda-pointpillar-v2xvit",
      checkpointSha256: directCheckpointSha256,
      configSha256: directConfigSha256,
    },
    feature: {
      stage: "bev-backbone-shrink-output",
      stride: 4,
      shape: [256, 16, 16],
      channelSemanticsSha256: directChannelSemanticsSha256,
      quantization: "float32-le",
      normalization: "training-batchnorm-frozen/v1",
    },
    sensor: {
      calibrationBundleSha256,
      calibrationEpoch: "v2xset-release-2022",
    },
    compatibility: {
      receiverFamilies: ["mpda-v2xvit-naive"],
      adapterIds: [],
    },
    fallbacks: [
      {
        tier: "raw-sensor",
        schema: "v2xset-lidar-bin/v1",
        decoderSha256: offeredWrongRawDecoderSha256,
        bytes: 800000,
      },
      {
        tier: "object-level",
        schema: "etsi-cpm-object-subset/v2",
        decoderSha256: null,
        bytes: 24000,
      },
      {
        tier: "ego-only",
        schema: "local-perception/v1",
        decoderSha256: null,
        bytes: 0,
      },
    ],
  };

  const receiver = {
    schemaVersion: RECEIVER_SCHEMA_VERSION,
    family: "mpda-v2xvit-naive",
    checkpointSha256: receiverCheckpointSha256,
    configSha256: receiverConfigSha256,
    messageSchema: manifest.message.schema,
    serialization: manifest.message.serialization,
    taskId: manifest.task.id,
    outputOntology: manifest.task.outputOntology,
    coordinateFrame: manifest.spatial.coordinateFrame,
    transformProvenanceSha256: manifest.spatial.transformProvenanceSha256,
    clockDomain: manifest.temporal.clockDomain,
    referenceInstant: manifest.temporal.referenceInstant,
    codecId: manifest.codec.id,
    codecParametersSha256: manifest.codec.parametersSha256,
    codebookSha256: null,
    featureStage: manifest.feature.stage,
    featureStride: manifest.feature.stride,
    expectedShape: clone(manifest.feature.shape),
    channelSemanticsSha256: directChannelSemanticsSha256,
    quantization: manifest.feature.quantization,
    normalization: manifest.feature.normalization,
    calibrationBundleSha256,
    calibrationEpoch: manifest.sensor.calibrationEpoch,
    payloadSha256,
    payloadBytes: manifest.message.payloadBytes,
    supportedFallbacks: [
      {
        tier: "raw-sensor",
        schema: "v2xset-lidar-bin/v1",
        decoderSha256: rawDecoderSha256,
        maxBytes: 900000,
      },
      {
        tier: "object-level",
        schema: "etsi-cpm-object-subset/v2",
        decoderSha256: null,
        maxBytes: 30000,
      },
      {
        tier: "ego-only",
        schema: "local-perception/v1",
        decoderSha256: null,
        maxBytes: 0,
      },
    ],
  };

  const directRelation = {
    relation: "direct",
    producerCheckpointSha256: directCheckpointSha256,
    producerConfigSha256: directConfigSha256,
    receiverFamily: receiver.family,
    receiverCheckpointSha256,
    receiverConfigSha256,
    adapterId: null,
    adapterSha256: null,
    producerStage: manifest.feature.stage,
    producerStride: manifest.feature.stride,
    producerShape: clone(manifest.feature.shape),
    producerChannelSemanticsSha256: directChannelSemanticsSha256,
    producerQuantization: manifest.feature.quantization,
    producerNormalization: manifest.feature.normalization,
    receiverStage: receiver.featureStage,
    receiverStride: receiver.featureStride,
    receiverShape: clone(receiver.expectedShape),
    receiverChannelSemanticsSha256: receiver.channelSemanticsSha256,
    receiverQuantization: receiver.quantization,
    receiverNormalization: receiver.normalization,
  };
  const adapterRelation = {
    ...clone(directRelation),
    relation: "adapter",
    producerCheckpointSha256: adapterCheckpointSha256,
    producerConfigSha256: adapterConfigSha256,
    adapterId,
    adapterSha256: digestLabel("adapter-weights"),
    producerStride: 8,
    producerShape: [320, 8, 8],
    producerChannelSemanticsSha256: adapterChannelSemanticsSha256,
    producerNormalization: "second-backbone-batchnorm/v1",
  };
  const registry = {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    modelConfigAllowlist: [
      {
        producerModelFamily: manifest.producer.modelFamily,
        producerConfigSha256: directConfigSha256,
        receiverFamily: receiver.family,
      },
    ],
    relations: [directRelation, adapterRelation],
  };
  return {
    now: "2026-07-31T12:00:00.000Z",
    manifest,
    receiver,
    registry,
    adapter: {
      adapterId,
      checkpointSha256: adapterCheckpointSha256,
      configSha256: adapterConfigSha256,
      channelSemanticsSha256: adapterChannelSemanticsSha256,
    },
  };
}

function captureErrorCode(callback) {
  try {
    callback();
  } catch (error) {
    if (error instanceof PreflightError) return error.code;
    throw error;
  }
  return null;
}

export function runProbe() {
  const fixtures = makeFixtures();
  const legal = createEnvelope(fixtures.manifest);
  const legalFull = fullContractAdmission(
    legal,
    fixtures.receiver,
    fixtures.registry,
    fixtures.now,
  );

  const semanticMismatchManifest = clone(fixtures.manifest);
  semanticMismatchManifest.feature.normalization = "channelwise-zscore/v2";
  semanticMismatchManifest.sensor.calibrationEpoch = "unknown-rolling-epoch";
  const semanticMismatch = createEnvelope(semanticMismatchManifest);
  const mismatchFull = fullContractAdmission(
    semanticMismatch,
    fixtures.receiver,
    fixtures.registry,
    fixtures.now,
  );

  const adapterManifest = clone(fixtures.manifest);
  adapterManifest.producer.checkpointSha256 = fixtures.adapter.checkpointSha256;
  adapterManifest.producer.configSha256 = fixtures.adapter.configSha256;
  adapterManifest.feature.stride = 8;
  adapterManifest.feature.shape = [320, 8, 8];
  adapterManifest.feature.channelSemanticsSha256 =
    fixtures.adapter.channelSemanticsSha256;
  adapterManifest.feature.normalization = "second-backbone-batchnorm/v1";
  adapterManifest.compatibility.adapterIds = [fixtures.adapter.adapterId];
  const adapter = createEnvelope(adapterManifest);
  const adapterFull = fullContractAdmission(
    adapter,
    fixtures.receiver,
    fixtures.registry,
    fixtures.now,
  );

  const futureManifest = clone(fixtures.manifest);
  futureManifest.temporal.issuedAt = "2026-07-31T12:00:01.000Z";
  futureManifest.temporal.expiresAt = "2026-07-31T12:05:01.000Z";
  const future = createEnvelope(futureManifest);

  const tampered = clone(legal);
  tampered.manifest.feature.normalization = "tampered-without-resigning";

  const unknownFallbackManifest = clone(fixtures.manifest);
  unknownFallbackManifest.fallbacks[0].tier = "unknown-wire-tier";

  const unknownRelationRegistry = clone(fixtures.registry);
  unknownRelationRegistry.relations[0].relation = "wildcard";

  const unknownFieldManifest = clone(fixtures.manifest);
  unknownFieldManifest.feature.unregisteredMeaning = "accept-me";

  const driftReceiver = clone(fixtures.receiver);
  driftReceiver.payloadSha256 = digestLabel("different-payload");

  return {
    candidateId: CANDIDATE_ID,
    evidenceBoundary:
      "deterministic synthetic manifest fixtures only; no checkpoint, dataset, "
      + "task metric, or perception-benefit evidence",
    legalManifest: {
      shapeOnly: shapeOnlyAdmission(legal, fixtures.receiver),
      modelConfigAllowlist: modelConfigAdmission(
        legal,
        fixtures.receiver,
        fixtures.registry,
      ),
      fullContract: legalFull,
      selectedTier: selectFallback(legal, fixtures.receiver, legalFull),
    },
    shapeCompatibleSemanticMismatch: {
      shapeOnly: shapeOnlyAdmission(semanticMismatch, fixtures.receiver),
      modelConfigAllowlist: modelConfigAdmission(
        semanticMismatch,
        fixtures.receiver,
        fixtures.registry,
      ),
      fullContract: mismatchFull,
      selectedTier: selectFallback(
        semanticMismatch,
        fixtures.receiver,
        mismatchFull,
      ),
    },
    registeredAdapterRelation: {
      shapeOnly: shapeOnlyAdmission(adapter, fixtures.receiver),
      modelConfigAllowlist: modelConfigAdmission(
        adapter,
        fixtures.receiver,
        fixtures.registry,
      ),
      fullContract: adapterFull,
      selectedTier: selectFallback(adapter, fixtures.receiver, adapterFull),
    },
    failClosedControls: {
      futureManifest: captureErrorCode(() => fullContractAdmission(
        future,
        fixtures.receiver,
        fixtures.registry,
        fixtures.now,
      )),
      payloadHashDrift: captureErrorCode(() => fullContractAdmission(
        legal,
        driftReceiver,
        fixtures.registry,
        fixtures.now,
      )),
      tamperedManifestHash: captureErrorCode(() =>
        validateEnvelope(tampered)),
      unknownFallback: captureErrorCode(() =>
        createEnvelope(unknownFallbackManifest)),
      unknownRelation: captureErrorCode(() => fullContractAdmission(
        legal,
        fixtures.receiver,
        unknownRelationRegistry,
        fixtures.now,
      )),
      unknownField: captureErrorCode(() =>
        createEnvelope(unknownFieldManifest)),
    },
  };
}

export function validateExecutionAudit(audit, now = new Date().toISOString()) {
  exactKeys(audit, AUDIT_KEYS, "execution audit");
  exactValue(
    audit.candidateId,
    CANDIDATE_ID,
    "CANDIDATE_MISMATCH",
    "execution audit candidateId",
  );
  const checkedAt = requireIsoInstant(audit.checkedAt, "execution audit checkedAt");
  const nowMs = requireIsoInstant(now, "audit validation now");
  ensure(
    checkedAt <= nowMs,
    "FUTURE_AUDIT",
    "execution audit checkedAt is in the future",
  );
  ensure(
    audit.verdict === "go"
      || audit.verdict === "revise"
      || audit.verdict === "reject",
    "SCHEMA_VIOLATION",
    "execution audit verdict must be go, revise, or reject",
  );
  ensure(Array.isArray(audit.fixedAssets), "SCHEMA_VIOLATION", "fixedAssets must be an array");
  ensure(Array.isArray(audit.tests), "SCHEMA_VIOLATION", "tests must be an array");
  ensure(Array.isArray(audit.controls), "SCHEMA_VIOLATION", "controls must be an array");
  ensure(Array.isArray(audit.limitations), "SCHEMA_VIOLATION", "limitations must be an array");
  ensure(Array.isArray(audit.nextActions), "SCHEMA_VIOLATION", "nextActions must be an array");
  return audit;
}

const SCRIPT_PATH = fileURLToPath(import.meta.url);
if (process.argv[1]
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv[2] === "--audit") {
      const auditPath = process.argv[3] ?? resolve(
        dirname(SCRIPT_PATH),
        "../../content/idea-audits/"
          + "cooperative-autonomous-driving-wire-capability-execution-gate-v8.json",
      );
      const audit = JSON.parse(readFileSync(auditPath, "utf8"));
      validateExecutionAudit(audit);
      process.stdout.write(`${JSON.stringify({ valid: true, auditPath })}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(runProbe(), null, 2)}\n`);
    }
  } catch (error) {
    const payload = error instanceof PreflightError
      ? { error: error.code, message: error.message, witness: error.witness }
      : { error: "UNEXPECTED_ERROR", message: String(error?.stack ?? error) };
    process.stderr.write(`${JSON.stringify(payload)}\n`);
    process.exitCode = 1;
  }
}
