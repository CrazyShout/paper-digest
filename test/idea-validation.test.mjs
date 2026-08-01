import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);
const execFileAsync = promisify(execFile);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, ROOT), "utf8"));
}

test("Idea publication contract is strict without leaking its score into reviewer prompts", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/idea-workflow.mjs",
      "prompt",
      "cooperative-autonomous-driving",
      "evaluate",
      "novelty-reviewer",
      "candidate-under-review"
    ],
    { cwd: new URL("../", import.meta.url) }
  );

  assert.equal(workflow.evaluation.publicationScore, 10);
  assert.doesNotMatch(stdout, /publicationScore|满分|10\s*分通过|通过阈值/);
});

test("strict Idea validation checks evidence provenance, reviewer independence, and fingerprints", async () => {
  const [script, packageJson] = await Promise.all([
    readFile(new URL("scripts/validate-idea-center.mjs", ROOT), "utf8"),
    readJson("package.json")
  ]);

  assert.match(script, /sourceOrigin === "external"/);
  assert.match(script, /agent IDs must be unique/);
  assert.match(script, /direction panel reviewer ledger/);
  assert.match(script, /Global reviewer must be independent/);
  assert.match(script, /reviewer report paths must be unique/);
  assert.match(script, /stored reviewer agent does not match/);
  assert.match(script, /must reopen at least two sources/);
  assert.match(script, /cannot be future-dated/);
  assert.match(script, /Global review must link a stored audit report/);
  assert.match(script, /must reopen every direction report exactly once/);
  assert.match(script, /Global reviewer used a stale/);
  assert.match(script, /primary HTTPS evidence across all directions/);
  assert.match(script, /ideaDirectionSnapshotFingerprint/);
  assert.match(script, /ideaSnapshotFingerprint/);
  assert.match(script, /ideaCenterSnapshotFingerprint/);
  assert.match(script, /validateIdeaDossier/);
  assert.match(script, /implementationPath/);
  assert.match(script, /strongBaselines/);
  assert.match(script, /metrics/);
  assert.match(script, /candidatePoolPaths/);
  assert.match(script, /Retrieval and blind-review agent identities must be disjoint/);
  assert.match(script, /completed direction audit needs at least two independent review reports/);
  assert.match(script, /dossierSnapshotFingerprint/);
  assert.match(script, /centerSnapshotFingerprint/);
  assert.match(script, /selectionReportPaths/);
  assert.match(script, /Unknown or missing explorationStatus/);
  assert.match(script, /continue-review/);
  assert.match(script, /reviewStatus=.*disagrees with gate/);
  assert.match(packageJson.scripts.validate, /validate-idea-center\.mjs/);
});
