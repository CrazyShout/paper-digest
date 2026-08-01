import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  METHODS,
  METRIC_DEFINITIONS,
  PILOT_CONFIG,
  TEST_DGP_CONFIG,
  buildAuditDocument,
  clusterAnyEvent,
  clusterEveryCovered,
  evaluateStopCondition,
  fitCalibration,
  generateCalibrationEpisodes,
  generateFrozenTestPopulation,
  mapSenderEnvelope,
  mapSenderPoint,
  prepareMethodInput,
  runMethod,
  runPilot,
  sha256Json
} from "../scripts/idea-pilots/clock-age-identifiability-v6.mjs";
import {
  PILOT_CONFIG as V5_PILOT_CONFIG,
  TEST_DGP_CONFIG as V5_TEST_DGP_CONFIG,
  fitCalibration as fitV5Calibration,
  generateCalibrationEpisodes as generateV5CalibrationEpisodes,
  generateFrozenTestPopulation as generateV5FrozenTestPopulation,
  runMethod as runV5Method
} from "../scripts/idea-pilots/clock-age-identifiability-v5.mjs";

const ROOT = new URL("../", import.meta.url);
const frozenTestPopulation = generateFrozenTestPopulation();
const frozenTestPopulationSha256 = sha256Json(frozenTestPopulation);
const calibrationEpisodes = generateCalibrationEpisodes();
const calibration = fitCalibration(calibrationEpisodes);
const report = runPilot();

function recordsFor(regime) {
  return frozenTestPopulation.filter(
    (record) => record.regime === regime
  );
}

function groupByEpisode(records) {
  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record.episodeId)) {
      groups.set(record.episodeId, []);
    }
    groups.get(record.episodeId).push(record);
  }
  return groups;
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("test DGP is frozen before calibration fit and independent of fitted bounds", () => {
  assert.deepEqual(report.executionOrder, [
    "design-manifest-hashed-before-data",
    "test-population-generated-and-deep-frozen",
    "calibration-episodes-generated",
    "calibration-fitted-after-test-freeze"
  ]);
  assert.equal(
    report.independenceEvidence.testDgpFrozenBeforeCalibrationFit,
    true
  );
  assert.equal(
    report.independenceEvidence.testDgpFunctionAcceptsCalibration,
    false
  );
  assert.equal(Object.isFrozen(frozenTestPopulation), true);
  assert.equal(Object.isFrozen(frozenTestPopulation[0].observation), true);
  assert.throws(
    () => frozenTestPopulation.push({}),
    /not extensible|read only|object is not extensible/i
  );

  const deliberatelyDifferentFit = fitCalibration([
    {
      episodeId: "v6-cal-999999991-0",
      measuredReferenceMs: 100000,
      measuredRatePpm: 10000,
      calibrationTruth: { referenceMs: 0, ratePpm: 0 }
    }
  ]);
  assert.notEqual(
    deliberatelyDifferentFit.mappingHalfWidthMs,
    calibration.mappingHalfWidthMs
  );
  assert.notEqual(
    deliberatelyDifferentFit.rateHalfWidthPpm,
    calibration.rateHalfWidthPpm
  );
  assert.equal(
    sha256Json(generateFrozenTestPopulation()),
    frozenTestPopulationSha256
  );

  const bounded = recordsFor("bounded-provenance");
  const margins = new Set(
    bounded.map((record) =>
      Math.abs(record.truth.ageMs - record.observation.deadlineMs)
    )
  );
  assert.deepEqual(
    [...margins].sort((left, right) => left - right),
    [...TEST_DGP_CONFIG.deadlineMarginsMs]
  );
  assert.ok(
    Math.max(
      ...bounded.map((record) =>
        Math.abs(record.truth.transformError.anchorMappingResidualMs)
      )
    ) <= TEST_DGP_CONFIG.boundedMappingResidualSupportMs
  );
  assert.ok(
    Math.max(
      ...bounded.map((record) =>
        Math.abs(record.truth.transformError.rateResidualPpm)
      )
    ) <= TEST_DGP_CONFIG.boundedRateResidualSupportPpm
  );
});

test("v6 keeps the v5 numeric DGP, seeds, and thresholds frozen", () => {
  const { version: v5Version, ...v5Dgp } = V5_TEST_DGP_CONFIG;
  const { version: v6Version, ...v6Dgp } = TEST_DGP_CONFIG;
  assert.equal(v5Version, "clock-age-test-dgp-v5");
  assert.equal(v6Version, "clock-age-test-dgp-v6");
  assert.deepEqual(v6Dgp, v5Dgp);
  const {
    maximumFinitePopulationFalseFreshUpper,
    ...v5StopThresholds
  } = V5_PILOT_CONFIG.stopThresholds;
  assert.deepEqual(PILOT_CONFIG.stopThresholds, {
    ...v5StopThresholds,
    maximumFinitePopulationFalseFreshFraction:
      maximumFinitePopulationFalseFreshUpper
  });
  assert.equal(
    PILOT_CONFIG.calibrationMappingResidualLimitMs,
    V5_PILOT_CONFIG.calibrationMappingResidualLimitMs
  );
  assert.equal(
    PILOT_CONFIG.calibrationRateResidualLimitPpm,
    V5_PILOT_CONFIG.calibrationRateResidualLimitPpm
  );
});

test("new seeds and alternative seeds are carried into disjoint v6 episode IDs", () => {
  assert.equal(PILOT_CONFIG.calibrationSeed, 2026073141);
  assert.equal(PILOT_CONFIG.testSeed, 2026073197);
  assert.notEqual(PILOT_CONFIG.calibrationSeed, PILOT_CONFIG.testSeed);
  assert.equal(report.episodeIds.includePassedTestSeed, true);
  assert.match(report.episodeIds.first, /v6-test-/);

  const alternativeSeed = 314159265;
  const alternative = generateFrozenTestPopulation(alternativeSeed);
  assert.ok(
    alternative.every((record) =>
      record.episodeId.includes(`-${alternativeSeed}-`)
    )
  );
  const defaultIds = new Set(
    frozenTestPopulation.map((record) => record.episodeId)
  );
  assert.equal(
    alternative.some((record) => defaultIds.has(record.episodeId)),
    false
  );
  const calibrationIds = new Set(
    calibrationEpisodes.map((episode) => episode.episodeId)
  );
  assert.equal(
    frozenTestPopulation.some((record) =>
      calibrationIds.has(record.episodeId)
    ),
    false
  );
});

test("paired worlds preserve declared observables and service components only", () => {
  const pairs = groupByEpisode(recordsFor("paired-counterexample"));
  assert.equal(pairs.size, report.finitePopulation.gridClusters);
  for (const pair of pairs.values()) {
    assert.equal(pair.length, 2);
    const fresh = pair.find((record) => record.world === "fresh-world");
    const stale = pair.find((record) => record.world === "stale-world");
    assert.deepEqual(fresh.observation, stale.observation);
    assert.equal(fresh.traceHash, stale.traceHash);
    assert.deepEqual(
      fresh.truth.networkServiceProcess,
      stale.truth.networkServiceProcess
    );
    assert.equal(fresh.truth.verdict, "fresh");
    assert.equal(stale.truth.verdict, "stale");
    assert.notEqual(
      fresh.truth.networkPropagationMs.forward,
      stale.truth.networkPropagationMs.forward
    );
    assert.notEqual(
      fresh.truth.networkPropagationMs.reverse,
      stale.truth.networkPropagationMs.reverse
    );
    assert.ok(fresh.truth.networkPropagationMs.forward >= 0);
    assert.ok(fresh.truth.networkPropagationMs.reverse >= 0);
    assert.ok(stale.truth.networkPropagationMs.forward >= 0);
    assert.ok(stale.truth.networkPropagationMs.reverse >= 0);

    for (const method of METHODS.filter(
      (candidate) => candidate.id !== "oracle"
    )) {
      assert.deepEqual(
        runMethod(method.id, fresh.observation, calibration),
        runMethod(method.id, stale.observation, calibration),
        method.id
      );
    }
  }
});

test("truth firewall holds and rate error propagates over the long anchor lookback", () => {
  const original = recordsFor("rate-stress")[0];
  const changedTruth = structuredClone(original);
  changedTruth.truth.ageMs += 100000;
  changedTruth.truth.verdict = "stale";
  assert.equal(Object.hasOwn(prepareMethodInput(original), "truth"), false);

  for (const method of METHODS.filter(
    (candidate) => candidate.id !== "oracle"
  )) {
    assert.deepEqual(
      runMethod(method.id, prepareMethodInput(original), calibration),
      runMethod(method.id, prepareMethodInput(changedTruth), calibration),
      method.id
    );
  }

  const wrongRate = structuredClone(original.observation);
  const baselineMappedMs = mapSenderPoint(wrongRate);
  const baselinePoint = runMethod(
    "ptp-like-point",
    wrongRate,
    calibration
  );
  wrongRate.transform.ratePpm +=
    TEST_DGP_CONFIG.wrongRateDeltaPpm;
  const changedMappedMs = mapSenderPoint(wrongRate);
  const changedPoint = runMethod(
    "ptp-like-point",
    wrongRate,
    calibration
  );
  assert.notEqual(changedMappedMs, baselineMappedMs);
  assert.notEqual(changedPoint.estimateMs, baselinePoint.estimateMs);
  assert.ok(Math.abs(changedMappedMs - baselineMappedMs) > 100);
  assert.equal(
    report.auditResults
      .wrongButPresentEmpiricalAblations
      .wrongRateLongLookback
      .mappedTimestampShiftMs
      .nonzeroRecords,
    recordsFor("rate-stress").length
  );
});

function endpointTestInput(senderDeltaMs) {
  const anchorSenderMs = 1000000;
  return {
    senderPublishMs: anchorSenderMs + senderDeltaMs,
    fusionUseMs: 0,
    deadlineMs: 100,
    receiverClockDomainId: "reference-tai",
    timestamp: {
      clockDomainId: "endpoint-source",
      relockCounter: 7
    },
    transform: {
      sourceClockDomainId: "endpoint-source",
      targetClockDomainId: "reference-tai",
      anchorSenderMs,
      anchorReferenceMs: 2000000,
      ratePpm: 120,
      validity: {
        fromSenderMs: anchorSenderMs - 1000000,
        toSenderMs: anchorSenderMs + 1000000
      },
      relockCounter: 7
    }
  };
}

test("exact affine envelope covers every legal anchor/rate endpoint for both delta signs", () => {
  const endpointCalibration = {
    mappingHalfWidthMs: 7,
    rateHalfWidthPpm: 250
  };
  for (const senderDeltaMs of [-500000, 500000]) {
    const input = endpointTestInput(senderDeltaMs);
    const envelope = mapSenderEnvelope(input, endpointCalibration);
    assert.equal(envelope.status, "bounded");
    assert.equal(Math.sign(envelope.senderDeltaMs), Math.sign(senderDeltaMs));
    const directedEndpointValues = [];
    for (const anchorReferenceMs of envelope.anchorReferenceIntervalMs) {
      for (const rate of envelope.rateInterval) {
        assert.ok(rate > 0);
        const mappedTimestampMs =
          anchorReferenceMs + senderDeltaMs / rate;
        directedEndpointValues.push(mappedTimestampMs);
        const endpointWorld = structuredClone(input);
        const trueAgeMs = 25;
        endpointWorld.fusionUseMs = mappedTimestampMs + trueAgeMs;
        const prediction = runMethod(
          "provenance-interval",
          endpointWorld,
          endpointCalibration
        );
        assert.equal(prediction.status, "identified");
        assert.ok(
          trueAgeMs >= prediction.intervalMs[0] - 1e-9
          && trueAgeMs <= prediction.intervalMs[1] + 1e-9,
          `delta=${senderDeltaMs}, anchor=${anchorReferenceMs}, rate=${rate}`
        );
      }
    }
    assert.equal(
      envelope.mappedTimestampIntervalMs[0],
      Math.min(...directedEndpointValues)
    );
    assert.equal(
      envelope.mappedTimestampIntervalMs[1],
      Math.max(...directedEndpointValues)
    );
  }
});

test("an uncertainty interval reaching a nonpositive rate fails closed", () => {
  const input = endpointTestInput(500000);
  const invalidCalibration = {
    mappingHalfWidthMs: 7,
    rateHalfWidthPpm: 1100000
  };
  assert.ok(Number.isFinite(mapSenderPoint(input)));
  const envelope = mapSenderEnvelope(input, invalidCalibration);
  assert.equal(envelope.status, "invalid");
  assert.match(envelope.reason, /not-strictly-positive/);
  const prediction = runMethod(
    "provenance-interval",
    input,
    invalidCalibration
  );
  assert.equal(prediction.status, "uncertain");
  assert.equal(prediction.verdict, "uncertain");
  assert.deepEqual(prediction.intervalMs, [0, Number.POSITIVE_INFINITY]);
  assert.match(prediction.reason, /not-strictly-positive/);
});

test("v6 covers the v5 audited first-order underreach counterexample", async () => {
  const v5Calibration = fitV5Calibration(
    generateV5CalibrationEpisodes()
  );
  const base = generateV5FrozenTestPopulation().find(
    (record) =>
      record.episodeId
        === "v5-test-bounded-provenance-2026073197-66"
      && record.observation.sequence === 1322
  );
  const v5Prediction = runV5Method(
    "provenance-interval",
    base.observation,
    v5Calibration
  );
  const v6Prediction = runMethod(
    "provenance-interval",
    base.observation,
    v5Calibration
  );
  const exactEndpointTruthAgeMs = v6Prediction.rawIntervalMs[1];
  assert.ok(
    Math.abs(v5Prediction.rawIntervalMs[1] - 63.919433057) < 1e-9
  );
  assert.ok(
    Math.abs(exactEndpointTruthAgeMs - 63.929007292) < 1e-9
  );
  assert.ok(exactEndpointTruthAgeMs > v5Prediction.intervalMs[1]);
  assert.ok(
    exactEndpointTruthAgeMs >= v6Prediction.intervalMs[0] - 1e-9
    && exactEndpointTruthAgeMs <= v6Prediction.intervalMs[1] + 1e-9
  );

  const audit = await buildAuditDocument();
  assert.ok(
    Math.abs(
      audit.endpointRepairEvidence
        .boundedProvenanceMaximumFirstOrderUnderreachMs
      - 0.014910638
    ) < 1e-9
  );
  const maximumUnderreachWorld = structuredClone(base.observation);
  const exactMappedEnvelope =
    mapSenderEnvelope(maximumUnderreachWorld, v5Calibration);
  const maximumUnderreachTruthAgeMs = 25;
  maximumUnderreachWorld.fusionUseMs =
    exactMappedEnvelope.mappedTimestampIntervalMs[1]
    + maximumUnderreachTruthAgeMs;
  const maximumUnderreachV5 = runV5Method(
    "provenance-interval",
    maximumUnderreachWorld,
    v5Calibration
  );
  const maximumUnderreachV6 = runMethod(
    "provenance-interval",
    maximumUnderreachWorld,
    v5Calibration
  );
  assert.ok(
    Math.abs(
      maximumUnderreachV5.rawIntervalMs[0]
      - maximumUnderreachTruthAgeMs
      - 0.014910638
    ) < 1e-9
  );
  assert.ok(
    maximumUnderreachTruthAgeMs < maximumUnderreachV5.intervalMs[0]
  );
  assert.ok(
    maximumUnderreachTruthAgeMs
      >= maximumUnderreachV6.intervalMs[0] - 1e-9
    && maximumUnderreachTruthAgeMs
      <= maximumUnderreachV6.intervalMs[1] + 1e-9
  );
  assert.equal(
    audit.endpointRepairEvidence
      .v5AuditMaximumUnderreachCounterexample.coveredByV5FirstOrder,
    false
  );
  assert.equal(
    audit.endpointRepairEvidence
      .v5AuditMaximumUnderreachCounterexample.coveredByV6,
    true
  );
  assert.equal(
    audit.endpointRepairEvidence.v5AuditCounterexample.coveredByV6,
    true
  );
});

test("cluster coverage requires every record while decision errors use any event", () => {
  const partialMiss = [
    { episodeId: "partial-cluster", covered: true, event: false },
    { episodeId: "partial-cluster", covered: false, event: true },
    { episodeId: "complete-cluster", covered: true, event: false }
  ];
  assert.deepEqual(
    clusterEveryCovered(partialMiss, (row) => row.covered),
    {
      successClusters: 1,
      failedClusters: 1,
      totalClusters: 2,
      estimate: 0.5
    }
  );
  assert.deepEqual(
    clusterAnyEvent(partialMiss, (row) => row.event),
    {
      eventClusters: 1,
      noEventClusters: 1,
      eligibleClusters: 2,
      observedFinitePopulationFraction: {
        numerator: 1,
        denominator: 2,
        comparisonValue: 0.5,
        displayValue: 0.5
      }
    }
  );
});

test("event reports retain exact counts and use an unrounded gate comparison", () => {
  const oneFalseFresh = structuredClone(report.results);
  const bounded =
    oneFalseFresh.intervalByRegime["bounded-provenance"];
  bounded.falseFreshAnyEvent = {
    eventClusters: 1,
    noEventClusters: 251,
    eligibleClusters: 252,
    observedFinitePopulationFraction: {
      numerator: 1,
      denominator: 252,
      comparisonValue: 1 / 252,
      displayValue: 0.003968
    }
  };
  assert.ok(
    bounded.falseFreshAnyEvent
      .observedFinitePopulationFraction.comparisonValue
    > bounded.falseFreshAnyEvent
      .observedFinitePopulationFraction.displayValue
  );
  assert.equal(
    Object.hasOwn(
      bounded.falseFreshAnyEvent,
      "finitePopulationUpperBound"
    ),
    false
  );
  const oneEventGate = evaluateStopCondition(
    oneFalseFresh,
    report.independenceEvidence
  );
  assert.equal(oneEventGate.checks.falseFreshGate, false);

  const missingComparison = structuredClone(report.results);
  missingComparison.intervalByRegime[
    "bounded-provenance"
  ].falseFreshAnyEvent = {
    eventClusters: 0,
    noEventClusters: 252,
    eligibleClusters: 252,
    observedFinitePopulationFraction: {
      numerator: 0,
      denominator: 252,
      comparisonValue: null,
      displayValue: 0
    }
  };
  const missingComparisonGate = evaluateStopCondition(
    missingComparison,
    report.independenceEvidence
  );
  assert.equal(missingComparisonGate.checks.falseFreshGate, false);
});

test("empty intersection with nonnegative age is inconsistent and uncertain", () => {
  const input = structuredClone(
    recordsFor("bounded-provenance")[0].observation
  );
  const mappedSenderMs = mapSenderPoint(input);
  input.fusionUseMs = mappedSenderMs - 10000;
  const prediction = runMethod(
    "provenance-interval",
    input,
    calibration
  );
  assert.ok(prediction.rawIntervalMs[1] < 0);
  assert.equal(prediction.intervalMs, null);
  assert.equal(prediction.status, "inconsistent-provenance");
  assert.equal(prediction.verdict, "uncertain");
  assert.match(prediction.reason, /empty-intersection/);
});

test("point diagnostics and interval coverage remain separate without cluster CIs", () => {
  for (const metrics of Object.values(report.results.pointOverall)) {
    assert.equal(Object.hasOwn(metrics, "coverageEveryRecord"), false);
    assert.equal(Object.hasOwn(metrics, "clusteredCoverage"), false);
    assert.equal(typeof metrics.meanAbsoluteErrorMs, "number");
    assert.deepEqual(
      Object.keys(metrics.absoluteErrorQuantilesMs),
      ["p50", "p90", "p95", "p99", "maximum"]
    );
    assert.ok(Object.hasOwn(metrics, "exactHit"));
    assert.ok(Object.hasOwn(metrics, "decisionErrors"));
  }
  assert.ok(
    Object.hasOwn(report.results.intervalOverall, "coverageEveryRecord")
  );
  assert.equal(
    report.finitePopulation.clusterConfidenceIntervalsReported,
    false
  );
  assert.doesNotMatch(
    JSON.stringify(report.auditResults),
    /"ci95"|"confidenceInterval"|"bootstrapInterval"/i
  );
  assert.match(METRIC_DEFINITIONS.finitePopulation, /without Wilson/);
});

test("missing-field controls and wrong-but-present ablations are distinct", () => {
  const missing = report.results.missingFieldBranchControls;
  assert.deepEqual(Object.keys(missing), [
    "clock-domain",
    "validity",
    "rate",
    "relock"
  ]);
  for (const control of Object.values(missing)) {
    assert.equal(control.fieldPresentAfterMutation, false);
    assert.equal(control.verdict, "uncertain");
  }

  const empirical = report.results.wrongButPresentAblations;
  assert.equal(empirical.wrongDomainPresent.uncertainty.rate, 1);
  assert.equal(empirical.expiredValidityPresent.uncertainty.rate, 1);
  assert.equal(
    empirical.wrongRateLongLookback.lookbackReferenceMs,
    TEST_DGP_CONFIG.rateStressLookbackReferenceMs
  );
  assert.ok(
    empirical.wrongRateLongLookback
      .nominalUncertainty
      .decisionErrors
      .totalDecisionErrorRecords > 0
  );
  assert.ok(
    empirical.wrongRateLongLookback
      .widenedRateUncertainty
      .intervalWidthMs
      .meanMs
    > empirical.wrongRateLongLookback
      .nominalUncertainty
      .intervalWidthMs
      .meanMs
  );
  assert.equal(
    empirical.relockMismatchAndRecovery.mismatch.uncertainty.rate,
    1
  );
  assert.ok(
    empirical.relockMismatchAndRecovery.recovery.uncertainty.rate < 1
  );
});

test("audit records hashes, methods, controls, failures, and claim boundary", async () => {
  const auditText = await readFile(
    new URL(
      "content/idea-audits/cooperative-autonomous-driving-clock-age-pilot-v6.json",
      ROOT
    ),
    "utf8"
  );
  const audit = JSON.parse(auditText);
  const generatedAudit = await buildAuditDocument();
  const scriptText = await readFile(
    new URL(
      "scripts/idea-pilots/clock-age-identifiability-v6.mjs",
      ROOT
    ),
    "utf8"
  );
  const testText = await readFile(new URL(import.meta.url), "utf8");

  assert.deepEqual(audit, generatedAudit);
  assert.deepEqual(audit.methods, report.methods);
  assert.deepEqual(audit.execution.inputSha256, report.hashes.inputs);
  assert.deepEqual(audit.execution.outputSha256, report.hashes.output);
  assert.equal(
    audit.execution.sourceSha256[
      "scripts/idea-pilots/clock-age-identifiability-v6.mjs"
    ],
    sha256Text(scriptText)
  );
  assert.equal(
    audit.execution.sourceSha256[
      "test/clock-age-identifiability-v6.test.mjs"
    ],
    sha256Text(testText)
  );
  assert.deepEqual(
    audit.negativeControls,
    report.auditResults.negativeControls
  );
  assert.deepEqual(
    audit.missingFieldBranchControls,
    report.auditResults.missingFieldBranchControls
  );
  assert.deepEqual(
    audit.wrongButPresentEmpiricalAblations,
    report.auditResults.wrongButPresentEmpiricalAblations
  );
  assert.deepEqual(
    audit.failures,
    report.results.stopCondition.failedChecks
  );
  assert.equal(
    audit.stopCondition.observedAction,
    report.results.stopCondition.action
  );
  assert.match(audit.claimBoundary, /synthetic finite population/i);
  assert.match(audit.claimBoundary, /does not establish a real vulnerability/i);
  assert.match(
    audit.finitePopulation.interpretation,
    /cannot be extrapolated to real-system risk/i
  );
  assert.equal(
    audit.remainingBlockers.find(
      (blocker) => blocker.id === "externalRegistrationEvidence"
    ).active,
    true
  );
  assert.equal(
    audit.stopCondition.checks.externalRegistrationEvidence,
    false
  );
  assert.equal(
    JSON.stringify(
      audit.intervalMethodResults.byRegime["bounded-provenance"]
        .falseFreshAnyEvent
    ).includes("finitePopulationUpperBound"),
    false
  );
  assert.equal(Object.hasOwn(audit, "score"), false);
});
