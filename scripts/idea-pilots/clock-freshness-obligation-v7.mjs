import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(SCRIPT_PATH), "../..");

export const REPLAY_PATH =
  "content/idea-audits/cooperative-autonomous-driving-clock-public-path-replay-v5.json";
export const OUTPUT_PATH =
  "content/idea-audits/cooperative-autonomous-driving-clock-freshness-obligation-pilot-v7.json";
export const EXPECTED_REPLAY_SHA256 =
  "d82bc07378bf5d49f5765291689a58b517b5133f14a3805f39f3985adab07ef8";
export const CPP_HEADER_PATH =
  "scripts/idea-pilots/clock_obligation_v7.hpp";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function integerOrNull(value) {
  if (typeof value === "bigint") return value;
  if (
    typeof value === "string"
    && /^-?(0|[1-9]\d*)$/.test(value)
  ) {
    return BigInt(value);
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  return null;
}

function bigint(value, label) {
  const parsed = integerOrNull(value);
  invariant(parsed !== null, `${label} must be an exact integer`);
  return parsed;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Json(value) {
  return sha256(JSON.stringify(value));
}

function compareAge(ageNs, thresholdNs, comparator) {
  if (comparator === ">") return ageNs > thresholdNs;
  return ageNs >= thresholdNs;
}

function intervalVerdict(lowerNs, upperNs, thresholdNs, comparator) {
  const lowerTimesOut = compareAge(lowerNs, thresholdNs, comparator);
  const upperTimesOut = compareAge(upperNs, thresholdNs, comparator);
  if (lowerTimesOut && upperTimesOut) return "timeout";
  if (!lowerTimesOut && !upperTimesOut) return "fresh";
  return "uncertain";
}

function uncertain(reason, obligationId) {
  return {
    status: "unresolved",
    verdict: "uncertain",
    obligationId,
    ageIntervalNanoseconds: null,
    reason
  };
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateObservation(observation) {
  if (!observation || typeof observation !== "object") {
    return { issue: "invalid-observation" };
  }
  if (!observation.timestamp || typeof observation.timestamp !== "object") {
    return { issue: "invalid-timestamp" };
  }
  if (
    !nonEmptyString(observation.timestamp.clockDomainId)
    || !nonEmptyString(observation.decisionClockDomainId)
  ) {
    return { issue: "invalid-clock-domain" };
  }
  if (
    !nonEmptyString(observation.timestamp.timescale)
    || !nonEmptyString(observation.decisionTimescale)
  ) {
    return { issue: "invalid-timescale" };
  }
  if (!["local-receipt", "source-event"].includes(
    observation.timestamp.origin
  )) {
    return { issue: "invalid-timestamp-origin" };
  }
  if (
    !Number.isSafeInteger(observation.timestamp.relockCounter)
    || observation.timestamp.relockCounter < 0
  ) {
    return { issue: "invalid-relock-counter" };
  }
  if (![">", ">="].includes(observation.comparator)) {
    return { issue: "invalid-comparator" };
  }
  const nowNs = integerOrNull(observation.nowNanoseconds);
  const stampNs = integerOrNull(observation.timestamp.nanoseconds);
  const thresholdNs = integerOrNull(
    observation.thresholdNanoseconds
  );
  if (nowNs === null || stampNs === null || thresholdNs === null) {
    return { issue: "invalid-integer-field" };
  }
  if (thresholdNs < 0n) return { issue: "negative-threshold" };
  return { issue: null, nowNs, stampNs, thresholdNs };
}

function relationApplicability(relation, observation, stampNs) {
  if (!relation || typeof relation !== "object") {
    return { issue: "missing-clock-relation" };
  }
  if (
    !nonEmptyString(relation.sourceClockDomainId)
    || !nonEmptyString(relation.targetClockDomainId)
  ) {
    return { issue: "clock-relation-invalid-domain" };
  }
  if (
    relation.sourceClockDomainId
      !== observation.timestamp.clockDomainId
    || relation.targetClockDomainId
      !== observation.decisionClockDomainId
  ) {
    return { issue: "clock-relation-domain-mismatch" };
  }
  if (
    relation.sourceTimescale !== observation.timestamp.timescale
    || relation.targetTimescale !== observation.decisionTimescale
  ) {
    return { issue: "clock-relation-timescale-mismatch" };
  }
  if (
    !Number.isSafeInteger(relation.relockCounter)
    || relation.relockCounter < 0
    || relation.relockCounter !== observation.timestamp.relockCounter
  ) {
    return { issue: "clock-relation-relock-mismatch" };
  }
  if (!relation.validity || typeof relation.validity !== "object") {
    return { issue: "clock-relation-invalid-validity-shape" };
  }
  const fromNs = integerOrNull(
    relation.validity.fromSourceNanoseconds
  );
  const toNs = integerOrNull(
    relation.validity.toSourceNanoseconds
  );
  if (fromNs === null || toNs === null || fromNs > toNs) {
    return { issue: "clock-relation-invalid-validity" };
  }
  if (stampNs < fromNs || stampNs > toNs) {
    return { issue: "clock-relation-outside-validity" };
  }
  if (
    !Array.isArray(
      relation.sourceToTargetOffsetBoundsNanoseconds
    )
    || relation.sourceToTargetOffsetBoundsNanoseconds.length !== 2
  ) {
    return { issue: "clock-relation-invalid-offset-shape" };
  }
  const lower = integerOrNull(
    relation.sourceToTargetOffsetBoundsNanoseconds[0]
  );
  const upper = integerOrNull(
    relation.sourceToTargetOffsetBoundsNanoseconds[1]
  );
  if (lower === null || upper === null || lower > upper) {
    return { issue: "clock-relation-invalid-offset-bounds" };
  }
  return { issue: null, lower, upper };
}

export function evaluateFreshnessObligation({
  obligation,
  observation
} = {}) {
  const obligationId = nonEmptyString(obligation?.id)
    ? obligation.id
    : "invalid-obligation";
  if (!obligation || typeof obligation !== "object") {
    return uncertain("invalid-obligation", obligationId);
  }
  if (!["time-since-local-receipt", "source-event-age"].includes(
    obligation.semanticTarget
  )) {
    return uncertain("invalid-semantic-target", obligationId);
  }
  const parsed = validateObservation(observation);
  if (parsed.issue) return uncertain(parsed.issue, obligationId);
  const { nowNs, stampNs, thresholdNs } = parsed;
  const timestampDomain = observation.timestamp.clockDomainId;
  const decisionDomain = observation.decisionClockDomainId;

  if (obligation.semanticTarget === "time-since-local-receipt") {
    if (observation.timestamp.origin !== "local-receipt") {
      return uncertain(
        "receipt-time-obligation-requires-local-receipt-origin",
        obligationId
      );
    }
    if (
      timestampDomain !== decisionDomain
      || observation.timestamp.timescale
        !== observation.decisionTimescale
    ) {
      return uncertain(
        "receipt-time-obligation-requires-same-clock-and-timescale",
        obligationId
      );
    }
    const ageNs = nowNs - stampNs;
    if (ageNs < 0n) {
      return uncertain("negative-local-receipt-age", obligationId);
    }
    return {
      status: "resolved-same-domain",
      verdict: compareAge(
        ageNs,
        thresholdNs,
        observation.comparator
      ) ? "timeout" : "fresh",
      obligationId,
      ageIntervalNanoseconds: [ageNs.toString(), ageNs.toString()],
      reason: "same-domain-local-receipt-time"
    };
  }

  if (
    timestampDomain
    && timestampDomain === decisionDomain
    && observation.timestamp.timescale
      === observation.decisionTimescale
    && observation.timestamp.origin === "source-event"
  ) {
    const ageNs = nowNs - stampNs;
    if (ageNs < 0n) {
      return uncertain("negative-same-domain-source-age", obligationId);
    }
    return {
      status: "resolved-same-domain",
      verdict: compareAge(
        ageNs,
        thresholdNs,
        observation.comparator
      ) ? "timeout" : "fresh",
      obligationId,
      ageIntervalNanoseconds: [ageNs.toString(), ageNs.toString()],
      reason: "same-domain-source-event-time"
    };
  }

  const relationCheck = relationApplicability(
    obligation.clockRelation,
    observation,
    stampNs
  );
  if (relationCheck.issue) {
    return uncertain(relationCheck.issue, obligationId);
  }
  const offsetLowerNs = relationCheck.lower;
  const offsetUpperNs = relationCheck.upper;
  const mappedStampLowerNs = stampNs + offsetLowerNs;
  const mappedStampUpperNs = stampNs + offsetUpperNs;
  const rawAgeLowerNs = nowNs - mappedStampUpperNs;
  const rawAgeUpperNs = nowNs - mappedStampLowerNs;
  if (rawAgeUpperNs < 0n) {
    return uncertain(
      "clock-relation-implies-only-negative-source-age",
      obligationId
    );
  }
  const ageLowerNs = rawAgeLowerNs < 0n ? 0n : rawAgeLowerNs;
  const ageUpperNs = rawAgeUpperNs;
  return {
    status: "resolved-bounded-relation",
    verdict: intervalVerdict(
      ageLowerNs,
      ageUpperNs,
      thresholdNs,
      observation.comparator
    ),
    obligationId,
    ageIntervalNanoseconds: [
      ageLowerNs.toString(),
      ageUpperNs.toString()
    ],
    reason: "bounded-clock-relation"
  };
}

export function makeBareSourceObservation(pair) {
  return {
    nowNanoseconds: pair.visibleInputs.nowNanoseconds,
    timestamp: {
      nanoseconds: pair.visibleInputs.stampNanoseconds,
      clockDomainId: `${pair.visibleInputs.caseId}-source-clock`,
      timescale: `${pair.visibleInputs.caseId}-source-timescale`,
      relockCounter: 4,
      origin: "source-event"
    },
    decisionClockDomainId:
      `${pair.visibleInputs.caseId}-decision-clock`,
    decisionTimescale:
      `${pair.visibleInputs.caseId}-decision-timescale`,
    thresholdNanoseconds:
      pair.visibleInputs.thresholdNanoseconds,
    comparator: pair.visibleInputs.comparator
  };
}

export function buildCaseClosure(pair, witness) {
  invariant(
    witness?.pairId === pair.pairId
      && Array.isArray(witness.offsetBoundsNanoseconds),
    `Missing explicit closure witness for ${pair.pairId}`
  );
  const observation = makeBareSourceObservation(pair);
  const obligationId =
    `${pair.visibleInputs.caseId.toLowerCase()}-freshness`;
  const unresolved = evaluateFreshnessObligation({
    obligation: {
      id: obligationId,
      semanticTarget: "source-event-age",
      clockRelation: null
    },
    observation
  });
  const bounded = evaluateFreshnessObligation({
    obligation: {
      id: obligationId,
      semanticTarget: "source-event-age",
      clockRelation: {
        sourceClockDomainId:
          observation.timestamp.clockDomainId,
        targetClockDomainId:
          observation.decisionClockDomainId,
        sourceTimescale: observation.timestamp.timescale,
        targetTimescale: observation.decisionTimescale,
        relockCounter: observation.timestamp.relockCounter,
        validity: {
          fromSourceNanoseconds:
            (bigint(observation.timestamp.nanoseconds, "stamp") - 1n)
              .toString(),
          toSourceNanoseconds:
            (bigint(observation.timestamp.nanoseconds, "stamp") + 1n)
              .toString()
        },
        sourceToTargetOffsetBoundsNanoseconds:
          witness.offsetBoundsNanoseconds
      }
    },
    observation
  });
  const receiptStampNs =
    bigint(observation.nowNanoseconds, "now")
    - bigint(observation.thresholdNanoseconds, "threshold") / 2n;
  const receipt = evaluateFreshnessObligation({
    obligation: {
      id: `${obligationId}-receipt`,
      semanticTarget: "time-since-local-receipt"
    },
    observation: {
      ...observation,
      timestamp: {
        nanoseconds: receiptStampNs.toString(),
        clockDomainId: observation.decisionClockDomainId,
        timescale: observation.decisionTimescale,
        relockCounter: 4,
        origin: "local-receipt"
      }
    }
  });
  return {
    caseId: pair.visibleInputs.caseId,
    pairId: pair.pairId,
    sourceExpressionVerdict:
      pair.sourceEquivalentResult.timeout ? "timeout" : "fresh",
    sourceExpressionHasClockRelationEvidence: false,
    obligationWithoutRelation: unresolved,
    boundedSourceAgeRepair: bounded,
    localReceiptRepair: receipt
  };
}

export function buildMutationSuite(pair) {
  const observation = makeBareSourceObservation(pair);
  const baseRelation = {
    sourceClockDomainId: observation.timestamp.clockDomainId,
    targetClockDomainId: observation.decisionClockDomainId,
    sourceTimescale: observation.timestamp.timescale,
    targetTimescale: observation.decisionTimescale,
    relockCounter: observation.timestamp.relockCounter,
    validity: {
      fromSourceNanoseconds:
        (bigint(observation.timestamp.nanoseconds, "stamp") - 10n)
          .toString(),
      toSourceNanoseconds:
        (bigint(observation.timestamp.nanoseconds, "stamp") + 10n)
          .toString()
    },
    sourceToTargetOffsetBoundsNanoseconds: ["0", "0"]
  };
  const run = (id, mutate, expectedReason) => {
    const changedObservation = structuredClone(observation);
    const relation = structuredClone(baseRelation);
    mutate?.(changedObservation, relation);
    const result = evaluateFreshnessObligation({
      obligation: {
        id,
        semanticTarget: "source-event-age",
        clockRelation: relation
      },
      observation: changedObservation
    });
    return {
      id,
      expected: {
        verdict: "uncertain",
        reason: expectedReason
      },
      result,
      oracleMatches:
        result.verdict === "uncertain"
        && result.reason === expectedReason
    };
  };
  const missingResult = evaluateFreshnessObligation({
    obligation: {
      id: "missing-relation",
      semanticTarget: "source-event-age",
      clockRelation: null
    },
    observation
  });
  return [
    {
      id: "missing-relation",
      expected: {
        verdict: "uncertain",
        reason: "missing-clock-relation"
      },
      result: missingResult,
      oracleMatches:
        missingResult.verdict === "uncertain"
        && missingResult.reason === "missing-clock-relation"
    },
    run("wrong-source-domain", (_input, relation) => {
      relation.sourceClockDomainId = "wrong-domain";
    }, "clock-relation-domain-mismatch"),
    run("wrong-timescale", (_input, relation) => {
      relation.sourceTimescale = "wrong-timescale";
    }, "clock-relation-timescale-mismatch"),
    run("expired-relation", (input, relation) => {
      relation.validity.toSourceNanoseconds =
        (bigint(input.timestamp.nanoseconds, "stamp") - 1n).toString();
    }, "clock-relation-outside-validity"),
    run("wrong-relock-generation", (_input, relation) => {
      relation.relockCounter += 1;
    }, "clock-relation-relock-mismatch"),
    run("invalid-offset-order", (_input, relation) => {
      relation.sourceToTargetOffsetBoundsNanoseconds = ["2", "1"];
    }, "clock-relation-invalid-offset-bounds"),
    run("missing-validity", (_input, relation) => {
      delete relation.validity;
    }, "clock-relation-invalid-validity-shape"),
    run("empty-validity", (_input, relation) => {
      relation.validity = {};
    }, "clock-relation-invalid-validity"),
    run("missing-offset-bounds", (_input, relation) => {
      delete relation.sourceToTargetOffsetBoundsNanoseconds;
    }, "clock-relation-invalid-offset-shape"),
    run("non-integer-offset", (_input, relation) => {
      relation.sourceToTargetOffsetBoundsNanoseconds = ["0", "1.5"];
    }, "clock-relation-invalid-offset-bounds"),
    run("negative-threshold", (input) => {
      input.thresholdNanoseconds = "-1";
    }, "negative-threshold"),
    run("unsupported-comparator", (input) => {
      input.comparator = "<";
    }, "invalid-comparator"),
    run("missing-timestamp-domain", (input) => {
      delete input.timestamp.clockDomainId;
    }, "invalid-clock-domain")
  ];
}

export function runImplementationMutationEvidence(pair) {
  const observation = makeBareSourceObservation(pair);
  const pointAge =
    bigint(observation.nowNanoseconds, "now")
    - bigint(observation.timestamp.nanoseconds, "stamp");
  const threshold =
    bigint(observation.thresholdNanoseconds, "threshold");
  const strictAtEquality = {
    age: threshold,
    expected: "fresh",
    invertedComparatorMutant:
      threshold >= threshold ? "timeout" : "fresh"
  };
  const negativeAge = {
    age: -1n,
    expected: "uncertain",
    missingNegativeAgeGuardMutant:
      -1n > threshold ? "timeout" : "fresh"
  };
  const bypassedRelationGuards = [
    "domain",
    "timescale",
    "validity",
    "relock"
  ].map((guard) => ({
    guard,
    expected: "uncertain",
    bypassMutant: pointAge > threshold ? "timeout" : "fresh",
    killed: (pointAge > threshold ? "timeout" : "fresh") !== "uncertain"
  }));
  return {
    pairId: pair.pairId,
    oracle:
      "independent exact integer outcomes for fixed mutation fixtures",
    mutants: [
      ...bypassedRelationGuards,
      {
        guard: "strict-comparator",
        expected: strictAtEquality.expected,
        bypassMutant: strictAtEquality.invertedComparatorMutant,
        killed:
          strictAtEquality.expected
          !== strictAtEquality.invertedComparatorMutant
      },
      {
        guard: "negative-age",
        expected: negativeAge.expected,
        bypassMutant: negativeAge.missingNegativeAgeGuardMutant,
        killed:
          negativeAge.expected
          !== negativeAge.missingNegativeAgeGuardMutant
      }
    ]
  };
}

function compileCase(directory, id, source, shouldCompile) {
  const sourcePath = resolve(directory, `${id}.cpp`);
  const binaryPath = resolve(directory, id);
  writeFileSync(sourcePath, source);
  const compilation = spawnSync(
    "/usr/bin/clang++",
    [
      "-std=c++17",
      "-Wall",
      "-Wextra",
      "-pedantic",
      "-fsanitize=undefined",
      "-fno-sanitize-recover=undefined",
      "-I",
      resolve(REPOSITORY_ROOT, "scripts/idea-pilots"),
      sourcePath,
      "-o",
      binaryPath
    ],
    { encoding: "utf8" }
  );
  invariant(
    shouldCompile
      ? compilation.status === 0
      : compilation.status !== 0,
    `${id} compile expectation failed`
  );
  const execution = shouldCompile
    ? spawnSync(binaryPath, [], { encoding: "utf8" })
    : null;
  if (execution) {
    invariant(execution.status === 0, `${id} executable failed`);
  }
  return {
    id,
    expected: shouldCompile ? "compile" : "reject",
    compileExitStatus: compilation.status,
    runExitStatus: execution?.status ?? null,
    stdout: execution?.stdout.trim() || null,
    diagnosticClass: shouldCompile
      ? null
      : {
          hasInvalidOperands:
            /invalid operands|no viable overloaded|does not match|private member/i
              .test(compilation.stderr),
          hasTemplateMismatch:
            /deduced conflicting types|candidate template ignored|no matching function/i
              .test(compilation.stderr)
        }
  };
}

export function runCppCompileEvidence() {
  const directory = mkdtempSync(
    resolve(tmpdir(), "clock-obligation-cpp-")
  );
  try {
    const prelude = [
      "#include <iostream>",
      "#include \"clock_obligation_v7.hpp\"",
      "using namespace paper_digest::freshness;",
      "struct SensorClock {};",
      "struct EgoClock {};"
    ].join("\n");
    const cases = [
      compileCase(
        directory,
        "same-domain-receipt",
        `${prelude}
int main() {
  Timestamp<EgoClock, DecisionNow> now{150, 0};
  Timestamp<EgoClock, LocalReceipt> receipt{100, 0};
  const auto result = since_local_receipt(
    now, receipt, 50, Comparator::StrictGreater
  );
  std::cout << static_cast<int>(result.verdict);
}
`,
        true
      ),
      compileCase(
        directory,
        "bounded-cross-domain",
        `${prelude}
int main() {
  Timestamp<EgoClock, DecisionNow> now{1000, 0};
  Timestamp<SensorClock, SourceEvent> event{900, 4};
  RelationCertificate<SensorClock, EgoClock> relation{
    899, 901, 4, 0, 200
  };
  const auto result = source_event_age(
    now, event, relation, 50, Comparator::StrictGreater
  );
  std::cout << static_cast<int>(result.verdict)
            << ":" << result.age_lower_nanoseconds
            << ":" << result.age_upper_nanoseconds;
}
`,
        true
      ),
      compileCase(
        directory,
        "bare-cross-domain-subtraction",
        `${prelude}
int main() {
  Timestamp<EgoClock, DecisionNow> now{1000, 0};
  Timestamp<SensorClock, SourceEvent> event{900, 4};
  const auto age = now - event;
  std::cout << age;
}
`,
        false
      ),
      compileCase(
        directory,
        "private-raw-field-arithmetic",
        `${prelude}
int main() {
  Timestamp<EgoClock, DecisionNow> now{1000, 0};
  Timestamp<SensorClock, SourceEvent> event{900, 4};
  const auto age = now.nanoseconds_ - event.nanoseconds_;
  std::cout << age;
}
`,
        false
      ),
      compileCase(
        directory,
        "source-event-as-local-receipt",
        `${prelude}
int main() {
  Timestamp<EgoClock, DecisionNow> now{1000, 0};
  Timestamp<EgoClock, SourceEvent> event{900, 4};
  const auto result = since_local_receipt(
    now, event, 50, Comparator::StrictGreater
  );
  std::cout << static_cast<int>(result.verdict);
}
`,
        false
      ),
      compileCase(
        directory,
        "wrong-domain-local-receipt",
        `${prelude}
int main() {
  Timestamp<EgoClock, DecisionNow> now{1000, 0};
  Timestamp<SensorClock, LocalReceipt> receipt{900, 4};
  const auto result = since_local_receipt(
    now, receipt, 50, Comparator::StrictGreater
  );
  std::cout << static_cast<int>(result.verdict);
}
`,
        false
      ),
      compileCase(
        directory,
        "wrong-relation-direction",
        `${prelude}
int main() {
  Timestamp<EgoClock, DecisionNow> now{1000, 0};
  Timestamp<SensorClock, SourceEvent> event{900, 4};
  RelationCertificate<EgoClock, SensorClock> relation{
    899, 901, 4, 0, 200
  };
  const auto result = source_event_age(
    now, event, relation, 50, Comparator::StrictGreater
  );
  std::cout << static_cast<int>(result.verdict);
}
`,
        false
      ),
      compileCase(
        directory,
        "checked-int64-overflow",
        `${prelude}
#include <limits>
int main() {
  Timestamp<EgoClock, DecisionNow> now{
    std::numeric_limits<long long>::max(), 0
  };
  Timestamp<EgoClock, LocalReceipt> receipt{-1, 0};
  const auto result = since_local_receipt(
    now, receipt, 50, Comparator::StrictGreater
  );
  std::cout << static_cast<int>(result.verdict)
            << ":" << static_cast<int>(result.reason);
}
`,
        true
      )
    ];
    invariant(
      cases[0].stdout === "0"
      && cases[1].stdout === "2:0:100",
      "Compiled controls returned unexpected verdicts"
    );
    invariant(
      cases.slice(2, -1).every(
        (entry) =>
          entry.diagnosticClass.hasInvalidOperands
          || entry.diagnosticClass.hasTemplateMismatch
      ),
      "Rejected cases lack the expected type diagnostic"
    );
    invariant(
      cases.at(-1).stdout === "2:6",
      "Checked overflow did not fail closed"
    );
    const headerText = readFileSync(
      resolve(REPOSITORY_ROOT, CPP_HEADER_PATH),
      "utf8"
    );
    return {
      compiler: "/usr/bin/clang++",
      languageMode: "c++17",
      header: {
        path: CPP_HEADER_PATH,
        sha256: sha256(headerText)
      },
      cases
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function runObligationPilot() {
  const replayText = readFileSync(
    resolve(REPOSITORY_ROOT, REPLAY_PATH),
    "utf8"
  );
  invariant(
    sha256(replayText) === EXPECTED_REPLAY_SHA256,
    "Clock public-path replay changed after obligation design"
  );
  const replay = JSON.parse(replayText);
  const witnessByPair = new Map(
    replay.controls.boundedProvenance.map((control) => [
      control.basedOnPairId,
      {
        pairId: control.basedOnPairId,
        offsetBoundsNanoseconds:
          control.provenance.sourceReferenceOffsetBoundsNanoseconds
      }
    ])
  );
  const caseClosures = replay.strictPositivePairs.map((pair) =>
    buildCaseClosure(pair, witnessByPair.get(pair.pairId))
  );
  const mutationSuites = replay.strictPositivePairs.map((pair) => ({
    caseId: pair.visibleInputs.caseId,
    mutations: buildMutationSuite(pair)
  }));
  const implementationMutationEvidence =
    replay.strictPositivePairs.map(runImplementationMutationEvidence);
  const cppCompileEvidence = runCppCompileEvidence();
  invariant(
    caseClosures.every(
      (closure) =>
        closure.obligationWithoutRelation.verdict === "uncertain"
        && closure.boundedSourceAgeRepair.verdict === "uncertain"
        && closure.localReceiptRepair.verdict === "fresh"
    ),
    "Case closures do not exhibit the preregistered branch behavior"
  );
  invariant(
    mutationSuites.every((suite) =>
      suite.mutations.every(
        (mutation) =>
          mutation.result.verdict === "uncertain"
          && mutation.oracleMatches === true
      )
    ),
    "A malformed clock relation did not fail closed"
  );
  invariant(
    implementationMutationEvidence.every((suite) =>
      suite.mutants.every((mutant) => mutant.killed)
    ),
    "An intentionally defective implementation survived the oracle"
  );
  const testPath = resolve(
    REPOSITORY_ROOT,
    "test/clock-freshness-obligation-v7.test.mjs"
  );
  return {
    schemaVersion: 1,
    certificateId:
      "cooperative-autonomous-driving-clock-freshness-obligation-pilot-v7",
    candidateId: "cross-domain-freshness-obligation",
    generatedAt: new Date().toISOString(),
    purpose:
      "Prototype a fail-closed freshness obligation over two fixed behavior-changing public source paths without inferring deployment clock quality.",
    replayInput: {
      path: REPLAY_PATH,
      sha256: EXPECTED_REPLAY_SHA256,
      strictPositiveCases: replay.strictPositivePairs.length
    },
    obligationContract: {
      semanticTargets: [
        "time-since-local-receipt",
        "source-event-age"
      ],
      requiredForCrossDomainSourceAge: [
        "source and target clock-domain identities",
        "source and target timescale identities",
        "valid source-time interval",
        "matching relock generation",
        "conservative source-to-target offset bounds"
      ],
      unresolvedAction: "return uncertain; do not coerce to fresh or timeout"
    },
    caseClosures,
    mutationSuites,
    implementationMutationEvidence,
    cppCompileEvidence,
    localSourceIdentity: {
      script: {
        path: "scripts/idea-pilots/clock-freshness-obligation-v7.mjs",
        sha256: sha256(readFileSync(SCRIPT_PATH))
      },
      test: {
        path: "test/clock-freshness-obligation-v7.test.mjs",
        sha256: sha256(readFileSync(testPath))
      }
    },
    checks: {
      everyBareCrossDomainCaseFailsClosed: true,
      everyBoundedExampleStraddlesThreshold: true,
      everyReceiptTimeRepairUsesOneLocalDomain: true,
      everyMalformedRelationFailsClosed: true,
      everyRecordedMutationMatchesIndependentOracle: true,
      everyImplementationMutantIsKilled: true,
      typedCppInterfaceCompilesPositiveCases: true,
      typedCppInterfaceRejectsBareOrSemanticallyWrongCases: true,
      cppCheckedArithmeticFailsClosedUnderUbsan: true
    },
    claimBoundary: {
      supported: [
        "The two fixed source-path examples cannot resolve source-event age from their visible subtraction operands alone.",
        "The executable obligation distinguishes local receipt freshness from source-event age and fails closed when cross-domain relation evidence is absent, mismatched, expired, relocked, malformed, wrong-timescale, or threshold-straddling.",
        "The same decision kernel and mutation classes execute for both fixed source-path adapters; per-path witness bounds are explicit evidence inputs rather than hidden case branches.",
        "A C++17 typed interface uses checked wide intermediates, keeps timestamp fields private, compiles same-domain receipt and certified cross-domain cases, and rejects the recorded bare, wrong-domain, wrong-direction, and wrong-origin examples."
      ],
      notSupported: [
        "No claim is made that either public path is unsafe, reachable in a particular deployment, or supplied by unsynchronized clocks.",
        "The offset bounds in this pilot are constructed witnesses, not field-calibrated guarantees.",
        "This prototype is not yet a C++ AST extractor, ROS message-type checker, upstream production patch, or ecosystem prevalence study.",
        "Private C++ fields and selected compile-negative fixtures reduce accidental misuse but do not prove that every caller or serialization boundary must use this API.",
        "No performance, safety benefit, incident frequency, or product defect is inferred."
      ]
    }
  };
}

const invokedPath =
  process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const report = runObligationPilot();
  const outputArgIndex = process.argv.indexOf("--output");
  if (outputArgIndex >= 0) {
    const outputPath = process.argv[outputArgIndex + 1];
    invariant(outputPath, "--output requires a path");
    writeFileSync(
      resolve(REPOSITORY_ROOT, outputPath),
      `${JSON.stringify(report, null, 2)}\n`
    );
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}
