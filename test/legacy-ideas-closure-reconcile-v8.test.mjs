import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { applyCorrections } from "../scripts/idea-pilots/reconcile-legacy-ideas-closure-v8.mjs";

const ROOT = new URL("../", import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, ROOT), "utf8"));
}

test("legacy closure reconciles every query occurrence and source family", async () => {
  const closure = await readJson(
    "content/idea-audits/cooperative-autonomous-driving-legacy-ideas-closure-v8.json"
  );
  const resultTotal = closure.searchAudit.queryRuns.reduce(
    (sum, run) => sum + run.resultCount,
    0
  );
  const occurrenceTotal = closure.searchAudit.candidateLedger.reduce(
    (sum, candidate) => sum + candidate.occurrenceCount,
    0
  );

  assert.equal(resultTotal, occurrenceTotal);
  for (const candidate of closure.searchAudit.candidateLedger) {
    assert.equal(candidate.occurrenceCount, candidate.queryFamilies.length);
  }
  const sourceCounts = new Map();
  for (const source of closure.sourceLedger) {
    sourceCounts.set(source.sourceFamily, (sourceCounts.get(source.sourceFamily) || 0) + 1);
  }
  for (const attempt of closure.searchAudit.sourceAttempts) {
    assert.equal(attempt.acceptedCount, sourceCounts.get(attempt.family) || 0);
  }
});

test("formal records retain arXiv links and corrected coverage boundaries", async () => {
  const closure = await readJson(
    "content/idea-audits/cooperative-autonomous-driving-legacy-ideas-closure-v8.json"
  );
  const coopertrim = closure.sourceLedger.find(
    (source) => source.canonicalId === "openreview:8NgKNuHRiH"
  );
  const fusionOrConfusion = closure.sourceLedger.find(
    (source) => source.canonicalId === "doi:10.1109/cscn67557.2025.11230764"
  );

  assert.equal(coopertrim.url, "https://openreview.net/forum?id=8NgKNuHRiH");
  assert.ok(coopertrim.links.some((link) => link.url === "https://arxiv.org/abs/2602.13287"));
  assert.ok(fusionOrConfusion.links.some(
    (link) => link.url === "https://arxiv.org/abs/2607.05889"
  ));
  assert.equal(closure.ideas[1].nearestWorks[0].coverage, "partial");
  assert.equal(closure.ideas[3].nearestWorks[0].coverage, "partial");
  assert.equal(closure.ideas[4].nearestWorks[1].coverage, "partial");
});

test("correction application is idempotent on the checked artifact", async () => {
  const [closure, audit] = await Promise.all([
    readJson("content/idea-audits/cooperative-autonomous-driving-legacy-ideas-closure-v8.json"),
    readJson("content/idea-audits/cooperative-autonomous-driving-legacy-ideas-citation-audit-v8.json")
  ]);
  const before = JSON.stringify(closure);

  applyCorrections(closure, audit);

  assert.equal(JSON.stringify(closure), before);
  assert.equal(closure.correctionAudit.researchDecisionsChanged, false);
});
