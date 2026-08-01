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
  "content/idea-audits/cooperative-autonomous-driving-clock-freshness-obligation-pilot-v6.json";
export const EXPECTED_REPLAY_SHA256 =
  "d82bc07378bf5d49f5765291689a58b517b5133f14a3805f39f3985adab07ef8";
export const CPP_HEADER_PATH =
  "scripts/idea-pilots/clock_obligation.hpp";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function bigint(value, label) {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`${label} must be an integer-compatible value`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Json(value) {
  return sha256(JSON.stringify(value));
}

function compareAge(ageNs, thresholdNs, comparator) {
  if (comparator === ">") return ageNs > thresholdNs;
  if (comparator === ">=") return ageNs >= thresholdNs;
  throw new Error(`Unsupported comparator: ${comparator}`);
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

function validateObservation(observation) {
  invariant(observation && typeof observation === "object", "observation is required");
  invariant(observation.timestamp, "observation.timestamp is required");
  invariant(
    observation.decisionClockDomainId,
    "observation.decisionClockDomainId is required"
  );
  invariant(observation.comparator, "observation.comparator is required");
  return {
    nowNs: bigint(observation.nowNanoseconds, "nowNanoseconds"),
    stampNs: bigint(
      observation.timestamp.nanoseconds,
      "timestamp.nanoseconds"
    ),
    thresholdNs: bigint(
      observation.thresholdNanoseconds,
      "thresholdNanoseconds"
    )
  };
}

function relationIsApplicable(relation, observation, stampNs) {
  if (!relation) return "missing-clock-relation";
  if (
    relation.sourceClockDomainId
      !== observation.timestamp.clockDomainId
    || relation.targetClockDomainId
      !== observation.decisionClockDomainId
  ) {
    return "clock-relation-domain-mismatch";
  }
  if (
    !Number.isInteger(relation.relockCounter)
    || !Number.isInteger(observation.timestamp.relockCounter)
    || relation.relockCounter !== observation.timestamp.relockCounter
  ) {
    return "clock-relation-relock-mismatch";
  }
  const fromNs = bigint(
    relation.validity.fromSourceNanoseconds,
    "relation.validity.fromSourceNanoseconds"
  );
  const toNs = bigint(
    relation.validity.toSourceNanoseconds,
    "relation.validity.toSourceNanoseconds"
  );
  if (fromNs > toNs) return "clock-relation-invalid-validity";
  if (stampNs < fromNs || stampNs > toNs) {
    return "clock-relation-outside-validity";
  }
  const lower = bigint(
    relation.sourceToTargetOffsetBoundsNanoseconds[0],
    "relation.sourceToTargetOffsetBoundsNanoseconds[0]"
  );
  const upper = bigint(
    relation.sourceToTargetOffsetBoundsNanoseconds[1],
    "relation.sourceToTargetOffsetBoundsNanoseconds[1]"
  );
  if (lower > upper) return "clock-relation-invalid-offset-bounds";
  return null;
}

export function evaluateFreshnessObligation({
  obligation,
  observation
}) {
  invariant(obligation?.id, "obligation.id is required");
  invariant(
    ["time-since-local-receipt", "source-event-age"].includes(
      obligation.semanticTarget
    ),
    "obligation.semanticTarget is invalid"
  );
  const { nowNs, stampNs, thresholdNs } =
    validateObservation(observation);
  const timestampDomain = observation.timestamp.clockDomainId;
  const decisionDomain = observation.decisionClockDomainId;

  if (obligation.semanticTarget === "time-since-local-receipt") {
    if (observation.timestamp.origin !== "local-receipt") {
      return uncertain(
        "receipt-time-obligation-requires-local-receipt-origin",
        obligation.id
      );
    }
    if (!timestampDomain || timestampDomain !== decisionDomain) {
      return uncertain(
        "receipt-time-obligation-requires-same-clock-domain",
        obligation.id
      );
    }
    const ageNs = nowNs - stampNs;
    if (ageNs < 0n) {
      return uncertain("negative-local-receipt-age", obligation.id);
    }
    return {
      status: "resolved-same-domain",
      verdict: compareAge(
        ageNs,
        thresholdNs,
        observation.comparator
      ) ? "timeout" : "fresh",
      obligationId: obligation.id,
      ageIntervalNanoseconds: [ageNs.toString(), ageNs.toString()],
      reason: "same-domain-local-receipt-time"
    };
  }

  if (
    timestampDomain
    && timestampDomain === decisionDomain
    && observation.timestamp.origin === "source-event"
  ) {
    const ageNs = nowNs - stampNs;
    if (ageNs < 0n) {
      return uncertain("negative-same-domain-source-age", obligation.id);
    }
    return {
      status: "resolved-same-domain",
      verdict: compareAge(
        ageNs,
        thresholdNs,
        observation.comparator
      ) ? "timeout" : "fresh",
      obligationId: obligation.id,
      ageIntervalNanoseconds: [ageNs.toString(), ageNs.toString()],
      reason: "same-domain-source-event-time"
    };
  }

  const relationIssue = relationIsApplicable(
    obligation.clockRelation,
    observation,
    stampNs
  );
  if (relationIssue) return uncertain(relationIssue, obligation.id);

  const [offsetLowerNs, offsetUpperNs] =
    obligation.clockRelation.sourceToTargetOffsetBoundsNanoseconds
      .map((value) => bigint(value, "sourceToTargetOffsetBoundsNanoseconds"));
  const mappedStampLowerNs = stampNs + offsetLowerNs;
  const mappedStampUpperNs = stampNs + offsetUpperNs;
  const rawAgeLowerNs = nowNs - mappedStampUpperNs;
  const rawAgeUpperNs = nowNs - mappedStampLowerNs;
  if (rawAgeUpperNs < 0n) {
    return uncertain(
      "clock-relation-implies-only-negative-source-age",
      obligation.id
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
    obligationId: obligation.id,
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
      relockCounter: 4,
      origin: "source-event"
    },
    decisionClockDomainId:
      `${pair.visibleInputs.caseId}-decision-clock`,
    thresholdNanoseconds:
      pair.visibleInputs.thresholdNanoseconds,
    comparator: pair.visibleInputs.comparator
  };
}

export function buildCaseClosure(pair) {
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
          pair.visibleInputs.caseId === "POS-01-AUTOWARE-VTL"
            ? ["0", "2000000000"]
            : ["0", "300000000"]
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
  const run = (id, mutate) => {
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
    return { id, result };
  };
  return [
    {
      id: "missing-relation",
      result: evaluateFreshnessObligation({
        obligation: {
          id: "missing-relation",
          semanticTarget: "source-event-age",
          clockRelation: null
        },
        observation
      })
    },
    run("wrong-source-domain", (_input, relation) => {
      relation.sourceClockDomainId = "wrong-domain";
    }),
    run("expired-relation", (input, relation) => {
      relation.validity.toSourceNanoseconds =
        (bigint(input.timestamp.nanoseconds, "stamp") - 1n).toString();
    }),
    run("wrong-relock-generation", (_input, relation) => {
      relation.relockCounter += 1;
    }),
    run("invalid-offset-order", (_input, relation) => {
      relation.sourceToTargetOffsetBoundsNanoseconds = ["2", "1"];
    })
  ];
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
            /invalid operands|no viable overloaded|does not match/i
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
      "#include \"clock_obligation.hpp\"",
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
      )
    ];
    invariant(
      cases[0].stdout === "0"
      && cases[1].stdout === "2:0:100",
      "Compiled controls returned unexpected verdicts"
    );
    invariant(
      cases.slice(2).every(
        (entry) =>
          entry.diagnosticClass.hasInvalidOperands
          || entry.diagnosticClass.hasTemplateMismatch
      ),
      "Rejected cases lack the expected type diagnostic"
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
  const caseClosures = replay.strictPositivePairs.map(buildCaseClosure);
  const mutationSuites = replay.strictPositivePairs.map((pair) => ({
    caseId: pair.visibleInputs.caseId,
    mutations: buildMutationSuite(pair)
  }));
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
        (mutation) => mutation.result.verdict === "uncertain"
      )
    ),
    "A malformed clock relation did not fail closed"
  );
  return {
    schemaVersion: 1,
    certificateId:
      "cooperative-autonomous-driving-clock-freshness-obligation-pilot-v6",
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
        "valid source-time interval",
        "matching relock generation",
        "conservative source-to-target offset bounds"
      ],
      unresolvedAction: "return uncertain; do not coerce to fresh or timeout"
    },
    caseClosures,
    mutationSuites,
    cppCompileEvidence,
    checks: {
      everyBareCrossDomainCaseFailsClosed: true,
      everyBoundedExampleStraddlesThreshold: true,
      everyReceiptTimeRepairUsesOneLocalDomain: true,
      everyMalformedRelationFailsClosed: true,
      typedCppInterfaceCompilesPositiveCases: true,
      typedCppInterfaceRejectsBareOrSemanticallyWrongCases: true
    },
    claimBoundary: {
      supported: [
        "The two fixed source-path examples cannot resolve source-event age from their visible subtraction operands alone.",
        "The executable obligation distinguishes local receipt freshness from source-event age and fails closed when cross-domain relation evidence is absent, mismatched, expired, relocked, malformed, or threshold-straddling.",
        "The same obligation contract and mutation classes execute for both fixed source-path adapters without repository-name-specific decision logic.",
        "A C++17 typed interface compiles same-domain receipt and certified cross-domain cases while rejecting bare cross-domain subtraction and source-event/local-receipt type substitution."
      ],
      notSupported: [
        "No claim is made that either public path is unsafe, reachable in a particular deployment, or supplied by unsynchronized clocks.",
        "The offset bounds in this pilot are constructed witnesses, not field-calibrated guarantees.",
        "This prototype is not yet a C++ AST extractor, ROS message-type checker, production patch, or ecosystem prevalence study.",
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
