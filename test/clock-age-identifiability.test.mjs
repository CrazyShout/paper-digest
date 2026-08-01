import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  METHODS,
  PILOT_CONFIG,
  fitCalibration,
  generateCalibrationEpisodes,
  generateTestEpisodes,
  prepareMethodInput,
  runMethod,
  runPilot
} from "../scripts/idea-pilots/clock-age-identifiability.mjs";

const ROOT = new URL("../", import.meta.url);
const calibrationEpisodes = generateCalibrationEpisodes();
const calibration = fitCalibration(calibrationEpisodes);
const testRecords = generateTestEpisodes(calibration);
const report = runPilot();

function recordsFor(regime) {
  return testRecords.filter((record) => record.regime === regime);
}

function groupByEpisode(records) {
  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record.episodeId)) groups.set(record.episodeId, []);
    groups.get(record.episodeId).push(record);
  }
  return groups;
}

test("pilot preregisters independent calibration/test seeds and the complete grid", () => {
  assert.notEqual(PILOT_CONFIG.calibrationSeed, PILOT_CONFIG.testSeed);
  assert.equal(calibrationEpisodes.length, 512);
  assert.equal(testRecords.length, 4400);
  assert.equal(calibration.testTruthUsed, false);

  const calibrationIds = new Set(calibrationEpisodes.map((episode) => episode.episodeId));
  assert.equal(testRecords.some((record) => calibrationIds.has(record.episodeId)), false);
  assert.deepEqual(PILOT_CONFIG.grid.offsetMs, [0, -20, 20, -100, 100, -500, 500]);
  assert.deepEqual(PILOT_CONFIG.grid.driftPpm, [-100, -50, -10, 10, 50, 100]);
  assert.deepEqual(PILOT_CONFIG.grid.relock, ["none", "step"]);
  assert.deepEqual(PILOT_CONFIG.grid.deadlineMs, [50, 100, 200]);

  const pairedFresh = recordsFor("paired-counterexample")
    .filter((record) => record.world === "fresh-world");
  assert.deepEqual(
    [...new Set(pairedFresh.map((record) => record.truth.senderClock.offsetMs))].sort((a, b) => a - b),
    [...PILOT_CONFIG.grid.offsetMs].sort((a, b) => a - b)
  );
  assert.deepEqual(
    [...new Set(pairedFresh.map((record) => record.truth.senderClock.driftPpm))].sort((a, b) => a - b),
    [...PILOT_CONFIG.grid.driftPpm].sort((a, b) => a - b)
  );
  assert.deepEqual(
    [...new Set(pairedFresh.map((record) => record.truth.senderClock.relockCounter))].sort(),
    [0, 1]
  );
  assert.deepEqual(
    [...new Set(pairedFresh.map((record) => record.observation.deadlineMs))].sort((a, b) => a - b),
    [...PILOT_CONFIG.grid.deadlineMs]
  );
});

test("paired worlds preserve observable traces and service processes but reverse deadline truth", () => {
  const pairs = groupByEpisode(recordsFor("paired-counterexample"));
  assert.equal(pairs.size, PILOT_CONFIG.episodesPerCriticalRegime);

  for (const pair of pairs.values()) {
    assert.equal(pair.length, 2);
    const [fresh, stale] = pair.sort((left) => left.world === "fresh-world" ? -1 : 1);
    assert.deepEqual(fresh.observation, stale.observation);
    assert.equal(fresh.traceHash, stale.traceHash);
    assert.deepEqual(fresh.observation.payload, stale.observation.payload);
    assert.equal(fresh.observation.messageOrder, stale.observation.messageOrder);
    assert.deepEqual(
      fresh.truth.networkServiceProcess,
      stale.truth.networkServiceProcess
    );
    assert.equal(fresh.truth.verdict, "fresh");
    assert.equal(stale.truth.verdict, "stale");
    assert.notEqual(fresh.truth.oneWayDelayMs, stale.truth.oneWayDelayMs);
    assert.notDeepEqual(fresh.truth.senderClock, stale.truth.senderClock);

    for (const method of METHODS.filter((candidate) => candidate.id !== "oracle")) {
      const freshPrediction = runMethod(
        method.id,
        prepareMethodInput(fresh),
        calibration
      );
      const stalePrediction = runMethod(
        method.id,
        prepareMethodInput(stale),
        calibration
      );
      assert.deepEqual(freshPrediction, stalePrediction, method.id);
    }
    assert.equal(
      runMethod("provenance-interval", fresh.observation, calibration).verdict,
      "uncertain"
    );
  }
});

test("non-oracle interval inputs do not expose or depend on test truth", () => {
  const original = recordsFor("bounded-provenance")[0];
  const changedTruth = structuredClone(original);
  changedTruth.truth.ageMs += 100000;
  changedTruth.truth.verdict = "stale";

  assert.equal(Object.hasOwn(prepareMethodInput(original), "truth"), false);
  assert.doesNotMatch(JSON.stringify(prepareMethodInput(original)), /oneWayDelayMs|senderClock/);
  assert.equal(
    original.observation.senderPublishMs - original.observation.transform.anchorSenderMs,
    PILOT_CONFIG.transformAnchorLookbackSenderMs
  );

  const changedRate = structuredClone(original.observation);
  changedRate.transform.ratePpm += 100;
  assert.notDeepEqual(
    runMethod("provenance-interval", original.observation, calibration),
    runMethod("provenance-interval", changedRate, calibration)
  );

  for (const method of METHODS.filter((candidate) => candidate.id !== "oracle")) {
    assert.deepEqual(
      runMethod(method.id, prepareMethodInput(original), calibration),
      runMethod(method.id, prepareMethodInput(changedTruth), calibration),
      method.id
    );
  }
  assert.throws(
    () => runMethod("oracle", prepareMethodInput(original), calibration),
    /requires evaluation truth/
  );
});

test("positive and negative controls plus provenance ablations follow preregistered behavior", () => {
  const controls = report.results.controls;
  for (const record of testRecords) {
    assert.ok(record.observation.rttMs + 1e-9 >= record.truth.oneWayDelayMs);
    assert.ok(record.truth.reverseDelayMs >= 0);
  }
  assert.deepEqual(controls.pairedCounterexample, {
    episodePairs: 400,
    identicalObservableOppositeTruthPairs: 400,
    identicalServiceProcessPairs: 400,
    provenanceUncertainRate: 1
  });
  assert.deepEqual(controls.commonClockPositiveControl, {
    episodeClusters: 400,
    naiveDecisionAccuracy: 1
  });
  assert.deepEqual(controls.unknownDomainNegativeControl, {
    episodeClusters: 400,
    provenanceUncertainRate: 1
  });
  assert.deepEqual(controls.relockPositiveControl, {
    episodeClusters: 400,
    transitionUncertainRate: 1,
    stableDecisionAccuracy: 1
  });
  assert.deepEqual(controls.fieldAblationFailClosedRate, {
    "provenance-minus-clock-domain": 1,
    "provenance-minus-validity": 1,
    "provenance-minus-rate": 1,
    "provenance-minus-relock": 1
  });
});

test("clustered metrics satisfy the frozen stop-condition computation", () => {
  const bounded = report.results.byRegime["bounded-provenance"]["provenance-interval"];
  assert.deepEqual(bounded.clusteredCoverage, {
    estimate: 1,
    ci95: [0.990488, 1],
    clusters: 400,
    zeroEventUpper95: null
  });
  assert.deepEqual(bounded.falseFresh, {
    estimate: 0,
    ci95: [0, 0.009512],
    clusters: 400,
    zeroEventUpper95: 0.007461
  });
  assert.equal(bounded.falseStale.estimate, 0);
  assert.equal(bounded.uncertainRate.estimate, 0);
  assert.equal(bounded.intervalWidthMs.infiniteRate, 0);
  assert.equal(bounded.decisionCost.estimate, 0);
  assert.equal(report.results.overall.oracle.decisionCost.estimate, 0);
  assert.equal(
    Object.values(report.results.stopCondition.checks).every(Boolean),
    true
  );
  assert.equal(
    report.results.stopCondition.action,
    "continue-to-calibrated-trace-phase"
  );
});

test("audit JSON records the executable seeds, methods, results, and claim boundary", async () => {
  const audit = JSON.parse(await readFile(
    new URL(
      "content/idea-audits/cooperative-autonomous-driving-clock-age-pilot-v4.json",
      ROOT
    ),
    "utf8"
  ));

  assert.deepEqual(audit.preregistration.seeds, report.seeds);
  assert.deepEqual(audit.preregistration.grid, report.grid);
  assert.deepEqual(audit.methods, report.methods);
  assert.deepEqual(audit.execution.calibration, report.calibration);
  assert.deepEqual(audit.results, report.auditResults);
  assert.equal(audit.stopCondition.observedAction, report.results.stopCondition.action);
  assert.match(audit.claimBoundary, /synthetic deterministic CPU pilot/i);
  assert.match(audit.claimBoundary, /does not establish a vulnerability/i);
  assert.equal(Object.hasOwn(audit, "score"), false);
});
