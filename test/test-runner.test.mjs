import assert from "node:assert/strict";
import test from "node:test";

import { createTestPlan } from "../scripts/run-tests.mjs";

const files = [
  "test/clock-age-identifiability-v6.test.mjs",
  "test/cooperscene-converter-smoke.test.mjs",
  "test/release-population-preflight-v7.test.mjs",
  "test/portable.test.mjs"
];

test("test planning runs every file when provenance prerequisites are present", () => {
  const plan = createTestPlan(files, {
    clockRuntimeMatches: true,
    converterPythonAvailable: true,
    releasePreflightInputsAvailable: true
  });

  assert.deepEqual(plan.general, [...files].sort());
  assert.deepEqual(plan.isolated, []);
  assert.deepEqual(plan.omitted, []);
});

test("test planning isolates runtime-bound checks and omits missing external assets", () => {
  const plan = createTestPlan(files, {
    clockRuntimeMatches: false,
    converterPythonAvailable: false,
    releasePreflightInputsAvailable: false
  });

  assert.deepEqual(plan.general, ["test/portable.test.mjs"]);
  assert.deepEqual(
    plan.isolated.map((item) => item.file),
    [
      "test/clock-age-identifiability-v6.test.mjs",
      "test/cooperscene-converter-smoke.test.mjs"
    ]
  );
  assert.deepEqual(plan.omitted, [{
    file: "test/release-population-preflight-v7.test.mjs",
    reason: "content-addressed released pickle is an external local audit asset"
  }]);
});
