import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PILOT_SCHEMA_VERSION =
  "cooperative-perception-coupled-rate-proxy-pilot/v8";
export const MODEL_SCHEMA_VERSION =
  "frozen-falsifiable-sender-visible-fluid-proxy/v1";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(SCRIPT_PATH), "../..");
const TEST_PATH = resolve(
  REPOSITORY_ROOT,
  "test/coupled-rate-stability-v8.test.mjs",
);
const DEFAULT_OUTPUT = resolve(
  REPOSITORY_ROOT,
  "content/idea-audits/"
    + "cooperative-autonomous-driving-coupled-rate-stability-pilot-v8.json",
);

const CONTROLLERS = new Set([
  "fixed-equal-period-rate",
  "selector-limeric",
  "qoq-fixed-period",
  "coupled-controller",
  "weighted-limeric",
  "feedback-off",
]);
const HEX_SHA256 = /^[0-9a-f]{64}$/;
const EPSILON = 1e-12;

export class PilotError extends Error {
  constructor(code, message, witness = null) {
    super(message);
    this.name = "PilotError";
    this.code = code;
    this.witness = witness;
  }
}

function fail(code, message, witness = null) {
  throw new PilotError(code, message, witness);
}

function ensure(condition, code, message, witness = null) {
  if (!condition) fail(code, message, witness);
}

function finite(value, location) {
  ensure(
    Number.isFinite(value),
    "NON_FINITE_PARAMETER",
    `${location} must be finite`,
    { location, value },
  );
  return value;
}

function inRange(value, min, max, location) {
  finite(value, location);
  ensure(
    value >= min && value <= max,
    "PARAMETER_OUT_OF_RANGE",
    `${location} must be in [${min}, ${max}]`,
    { location, min, max, value },
  );
  return value;
}

function exactKeys(value, keys, location) {
  ensure(
    value && typeof value === "object" && !Array.isArray(value),
    "SCHEMA_VIOLATION",
    `${location} must be an object`,
  );
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  ensure(
    JSON.stringify(actual) === JSON.stringify(expected),
    "SCHEMA_VIOLATION",
    `${location} has unexpected keys`,
    { location, actual, expected },
  );
}

function clone(value) {
  return structuredClone(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mean(values) {
  ensure(values.length > 0, "EMPTY_SAMPLE", "mean needs observations");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function minMax(values) {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function round(value, digits = 10) {
  if (value === null || value === undefined) return value;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function roundDeep(value, digits = 10) {
  if (Array.isArray(value)) {
    return value.map((item) => roundDeep(item, digits));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        roundDeep(item, digits),
      ]),
    );
  }
  return typeof value === "number" ? round(value, digits) : value;
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

function relativePath(path) {
  return relative(REPOSITORY_ROOT, path).replaceAll("\\", "/");
}

function hashString(value) {
  const digest = createHash("sha256").update(String(value)).digest();
  return digest.readUInt32LE(0);
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function seededSenderRandom(seed, senderId, stream) {
  return mulberry32(hashString(`${seed}/${senderId}/${stream}`));
}

function sigmoid(value) {
  if (value >= 0) {
    const exponential = Math.exp(-value);
    return 1 / (1 + exponential);
  }
  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

function controllerFlags(controller) {
  return {
    rateFeedback: [
      "selector-limeric",
      "coupled-controller",
      "weighted-limeric",
    ].includes(controller),
    semanticFeedback: [
      "qoq-fixed-period",
      "coupled-controller",
    ].includes(controller),
    weightedRate: controller === "weighted-limeric",
  };
}

function senderDefaults(count) {
  const midpoint = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => ({
    id: `sender-${String(index + 1).padStart(2, "0")}`,
    utilityBase: 0.56 + (index - midpoint) * 0.008,
    rateNominal: 0.13,
    thresholdNominal: 0.5 + (index - midpoint) * 0.006,
    weight: 0.8 + (0.4 * index) / Math.max(1, count - 1),
  }));
}

export function createScenario(overrides = {}) {
  const senderCount = overrides.senderCount ?? 5;
  const senders = overrides.senders ?? senderDefaults(senderCount);
  const scenario = {
    modelSchemaVersion: MODEL_SCHEMA_VERSION,
    scenarioId: "five-sender-frozen-proxy",
    controller: "coupled-controller",
    signalMode: "shared-sender-visible",
    senderCount,
    senders,
    dtSeconds: 0.1,
    durationSeconds: 60,
    finalWindowSeconds: 20,
    controllerPeriodSeconds: 0.4,
    asynchronousUpdates: false,
    channelCapacity: 1,
    targetCbr: 0.65,
    payloadBase: 0.42,
    payloadSemantic: 0.98,
    minSelection: 0.08,
    logisticTemperature: 0.12,
    semanticRedundancyPenalty: 0.75,
    overlapStrength: 0.5,
    redundancyFeedback: 0.7,
    redundancyTarget: 0.05,
    rateMin: 0.025,
    rateMax: 0.32,
    thresholdMin: 0.08,
    thresholdMax: 0.92,
    targetLeak: 1,
    rateGain: 0.28,
    semanticGain: 0.32,
    observationTauSeconds: 0.25,
    redundancyTauSeconds: 0.3,
    shockAmplitude: 0.004,
    shockRetention: 0.82,
    initialPerturbation: 0.035,
    ...overrides,
    senders,
    senderCount,
  };
  return validateScenario(scenario);
}

export function validateScenario(input) {
  const scenario = clone(input);
  exactKeys(
    scenario,
    [
      "modelSchemaVersion",
      "scenarioId",
      "controller",
      "signalMode",
      "senderCount",
      "senders",
      "dtSeconds",
      "durationSeconds",
      "finalWindowSeconds",
      "controllerPeriodSeconds",
      "asynchronousUpdates",
      "channelCapacity",
      "targetCbr",
      "payloadBase",
      "payloadSemantic",
      "minSelection",
      "logisticTemperature",
      "semanticRedundancyPenalty",
      "overlapStrength",
      "redundancyFeedback",
      "redundancyTarget",
      "rateMin",
      "rateMax",
      "thresholdMin",
      "thresholdMax",
      "targetLeak",
      "rateGain",
      "semanticGain",
      "observationTauSeconds",
      "redundancyTauSeconds",
      "shockAmplitude",
      "shockRetention",
      "initialPerturbation",
    ],
    "scenario",
  );
  ensure(
    scenario.modelSchemaVersion === MODEL_SCHEMA_VERSION,
    "MODEL_SCHEMA_MISMATCH",
    "scenario model schema is not supported",
  );
  ensure(
    typeof scenario.scenarioId === "string" && scenario.scenarioId.length > 0,
    "SCHEMA_VIOLATION",
    "scenarioId must be a non-empty string",
  );
  ensure(
    CONTROLLERS.has(scenario.controller),
    "UNKNOWN_CONTROLLER",
    `unsupported controller: ${scenario.controller}`,
  );
  ensure(
    ["shared-sender-visible", "local-negative-control"].includes(
      scenario.signalMode,
    ),
    "UNKNOWN_SIGNAL_MODE",
    `unsupported signal mode: ${scenario.signalMode}`,
  );
  ensure(
    Number.isInteger(scenario.senderCount)
      && scenario.senderCount >= 2
      && scenario.senderCount <= 30,
    "INVALID_SENDER_COUNT",
    "senderCount must be an integer in [2, 30]",
  );
  ensure(
    Array.isArray(scenario.senders)
      && scenario.senders.length === scenario.senderCount,
    "INVALID_SENDERS",
    "senders length must equal senderCount",
  );
  const ids = new Set();
  scenario.senders = scenario.senders.map((sender, index) => {
    exactKeys(
      sender,
      [
        "id",
        "utilityBase",
        "rateNominal",
        "thresholdNominal",
        "weight",
      ],
      `senders[${index}]`,
    );
    ensure(
      typeof sender.id === "string" && /^[a-z0-9-]+$/.test(sender.id),
      "INVALID_SENDER_ID",
      `senders[${index}].id must be a canonical lowercase ID`,
    );
    ensure(!ids.has(sender.id), "DUPLICATE_SENDER_ID", sender.id);
    ids.add(sender.id);
    inRange(sender.utilityBase, 0, 1, `${sender.id}.utilityBase`);
    inRange(sender.rateNominal, 0.001, 1, `${sender.id}.rateNominal`);
    inRange(
      sender.thresholdNominal,
      0,
      1,
      `${sender.id}.thresholdNominal`,
    );
    inRange(sender.weight, 0.01, 100, `${sender.id}.weight`);
    return clone(sender);
  }).sort((left, right) => left.id.localeCompare(right.id));
  scenario.senderCount = scenario.senders.length;
  inRange(scenario.dtSeconds, 0.001, 1, "dtSeconds");
  inRange(scenario.durationSeconds, 5, 600, "durationSeconds");
  inRange(
    scenario.finalWindowSeconds,
    1,
    scenario.durationSeconds / 2,
    "finalWindowSeconds",
  );
  inRange(
    scenario.controllerPeriodSeconds,
    scenario.dtSeconds,
    10,
    "controllerPeriodSeconds",
  );
  const periodRatio = scenario.controllerPeriodSeconds / scenario.dtSeconds;
  ensure(
    Math.abs(periodRatio - Math.round(periodRatio)) < 1e-9,
    "NON_INTEGRAL_CONTROLLER_PERIOD",
    "controllerPeriodSeconds must be an integer multiple of dtSeconds",
  );
  ensure(
    typeof scenario.asynchronousUpdates === "boolean",
    "SCHEMA_VIOLATION",
    "asynchronousUpdates must be boolean",
  );
  inRange(scenario.channelCapacity, 0.01, 100, "channelCapacity");
  inRange(scenario.targetCbr, 0.05, 1.5, "targetCbr");
  inRange(scenario.payloadBase, 0.001, 10, "payloadBase");
  inRange(scenario.payloadSemantic, 0, 10, "payloadSemantic");
  inRange(scenario.minSelection, 0, 0.95, "minSelection");
  inRange(
    scenario.logisticTemperature,
    0.005,
    1,
    "logisticTemperature",
  );
  inRange(
    scenario.semanticRedundancyPenalty,
    0,
    10,
    "semanticRedundancyPenalty",
  );
  inRange(scenario.overlapStrength, 0, 1, "overlapStrength");
  inRange(scenario.redundancyFeedback, 0, 10, "redundancyFeedback");
  inRange(scenario.redundancyTarget, 0, 2, "redundancyTarget");
  inRange(scenario.rateMin, 0.001, 1, "rateMin");
  inRange(scenario.rateMax, scenario.rateMin, 2, "rateMax");
  inRange(scenario.thresholdMin, 0, 1, "thresholdMin");
  inRange(
    scenario.thresholdMax,
    scenario.thresholdMin,
    1,
    "thresholdMax",
  );
  inRange(scenario.targetLeak, 0.01, 20, "targetLeak");
  inRange(scenario.rateGain, 0, 20, "rateGain");
  inRange(scenario.semanticGain, 0, 20, "semanticGain");
  inRange(
    scenario.observationTauSeconds,
    scenario.dtSeconds / 10,
    20,
    "observationTauSeconds",
  );
  inRange(
    scenario.redundancyTauSeconds,
    scenario.dtSeconds / 10,
    20,
    "redundancyTauSeconds",
  );
  inRange(scenario.shockAmplitude, 0, 0.2, "shockAmplitude");
  inRange(scenario.shockRetention, 0, 0.999, "shockRetention");
  inRange(scenario.initialPerturbation, 0, 0.5, "initialPerturbation");
  for (const sender of scenario.senders) {
    inRange(sender.rateNominal, scenario.rateMin, scenario.rateMax, sender.id);
    inRange(
      sender.thresholdNominal,
      scenario.thresholdMin,
      scenario.thresholdMax,
      sender.id,
    );
  }
  return scenario;
}

function periodSteps(scenario) {
  return Math.round(
    scenario.controllerPeriodSeconds / scenario.dtSeconds,
  );
}

function phaseStep(index, scenario) {
  if (!scenario.asynchronousUpdates) return 0;
  return Math.floor((index * periodSteps(scenario)) / scenario.senderCount);
}

function shouldUpdate(step, index, scenario) {
  const period = periodSteps(scenario);
  return ((step - phaseStep(index, scenario)) % period + period) % period === 0;
}

function weightedNominal(sender, scenario) {
  if (scenario.controller !== "weighted-limeric") {
    return sender.rateNominal;
  }
  const averageWeight = mean(scenario.senders.map((item) => item.weight));
  return clamp(
    sender.rateNominal * sender.weight / averageWeight,
    scenario.rateMin,
    scenario.rateMax,
  );
}

function makeNominalState(scenario) {
  return {
    step: 0,
    senders: scenario.senders.map((sender) => ({
      id: sender.id,
      rate: weightedNominal(sender, scenario),
      threshold: sender.thresholdNominal,
      observedCbr: scenario.targetCbr,
      observedRedundancy: scenario.redundancyTarget,
      shock: 0,
      queue: 0,
    })),
  };
}

function validateState(state, scenario) {
  ensure(
    Number.isInteger(state.step) && state.step >= 0,
    "INVALID_STATE",
    "state.step must be a non-negative integer",
  );
  ensure(
    Array.isArray(state.senders)
      && state.senders.length === scenario.senderCount,
    "INVALID_STATE",
    "state sender count mismatch",
  );
  for (const [index, sender] of state.senders.entries()) {
    ensure(
      sender.id === scenario.senders[index].id,
      "STATE_SENDER_ORDER_MISMATCH",
      "state sender IDs must follow canonical scenario order",
    );
    for (const key of [
      "rate",
      "threshold",
      "observedCbr",
      "observedRedundancy",
      "shock",
      "queue",
    ]) {
      finite(sender[key], `state.${sender.id}.${key}`);
    }
  }
}

function semanticSelection(sender, state, scenario) {
  const effectiveUtility = sender.utilityBase + state.shock
    - scenario.semanticRedundancyPenalty * state.observedRedundancy;
  const probability = sigmoid(
    (effectiveUtility - state.threshold) / scenario.logisticTemperature,
  );
  return scenario.minSelection
    + (1 - scenario.minSelection) * probability;
}

function emissions(state, scenario) {
  return state.senders.map((senderState, index) => {
    const sender = scenario.senders[index];
    const selectedQuantity = semanticSelection(sender, senderState, scenario);
    const payload = scenario.payloadBase
      + scenario.payloadSemantic * selectedQuantity;
    const offered = senderState.rate * payload;
    return {
      id: sender.id,
      selectedQuantity,
      payload,
      offered,
      positiveMarginalUtility:
        sender.utilityBase + senderState.shock
          - scenario.semanticRedundancyPenalty
            * senderState.observedRedundancy > 0.05,
    };
  });
}

function observedSignals(emissionRows, scenario) {
  const aggregateOffered = emissionRows.reduce(
    (sum, row) => sum + row.offered,
    0,
  );
  const sharedCbr = aggregateOffered / scenario.channelCapacity;
  const values = emissionRows.map((row, index) => {
    if (scenario.signalMode === "local-negative-control") {
      return {
        cbr: scenario.senderCount * row.offered / scenario.channelCapacity,
        redundancy: 0,
      };
    }
    const otherOffered = aggregateOffered - row.offered;
    return {
      cbr: sharedCbr,
      redundancy:
        scenario.overlapStrength * otherOffered
          / Math.max(1, scenario.senderCount - 1)
          / scenario.channelCapacity,
    };
  });
  return { aggregateOffered, sharedCbr, values };
}

function deliveredService(emissionRows, scenario) {
  const aggregateOffered = emissionRows.reduce(
    (sum, row) => sum + row.offered,
    0,
  );
  const serviceScale = aggregateOffered <= scenario.channelCapacity
    ? 1
    : scenario.channelCapacity / aggregateOffered;
  return emissionRows.map((row) => row.offered * serviceScale);
}

function nextShock(current, random, scenario) {
  if (!random || scenario.shockAmplitude === 0) return 0;
  const innovation = (random() * 2 - 1) * scenario.shockAmplitude;
  return scenario.shockRetention * current + innovation;
}

export function stepProxy(
  inputState,
  scenarioInput,
  { randomBySender = null } = {},
) {
  const scenario = validateScenario(scenarioInput);
  const state = clone(inputState);
  validateState(state, scenario);
  const rows = emissions(state, scenario);
  const signals = observedSignals(rows, scenario);
  const delivered = deliveredService(rows, scenario);
  const cbrAlpha = 1 - Math.exp(
    -scenario.dtSeconds / scenario.observationTauSeconds,
  );
  const redundancyAlpha = 1 - Math.exp(
    -scenario.dtSeconds / scenario.redundancyTauSeconds,
  );
  const flags = controllerFlags(scenario.controller);
  const next = {
    step: state.step + 1,
    senders: state.senders.map((senderState, index) => {
      const sender = scenario.senders[index];
      const observedCbr = senderState.observedCbr
        + cbrAlpha * (signals.values[index].cbr - senderState.observedCbr);
      const observedRedundancy = senderState.observedRedundancy
        + redundancyAlpha * (
          signals.values[index].redundancy
            - senderState.observedRedundancy
        );
      let rate = senderState.rate;
      let threshold = senderState.threshold;
      if (shouldUpdate(state.step, index, scenario)) {
        if (flags.rateFeedback) {
          const nominal = weightedNominal(sender, scenario);
          const weight = flags.weightedRate ? sender.weight : 1;
          const error = weight * (scenario.targetCbr - senderState.observedCbr)
            - scenario.targetLeak * (senderState.rate - nominal);
          rate = clamp(
            senderState.rate
              + scenario.controllerPeriodSeconds
                * scenario.rateGain * error,
            scenario.rateMin,
            scenario.rateMax,
          );
        }
        if (flags.semanticFeedback) {
          const error = senderState.observedCbr - scenario.targetCbr
            + scenario.redundancyFeedback * (
              senderState.observedRedundancy - scenario.redundancyTarget
            )
            - scenario.targetLeak * (
              senderState.threshold - sender.thresholdNominal
            );
          threshold = clamp(
            senderState.threshold
              + scenario.controllerPeriodSeconds
                * scenario.semanticGain * error,
            scenario.thresholdMin,
            scenario.thresholdMax,
          );
        }
      }
      const queue = Math.max(
        0,
        senderState.queue
          + scenario.dtSeconds * (rows[index].offered - delivered[index]),
      );
      const random = randomBySender?.get(sender.id) ?? null;
      return {
        id: sender.id,
        rate,
        threshold,
        observedCbr,
        observedRedundancy,
        shock: nextShock(senderState.shock, random, scenario),
        queue,
      };
    }),
  };
  validateState(next, scenario);
  return {
    state: next,
    observation: {
      timeSeconds: state.step * scenario.dtSeconds,
      aggregateOffered: signals.aggregateOffered,
      channelLoad: signals.sharedCbr,
      senders: rows.map((row, index) => ({
        ...row,
        delivered: delivered[index],
        observedCbrUsed: state.senders[index].observedCbr,
        observedRedundancyUsed:
          state.senders[index].observedRedundancy,
        queueAfter: next.senders[index].queue,
        rateUsed: state.senders[index].rate,
        thresholdUsed: state.senders[index].threshold,
      })),
    },
  };
}

function stateVector(state) {
  return state.senders.flatMap((sender) => [
    sender.rate,
    sender.threshold,
    sender.observedCbr,
    sender.observedRedundancy,
  ]);
}

function vectorState(vector, template) {
  ensure(
    vector.length === template.senders.length * 4,
    "STATE_VECTOR_SIZE",
    "state vector has the wrong dimension",
  );
  return {
    step: template.step,
    senders: template.senders.map((sender, index) => ({
      id: sender.id,
      rate: vector[index * 4],
      threshold: vector[index * 4 + 1],
      observedCbr: vector[index * 4 + 2],
      observedRedundancy: vector[index * 4 + 3],
      shock: 0,
      queue: 0,
    })),
  };
}

function macroMap(state, scenario) {
  let current = { ...clone(state), step: 0 };
  for (let step = 0; step < periodSteps(scenario); step += 1) {
    current = stepProxy(current, scenario).state;
  }
  return { ...current, step: 0 };
}

function maxAbsDifference(left, right) {
  return Math.max(...left.map((value, index) => Math.abs(value - right[index])));
}

export function findEquilibrium(scenarioInput) {
  const scenario = validateScenario(scenarioInput);
  const relaxed = validateScenario({
    ...scenario,
    dtSeconds: Math.min(0.05, scenario.dtSeconds),
    controllerPeriodSeconds: 0.1,
    rateGain: controllerFlags(scenario.controller).rateFeedback ? 0.08 : 0,
    semanticGain:
      controllerFlags(scenario.controller).semanticFeedback ? 0.08 : 0,
    observationTauSeconds: 0.12,
    redundancyTauSeconds: 0.12,
    shockAmplitude: 0,
    initialPerturbation: 0,
  });
  let state = makeNominalState(relaxed);
  let residual = Infinity;
  let iterations = 0;
  for (; iterations < 12000; iterations += 1) {
    const next = macroMap(state, relaxed);
    residual = maxAbsDifference(stateVector(next), stateVector(state));
    state = next;
    if (residual < 1e-12) break;
  }
  ensure(
    residual < 1e-8,
    "EQUILIBRIUM_NOT_FOUND",
    "relaxed fixed-point iteration did not converge",
    { residual, iterations },
  );
  const projected = {
    step: 0,
    senders: state.senders.map((sender) => ({ ...sender, shock: 0, queue: 0 })),
  };
  const actualResidual = maxAbsDifference(
    stateVector(macroMap(projected, scenario)),
    stateVector(projected),
  );
  ensure(
    actualResidual < 2e-6,
    "EQUILIBRIUM_RESIDUAL_TOO_LARGE",
    "frozen controller map does not share the relaxed equilibrium",
    { actualResidual },
  );
  return {
    state: projected,
    relaxedIterations: iterations + 1,
    relaxedResidual: residual,
    actualMacroResidual: actualResidual,
  };
}

export function numericalJacobian(mapper, vector, epsilon = 1e-6) {
  ensure(
    typeof mapper === "function",
    "INVALID_JACOBIAN_MAP",
    "mapper must be a function",
  );
  ensure(
    Array.isArray(vector) && vector.length > 0,
    "INVALID_JACOBIAN_POINT",
    "Jacobian point must be a non-empty vector",
  );
  inRange(epsilon, 1e-10, 1e-2, "jacobian epsilon");
  const dimension = vector.length;
  const matrix = Array.from(
    { length: dimension },
    () => Array(dimension).fill(0),
  );
  for (let column = 0; column < dimension; column += 1) {
    const step = epsilon * Math.max(1, Math.abs(vector[column]));
    const left = [...vector];
    const right = [...vector];
    left[column] -= step;
    right[column] += step;
    const leftValue = mapper(left);
    const rightValue = mapper(right);
    ensure(
      leftValue.length === dimension && rightValue.length === dimension,
      "JACOBIAN_DIMENSION_MISMATCH",
      "mapper output dimension changed",
    );
    for (let row = 0; row < dimension; row += 1) {
      matrix[row][column] = (rightValue[row] - leftValue[row]) / (2 * step);
      finite(matrix[row][column], `jacobian[${row}][${column}]`);
    }
  }
  return matrix;
}

function identity(size) {
  return Array.from(
    { length: size },
    (_, row) => Array.from({ length: size }, (_, column) =>
      row === column ? 1 : 0),
  );
}

function matrixMultiply(left, right) {
  const rows = left.length;
  const inner = right.length;
  const columns = right[0].length;
  const result = Array.from(
    { length: rows },
    () => Array(columns).fill(0),
  );
  for (let row = 0; row < rows; row += 1) {
    for (let index = 0; index < inner; index += 1) {
      const value = left[row][index];
      if (Math.abs(value) < EPSILON) continue;
      for (let column = 0; column < columns; column += 1) {
        result[row][column] += value * right[index][column];
      }
    }
  }
  return result;
}

function transpose(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function householderQr(matrix) {
  const size = matrix.length;
  let q = identity(size);
  const r = matrix.map((row) => [...row]);
  for (let column = 0; column < size - 1; column += 1) {
    const vector = Array.from(
      { length: size - column },
      (_, index) => r[column + index][column],
    );
    const norm = Math.hypot(...vector);
    if (norm < 1e-15) continue;
    vector[0] += vector[0] >= 0 ? norm : -norm;
    const vectorNorm = Math.hypot(...vector);
    if (vectorNorm < 1e-15) continue;
    for (let index = 0; index < vector.length; index += 1) {
      vector[index] /= vectorNorm;
    }
    for (let targetColumn = column; targetColumn < size; targetColumn += 1) {
      let dot = 0;
      for (let index = 0; index < vector.length; index += 1) {
        dot += vector[index] * r[column + index][targetColumn];
      }
      for (let index = 0; index < vector.length; index += 1) {
        r[column + index][targetColumn] -= 2 * vector[index] * dot;
      }
    }
    for (let row = 0; row < size; row += 1) {
      let dot = 0;
      for (let index = 0; index < vector.length; index += 1) {
        dot += q[row][column + index] * vector[index];
      }
      for (let index = 0; index < vector.length; index += 1) {
        q[row][column + index] -= 2 * dot * vector[index];
      }
    }
  }
  return { q, r };
}

function twoByTwoRadii(a, b, c, d) {
  const trace = a + d;
  const determinant = a * d - b * c;
  const discriminant = trace * trace - 4 * determinant;
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    return [Math.abs((trace + root) / 2), Math.abs((trace - root) / 2)];
  }
  const radius = Math.sqrt(Math.max(0, determinant));
  return [radius, radius];
}

export function spectralRadius(matrix, options = {}) {
  const tolerance = options.tolerance ?? 1e-10;
  const maxIterations = options.maxIterations ?? 12000;
  ensure(
    Array.isArray(matrix)
      && matrix.length > 0
      && matrix.every((row) =>
        Array.isArray(row) && row.length === matrix.length),
    "INVALID_MATRIX",
    "spectralRadius requires a non-empty square matrix",
  );
  const size = matrix.length;
  const a = matrix.map((row, rowIndex) => row.map((value, columnIndex) =>
    finite(value, `matrix[${rowIndex}][${columnIndex}]`)));
  let active = size - 1;
  let iterations = 0;
  const radii = [];
  const smallSubdiagonal = (index) =>
    Math.abs(a[index][index - 1])
      <= tolerance * (
        1 + Math.abs(a[index - 1][index - 1])
          + Math.abs(a[index][index])
      );
  while (active >= 0) {
    if (active === 0 || smallSubdiagonal(active)) {
      if (active > 0) a[active][active - 1] = 0;
      radii.push(Math.abs(a[active][active]));
      active -= 1;
      continue;
    }
    if (active === 1 || smallSubdiagonal(active - 1)) {
      if (active > 1) a[active - 1][active - 2] = 0;
      radii.push(...twoByTwoRadii(
        a[active - 1][active - 1],
        a[active - 1][active],
        a[active][active - 1],
        a[active][active],
      ));
      active -= 2;
      continue;
    }
    ensure(
      iterations < maxIterations,
      "SPECTRAL_RADIUS_DID_NOT_CONVERGE",
      "shifted QR iteration did not converge",
      { active, iterations },
    );
    const bottomRadii = twoByTwoRadii(
      a[active - 1][active - 1],
      a[active - 1][active],
      a[active][active - 1],
      a[active][active],
    );
    const bottom = a[active][active];
    const candidates = (() => {
      const aa = a[active - 1][active - 1];
      const bb = a[active - 1][active];
      const cc = a[active][active - 1];
      const dd = bottom;
      const trace = aa + dd;
      const determinant = aa * dd - bb * cc;
      const discriminant = trace * trace - 4 * determinant;
      if (discriminant < 0) return [trace / 2];
      const root = Math.sqrt(discriminant);
      return [(trace + root) / 2, (trace - root) / 2];
    })();
    const shift = candidates.reduce((best, candidate) =>
      Math.abs(candidate - bottom) < Math.abs(best - bottom)
        ? candidate
        : best,
    candidates[0]);
    const blockSize = active + 1;
    const shifted = Array.from({ length: blockSize }, (_, row) =>
      Array.from({ length: blockSize }, (_, column) =>
        a[row][column] - (row === column ? shift : 0)));
    const { q, r } = householderQr(shifted);
    const updated = matrixMultiply(r, q);
    for (let row = 0; row < blockSize; row += 1) {
      for (let column = 0; column < blockSize; column += 1) {
        a[row][column] = updated[row][column]
          + (row === column ? shift : 0);
      }
    }
    for (let row = 1; row < blockSize; row += 1) {
      for (let column = 0; column < row - 1; column += 1) {
        if (Math.abs(a[row][column]) < tolerance) a[row][column] = 0;
      }
    }
    ensure(
      bottomRadii.every(Number.isFinite),
      "SPECTRAL_RADIUS_NUMERIC_FAILURE",
      "invalid trailing block during QR iteration",
    );
    iterations += 1;
  }
  const radius = Math.max(...radii);
  finite(radius, "spectral radius");
  return { radius, eigenvalueMagnitudes: radii.sort((x, y) => y - x), iterations };
}

function crossSenderCoupling(matrix, senderCount) {
  const entries = [];
  for (let outputSender = 0; outputSender < senderCount; outputSender += 1) {
    for (let inputSender = 0; inputSender < senderCount; inputSender += 1) {
      if (outputSender === inputSender) continue;
      for (let outputField = 0; outputField < 4; outputField += 1) {
        for (let inputField = 0; inputField < 2; inputField += 1) {
          entries.push(
            Math.abs(
              matrix[outputSender * 4 + outputField]
                [inputSender * 4 + inputField],
            ),
          );
        }
      }
    }
  }
  return {
    maxAbsoluteDerivative: Math.max(...entries),
    meanAbsoluteDerivative: mean(entries),
    nonzeroCount: entries.filter((value) => value > 1e-8).length,
    entryCount: entries.length,
  };
}

export function analyzeLocalStability(scenarioInput) {
  const scenario = validateScenario(scenarioInput);
  const equilibrium = findEquilibrium(scenario);
  const point = stateVector(equilibrium.state);
  const mapper = (vector) => stateVector(
    macroMap(vectorState(vector, equilibrium.state), scenario),
  );
  const jacobian = numericalJacobian(mapper, point);
  const spectrum = spectralRadius(jacobian);
  return {
    equilibrium,
    jacobian,
    jacobianSha256: canonicalDigest(roundDeep(jacobian, 12)),
    spectralRadius: spectrum.radius,
    predictedUnstable: spectrum.radius > 1.005,
    stabilityMargin: 1 - spectrum.radius,
    crossSenderCoupling: crossSenderCoupling(
      jacobian,
      scenario.senderCount,
    ),
    qrIterations: spectrum.iterations,
    eigenvalueMagnitudes: spectrum.eigenvalueMagnitudes,
  };
}

function perturbState(equilibrium, scenario, seed) {
  const state = clone(equilibrium);
  state.step = 0;
  state.senders = state.senders.map((sender) => {
    const random = seededSenderRandom(seed, sender.id, "initial-state");
    const signed = () => random() * 2 - 1;
    return {
      ...sender,
      rate: clamp(
        sender.rate + signed() * scenario.initialPerturbation
          * (scenario.rateMax - scenario.rateMin),
        scenario.rateMin,
        scenario.rateMax,
      ),
      threshold: clamp(
        sender.threshold + signed() * scenario.initialPerturbation
          * (scenario.thresholdMax - scenario.thresholdMin),
        scenario.thresholdMin,
        scenario.thresholdMax,
      ),
      observedCbr: Math.max(
        0,
        sender.observedCbr + signed() * scenario.initialPerturbation,
      ),
      observedRedundancy: Math.max(
        0,
        sender.observedRedundancy
          + signed() * scenario.initialPerturbation * 0.2,
      ),
      shock: 0,
      queue: 0,
    };
  });
  return state;
}

function amplitude(values, usableRange) {
  const { min, max } = minMax(values);
  return (max - min) / usableRange;
}

function senderRateAmplitude(observations, scenario) {
  const bySender = scenario.senders.map((_, senderIndex) =>
    amplitude(
      observations.map((row) => row.senders[senderIndex].rateUsed),
      scenario.rateMax - scenario.rateMin,
    ));
  return { bySender, max: Math.max(...bySender), mean: mean(bySender) };
}

function convergenceTime(observations, scenario) {
  const windowSteps = Math.max(2, Math.round(5 / scenario.dtSeconds));
  const finalCount = Math.round(
    scenario.finalWindowSeconds / scenario.dtSeconds,
  );
  const finalRows = observations.slice(-finalCount);
  const finalMeans = scenario.senders.map((_, index) =>
    mean(finalRows.map((row) => row.senders[index].rateUsed)));
  const tolerance = 0.05 * (scenario.rateMax - scenario.rateMin);
  for (let start = 0; start <= observations.length - windowSteps; start += 1) {
    let allFollowingStable = true;
    for (
      let index = start;
      index <= observations.length - windowSteps;
      index += windowSteps
    ) {
      const rows = observations.slice(index, index + windowSteps);
      for (let sender = 0; sender < scenario.senderCount; sender += 1) {
        const values = rows.map((row) => row.senders[sender].rateUsed);
        if (
          Math.max(...values) - Math.min(...values) > tolerance
          || Math.abs(mean(values) - finalMeans[sender]) > tolerance
        ) {
          allFollowingStable = false;
          break;
        }
      }
      if (!allFollowingStable) break;
    }
    if (allFollowingStable) return observations[start].timeSeconds;
  }
  return null;
}

function jainFairness(values) {
  const sum = values.reduce((total, value) => total + value, 0);
  const squared = values.reduce((total, value) => total + value * value, 0);
  return squared <= EPSILON ? 1 : (sum * sum) / (values.length * squared);
}

function starvationMetrics(observations, scenario) {
  const thresholdSteps = Math.ceil(5 / scenario.dtSeconds);
  const current = Array(scenario.senderCount).fill(0);
  const longest = Array(scenario.senderCount).fill(0);
  for (const observation of observations) {
    const totalDelivered = observation.senders.reduce(
      (sum, sender) => sum + sender.delivered,
      0,
    );
    const fairShare = totalDelivered / scenario.senderCount;
    for (let index = 0; index < scenario.senderCount; index += 1) {
      const sender = observation.senders[index];
      const starved = sender.positiveMarginalUtility
        && sender.delivered < 0.1 * fairShare;
      current[index] = starved ? current[index] + 1 : 0;
      longest[index] = Math.max(longest[index], current[index]);
    }
  }
  const durations = longest.map((steps) => steps * scenario.dtSeconds);
  return {
    occurred: longest.some((steps) => steps >= thresholdSteps),
    senderCount: longest.filter((steps) => steps >= thresholdSteps).length,
    longestContinuousSeconds: Math.max(...durations),
    bySenderSeconds: Object.fromEntries(
      scenario.senders.map((sender, index) => [sender.id, durations[index]]),
    ),
  };
}

function summarizeEpisode(observations, scenario, seed) {
  const finalSteps = Math.round(
    scenario.finalWindowSeconds / scenario.dtSeconds,
  );
  const finalRows = observations.slice(-finalSteps);
  const half = Math.floor(finalRows.length / 2);
  const firstHalfAmplitude = senderRateAmplitude(
    finalRows.slice(0, half),
    scenario,
  );
  const lastHalfAmplitude = senderRateAmplitude(
    finalRows.slice(half),
    scenario,
  );
  const fullAmplitude = senderRateAmplitude(finalRows, scenario);
  const decayRatio = lastHalfAmplitude.max
    / Math.max(firstHalfAmplitude.max, 1e-9);
  const persistentOscillation = lastHalfAmplitude.max > 0.2
    && decayRatio >= 0.8;
  const deliveredTotals = scenario.senders.map((_, senderIndex) =>
    finalRows.reduce(
      (sum, row) => sum + row.senders[senderIndex].delivered,
      0,
    ));
  const starvation = starvationMetrics(finalRows, scenario);
  const perSenderControlMeans = Object.fromEntries(
    scenario.senders.map((sender, senderIndex) => [sender.id, {
      rate: mean(finalRows.map((row) => row.senders[senderIndex].rateUsed)),
      threshold: mean(
        finalRows.map((row) => row.senders[senderIndex].thresholdUsed),
      ),
    }]),
  );
  const offered = finalRows.map((row) => row.aggregateOffered);
  const channelLoad = finalRows.map((row) => row.channelLoad);
  const aggregateRange = Math.max(1e-9, scenario.channelCapacity);
  const maxQueue = Math.max(
    ...finalRows.flatMap((row) => row.senders.map((sender) => sender.queueAfter)),
  );
  return roundDeep({
    seed,
    independentUnit: "complete-episode",
    durationSeconds: scenario.durationSeconds,
    persistentOscillation,
    observedUnstable: persistentOscillation || starvation.occurred,
    oscillation: {
      normalizedRatePeakToPeak: fullAmplitude,
      firstHalfFinalWindowMax: firstHalfAmplitude.max,
      lastHalfFinalWindowMax: lastHalfAmplitude.max,
      decayRatio,
      aggregateOfferedPeakToPeak:
        (Math.max(...offered) - Math.min(...offered)) / aggregateRange,
    },
    convergenceTimeSeconds: convergenceTime(observations, scenario),
    jainFairness: jainFairness(deliveredTotals),
    starvation,
    meanOfferedLoad: mean(offered),
    meanChannelLoad: mean(channelLoad),
    maxQueue,
    perSenderControlMeans,
    packetOrFrameCountUsedAsIndependentSample: false,
  });
}

export function runEpisode(scenarioInput, seed, equilibriumInput = null) {
  const scenario = validateScenario(scenarioInput);
  ensure(
    Number.isSafeInteger(seed) && seed >= 0,
    "INVALID_SEED",
    "seed must be a non-negative safe integer",
  );
  const equilibrium = equilibriumInput ?? findEquilibrium(scenario).state;
  let state = perturbState(equilibrium, scenario, seed);
  const randomBySender = new Map(
    scenario.senders.map((sender) => [
      sender.id,
      seededSenderRandom(seed, sender.id, "utility-shock"),
    ]),
  );
  const observations = [];
  const steps = Math.round(scenario.durationSeconds / scenario.dtSeconds);
  for (let step = 0; step < steps; step += 1) {
    const result = stepProxy(state, scenario, { randomBySender });
    state = result.state;
    observations.push(result.observation);
  }
  const metrics = summarizeEpisode(observations, scenario, seed);
  const stride = Math.max(1, Math.round(1 / scenario.dtSeconds));
  const trace = observations
    .filter((_, index) => index % stride === 0 || index === observations.length - 1)
    .map((row) => roundDeep({
      timeSeconds: row.timeSeconds,
      aggregateOffered: row.aggregateOffered,
      channelLoad: row.channelLoad,
      rates: Object.fromEntries(
        row.senders.map((sender) => [sender.id, sender.rateUsed]),
      ),
      selectedQuantities: Object.fromEntries(
        row.senders.map((sender) => [sender.id, sender.selectedQuantity]),
      ),
    }, 8));
  return { metrics, trace };
}

export const DEVELOPMENT_SEEDS = Object.freeze(
  Array.from({ length: 10 }, (_, index) => 12001 + index * 97),
);
export const CONFIRMATION_SEEDS = Object.freeze(
  Array.from({ length: 30 }, (_, index) => 91001 + index * 193),
);

function metricAggregate(episodes, key) {
  const values = episodes.map(key);
  return {
    mean: mean(values),
    ...minMax(values),
  };
}

function summarizeSplit(episodes, predictedUnstable) {
  const unstableCount = episodes.filter((episode) =>
    episode.observedUnstable).length;
  return roundDeep({
    independentUnit: "complete-episode-seed",
    episodeCount: episodes.length,
    seeds: episodes.map((episode) => episode.seed),
    unstableCount,
    stableCount: episodes.length - unstableCount,
    observedUnstableRate: unstableCount / episodes.length,
    spectralPredictionAgreementRate: episodes.filter((episode) =>
      episode.observedUnstable === predictedUnstable).length / episodes.length,
    persistentOscillationCount: episodes.filter((episode) =>
      episode.persistentOscillation).length,
    starvationEpisodeCount: episodes.filter((episode) =>
      episode.starvation.occurred).length,
    normalizedRateAmplitude: metricAggregate(
      episodes,
      (episode) => episode.oscillation.normalizedRatePeakToPeak.max,
    ),
    aggregateOfferedAmplitude: metricAggregate(
      episodes,
      (episode) => episode.oscillation.aggregateOfferedPeakToPeak,
    ),
    jainFairness: metricAggregate(
      episodes,
      (episode) => episode.jainFairness,
    ),
    longestStarvationSeconds: metricAggregate(
      episodes,
      (episode) => episode.starvation.longestContinuousSeconds,
    ),
    meanOfferedLoad: metricAggregate(
      episodes,
      (episode) => episode.meanOfferedLoad,
    ),
    maxQueue: metricAggregate(episodes, (episode) => episode.maxQueue),
    convergence: {
      convergedCount: episodes.filter((episode) =>
        episode.convergenceTimeSeconds !== null).length,
      timeSeconds: (() => {
        const values = episodes
          .map((episode) => episode.convergenceTimeSeconds)
          .filter((value) => value !== null);
        return values.length === 0 ? null : metricAggregate(values, (value) => value);
      })(),
    },
  });
}

export function runCell(scenarioInput, options = {}) {
  const scenario = validateScenario(scenarioInput);
  const developmentSeeds = options.developmentSeeds ?? DEVELOPMENT_SEEDS;
  const confirmationSeeds = options.confirmationSeeds ?? CONFIRMATION_SEEDS;
  ensure(
    developmentSeeds.every((seed) => !confirmationSeeds.includes(seed)),
    "SEED_LEAKAGE",
    "development and confirmation seeds must be disjoint",
  );
  const stability = analyzeLocalStability(scenario);
  const run = (seed) => runEpisode(scenario, seed, stability.equilibrium.state).metrics;
  const developmentEpisodes = developmentSeeds.map(run);
  const confirmationEpisodes = confirmationSeeds.map(run);
  return {
    scenario: roundDeep(scenario),
    scenarioSha256: canonicalDigest(scenario),
    stability: roundDeep({
      equilibrium: {
        relaxedIterations: stability.equilibrium.relaxedIterations,
        relaxedResidual: stability.equilibrium.relaxedResidual,
        actualMacroResidual: stability.equilibrium.actualMacroResidual,
        state: stability.equilibrium.state,
      },
      jacobianDimension: stability.jacobian.length,
      jacobianSha256: stability.jacobianSha256,
      jacobian: stability.jacobian,
      spectralRadius: stability.spectralRadius,
      predictedUnstable: stability.predictedUnstable,
      stabilityMargin: stability.stabilityMargin,
      crossSenderCoupling: stability.crossSenderCoupling,
      qrIterations: stability.qrIterations,
      eigenvalueMagnitudes: stability.eigenvalueMagnitudes,
    }, 10),
    development: summarizeSplit(
      developmentEpisodes,
      stability.predictedUnstable,
    ),
    confirmation: summarizeSplit(
      confirmationEpisodes,
      stability.predictedUnstable,
    ),
    episodeOutcomes: {
      development: developmentEpisodes,
      confirmation: confirmationEpisodes,
    },
  };
}

function regimeScenario(regime, overrides = {}) {
  if (regime === "stable") {
    return createScenario({
      scenarioId: "stable-low-gain-short-lag-positive-control",
      rateGain: 0.28,
      semanticGain: 0.32,
      observationTauSeconds: 0.25,
      redundancyTauSeconds: 0.3,
      ...overrides,
    });
  }
  ensure(regime === "stress", "UNKNOWN_REGIME", regime);
  return createScenario({
    scenarioId: "stress-high-gain-long-lag-positive-control",
    rateGain: 4.2,
    semanticGain: 4.8,
    observationTauSeconds: 1.4,
    redundancyTauSeconds: 1.1,
    ...overrides,
  });
}

function baselineScenario(regime, controller, overrides = {}) {
  return regimeScenario(regime, { controller, ...overrides });
}

function matchedControlForEpisode(baseScenario, episode) {
  const senders = baseScenario.senders.map((sender) => ({
    ...sender,
    rateNominal: clamp(
      episode.perSenderControlMeans[sender.id].rate,
      baseScenario.rateMin,
      baseScenario.rateMax,
    ),
    thresholdNominal: clamp(
      episode.perSenderControlMeans[sender.id].threshold,
      baseScenario.thresholdMin,
      baseScenario.thresholdMax,
    ),
  }));
  return createScenario({
    ...baseScenario,
    scenarioId: `${baseScenario.scenarioId}-offered-load-matched`,
    controller: "feedback-off",
    senders,
    initialPerturbation: 0,
  });
}

function runMatchedControls(baseCell, baseScenario) {
  const run = (episode) => {
    const target = episode.meanOfferedLoad;
    let scenario = matchedControlForEpisode(baseScenario, episode);
    let control = null;
    let calibrationIterations = 0;
    for (; calibrationIterations < 8; calibrationIterations += 1) {
      const equilibrium = findEquilibrium(scenario).state;
      control = runEpisode(scenario, episode.seed, equilibrium).metrics;
      const ratio = target / Math.max(control.meanOfferedLoad, EPSILON);
      if (Math.abs(ratio - 1) <= 0.002) break;
      const senders = scenario.senders.map((sender) => ({
        ...sender,
        rateNominal: clamp(
          sender.rateNominal * ratio,
          scenario.rateMin,
          scenario.rateMax,
        ),
      }));
      scenario = createScenario({ ...scenario, senders });
    }
    ensure(
      control !== null,
      "MATCHED_CONTROL_CALIBRATION_FAILED",
      "offered-load matched control did not execute",
    );
    return {
      ...control,
      sourceCoupledMeanOfferedLoad: episode.meanOfferedLoad,
      offeredLoadRatio:
        control.meanOfferedLoad / Math.max(episode.meanOfferedLoad, EPSILON),
      calibrationIterations: calibrationIterations + 1,
      calibrationPolicy:
        "same-seed exogenous feedback-off rate scaling to within 0.2% of "
        + "the coupled episode final-window mean offered load; no outcome "
        + "label or oscillation metric enters calibration",
    };
  };
  const development = baseCell.episodeOutcomes.development.map(run);
  const confirmation = baseCell.episodeOutcomes.confirmation.map(run);
  return {
    development: summarizeSplit(development, false),
    confirmation: summarizeSplit(confirmation, false),
    offeredLoadRatio: {
      development: metricAggregate(development, (episode) =>
        episode.offeredLoadRatio),
      confirmation: metricAggregate(confirmation, (episode) =>
        episode.offeredLoadRatio),
    },
    episodeOutcomes: { development, confirmation },
  };
}

function permutationControl(scenario) {
  const reversed = createScenario({
    ...scenario,
    senders: [...scenario.senders].reverse(),
  });
  const seed = CONFIRMATION_SEEDS[0];
  const first = runEpisode(scenario, seed).metrics;
  const second = runEpisode(reversed, seed).metrics;
  return {
    seed,
    canonicalizationPolicy: "sender IDs sorted before every state allocation",
    originalScenarioSha256: canonicalDigest(scenario),
    permutedInputScenarioSha256: canonicalDigest(reversed),
    metricsEqual: stableJson(first) === stableJson(second),
    originalMetricsSha256: canonicalDigest(first),
    permutedMetricsSha256: canonicalDigest(second),
  };
}

function baselineMatrix(regime) {
  const controllers = [
    "fixed-equal-period-rate",
    "selector-limeric",
    "qoq-fixed-period",
    "weighted-limeric",
    "feedback-off",
  ];
  return Object.fromEntries(controllers.map((controller) => {
    const cell = runCell(baselineScenario(regime, controller));
    return [controller, {
      scenarioSha256: cell.scenarioSha256,
      spectralRadius: cell.stability.spectralRadius,
      predictedUnstable: cell.stability.predictedUnstable,
      development: cell.development,
      confirmation: cell.confirmation,
    }];
  }));
}

function hypothesisChecks({ stable, stress, matched, halfStep, asynchronous, local }) {
  const stableObservedRate = stable.confirmation.observedUnstableRate;
  const stressObservedRate = stress.confirmation.observedUnstableRate;
  const matchedAmplitude = matched.confirmation.normalizedRateAmplitude.mean;
  const stressAmplitude = stress.confirmation.normalizedRateAmplitude.mean;
  const checks = [
    {
      id: "stable-positive-control",
      passed: !stable.stability.predictedUnstable && stableObservedRate <= 0.1,
      witness: {
        spectralRadius: stable.stability.spectralRadius,
        confirmationObservedUnstableRate: stableObservedRate,
      },
    },
    {
      id: "unstable-positive-control",
      passed: stress.stability.predictedUnstable && stressObservedRate >= 0.8,
      witness: {
        spectralRadius: stress.stability.spectralRadius,
        confirmationObservedUnstableRate: stressObservedRate,
      },
    },
    {
      id: "held-out-spectral-direction",
      passed:
        stable.confirmation.spectralPredictionAgreementRate >= 0.9
        && stress.confirmation.spectralPredictionAgreementRate >= 0.8,
      witness: {
        stableAgreement:
          stable.confirmation.spectralPredictionAgreementRate,
        stressAgreement:
          stress.confirmation.spectralPredictionAgreementRate,
      },
    },
    {
      id: "sender-visible-off-diagonal-coupling",
      passed:
        stress.stability.crossSenderCoupling.maxAbsoluteDerivative > 1e-5
        && local.stability.crossSenderCoupling.maxAbsoluteDerivative < 1e-7,
      witness: {
        sharedMaximum:
          stress.stability.crossSenderCoupling.maxAbsoluteDerivative,
        localNegativeMaximum:
          local.stability.crossSenderCoupling.maxAbsoluteDerivative,
      },
    },
    {
      id: "feedback-off-offered-load-matched",
      passed:
        matched.offeredLoadRatio.confirmation.mean >= 0.9
        && matched.offeredLoadRatio.confirmation.mean <= 1.1
        && matchedAmplitude <= 0.5 * Math.max(stressAmplitude, EPSILON),
      witness: {
        offeredLoadRatio: matched.offeredLoadRatio.confirmation,
        coupledAmplitude: stressAmplitude,
        feedbackOffAmplitude: matchedAmplitude,
      },
    },
    {
      id: "half-step-robustness",
      passed:
        halfStep.stability.predictedUnstable
        && halfStep.confirmation.observedUnstableRate >= 0.8,
      witness: {
        spectralRadius: halfStep.stability.spectralRadius,
        observedUnstableRate: halfStep.confirmation.observedUnstableRate,
      },
    },
    {
      id: "synchronized-vs-asynchronous-disclosure",
      passed: Number.isFinite(asynchronous.stability.spectralRadius)
        && asynchronous.confirmation.episodeCount === CONFIRMATION_SEEDS.length,
      witness: {
        synchronizedSpectralRadius: stress.stability.spectralRadius,
        asynchronousSpectralRadius: asynchronous.stability.spectralRadius,
        synchronizedUnstableRate: stressObservedRate,
        asynchronousUnstableRate:
          asynchronous.confirmation.observedUnstableRate,
      },
    },
  ];
  return checks;
}

export function runPilot() {
  const stableScenario = regimeScenario("stable");
  const stressScenario = regimeScenario("stress");
  const stable = runCell(stableScenario);
  const stress = runCell(stressScenario);
  const halfStep = runCell(regimeScenario("stress", {
    scenarioId: "stress-half-step-control",
    dtSeconds: 0.05,
  }));
  const asynchronous = runCell(regimeScenario("stress", {
    scenarioId: "stress-asynchronous-update-control",
    asynchronousUpdates: true,
  }));
  const local = runCell(regimeScenario("stress", {
    scenarioId: "stress-local-signal-negative-control",
    signalMode: "local-negative-control",
    semanticRedundancyPenalty: 0,
    redundancyFeedback: 0,
  }));
  const matched = runMatchedControls(stress, stressScenario);
  const permutation = permutationControl(stressScenario);
  const baselines = {
    stable: baselineMatrix("stable"),
    stress: baselineMatrix("stress"),
  };
  const checks = hypothesisChecks({
    stable,
    stress,
    matched,
    halfStep,
    asynchronous,
    local,
  });
  checks.push({
    id: "sender-order-permutation",
    passed: permutation.metricsEqual,
    witness: permutation,
  });
  const allPassed = checks.every((check) => check.passed);
  return {
    frozenModel: {
      schemaVersion: MODEL_SCHEMA_VERSION,
      classification:
        "frozen falsifiable proxy model; not Artery, ETSI, LIMERIC, BME, "
        + "or Quality-over-Quantity implementation evidence",
      causalOrder: [
        "sender uses only its previously stored CBR and redundancy observations",
        "sender chooses current quantity and offered rate",
        "shared channel load and current delivered service are computed",
        "new observations are stored for a later controller step",
      ],
      noFutureInformation: true,
      independentUnit: "complete episode/seed",
      developmentSeeds: DEVELOPMENT_SEEDS,
      confirmationSeeds: CONFIRMATION_SEEDS,
      seedSetsDisjoint: DEVELOPMENT_SEEDS.every((seed) =>
        !CONFIRMATION_SEEDS.includes(seed)),
      operationalDefinitions: {
        persistentOscillation:
          "last-half final-window sender-rate peak-to-peak exceeds 20% of "
          + "the allowed rate range and is at least 80% of the preceding "
          + "half-window amplitude",
        convergenceTime:
          "first five-second block after which all later five-second blocks "
          + "remain within 5% of the allowed sender-rate range around the "
          + "final-window mean",
        semanticStarvation:
          "positive proxy marginal utility with delivered service below 10% "
          + "of equal fair share for at least five continuous seconds",
      },
    },
    cells: {
      stablePositiveControl: stable,
      stressPositiveControl: stress,
      halfStepControl: halfStep,
      asynchronousControl: asynchronous,
      localSignalNegativeControl: local,
    },
    directBaselines: baselines,
    feedbackOffOfferedLoadMatched: matched,
    senderOrderPermutation: permutation,
    hypothesisChecks: checks,
    allProxyChecksPassed: allPassed,
    killCriteria: {
      officialArteryExampleNotReproducedWithinThreeDays:
        "not evaluated by this CPU proxy pilot",
      offDiagonalCouplingAbsent:
        !checks.find((check) =>
          check.id === "sender-visible-off-diagonal-coupling").passed,
      instabilityUnchangedWithFeedbackOff:
        !checks.find((check) =>
          check.id === "feedback-off-offered-load-matched").passed,
      instabilityDisappearsAtHalfStep:
        !checks.find((check) => check.id === "half-step-robustness").passed,
      packetLevelPseudoreplication: false,
    },
  };
}

function auditPayload(generatedAt) {
  const result = runPilot();
  const failedChecks = result.hypothesisChecks
    .filter((check) => !check.passed)
    .map((check) => check.id);
  const unresolvedOfficialGate = true;
  const pilotDecision = failedChecks.length === 0
    ? "proxy-mechanism-supported-requires-official-stack-reproduction"
    : "proxy-hypothesis-not-supported-as-frozen";
  const verdict = failedChecks.length === 0 && !unresolvedOfficialGate
    ? "advance"
    : "revise";
  return {
    schemaVersion: PILOT_SCHEMA_VERSION,
    auditId:
      "cooperative-autonomous-driving-coupled-rate-stability-pilot-v8",
    directionId: "cooperative-autonomous-driving",
    candidateId: "coupled-adaptive-rate-controller-stability",
    generatedAt,
    verdict,
    pilotDecision,
    claimBoundary: {
      supported:
        "A deterministic sender-visible fluid proxy can test whether a "
        + "semantic-threshold loop coupled to a LIMERIC-like rate loop has "
        + "a local spectral boundary that predicts held-out episode behavior.",
      unsupported: [
        "This is not an implementation or result from Artery.",
        "This is not the ETSI CPS, BME, LIMERIC, FABRIC, or published "
          + "Quality-over-Quantity algorithm.",
        "No perception model, packet simulator, radio stack, dataset, or "
          + "perception-quality metric was executed.",
        "No protocol, deployment, PC5, Uu, or real-world stability claim is made.",
      ],
      preregistrationStatus:
        "No independent theory preregistration artifact was available when "
        + "implementation began; equations and checks are frozen in this "
        + "content-addressed pilot as a falsifiable proxy.",
    },
    sourceAttribution: {
      localTriage: [
        "content/idea-audits/"
          + "cooperative-autonomous-driving-second-candidate-implementation-triage-v8.json",
        "content/idea-audits/"
          + "cooperative-autonomous-driving-second-candidate-novelty-triage-v8.json",
        "content/idea-audits/"
          + "cooperative-autonomous-driving-coupled-rate-stability-dossier-v3.json",
      ],
      algorithmAttribution:
        "The proxy uses generic bounded first-order load feedback and a "
        + "generic sigmoid value threshold. Names ending in '-like' describe "
        + "functional roles only and do not assert equation identity.",
    },
    protocol: {
      independentUnit: "complete episode/seed",
      developmentEpisodeCount: DEVELOPMENT_SEEDS.length,
      confirmationEpisodeCount: CONFIRMATION_SEEDS.length,
      packetFrameOrSenderPseudoreplication: false,
      developmentConfirmationSeparation: true,
      requiredControls: [
        "fixed equal period/rate",
        "selector plus LIMERIC-like rate feedback",
        "QoQ-like threshold plus fixed period",
        "coupled controller",
        "weighted LIMERIC-like rate feedback",
        "feedback off",
        "offered-load matched",
        "half simulation step",
        "synchronous versus asynchronous updates",
        "sender-order permutation",
        "local-signal negative control",
        "stable and unstable positive controls",
      ],
    },
    result,
    decisionEvidence: {
      failedProxyChecks: failedChecks,
      allProxyChecksPassed: failedChecks.length === 0,
      officialArteryExecutionGate: "unresolved-outside-this-artifact",
      interpretation:
        failedChecks.length === 0
          ? "The proxy mechanism remains eligible for an official-stack test; "
            + "the candidate is not accepted on proxy evidence."
          : "At least one frozen proxy check failed; do not advance the "
            + "mechanistic claim without revising and independently freezing "
            + "a new model.",
    },
    limitations: [
      "Fluid offered service replaces packets, MAC contention, radio loss, and queues.",
      "The semantic utility trace is synthetic, bounded, and not learned from a perception model.",
      "The Jacobian is local to one frozen proxy equilibrium and one controller period.",
      "The two hand-labeled positive-control regimes establish test sensitivity, not prevalence.",
      "Synthetic confirmation seeds test numerical generalization only; they do not add external validity.",
    ],
    reproducibility: {
      runtime: "Node.js >=22 <25; CPU only; no network access",
      runner: {
        path: relativePath(SCRIPT_PATH),
        bytes: readFileSync(SCRIPT_PATH).byteLength,
        sha256: sha256(readFileSync(SCRIPT_PATH)),
      },
      test: {
        path: relativePath(TEST_PATH),
        bytes: readFileSync(TEST_PATH).byteLength,
        sha256: sha256(readFileSync(TEST_PATH)),
      },
      command:
        "node scripts/idea-pilots/coupled-rate-stability-v8.mjs "
        + `--generated-at ${generatedAt} --output `
        + "content/idea-audits/"
        + "cooperative-autonomous-driving-coupled-rate-stability-pilot-v8.json",
      testCommand:
        "node --test test/coupled-rate-stability-v8.test.mjs",
    },
    integrity: {
      hashAlgorithm: "SHA-256",
      coverage:
        "canonical JSON over every audit field except integrity.auditSha256",
      signature: "none",
    },
  };
}

export function buildAudit({
  generatedAt = new Date().toISOString(),
  nowMs = Date.now(),
} = {}) {
  ensure(
    typeof generatedAt === "string" && generatedAt.length > 0,
    "INVALID_GENERATED_AT",
    "generatedAt must be a non-empty string",
  );
  const generatedAtMs = Date.parse(generatedAt);
  ensure(
    Number.isFinite(generatedAtMs),
    "INVALID_GENERATED_AT",
    "generatedAt must be an ISO-8601 timestamp",
    { generatedAt },
  );
  finite(nowMs, "nowMs");
  ensure(
    generatedAtMs <= nowMs + 60_000,
    "FUTURE_GENERATED_AT",
    "generatedAt cannot be more than one minute in the future",
    { generatedAt, nowMs },
  );
  const payload = auditPayload(generatedAt);
  return {
    ...payload,
    integrity: {
      ...payload.integrity,
      auditSha256: canonicalDigest(payload),
    },
  };
}

export function verifyAudit(audit) {
  ensure(
    audit?.schemaVersion === PILOT_SCHEMA_VERSION,
    "AUDIT_SCHEMA_MISMATCH",
    "audit schema is not supported",
  );
  ensure(
    HEX_SHA256.test(audit?.integrity?.auditSha256 ?? ""),
    "AUDIT_HASH_FORMAT",
    "auditSha256 must be a lowercase SHA-256",
  );
  const payload = clone(audit);
  const expected = payload.integrity.auditSha256;
  delete payload.integrity.auditSha256;
  ensure(
    canonicalDigest(payload) === expected,
    "AUDIT_HASH_MISMATCH",
    "audit content does not match auditSha256",
  );
  for (const [label, path] of [["runner", SCRIPT_PATH], ["test", TEST_PATH]]) {
    const binding = audit.reproducibility[label];
    ensure(
      binding.path === relativePath(path)
        && binding.bytes === readFileSync(path).byteLength
        && binding.sha256 === sha256(readFileSync(path)),
      "SOURCE_BINDING_MISMATCH",
      `${label} binding does not match current bytes`,
      { label },
    );
  }
  ensure(
    audit.result.frozenModel.seedSetsDisjoint,
    "SEED_LEAKAGE",
    "audit reports overlapping seed sets",
  );
  ensure(
    audit.result.cells.stablePositiveControl.confirmation.episodeCount
      === DEVELOPMENT_SEEDS.length * 0 + CONFIRMATION_SEEDS.length,
    "EPISODE_COUNT_MISMATCH",
    "confirmation episode count changed",
  );
  ensure(
    audit.verdict === "revise",
    "OVERCLAIMED_PROXY_VERDICT",
    "proxy-only pilot cannot advance before the official execution gate",
  );
  return true;
}

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    generatedAt: new Date().toISOString(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    ensure(
      ["--output", "--generated-at"].includes(option) && value,
      "CLI_USAGE",
      `unknown or incomplete option: ${option}`,
    );
    if (option === "--output") options.output = resolve(value);
    if (option === "--generated-at") options.generatedAt = value;
    index += 1;
  }
  return options;
}

export function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const audit = buildAudit({ generatedAt: options.generatedAt });
  verifyAudit(audit);
  const output = `${JSON.stringify(audit, null, 2)}\n`;
  writeFileSync(options.output, output);
  process.stdout.write(output);
  return audit;
}

function formatError(error) {
  return {
    result: "fail",
    error: {
      name: error?.name ?? "Error",
      code: error?.code ?? "UNEXPECTED_ERROR",
      message: error?.message ?? String(error),
      witness: error?.witness ?? null,
    },
  };
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${JSON.stringify(formatError(error), null, 2)}\n`);
    process.exitCode = 1;
  }
}
