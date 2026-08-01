import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CONFIRMATION_SEEDS,
  DEVELOPMENT_SEEDS,
  MODEL_SCHEMA_VERSION,
  PILOT_SCHEMA_VERSION,
  PilotError,
  analyzeLocalStability,
  buildAudit,
  canonicalDigest,
  createScenario,
  findEquilibrium,
  numericalJacobian,
  runEpisode,
  runPilot,
  spectralRadius,
  stableJson,
  stepProxy,
  verifyAudit,
} from "../scripts/idea-pilots/coupled-rate-stability-v8.mjs";

const SCRIPT_PATH = resolve(
  "scripts/idea-pilots/coupled-rate-stability-v8.mjs",
);
const TEST_PATH = resolve("test/coupled-rate-stability-v8.test.mjs");
const AUDIT_PATH = resolve(
  "content/idea-audits/"
    + "cooperative-autonomous-driving-coupled-rate-stability-pilot-v8.json",
);

let cachedPilot = null;

function pilot() {
  cachedPilot ??= runPilot();
  return cachedPilot;
}

function stableScenario(overrides = {}) {
  return createScenario({
    scenarioId: "test-stable",
    rateGain: 0.28,
    semanticGain: 0.32,
    observationTauSeconds: 0.25,
    redundancyTauSeconds: 0.3,
    ...overrides,
  });
}

function stressScenario(overrides = {}) {
  return createScenario({
    scenarioId: "test-stress",
    rateGain: 4.2,
    semanticGain: 4.8,
    observationTauSeconds: 1.4,
    redundancyTauSeconds: 1.1,
    ...overrides,
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof PilotError);
    assert.equal(error.code, code);
    return true;
  });
}

test("scenario validation fails closed on NaN, invalid bounds, and unknown modes", () => {
  assertCode(
    () => createScenario({ rateGain: Number.NaN }),
    "NON_FINITE_PARAMETER",
  );
  assertCode(
    () => createScenario({ dtSeconds: 0 }),
    "PARAMETER_OUT_OF_RANGE",
  );
  assertCode(
    () => createScenario({
      dtSeconds: 0.07,
      controllerPeriodSeconds: 0.4,
    }),
    "NON_INTEGRAL_CONTROLLER_PERIOD",
  );
  assertCode(
    () => createScenario({ controller: "official-etsi" }),
    "UNKNOWN_CONTROLLER",
  );
  assertCode(
    () => createScenario({ senderCount: 1 }),
    "INVALID_SENDER_COUNT",
  );
  const duplicate = createScenario().senders;
  duplicate[1].id = duplicate[0].id;
  assertCode(
    () => createScenario({ senders: duplicate }),
    "DUPLICATE_SENDER_ID",
  );
});

test("audit generation rejects invalid or future provenance timestamps", () => {
  assertCode(
    () => buildAudit({ generatedAt: "not-a-timestamp" }),
    "INVALID_GENERATED_AT",
  );
  assertCode(
    () => buildAudit({
      generatedAt: "2026-08-01T00:02:00+08:00",
      nowMs: Date.parse("2026-08-01T00:00:00+08:00"),
    }),
    "FUTURE_GENERATED_AT",
  );
});

test("one proxy step uses stored sender-visible signals before new observations", () => {
  const scenario = stableScenario();
  const equilibrium = findEquilibrium(scenario).state;
  const lowRandom = new Map(
    scenario.senders.map((sender) => [sender.id, () => 0]),
  );
  const highRandom = new Map(
    scenario.senders.map((sender) => [sender.id, () => 1]),
  );
  const low = stepProxy(equilibrium, scenario, {
    randomBySender: lowRandom,
  });
  const high = stepProxy(equilibrium, scenario, {
    randomBySender: highRandom,
  });
  assert.deepEqual(low.observation, high.observation);
  assert.deepEqual(
    low.state.senders.map(({ shock: _shock, ...sender }) => sender),
    high.state.senders.map(({ shock: _shock, ...sender }) => sender),
  );
  assert.notDeepEqual(
    low.state.senders.map((sender) => sender.shock),
    high.state.senders.map((sender) => sender.shock),
  );
  assert.ok(low.observation.senders.every((sender, index) =>
    sender.observedCbrUsed === equilibrium.senders[index].observedCbr
      && sender.observedRedundancyUsed
        === equilibrium.senders[index].observedRedundancy));
});

test("finite-difference Jacobian and spectral radius recover known maps", () => {
  const jacobian = numericalJacobian(
    ([x, y]) => [2 * x + 3 * y, -x + 0.5 * y],
    [0.25, -0.75],
  );
  assert.ok(Math.abs(jacobian[0][0] - 2) < 1e-8);
  assert.ok(Math.abs(jacobian[0][1] - 3) < 1e-8);
  assert.ok(Math.abs(jacobian[1][0] + 1) < 1e-8);
  assert.ok(Math.abs(jacobian[1][1] - 0.5) < 1e-8);

  const rotation = spectralRadius([[0, -2], [2, 0]]);
  assert.ok(Math.abs(rotation.radius - 2) < 1e-10);
  const diagonal = spectralRadius([[0.25, 0, 0], [0, -1.5, 0], [0, 0, 0.8]]);
  assert.ok(Math.abs(diagonal.radius - 1.5) < 1e-10);
});

test("low-gain and high-gain controls have separated local stability margins", () => {
  const stable = analyzeLocalStability(stableScenario());
  const stress = analyzeLocalStability(stressScenario());
  assert.equal(stable.predictedUnstable, false);
  assert.ok(stable.spectralRadius < 0.95);
  assert.equal(stress.predictedUnstable, true);
  assert.ok(stress.spectralRadius > 1.5);
  assert.ok(
    stress.crossSenderCoupling.maxAbsoluteDerivative > 1e-5,
  );
  assert.equal(stable.jacobian.length, 20);
  assert.match(stable.jacobianSha256, /^[0-9a-f]{64}$/);
});

test("episodes are deterministic by seed and never count packets as replicates", () => {
  const scenario = stressScenario();
  const equilibrium = findEquilibrium(scenario).state;
  const first = runEpisode(scenario, CONFIRMATION_SEEDS[0], equilibrium);
  const second = runEpisode(scenario, CONFIRMATION_SEEDS[0], equilibrium);
  const third = runEpisode(scenario, CONFIRMATION_SEEDS[1], equilibrium);
  assert.deepEqual(first, second);
  assert.notEqual(canonicalDigest(first), canonicalDigest(third));
  assert.equal(first.metrics.independentUnit, "complete-episode");
  assert.equal(
    first.metrics.packetOrFrameCountUsedAsIndependentSample,
    false,
  );
  assert.equal(first.metrics.persistentOscillation, true);
  assert.equal(first.metrics.convergenceTimeSeconds, null);
  assert.ok(first.metrics.jainFairness >= 0 && first.metrics.jainFairness <= 1);
  assert.ok(first.metrics.starvation.longestContinuousSeconds >= 0);
});

test("development and confirmation episodes are disjoint and held out", () => {
  const result = pilot();
  assert.equal(result.frozenModel.modelSchemaVersion, undefined);
  assert.equal(result.frozenModel.schemaVersion, MODEL_SCHEMA_VERSION);
  assert.deepEqual(result.frozenModel.developmentSeeds, DEVELOPMENT_SEEDS);
  assert.deepEqual(result.frozenModel.confirmationSeeds, CONFIRMATION_SEEDS);
  assert.equal(result.frozenModel.seedSetsDisjoint, true);
  assert.equal(new Set(DEVELOPMENT_SEEDS).size, 10);
  assert.equal(new Set(CONFIRMATION_SEEDS).size, 30);
  assert.ok(DEVELOPMENT_SEEDS.every((seed) =>
    !CONFIRMATION_SEEDS.includes(seed)));
  for (const cell of Object.values(result.cells)) {
    assert.equal(cell.development.episodeCount, 10);
    assert.equal(cell.confirmation.episodeCount, 30);
    assert.equal(cell.development.independentUnit, "complete-episode-seed");
    assert.equal(cell.confirmation.independentUnit, "complete-episode-seed");
  }
});

test("local spectrum predicts opposite held-out outcomes for positive controls", () => {
  const { stablePositiveControl: stable, stressPositiveControl: stress }
    = pilot().cells;
  assert.equal(stable.stability.predictedUnstable, false);
  assert.equal(stable.confirmation.observedUnstableRate, 0);
  assert.equal(stable.confirmation.spectralPredictionAgreementRate, 1);
  assert.equal(stable.confirmation.persistentOscillationCount, 0);
  assert.equal(stable.confirmation.convergence.convergedCount, 30);
  assert.equal(stress.stability.predictedUnstable, true);
  assert.equal(stress.confirmation.observedUnstableRate, 1);
  assert.equal(stress.confirmation.spectralPredictionAgreementRate, 1);
  assert.equal(stress.confirmation.persistentOscillationCount, 30);
  assert.equal(stress.confirmation.convergence.convergedCount, 0);
});

test("all direct baseline families execute on both preregistered regimes", () => {
  const expected = [
    "feedback-off",
    "fixed-equal-period-rate",
    "qoq-fixed-period",
    "selector-limeric",
    "weighted-limeric",
  ];
  for (const matrix of Object.values(pilot().directBaselines)) {
    assert.deepEqual(Object.keys(matrix).sort(), expected);
    for (const result of Object.values(matrix)) {
      assert.match(result.scenarioSha256, /^[0-9a-f]{64}$/);
      assert.equal(result.development.episodeCount, 10);
      assert.equal(result.confirmation.episodeCount, 30);
      assert.ok(Number.isFinite(result.spectralRadius));
    }
  }
});

test("feedback-off control is offered-load matched and loses the oscillation", () => {
  const result = pilot();
  const coupled = result.cells.stressPositiveControl.confirmation;
  const matched = result.feedbackOffOfferedLoadMatched;
  assert.ok(matched.offeredLoadRatio.confirmation.min >= 0.99);
  assert.ok(matched.offeredLoadRatio.confirmation.max <= 1.01);
  assert.ok(
    matched.confirmation.normalizedRateAmplitude.mean
      < 0.1 * coupled.normalizedRateAmplitude.mean,
  );
  assert.equal(matched.confirmation.observedUnstableRate, 0);
  assert.ok(matched.episodeOutcomes.confirmation.every((episode) =>
    /no outcome label/.test(episode.calibrationPolicy)));
});

test("half-step and asynchronous controls disclose rather than hide sensitivity", () => {
  const { halfStepControl: half, asynchronousControl: asynchronous }
    = pilot().cells;
  assert.equal(half.scenario.dtSeconds, 0.05);
  assert.equal(half.stability.predictedUnstable, true);
  assert.equal(half.confirmation.observedUnstableRate, 1);
  assert.equal(asynchronous.scenario.asynchronousUpdates, true);
  assert.equal(asynchronous.stability.predictedUnstable, true);
  assert.equal(asynchronous.confirmation.observedUnstableRate, 1);
  assert.notEqual(
    asynchronous.stability.spectralRadius,
    pilot().cells.stressPositiveControl.stability.spectralRadius,
  );
});

test("local-only negative control removes every cross-sender Jacobian entry", () => {
  const result = pilot();
  const shared = result.cells.stressPositiveControl.stability
    .crossSenderCoupling;
  const local = result.cells.localSignalNegativeControl.stability
    .crossSenderCoupling;
  assert.ok(shared.maxAbsoluteDerivative > 1e-5);
  assert.ok(shared.nonzeroCount > 0);
  assert.equal(local.maxAbsoluteDerivative, 0);
  assert.equal(local.meanAbsoluteDerivative, 0);
  assert.equal(local.nonzeroCount, 0);
});

test("sender input permutation is exactly canonicalized", () => {
  const control = pilot().senderOrderPermutation;
  assert.equal(control.metricsEqual, true);
  assert.equal(
    control.originalScenarioSha256,
    control.permutedInputScenarioSha256,
  );
  assert.equal(
    control.originalMetricsSha256,
    control.permutedMetricsSha256,
  );
});

test("every frozen proxy check passes without erasing the official-stack kill gate", () => {
  const result = pilot();
  assert.equal(result.allProxyChecksPassed, true);
  assert.ok(result.hypothesisChecks.length >= 8);
  assert.ok(result.hypothesisChecks.every((check) => check.passed));
  assert.equal(result.killCriteria.offDiagonalCouplingAbsent, false);
  assert.equal(result.killCriteria.instabilityUnchangedWithFeedbackOff, false);
  assert.equal(result.killCriteria.instabilityDisappearsAtHalfStep, false);
  assert.equal(result.killCriteria.packetLevelPseudoreplication, false);
  assert.match(
    result.killCriteria.officialArteryExampleNotReproducedWithinThreeDays,
    /not evaluated/,
  );
});

test("checked audit is proxy-bounded and binds runner, test, and output content", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
  assert.equal(audit.schemaVersion, PILOT_SCHEMA_VERSION);
  assert.equal(audit.verdict, "revise");
  assert.match(audit.pilotDecision, /requires-official-stack/);
  assert.match(audit.claimBoundary.unsupported.join("\n"), /not an implementation.*Artery/i);
  assert.match(audit.claimBoundary.preregistrationStatus, /No independent/);
  assert.equal(verifyAudit(audit), true);
  assert.equal(
    audit.reproducibility.runner.sha256,
    sha256(readFileSync(SCRIPT_PATH)),
  );
  assert.equal(
    audit.reproducibility.test.sha256,
    sha256(readFileSync(TEST_PATH)),
  );
  const payload = structuredClone(audit);
  const boundHash = payload.integrity.auditSha256;
  delete payload.integrity.auditSha256;
  assert.equal(canonicalDigest(payload), boundHash);

  const tampered = structuredClone(audit);
  tampered.result.allProxyChecksPassed = false;
  assertCode(() => verifyAudit(tampered), "AUDIT_HASH_MISMATCH");

  const forgedBinding = structuredClone(audit);
  forgedBinding.reproducibility.runner.sha256 = "0".repeat(64);
  delete forgedBinding.integrity.auditSha256;
  forgedBinding.integrity.auditSha256 = canonicalDigest(forgedBinding);
  assertCode(() => verifyAudit(forgedBinding), "SOURCE_BINDING_MISMATCH");
});

test("audit regeneration is byte-stable for a frozen timestamp", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
  const regenerated = buildAudit({ generatedAt: audit.generatedAt });
  assert.equal(stableJson(regenerated), stableJson(audit));
  assert.equal(verifyAudit(regenerated), true);
});
