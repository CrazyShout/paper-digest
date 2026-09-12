import assert from "node:assert/strict";
import test from "node:test";
import { getNotebookData, getNotebookSearchIndex, routeUrl } from "../src/lib/navigation.js";
import { readingNavigationTree } from "../src/lib/reading-ui.js";

function collectPageUrls(nodes, output = []) {
  for (const node of nodes || []) {
    if (node.type === "page") output.push(node.url);
    if (node.index) output.push(node.index.url);
    if (node.children) collectPageUrls(node.children, output);
  }
  return output;
}

test("notebook navigation projects every content family under the deployment base", async () => {
  const notebook = await getNotebookData("/paper-digest/");
  const pageUrls = collectPageUrls(notebook.tree.children);
  const uniqueUrls = new Set(pageUrls);

  assert.equal(uniqueUrls.size, pageUrls.length);
  assert.ok(pageUrls.every((url) => url.startsWith("/paper-digest/")));
  assert.ok(pageUrls.includes("/paper-digest/"));
  assert.ok(pageUrls.includes("/paper-digest/landscape/"));
  assert.ok(pageUrls.includes("/paper-digest/reviews/"));
  assert.ok(pageUrls.includes("/paper-digest/ideas/"));
  assert.ok(pageUrls.includes(`/paper-digest/digests/${notebook.digests[0].id}/`));
  assert.ok(pageUrls.includes(`/paper-digest/papers/${notebook.papers[0].id}/`));
});

test("notebook search keeps one canonical record per rendered route", async () => {
  const notebook = await getNotebookData("/");
  const searchRecords = await getNotebookSearchIndex("/");
  const ids = searchRecords.map((record) => record.id);
  const urls = searchRecords.map((record) => record.url);

  assert.equal(new Set(ids).size, ids.length);
  assert.ok(urls.every((url) => url.startsWith("/")));
  assert.equal(
    searchRecords.filter((record) => record.id.startsWith("paper-")).length,
    notebook.papers.length
  );
  assert.equal(
    searchRecords.filter((record) => record.id.startsWith("digest-")).length,
    notebook.digests.length
  );
  assert.ok(notebook.papers.every((paper) => !paper.revisionOf));
  assert.equal(notebook.papers.filter((paper) => paper.revisionId).length, 7);
  assert.equal(
    notebook.tree.children.find((node) => node.name?.startsWith("人工核验修订"))?.children.length,
    7
  );
});

test("research directions are grouped once across review and report navigation", async () => {
  const notebook = await getNotebookData("/");
  const reviewFolder = notebook.tree.children.find((node) => node.name === "方向综述");
  const reportFolder = notebook.tree.children.find((node) => node.name?.startsWith("详细报告"));
  const groupedReviewIds = notebook.reviewCenter.directionGroups.flatMap(
    (group) => group.directions.map((direction) => direction.id)
  );

  assert.deepEqual(
    notebook.reviewCenter.directionGroups.map((group) => group.label),
    ["策略与交互", "世界与表征", "保障与生命周期"]
  );
  assert.equal(new Set(groupedReviewIds).size, notebook.tags.length);
  assert.ok(groupedReviewIds.includes("dynamic-scene-representation"));
  assert.equal(reviewFolder.children.length, 3);
  assert.equal(reportFolder.children.length, 3);
  assert.deepEqual(
    notebook.reviewCenter.watchTopics.map((topic) => topic.id),
    ["interactive-prediction-and-decision", "deployment-reliability"]
  );
});

test("routeUrl preserves root and repository deployment paths", () => {
  assert.equal(routeUrl("/", "papers/example"), "/papers/example/");
  assert.equal(
    routeUrl("/paper-digest/", "/reviews/world-models/"),
    "/paper-digest/reviews/world-models/"
  );
});

test("search distinguishes the reading homepage from the full landscape", async () => {
  const records = await getNotebookSearchIndex("/paper-digest/");
  assert.equal(records.find((record) => record.id === "home").url, "/paper-digest/");
  assert.equal(records.find((record) => record.id === "research-landscape").url, "/paper-digest/landscape/");
});

test("an older digest opens its parent folders without opening unrelated branches", async () => {
  const { tree, digests } = await getNotebookData("/paper-digest/");
  const projected = readingNavigationTree(tree, `/paper-digest/digests/${digests.at(-1).id}/`);
  const archive = projected.children.find((node) => node.name === "简报归档");
  assert.equal(archive.defaultOpen, true);
  assert.equal(archive.children.find((node) => node.type === "folder").defaultOpen, true);
  assert.equal(projected.children.find((node) => node.name === "方向综述").defaultOpen, false);
  assert.equal(tree.children.find((node) => node.name === "简报归档").defaultOpen, false);
});
