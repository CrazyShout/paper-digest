import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/comments-worker.mjs";

const env = {
  ALLOWED_ORIGIN: "https://digest.example,https://preview.example"
};

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
