import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = new URL("../", import.meta.url);

test("every direction-level final candidate pool passes the shared audit contract", async () => {
  const pools = [
    "content/idea-audits/cooperative-autonomous-driving-rescue-final-jury-v13.json",
    "content/idea-audits/cooperative-driving-second-candidate-rescue-v14.json",
    "content/idea-audits/agentic-driving-rescue-final-jury-v5.json",
    "content/idea-audits/3d-reconstruction-final-candidate-pool-v1.json",
    "content/idea-audits/autonomous-driving-security-final-candidate-pool-v1.json",
    "content/idea-audits/autonomous-driving-testing-final-candidate-pool-v1.json",
    "content/idea-audits/end-to-end-autonomous-driving-final-candidate-pool-v1.json",
    "content/idea-audits/world-models-final-candidate-pool-v1.json"
  ];
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/validate-idea-audit-pool.mjs", ...pools],
    { cwd: ROOT }
  );

  for (const pool of pools) {
    assert.match(stdout, new RegExp(`OK ${pool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});
