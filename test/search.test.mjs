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

test("the compressed index stays within the transfer budget and retains full reports", async () => {
  const index = await getNotebookSearchIndex("/paper-digest/");
  const records = prepareSearchRecords(index);
  const serialized = JSON.stringify(index);
  const compressed = gzipSync(serialized, { level: 9 });
  assert.ok(compressed.length < 1_600_000);
  assert.ok(compressed.length < Buffer.byteLength(serialized) * 0.6);
  assert.equal(searchRecords(records, "DA-WAM")[0].id, "paper-da-wam-decision-aligned-world-model");
  assert.ok(searchRecords(records, "打乱对应关系", "paper")
    .some((item) => item.id === "paper-da-wam-decision-aligned-world-model"));
  const vla = searchRecords(records, "VLA", "paper");
  assert.ok(vla.some((item) => item.id === "paper-vla-end-to-end-driving"));
  assert.ok(vla.every((item) => item.kind === "paper"));
  assert.equal(index.filter((item) => item.id.startsWith("idea-") && item.id !== "idea-center").length, 26);
  assert.ok(index.every((item) => !item.content.includes("snapshotFingerprint")));
  assert.equal(new Set(index.map((item) => item.url)).size, index.length);
});
