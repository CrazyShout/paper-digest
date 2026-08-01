import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CLAIM_BOUNDARY,
  MUTANT_DEFINITIONS,
  OUTPUT_PATH,
  SOURCE_CONTRACTS,
  buildSourceBoundMigration,
  evaluateReceiptFreshness,
  runCppHarnessEvidence,
  runMigrationPilot
} from "../scripts/idea-pilots/clock-receipt-migration.mjs";

const ROOT = process.cwd();
const fixedSourcesPresent = SOURCE_CONTRACTS.every((contract) =>
  existsSync(contract.root)
);
let migrationCache;
let harnessCache;
let pilotCache;

function migration() {
  migrationCache ??= buildSourceBoundMigration();
  return migrationCache;
}

function harness() {
  harnessCache ??= runCppHarnessEvidence(migration().cases);
  return harnessCache;
}

function pilot() {
  pilotCache ??= runMigrationPilot();
  return pilotCache;
}

function withoutGeneratedAt(value) {
  const copy = structuredClone(value);
  delete copy.generatedAt;
  return copy;
}

test("receipt semantics preserve strict fresh, timeout, and equality behavior", () => {
  const base = {
    nowNanoseconds: "1100",
    nowClockDomain: "steady-local",
    nowEpoch: 4,
    receiptNanoseconds: "1000",
    receiptClockDomain: "steady-local",
    receiptEpoch: 4,
    receiptPresent: true,
    thresholdNanoseconds: "100",
    comparator: ">"
  };
  assert.equal(
    evaluateReceiptFreshness({ ...base, nowNanoseconds: "1050" }),
    "fresh"
  );
  assert.equal(
    evaluateReceiptFreshness({ ...base, nowNanoseconds: "1101" }),
    "timeout"
  );
  assert.equal(evaluateReceiptFreshness(base), "fresh");
});

test("remote stamp and offset are outside receipt freshness operands", () => {
  const receiptInput = {
    nowNanoseconds: "1101",
    nowClockDomain: "steady-local",
    nowEpoch: 4,
    receiptNanoseconds: "1000",
    receiptClockDomain: "steady-local",
    receiptEpoch: 4,
    receiptPresent: true,
    thresholdNanoseconds: "100",
    comparator: ">"
  };
  assert.equal(evaluateReceiptFreshness(receiptInput), "timeout");
  assert.equal(
    evaluateReceiptFreshness({
      ...receiptInput,
      remoteStampNanoseconds: "-9223372036854775808",
      remoteOffsetNanoseconds: "9223372036854775807"
    }),
    "timeout"
  );
});

test("missing receipt, wrong clock, relock, negative age, and overflow fail closed", () => {
  const base = {
    nowNanoseconds: "1050",
    nowClockDomain: "steady-local",
    nowEpoch: 4,
    receiptNanoseconds: "1000",
    receiptClockDomain: "steady-local",
    receiptEpoch: 4,
    receiptPresent: true,
    thresholdNanoseconds: "100",
    comparator: ">"
  };
  const invalid = [
    { ...base, receiptPresent: false },
    { ...base, receiptClockDomain: "other-local-clock" },
    { ...base, receiptEpoch: 3 },
    { ...base, nowNanoseconds: "999" },
    {
      ...base,
      nowNanoseconds: "9223372036854775807",
      receiptNanoseconds: "-9223372036854775808"
    }
  ];
  assert.deepEqual(
    invalid.map(evaluateReceiptFreshness),
    Array(invalid.length).fill("uncertain")
  );
});

test(
  "fixed blobs, exact anchors, and replay/header provenance verify",
  { skip: !fixedSourcesPresent },
  () => {
    const result = migration();
    assert.equal(result.provenanceInputs.length, 3);
    assert.deepEqual(
      result.cases.map((entry) => entry.caseId),
      ["POS-01-AUTOWARE-VTL", "POS-02-CARMA-GNSS"]
    );
    for (const entry of result.cases) {
      assert.equal(entry.sourceVerification.commitMatches, true);
      assert.equal(entry.sourceVerification.worktreeCleanBefore, true);
      assert.equal(entry.sourceVerification.worktreeCleanAfter, true);
      assert.ok(
        entry.replacementAnchors.every(
          (anchor) =>
            /^[0-9a-f]{64}$/.test(anchor.beforeSha256) &&
            /^[0-9a-f]{64}$/.test(anchor.afterSha256)
        )
      );
      assert.equal(
        entry.mechanicalSemantics.semanticTargetAfter,
        "time-since-local-receipt"
      );
      assert.equal(
        entry.mechanicalSemantics.remoteStampOperandAfter,
        null
      );
      assert.equal(entry.mechanicalSemantics.afterComparator, ">");
    }
  }
);

test(
  "unified patches check, apply, and change only declared files",
  { skip: !fixedSourcesPresent },
  () => {
    for (const [index, entry] of migration().cases.entries()) {
      const applicability = entry.actualPatchApplicability;
      assert.equal(applicability.gitApplyCheckExitStatus, 0);
      assert.equal(applicability.gitApplyExitStatus, 0);
      assert.equal(applicability.onlyExpectedFilesChanged, true);
      assert.equal(applicability.appliedDiffMatchesGeneratedDiff, true);
      assert.equal(applicability.fixedCheckoutModified, false);
      assert.deepEqual(
        applicability.changedPaths,
        [...SOURCE_CONTRACTS[index].changedPaths].sort()
      );
      assert.match(entry.patch.unifiedDiff, /^diff --git /m);
      for (const file of entry.patch.changedFiles) {
        assert.notEqual(file.beforeSha256, file.afterSha256);
      }
    }
  }
);

test(
  "Autoware cached polling replay cannot overwrite receipt",
  { skip: !fixedSourcesPresent },
  () => {
    const autoware = migration().cases[0];
    assert.match(
      autoware.patch.unifiedDiff,
      /polling_policy::Newest/
    );
    assert.equal(
      autoware.mechanicalSemantics.cachedReplayHandling,
      "polling_policy::Newest returns nullptr when no newly taken message exists"
    );
  }
);

test(
  "mechanically bound C++17 harness runs and kills every required mutant",
  { skip: !fixedSourcesPresent },
  () => {
    const evidence = harness();
    assert.equal(evidence.base.compileExitStatus, 0);
    assert.equal(evidence.base.runExitStatus, 0);
    assert.match(evidence.base.stdout, /^PASS:/);
    assert.equal(evidence.allMutantsKilled, true);
    assert.deepEqual(
      evidence.mutants.map((entry) => entry.category),
      MUTANT_DEFINITIONS.map((entry) => entry.category)
    );
    assert.ok(
      evidence.mutants.every(
        (entry) =>
          entry.compileExitStatus === 0 &&
          entry.runExitStatus !== 0 &&
          entry.killed &&
          entry.killedBy.length > 0
      )
    );
  }
);

test(
  "checked-in audit reproduces and states build blockers and claim boundary",
  { skip: !fixedSourcesPresent },
  () => {
    const generated = pilot();
    const checkedIn = JSON.parse(
      readFileSync(resolve(ROOT, OUTPUT_PATH), "utf8")
    );
    assert.deepEqual(
      withoutGeneratedAt(checkedIn),
      withoutGeneratedAt(generated)
    );
    assert.ok(
      generated.fullProjectBuilds.every(
        (entry) => entry.status === "blocked" && entry.attempted === false
      )
    );
    assert.deepEqual(generated.results, {
      fixedSourceContractsVerified: true,
      actualPatchApplicabilityPassed: true,
      onlyExpectedSourceFilesChanged: true,
      remoteStampRemovedFromFreshnessOperands: true,
      strictComparisonBoundaryPreserved: true,
      harnessCompiledAndRan: true,
      allMutantsKilled: true,
      fullAutowareBuild: "blocked",
      fullCarmaBuild: "blocked"
    });
    assert.deepEqual(generated.claimBoundary, CLAIM_BOUNDARY);
    assert.ok(
      generated.claimBoundary.notSupported.some((claim) =>
        claim.includes("does not preserve or estimate source-event-age")
      )
    );
    assert.ok(
      generated.claimBoundary.notSupported.some((claim) =>
        claim.includes("No safety benefit")
      )
    );
  }
);
