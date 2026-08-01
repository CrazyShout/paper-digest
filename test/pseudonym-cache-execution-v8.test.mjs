import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

import {
  CANDIDATE_ID,
  DEFAULT_AUDIT_PATH,
  FIXED_COMMIT,
  OFFICIAL_RANGES,
  buildTraceContract,
  deterministicExpectedResults,
  simulateOfficialReceiverSemantics,
} from "../scripts/idea-pilots/pseudonym-cache-execution-v8.mjs";

const ROOT = resolve(import.meta.dirname, "..");

function sha256File(relativePath) {
  return createHash("sha256")
    .update(readFileSync(resolve(ROOT, relativePath)))
    .digest("hex");
}

test("trace contract rotates all ETSI identity fields only in the primary rotation trace", () => {
  const traces = buildTraceContract();
  assert.deepEqual(
    traces.map((trace) => trace.id),
    [
      "no-rotation",
      "synchronous-station-object-sensor-rotation",
      "station-only-rotation-negative-control",
    ]
  );

  const stable = traces[0];
  assert.equal(new Set(stable.frames.map((frame) => frame.stationId)).size, 1);
  assert.equal(new Set(stable.frames.map((frame) => frame.objectId)).size, 1);
  assert.equal(new Set(stable.frames.map((frame) => frame.sensorId)).size, 1);

  const synchronized = traces[1];
  const before = synchronized.frames[1];
  const after = synchronized.frames[2];
  assert.notEqual(before.stationId, after.stationId);
  assert.notEqual(before.objectId, after.objectId);
  assert.notEqual(before.sensorId, after.sensorId);
  assert.equal(
    synchronized.standardsConformance,
    "schema-level-conformant-id-change"
  );

  const negative = traces[2];
  assert.notEqual(negative.frames[1].stationId, negative.frames[2].stationId);
  assert.equal(negative.frames[1].objectId, negative.frames[2].objectId);
  assert.equal(negative.frames[1].sensorId, negative.frames[2].sensorId);
  assert.equal(
    negative.standardsConformance,
    "intentional-incomplete-rotation-negative-control"
  );
});

test("receiver-visible trace frames contain no old-new identity oracle", () => {
  const allowed = ["objectId", "sensorId", "stationId", "timeMs", "xCm"];
  const forbidden = [
    "actorId",
    "cavId",
    "newObjectId",
    "newStationId",
    "oldNewMap",
    "oldObjectId",
    "oldStationId",
    "truthTrackId",
  ];

  for (const trace of buildTraceContract()) {
    for (const frame of trace.frames) {
      assert.deepEqual(Object.keys(frame).sort(), allowed);
      for (const field of forbidden) {
        assert.equal(field in frame, false, `${trace.id} leaked ${field}`);
      }
    }
  }
});

test("deterministic official semantics expose immediate residuals after synchronized rotation", () => {
  const traces = buildTraceContract();
  const observed = traces.map(simulateOfficialReceiverSemantics);
  assert.deepEqual(observed, deterministicExpectedResults());

  assert.deepEqual(observed[0], {
    traceId: "no-rotation",
    framesProcessed: 4,
    cacheSenderShards: 1,
    cacheMappings: 1,
    staleCacheMappings: 0,
    ldmCardinality: 1,
    ldmIds: [10],
    duplicateRecords: 0,
    ghostRecords: 0,
    missingObjects: 0,
    hardReset: {
      applied: false,
      newSenderShardStarted: false,
      oldSenderShardRetained: false,
      oldMappingsRetained: false,
    },
  });

  assert.equal(observed[1].cacheSenderShards, 2);
  assert.equal(observed[1].cacheMappings, 2);
  assert.equal(observed[1].staleCacheMappings, 1);
  assert.deepEqual(observed[1].ldmIds, [10, 77]);
  assert.equal(observed[1].duplicateRecords, 1);
  assert.equal(observed[1].ghostRecords, 1);
  assert.equal(observed[1].missingObjects, 0);
  assert.deepEqual(observed[1].hardReset, {
    applied: false,
    newSenderShardStarted: true,
    oldSenderShardRetained: true,
    oldMappingsRetained: true,
  });

  assert.deepEqual(observed[2].ldmIds, [1, 10]);
  assert.equal(observed[2].duplicateRecords, 1);
  assert.equal(observed[2].ghostRecords, 1);
});

test("official extraction ranges name the receiver map and LDM methods actually executed", () => {
  assert.deepEqual(
    OFFICIAL_RANGES.flatMap((range) => range.functions),
    [
      "cooperativePerception::receiveCPM",
      "LDM::insert",
      "LDM::lookup",
      "LDM::getAllIDs",
    ]
  );
  assert.ok(OFFICIAL_RANGES.every((range) => range.start <= range.end));
  assert.ok(
    OFFICIAL_RANGES.every(
      (range) => range.mode === "compiled-and-executed-exact-method-body"
    )
  );
});

test("execution gate records the fixed asset, required evidence, controls, hashes, and revise verdict", () => {
  const audit = JSON.parse(readFileSync(resolve(ROOT, DEFAULT_AUDIT_PATH), "utf8"));
  const required = [
    "fixedCommit",
    "environment",
    "buildCommands",
    "exactOfficialFilesAndLines",
    "executedOfficialCode",
    "traceContract",
    "results",
    "controls",
    "limitations",
    "hashes",
    "verdict",
    "nextActions",
  ];
  for (const field of required) {
    assert.ok(field in audit, `missing ${field}`);
  }

  assert.equal(audit.candidateId, CANDIDATE_ID);
  assert.equal(audit.fixedCommit.commit, FIXED_COMMIT);
  assert.deepEqual(audit.fixedCommit.recursiveSubmoduleStatus, []);
  assert.equal(audit.verdict, "revise");
  assert.equal(audit.traceContract.conformityChecks.oldNewOracleProvidedToReceiver, false);
  assert.equal(audit.traceContract.conformityChecks.wireEncodingValidated, false);
  assert.equal(audit.results.regressionModelMatched, true);
  assert.deepEqual(audit.results.observed, deterministicExpectedResults());
  assert.equal(audit.executedOfficialCode.compiledAndExecuted.length, 4);
  assert.ok(audit.executedOfficialCode.staticallyAuditedOnly.length >= 4);
  assert.match(
    audit.buildCommands[2].outcome,
    /OpenCVConfig\.cmake\/opencv-config\.cmake not found/
  );
  assert.equal(
    audit.hashes.repositoryFiles[
      "scripts/idea-pilots/pseudonym-cache-execution-v8.mjs"
    ],
    sha256File("scripts/idea-pilots/pseudonym-cache-execution-v8.mjs")
  );
  assert.equal(
    audit.hashes.repositoryFiles["test/pseudonym-cache-execution-v8.test.mjs"],
    sha256File("test/pseudonym-cache-execution-v8.test.mjs")
  );
});
