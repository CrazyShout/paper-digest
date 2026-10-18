import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import {
  assertDeploymentRun, createLedger, decryptReceipt, deliveryOutcome, digestSnapshots,
  encryptReceipt, executeNotification, gitBlobSha256, notificationDecision, receiptKey, sha256, verifyLiveArtifact
} from "../scripts/digest-notification.mjs";

const version = sha256("version 1");
const snapshot = { id: "2026-10-18", fingerprint: version, sources: {}, labels: [] };
const message = { from: "sender@example.test", to: "sender@example.test", bcc: "one@example.test,two@example.test", subject: "Digest", text: "Reading notes", html: "<p>Reading notes</p>" };
const attempt = (id = 1, fingerprint = version) => ({ id, payload: { schema: 1, kind: "attempt", issueId: snapshot.id, fingerprint } });
const receipt = (outcome, id = 2, attemptId = 1, fingerprint = version) => ({ id, payload: { schema: 1, kind: "receipt", issueId: snapshot.id, fingerprint, attemptId, outcome } });

test("receipt import verifies large original images without an exec output buffer limit", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "digest-source-"));
  try {
    const git = (...args) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], {
      cwd: directory, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" }
    }).trim();
    git("init", "--quiet");
    const bytes = Buffer.alloc(2 * 1024 * 1024 + 17, 0x67);
    await writeFile(path.join(directory, "official-image.png"), bytes);
    git("add", "official-image.png");
    git("-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "--quiet", "-m", "fixture");
    const commit = git("rev-parse", "HEAD");
    assert.equal(await gitBlobSha256(commit, "official-image.png", directory), sha256(bytes));
    await assert.rejects(gitBlobSha256(commit, "missing.png", directory), /Could not verify/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("same content is deduplicated across reruns and recipient changes", () => {
  assert.deepEqual(notificationDecision(snapshot, [attempt(), receipt("sent")]), { action: "skip", reason: "already-sent" });
  assert.equal(notificationDecision({ ...snapshot, fingerprint: sha256("changed") }, [attempt(), receipt("sent")]).action, "send");
});

test("historical baseline suppresses only unchanged history without claiming it was sent", () => {
  assert.deepEqual(notificationDecision(snapshot, [], { [snapshot.id]: snapshot }), { action: "skip", reason: "historical-baseline" });
  assert.equal(notificationDecision({ ...snapshot, fingerprint: sha256("updated") }, [], { [snapshot.id]: snapshot }).action, "send");
});

test("incomplete, partial, and ambiguous attempts block retries even for a newer version", () => {
  for (const rows of [[attempt()], [attempt(), receipt("partial")], [attempt(), receipt("unknown")]]) {
    assert.equal(notificationDecision(snapshot, rows).action, "blocked");
    assert.equal(notificationDecision({ ...snapshot, fingerprint: sha256("new") }, rows).action, "blocked");
  }
  assert.equal(notificationDecision(snapshot, [attempt(), receipt("not-sent")]).action, "send");
});

test("corrupt and unrelated receipts cannot clear a pending attempt", () => {
  assert.throws(() => notificationDecision(snapshot, [{ id: 1, payload: {} }]), /Malformed/);
  assert.throws(() => notificationDecision(snapshot, [receipt("sent")]), /does not match/);
  assert.throws(() => notificationDecision(snapshot, [attempt(), receipt("not-sent", 2, 1, sha256("wrong"))]), /does not match/);
});

test("transport is never entered without a durable claim", async () => {
  let sends = 0;
  await assert.rejects(executeNotification({ snapshot, decision: { action: "send" }, message,
    claim: async () => { throw new Error("ledger unavailable"); }, send: async () => { sends++; }
  }), /ledger unavailable/);
  assert.equal(sends, 0);
});

test("send acceptance followed by receipt persistence failure cannot be retried", async () => {
  const rows = []; let sends = 0;
  await assert.rejects(executeNotification({ snapshot, decision: { action: "send" }, message,
    claim: async () => { rows.push(attempt()); return { id: 1 }; },
    send: async () => { sends++; return { accepted: message.bcc.split(","), rejected: [], messageId: "id" }; },
    persist: async () => { throw new Error("receipt disk unavailable"); }
  }), /receipt disk unavailable/);
  assert.equal(sends, 1);
  assert.equal(notificationDecision(snapshot, rows).action, "blocked");
});

test("timeout after DATA stays unknown; proven pre-connect failure permits later retry", async () => {
  for (const [code, safe, expected] of [["ECONNRESET", false, "unknown"], ["ENOTFOUND", true, "not-sent"]]) {
    let saved;
    await assert.rejects(executeNotification({ snapshot, decision: { action: "send" }, message,
      claim: async () => ({ id: 1 }), send: async () => { throw Object.assign(new Error("private response"), { code }); },
      classifyError: () => safe, persist: async (_, data) => { saved = data; }
    }), new RegExp(expected));
    assert.equal(saved.outcome, expected);
    assert.doesNotMatch(JSON.stringify(saved), /private response/);
  }
});

test("partial refusal is retained rather than retransmitted to accepted recipients", () => {
  assert.deepEqual(deliveryOutcome({ accepted: ["one@example.test"], rejected: ["two@example.test"] }, message.bcc.split(",")), { outcome: "partial", acceptedCount: 1, rejectedCount: 1 });
  assert.equal(deliveryOutcome({}, message.bcc.split(",")).outcome, "unknown");
});

test("already-sent invocation performs no claim or transport mutation", async () => {
  let mutations = 0;
  const result = await executeNotification({ snapshot, decision: { action: "skip", reason: "already-sent" }, claim: () => mutations++, send: () => mutations++ });
  assert.equal(result.action, "skip"); assert.equal(mutations, 0);
});

test("encrypted receipts authenticate their context and do not disclose subscribers", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const original = { bcc: message.bcc, response: "250 OK", messageId: "private-id" };
  const sealed = encryptReceipt(original, key, "2026-10-18:version:1");
  assert.deepEqual(decryptReceipt(sealed, key), original);
  assert.doesNotMatch(JSON.stringify(sealed), /example\.test|private-id|250 OK/);
  assert.throws(() => decryptReceipt({ ...sealed, context: "wrong" }, key));
  assert.throws(() => decryptReceipt(sealed, Buffer.alloc(32, 8).toString("base64")), /key mismatch/);
  assert.throws(() => receiptKey("missing"), /32-byte/);
  assert.notEqual(encryptReceipt(original, key, "same").iv, encryptReceipt(original, key, "same").iv);
});

test("ledger commits ciphertext before final status and disables auto-inactivation", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "digest-receipt-"));
  try {
    const calls = []; let id = 100;
    const api = async (route, options) => { calls.push({ route, ...options }); return { id: ++id }; };
    const key = Buffer.alloc(32, 1).toString("base64");
    const ledger = createLedger(api, { sha: "a".repeat(40), runUrl: "https://example.test/run", key, receiptDirectory: directory });
    const claimed = await ledger.claim(snapshot);
    await ledger.persist(claimed, { issueId: snapshot.id, fingerprint: version, outcome: "sent", acceptedCount: 2, rejectedCount: 0, message });
    const publicCalls = JSON.stringify(calls);
    assert.doesNotMatch(publicCalls, /one@example|two@example|Reading notes/);
    assert.equal(calls.filter((call) => call.route.endsWith("/statuses")).every((call) => call.body.auto_inactive === false), true);
    const saved = JSON.parse(await readFile(path.join(directory, `${claimed.id}.json`), "utf8"));
    assert.deepEqual(decryptReceipt(saved, key).message, message);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("deployment gate rejects wrong commit, branch, event, workflow, repository and incomplete runs", () => {
  const sha = "a".repeat(40); const repository = "owner/repo";
  const run = { head_sha: sha, head_branch: "main", status: "completed", conclusion: "success", event: "push", path: ".github/workflows/deploy-pages.yml", repository: { full_name: repository } };
  assertDeploymentRun(run, { sha, repository });
  for (const patch of [{ head_sha: "b".repeat(40) }, { head_branch: "feature" }, { conclusion: "failure" }, { status: "in_progress" }, { event: "pull_request" }, { path: ".github/workflows/other.yml" }, { repository: { full_name: "other/repo" } }]) {
    assert.throws(() => assertDeploymentRun({ ...run, ...patch }, { sha, repository }), /requires/);
  }
});

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "digest-live-"));
  const files = new Map([
    ["index.html", Buffer.from('<img src="/paper-digest/assets/papers/image.png"><source srcset="/paper-digest/assets/paper-previews/a.webp 640w">')],
    ...["digests/index.html", "landscape/index.html", "ideas/index.html", "reviews/index.html", "reviews/example/index.html"].map((file) => [file, Buffer.from("<h1>Page</h1>")]),
    ["_astro/style.css", Buffer.from("body{color:black}")],
    ["assets/papers/image.png", Buffer.from("official original")],
    ["assets/paper-previews/a.webp", Buffer.from("responsive")],
    ["assets/notebook-search.json", Buffer.from('{"records":[]}')],
    ["assets/notebook-search.json.gz", gzipSync('{"records":[]}')],
    ["assets/research-interests.json", Buffer.from("{}")]
  ]);
  for (const [file, data] of files) { await mkdir(path.dirname(path.join(directory, file)), { recursive: true }); await writeFile(path.join(directory, file), data); }
  return { directory, files };
}

test("online gate checks artifact bytes, original/preview images, CSS and decoded search", async () => {
  const { directory, files } = await fixture();
  try {
    const fetched = [];
    const result = await verifyLiveArtifact({ directory, siteUrl: "https://example.test/paper-digest", snapshots: [], retries: 0,
      fetchImpl: async (url) => { const file = url.pathname.replace("/paper-digest/", ""); fetched.push(file); return new Response(files.get(file)); }
    });
    assert.equal(result.resourceCount, files.size);
    assert.equal(result.searchGzipMatches, true);
    assert.ok(fetched.includes("assets/paper-previews/a.webp"));
    for (const mismatch of ["index.html", "_astro/style.css", "assets/papers/image.png"]) {
      await assert.rejects(verifyLiveArtifact({ directory, siteUrl: "https://example.test/paper-digest", snapshots: [], retries: 0,
        fetchImpl: async (url) => { const file = url.pathname.replace("/paper-digest/", ""); return new Response(file === mismatch ? "stale" : files.get(file)); }
      }), /Live verification failed/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("frozen baseline is consistent with the existing published content", async () => {
  const baseline = JSON.parse(await readFile("config/digest-notification-baseline.json", "utf8"));
  // New issues may be added later; only assert that the recorded baseline is
  // well-formed. Current source differences are legitimate notification work.
  assert.match(baseline.commit, /^[0-9a-f]{40}$/);
  for (const item of Object.values(baseline.digests)) assert.match(item.fingerprint, /^[0-9a-f]{64}$/);
  const snapshots = await digestSnapshots();
  assert.ok(snapshots.length > 0);
  assert.ok(snapshots.every((item) => Object.keys(item.sources).some((file) => file.startsWith("content/digests/"))));
  for (const current of snapshots) {
    const old = baseline.digests[current.id];
    if (old && JSON.stringify(old.sources) === JSON.stringify(current.sources) && JSON.stringify(old.labels) === JSON.stringify(current.labels)) {
      assert.equal(current.fingerprint, old.fingerprint, "unchanged inputs must keep the same notification identity");
    }
  }
});
