import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CLAIM_BOUNDARY,
  OUTPUT_PATH,
  SOURCE_CONTRACTS,
  boundedProvenanceDecision,
  buildReplayExperiment,
  mechanicallyExtractSemantics,
  replayAutowareTimeout,
  replayCarmaGnssTimeout,
  replayCarmaSameClockTimeout,
  runReplay,
  verifyFrozenSources,
  verifySourceAudit
} from "../scripts/idea-pilots/clock-public-path-replay.mjs";

const ROOT = process.cwd();
const sourceRepositoriesPresent = SOURCE_CONTRACTS.every((contract) =>
  existsSync(contract.root)
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function collectKeys(value, output = []) {
  if (Array.isArray(value)) {
    for (const child of value) collectKeys(child, output);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      output.push(key);
      collectKeys(child, output);
    }
  }
  return output;
}

test("source-equivalent adapters retain the frozen boundary comparators", () => {
  assert.equal(
    replayAutowareTimeout({
      nowNanoseconds: "4000000000",
      stampNanoseconds: "1000000000",
      maxDelaySeconds: 3
    }).timeout,
    false
  );
  assert.equal(
    replayAutowareTimeout({
      nowNanoseconds: "4000000001",
      stampNanoseconds: "1000000000",
      maxDelaySeconds: 3
    }).timeout,
    true
  );
  assert.equal(
    replayCarmaGnssTimeout({
      nowNanoseconds: "1500000000",
      stampNanoseconds: "1000000000",
      gnssDataTimeoutMilliseconds: 500
    }).timeout,
    false
  );
  assert.equal(
    replayCarmaGnssTimeout({
      nowNanoseconds: "1500000001",
      stampNanoseconds: "1000000000",
      gnssDataTimeoutMilliseconds: 500
    }).timeout,
    true
  );
  assert.equal(
    replayCarmaSameClockTimeout({
      nowNanoseconds: "6000000000",
      latestUpdateNanoseconds: "1000000000",
      timeoutDurationSeconds: 5
    }).timeout,
    true
  );
});

test("strict pairs preserve visible identity while reference truth reverses", () => {
  const experiment = buildReplayExperiment({
    autowareMaxDelaySeconds: 3,
    carmaGnssTimeoutMilliseconds: 500
  });
  assert.equal(experiment.strictPositivePairs.length, 2);
  for (const pair of experiment.strictPositivePairs) {
    assert.equal(pair.worlds.length, 2);
    assert.equal(new Set(pair.worlds.map((world) => world.pairId)).size, 1);
    assert.equal(
      new Set(pair.worlds.map((world) => world.visibleInputSha256)).size,
      1
    );
    assert.deepEqual(
      pair.worlds.map((world) => world.sourceExpressionTimeout),
      [true, true]
    );
    assert.deepEqual(
      pair.worlds.map((world) => world.referenceDeadlineTruth.timeout),
      [true, false]
    );
    assert.equal(
      pair.worlds.every(
        (world) =>
          world.clockMapping.monotone && world.clockMapping.invertible
      ),
      true
    );
  }
  assert.equal(
    new Set(experiment.pairIdentities.map((identity) => identity.pairId)).size,
    2
  );
});

test("same-clock, receipt-time, and bounded-provenance controls separate semantics", () => {
  const experiment = buildReplayExperiment({
    autowareMaxDelaySeconds: 3,
    carmaGnssTimeoutMilliseconds: 500
  });
  const sameClock = experiment.controls.sameClock;
  assert.equal(
    sameClock.worlds.every(
      (world) =>
        world.sourceExpressionTimeout && world.referenceDeadlineTruth.timeout
    ),
    true
  );
  assert.equal(
    experiment.controls.receiptTimeRedesign.every(
      (control) =>
        !control.result.timeout &&
        !control.remoteSourceStampUsedByDecision &&
        control.worlds.every((world) => !world.receiptTimeout)
    ),
    true
  );
  assert.equal(
    experiment.controls.boundedProvenance.every(
      (control) =>
        control.result.verdict === "uncertain" &&
        control.result.identifiedAge.lower.nanoseconds <
          control.result.threshold.nanoseconds &&
        control.result.identifiedAge.upper.nanoseconds >
          control.result.threshold.nanoseconds
    ),
    true
  );
});

test("bounded provenance distinguishes fresh, timeout, and uncertain", () => {
  const base = {
    nowNanoseconds: "10000000000",
    stampNanoseconds: "9400000000",
    thresholdNanoseconds: "500000000",
    localReferenceOffsetBoundsNanoseconds: ["0", "0"],
    domainBound: true,
    mappingValid: true
  };
  assert.equal(
    boundedProvenanceDecision({
      ...base,
      sourceReferenceOffsetBoundsNanoseconds: ["200000000", "300000000"]
    }).verdict,
    "fresh"
  );
  assert.equal(
    boundedProvenanceDecision({
      ...base,
      sourceReferenceOffsetBoundsNanoseconds: ["0", "50000000"]
    }).verdict,
    "timeout"
  );
  assert.equal(
    boundedProvenanceDecision({
      ...base,
      sourceReferenceOffsetBoundsNanoseconds: ["0", "300000000"]
    }).verdict,
    "uncertain"
  );
  assert.equal(
    boundedProvenanceDecision({
      ...base,
      sourceReferenceOffsetBoundsNanoseconds: ["0", "0"],
      domainBound: false
    }).verdict,
    "uncertain"
  );
});

test(
  "fixed commits, source blobs, exact line slices, and mechanical extraction verify",
  { skip: !sourceRepositoriesPresent },
  () => {
    const sourceAudit = verifySourceAudit();
    const verification = verifyFrozenSources();
    const extraction = mechanicallyExtractSemantics(verification);
    assert.deepEqual(sourceAudit.strictPositiveIds, [
      "POS-01-AUTOWARE-VTL",
      "POS-02-CARMA-GNSS"
    ]);
    assert.equal(
      verification.every(
        (repository) => repository.commitMatches && repository.worktreeClean
      ),
      true
    );
    for (const repository of verification) {
      for (const file of repository.files) {
        assert.match(file.sourceSha256, /^[0-9a-f]{64}$/);
        assert.equal(file.worktreeMatchesFixedCommit, true);
        for (const snippet of file.snippets) {
          assert.equal(sha256(snippet.text), snippet.sha256);
          assert.deepEqual(
            snippet.lines.every(Number.isInteger),
            true
          );
        }
      }
    }
    assert.equal(extraction.autoware.threshold.configuredValue, 3);
    assert.equal(extraction.autoware.incomingStamp.operand, "state.stamp");
    assert.equal(extraction.autoware.localNow.operand, "clock_->now()");
    assert.equal(extraction.autoware.expression.comparator, ">");
    assert.equal(extraction.carma.threshold.configuredDefault, 500);
    assert.equal(
      extraction.carma.incomingStamp.operand,
      "last_raw_gnss_value_->header.stamp"
    );
    assert.equal(extraction.carma.localNow.operand, "timer_factory_->now()");
    assert.equal(extraction.carma.expression.comparator, ">");
    assert.equal(extraction.carma.sameClockControl.comparator, ">=");
  }
);

test(
  "full read-only replay verifies every declared result",
  { skip: !sourceRepositoriesPresent },
  () => {
    const audit = runReplay();
    assert.deepEqual(audit.results, {
      strictPositivePairCount: 2,
      sourceExpressionTimeoutSameWithinEveryPair: true,
      referenceDeadlineTruthOppositeWithinEveryPair: true,
      sameClockControlInvariant: true,
      receiptTimeRedesignInvariantToRemoteMapping: true,
      boundedProvenanceVerdictsUncertain: true
    });
  }
);

test("recorded v5 artifact is internally hashed and stays inside the claim boundary", () => {
  const artifactPath = resolve(ROOT, OUTPUT_PATH);
  assert.equal(existsSync(artifactPath), true);
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  assert.equal(
    artifact.auditId,
    "cooperative-autonomous-driving-clock-public-path-replay-v5"
  );
  assert.equal(artifact.sourceVerification.length, 2);
  assert.deepEqual(artifact.pairIdentities, [
    {
      caseId: "POS-01-AUTOWARE-VTL",
      pairId: "pos-01-autoware-vtl-7a16ba842ba883b2",
      visibleInputSha256:
        "7a16ba842ba883b2834ffc36e985c94dfb69a275dce019a1a67dbc8d95c6e5a3"
    },
    {
      caseId: "POS-02-CARMA-GNSS",
      pairId: "pos-02-carma-gnss-20b5963da1d5315f",
      visibleInputSha256:
        "20b5963da1d5315f59877e3a14dc78664850307eeb6365add721d34fc6aed5c9"
    }
  ]);
  assert.equal(
    artifact.execution.localArtifactSha256[
      "scripts/idea-pilots/clock-public-path-replay.mjs"
    ],
    sha256(
      readFileSync(
        resolve(ROOT, "scripts/idea-pilots/clock-public-path-replay.mjs")
      )
    )
  );
  assert.equal(
    artifact.execution.localArtifactSha256[
      "test/clock-public-path-replay.test.mjs"
    ],
    sha256(readFileSync(resolve(ROOT, "test/clock-public-path-replay.test.mjs")))
  );
  assert.deepEqual(artifact.results, {
    strictPositivePairCount: 2,
    sourceExpressionTimeoutSameWithinEveryPair: true,
    referenceDeadlineTruthOppositeWithinEveryPair: true,
    sameClockControlInvariant: true,
    receiptTimeRedesignInvariantToRemoteMapping: true,
    boundedProvenanceVerdictsUncertain: true
  });
  assert.deepEqual(artifact.claimBoundary, CLAIM_BOUNDARY);
  assert.equal(
    collectKeys(artifact).some((key) => key.toLowerCase().includes("score")),
    false
  );
  assert.match(artifact.claimBoundary.researchQuestion, /visible operands/i);
  assert.match(
    artifact.claimBoundary.notSupported.join(" "),
    /product-safety.*field-behavior/i
  );
});
