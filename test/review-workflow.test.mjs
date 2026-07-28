import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPrompt,
  isExpectedCommit,
  isoDateInTimeZone,
  treesMatch
} from "../scripts/review-workflow.mjs";
import { reviewSnapshotFingerprint } from "../src/lib/review-fingerprint.js";

const COMMIT = "53562a7c64cc1d55946cba1fb8a8416137143d14";
const REQUIRED_QUALITY_CHECKS = [
  "query-family-alignment",
  "source-fanout-trace",
  "raw-hit-candidate-separation",
  "local-candidate-closure",
  "canonical-id-casefold",
  "single-count-schema",
  "publication-status-primary-source",
  "formal-arxiv-link-retention",
  "physical-evidence-boundary",
  "independent-review-current-snapshot"
];

test("review workflow rejects upstream commit drift", () => {
  assert.equal(isExpectedCommit(COMMIT, COMMIT), true);
  assert.equal(
    isExpectedCommit("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", COMMIT),
    false
  );
  assert.equal(isExpectedCommit("not-a-commit", COMMIT), false);
});

test("review workflow dates use the Shanghai calendar day", () => {
  assert.equal(
    isoDateInTimeZone(new Date("2026-07-27T16:30:00Z")),
    "2026-07-28"
  );
});

test("review workflow detects drift in installed skill trees", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "paper-digest-skill-test-"));
  const source = path.join(root, "source");
  const installed = path.join(root, "installed");
  await Promise.all([
    mkdir(path.join(source, "references"), { recursive: true }),
    mkdir(path.join(installed, "references"), { recursive: true })
  ]);
  await Promise.all([
    writeFile(path.join(source, "SKILL.md"), "same\n"),
    writeFile(path.join(installed, "SKILL.md"), "same\n"),
    writeFile(path.join(source, "references", "policy.md"), "v1\n"),
    writeFile(path.join(installed, "references", "policy.md"), "v1\n")
  ]);

  assert.equal(await treesMatch(source, installed), true);
  await writeFile(path.join(installed, "references", "policy.md"), "drift\n");
  assert.equal(await treesMatch(source, installed), false);
});

test("review prompt uses the selected runtime skill root", () => {
  const workflow = {
    requiredSkills: [
      { name: "research-lit", scope: "all" },
      { name: "citation-audit", scope: "all" }
    ],
    requiredReferences: ["acceptance-gate.md"],
    directions: {
      "world-models": {
        profile: "general",
        queryFamilies: ["world models"]
      }
    },
    requirements: {
      minQueryFamilies: 1,
      minSourceFamilies: 1,
      minReferences: 1,
      recentSinceYear: 2024,
      minRecentReferences: 1,
      foundationalBeforeYear: 2024,
      minFoundationalReferences: 1,
      minFormalReferences: 1,
      minSurveyOrTutorialReferences: 1,
      minLocalReferences: 1,
      minExternalReferences: 1,
      minExcludedCandidates: 1,
      minQueryResultSamples: 1
    },
    qualityChecks: [
      {
        code: "query-family-alignment",
        instruction: "Check query-family alignment."
      }
    ]
  };
  const interest = { id: "world-models", label: "世界模型" };
  const review = { reviewedAt: "2026-07-28" };
  const prompt = buildPrompt(workflow, interest, review, "claude");

  assert.match(prompt, /~\/\.claude\/skills\/research-lit\/SKILL\.md/);
  assert.doesNotMatch(prompt, /~\/\.codex\/skills/);
  assert.match(prompt, /queryRuns/);
  assert.match(prompt, /retainedCanonicalIds/);
  assert.match(prompt, /excludedCandidates/);
  assert.match(prompt, /scopeRationale/);
  assert.match(prompt, /sourceAttempts/);
  assert.match(prompt, /candidateLocalPaperIds/);
  assert.match(prompt, /candidateLedger/);
  assert.match(prompt, /queryFamilies 与 occurrences/);
  assert.match(prompt, /正式出版页与 arXiv/);
  assert.match(prompt, /snapshotFingerprint/);
  assert.match(prompt, /query-family-alignment/);
  assert.match(prompt, /review-quality-checklist\.md/);
});

test("review workflow keeps every mandatory quality gate", async () => {
  const workflow = JSON.parse(
    await readFile("config/literature-review-workflow.json", "utf8")
  );
  const actual = new Set(workflow.qualityChecks.map((check) => check.code));

  for (const code of REQUIRED_QUALITY_CHECKS) {
    assert.ok(actual.has(code), code);
  }
});

test("independent review fingerprints bind the reviewed content snapshot", () => {
  const review = {
    id: "world-models",
    sections: [{ body: "current" }],
    searchAudit: {
      queryRuns: [{ query: "world model" }],
      independentReview: {
        status: "pending",
        reviewers: 0,
        rounds: 0
      }
    }
  };
  const fingerprint = reviewSnapshotFingerprint(review);
  const metadataOnly = structuredClone(review);
  metadataOnly.searchAudit.independentReview = {
    status: "passed",
    reviewers: 1,
    rounds: 2,
    snapshotFingerprint: fingerprint
  };
  const changed = structuredClone(review);
  changed.sections[0].body = "changed";

  assert.equal(reviewSnapshotFingerprint(metadataOnly), fingerprint);
  assert.notEqual(reviewSnapshotFingerprint(changed), fingerprint);
});
