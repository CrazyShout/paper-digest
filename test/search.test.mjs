import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { getNotebookSearchIndex } from "../src/lib/navigation.js";
import { prepareSearchRecords, searchRecords } from "../src/lib/search.js";

test("exact and prefix titles outrank incidental full-text mentions", () => {
  const records = prepareSearchRecords([
    { id: "overview", title: "Overview", content: "DA-WAM VLA", kind: "review" },
    { id: "report", title: "DA-WAM: Decision-Aligned Future Latents", kind: "paper" },
    { id: "exact", title: "DA-WAM", kind: "paper" }
  ]);
  assert.deepEqual(searchRecords(records, "ＤＡ－ＷＡＭ").map((item) => item.id), ["exact", "report", "overview"]);
});

test("search preserves every match for pagination and combines terms across fields", () => {
  const records = prepareSearchRecords(Array.from({ length: 40 }, (_, index) => ({
    id: String(index), title: `VLA paper ${index}`, content: "雷达场景 Alice", kind: "paper"
  })));
  assert.equal(searchRecords(records, "vla 雷达 alice").length, 40);
  assert.equal(searchRecords(records, "missing").length, 0);
  assert.equal(searchRecords(records, "vla", "review").length, 0);
  assert.equal(searchRecords(records, "", "paper").length, 40);
});

test("whole-word acronyms outrank partial title matches without dropping them", () => {
  const records = prepareSearchRecords([
    { id: "partial", title: "Study of driving", kind: "paper" },
    { id: "embedded", title: "A case study of sensing", kind: "paper" },
    { id: "dataset", title: "Spotting the Unexpected (STU): A LiDAR Dataset", kind: "paper" },
    { id: "later-word", title: "Study of STU", kind: "paper" },
    { id: "prefix", title: "STU dataset report", kind: "paper" }
  ]);
  assert.deepEqual(searchRecords(records, "ＳＴＵ").map((item) => item.id), [
    "prefix", "dataset", "later-word", "partial", "embedded"
  ]);
  const chinese = prepareSearchRecords([
    { id: "body", title: "场景分析", content: "自动驾驶", kind: "paper" },
    { id: "title", title: "自动驾驶研究", kind: "paper" }
  ]);
  assert.equal(searchRecords(chinese, "自动驾驶")[0].id, "title");
});

test("the compressed index stays within the transfer budget and retains full reports", async () => {
  const index = await getNotebookSearchIndex("/paper-digest/");
  const records = prepareSearchRecords(index);
  const serialized = JSON.stringify(index);
  const compressed = gzipSync(serialized, { level: 9 });
  assert.ok(compressed.length < 1_600_000);
  assert.ok(compressed.length < Buffer.byteLength(serialized) * 0.6);
  assert.equal(searchRecords(records, "DA-WAM")[0].id, "paper-da-wam-decision-aligned-world-model");
  assert.equal(searchRecords(records, "STU", "paper")[0].id, "paper-stu-road-anomaly-dataset");
  assert.ok(searchRecords(records, "打乱对应关系", "paper")
    .some((item) => item.id === "paper-da-wam-decision-aligned-world-model"));
  const vla = searchRecords(records, "VLA", "paper");
  assert.ok(vla.some((item) => item.id === "paper-vla-end-to-end-driving"));
  assert.ok(vla.every((item) => item.kind === "paper"));
  assert.equal(index.filter((item) => item.id.startsWith("idea-") && item.id !== "idea-center").length, 26);
  assert.ok(index.every((item) => !item.content.includes("snapshotFingerprint")));
  assert.equal(new Set(index.map((item) => item.url)).size, index.length);
});
