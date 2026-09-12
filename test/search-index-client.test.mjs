import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { loadSearchIndex } from "../src/lib/search-index-client.js";

const records = [{ id: "paper-one", title: "论文一", content: "完整正文 $x^2$" }];
const json = JSON.stringify(records);
const sourceUrl = "/paper-digest/assets/notebook-search.json?v=2";

test("loads complete Chinese records from the compressed static asset", async () => {
  const calls = [];
  const data = await loadSearchIndex(sourceUrl, { fetchImpl: async (url) => {
    calls.push(url);
    return new Response(gzipSync(json));
  } });
  assert.deepEqual(data, records);
  assert.deepEqual(calls, ["/paper-digest/assets/notebook-search.json.gz?v=2"]);
});

test("accepts a compressed response transparently decoded by the host", async () => {
  assert.deepEqual(await loadSearchIndex(sourceUrl, {
    fetchImpl: async () => new Response(json, { headers: { "Content-Encoding": "gzip" } })
  }), records);
});

test("falls back to JSON for missing, corrupt or invalid compressed assets", async () => {
  for (const compressed of [
    () => new Response("missing", { status: 404 }),
    () => new Response(new Uint8Array([0x1f, 0x8b, 0])),
    () => new Response(gzipSync('{"invalid":"index"}'))
  ]) {
    const calls = [];
    const data = await loadSearchIndex(sourceUrl, { fetchImpl: async (url) => {
      calls.push(url);
      return calls.length === 1 ? compressed() : new Response(json);
    } });
    assert.deepEqual(data, records);
    assert.deepEqual(calls, ["/paper-digest/assets/notebook-search.json.gz?v=2", sourceUrl]);
  }
});

test("older browsers request only the JSON index and retain HTTP/schema errors", async () => {
  const calls = [];
  assert.deepEqual(await loadSearchIndex(sourceUrl, { Decompressor: null, fetchImpl: async (url) => {
    calls.push(url);
    return new Response(json);
  } }), records);
  assert.deepEqual(calls, [sourceUrl]);
  await assert.rejects(loadSearchIndex(sourceUrl, {
    Decompressor: null, fetchImpl: async () => new Response("error", { status: 500 })
  }), /HTTP 500/);
  await assert.rejects(loadSearchIndex(sourceUrl, {
    Decompressor: null, fetchImpl: async () => new Response("null")
  }), /Invalid search index/);
});

test("aborting a compressed request does not start a fallback request", async () => {
  const controller = new AbortController();
  let requests = 0;
  await assert.rejects(loadSearchIndex(sourceUrl, {
    signal: controller.signal,
    fetchImpl: async (_url, { signal }) => {
      requests++;
      controller.abort();
      signal.throwIfAborted();
    }
  }), { name: "AbortError" });
  assert.equal(requests, 1);
});
