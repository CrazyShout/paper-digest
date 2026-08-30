import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORY_COVERAGE_SNAPSHOT_ALGORITHM,
  categoryCoverageSnapshot,
  categoryCoverageSnapshotFingerprint
} from "../src/lib/digest-audit.js";

function fixture() {
  return {
    queryOccurrences: 3,
    uniqueRecords: 2,
    screenedCandidates: 1,
    screenedOut: 1,
    snapshotAlgorithm: CATEGORY_COVERAGE_SNAPSHOT_ALGORITHM,
    runs: [
      {
        category: "cs.RO",
        searchQuery: "cat:cs.RO",
        resultCount: 2,
        resultIds: ["arxiv:2", "arxiv:1"]
      },
      {
        category: "cs.CV",
        searchQuery: "cat:cs.CV",
        resultCount: 1,
        resultIds: ["arxiv:1"]
      }
    ]
  };
}

test("category coverage fingerprint has a fixed, minimal hash-input contract", () => {
  const coverage = fixture();
  assert.deepEqual(categoryCoverageSnapshot(coverage), {
    schemaVersion: 1,
    queryOccurrences: 3,
    uniqueRecords: 2,
    runs: [
      {
        category: "cs.RO",
        searchQuery: "cat:cs.RO",
        resultCount: 2,
        resultIds: ["arxiv:2", "arxiv:1"]
      },
      {
        category: "cs.CV",
        searchQuery: "cat:cs.CV",
        resultCount: 1,
        resultIds: ["arxiv:1"]
      }
    ]
  });
  assert.match(categoryCoverageSnapshotFingerprint(coverage), /^[0-9a-f]{64}$/);
});

test("category coverage fingerprint ignores display metadata but binds raw retrieval evidence", () => {
  const coverage = fixture();
  const fingerprint = categoryCoverageSnapshotFingerprint(coverage);

  assert.equal(
    categoryCoverageSnapshotFingerprint({ ...coverage, screeningRule: "updated prose" }),
    fingerprint
  );

  const changed = structuredClone(coverage);
  changed.runs[0].resultIds[0] = "arxiv:3";
  assert.notEqual(categoryCoverageSnapshotFingerprint(changed), fingerprint);
});
