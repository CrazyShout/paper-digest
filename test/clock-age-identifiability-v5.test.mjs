import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  METHODS,
  METRIC_DEFINITIONS,
  PILOT_CONFIG,
  TEST_DGP_CONFIG,
  clusterAnyEvent,
  clusterEveryCovered,
  evaluateStopCondition,
  fitCalibration,
  generateCalibrationEpisodes,
  generateFrozenTestPopulation,
  mapSenderPoint,
  prepareMethodInput,
  runMethod,
  runPilot,
  sha256Json
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
      episodeId: "v5-cal-999999991-0",
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

test("new seeds and alternative seeds are carried into disjoint v5 episode IDs", () => {
  assert.equal(PILOT_CONFIG.calibrationSeed, 2026073141);
  assert.equal(PILOT_CONFIG.testSeed, 2026073197);
  assert.notEqual(PILOT_CONFIG.calibrationSeed, PILOT_CONFIG.testSeed);
  assert.equal(report.episodeIds.includePassedTestSeed, true);
  assert.match(report.episodeIds.first, /v5-test-/);

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
      estimate: 0.5,
      finitePopulationUpperBound: 0.5
    }
  );
});

test("one false-fresh or a non-finite upper bound fails the gate", () => {
  const oneFalseFresh = structuredClone(report.results);
  const bounded =
    oneFalseFresh.intervalByRegime["bounded-provenance"];
  bounded.falseFreshAnyEvent = {
    eventClusters: 1,
    noEventClusters: 251,
    eligibleClusters: 252,
    estimate: 1 / 252,
    finitePopulationUpperBound: 1 / 252
  };
  const oneEventGate = evaluateStopCondition(
    oneFalseFresh,
    report.independenceEvidence
  );
  assert.equal(oneEventGate.checks.falseFreshGate, false);

  const missingUpper = structuredClone(report.results);
  missingUpper.intervalByRegime[
    "bounded-provenance"
  ].falseFreshAnyEvent = {
    eventClusters: 0,
    noEventClusters: 252,
    eligibleClusters: 252,
    estimate: 0,
    finitePopulationUpperBound: null
  };
  const missingUpperGate = evaluateStopCondition(
    missingUpper,
    report.independenceEvidence
  );
  assert.equal(missingUpperGate.checks.falseFreshGate, false);
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
      "content/idea-audits/cooperative-autonomous-driving-clock-age-pilot-v5.json",
      ROOT
    ),
    "utf8"
  );
  const audit = JSON.parse(auditText);
  const scriptText = await readFile(
    new URL(
      "scripts/idea-pilots/clock-age-identifiability-v5.mjs",
      ROOT
    ),
    "utf8"
  );
  const testText = await readFile(new URL(import.meta.url), "utf8");

  assert.deepEqual(audit.methods, report.methods);
  assert.deepEqual(audit.execution.inputSha256, report.hashes.inputs);
  assert.deepEqual(audit.execution.outputSha256, report.hashes.output);
  assert.equal(
    audit.execution.sourceSha256[
      "scripts/idea-pilots/clock-age-identifiability-v5.mjs"
    ],
    sha256Text(scriptText)
  );
  assert.equal(
    audit.execution.sourceSha256[
      "test/clock-age-identifiability-v5.test.mjs"
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
  assert.match(audit.claimBoundary, /no confidence interval/i);
  assert.equal(Object.hasOwn(audit, "score"), false);
});
