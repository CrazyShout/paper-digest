import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { addSubscribers, assertWelcomeKey, createWelcomeLedger, executeWelcome, recipientKey, runWelcomes, welcomeDecision, welcomeMessage, welcomeRecipientState } from "../scripts/welcome-notification.mjs";
import { decryptReceipt, sha256 } from "../scripts/digest-notification.mjs";
import { withSubscriberLock } from "../scripts/subscribers.mjs";

const key = Buffer.alloc(32, 4).toString("base64");
const email = "new@example.test";
const id = recipientKey(email, key);
const snapshot = { id: "2026-10-28", fingerprint: sha256("issue"), digest: {
  id: "2026-10-28", date: "2026-10-28", title: "最新简报", summary: "选文摘要", keywords: [], body: "Internal audit",
  tags: [{ id: "a", label: "方向 A" }, { id: "b", label: "方向 B" }],
  papers: [{ id: "paper-one", title: "One Paper", comment: "方法与结果。", tag: "a", tags: ["a", "b"], authors: [] }]
} };
const message = welcomeMessage(snapshot, { recipient: email, from: "Paper Digest <sender@example.test>", sender: "sender@example.test", siteUrl: "https://example.test" });
const attempt = (n = 1, fp = snapshot.fingerprint) => ({ id: n, payload: { schema: 1, kind: "attempt", recipientKey: id, issueId: snapshot.id, fingerprint: fp } });
const receipt = (outcome = "sent", n = 2, attemptId = 1) => ({ id: n, payload: { ...attempt().payload, kind: "receipt", attemptId, outcome } });

test("subscriber addition normalizes duplicates and preserves the frozen migration baseline", () => {
  const data = { recipients: ["old@example.test"], onboardedRecipients: ["old@example.test"], welcomeBaselineRecipients: ["old@example.test"] };
  const result = addSubscribers(data, [" New@Example.Test ", email, "old@example.test"]);
  assert.deepEqual(result.added, [email]);
  assert.deepEqual(result.data.recipients, ["old@example.test", email]);
  assert.deepEqual(result.data.onboardedRecipients, data.onboardedRecipients);
  assert.deepEqual(result.data.welcomeBaselineRecipients, data.welcomeBaselineRecipients);
  assert.deepEqual(data.recipients, ["old@example.test"]);
  assert.throws(() => addSubscribers(data, ["bad"]), /无效/);
  assert.throws(() => welcomeRecipientState({ recipients: [email] }), /baseline/);
});

test("opaque recipient IDs normalize case and depend on the secret key", () => {
  assert.equal(recipientKey("NEW@EXAMPLE.TEST", key), id);
  assert.notEqual(recipientKey(email, Buffer.alloc(32, 5).toString("base64")), id);
  assert.notEqual(id, sha256(email));
  const record = { payload: { keyId: sha256(Buffer.from(key, "base64")).slice(0, 16) } };
  assert.doesNotThrow(() => assertWelcomeKey([record], key));
  assert.throws(() => assertWelcomeKey([record], Buffer.alloc(32, 6).toString("base64")), /key changed/);
});

test("sent welcomes never repeat when the issue or content version changes", () => {
  const records = [attempt(), receipt()];
  assert.deepEqual(welcomeDecision(id, records), { action: "skip", reason: "already-welcomed" });
  assert.equal(welcomeDecision(id, records, new Set([id])).reason, "already-welcomed");
  assert.equal(welcomeDecision(recipientKey("other@example.test", key), records).action, "send");
  assert.equal(welcomeDecision(id, [], new Set([id])).reason, "legacy-onboarded-baseline");
});

test("missing, uncertain and rejected receipts block even a migration baseline", () => {
  for (const records of [[attempt()], [attempt(), receipt("unknown")], [attempt(), receipt("rejected")]]) {
    assert.equal(welcomeDecision(id, records, new Set([id])).action, "blocked");
  }
  assert.equal(welcomeDecision(id, [attempt(), receipt("not-sent")]).action, "send");
  assert.throws(() => welcomeDecision(id, [receipt()]), /does not match/);
  assert.throws(() => welcomeDecision(id, [attempt(1, sha256("other")), receipt()]), /does not match/);
});

test("the welcome contains project help and one copy of each selected paper, with no sender copy", () => {
  assert.equal(message.to, email);
  assert.deepEqual(message.envelope.to, [email]);
  assert.equal(message.cc, undefined); assert.equal(message.bcc, undefined);
  assert.match(message.text, /欢迎加入 Paper Digest/);
  assert.match(message.text, /https:\/\/example.test\/reviews\//);
  assert.match(message.html, /2026-10-28/);
  assert.equal(message.text.split("One Paper").length - 1, 1);
  assert.doesNotMatch(message.text, /Internal audit|飞书知识库/);
});

test("durable claim failure prevents sending, and malformed envelopes fail before claiming", async () => {
  let sent = 0;
  const args = { snapshot, recipientId: id, decision: { action: "send" }, message,
    claim: async () => { throw new Error("ledger failed"); }, send: async () => { sent++; }, persist: async () => {} };
  await assert.rejects(executeWelcome(args), /ledger failed/);
  await assert.rejects(executeWelcome({ ...args, message: { ...message, cc: "old@example.test" } }), /exactly one/);
  await assert.rejects(executeWelcome({ ...args, message: { ...message, envelope: { to: [email, "sender@example.test"] } } }), /exactly one/);
  assert.equal(sent, 0);
});

test("one send and encrypted receipt precede completion; an uncertain outcome is not retried", async () => {
  const events = []; let saved;
  const args = { snapshot, recipientId: id, decision: { action: "send" }, message,
    claim: async () => { events.push("claim"); return { id: 1 }; },
    send: async () => { events.push("send"); return { accepted: [email], rejected: [], messageId: "provider-id" }; },
    persist: async (_attempt, value) => { events.push("receipt"); saved = value; } };
  const result = await executeWelcome(args);
  assert.equal(result.action, "sent"); assert.deepEqual(events, ["claim", "send", "receipt"]);
  assert.equal(saved.message.to, email);
  events.length = 0;
  await assert.rejects(executeWelcome({ ...args, send: async () => { events.push("send"); throw Object.assign(new Error("after DATA"), { code: "ETIMEDOUT", command: "CONN" }); } }), /unknown/);
  assert.deepEqual(events, ["claim", "send", "receipt"]); assert.equal(saved.outcome, "unknown");
});

test("extra accepted recipients cannot be reported as a successful single-recipient welcome", async () => {
  let outcome;
  await assert.rejects(executeWelcome({ snapshot, recipientId: id, decision: { action: "send" }, message,
    claim: async () => ({ id: 1 }), send: async () => ({ accepted: [email, "sender@example.test"], rejected: [] }),
    persist: async (_attempt, receipt) => { outcome = receipt.outcome; } }), /unknown/);
  assert.equal(outcome, "unknown");
});

test("a persistence failure leaves a blocking claim instead of another send", async () => {
  const records = []; let sent = 0;
  await assert.rejects(executeWelcome({ snapshot, recipientId: id, decision: { action: "send" }, message,
    claim: async () => { records.push(attempt()); return records[0]; },
    send: async () => { sent++; return { accepted: [email], rejected: [] }; },
    persist: async () => { throw new Error("storage lost"); } }), /storage lost/);
  const decision = welcomeDecision(id, records);
  assert.equal(decision.action, "blocked");
  await executeWelcome({ decision });
  assert.equal(sent, 1);
});

test("durable welcome records expose only opaque IDs and encrypted receipt content", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "welcome-receipt-"));
  const records = []; let counter = 50;
  const api = async (url, options) => {
    if (url === "/deployments") { const result = { id: ++counter, ...options.body }; records.push(result); return result; }
    return {};
  };
  try {
    const ledger = createWelcomeLedger(api, { sha: "a".repeat(40), runUrl: "https://example.test/run", key, receiptDirectory: directory });
    const a = await ledger.claim(snapshot, id);
    await ledger.persist(a, { outcome: "sent", recipientKey: id, issueId: snapshot.id, fingerprint: snapshot.fingerprint, message, acceptedCount: 1, rejectedCount: 0 });
    assert.doesNotMatch(JSON.stringify(records), /new@example|sender@example/);
    assertWelcomeKey(records, key);
    assert.equal(welcomeDecision(id, records).reason, "already-welcomed");
    const saved = JSON.parse(await readFile(path.join(directory, `${a.id}.json`), "utf8"));
    assert.equal(decryptReceipt(saved, key).message.to, email);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("concurrent local additions fail closed and release the lock after errors", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "subscriber-lock-"));
  const lock = path.join(directory, "lock");
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = withSubscriberLock(async () => { started(); await new Promise(resolve => { release = resolve; }); }, lock);
  await ready;
  await assert.rejects(withSubscriberLock(async () => {}, lock), /locked/);
  release(); await pending;
  await assert.rejects(withSubscriberLock(async () => { throw new Error("action failed"); }, lock), /action failed/);
  await withSubscriberLock(async () => {}, lock);
  await rm(directory, { recursive: true, force: true });
});

test("workflow sweeps only new subscribers and a later issue cannot repeat a welcome", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "welcome-sweep-"));
  const records = []; const deliveries = []; let sequence = 1;
  const api = async (url, options) => {
    if (url.startsWith("/deployments?")) return records;
    if (url === "/deployments") { const result = { id: sequence++, ...options.body }; records.push(result); return result; }
    return {};
  };
  const config = { recipients: ["old@example.test", email, "second@example.test"], welcomeBaselineRecipients: ["old@example.test"] };
  const options = { snapshot, config, api, key, sha: "b".repeat(40), runUrl: "https://example.test/run", directory,
    from: "sender@example.test", sender: "sender@example.test", siteUrl: "https://example.test",
    send: async mail => { deliveries.push(mail); return { accepted: [mail.to], rejected: [], messageId: `provider-${deliveries.length}` }; } };
  try {
    const first = await runWelcomes(options);
    assert.deepEqual(first.map(item => item.action), ["skip", "sent", "sent"]);
    assert.deepEqual(deliveries.map(mail => mail.envelope.to), [[email], ["second@example.test"]]);
    const next = { ...snapshot, id: "2026-11-02", fingerprint: sha256("new issue"), digest: { ...snapshot.digest, id: "2026-11-02" } };
    const second = await runWelcomes({ ...options, snapshot: next });
    assert.ok(second.every(item => item.action === "skip"));
    assert.equal(deliveries.length, 2);
    const summary = await readFile(path.join(directory, "summary.json"), "utf8");
    assert.doesNotMatch(summary, /@example/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("expired Pages packages use only a successful verifier at the same deployed commit", async () => {
  const { welcomeVerificationInput } = await import("../scripts/welcome-notification.mjs");
  const deployment = { id: 50, head_sha: "b".repeat(40) };
  const trusted = { id: 70, head_sha: deployment.head_sha, head_branch: "main", conclusion: "success", path: ".github/workflows/notify-digests.yml", event: "workflow_run", run_attempt: 1 };
  const api = async url => {
    if (url.includes("/runs/50/artifacts")) return { artifacts: [{ name: "github-pages", expired: true }] };
    if (url.includes("/workflows/")) return { workflow_runs: [{ ...trusted, id: 60, head_sha: "c".repeat(40) }, trusted] };
    assert.ok(url.includes("/runs/70/artifacts"));
    return { artifacts: [{ name: "digest-notification-70-1", expired: false }] };
  };
  assert.deepEqual(await welcomeVerificationInput(api, deployment), { mode: "manifest", runId: 70, name: "digest-notification-70-1" });
  await assert.rejects(welcomeVerificationInput(async () => ({ artifacts: [], workflow_runs: [] }), deployment), /No retained/);
});

test("welcome manifest verification binds content SHA, every required page and decoded search bytes", async () => {
  const { verifyWelcomeManifest } = await import("../scripts/welcome-notification.mjs");
  const { gzipSync } = await import("node:zlib");
  const current = { ...snapshot, sources: { "content/papers/paper-one.md": sha256("paper"), "public/assets/papers/figure.png": sha256("figure") } };
  const files = new Map([
    ...["index.html", "digests/index.html", "reviews/index.html", "ideas/index.html", "landscape/index.html", "assets/research-interests.json", "digests/2026-10-28/index.html", "papers/paper-one/index.html", "assets/papers/figure.png", "_astro/style.css"].map(file => [file, Buffer.from(file)]),
    ["assets/notebook-search.json", Buffer.from('["content"]')], ["assets/notebook-search.json.gz", gzipSync('["content"]')]
  ]);
  const manifest = { sha: "a".repeat(40), deploymentRunId: "50", searchGzipMatches: true, resources: [...files].map(([path, bytes]) => ({ path, sha256: sha256(bytes) })) };
  const fetchImpl = async url => new Response(files.get(new URL(url).pathname.slice(1)), { status: 200 });
  const args = { manifest, snapshot: current, sha: manifest.sha, deploymentRunId: 50, siteUrl: "https://example.test", fetchImpl };
  assert.equal((await verifyWelcomeManifest(args)).resourceCount, files.size);
  await assert.rejects(verifyWelcomeManifest({ ...args, sha: "b".repeat(40) }), /identify/);
  await assert.rejects(verifyWelcomeManifest({ ...args, manifest: { ...manifest, resources: manifest.resources.filter(item => item.path !== "papers/paper-one/index.html") } }), /cover/);
  await assert.rejects(verifyWelcomeManifest({ ...args, manifest: { ...manifest, resources: [...manifest.resources, { path: "../private", sha256: sha256("x") }] } }), /Invalid/);
  files.set("index.html", Buffer.from("different deployment"));
  await assert.rejects(verifyWelcomeManifest(args), /differs/);
});
