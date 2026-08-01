import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import process from "node:process";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const TEST_DGP_CONFIG = deepFreeze({
  version: "clock-age-test-dgp-v5",
  populationDefinition:
    "A finite seeded population containing every cell of the declared clock grid; all records are evaluated and no sampling CI is reported.",
  grid: {
    offsetMs: [0, -20, 20, -100, 100, -500, 500],
    driftPpm: [-100, -50, -10, 10, 50, 100],
    relock: ["none", "step"],
    deadlineMs: [50, 100, 200]
  },
  deadlineMarginsMs: [8, 22, 38],
  boundedLookbackReferenceMs: 180000,
  boundedMappingResidualSupportMs: 26,
  boundedRateResidualSupportPpm: 180,
  rateStressLookbackReferenceMs: 600000,
  rateStressMappingResidualSupportMs: 8,
  rateStressRateResidualSupportPpm: 180,
  relockLookbackReferenceMs: 20000,
  relockMappingResidualSupportMs: 8,
  relockRateResidualSupportPpm: 40,
  wrongRateDeltaPpm: 240,
  pairedDeadlineGapMs: 12,
  fusionLagMs: 4,
  validityPaddingSenderMs: 2000
});

export const PILOT_CONFIG = deepFreeze({
  schemaVersion: 1,
  pilotVersion: 5,
  candidateId: "clock-domain-provenance-age-identifiability",
  calibrationSeed: 2026073141,
  testSeed: 2026073197,
  calibrationEpisodes: 512,
  calibrationMappingResidualLimitMs: 18,
  calibrationRateResidualLimitPpm: 120,
  calibrationGuardMs: 2,
  calibrationRateGuardPpm: 2,
  exactHitToleranceMs: 1e-9,
  decisionCost: { falseFresh: 10, falseStale: 4, uncertain: 1 },
  stopThresholds: {
    requireCompleteFiniteGrid: true,
    requireEveryRecordCoverage: true,
    maximumFinitePopulationFalseFreshUpper: 0,
    maximumBoundedUncertainRecordRate: 0.5,
    requireAllPairedWitnesses: true,
    requireAllMissingFieldBranchesFailClosed: true,
    requireWrongPresentControlsFailClosed: true,
    requireRatePropagation: true,
    requireRelockMismatchAndRecovery: true,
    requireExternalRegistrationEvidence: true
  },
  registrationEvidence: {
    externalTimestamp: null,
    immutableCommit: null,
    status:
      "not-available-for-this-run; the pilot must stop rather than claim externally timestamped preregistration"
  }
});

export const METHODS = deepFreeze([
  {
    id: "naive-direct-subtraction",
    kind: "point",
    definition:
      "fusion_use in the receiver clock minus sender publish timestamp, assuming the numeric clocks are directly comparable"
  },
  {
    id: "mcap-log-minus-publish",
    kind: "point",
    definition:
      "MCAP log_time minus sender publish timestamp without a clock-domain binding"
  },
  {
    id: "rtt-half-point",
    kind: "point",
    definition:
      "RTT divided by two plus receiver-local receipt-to-use lag"
  },
  {
    id: "ptp-like-point",
    kind: "point",
    definition:
      "the affine sender-to-reference mapping point without uncertainty, validity, or identified-set reporting"
  },
  {
    id: "provenance-interval",
    kind: "interval",
    definition:
      "an affine age identified set using independently fitted mapping/rate bounds plus domain, validity, and relock checks"
  },
  {
    id: "oracle",
    kind: "oracle-point",
    definition:
      "the test truth age, used only as an evaluation reference"
  }
]);

export const METRIC_DEFINITIONS = deepFreeze({
  finitePopulation:
    "The seeded test population is finite and exhaustively evaluated. Counts and exact finite-population fractions are reported without Wilson, bootstrap, or other cluster confidence intervals.",
  intervalCoverage:
    "A cluster succeeds only when every record in that episode has a non-empty reported interval containing its true age.",
  eventErrors:
    "A false-fresh or false-stale cluster event occurs when any eligible record in that episode has the corresponding decision error.",
  pointMethods:
    "Point methods report record MAE, nearest-rank absolute-error quantiles, exact-hit counts at the declared tolerance, and decision-error counts. They do not report interval coverage.",
  finitePopulationEventUpper:
    "Because every episode in the declared finite population is evaluated, the observed event fraction is also the exact upper bound for that finite population. It is not an external risk or confidence bound.",
  calibrationUncertainty:
    "One fitted calibration artifact is shared across test episodes. The finite-grid summaries do not integrate calibration-fit uncertainty."
});

const METHOD_BY_ID = new Map(METHODS.map((method) => [method.id, method]));

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
}

export function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function verdictForPoint(ageMs, deadlineMs) {
  return ageMs <= deadlineMs ? "fresh" : "stale";
}

function verdictForInterval(lowerMs, upperMs, deadlineMs) {
  if (upperMs <= deadlineMs) return "fresh";
  if (lowerMs > deadlineMs) return "stale";
  return "uncertain";
}

function buildGridCells() {
  const cells = [];
  for (const deadlineMs of TEST_DGP_CONFIG.grid.deadlineMs) {
    for (const offsetMs of TEST_DGP_CONFIG.grid.offsetMs) {
      for (const driftPpm of TEST_DGP_CONFIG.grid.driftPpm) {
        for (const relock of TEST_DGP_CONFIG.grid.relock) {
          cells.push({ deadlineMs, offsetMs, driftPpm, relock });
        }
      }
    }
  }
  return deepFreeze(cells);
}

const GRID_CELLS = buildGridCells();

function gridCell(index, shift = 0) {
  return GRID_CELLS[(index + shift) % GRID_CELLS.length];
}

function serviceProcess(index) {
  return {
    id: `v5-fifo-service-${index % 19}`,
    discipline: "fifo",
    forwardQueueMs: 2 + (index % 4),
    forwardSerializationMs: 1 + (index % 3) * 0.25,
    reverseQueueMs: 2 + ((index + 1) % 4),
    reverseSerializationMs: 1 + ((index + 2) % 3) * 0.25,
    receiverProcessingMs: TEST_DGP_CONFIG.fusionLagMs
  };
}

function payloadFor(index) {
  return {
    messageType: "cooperative-object-list",
    senderId: `v5-sender-${index % 8}`,
    sequence: index,
    objects: [{ id: index % 23, xCm: 3000 + index, yCm: 4000 - index }]
  };
}

function makeTransform({
  sourceClockDomainId,
  anchorSenderMs,
  anchorReferenceMs,
  ratePpm,
  messageSenderMs,
  relockCounter
}) {
  return {
    sourceClockDomainId,
    targetClockDomainId: "reference-tai",
    anchorSenderMs,
    anchorReferenceMs,
    ratePpm,
    validity: {
      fromSenderMs: anchorSenderMs - TEST_DGP_CONFIG.validityPaddingSenderMs,
      toSenderMs: messageSenderMs + TEST_DGP_CONFIG.validityPaddingSenderMs
    },
    relockCounter
  };
}

function makeObservation({
  episodeId,
  regime,
  phase = "single",
  sequence,
  deadlineMs,
  senderPublishMs,
  receiverReceiveMs,
  fusionUseMs,
  mcapLogMs,
  rttMs,
  timestampClockDomainId,
  timestampRelockCounter,
  transform,
  networkServiceProcess,
  payload
}) {
  return {
    episodeId,
    regime,
    phase,
    sequence,
    deadlineMs,
    payload,
    messageOrder: sequence,
    senderPublishMs,
    receiverReceiveMs,
    fusionUseMs,
    mcapLogMs,
    rttMs,
    receiverClockDomainId: "reference-tai",
    timestamp: {
      clockDomainId: timestampClockDomainId,
      relockCounter: timestampRelockCounter
    },
    transform,
    networkServiceProcess
  };
}

function truthFor({
  deadlineMs,
  ageMs,
  oneWayDelayMs,
  reverseDelayMs,
  senderOffsetMs,
  senderDriftPpm,
  senderRelockCounter,
  mappingResidualMs,
  rateResidualPpm,
  lookbackReferenceMs,
  networkServiceProcess
}) {
  return {
    ageMs,
    verdict: verdictForPoint(ageMs, deadlineMs),
    oneWayDelayMs,
    reverseDelayMs,
    senderClock: {
      offsetMs: senderOffsetMs,
      driftPpm: senderDriftPpm,
      relockCounter: senderRelockCounter
    },
    transformError: {
      anchorMappingResidualMs: mappingResidualMs,
      rateResidualPpm,
      lookbackReferenceMs
    },
    networkServiceProcess
  };
}

export function generateCalibrationEpisodes(
  seed = PILOT_CONFIG.calibrationSeed,
  count = PILOT_CONFIG.calibrationEpisodes
) {
  const rng = createRng(seed);
  const episodes = [];
  for (let index = 0; index < count; index += 1) {
    const trueReferenceMs = 300000 + index * 43;
    const trueRatePpm =
      TEST_DGP_CONFIG.grid.driftPpm[index % TEST_DGP_CONFIG.grid.driftPpm.length];
    const mappingResidualMs =
      (rng() * 2 - 1) * PILOT_CONFIG.calibrationMappingResidualLimitMs;
    const rateResidualPpm =
      (rng() * 2 - 1) * PILOT_CONFIG.calibrationRateResidualLimitPpm;
    episodes.push({
      episodeId: `v5-cal-${seed}-${index}`,
      measuredReferenceMs: trueReferenceMs + mappingResidualMs,
      measuredRatePpm: trueRatePpm + rateResidualPpm,
      calibrationTruth: {
        referenceMs: trueReferenceMs,
        ratePpm: trueRatePpm
      }
    });
  }
  return deepFreeze(episodes);
}

export function fitCalibration(calibrationEpisodes) {
  if (!calibrationEpisodes.length) {
    throw new Error("Calibration requires at least one episode.");
  }
  let maximumMappingResidualMs = 0;
  let maximumRateResidualPpm = 0;
  for (const episode of calibrationEpisodes) {
    maximumMappingResidualMs = Math.max(
      maximumMappingResidualMs,
      Math.abs(episode.measuredReferenceMs - episode.calibrationTruth.referenceMs)
    );
    maximumRateResidualPpm = Math.max(
      maximumRateResidualPpm,
      Math.abs(episode.measuredRatePpm - episode.calibrationTruth.ratePpm)
    );
  }
  return deepFreeze({
    calibrationSeed: Number(calibrationEpisodes[0].episodeId.split("-")[2]),
    calibrationEpisodeCount: calibrationEpisodes.length,
    mappingHalfWidthMs: round(
      maximumMappingResidualMs + PILOT_CONFIG.calibrationGuardMs,
      9
    ),
    rateHalfWidthPpm: round(
      maximumRateResidualPpm + PILOT_CONFIG.calibrationRateGuardPpm,
      9
    ),
    fitRule: "maximum absolute calibration residual plus a fixed guard",
    testPopulationUsed: false
  });
}

function makeCrossDomainRecord({
  rng,
  seed,
  regime,
  index,
  variant,
  shift,
  sequence,
  phase = "single",
  timeShiftMs = 0,
  lookbackReferenceMs,
  mappingResidualSupportMs,
  rateResidualSupportPpm,
  timestampRelockCounter = null,
  transformRelockCounter = null,
  offsetStepMs = 0
}) {
  const cell = gridCell(index, shift);
  const marginMs =
    TEST_DGP_CONFIG.deadlineMarginsMs[
      (index + variant + shift) % TEST_DGP_CONFIG.deadlineMarginsMs.length
    ];
  const ageMs = variant === 0
    ? cell.deadlineMs - marginMs
    : cell.deadlineMs + marginMs;
  const anchorReferenceMs = 50000000 + shift * 1000000 + index * 2000000 + timeShiftMs;
  const anchorSenderMs = anchorReferenceMs + cell.offsetMs + offsetStepMs;
  const sendReferenceMs = anchorReferenceMs + lookbackReferenceMs;
  const trueRate = 1 + cell.driftPpm * 1e-6;
  const senderPublishMs =
    anchorSenderMs + (sendReferenceMs - anchorReferenceMs) * trueRate;
  const mappingResidualMs =
    (rng() * 2 - 1) * mappingResidualSupportMs;
  const rateResidualPpm =
    (rng() * 2 - 1) * rateResidualSupportPpm;
  const actualRelockCounter = timestampRelockCounter
    ?? (cell.relock === "step" ? 1 : 0);
  const claimedRelockCounter = transformRelockCounter ?? actualRelockCounter;
  const sourceClockDomainId = `v5-${regime}-domain-${index % 13}`;
  const transform = makeTransform({
    sourceClockDomainId,
    anchorSenderMs,
    anchorReferenceMs: anchorReferenceMs + mappingResidualMs,
    ratePpm: cell.driftPpm + rateResidualPpm,
    messageSenderMs: senderPublishMs,
    relockCounter: claimedRelockCounter
  });
  const fusionUseMs = sendReferenceMs + ageMs;
  const receiverReceiveMs = fusionUseMs - TEST_DGP_CONFIG.fusionLagMs;
  const oneWayDelayMs = ageMs - TEST_DGP_CONFIG.fusionLagMs;
  const rttBiasLimitMs = Math.min(8, oneWayDelayMs * 0.35);
  const rttMs = 2 * (oneWayDelayMs + (rng() * 2 - 1) * rttBiasLimitMs);
  const processSpec = serviceProcess(sequence);
  const episodeId = `v5-test-${regime}-${seed}-${index}`;
  const observation = makeObservation({
    episodeId,
    regime,
    phase,
    sequence,
    deadlineMs: cell.deadlineMs,
    senderPublishMs,
    receiverReceiveMs,
    fusionUseMs,
    mcapLogMs: receiverReceiveMs + 2,
    rttMs,
    timestampClockDomainId: sourceClockDomainId,
    timestampRelockCounter: actualRelockCounter,
    transform,
    networkServiceProcess: processSpec,
    payload: payloadFor(sequence)
  });
  return {
    episodeId,
    regime,
    world: phase,
    observation,
    truth: truthFor({
      deadlineMs: cell.deadlineMs,
      ageMs,
      oneWayDelayMs,
      reverseDelayMs: rttMs - oneWayDelayMs,
      senderOffsetMs: cell.offsetMs + offsetStepMs,
      senderDriftPpm: cell.driftPpm,
      senderRelockCounter: actualRelockCounter,
      mappingResidualMs,
      rateResidualPpm,
      lookbackReferenceMs,
      networkServiceProcess: processSpec
    }),
    traceHash: sha256Json(observation)
  };
}

function makePairedRecords(index, seed) {
  const cell = gridCell(index);
  const episodeId = `v5-test-paired-counterexample-${seed}-${index}`;
  const sequence = index * 20;
  const processSpec = serviceProcess(sequence);
  const payload = payloadFor(sequence);
  const anchorReferenceMs = 100000000 + index * 2000000;
  const receiverReceiveMs = anchorReferenceMs + 1000;
  const fusionUseMs = receiverReceiveMs + TEST_DGP_CONFIG.fusionLagMs;
  const freshAgeMs = cell.deadlineMs - TEST_DGP_CONFIG.pairedDeadlineGapMs;
  const staleAgeMs = cell.deadlineMs + TEST_DGP_CONFIG.pairedDeadlineGapMs;
  const freshOneWayMs = freshAgeMs - TEST_DGP_CONFIG.fusionLagMs;
  const staleOneWayMs = staleAgeMs - TEST_DGP_CONFIG.fusionLagMs;
  const freshSendReferenceMs = receiverReceiveMs - freshOneWayMs;
  const staleSendReferenceMs = receiverReceiveMs - staleOneWayMs;
  const senderRelockCounter = cell.relock === "step" ? 1 : 0;
  const freshRate = 1 + cell.driftPpm * 1e-6;
  const staleDriftPpm = -cell.driftPpm;
  const staleRate = 1 + staleDriftPpm * 1e-6;
  const senderPublishMs =
    anchorReferenceMs
    + (freshSendReferenceMs - anchorReferenceMs) * freshRate
    + cell.offsetMs;
  const staleOffsetMs =
    senderPublishMs
    - anchorReferenceMs
    - (staleSendReferenceMs - anchorReferenceMs) * staleRate;
  const rttMs = 2 * (cell.deadlineMs - TEST_DGP_CONFIG.fusionLagMs);
  const sourceClockDomainId = `v5-paired-domain-${index % 11}`;
  const mappedMidpointMs = (freshSendReferenceMs + staleSendReferenceMs) / 2;
  const anchorSenderMs =
    senderPublishMs - TEST_DGP_CONFIG.boundedLookbackReferenceMs;
  const transform = makeTransform({
    sourceClockDomainId,
    anchorSenderMs,
    anchorReferenceMs:
      mappedMidpointMs - TEST_DGP_CONFIG.boundedLookbackReferenceMs,
    ratePpm: 0,
    messageSenderMs: senderPublishMs,
    relockCounter: senderRelockCounter
  });
  const observation = makeObservation({
    episodeId,
    regime: "paired-counterexample",
    sequence,
    deadlineMs: cell.deadlineMs,
    senderPublishMs,
    receiverReceiveMs,
    fusionUseMs,
    mcapLogMs: receiverReceiveMs + 2,
    rttMs,
    timestampClockDomainId: sourceClockDomainId,
    timestampRelockCounter: senderRelockCounter,
    transform,
    networkServiceProcess: processSpec,
    payload
  });
  const forwardServiceMs =
    processSpec.forwardQueueMs + processSpec.forwardSerializationMs;
  const reverseServiceMs =
    processSpec.reverseQueueMs + processSpec.reverseSerializationMs;
  const commonTruth = {
    deadlineMs: cell.deadlineMs,
    senderRelockCounter,
    mappingResidualMs: 0,
    rateResidualPpm: 0,
    lookbackReferenceMs: TEST_DGP_CONFIG.boundedLookbackReferenceMs,
    networkServiceProcess: processSpec
  };
  const freshTruth = truthFor({
    ...commonTruth,
    ageMs: freshAgeMs,
    oneWayDelayMs: freshOneWayMs,
    reverseDelayMs: rttMs - freshOneWayMs,
    senderOffsetMs: cell.offsetMs,
    senderDriftPpm: cell.driftPpm
  });
  const staleTruth = truthFor({
    ...commonTruth,
    ageMs: staleAgeMs,
    oneWayDelayMs: staleOneWayMs,
    reverseDelayMs: rttMs - staleOneWayMs,
    senderOffsetMs: staleOffsetMs,
    senderDriftPpm: staleDriftPpm
  });
  freshTruth.networkPropagationMs = {
    forward: freshOneWayMs - forwardServiceMs,
    reverse: rttMs - freshOneWayMs - reverseServiceMs
  };
  staleTruth.networkPropagationMs = {
    forward: staleOneWayMs - forwardServiceMs,
    reverse: rttMs - staleOneWayMs - reverseServiceMs
  };
  const traceHash = sha256Json(observation);
  return [
    {
      episodeId,
      regime: "paired-counterexample",
      world: "fresh-world",
      observation,
      truth: freshTruth,
      traceHash
    },
    {
      episodeId,
      regime: "paired-counterexample",
      world: "stale-world",
      observation: structuredClone(observation),
      truth: staleTruth,
      traceHash
    }
  ];
}

function makeCommonClockRecord(index, seed, variant) {
  const cell = gridCell(index, 71);
  const marginMs =
    TEST_DGP_CONFIG.deadlineMarginsMs[(index + variant) % 3];
  const ageMs = variant === 0
    ? cell.deadlineMs - marginMs
    : cell.deadlineMs + marginMs;
  const sendReferenceMs = 700000000 + index * 2000000 + variant * 10000;
  const fusionUseMs = sendReferenceMs + ageMs;
  const receiverReceiveMs = fusionUseMs - TEST_DGP_CONFIG.fusionLagMs;
  const oneWayDelayMs = ageMs - TEST_DGP_CONFIG.fusionLagMs;
  const rttMs = 2 * oneWayDelayMs;
  const processSpec = serviceProcess(index * 20 + 4 + variant);
  const episodeId = `v5-test-common-clock-${seed}-${index}`;
  const transform = makeTransform({
    sourceClockDomainId: "reference-tai",
    anchorSenderMs: sendReferenceMs - 10000,
    anchorReferenceMs: sendReferenceMs - 10000,
    ratePpm: 0,
    messageSenderMs: sendReferenceMs,
    relockCounter: 0
  });
  const observation = makeObservation({
    episodeId,
    regime: "common-clock",
    sequence: index * 20 + 4 + variant,
    deadlineMs: cell.deadlineMs,
    senderPublishMs: sendReferenceMs,
    receiverReceiveMs,
    fusionUseMs,
    mcapLogMs: fusionUseMs,
    rttMs,
    timestampClockDomainId: "reference-tai",
    timestampRelockCounter: 0,
    transform,
    networkServiceProcess: processSpec,
    payload: payloadFor(index * 20 + 4 + variant)
  });
  return {
    episodeId,
    regime: "common-clock",
    world: "single",
    observation,
    truth: truthFor({
      deadlineMs: cell.deadlineMs,
      ageMs,
      oneWayDelayMs,
      reverseDelayMs: oneWayDelayMs,
      senderOffsetMs: 0,
      senderDriftPpm: 0,
      senderRelockCounter: 0,
      mappingResidualMs: 0,
      rateResidualPpm: 0,
      lookbackReferenceMs: 10000,
      networkServiceProcess: processSpec
    }),
    traceHash: sha256Json(observation)
  };
}

function makeUnknownDomainRecord(rng, index, seed, variant) {
  const record = makeCrossDomainRecord({
    rng,
    seed,
    regime: "unknown-domain",
    index,
    variant,
    shift: 113,
    sequence: index * 20 + 6 + variant,
    lookbackReferenceMs: TEST_DGP_CONFIG.boundedLookbackReferenceMs,
    mappingResidualSupportMs:
      TEST_DGP_CONFIG.boundedMappingResidualSupportMs,
    rateResidualSupportPpm:
      TEST_DGP_CONFIG.boundedRateResidualSupportPpm
  });
  record.observation.timestamp.clockDomainId = null;
  record.traceHash = sha256Json(record.observation);
  return record;
}

function makeRelockRecords(rng, index, seed) {
  const records = [];
  const phases = [
    {
      phase: "pre-relock",
      timestampRelockCounter: 0,
      transformRelockCounter: 0,
      offsetStepMs: 0
    },
    {
      phase: "transition-mismatch",
      timestampRelockCounter: 1,
      transformRelockCounter: 0,
      offsetStepMs: 100
    },
    {
      phase: "post-relock-recovery",
      timestampRelockCounter: 1,
      transformRelockCounter: 1,
      offsetStepMs: 100
    }
  ];
  for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
    const phase = phases[phaseIndex];
    records.push(makeCrossDomainRecord({
      rng,
      seed,
      regime: "relock-control",
      index,
      variant: (index + phaseIndex) % 2,
      shift: 157,
      sequence: index * 20 + 10 + phaseIndex,
      phase: phase.phase,
      timeShiftMs: phaseIndex * 100000,
      lookbackReferenceMs: TEST_DGP_CONFIG.relockLookbackReferenceMs,
      mappingResidualSupportMs:
        TEST_DGP_CONFIG.relockMappingResidualSupportMs,
      rateResidualSupportPpm:
        TEST_DGP_CONFIG.relockRateResidualSupportPpm,
      timestampRelockCounter: phase.timestampRelockCounter,
      transformRelockCounter: phase.transformRelockCounter,
      offsetStepMs: phase.offsetStepMs
    }));
  }
  return records;
}

export function generateFrozenTestPopulation(seed = PILOT_CONFIG.testSeed) {
  if (seed === PILOT_CONFIG.calibrationSeed) {
    throw new Error("Calibration and test seeds must be distinct.");
  }
  const rng = createRng(seed);
  const records = [];
  for (let index = 0; index < GRID_CELLS.length; index += 1) {
    records.push(...makePairedRecords(index, seed));
    for (const variant of [0, 1]) {
      records.push(makeCrossDomainRecord({
        rng,
        seed,
        regime: "bounded-provenance",
        index,
        variant,
        shift: 31,
        sequence: index * 20 + 2 + variant,
        lookbackReferenceMs: TEST_DGP_CONFIG.boundedLookbackReferenceMs,
        mappingResidualSupportMs:
          TEST_DGP_CONFIG.boundedMappingResidualSupportMs,
        rateResidualSupportPpm:
          TEST_DGP_CONFIG.boundedRateResidualSupportPpm
      }));
      records.push(makeCommonClockRecord(index, seed, variant));
      records.push(makeUnknownDomainRecord(rng, index, seed, variant));
      records.push(makeCrossDomainRecord({
        rng,
        seed,
        regime: "rate-stress",
        index,
        variant,
        shift: 137,
        sequence: index * 20 + 8 + variant,
        lookbackReferenceMs:
          TEST_DGP_CONFIG.rateStressLookbackReferenceMs,
        mappingResidualSupportMs:
          TEST_DGP_CONFIG.rateStressMappingResidualSupportMs,
        rateResidualSupportPpm:
          TEST_DGP_CONFIG.rateStressRateResidualSupportPpm
      }));
    }
    records.push(...makeRelockRecords(rng, index, seed));
  }
  return deepFreeze(records);
}

export function prepareMethodInput(record) {
  return record.observation;
}

function pointPrediction(estimateMs, deadlineMs) {
  return {
    kind: "point",
    verdict: verdictForPoint(estimateMs, deadlineMs),
    estimateMs
  };
}

function uncertainIntervalPrediction(reason) {
  return {
    kind: "interval",
    status: "uncertain",
    verdict: "uncertain",
    estimateMs: null,
    rawIntervalMs: null,
    intervalMs: [0, Number.POSITIVE_INFINITY],
    reason
  };
}

export function mapSenderPoint(input) {
  const transform = input.transform;
  if (!transform
    || !Number.isFinite(transform.anchorSenderMs)
    || !Number.isFinite(transform.anchorReferenceMs)
    || !Number.isFinite(transform.ratePpm)) {
    return null;
  }
  const rate = 1 + transform.ratePpm * 1e-6;
  if (!(rate > 0)) return null;
  return transform.anchorReferenceMs
    + (input.senderPublishMs - transform.anchorSenderMs) / rate;
}

function intervalPrediction(input, calibration) {
  const transform = input.transform;
  const timestamp = input.timestamp;
  if (!timestamp?.clockDomainId
    || !transform?.sourceClockDomainId
    || timestamp.clockDomainId !== transform.sourceClockDomainId
    || input.receiverClockDomainId !== transform.targetClockDomainId) {
    return uncertainIntervalPrediction("clock-domain-unbound-or-mismatched");
  }
  if (!transform.validity
    || input.senderPublishMs < transform.validity.fromSenderMs
    || input.senderPublishMs > transform.validity.toSenderMs) {
    return uncertainIntervalPrediction("outside-or-missing-validity");
  }
  if (!Number.isFinite(transform.ratePpm)) {
    return uncertainIntervalPrediction("rate-unavailable");
  }
  if (!Number.isInteger(timestamp.relockCounter)
    || !Number.isInteger(transform.relockCounter)
    || timestamp.relockCounter !== transform.relockCounter) {
    return uncertainIntervalPrediction("relock-generation-mismatch");
  }
  const senderReferencePointMs = mapSenderPoint(input);
  if (!Number.isFinite(senderReferencePointMs)) {
    return uncertainIntervalPrediction("invalid-affine-transform");
  }
  const senderDeltaMs =
    Math.abs(input.senderPublishMs - transform.anchorSenderMs);
  const verifiedCommonClock =
    timestamp.clockDomainId === input.receiverClockDomainId;
  const rateUncertaintyMs = verifiedCommonClock
    ? 0
    : senderDeltaMs * calibration.rateHalfWidthPpm * 1e-6;
  const mappingHalfWidthMs = verifiedCommonClock
    ? 0
    : calibration.mappingHalfWidthMs + rateUncertaintyMs;
  const mappedSenderLowerMs = senderReferencePointMs - mappingHalfWidthMs;
  const mappedSenderUpperMs = senderReferencePointMs + mappingHalfWidthMs;
  const rawLowerMs = input.fusionUseMs - mappedSenderUpperMs;
  const rawUpperMs = input.fusionUseMs - mappedSenderLowerMs;
  if (rawUpperMs < 0) {
    return {
      kind: "interval",
      status: "inconsistent-provenance",
      verdict: "uncertain",
      estimateMs: null,
      rawIntervalMs: [rawLowerMs, rawUpperMs],
      intervalMs: null,
      reason: "raw-age-interval-has-empty-intersection-with-nonnegative-ages"
    };
  }
  const lowerMs = Math.max(0, rawLowerMs);
  const upperMs = rawUpperMs;
  return {
    kind: "interval",
    status: "identified",
    verdict: verdictForInterval(lowerMs, upperMs, input.deadlineMs),
    estimateMs: (lowerMs + upperMs) / 2,
    rawIntervalMs: [rawLowerMs, rawUpperMs],
    intervalMs: [lowerMs, upperMs],
    reason: null
  };
}

export function runMethod(methodId, input, calibration, oracleTruth = null) {
  const method = METHOD_BY_ID.get(methodId);
  if (!method) throw new Error(`Unknown method: ${methodId}`);
  if (methodId === "naive-direct-subtraction") {
    return pointPrediction(
      input.fusionUseMs - input.senderPublishMs,
      input.deadlineMs
    );
  }
  if (methodId === "mcap-log-minus-publish") {
    return pointPrediction(
      input.mcapLogMs - input.senderPublishMs,
      input.deadlineMs
    );
  }
  if (methodId === "rtt-half-point") {
    const localUseLagMs = input.fusionUseMs - input.receiverReceiveMs;
    return pointPrediction(input.rttMs / 2 + localUseLagMs, input.deadlineMs);
  }
  if (methodId === "ptp-like-point") {
    const senderReferencePointMs = mapSenderPoint(input);
    const estimateMs = Number.isFinite(senderReferencePointMs)
      ? input.fusionUseMs - senderReferencePointMs
      : Number.POSITIVE_INFINITY;
    return pointPrediction(estimateMs, input.deadlineMs);
  }
  if (methodId === "provenance-interval") {
    return intervalPrediction(input, calibration);
  }
  if (!oracleTruth) throw new Error("Oracle requires evaluation truth.");
  return pointPrediction(oracleTruth.ageMs, input.deadlineMs);
}

function groupValuesByCluster(rows, predicate, eligible = () => true) {
  const groups = new Map();
  for (const row of rows) {
    if (!eligible(row)) continue;
    if (!groups.has(row.episodeId)) groups.set(row.episodeId, []);
    groups.get(row.episodeId).push(Boolean(predicate(row)));
  }
  return groups;
}

export function clusterEveryCovered(rows, predicate, eligible = () => true) {
  const groups = groupValuesByCluster(rows, predicate, eligible);
  const outcomes = [...groups.values()].map(
    (entries) => entries.length > 0 && entries.every(Boolean)
  );
  const successes = outcomes.filter(Boolean).length;
  const total = outcomes.length;
  return {
    successClusters: successes,
    failedClusters: total - successes,
    totalClusters: total,
    estimate: total ? round(successes / total) : null
  };
}

export function clusterAnyEvent(rows, predicate, eligible = () => true) {
  const groups = groupValuesByCluster(rows, predicate, eligible);
  const outcomes = [...groups.values()].map((entries) => entries.some(Boolean));
  const events = outcomes.filter(Boolean).length;
  const total = outcomes.length;
  const estimate = total ? events / total : null;
  return {
    eventClusters: events,
    noEventClusters: total - events,
    eligibleClusters: total,
    estimate: estimate === null ? null : round(estimate),
    finitePopulationUpperBound:
      estimate === null ? null : round(estimate)
  };
}

function nearestRank(values, probability) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(probability * sorted.length) - 1);
  return round(sorted[index]);
}

function decisionErrorCounts(rows) {
  const falseFreshRecords = rows.filter(
    (row) =>
      row.prediction.verdict === "fresh" && row.truth.verdict === "stale"
  ).length;
  const falseStaleRecords = rows.filter(
    (row) =>
      row.prediction.verdict === "stale" && row.truth.verdict === "fresh"
  ).length;
  return {
    falseFreshRecords,
    falseStaleRecords,
    totalDecisionErrorRecords: falseFreshRecords + falseStaleRecords,
    totalRecords: rows.length
  };
}

function summarizePointRows(rows) {
  const absoluteErrors = rows.map(
    (row) => Math.abs(row.prediction.estimateMs - row.truth.ageMs)
  );
  const exactHits = absoluteErrors.filter(
    (error) => error <= PILOT_CONFIG.exactHitToleranceMs
  ).length;
  return {
    records: rows.length,
    meanAbsoluteErrorMs: round(
      absoluteErrors.reduce((sum, error) => sum + error, 0)
        / absoluteErrors.length
    ),
    absoluteErrorQuantilesMs: {
      p50: nearestRank(absoluteErrors, 0.5),
      p90: nearestRank(absoluteErrors, 0.9),
      p95: nearestRank(absoluteErrors, 0.95),
      p99: nearestRank(absoluteErrors, 0.99),
      maximum: nearestRank(absoluteErrors, 1)
    },
    exactHit: {
      toleranceMs: PILOT_CONFIG.exactHitToleranceMs,
      records: exactHits,
      rate: round(exactHits / rows.length)
    },
    decisionErrors: decisionErrorCounts(rows)
  };
}

function meanFiniteIntervalWidth(rows) {
  const widths = rows
    .map((row) => row.prediction.intervalMs)
    .filter(
      (interval) =>
        Array.isArray(interval)
        && Number.isFinite(interval[0])
        && Number.isFinite(interval[1])
    )
    .map((interval) => interval[1] - interval[0]);
  return {
    finiteRecords: widths.length,
    meanMs: widths.length
      ? round(widths.reduce((sum, width) => sum + width, 0) / widths.length)
      : null,
    p95Ms: nearestRank(widths, 0.95)
  };
}

function summarizeIntervalRows(rows) {
  const coverage = clusterEveryCovered(
    rows,
    (row) =>
      Array.isArray(row.prediction.intervalMs)
      && row.truth.ageMs >= row.prediction.intervalMs[0] - 1e-9
      && row.truth.ageMs <= row.prediction.intervalMs[1] + 1e-9
  );
  const falseFresh = clusterAnyEvent(
    rows,
    (row) => row.prediction.verdict === "fresh",
    (row) => row.truth.verdict === "stale"
  );
  const falseStale = clusterAnyEvent(
    rows,
    (row) => row.prediction.verdict === "stale",
    (row) => row.truth.verdict === "fresh"
  );
  const uncertainRecords = rows.filter(
    (row) => row.prediction.verdict === "uncertain"
  ).length;
  const inconsistentRecords = rows.filter(
    (row) => row.prediction.status === "inconsistent-provenance"
  ).length;
  return {
    coverageEveryRecord: coverage,
    falseFreshAnyEvent: falseFresh,
    falseStaleAnyEvent: falseStale,
    uncertainty: {
      records: uncertainRecords,
      totalRecords: rows.length,
      rate: round(uncertainRecords / rows.length)
    },
    inconsistentProvenance: {
      records: inconsistentRecords,
      rate: round(inconsistentRecords / rows.length)
    },
    intervalWidthMs: meanFiniteIntervalWidth(rows),
    decisionErrors: decisionErrorCounts(rows)
  };
}

function makeRows(records, methodId, calibration) {
  return records.map((record) => ({
    episodeId: record.episodeId,
    regime: record.regime,
    world: record.world,
    observation: record.observation,
    truth: record.truth,
    prediction: runMethod(
      methodId,
      prepareMethodInput(record),
      calibration,
      methodId === "oracle" ? record.truth : null
    )
  }));
}

function mutateMissingField(input, field) {
  const mutated = structuredClone(input);
  if (field === "clock-domain") delete mutated.timestamp.clockDomainId;
  if (field === "validity") delete mutated.transform.validity;
  if (field === "rate") delete mutated.transform.ratePpm;
  if (field === "relock") delete mutated.timestamp.relockCounter;
  return mutated;
}

function buildMissingFieldBranchControls(records, calibration) {
  const base = records.find(
    (record) => record.regime === "bounded-provenance"
  );
  const controls = {};
  for (const field of ["clock-domain", "validity", "rate", "relock"]) {
    const prediction = runMethod(
      "provenance-interval",
      mutateMissingField(base.observation, field),
      calibration
    );
    controls[field] = {
      fieldPresentAfterMutation:
        field === "clock-domain"
          ? Object.hasOwn(mutateMissingField(base.observation, field).timestamp, "clockDomainId")
          : field === "relock"
            ? Object.hasOwn(mutateMissingField(base.observation, field).timestamp, "relockCounter")
            : Object.hasOwn(mutateMissingField(base.observation, field).transform, field === "rate" ? "ratePpm" : "validity"),
      verdict: prediction.verdict,
      reason: prediction.reason
    };
  }
  return controls;
}

function intervalRowsForMutation(records, calibration, mutate) {
  return records.map((record, index) => {
    const input = structuredClone(record.observation);
    mutate(input, record, index);
    return {
      episodeId: record.episodeId,
      regime: record.regime,
      world: record.world,
      observation: input,
      truth: record.truth,
      prediction: runMethod("provenance-interval", input, calibration)
    };
  });
}

function buildWrongButPresentAblations(records, calibration) {
  const boundedRecords = records.filter(
    (record) => record.regime === "bounded-provenance"
  );
  const wrongDomainRows = intervalRowsForMutation(
    boundedRecords,
    calibration,
    (input) => {
      input.timestamp.clockDomainId = "v5-present-but-wrong-domain";
    }
  );
  const expiredValidityRows = intervalRowsForMutation(
    boundedRecords,
    calibration,
    (input) => {
      input.transform.validity = {
        fromSenderMs: input.senderPublishMs - 2000,
        toSenderMs: input.senderPublishMs - 1
      };
    }
  );
  const rateRecords = records.filter(
    (record) => record.regime === "rate-stress"
  );
  const mappedTimestampShiftsMs = [];
  const wrongRateRows = intervalRowsForMutation(
    rateRecords,
    calibration,
    (input, _record, index) => {
      const baselineMappedMs = mapSenderPoint(input);
      const direction = index % 2 === 0 ? 1 : -1;
      input.transform.ratePpm +=
        direction * TEST_DGP_CONFIG.wrongRateDeltaPpm;
      mappedTimestampShiftsMs.push(
        mapSenderPoint(input) - baselineMappedMs
      );
    }
  );
  const widenedCalibration = {
    ...calibration,
    rateHalfWidthPpm:
      calibration.rateHalfWidthPpm + TEST_DGP_CONFIG.wrongRateDeltaPpm
  };
  const wrongRateWidenedRows = intervalRowsForMutation(
    rateRecords,
    widenedCalibration,
    (input, _record, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      input.transform.ratePpm +=
        direction * TEST_DGP_CONFIG.wrongRateDeltaPpm;
    }
  );
  const relockRecords = records.filter(
    (record) => record.regime === "relock-control"
  );
  const mismatchRows = makeRows(
    relockRecords.filter(
      (record) => record.observation.phase === "transition-mismatch"
    ),
    "provenance-interval",
    calibration
  );
  const recoveryRows = makeRows(
    relockRecords.filter(
      (record) => record.observation.phase === "post-relock-recovery"
    ),
    "provenance-interval",
    calibration
  );
  return {
    wrongDomainPresent: summarizeIntervalRows(wrongDomainRows),
    expiredValidityPresent: summarizeIntervalRows(expiredValidityRows),
    wrongRateLongLookback: {
      lookbackReferenceMs:
        TEST_DGP_CONFIG.rateStressLookbackReferenceMs,
      injectedRateDeltaPpm:
        TEST_DGP_CONFIG.wrongRateDeltaPpm,
      mappedTimestampShiftMs: {
        nonzeroRecords: mappedTimestampShiftsMs.filter(
          (value) => Math.abs(value) > 1e-9
        ).length,
        totalRecords: mappedTimestampShiftsMs.length,
        minimumAbsolute: round(
          Math.min(...mappedTimestampShiftsMs.map(Math.abs))
        ),
        p50Absolute: nearestRank(
          mappedTimestampShiftsMs.map(Math.abs),
          0.5
        ),
        maximumAbsolute: round(
          Math.max(...mappedTimestampShiftsMs.map(Math.abs))
        )
      },
      nominalUncertainty: summarizeIntervalRows(wrongRateRows),
      widenedRateUncertainty: summarizeIntervalRows(wrongRateWidenedRows),
      widthErrorTradeoff:
        "The widened variant changes only the declared rate uncertainty bound; compare coverage/error counts with finite interval width."
    },
    relockMismatchAndRecovery: {
      mismatch: summarizeIntervalRows(mismatchRows),
      recovery: summarizeIntervalRows(recoveryRows)
    }
  };
}

function buildNegativeControls(records, rowsByMethod) {
  const paired = records.filter(
    (record) => record.regime === "paired-counterexample"
  );
  const pairedGroups = new Map();
  for (const record of paired) {
    if (!pairedGroups.has(record.episodeId)) {
      pairedGroups.set(record.episodeId, []);
    }
    pairedGroups.get(record.episodeId).push(record);
  }
  let identicalOppositeTruthPairs = 0;
  let identicalServiceProcessPairs = 0;
  for (const pair of pairedGroups.values()) {
    if (pair.length !== 2) continue;
    if (
      JSON.stringify(pair[0].observation)
        === JSON.stringify(pair[1].observation)
      && pair[0].truth.verdict !== pair[1].truth.verdict
    ) {
      identicalOppositeTruthPairs += 1;
    }
    if (
      JSON.stringify(pair[0].truth.networkServiceProcess)
        === JSON.stringify(pair[1].truth.networkServiceProcess)
    ) {
      identicalServiceProcessPairs += 1;
    }
  }
  const intervalRows = rowsByMethod.get("provenance-interval");
  const pairedIntervalRows = intervalRows.filter(
    (row) => row.regime === "paired-counterexample"
  );
  const unknownRows = intervalRows.filter(
    (row) => row.regime === "unknown-domain"
  );
  const commonRows = rowsByMethod
    .get("naive-direct-subtraction")
    .filter((row) => row.regime === "common-clock");
  return {
    pairedObservationalEquivalence: {
      episodePairs: pairedGroups.size,
      identicalObservableOppositeTruthPairs:
        identicalOppositeTruthPairs,
      identicalQueueSerializationProcessingPairs:
        identicalServiceProcessPairs,
      directionalPropagationVariesBetweenWorlds: true,
      intervalUncertainRecords: pairedIntervalRows.filter(
        (row) => row.prediction.verdict === "uncertain"
      ).length,
      totalIntervalRecords: pairedIntervalRows.length
    },
    unknownDomain: {
      episodeClusters: new Set(
        unknownRows.map((row) => row.episodeId)
      ).size,
      uncertainRecords: unknownRows.filter(
        (row) => row.prediction.verdict === "uncertain"
      ).length,
      totalRecords: unknownRows.length
    },
    verifiedCommonClock: {
      episodeClusters: new Set(
        commonRows.map((row) => row.episodeId)
      ).size,
      decisionErrors:
        decisionErrorCounts(commonRows).totalDecisionErrorRecords,
      totalRecords: commonRows.length
    }
  };
}

export function evaluateStopCondition(results, executionEvidence) {
  const bounded =
    results.intervalByRegime["bounded-provenance"];
  const falseFresh = bounded.falseFreshAnyEvent;
  const missingControls = Object.values(
    results.missingFieldBranchControls
  );
  const wrongDomain =
    results.wrongButPresentAblations.wrongDomainPresent;
  const expired =
    results.wrongButPresentAblations.expiredValidityPresent;
  const ratePropagation =
    results.wrongButPresentAblations.wrongRateLongLookback
      .mappedTimestampShiftMs;
  const relock =
    results.wrongButPresentAblations.relockMismatchAndRecovery;
  const paired =
    results.negativeControls.pairedObservationalEquivalence;
  const checks = {
    testDgpFrozenBeforeCalibrationFit:
      executionEvidence.testDgpFrozenBeforeCalibrationFit === true,
    testDgpIndependentOfFittedBounds:
      executionEvidence.testDgpFunctionAcceptsCalibration === false,
    completeFiniteGrid:
      bounded.coverageEveryRecord.totalClusters
        === executionEvidence.expectedGridClusters,
    everyRecordIntervalCoverage:
      bounded.coverageEveryRecord.successClusters
        === bounded.coverageEveryRecord.totalClusters,
    falseFreshGate:
      falseFresh.estimate === 0
      && Number.isFinite(falseFresh.finitePopulationUpperBound)
      && falseFresh.finitePopulationUpperBound
        <= PILOT_CONFIG.stopThresholds
          .maximumFinitePopulationFalseFreshUpper,
    boundedUncertainRecordRate:
      bounded.uncertainty.rate
        <= PILOT_CONFIG.stopThresholds
          .maximumBoundedUncertainRecordRate,
    allPairedWitnesses:
      paired.identicalObservableOppositeTruthPairs
        === paired.episodePairs,
    missingFieldBranchesFailClosed:
      missingControls.length === 4
      && missingControls.every(
        (control) =>
          control.fieldPresentAfterMutation === false
          && control.verdict === "uncertain"
      ),
    wrongPresentDomainAndValidityFailClosed:
      wrongDomain.uncertainty.rate === 1
      && expired.uncertainty.rate === 1,
    rateErrorActuallyPropagates:
      ratePropagation.totalRecords > 0
      && ratePropagation.nonzeroRecords
        === ratePropagation.totalRecords,
    relockMismatchAndRecovery:
      relock.mismatch.uncertainty.rate === 1
      && relock.recovery.inconsistentProvenance.records === 0
      && relock.recovery.uncertainty.rate < 1,
    externalRegistrationEvidence:
      Boolean(PILOT_CONFIG.registrationEvidence.externalTimestamp)
      && Boolean(PILOT_CONFIG.registrationEvidence.immutableCommit)
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([id]) => id);
  return {
    checks,
    failedChecks,
    action: failedChecks.length === 0
      ? "continue-only-to-separately-calibrated-trace-phase"
      : "stop-at-finite-population-methodology-audit"
  };
}

export function evaluatePilot(records, calibration, executionEvidence) {
  const rowsByMethod = new Map();
  for (const method of METHODS) {
    rowsByMethod.set(
      method.id,
      makeRows(records, method.id, calibration)
    );
  }
  const pointOverall = {};
  for (const method of METHODS.filter(
    (candidate) =>
      candidate.kind === "point"
      || candidate.kind === "oracle-point"
  )) {
    pointOverall[method.id] =
      summarizePointRows(rowsByMethod.get(method.id));
  }
  const intervalRows = rowsByMethod.get("provenance-interval");
  const intervalByRegime = {};
  for (const regime of [
    "paired-counterexample",
    "bounded-provenance",
    "common-clock",
    "unknown-domain",
    "rate-stress",
    "relock-control"
  ]) {
    intervalByRegime[regime] = summarizeIntervalRows(
      intervalRows.filter((row) => row.regime === regime)
    );
  }
  const results = {
    pointOverall,
    intervalOverall: summarizeIntervalRows(intervalRows),
    intervalByRegime,
    negativeControls: buildNegativeControls(
      records,
      rowsByMethod
    ),
    missingFieldBranchControls:
      buildMissingFieldBranchControls(records, calibration),
    wrongButPresentAblations:
      buildWrongButPresentAblations(records, calibration)
  };
  results.stopCondition =
    evaluateStopCondition(results, executionEvidence);
  return results;
}

function buildAuditResults(results) {
  return {
    finitePopulationMetricSemantics: METRIC_DEFINITIONS,
    pointMethods: results.pointOverall,
    intervalMethod: {
      overall: results.intervalOverall,
      byRegime: results.intervalByRegime
    },
    negativeControls: results.negativeControls,
    missingFieldBranchControls:
      results.missingFieldBranchControls,
    wrongButPresentEmpiricalAblations:
      results.wrongButPresentAblations,
    failedChecks: results.stopCondition.failedChecks,
    stopCondition: results.stopCondition
  };
}

export function runPilot({
  calibrationSeed = PILOT_CONFIG.calibrationSeed,
  testSeed = PILOT_CONFIG.testSeed
} = {}) {
  const executionOrder = [];
  const designManifest = {
    pilotConfig: PILOT_CONFIG,
    testDgpConfig: TEST_DGP_CONFIG,
    methods: METHODS,
    metricDefinitions: METRIC_DEFINITIONS,
    runSeeds: {
      calibration: calibrationSeed,
      test: testSeed
    }
  };
  const designManifestSha256 = sha256Json(designManifest);
  executionOrder.push("design-manifest-hashed-before-data");
  const frozenTestPopulation = generateFrozenTestPopulation(testSeed);
  const frozenTestPopulationSha256 =
    sha256Json(frozenTestPopulation);
  executionOrder.push("test-population-generated-and-deep-frozen");
  const calibrationEpisodes =
    generateCalibrationEpisodes(calibrationSeed);
  executionOrder.push("calibration-episodes-generated");
  const calibration = fitCalibration(calibrationEpisodes);
  executionOrder.push("calibration-fitted-after-test-freeze");
  const executionEvidence = {
    testDgpFrozenBeforeCalibrationFit:
      executionOrder.indexOf(
        "test-population-generated-and-deep-frozen"
      )
      < executionOrder.indexOf(
        "calibration-fitted-after-test-freeze"
      ),
    testDgpFunctionAcceptsCalibration: false,
    expectedGridClusters: GRID_CELLS.length
  };
  const results = evaluatePilot(
    frozenTestPopulation,
    calibration,
    executionEvidence
  );
  const auditResults = buildAuditResults(results);
  return {
    schemaVersion: PILOT_CONFIG.schemaVersion,
    pilotVersion: PILOT_CONFIG.pilotVersion,
    candidateId: PILOT_CONFIG.candidateId,
    seeds: {
      calibration: calibrationSeed,
      test: testSeed
    },
    executionOrder,
    independenceEvidence: executionEvidence,
    finitePopulation: {
      definition: TEST_DGP_CONFIG.populationDefinition,
      gridClusters: GRID_CELLS.length,
      records: frozenTestPopulation.length,
      clusterConfidenceIntervalsReported: false,
      calibrationFitUncertaintyIntegrated: false
    },
    episodeIds: {
      first: frozenTestPopulation[0].episodeId,
      last:
        frozenTestPopulation[frozenTestPopulation.length - 1]
          .episodeId,
      includePassedTestSeed: frozenTestPopulation.every(
        (record) => record.episodeId.includes(`-${testSeed}-`)
      )
    },
    calibration,
    methods: METHODS,
    metricDefinitions: METRIC_DEFINITIONS,
    hashes: {
      inputs: {
        designManifestSha256,
        testDgpConfigSha256: sha256Json(TEST_DGP_CONFIG),
        calibrationEpisodesSha256:
          sha256Json(calibrationEpisodes),
        frozenTestPopulationSha256
      },
      output: {
        auditResultsSha256: sha256Json(auditResults)
      }
    },
    auditResults,
    results
  };
}

const invokedPath =
  process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  process.stdout.write(`${JSON.stringify(runPilot(), null, 2)}\n`);
}
