import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import process from "node:process";

export const PILOT_CONFIG = Object.freeze({
  schemaVersion: 1,
  candidateId: "clock-domain-provenance-age-identifiability",
  calibrationSeed: 2026073101,
  testSeed: 2026073102,
  calibrationEpisodes: 512,
  episodesPerCriticalRegime: 400,
  grid: Object.freeze({
    offsetMs: Object.freeze([0, -20, 20, -100, 100, -500, 500]),
    driftPpm: Object.freeze([-100, -50, -10, 10, 50, 100]),
    relock: Object.freeze(["none", "step"]),
    deadlineMs: Object.freeze([50, 100, 200])
  }),
  regimes: Object.freeze([
    "paired-counterexample",
    "bounded-provenance",
    "common-clock",
    "unknown-domain",
    "relock-control"
  ]),
  calibrationMappingResidualLimitMs: 18,
  calibrationRateResidualLimitPpm: 120,
  calibrationGuardMs: 2,
  calibrationRateGuardPpm: 2,
  transformAnchorLookbackSenderMs: 2000,
  pairedDeadlineGapMs: 12,
  fusionLagMs: 4,
  decisionCost: Object.freeze({ falseFresh: 10, falseStale: 4, uncertain: 1 }),
  confidence: 0.95,
  stopThresholds: Object.freeze({
    minimumCriticalRegimeClusters: 400,
    minimumClusteredCoverage: 0.99,
    maximumZeroFalseFreshUpper95: 0.01,
    maximumBoundedUncertainRate: 0.1,
    minimumPairedWitnesses: 400,
    minimumUnknownDomainUncertainRate: 0.99,
    minimumRelockTransitionUncertainRate: 0.99,
    minimumRelockStableDecisionAccuracy: 0.99,
    minimumCommonClockDecisionAccuracy: 0.99,
    minimumAblationFailClosedRate: 0.99
  })
});

export const METHODS = Object.freeze([
  {
    id: "naive-direct-subtraction",
    kind: "point",
    definition: "fusion_use(receiver clock) minus sender publish timestamp, assuming numeric clocks are directly comparable"
  },
  {
    id: "mcap-log-minus-publish",
    kind: "point",
    definition: "MCAP log_time minus publish_time, without a clock-domain binding"
  },
  {
    id: "rtt-half-point",
    kind: "point",
    definition: "RTT/2 plus receiver-local receipt-to-use lag"
  },
  {
    id: "ptp-like-point",
    kind: "point",
    definition: "single affine sender-to-reference mapping point, ignoring its uncertainty and validity"
  },
  {
    id: "provenance-interval",
    kind: "interval",
    definition: "independently calibrated affine mapping interval with domain, validity, rate, and relock checks"
  },
  {
    id: "oracle",
    kind: "oracle",
    definition: "test truth age; evaluation-only upper bound"
  },
  {
    id: "provenance-minus-clock-domain",
    kind: "ablation",
    definition: "provenance interval after removing clock_domain; missing evidence fails closed"
  },
  {
    id: "provenance-minus-validity",
    kind: "ablation",
    definition: "provenance interval after removing validity; missing evidence fails closed"
  },
  {
    id: "provenance-minus-rate",
    kind: "ablation",
    definition: "provenance interval after removing rate; missing evidence fails closed"
  },
  {
    id: "provenance-minus-relock",
    kind: "ablation",
    definition: "provenance interval after removing relock; missing evidence fails closed"
  }
]);

const METHOD_IDS = new Set(METHODS.map((method) => method.id));

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
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(digits));
}

function stableHash(value) {
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

function gridCells() {
  const cells = [];
  for (const deadlineMs of PILOT_CONFIG.grid.deadlineMs) {
    for (const offsetMs of PILOT_CONFIG.grid.offsetMs) {
      for (const driftPpm of PILOT_CONFIG.grid.driftPpm) {
        for (const relock of PILOT_CONFIG.grid.relock) {
          cells.push({ deadlineMs, offsetMs, driftPpm, relock });
        }
      }
    }
  }
  return cells;
}

const GRID_CELLS = gridCells();

function gridCell(index, shift = 0) {
  return GRID_CELLS[(index + shift) % GRID_CELLS.length];
}

function senderClockValue(referenceMs, anchorReferenceMs, offsetMs, driftPpm) {
  return anchorReferenceMs
    + (referenceMs - anchorReferenceMs) * (1 + driftPpm * 1e-6)
    + offsetMs;
}

function serviceProcess(index) {
  return Object.freeze({
    id: `fifo-service-${index % 17}`,
    discipline: "fifo",
    forwardQueueMs: 2 + (index % 4),
    forwardSerializationMs: 1 + (index % 3) * 0.25,
    reverseQueueMs: 2 + ((index + 1) % 4),
    reverseSerializationMs: 1 + ((index + 2) % 3) * 0.25,
    receiverProcessingMs: PILOT_CONFIG.fusionLagMs
  });
}

function payloadFor(index) {
  return Object.freeze({
    messageType: "cooperative-object-list",
    senderId: `sender-${index % 8}`,
    sequence: index,
    objects: Object.freeze([
      Object.freeze({ id: index % 23, xCm: 1000 + index, yCm: 2000 - index })
    ])
  });
}

function makeTransform({
  sourceClockDomainId,
  anchorSenderMs,
  anchorReferenceMs,
  ratePpm,
  relockCounter,
  validityHalfSpanMs = 5000
}) {
  return {
    sourceClockDomainId,
    targetClockDomainId: "reference-tai",
    anchorSenderMs,
    anchorReferenceMs,
    ratePpm,
    validity: {
      fromSenderMs: anchorSenderMs - validityHalfSpanMs,
      toSenderMs: anchorSenderMs + validityHalfSpanMs
    },
    relockCounter
  };
}

function makePointTransform({
  sourceClockDomainId,
  senderPublishMs,
  senderReferencePointMs,
  ratePpm,
  relockCounter,
  anchorLookbackSenderMs = PILOT_CONFIG.transformAnchorLookbackSenderMs
}) {
  const rate = 1 + ratePpm * 1e-6;
  const anchorSenderMs = senderPublishMs - anchorLookbackSenderMs;
  const anchorReferenceMs = senderReferencePointMs - anchorLookbackSenderMs / rate;
  return makeTransform({
    sourceClockDomainId,
    anchorSenderMs,
    anchorReferenceMs,
    ratePpm,
    relockCounter
  });
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
    const trueReferenceMs = 200000 + index * 37;
    const trueRatePpm = PILOT_CONFIG.grid.driftPpm[index % PILOT_CONFIG.grid.driftPpm.length];
    const mappingResidualMs = (rng() * 2 - 1)
      * PILOT_CONFIG.calibrationMappingResidualLimitMs;
    const rateResidualPpm = (rng() * 2 - 1)
      * PILOT_CONFIG.calibrationRateResidualLimitPpm;
    episodes.push({
      episodeId: `cal-${seed}-${index}`,
      measuredReferenceMs: trueReferenceMs + mappingResidualMs,
      measuredRatePpm: trueRatePpm + rateResidualPpm,
      calibrationTruth: {
        referenceMs: trueReferenceMs,
        ratePpm: trueRatePpm
      }
    });
  }
  return episodes;
}

export function fitCalibration(calibrationEpisodes) {
  if (!calibrationEpisodes.length) throw new Error("Calibration requires at least one episode.");
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
  return Object.freeze({
    calibrationSeed: Number(calibrationEpisodes[0].episodeId.split("-")[1]),
    calibrationEpisodeCount: calibrationEpisodes.length,
    mappingHalfWidthMs: round(
      maximumMappingResidualMs + PILOT_CONFIG.calibrationGuardMs,
      9
    ),
    rateHalfWidthPpm: round(
      maximumRateResidualPpm + PILOT_CONFIG.calibrationRateGuardPpm,
      9
    ),
    fitRule: "max absolute calibration residual plus preregistered guard",
    testTruthUsed: false
  });
}

function makePairedRecords(index, calibration) {
  const cell = gridCell(index);
  const episodeId = `test-paired-${PILOT_CONFIG.testSeed}-${index}`;
  const sequence = index;
  const processSpec = serviceProcess(index);
  const payload = payloadFor(index);
  const anchorReferenceMs = 1000000 + index * 10000;
  const receiverReceiveMs = anchorReferenceMs + 1000;
  const fusionUseMs = receiverReceiveMs + PILOT_CONFIG.fusionLagMs;
  const freshAgeMs = cell.deadlineMs - PILOT_CONFIG.pairedDeadlineGapMs;
  const staleAgeMs = cell.deadlineMs + PILOT_CONFIG.pairedDeadlineGapMs;
  const freshOneWayMs = freshAgeMs - PILOT_CONFIG.fusionLagMs;
  const staleOneWayMs = staleAgeMs - PILOT_CONFIG.fusionLagMs;
  const freshSendReferenceMs = receiverReceiveMs - freshOneWayMs;
  const staleSendReferenceMs = receiverReceiveMs - staleOneWayMs;
  const senderRelockCounter = cell.relock === "step" ? 1 : 0;
  const freshDriftPpm = cell.driftPpm;
  const staleDriftPpm = -cell.driftPpm;
  const freshOffsetMs = cell.offsetMs;
  const senderPublishMs = senderClockValue(
    freshSendReferenceMs,
    anchorReferenceMs,
    freshOffsetMs,
    freshDriftPpm
  );
  const staleOffsetMs = senderPublishMs
    - anchorReferenceMs
    - (staleSendReferenceMs - anchorReferenceMs) * (1 + staleDriftPpm * 1e-6);
  const rttMs = 2 * (cell.deadlineMs - PILOT_CONFIG.fusionLagMs);
  const sourceClockDomainId = `paired-sender-domain-${index % 9}`;
  const transform = makePointTransform({
    sourceClockDomainId,
    senderPublishMs,
    senderReferencePointMs: (freshSendReferenceMs + staleSendReferenceMs) / 2,
    ratePpm: 0,
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
  const forwardServiceMs = processSpec.forwardQueueMs + processSpec.forwardSerializationMs;
  const reverseServiceMs = processSpec.reverseQueueMs + processSpec.reverseSerializationMs;
  const commonTruth = {
    deadlineMs: cell.deadlineMs,
    senderRelockCounter,
    networkServiceProcess: processSpec
  };
  const freshTruth = truthFor({
    ...commonTruth,
    ageMs: freshAgeMs,
    oneWayDelayMs: freshOneWayMs,
    reverseDelayMs: rttMs - freshOneWayMs,
    senderOffsetMs: freshOffsetMs,
    senderDriftPpm: freshDriftPpm
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
  const traceHash = stableHash(observation);
  return [
    { episodeId, regime: "paired-counterexample", world: "fresh-world", observation, truth: freshTruth, traceHash },
    { episodeId, regime: "paired-counterexample", world: "stale-world", observation: structuredClone(observation), truth: staleTruth, traceHash }
  ];
}

function makeBoundedRecord(index, variant, calibration, rng) {
  const cell = gridCell(index, 31);
  const episodeId = `test-bounded-${PILOT_CONFIG.testSeed}-${index}`;
  const processSpec = serviceProcess(index + 1000);
  const anchorReferenceMs = 6000000 + index * 10000;
  const receiverReceiveMs = anchorReferenceMs + 1500 + variant * 100;
  const fusionUseMs = receiverReceiveMs + PILOT_CONFIG.fusionLagMs;
  const marginMs = calibration.mappingHalfWidthMs * 1.8 + 5;
  const ageMs = variant === 0
    ? cell.deadlineMs - marginMs
    : cell.deadlineMs + marginMs;
  const oneWayDelayMs = ageMs - PILOT_CONFIG.fusionLagMs;
  const sendReferenceMs = receiverReceiveMs - oneWayDelayMs;
  const senderPublishMs = senderClockValue(
    sendReferenceMs,
    anchorReferenceMs,
    cell.offsetMs,
    cell.driftPpm
  );
  const sourceClockDomainId = `bounded-sender-domain-${index % 11}`;
  const relockCounter = cell.relock === "step" ? 1 : 0;
  const mappingErrorMs = (rng() * 2 - 1) * calibration.mappingHalfWidthMs * 0.8;
  const rateErrorPpm = (rng() * 2 - 1) * calibration.rateHalfWidthPpm * 0.8;
  const transform = makePointTransform({
    sourceClockDomainId,
    senderPublishMs,
    senderReferencePointMs: sendReferenceMs + mappingErrorMs,
    ratePpm: cell.driftPpm + rateErrorPpm,
    relockCounter
  });
  const rttBiasMs = (rng() * 2 - 1) * Math.min(20, oneWayDelayMs * 0.5);
  const rttMs = Math.max(2, 2 * (oneWayDelayMs + rttBiasMs));
  const observation = makeObservation({
    episodeId,
    regime: "bounded-provenance",
    sequence: index * 2 + variant,
    deadlineMs: cell.deadlineMs,
    senderPublishMs,
    receiverReceiveMs,
    fusionUseMs,
    mcapLogMs: receiverReceiveMs + 2,
    rttMs,
    timestampClockDomainId: sourceClockDomainId,
    timestampRelockCounter: relockCounter,
    transform,
    networkServiceProcess: processSpec,
    payload: payloadFor(index * 2 + variant + 1000)
  });
  return {
    episodeId,
    regime: "bounded-provenance",
    world: "single",
    observation,
    truth: truthFor({
      deadlineMs: cell.deadlineMs,
      ageMs,
      oneWayDelayMs,
      reverseDelayMs: Math.max(0, rttMs - oneWayDelayMs),
      senderOffsetMs: cell.offsetMs,
      senderDriftPpm: cell.driftPpm,
      senderRelockCounter: relockCounter,
      networkServiceProcess: processSpec
    }),
    traceHash: stableHash(observation)
  };
}

function makeCommonClockRecord(index, variant) {
  const cell = gridCell(index, 67);
  const episodeId = `test-common-${PILOT_CONFIG.testSeed}-${index}`;
  const processSpec = serviceProcess(index + 2000);
  const receiverReceiveMs = 11000000 + index * 10000 + 1200 + variant * 100;
  const fusionUseMs = receiverReceiveMs + PILOT_CONFIG.fusionLagMs;
  const ageMs = variant === 0 ? cell.deadlineMs - 16 : cell.deadlineMs + 16;
  const oneWayDelayMs = ageMs - PILOT_CONFIG.fusionLagMs;
  const sendReferenceMs = receiverReceiveMs - oneWayDelayMs;
  const rttMs = 2 * oneWayDelayMs;
  const transform = makePointTransform({
    sourceClockDomainId: "reference-tai",
    senderPublishMs: sendReferenceMs,
    senderReferencePointMs: sendReferenceMs,
    ratePpm: 0,
    relockCounter: 0
  });
  const observation = makeObservation({
    episodeId,
    regime: "common-clock",
    sequence: index * 2 + variant,
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
    payload: payloadFor(index * 2 + variant + 2000)
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
      networkServiceProcess: processSpec
    }),
    traceHash: stableHash(observation)
  };
}

function makeUnknownDomainRecord(index, variant, calibration, rng) {
  const cell = gridCell(index, 109);
  const episodeId = `test-unknown-${PILOT_CONFIG.testSeed}-${index}`;
  const processSpec = serviceProcess(index + 3000);
  const anchorReferenceMs = 16000000 + index * 10000;
  const receiverReceiveMs = anchorReferenceMs + 1000 + variant * 100;
  const fusionUseMs = receiverReceiveMs + PILOT_CONFIG.fusionLagMs;
  const ageMs = variant === 0 ? cell.deadlineMs - 8 : cell.deadlineMs + 8;
  const oneWayDelayMs = ageMs - PILOT_CONFIG.fusionLagMs;
  const sendReferenceMs = receiverReceiveMs - oneWayDelayMs;
  const senderPublishMs = senderClockValue(
    sendReferenceMs,
    anchorReferenceMs,
    cell.offsetMs,
    cell.driftPpm
  );
  const unboundPointErrorMs = (rng() * 2 - 1) * calibration.mappingHalfWidthMs * 2;
  const transform = makePointTransform({
    sourceClockDomainId: "unbound-domain-claim",
    senderPublishMs,
    senderReferencePointMs: sendReferenceMs + unboundPointErrorMs,
    ratePpm: cell.driftPpm,
    relockCounter: cell.relock === "step" ? 1 : 0
  });
  const rttMs = 2 * Math.max(1, oneWayDelayMs + (rng() * 2 - 1) * 16);
  const observation = makeObservation({
    episodeId,
    regime: "unknown-domain",
    sequence: index * 2 + variant,
    deadlineMs: cell.deadlineMs,
    senderPublishMs,
    receiverReceiveMs,
    fusionUseMs,
    mcapLogMs: receiverReceiveMs + 2,
    rttMs,
    timestampClockDomainId: null,
    timestampRelockCounter: transform.relockCounter,
    transform,
    networkServiceProcess: processSpec,
    payload: payloadFor(index * 2 + variant + 3000)
  });
  return {
    episodeId,
    regime: "unknown-domain",
    world: "single",
    observation,
    truth: truthFor({
      deadlineMs: cell.deadlineMs,
      ageMs,
      oneWayDelayMs,
      reverseDelayMs: Math.max(0, rttMs - oneWayDelayMs),
      senderOffsetMs: cell.offsetMs,
      senderDriftPpm: cell.driftPpm,
      senderRelockCounter: transform.relockCounter,
      networkServiceProcess: processSpec
    }),
    traceHash: stableHash(observation)
  };
}

function makeRelockRecords(index, calibration, rng) {
  const cell = gridCell(index, 151);
  const episodeId = `test-relock-${PILOT_CONFIG.testSeed}-${index}`;
  const processSpec = serviceProcess(index + 4000);
  const sourceClockDomainId = `relock-sender-domain-${index % 7}`;
  const records = [];
  const phases = ["pre-relock", "transition", "post-calibration"];
  for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
    const phase = phases[phaseIndex];
    const receiverReceiveMs = 21000000 + index * 20000 + phaseIndex * 4000;
    const fusionUseMs = receiverReceiveMs + PILOT_CONFIG.fusionLagMs;
    const stableMarginMs = calibration.mappingHalfWidthMs * 1.7 + 5;
    const ageMs = (index + phaseIndex) % 2 === 0
      ? cell.deadlineMs - stableMarginMs
      : cell.deadlineMs + stableMarginMs;
    const oneWayDelayMs = ageMs - PILOT_CONFIG.fusionLagMs;
    const sendReferenceMs = receiverReceiveMs - oneWayDelayMs;
    const actualRelockCounter = phase === "pre-relock" ? 0 : 1;
    const offsetMs = cell.offsetMs + (actualRelockCounter === 1 ? 100 : 0);
    const senderPublishMs = senderClockValue(
      sendReferenceMs,
      receiverReceiveMs - 1000,
      offsetMs,
      cell.driftPpm
    );
    const mappingErrorMs = (rng() * 2 - 1) * calibration.mappingHalfWidthMs * 0.7;
    const transformRelockCounter = phase === "transition" ? 0 : actualRelockCounter;
    const transform = makePointTransform({
      sourceClockDomainId,
      senderPublishMs,
      senderReferencePointMs: sendReferenceMs + mappingErrorMs,
      ratePpm: cell.driftPpm,
      relockCounter: transformRelockCounter
    });
    const rttBiasLimitMs = Math.min(12, oneWayDelayMs * 0.45);
    const rttMs = 2 * (oneWayDelayMs + (rng() * 2 - 1) * rttBiasLimitMs);
    const observation = makeObservation({
      episodeId,
      regime: "relock-control",
      phase,
      sequence: index * 3 + phaseIndex,
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
      payload: payloadFor(index * 3 + phaseIndex + 4000)
    });
    records.push({
      episodeId,
      regime: "relock-control",
      world: phase,
      observation,
      truth: truthFor({
        deadlineMs: cell.deadlineMs,
        ageMs,
        oneWayDelayMs,
        reverseDelayMs: Math.max(0, rttMs - oneWayDelayMs),
        senderOffsetMs: offsetMs,
        senderDriftPpm: cell.driftPpm,
        senderRelockCounter: actualRelockCounter,
        networkServiceProcess: processSpec
      }),
      traceHash: stableHash(observation)
    });
  }
  return records;
}

export function generateTestEpisodes(calibration, seed = PILOT_CONFIG.testSeed) {
  if (seed === calibration.calibrationSeed) {
    throw new Error("Calibration and test seeds must be independent.");
  }
  const rng = createRng(seed);
  const records = [];
  for (let index = 0; index < PILOT_CONFIG.episodesPerCriticalRegime; index += 1) {
    records.push(...makePairedRecords(index, calibration));
    records.push(makeBoundedRecord(index, 0, calibration, rng));
    records.push(makeBoundedRecord(index, 1, calibration, rng));
    records.push(makeCommonClockRecord(index, 0));
    records.push(makeCommonClockRecord(index, 1));
    records.push(makeUnknownDomainRecord(index, 0, calibration, rng));
    records.push(makeUnknownDomainRecord(index, 1, calibration, rng));
    records.push(...makeRelockRecords(index, calibration, rng));
  }
  return records;
}

export function prepareMethodInput(record) {
  return record.observation;
}

function pointPrediction(estimateMs, deadlineMs) {
  return {
    verdict: verdictForPoint(estimateMs, deadlineMs),
    estimateMs,
    intervalMs: [estimateMs, estimateMs]
  };
}

function unknownIntervalPrediction(deadlineMs, reason) {
  return {
    verdict: verdictForInterval(0, Number.POSITIVE_INFINITY, deadlineMs),
    estimateMs: null,
    intervalMs: [0, Number.POSITIVE_INFINITY],
    reason
  };
}

function mapSenderPoint(input) {
  const transform = input.transform;
  if (!transform || !Number.isFinite(transform.anchorSenderMs)
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
  if (!timestamp?.clockDomainId || !transform?.sourceClockDomainId
    || timestamp.clockDomainId !== transform.sourceClockDomainId
    || input.receiverClockDomainId !== transform.targetClockDomainId) {
    return unknownIntervalPrediction(input.deadlineMs, "clock-domain-unbound");
  }
  if (!transform.validity
    || input.senderPublishMs < transform.validity.fromSenderMs
    || input.senderPublishMs > transform.validity.toSenderMs) {
    return unknownIntervalPrediction(input.deadlineMs, "outside-or-missing-validity");
  }
  if (!Number.isFinite(transform.ratePpm)) {
    return unknownIntervalPrediction(input.deadlineMs, "rate-unavailable");
  }
  if (!Number.isInteger(timestamp.relockCounter)
    || !Number.isInteger(transform.relockCounter)
    || timestamp.relockCounter !== transform.relockCounter) {
    return unknownIntervalPrediction(input.deadlineMs, "relock-generation-mismatch");
  }
  const senderReferencePointMs = mapSenderPoint(input);
  if (!Number.isFinite(senderReferencePointMs)) {
    return unknownIntervalPrediction(input.deadlineMs, "invalid-affine-transform");
  }
  const senderDeltaMs = Math.abs(input.senderPublishMs - transform.anchorSenderMs);
  const isVerifiedCommonClock = timestamp.clockDomainId === input.receiverClockDomainId;
  const rateUncertaintyMs = isVerifiedCommonClock
    ? 0
    : senderDeltaMs * calibration.rateHalfWidthPpm * 1e-6;
  const mappingHalfWidthMs = isVerifiedCommonClock
    ? 0
    : calibration.mappingHalfWidthMs + rateUncertaintyMs;
  const senderLowerMs = senderReferencePointMs - mappingHalfWidthMs;
  const senderUpperMs = senderReferencePointMs + mappingHalfWidthMs;
  const lowerMs = Math.max(0, input.fusionUseMs - senderUpperMs);
  const upperMs = Math.max(0, input.fusionUseMs - senderLowerMs);
  return {
    verdict: verdictForInterval(lowerMs, upperMs, input.deadlineMs),
    estimateMs: (lowerMs + upperMs) / 2,
    intervalMs: [lowerMs, upperMs]
  };
}

function ablateInput(input, field) {
  const ablated = structuredClone(input);
  if (field === "clock-domain") delete ablated.timestamp.clockDomainId;
  if (field === "validity") delete ablated.transform.validity;
  if (field === "rate") delete ablated.transform.ratePpm;
  if (field === "relock") delete ablated.timestamp.relockCounter;
  return ablated;
}

export function runMethod(methodId, input, calibration, oracleTruth = null) {
  if (!METHOD_IDS.has(methodId)) throw new Error(`Unknown method: ${methodId}`);
  if (methodId === "naive-direct-subtraction") {
    return pointPrediction(input.fusionUseMs - input.senderPublishMs, input.deadlineMs);
  }
  if (methodId === "mcap-log-minus-publish") {
    return pointPrediction(input.mcapLogMs - input.senderPublishMs, input.deadlineMs);
  }
  if (methodId === "rtt-half-point") {
    const localUseLagMs = input.fusionUseMs - input.receiverReceiveMs;
    return pointPrediction(input.rttMs / 2 + localUseLagMs, input.deadlineMs);
  }
  if (methodId === "ptp-like-point") {
    const senderReferencePointMs = mapSenderPoint(input);
    if (!Number.isFinite(senderReferencePointMs)) {
      return pointPrediction(Number.POSITIVE_INFINITY, input.deadlineMs);
    }
    return pointPrediction(input.fusionUseMs - senderReferencePointMs, input.deadlineMs);
  }
  if (methodId === "provenance-interval") {
    return intervalPrediction(input, calibration);
  }
  if (methodId === "oracle") {
    if (!oracleTruth) throw new Error("Oracle requires evaluation truth.");
    return pointPrediction(oracleTruth.ageMs, input.deadlineMs);
  }
  const field = methodId.replace("provenance-minus-", "");
  return intervalPrediction(ablateInput(input, field), calibration);
}

function groupValuesByCluster(rows, select, eligible = () => true) {
  const groups = new Map();
  for (const row of rows) {
    if (!eligible(row)) continue;
    if (!groups.has(row.episodeId)) groups.set(row.episodeId, []);
    groups.get(row.episodeId).push(select(row));
  }
  return groups;
}

function wilsonInterval(successes, total, z = 1.959963984540054) {
  if (total === 0) return [null, null];
  const proportion = successes / total;
  const denominator = 1 + z * z / total;
  const center = (proportion + z * z / (2 * total)) / denominator;
  const halfWidth = z * Math.sqrt(
    proportion * (1 - proportion) / total + z * z / (4 * total * total)
  ) / denominator;
  return [round(Math.max(0, center - halfWidth)), round(Math.min(1, center + halfWidth))];
}

function clusteredBinaryAny(rows, predicate, eligible = () => true) {
  const groups = groupValuesByCluster(rows, predicate, eligible);
  const values = [...groups.values()].map((entries) => entries.some(Boolean));
  const positives = values.filter(Boolean).length;
  const estimate = values.length ? positives / values.length : null;
  const ci95 = wilsonInterval(positives, values.length);
  const zeroUpper95 = positives === 0 && values.length > 0
    ? 1 - Math.pow(0.05, 1 / values.length)
    : null;
  return {
    estimate: estimate === null ? null : round(estimate),
    ci95,
    clusters: values.length,
    zeroEventUpper95: zeroUpper95 === null ? null : round(zeroUpper95)
  };
}

function clusteredMean(rows, select, eligible = () => true) {
  const groups = groupValuesByCluster(rows, select, eligible);
  const values = [...groups.values()].map(
    (entries) => entries.reduce((sum, value) => sum + value, 0) / entries.length
  );
  if (!values.length) return { estimate: null, ci95: [null, null], clusters: 0 };
  const estimate = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sampleVariance = values.length > 1
    ? values.reduce((sum, value) => sum + (value - estimate) ** 2, 0) / (values.length - 1)
    : 0;
  const halfWidth = 1.959963984540054 * Math.sqrt(sampleVariance / values.length);
  return {
    estimate: round(estimate),
    ci95: [round(Math.max(0, estimate - halfWidth)), round(estimate + halfWidth)],
    clusters: values.length
  };
}

function summarizeRows(rows) {
  const coverage = clusteredBinaryAny(
    rows,
    (row) => row.truth.ageMs >= row.prediction.intervalMs[0] - 1e-9
      && row.truth.ageMs <= row.prediction.intervalMs[1] + 1e-9
  );
  const falseFresh = clusteredBinaryAny(
    rows,
    (row) => row.prediction.verdict === "fresh",
    (row) => row.truth.verdict === "stale"
  );
  const falseStale = clusteredBinaryAny(
    rows,
    (row) => row.prediction.verdict === "stale",
    (row) => row.truth.verdict === "fresh"
  );
  const uncertainRate = clusteredMean(
    rows,
    (row) => row.prediction.verdict === "uncertain" ? 1 : 0
  );
  const decisionCost = clusteredMean(rows, (row) => {
    if (row.prediction.verdict === "uncertain") return PILOT_CONFIG.decisionCost.uncertain;
    if (row.prediction.verdict === "fresh" && row.truth.verdict === "stale") {
      return PILOT_CONFIG.decisionCost.falseFresh;
    }
    if (row.prediction.verdict === "stale" && row.truth.verdict === "fresh") {
      return PILOT_CONFIG.decisionCost.falseStale;
    }
    return 0;
  });
  const finiteWidthRows = rows.filter(
    (row) => Number.isFinite(row.prediction.intervalMs[1] - row.prediction.intervalMs[0])
  );
  const finiteWidth = clusteredMean(
    finiteWidthRows,
    (row) => row.prediction.intervalMs[1] - row.prediction.intervalMs[0]
  );
  const infiniteRate = clusteredMean(
    rows,
    (row) => Number.isFinite(row.prediction.intervalMs[1]) ? 0 : 1
  );
  return {
    clusteredCoverage: coverage,
    falseFresh,
    falseStale,
    uncertainRate,
    intervalWidthMs: {
      finiteMean: finiteWidth.estimate,
      finiteCi95: finiteWidth.ci95,
      infiniteRate: infiniteRate.estimate
    },
    decisionCost
  };
}

function decisionAccuracy(rows) {
  if (!rows.length) return null;
  return round(
    rows.filter((row) => row.prediction.verdict === row.truth.verdict).length
      / rows.length
  );
}

function buildControlResults(records, predictionsByMethod) {
  const pairedByEpisode = new Map();
  for (const record of records.filter((item) => item.regime === "paired-counterexample")) {
    if (!pairedByEpisode.has(record.episodeId)) pairedByEpisode.set(record.episodeId, []);
    pairedByEpisode.get(record.episodeId).push(record);
  }
  let identicalOppositePairs = 0;
  let serviceProcessMatchedPairs = 0;
  for (const pair of pairedByEpisode.values()) {
    if (pair.length !== 2) continue;
    if (JSON.stringify(pair[0].observation) === JSON.stringify(pair[1].observation)
      && pair[0].truth.verdict !== pair[1].truth.verdict) {
      identicalOppositePairs += 1;
    }
    if (JSON.stringify(pair[0].truth.networkServiceProcess)
      === JSON.stringify(pair[1].truth.networkServiceProcess)) {
      serviceProcessMatchedPairs += 1;
    }
  }

  const provenanceRows = predictionsByMethod.get("provenance-interval");
  const commonRows = predictionsByMethod.get("naive-direct-subtraction")
    .filter((row) => row.regime === "common-clock");
  const unknownRows = provenanceRows.filter((row) => row.regime === "unknown-domain");
  const pairedRows = provenanceRows.filter((row) => row.regime === "paired-counterexample");
  const relockRows = provenanceRows.filter((row) => row.regime === "relock-control");
  const stableRelockRows = relockRows.filter(
    (row) => row.observation.phase !== "transition"
  );
  const transitionRows = relockRows.filter(
    (row) => row.observation.phase === "transition"
  );
  const ablationFailClosedRate = {};
  for (const method of METHODS.filter((item) => item.kind === "ablation")) {
    const boundedRows = predictionsByMethod.get(method.id)
      .filter((row) => row.regime === "bounded-provenance");
    ablationFailClosedRate[method.id] = round(
      boundedRows.filter((row) => row.prediction.verdict === "uncertain").length
        / boundedRows.length
    );
  }

  return {
    pairedCounterexample: {
      episodePairs: pairedByEpisode.size,
      identicalObservableOppositeTruthPairs: identicalOppositePairs,
      identicalServiceProcessPairs: serviceProcessMatchedPairs,
      provenanceUncertainRate: round(
        pairedRows.filter((row) => row.prediction.verdict === "uncertain").length
          / pairedRows.length
      )
    },
    commonClockPositiveControl: {
      episodeClusters: new Set(commonRows.map((row) => row.episodeId)).size,
      naiveDecisionAccuracy: decisionAccuracy(commonRows)
    },
    unknownDomainNegativeControl: {
      episodeClusters: new Set(unknownRows.map((row) => row.episodeId)).size,
      provenanceUncertainRate: round(
        unknownRows.filter((row) => row.prediction.verdict === "uncertain").length
          / unknownRows.length
      )
    },
    relockPositiveControl: {
      episodeClusters: new Set(relockRows.map((row) => row.episodeId)).size,
      transitionUncertainRate: round(
        transitionRows.filter((row) => row.prediction.verdict === "uncertain").length
          / transitionRows.length
      ),
      stableDecisionAccuracy: decisionAccuracy(stableRelockRows)
    },
    fieldAblationFailClosedRate: ablationFailClosedRate
  };
}

function evaluateStopCondition(results) {
  const thresholds = PILOT_CONFIG.stopThresholds;
  const bounded = results.byRegime["bounded-provenance"]["provenance-interval"];
  const controls = results.controls;
  const checks = {
    criticalRegimeClusterCount:
      bounded.clusteredCoverage.clusters >= thresholds.minimumCriticalRegimeClusters,
    boundedCoverage:
      bounded.clusteredCoverage.ci95[0] >= thresholds.minimumClusteredCoverage,
    boundedFalseFreshUpper95:
      bounded.falseFresh.zeroEventUpper95 <= thresholds.maximumZeroFalseFreshUpper95,
    boundedUncertainRate:
      bounded.uncertainRate.estimate <= thresholds.maximumBoundedUncertainRate,
    pairedWitnesses:
      controls.pairedCounterexample.identicalObservableOppositeTruthPairs
        >= thresholds.minimumPairedWitnesses,
    pairedIntervalRefusal:
      controls.pairedCounterexample.provenanceUncertainRate === 1,
    unknownDomainRefusal:
      controls.unknownDomainNegativeControl.provenanceUncertainRate
        >= thresholds.minimumUnknownDomainUncertainRate,
    relockTransitionRefusal:
      controls.relockPositiveControl.transitionUncertainRate
        >= thresholds.minimumRelockTransitionUncertainRate,
    relockStableAccuracy:
      controls.relockPositiveControl.stableDecisionAccuracy
        >= thresholds.minimumRelockStableDecisionAccuracy,
    commonClockAccuracy:
      controls.commonClockPositiveControl.naiveDecisionAccuracy
        >= thresholds.minimumCommonClockDecisionAccuracy,
    ablationsFailClosed: Object.values(controls.fieldAblationFailClosedRate)
      .every((rate) => rate >= thresholds.minimumAblationFailClosedRate)
  };
  return {
    checks,
    action: Object.values(checks).every(Boolean)
      ? "continue-to-calibrated-trace-phase"
      : "stop-at-counterexample-and-audit-tooling"
  };
}

export function evaluatePilot(records, calibration) {
  const predictionsByMethod = new Map();
  for (const method of METHODS) {
    const rows = records.map((record) => ({
      episodeId: record.episodeId,
      regime: record.regime,
      observation: record.observation,
      truth: record.truth,
      prediction: runMethod(
        method.id,
        prepareMethodInput(record),
        calibration,
        method.id === "oracle" ? record.truth : null
      )
    }));
    predictionsByMethod.set(method.id, rows);
  }

  const overall = {};
  const byRegime = {};
  for (const method of METHODS) {
    overall[method.id] = summarizeRows(predictionsByMethod.get(method.id));
  }
  for (const regime of PILOT_CONFIG.regimes) {
    byRegime[regime] = {};
    for (const method of METHODS) {
      byRegime[regime][method.id] = summarizeRows(
        predictionsByMethod.get(method.id).filter((row) => row.regime === regime)
      );
    }
  }
  const controls = buildControlResults(records, predictionsByMethod);
  const results = { overall, byRegime, controls };
  results.stopCondition = evaluateStopCondition(results);
  return results;
}

function compactMetrics(summary) {
  return {
    clusteredCoverage: {
      estimate: summary.clusteredCoverage.estimate,
      ci95: summary.clusteredCoverage.ci95
    },
    falseFresh: {
      estimate: summary.falseFresh.estimate,
      zeroEventUpper95: summary.falseFresh.zeroEventUpper95
    },
    falseStale: summary.falseStale.estimate,
    uncertainRate: summary.uncertainRate.estimate,
    intervalWidthMs: {
      finiteMean: summary.intervalWidthMs.finiteMean,
      infiniteRate: summary.intervalWidthMs.infiniteRate
    },
    decisionCost: summary.decisionCost.estimate,
    clusters: summary.clusteredCoverage.clusters
  };
}

function buildAuditResults(results) {
  const overall = {};
  for (const method of METHODS) {
    overall[method.id] = compactMetrics(results.overall[method.id]);
  }
  const provenanceIntervalByRegime = {};
  for (const regime of PILOT_CONFIG.regimes) {
    provenanceIntervalByRegime[regime] = compactMetrics(
      results.byRegime[regime]["provenance-interval"]
    );
  }
  const pairedCounterexampleByMethod = {};
  for (const method of METHODS.filter((candidate) => candidate.kind !== "ablation")) {
    pairedCounterexampleByMethod[method.id] = compactMetrics(
      results.byRegime["paired-counterexample"][method.id]
    );
  }
  return {
    overall,
    provenanceIntervalByRegime,
    pairedCounterexampleByMethod,
    controls: results.controls,
    stopCondition: results.stopCondition
  };
}

export function runPilot() {
  const calibrationEpisodes = generateCalibrationEpisodes();
  const calibration = fitCalibration(calibrationEpisodes);
  const testRecords = generateTestEpisodes(calibration);
  const results = evaluatePilot(testRecords, calibration);
  return {
    schemaVersion: PILOT_CONFIG.schemaVersion,
    candidateId: PILOT_CONFIG.candidateId,
    seeds: {
      calibration: PILOT_CONFIG.calibrationSeed,
      test: PILOT_CONFIG.testSeed
    },
    grid: PILOT_CONFIG.grid,
    episodeCounts: {
      calibration: calibrationEpisodes.length,
      testRecords: testRecords.length,
      criticalRegimeClusters: Object.fromEntries(PILOT_CONFIG.regimes.map((regime) => [
        regime,
        new Set(testRecords.filter((record) => record.regime === regime)
          .map((record) => record.episodeId)).size
      ]))
    },
    calibration,
    methods: METHODS,
    results,
    auditResults: buildAuditResults(results)
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  process.stdout.write(`${JSON.stringify(runPilot(), null, 2)}\n`);
}
