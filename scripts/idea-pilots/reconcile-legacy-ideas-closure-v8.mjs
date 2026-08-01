#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TARGET_PATH = path.join(
  ROOT,
  "content/idea-audits/cooperative-autonomous-driving-legacy-ideas-closure-v8.json"
);
const REVIEW_PATH = path.join(
  ROOT,
  "content/idea-audits/cooperative-autonomous-driving-legacy-ideas-citation-audit-v8.json"
);
const REVIEW_RELATIVE_PATH = path.relative(ROOT, REVIEW_PATH);

function parsePath(jsonPath) {
  assert.match(jsonPath, /^\$\./, `Unsupported JSON path: ${jsonPath}`);
  return [...jsonPath.slice(2).matchAll(/(?:^|\.)([^.[\]]+)|\[(\d+)\]/g)].map(
    (match) => match[1] ?? Number(match[2])
  );
}

function readPath(value, jsonPath) {
  return parsePath(jsonPath).reduce((current, key) => current[key], value);
}

function writePath(value, jsonPath, replacement) {
  const keys = parsePath(jsonPath);
  const finalKey = keys.pop();
  const parent = keys.reduce((current, key) => current[key], value);
  parent[finalKey] = structuredClone(replacement);
}

function applyExactChange(target, change) {
  const paths = change.paths || [change.path];
  for (const jsonPath of paths) {
    assert.deepEqual(
      readPath(target, jsonPath),
      change.currentValue,
      `${jsonPath} drifted before the audited correction was applied`
    );
    writePath(target, jsonPath, change.requiredValue);
  }
}

function reconcileCounts(target) {
  const familyCounts = new Map(
    target.searchAudit.queryRuns.map((run) => [run.id, 0])
  );
  let occurrenceTotal = 0;

  for (const candidate of target.searchAudit.candidateLedger) {
    assert.equal(
      candidate.occurrenceCount,
      candidate.queryFamilies.length,
      `${candidate.canonicalId}: occurrenceCount does not match queryFamilies`
    );
    occurrenceTotal += candidate.occurrenceCount;
    for (const family of candidate.queryFamilies) {
      assert.ok(familyCounts.has(family), `${candidate.canonicalId}: unknown query family ${family}`);
      familyCounts.set(family, familyCounts.get(family) + 1);
    }
  }

  for (const run of target.searchAudit.queryRuns) {
    run.resultCount = familyCounts.get(run.id);
  }
  const resultTotal = target.searchAudit.queryRuns.reduce(
    (sum, run) => sum + run.resultCount,
    0
  );
  assert.equal(resultTotal, occurrenceTotal, "Query and candidate occurrence totals diverge");

  const sourceCounts = new Map();
  for (const source of target.sourceLedger) {
    sourceCounts.set(source.sourceFamily, (sourceCounts.get(source.sourceFamily) || 0) + 1);
  }
  for (const attempt of target.searchAudit.sourceAttempts) {
    attempt.acceptedCount = sourceCounts.get(attempt.family) || 0;
  }

  return { occurrenceTotal, resultTotal };
}

function verifyCorrected(target) {
  const canonicalIds = target.sourceLedger.map((source) => source.canonicalId.toLowerCase());
  assert.equal(new Set(canonicalIds).size, canonicalIds.length, "Source canonical IDs are not unique");
  const { occurrenceTotal, resultTotal } = reconcileCounts(target);
  assert.equal(occurrenceTotal, resultTotal);
  assert.equal(target.searchAudit.sourceAttempts[1].acceptedCount, 14);
  assert.equal(target.searchAudit.sourceAttempts[2].acceptedCount, 22);
  assert.equal(target.sourceLedger[2].canonicalId, "openreview:8NgKNuHRiH");
  assert.equal(
    target.sourceLedger[33].canonicalId,
    "doi:10.1109/cscn67557.2025.11230764"
  );
  return { occurrenceTotal, resultTotal };
}

export function applyCorrections(target, review) {
  if (target.correctionAudit?.auditPath === REVIEW_RELATIVE_PATH) {
    verifyCorrected(target);
    return target;
  }

  assert.equal(review.verdict.status, "revise");
  assert.equal(review.verdict.researchDecisionsChanged, false);

  for (const source of review.sourceCorrections) {
    for (const change of source.changes) applyExactChange(target, change);
  }
  for (const correction of review.claimCorrections) applyExactChange(target, correction);
  for (const change of review.countReconciliation.assetRunCorrection.changes) {
    applyExactChange(target, change);
  }

  const counts = reconcileCounts(target);
  target.correctionAudit = {
    auditPath: REVIEW_RELATIVE_PATH,
    appliedAt: "2026-07-31T23:37:00+08:00",
    researchDecisionsChanged: false,
    correctedQueryRunCount: review.countReconciliation.familyMismatches.length + 1,
    correctedSourceRecords: review.sourceCorrections.length - 1,
    correctedClaimRecords: review.claimCorrections.length,
    occurrenceTotal: counts.occurrenceTotal
  };
  verifyCorrected(target);
  return target;
}

async function main() {
  const [target, review] = await Promise.all([
    readFile(TARGET_PATH, "utf8").then(JSON.parse),
    readFile(REVIEW_PATH, "utf8").then(JSON.parse)
  ]);
  const corrected = applyCorrections(target, review);

  if (process.argv.includes("--write")) {
    await writeFile(TARGET_PATH, `${JSON.stringify(corrected, null, 2)}\n`);
    console.log(`Corrected ${path.relative(ROOT, TARGET_PATH)}`);
  } else {
    console.log(`Verified ${path.relative(ROOT, TARGET_PATH)}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
