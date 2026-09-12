import assert from "node:assert/strict";
import test from "node:test";
import { memoizeContent, withContentSnapshot } from "../src/lib/content-cache.js";
import { getPapers } from "../src/lib/content.js";

test("concurrent readers share one load within a snapshot", async () => {
  let reads = 0;
  await withContentSnapshot(async () => {
    const load = async () => { reads += 1; return { value: reads }; };
    const [first, second] = await Promise.all([
      memoizeContent("file", load),
      withContentSnapshot(() => memoizeContent("file", load))
    ]);
    assert.equal(reads, 1);
    assert.strictEqual(first, second);
    const [papers, samePapers] = await Promise.all([getPapers(), getPapers()]);
    assert.strictEqual(papers, samePapers);
  });
});

test("new dev snapshots see updated data and failed loads can retry", async () => {
  let value = "before";
  const load = () => memoizeContent("content", async () => value);
  assert.equal(await withContentSnapshot(load), "before");
  value = "after";
  assert.equal(await withContentSnapshot(load), "after");
  await withContentSnapshot(async () => {
    await assert.rejects(memoizeContent("retry", () => { throw new Error("temporary"); }));
    assert.equal(await memoizeContent("retry", async () => "recovered"), "recovered");
  });
});
