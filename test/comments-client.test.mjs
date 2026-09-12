import assert from "node:assert/strict";
import test from "node:test";
import { saveComment } from "../src/lib/comments-client.js";

const note = { digestId: "2026-08-31", text: "测试".repeat(600), nickname: "读者" };

test("a remote failure preserves all 1200 characters locally", async () => {
  let saved;
  const result = await saveComment(note, {
    endpoint: "https://worker.example",
    fetchImpl: async () => { throw new Error("offline"); },
    persistLocal: (comment) => { saved = comment; }
  });
  assert.equal(result.mode, "local");
  assert.equal(saved.text, note.text);
});

test("a truncated response is not treated as a successful synchronization", async () => {
  const result = await saveComment(note, {
    endpoint: "https://worker.example",
    fetchImpl: async () => Response.json({ comment: { ...note, text: note.text.slice(0, 800) } }),
    persistLocal: () => {}
  });
  assert.equal(result.mode, "local");
  assert.equal(result.comment.text, note.text);
});

test("failed local persistence rejects so the editor retains its draft", async () => {
  await assert.rejects(saveComment(note, {
    endpoint: "",
    persistLocal: () => { throw new Error("QuotaExceededError"); }
  }), /QuotaExceededError/);
});

test("a full remote acknowledgement does not create a duplicate local note", async () => {
  const result = await saveComment(note, {
    endpoint: "https://worker.example",
    fetchImpl: async () => Response.json({ comment: { ...note, id: "remote" } }),
    persistLocal: () => assert.fail("must not save a duplicate")
  });
  assert.equal(result.mode, "remote");
});
