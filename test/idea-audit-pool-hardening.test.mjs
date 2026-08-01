import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { validateIdeaAuditPool } from "../scripts/validate-idea-audit-pool.mjs";

const execFileAsync = promisify(execFile);
const VALIDATOR_PATH = fileURLToPath(new URL("../scripts/validate-idea-audit-pool.mjs", import.meta.url));
const NOW = "2026-08-01T04:00:00Z";
const RUNTIME_AGENT_ID = "019fbb59-819c-7a41-bd6a-b7a373c0034f";

function makeWorkflow() {
  return {
    requirements: {
      minQueryFamilies: 2,
      minVerifiedReferences: 4,
      minRecentReferences: 2,
      recentSinceYear: 2024,
      minLocalReferences: 1,
      minExternalReferences: 2,
      minOfficialCodeOrDataAssets: 2,
      minGeneratedCandidates: 3,
      minRejectedCandidates: 2,
      maxPublishedIdeas: 2
    }
  };
}

function makePool() {
  return {
    searchedAt: NOW,
    reviewerAgentId: RUNTIME_AGENT_ID,
    searchAudit: {
      queryRuns: [
        {
          familyId: "local-corpus",
          query: "rg cooperative content/papers",
          scopeRationale: "Reopen local evidence and known limitations.",
          source: "local-corpus",
          executedAt: NOW,
          resultCount: 1,
          canonicalIdSample: ["local:paper-1"]
        },
        {
          familyId: "recent-primary",
          queries: ["site:arxiv.org autonomous driving 2026"],
          focus: "Check recent direct competitors in primary sources.",
          sourceFamilies: ["arxiv"],
          executedAt: NOW,
          resultCount: 3,
          resultIdSample: ["arxiv:2601.00001", "arxiv:2601.00002"]
        }
      ],
      sourceAttempts: [
        {
          sourceFamily: "local-corpus",
          attempted: true,
          result: "Local corpus searched with ripgrep."
        },
        {
          sourceFamily: "arxiv",
          attempted: true,
          result: "arXiv primary records reopened."
        }
      ]
    },
    verifiedReferences: [
      {
        canonicalId: "local:paper-1",
        title: "Local Paper One",
        url: "https://example.edu/local-paper-1",
        year: 2025,
        provenance: "local-corpus",
        localPaperId: "paper-1",
        queryFamilyIds: ["local-corpus"]
      },
      {
        canonicalId: "arxiv:2601.00001",
        title: "External Paper One",
        url: "https://arxiv.org/abs/2601.00001",
        year: 2026,
        sourceFamily: "arxiv",
        queryFamilyIds: ["recent-primary"]
      },
      {
        canonicalId: "arxiv:2601.00002",
        title: "External Paper Two",
        url: "https://arxiv.org/abs/2601.00002",
        year: 2026,
        sourceOrigin: "arxiv"
      },
      {
        canonicalId: "doi:10.1000/example",
        title: "External Paper Three",
        url: "https://doi.org/10.1000/example",
        year: 2023,
        sourceOrigin: "external-primary-sources"
      }
    ],
    assetChecks: [
      {
        type: "code",
        name: "Official implementation",
        url: "https://github.com/example/project/tree/0123456789abcdef",
        fixedCommit: "0123456789abcdef",
        availabilityNote: "Public repository; entrypoint inspected but not executed."
      },
      {
        assetType: "dataset",
        name: "Official dataset",
        officialUrl: "https://example.edu/dataset/v1",
        version: "v1",
        status: "Public download manifest verified."
      }
    ],
    candidateLedger: [
      { candidateId: "idea-a", title: "Idea A", disposition: "shortlist" },
      { candidateId: "idea-b", title: "Idea B", disposition: "rejected" },
      { candidateId: "idea-c", title: "Idea C", disposition: "rejected" }
    ],
    shortlist: [{ candidateId: "idea-a" }],
    rejected: [
      { candidateId: "idea-b", reasons: ["Direct competitor already covers the claim."] },
      { candidateId: "idea-c", reason: "No feasible oracle." }
    ],
    conclusion: "One candidate remains for blind review."
  };
}

test("strict pool validator accepts a complete synthetic audit and returns agent provenance", () => {
  const result = validateIdeaAuditPool(makePool(), makeWorkflow(), "synthetic-valid.json");
  assert.equal(result.queries, 2);
  assert.equal(result.references, 4);
  assert.equal(result.recentReferences, 3);
  assert.equal(result.localReferences, 1);
  assert.equal(result.externalReferences, 3);
  assert.deepEqual(result.agentLedger, [
    { agentId: RUNTIME_AGENT_ID, roles: ["pool-reviewer"] }
  ]);
});

test("structured conclusions preserve richer audit summaries", () => {
  const pool = makePool();
  pool.conclusion = {
    summary: "One candidate remains after explicit evidence and feasibility screening.",
    nextGate: "Freeze its dossier before any blind evaluation."
  };
  assert.equal(validateIdeaAuditPool(pool, makeWorkflow()).shortlisted, 1);
});

test("QA-style nearly empty audit cannot satisfy the query contract", () => {
  const pool = makePool();
  pool.searchAudit.queryRuns = [
    { familyId: "empty-one" },
    { familyId: "empty-two" }
  ];
  pool.verifiedReferences = Array.from({ length: 4 }, (_, index) => ({
    title: `Synthetic ${index}`,
    url: `https://example.com/${index}`,
    year: 2026,
    sourceOrigin: "external-primary-sources"
  }));
  assert.throws(
    () => validateIdeaAuditPool(pool, makeWorkflow(), "synthetic-empty.json"),
    /non-empty actual query/
  );
});

test("every query run needs its own time, result count, and reproducibility evidence", () => {
  const missingTime = makePool();
  delete missingTime.searchAudit.queryRuns[0].executedAt;
  assert.throws(
    () => validateIdeaAuditPool(missingTime, makeWorkflow(), "missing-query-time.json"),
    /queryRuns\[0\]\.executedAt is required/
  );

  const missingCount = makePool();
  delete missingCount.searchAudit.queryRuns[0].resultCount;
  assert.throws(
    () => validateIdeaAuditPool(missingCount, makeWorkflow(), "missing-result-count.json"),
    /resultCount must be a non-negative integer/
  );

  const missingReproducibility = makePool();
  delete missingReproducibility.searchAudit.queryRuns[0].canonicalIdSample;
  assert.throws(
    () => validateIdeaAuditPool(
      missingReproducibility,
      makeWorkflow(),
      "missing-query-evidence.json"
    ),
    /canonical ID sample or reproducible retrieval metadata/
  );
});

test("references require non-empty unique canonical IDs and source provenance", () => {
  const emptyId = makePool();
  emptyId.verifiedReferences[0].canonicalId = "";
  assert.throws(
    () => validateIdeaAuditPool(emptyId, makeWorkflow(), "empty-id.json"),
    /canonicalId is required/
  );

  const duplicateId = makePool();
  duplicateId.verifiedReferences[1].canonicalId = "LOCAL:PAPER-1";
  assert.throws(
    () => validateIdeaAuditPool(duplicateId, makeWorkflow(), "duplicate-id.json"),
    /canonical reference IDs must be unique/
  );

  const missingOrigin = makePool();
  delete missingOrigin.verifiedReferences[0].provenance;
  assert.throws(
    () => validateIdeaAuditPool(missingOrigin, makeWorkflow(), "missing-origin.json"),
    /needs sourceFamily or sourceOrigin/
  );
});

test("source-attempt coverage and evidence quotas are enforced", () => {
  const missingAttempt = makePool();
  missingAttempt.searchAudit.sourceAttempts = missingAttempt.searchAudit.sourceAttempts
    .filter((attempt) => attempt.sourceFamily !== "arxiv");
  assert.throws(
    () => validateIdeaAuditPool(missingAttempt, makeWorkflow(), "missing-attempt.json"),
    /missing from searchAudit\.sourceAttempts/
  );

  const insufficientLocal = makePool();
  insufficientLocal.verifiedReferences[0].provenance = "arxiv";
  delete insufficientLocal.verifiedReferences[0].localPaperId;
  assert.throws(
    () => validateIdeaAuditPool(insufficientLocal, makeWorkflow(), "no-local.json"),
    /expected at least 1 local references/
  );
});

test("assets require an explicit type, HTTPS URL, and usability explanation", () => {
  const missingType = makePool();
  delete missingType.assetChecks[0].type;
  assert.throws(
    () => validateIdeaAuditPool(missingType, makeWorkflow(), "asset-type.json"),
    /assetChecks\[0\]\.type is required/
  );

  const missingUrl = makePool();
  delete missingUrl.assetChecks[0].url;
  assert.throws(
    () => validateIdeaAuditPool(missingUrl, makeWorkflow(), "asset-url.json"),
    /assetChecks\[0\]\.url must be HTTPS/
  );

  const missingAvailability = makePool();
  delete missingAvailability.assetChecks[0].availabilityNote;
  assert.throws(
    () => validateIdeaAuditPool(missingAvailability, makeWorkflow(), "asset-availability.json"),
    /availability or usability explanation/
  );
});

test("agent IDs and all audit timestamps reject labels and future dates", () => {
  const labeledAgent = makePool();
  labeledAgent.reviewerAgentId = "codex-main-reviewer";
  assert.throws(
    () => validateIdeaAuditPool(labeledAgent, makeWorkflow(), "agent-label.json"),
    /must be a runtime UUID/
  );

  const futurePool = makePool();
  futurePool.searchedAt = "2999-01-01T00:00:00Z";
  assert.throws(
    () => validateIdeaAuditPool(futurePool, makeWorkflow(), "future-pool.json"),
    /cannot be future-dated/
  );

  const futureRun = makePool();
  futureRun.searchAudit.queryRuns[1].executedAt = "2999-01-01T00:00:00Z";
  assert.throws(
    () => validateIdeaAuditPool(futureRun, makeWorkflow(), "future-run.json"),
    /queryRuns\[1\]\.executedAt cannot be future-dated/
  );

  const hiddenFutureReview = makePool();
  hiddenFutureReview.reviewedAt = "2999-01-01T00:00:00Z";
  assert.throws(
    () => validateIdeaAuditPool(hiddenFutureReview, makeWorkflow(), "future-review.json"),
    /reviewedAt cannot be future-dated/
  );
});

test("an explicitly unattempted source cannot satisfy source coverage", () => {
  const pool = makePool();
  pool.searchAudit.sourceAttempts[1].attempted = false;
  assert.throws(
    () => validateIdeaAuditPool(pool, makeWorkflow(), "unattempted-source.json"),
    /missing from searchAudit\.sourceAttempts/
  );
});

test("explicit retrieval and selection roles are validated and returned without inventing separation", () => {
  const pool = makePool();
  pool.retrievalAgentIds = ["019fbb5e-4b60-7242-a1eb-2f6ad4b9d965"];
  pool.selectionAgentId = "019fbb82-b5c1-7870-8fe0-e437951bfa7f";
  const result = validateIdeaAuditPool(pool, makeWorkflow(), "agent-roles.json");
  assert.deepEqual(result.agentLedger, [
    { agentId: RUNTIME_AGENT_ID, roles: ["pool-reviewer"] },
    { agentId: "019fbb5e-4b60-7242-a1eb-2f6ad4b9d965", roles: ["retrieval"] },
    { agentId: "019fbb82-b5c1-7870-8fe0-e437951bfa7f", roles: ["selection"] }
  ]);

  pool.selectionAgentId = "named-selector";
  assert.throws(
    () => validateIdeaAuditPool(pool, makeWorkflow(), "invalid-agent-role.json"),
    /selectionAgentId must be a runtime UUID/
  );
});

test("CLI rejects an audit symlink that escapes the audit directory", async (t) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "idea-audit-pool-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  await mkdir(path.join(temporaryRoot, "config"), { recursive: true });
  await mkdir(path.join(temporaryRoot, "content", "idea-audits"), { recursive: true });
  await writeFile(
    path.join(temporaryRoot, "config", "idea-exploration-workflow.json"),
    JSON.stringify(makeWorkflow()),
    "utf8"
  );
  const outsidePath = path.join(temporaryRoot, "outside.json");
  await writeFile(outsidePath, JSON.stringify(makePool()), "utf8");
  const linkPath = path.join(temporaryRoot, "content", "idea-audits", "escape.json");
  try {
    await symlink(outsidePath, linkPath);
  } catch (error) {
    if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) {
      t.skip(`symbolic links unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [VALIDATOR_PATH, "content/idea-audits/escape.json"],
      { cwd: temporaryRoot }
    ),
    (error) => {
      assert.notEqual(error.code, 0);
      assert.match(error.stderr, /must not be a symbolic link|resolved audit path escapes/);
      return true;
    }
  );
});
