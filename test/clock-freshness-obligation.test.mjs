import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  OUTPUT_PATH,
  buildCaseClosure,
  buildMutationSuite,
  evaluateFreshnessObligation,
  runCppCompileEvidence,
  runObligationPilot
} from "../scripts/idea-pilots/clock-freshness-obligation.mjs";

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

test("bare public-path operands cannot discharge cross-domain source age", () => {
  for (const pair of replay.strictPositivePairs) {
    const closure = buildCaseClosure(pair);
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
    (pair) => buildCaseClosure(pair).boundedSourceAgeRepair
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
    const result = buildCaseClosure(pair).localReceiptRepair;
    assert.equal(result.status, "resolved-same-domain");
    assert.equal(result.verdict, "fresh");
    assert.equal(result.reason, "same-domain-local-receipt-time");
  }
});

test("missing and malformed relation evidence always fails closed", () => {
  for (const pair of replay.strictPositivePairs) {
    const mutations = buildMutationSuite(pair);
    assert.equal(mutations.length, 5);
    assert.ok(
      mutations.every(
        ({ result }) =>
          result.status === "unresolved"
          && result.verdict === "uncertain"
          && result.ageIntervalNanoseconds === null
      )
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
        relockCounter: 0,
        origin: "source-event"
      },
      decisionClockDomainId: "clock-a",
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

test("typed C++ interface admits obligations and rejects bare subtraction", () => {
  const evidence = runCppCompileEvidence();
  assert.deepEqual(
    evidence.cases.map((entry) => [
      entry.id,
      entry.expected,
      entry.compileExitStatus
    ]),
    [
      ["same-domain-receipt", "compile", 0],
      ["bounded-cross-domain", "compile", 0],
      ["bare-cross-domain-subtraction", "reject", 1],
      ["source-event-as-local-receipt", "reject", 1]
    ]
  );
  assert.equal(evidence.cases[0].stdout, "0");
  assert.equal(evidence.cases[1].stdout, "2:0:100");
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
    typedCppInterfaceCompilesPositiveCases: true,
    typedCppInterfaceRejectsBareOrSemanticallyWrongCases: true
  });
  assert.ok(generated.claimBoundary.notSupported.length >= 4);
});
