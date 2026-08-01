import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  OUTPUT_PATH,
  buildCaseClosure,
  buildMutationSuite,
  evaluateFreshnessObligation,
  runCppCompileEvidence,
  runImplementationMutationEvidence,
  runObligationPilot
} from "../scripts/idea-pilots/clock-freshness-obligation-v7.mjs";

const ROOT = new URL("../", import.meta.url);
const replay = JSON.parse(
  await readFile(
    new URL(
      "content/idea-audits/cooperative-autonomous-driving-clock-public-path-replay-v5.json",
      ROOT
    ),
    "utf8"
  )
);

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

function closureFor(pair) {
  return buildCaseClosure(pair, witnessByPair.get(pair.pairId));
}

test("bare public-path operands cannot discharge cross-domain source age", () => {
  for (const pair of replay.strictPositivePairs) {
    const closure = closureFor(pair);
    assert.equal(closure.sourceExpressionVerdict, "timeout");
    assert.equal(
      closure.obligationWithoutRelation.verdict,
      "uncertain"
    );
    assert.equal(
      closure.obligationWithoutRelation.reason,
      "missing-clock-relation"
    );
  }
});

test("bounded witnesses straddle each source threshold", () => {
  const intervals = replay.strictPositivePairs.map(
    (pair) => closureFor(pair).boundedSourceAgeRepair
  );
  assert.deepEqual(
    intervals.map((result) => result.ageIntervalNanoseconds),
    [
      ["2000000000", "4000000000"],
      ["300000000", "600000000"]
    ]
  );
  assert.ok(intervals.every((result) => result.verdict === "uncertain"));
});

test("local receipt semantics resolve in one explicit clock domain", () => {
  for (const pair of replay.strictPositivePairs) {
    const result = closureFor(pair).localReceiptRepair;
    assert.equal(result.status, "resolved-same-domain");
    assert.equal(result.verdict, "fresh");
    assert.equal(result.reason, "same-domain-local-receipt-time");
  }
});

test("missing and malformed relation evidence always fails closed", () => {
  for (const pair of replay.strictPositivePairs) {
    const mutations = buildMutationSuite(pair);
    assert.equal(mutations.length, 13);
    assert.ok(
      mutations.every(
        ({ result, oracleMatches }) =>
          result.status === "unresolved"
          && result.verdict === "uncertain"
          && result.ageIntervalNanoseconds === null
          && oracleMatches === true
      )
    );
  }
});

test("malformed top-level shapes are total and fail closed", () => {
  const cases = [
    undefined,
    {},
    { obligation: null, observation: null },
    {
      obligation: { id: "bad", semanticTarget: "source-event-age" },
      observation: { timestamp: {} }
    },
    {
      obligation: { id: "bad", semanticTarget: "source-event-age" },
      observation: {
        nowNanoseconds: true,
        timestamp: {
          nanoseconds: "1.5",
          clockDomainId: "a",
          timescale: "tai",
          relockCounter: 0,
          origin: "source-event"
        },
        decisionClockDomainId: "a",
        decisionTimescale: "tai",
        thresholdNanoseconds: "0",
        comparator: ">"
      }
    }
  ];
  for (const input of cases) {
    assert.doesNotThrow(() => evaluateFreshnessObligation(input));
    assert.equal(
      evaluateFreshnessObligation(input).verdict,
      "uncertain"
    );
  }
});

test("strict and inclusive threshold comparators retain boundary semantics", () => {
  const base = {
    obligation: {
      id: "same-domain-boundary",
      semanticTarget: "source-event-age"
    },
    observation: {
      nowNanoseconds: "150",
      timestamp: {
        nanoseconds: "100",
        clockDomainId: "clock-a",
        timescale: "tai",
        relockCounter: 0,
        origin: "source-event"
      },
      decisionClockDomainId: "clock-a",
      decisionTimescale: "tai",
      thresholdNanoseconds: "50",
      comparator: ">"
    }
  };
  assert.equal(evaluateFreshnessObligation(base).verdict, "fresh");
  assert.equal(
    evaluateFreshnessObligation({
      ...base,
      observation: { ...base.observation, comparator: ">=" }
    }).verdict,
    "timeout"
  );
});

test("independent fixed-fixture oracles kill dropped guards and comparator mutations", () => {
  for (const pair of replay.strictPositivePairs) {
    const evidence = runImplementationMutationEvidence(pair);
    assert.ok(evidence.mutants.length >= 6);
    assert.ok(evidence.mutants.every((mutant) => mutant.killed));
  }
});

test("typed C++ interface admits obligations and rejects bare subtraction", () => {
  const evidence = runCppCompileEvidence();
  assert.deepEqual(
    evidence.cases.map((entry) => [
      entry.id,
      entry.expected
    ]),
    [
      ["same-domain-receipt", "compile"],
      ["bounded-cross-domain", "compile"],
      ["bare-cross-domain-subtraction", "reject"],
      ["private-raw-field-arithmetic", "reject"],
      ["source-event-as-local-receipt", "reject"],
      ["wrong-domain-local-receipt", "reject"],
      ["wrong-relation-direction", "reject"],
      ["checked-int64-overflow", "compile"]
    ]
  );
  assert.ok(
    evidence.cases.every((entry) =>
      entry.expected === "compile"
        ? entry.compileExitStatus === 0
        : entry.compileExitStatus !== 0
    )
  );
  assert.equal(evidence.cases[0].stdout, "0");
  assert.equal(evidence.cases[1].stdout, "2:0:100");
  assert.equal(evidence.cases.at(-1).stdout, "2:6");
});

test("pilot certificate preserves all fail-closed and claim boundaries", async () => {
  const generated = runObligationPilot();
  const checkedIn = JSON.parse(
    await readFile(new URL(OUTPUT_PATH, ROOT), "utf8")
  );
  const withoutGeneratedAt = (value) => {
    const copy = structuredClone(value);
    delete copy.generatedAt;
    return copy;
  };
  assert.deepEqual(
    withoutGeneratedAt(checkedIn),
    withoutGeneratedAt(generated)
  );
  assert.deepEqual(generated.checks, {
    everyBareCrossDomainCaseFailsClosed: true,
    everyBoundedExampleStraddlesThreshold: true,
    everyReceiptTimeRepairUsesOneLocalDomain: true,
    everyMalformedRelationFailsClosed: true,
    everyRecordedMutationMatchesIndependentOracle: true,
    everyImplementationMutantIsKilled: true,
    typedCppInterfaceCompilesPositiveCases: true,
    typedCppInterfaceRejectsBareOrSemanticallyWrongCases: true,
    cppCheckedArithmeticFailsClosedUnderUbsan: true
  });
  assert.ok(generated.claimBoundary.notSupported.length >= 4);
});
