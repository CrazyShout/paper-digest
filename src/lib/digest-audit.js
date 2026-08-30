import { createHash } from "node:crypto";

export const CATEGORY_COVERAGE_SNAPSHOT_ALGORITHM = "sha256-canonical-json-v1";

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }

  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`);
}

export function categoryCoverageSnapshot(coverage) {
  return {
    schemaVersion: 1,
    queryOccurrences: coverage?.queryOccurrences,
    uniqueRecords: coverage?.uniqueRecords,
    runs: (coverage?.runs || []).map((run) => ({
      category: run?.category,
      searchQuery: run?.searchQuery,
      resultCount: run?.resultCount,
      resultIds: run?.resultIds
    }))
  };
}

export function categoryCoverageSnapshotFingerprint(coverage) {
  return createHash("sha256")
    .update(canonicalJson(categoryCoverageSnapshot(coverage)))
    .digest("hex");
}
