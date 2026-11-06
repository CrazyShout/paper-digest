import assert from "node:assert/strict";
import test from "node:test";
import { getNotebookData, getNotebookSearchIndex } from "../src/lib/navigation.js";
import { buildDirectionReading, readerFeedbackUrl, validateDirectionReading } from "../src/lib/direction-reading.js";

test("all directions retain primary and related papers in issue order, including a quiet current issue", async () => {
  const notebook = await getNotebookData("/paper-digest/");
  assert.equal(notebook.directionReading.length, notebook.tags.length);
  const reconstruction = notebook.directionReading.find((entry) => entry.id === "3d-reconstruction");
  assert.equal(reconstruction.currentCount, 0);
  assert.equal(reconstruction.latest.id, "2026-11-01-4d-gaussian");
  const agentic = notebook.directionReading.find((entry) => entry.id === "agentic-driving");
  assert.equal(agentic.currentPrimaryCount, 0);
  assert.equal(agentic.currentCount, 1);
  assert.equal(agentic.latest.papers[0].id, "bug2scenario-root-cause-regression");
  for (const direction of notebook.directionReading) {
    assert.ok(direction.issues.every((issue, i) => i === 0 || issue.date <= direction.issues[i - 1].date));
    const ids = direction.issues.flatMap((issue) => issue.papers.map((paper) => paper.id));
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(direction.paperCount >= direction.primaryCount);
  }
});

test("direction projection uses canonical revision content but never invents a new issue", () => {
  const tags = [{ id: "a" }, { id: "b" }];
  const paper = { id: "paper", tags: ["a", "b"], title: "Updated report", comment: "Verified correction", revisionId: "revision" };
  const direction = buildDirectionReading({ tags,
    papers: [paper, { id: "audit-only", tags: ["b"] }],
    digests: [{ id: "2026-01-01", date: "2026-01-01", papers: [{ ...paper, title: "Original" }] }],
    reading: { version: 1, updatedAt: "2026-01-02", directions: [] } })[1];
  assert.equal(direction.paperCount, 1);
  assert.equal(direction.latest.papers[0].title, "Updated report");
  assert.equal(direction.latest.papers[0].primary, false);
  assert.equal(direction.latest.id, "2026-01-01");
});

test("editorial references must resolve to public papers and real issue coverage", () => {
  const reading = { version: 1, updatedAt: "2026-01-02", directions: [{ id: "a", issueId: "missing", changeSummary: "New evidence",
    comparisons: [{ paperIds: ["hidden", "missing"], reason: "Compare" }], connections: [], followUps: [] }] };
  const errors = validateDirectionReading(reading, { tags: [{ id: "a" }], digests: [], papers: [{ id: "hidden", tags: ["a"] }] });
  assert.ok(errors.some((error) => error.includes("issue does not cover")));
  assert.ok(errors.some((error) => error.includes("unresolved")));
});

test("direction search indexes reading guidance and feedback prepares a form without sending", async () => {
  const records = await getNotebookSearchIndex("/paper-digest/");
  assert.equal(records.filter((entry) => entry.kind === "direction").length, 11);
  assert.ok(records.some((entry) => entry.url === "/paper-digest/directions/lidar-anomaly-segmentation/"));
  const url = new URL(readerFeedbackUrl({ direction: "雷达 & 占据", issueId: "2026-11-06" }));
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/CrazyShout/paper-digest/issues/new");
  assert.match(url.searchParams.get("body"), /雷达 & 占据/);
});
