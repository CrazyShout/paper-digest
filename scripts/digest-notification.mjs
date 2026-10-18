import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { getDigests, getPapers } from "../src/lib/content.js";
import { digestPaperGroups } from "../src/lib/digest-reading.js";
import { buildHtmlBody, buildTextBody } from "./email-publish.mjs";

export const NOTIFICATION_ENVIRONMENT = "paper-digest-email";
export const NOTIFICATION_TASK = "notify:digest";
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export async function digestSnapshots(root = process.cwd()) {
  const [digests, papers] = await Promise.all([getDigests(), getPapers()]);
  const cache = new Map();
  const hashFile = (file) => {
    if (!cache.has(file)) cache.set(file, readFile(path.join(root, file)).then(sha256));
    return cache.get(file);
  };
  return Promise.all(digests.map(async (digest) => {
    const ids = new Set(digest.papers.map((paper) => paper.id));
    const reports = papers.filter((paper) => ids.has(paper.id) || ids.has(paper.revisionOf));
    const files = new Set([
      `content/digests/${digest.id}.md`,
      ...reports.map((paper) => `content/papers/${paper.id}.md`)
    ]);
    for (const file of [...files]) {
      const markdown = await readFile(path.join(root, file), "utf8");
      for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^\s)]+)\)/g)) {
        const url = new URL(match[1], "https://local.invalid/papers/report/");
        if (url.origin === "https://local.invalid" && url.pathname.startsWith("/assets/papers/")) {
          files.add(`public${decodeURIComponent(url.pathname)}`);
        }
      }
    }
    const sources = Object.fromEntries(await Promise.all([...files].sort().map(async (file) => [file, await hashFile(file)])));
    const labels = digest.tags.map(({ id, label }) => ({ id, label })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const fingerprint = sha256(JSON.stringify({ sources, labels }));
    return { id: digest.id, fingerprint, sources, labels, digest };
  }));
}

export function publicSnapshot(snapshot) {
  const { id, fingerprint, sources, labels } = snapshot;
  return { id, fingerprint, sources, labels };
}

function payload(record) {
  return typeof record.payload === "string" ? JSON.parse(record.payload) : record.payload;
}

export function notificationDecision(snapshot, records, baseline = {}) {
  const parsed = records.map((record) => ({ ...record, data: payload(record) }));
  for (const { data } of parsed) {
    if (data?.schema !== 1 || !["attempt", "receipt"].includes(data.kind)
      || !/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/.test(data.issueId || "")
      || !/^[0-9a-f]{64}$/.test(data.fingerprint || "")) throw new Error("Malformed notification ledger; no mail sent");
  }
  const relevant = parsed.filter((record) => record.data.issueId === snapshot.id);
  const attempts = relevant.filter((record) => record.data.kind === "attempt");
  for (const record of relevant.filter((record) => record.data.kind === "receipt")) {
    if (!attempts.some((attempt) => attempt.id === record.data.attemptId && attempt.data.fingerprint === record.data.fingerprint)) {
      throw new Error("Receipt does not match a durable attempt; no mail sent");
    }
  }
  for (const attempt of attempts) {
    const receipts = relevant.filter((record) => record.data.kind === "receipt" && record.data.attemptId === attempt.id);
    if (!receipts.length) return { action: "blocked", reason: "An attempt has no final receipt", attemptId: attempt.id };
    const receipt = receipts.sort((a, b) => b.id - a.id)[0].data;
    if (!["sent", "not-sent"].includes(receipt.outcome)) {
      return { action: "blocked", reason: `Previous send is ${receipt.outcome}`, attemptId: attempt.id };
    }
  }
  const sent = relevant.filter((record) => record.data.kind === "receipt" && record.data.outcome === "sent");
  if (sent.some((record) => record.data.fingerprint === snapshot.fingerprint)) return { action: "skip", reason: "already-sent" };
  if (baseline[snapshot.id]?.fingerprint === snapshot.fingerprint) return { action: "skip", reason: "historical-baseline" };
  const previous = attempts.sort((a, b) => b.id - a.id).find((record) => record.data.fingerprint !== snapshot.fingerprint)?.data.snapshot
    || baseline[snapshot.id];
  return { action: "send", update: Boolean(previous), previous };
}

export function changedContent(snapshot, previous) {
  if (!previous) return "";
  const changed = Object.keys(snapshot.sources).filter((file) => snapshot.sources[file] !== previous.sources?.[file]);
  const notes = [];
  if (changed.some((file) => file.startsWith("content/digests/"))) notes.push("简报正文");
  for (const paper of snapshot.digest.papers) {
    if (changed.includes(`content/papers/${paper.id}.md`)) notes.push(paper.title.split(":")[0]);
  }
  if (changed.some((file) => file.startsWith("public/"))) notes.push("论文图片");
  return `本期已更新：${notes.length ? notes.join("、") : "相关报告或方向信息"}。请以网页当前版本为准。`;
}

export function digestMessage(snapshot, { siteUrl, recipients, from, to, previous }) {
  const digest = { ...snapshot.digest, body: "", bodyHtml: "" };
  const update = changedContent(snapshot, previous);
  if (update) digest.summary = `${update}\n${digest.summary}`;
  const sections = digestPaperGroups(digest).filter((group) => group.papers.length);
  const url = `${siteUrl}/digests/${digest.id}/`;
  return {
    from, to, bcc: recipients.join(","),
    subject: `[Paper Digest${previous ? " 更新" : ""}] ${digest.id} ${digest.title}`,
    text: buildTextBody(digest, digest.id, url, "", sections, siteUrl),
    html: buildHtmlBody(digest, digest.id, url, "", sections, siteUrl)
  };
}

export function receiptKey(value) {
  const key = Buffer.from(String(value || ""), "base64");
  if (key.length !== 32) throw new Error("Receipt encryption requires a 32-byte base64 key");
  return key;
}

export function encryptReceipt(receipt, keyValue, context) {
  const key = receiptKey(keyValue);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(JSON.stringify(receipt), "utf8"), cipher.final()]);
  return { algorithm: "aes-256-gcm", keyId: sha256(key).slice(0, 16), context, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function decryptReceipt(encrypted, keyValue) {
  const key = receiptKey(keyValue);
  if (encrypted.algorithm !== "aes-256-gcm" || sha256(key).slice(0, 16) !== encrypted.keyId) throw new Error("Receipt key mismatch");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encrypted.iv, "base64"));
  decipher.setAAD(Buffer.from(encrypted.context));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.data, "base64")), decipher.final()]).toString("utf8"));
}

export function deliveryOutcome(info, recipients) {
  const email = (value) => String(typeof value === "string" ? value : value?.address || "").trim().toLowerCase();
  const accepted = new Set((info?.accepted || []).map(email));
  const rejected = new Set((info?.rejected || []).map(email));
  const acceptedCount = recipients.filter((item) => accepted.has(email(item))).length;
  const rejectedCount = recipients.filter((item) => rejected.has(email(item))).length;
  const outcome = Array.isArray(info?.accepted) && acceptedCount === recipients.length && rejectedCount === 0
    ? "sent" : acceptedCount > 0 ? "partial" : "unknown";
  return { outcome, acceptedCount: Array.isArray(info?.accepted) ? acceptedCount : null, rejectedCount: Array.isArray(info?.rejected) ? rejectedCount : null };
}

export async function executeNotification({ snapshot, decision, claim, send, persist, classifyError, message, now = () => new Date().toISOString() }) {
  if (decision.action !== "send") return { action: decision.action, reason: decision.reason };
  // The durable claim must finish before the first transport call. A crash or
  // uncertain persistence result leaves a claim that subsequent runs refuse.
  const attempt = await claim(snapshot);
  let result;
  try {
    const info = await send(message);
    result = { ...deliveryOutcome(info, message.bcc.split(",")), transportResponse: info };
  } catch (error) {
    result = { outcome: classifyError(error) ? "not-sent" : "unknown", acceptedCount: null, rejectedCount: null,
      error: { code: String(error.code || "unknown"), command: String(error.command || ""), responseCode: error.responseCode || null } };
  }
  const receipt = { ...result, issueId: snapshot.id, fingerprint: snapshot.fingerprint, attemptedAt: now(), message };
  await persist(attempt, receipt);
  if (receipt.outcome !== "sent") throw new Error(`Notification ${snapshot.id}: ${receipt.outcome}; inspect its receipt before retrying`);
  return { action: "sent", attemptId: attempt.id, acceptedCount: receipt.acceptedCount, rejectedCount: receipt.rejectedCount };
}

export async function githubApi(repository, token, pathname, options = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !pathname.startsWith("/")) throw new Error("Invalid GitHub API destination");
  const response = await fetch(`https://api.github.com/repos/${repository}${pathname}`, {
    method: options.method || "GET",
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10", "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`GitHub ${options.method || "GET"} ${pathname.split("?")[0]}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

export async function listNotificationRecords(api) {
  const records = [];
  for (let page = 1; page <= 1000; page += 1) {
    const batch = await api(`/deployments?environment=${NOTIFICATION_ENVIRONMENT}&task=${NOTIFICATION_TASK}&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error("Invalid notification ledger response");
    records.push(...batch);
    if (batch.length < 100) return records;
  }
  throw new Error("Notification ledger pagination limit reached; no mail sent");
}

export function createLedger(api, { sha, runUrl, key, receiptDirectory }) {
  const create = async (data) => {
    const result = await api("/deployments", { method: "POST", body: {
      ref: sha, task: NOTIFICATION_TASK, environment: NOTIFICATION_ENVIRONMENT,
      auto_merge: false, required_contexts: [], production_environment: false,
      description: `${data.issueId} ${data.kind} ${data.fingerprint.slice(0, 12)}`, payload: data
    } });
    if (!Number.isSafeInteger(result?.id)) throw new Error("GitHub did not confirm the notification record");
    return result;
  };
  const status = (id, state) => api(`/deployments/${id}/statuses`, { method: "POST", body: { state, auto_inactive: false, log_url: runUrl } });
  return {
    async claim(snapshot) {
      const attempt = await create({ schema: 1, kind: "attempt", issueId: snapshot.id, fingerprint: snapshot.fingerprint, snapshot: publicSnapshot(snapshot), runUrl });
      await status(attempt.id, "in_progress");
      return attempt;
    },
    async persist(attempt, receipt) {
      const encrypted = encryptReceipt(receipt, key, `${receipt.issueId}:${receipt.fingerprint}:${attempt.id}`);
      await mkdir(receiptDirectory, { recursive: true, mode: 0o700 });
      await writeFile(path.join(receiptDirectory, `${attempt.id}.json`), `${JSON.stringify(encrypted, null, 2)}\n`, { mode: 0o600 });
      const record = await create({ schema: 1, kind: "receipt", attemptId: attempt.id, issueId: receipt.issueId, fingerprint: receipt.fingerprint,
        outcome: receipt.outcome, acceptedCount: receipt.acceptedCount, rejectedCount: receipt.rejectedCount, encrypted, runUrl });
      await status(record.id, receipt.outcome === "sent" ? "success" : "failure");
      await status(attempt.id, receipt.outcome === "sent" ? "success" : "failure");
      return record;
    }
  };
}

export function assertDeploymentRun(run, { sha, repository }) {
  if (run.head_sha !== sha || run.head_branch !== "main" || run.status !== "completed" || run.conclusion !== "success"
    || !["push", "workflow_dispatch"].includes(run.event) || run.path !== ".github/workflows/deploy-pages.yml"
    || run.repository?.full_name?.toLowerCase() !== repository.toLowerCase()) {
    throw new Error("Mail requires a successful main-branch Pages workflow for the exact checked-out commit");
  }
}

export async function verifyLiveArtifact({ directory, siteUrl, snapshots, fetchImpl = fetch, retries = 2 }) {
  const base = new URL(`${siteUrl.replace(/\/$/, "")}/`);
  const files = new Set(["index.html", "digests/index.html", "landscape/index.html", "ideas/index.html", "reviews/index.html",
    "assets/notebook-search.json", "assets/notebook-search.json.gz", "assets/research-interests.json"]);
  for (const snapshot of snapshots) {
    files.add(`digests/${snapshot.id}/index.html`);
    for (const file of Object.keys(snapshot.sources)) {
      if (file.startsWith("content/papers/")) files.add(`papers/${path.basename(file, ".md")}/index.html`);
    }
  }
  for (const direction of await readdir(path.join(directory, "reviews"), { withFileTypes: true })) {
    if (direction.isDirectory()) files.add(`reviews/${direction.name}/index.html`);
  }
  for (const file of await readdir(path.join(directory, "_astro"))) files.add(`_astro/${file}`);
  for (const file of [...files].filter((file) => file.endsWith(".html"))) {
    const html = await readFile(path.join(directory, file), "utf8");
    for (const match of html.matchAll(/(?:src|href|srcset)="([^"]+)"/g)) {
      for (const part of match[1].split(",")) {
        const url = new URL(part.trim().split(/\s+/)[0], new URL(file, base));
        if (url.origin === base.origin && url.pathname.startsWith(`${base.pathname}assets/`)) {
          const relative = decodeURIComponent(url.pathname.slice(base.pathname.length));
          if (relative.startsWith("assets/papers/") || relative.startsWith("assets/paper-previews/")) files.add(relative);
        }
      }
    }
  }
  const queue = [...files];
  const results = [];
  const bodies = new Map();
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const relative = queue.shift();
      const expected = await readFile(path.join(directory, relative));
      let error;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetchImpl(new URL(relative, base), { cache: "no-store", headers: { "accept-encoding": "identity" }, signal: AbortSignal.timeout(30_000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const actual = Buffer.from(await response.arrayBuffer());
          if (!actual.equals(expected)) throw new Error("Does not match deployed artifact");
          if (relative.startsWith("assets/notebook-search.json")) bodies.set(relative, actual);
          results.push({ path: relative, sha256: sha256(actual), attempts: attempt + 1 });
          error = null;
          break;
        } catch (failure) {
          error = failure;
          if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      if (error) throw new Error(`Live verification failed: ${relative}: ${error.message}`);
    }
  }));
  if (!gunzipSync(bodies.get("assets/notebook-search.json.gz")).equals(bodies.get("assets/notebook-search.json"))) throw new Error("Search JSON/gzip differ");
  return { verifiedAt: new Date().toISOString(), resourceCount: results.length, searchGzipMatches: true, resources: results.sort((a, b) => a.path.localeCompare(b.path)) };
}
