import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORY_COVERAGE_SNAPSHOT_ALGORITHM,
  categoryCoverageSnapshot,
  categoryCoverageSnapshotFingerprint,
  isDigestQueryEndpoint
} from "../src/lib/digest-audit.js";

test("digest queries preserve native tool and official API endpoints without inventing transport URLs", () => {
  for (const endpoint of ["web.run.search_query", "http://export.arxiv.org/api/query", "https://arxiv.org/list/cs.RO/2026-09"]) {
    assert.equal(isDigestQueryEndpoint(endpoint), true);
  }
  for (const endpoint of [undefined, "", "local snapshot", "web.run.unknown", "http://example.com/search", "http://export.arxiv.org.evil.test/api/query", "file:///tmp/results.json"]) {
    assert.equal(isDigestQueryEndpoint(endpoint), false);
  }
});

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
