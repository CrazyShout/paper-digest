import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/comments-worker.mjs";
import { MAX_COMMENT_LENGTH } from "../src/lib/comment-contract.js";

const env = {
  ALLOWED_ORIGIN: "https://digest.example,https://preview.example"
};

const githubEnv = { ...env, GITHUB_OWNER: "test", GITHUB_REPO: "test", GITHUB_TOKEN: "mock-token" };

function post(payload) {
  return new Request("https://worker.example/comments", {
    method: "POST",
    headers: { Origin: "https://digest.example", "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

test("comments worker rejects browser requests from unlisted origins", async () => {
  const response = await worker.fetch(new Request(
    "https://worker.example/comments?digestId=2026-08-24",
    { headers: { Origin: "https://attacker.example" } }
  ), env);

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.deepEqual(await response.json(), { error: "Origin not allowed" });
});

test("comments worker returns exact CORS origin for an allowed preflight", async () => {
  const response = await worker.fetch(new Request("https://worker.example/comments", {
    method: "OPTIONS",
    headers: { Origin: "https://preview.example" }
  }), env);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://preview.example");
  assert.equal(response.headers.get("Vary"), "Origin");
});

test("comments worker requires JSON and rejects malformed payloads before GitHub access", async () => {
  const wrongType = await worker.fetch(new Request("https://worker.example/comments", {
    method: "POST",
    headers: {
      Origin: "https://digest.example",
      "Content-Type": "text/plain"
    },
    body: "hello"
  }), env);
  assert.equal(wrongType.status, 415);

  const malformed = await worker.fetch(new Request("https://worker.example/comments", {
    method: "POST",
    headers: {
      Origin: "https://digest.example",
      "Content-Type": "application/json"
    },
    body: "{"
  }), env);
  assert.equal(malformed.status, 400);
});

test("comments worker caps request bodies before JSON parsing", async () => {
  const response = await worker.fetch(new Request("https://worker.example/comments", {
    method: "POST",
    headers: {
      Origin: "https://digest.example",
      "Content-Type": "application/json",
      "Content-Length": String(17 * 1024)
    },
    body: "{}"
  }), env);

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "Request body too large" });
});

test("invalid JSON values and comment fields return structured 400 responses", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("invalid input must not contact GitHub"));
  for (const payload of [null, [], "text", {}, { digestId: "bad", text: "test" },
    { digestId: "2026-08-31", text: " " }, { digestId: "2026-08-31", text: 123 }]) {
    const response = await worker.fetch(post(payload), githubEnv);
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://digest.example");
  }
});

test("the shared 1200-character limit preserves the full text and line breaks", async (t) => {
  const text = `首行\n${"字".repeat(MAX_COMMENT_LENGTH - 3)}`;
  let stored;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (options.method === "PUT") {
      stored = JSON.parse(Buffer.from(JSON.parse(options.body).content, "base64").toString("utf8"));
      return Response.json({}, { status: 201 });
    }
    return Response.json({}, { status: String(url).includes("/content/digests/") ? 200 : 404 });
  });
  const response = await worker.fetch(post({ digestId: "2026-08-31", text }), githubEnv);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).comment.text, text);
  assert.equal(stored[0].text, text);
  const tooLong = await worker.fetch(post({ digestId: "2026-08-31", text: `${text}字` }), githubEnv);
  assert.equal(tooLong.status, 400);
});

test("missing digests and upstream failures keep JSON errors and CORS on GET and POST", async (t) => {
  for (const [upstream, expected] of [[404, 404], [503, 502]]) {
    const mock = t.mock.method(globalThis, "fetch", async () => new Response("", { status: upstream }));
    for (const request of [
      new Request("https://worker.example/comments?digestId=2026-08-31", { headers: { Origin: "https://digest.example" } }),
      post({ digestId: "2026-08-31", text: "test" })
    ]) {
      const response = await worker.fetch(request, githubEnv);
      assert.equal(response.status, expected);
      assert.ok((await response.json()).error);
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://digest.example");
    }
    mock.mock.restore();
  }
});

test("network rejections become a 502 response instead of escaping the handler", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  const response = await worker.fetch(post({ digestId: "2026-08-31", text: "test" }), githubEnv);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "GitHub request failed" });
});

test("concurrent GitHub updates re-read the latest comments after a conflict", async (t) => {
  let writes = 0;
  const existing = { id: "earlier", text: "another reader" };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (String(url).includes("/content/digests/")) return Response.json({});
    if (options.method === "PUT") {
      writes += 1;
      if (writes === 1) return new Response("", { status: 409 });
      const payload = JSON.parse(options.body);
      const comments = JSON.parse(Buffer.from(payload.content, "base64").toString("utf8"));
      assert.equal(payload.sha, "new-sha");
      assert.equal(comments[0].id, existing.id);
      assert.equal(comments[1].text, "test");
      return Response.json({}, { status: 201 });
    }
    if (!writes) return new Response("", { status: 404 });
    return Response.json({ sha: "new-sha", content: Buffer.from(JSON.stringify([existing])).toString("base64") });
  });
  const response = await worker.fetch(post({ digestId: "2026-08-31", text: "test" }), githubEnv);
  assert.equal(response.status, 201);
  assert.equal(writes, 2);
});
