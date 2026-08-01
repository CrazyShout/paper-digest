import assert from "node:assert/strict";
import test from "node:test";
import { getNotebookData, routeUrl } from "../src/lib/navigation.js";

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
  assert.ok(pageUrls.includes("/paper-digest/reviews/"));
  assert.ok(pageUrls.includes("/paper-digest/ideas/"));
  assert.ok(pageUrls.includes(`/paper-digest/digests/${notebook.digests[0].id}/`));
  assert.ok(pageUrls.includes(`/paper-digest/papers/${notebook.papers[0].id}/`));
});

test("notebook search keeps one canonical record per rendered route", async () => {
  const notebook = await getNotebookData("/");
  const ids = notebook.searchRecords.map((record) => record.id);
  const urls = notebook.searchRecords.map((record) => record.url);

  assert.equal(new Set(ids).size, ids.length);
  assert.ok(urls.every((url) => url.startsWith("/")));
  assert.equal(
    notebook.searchRecords.filter((record) => record.id.startsWith("paper-")).length,
    notebook.papers.length
  );
  assert.equal(
    notebook.searchRecords.filter((record) => record.id.startsWith("digest-")).length,
    notebook.digests.length
  );
});

test("routeUrl preserves root and repository deployment paths", () => {
  assert.equal(routeUrl("/", "papers/example"), "/papers/example/");
  assert.equal(
    routeUrl("/paper-digest/", "/reviews/world-models/"),
    "/paper-digest/reviews/world-models/"
  );
});
