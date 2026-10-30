import { createHmac } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildHtmlBody, buildTextBody, parseRecipientsConfig, parseRecipientState } from "./email-publish.mjs";
import { encryptReceipt, receiptKey, sha256 } from "./digest-notification.mjs";
import { digestPaperGroups } from "../src/lib/digest-reading.js";

export const WELCOME_ENVIRONMENT = "paper-digest-welcome";
export const WELCOME_TASK = "notify:welcome";
const digestId = /^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/;
const fingerprint = /^[0-9a-f]{64}$/;
const outcomes = new Set(["sent", "not-sent", "unknown", "rejected"]);

export async function welcomeVerificationInput(api, deployment) {
  const artifacts = await api(`/actions/runs/${deployment.id}/artifacts?per_page=100`);
  const pages = artifacts.artifacts?.find(item => item.name === "github-pages" && !item.expired);
  if (pages) return { mode: "artifact", runId: deployment.id, name: pages.name };
  // Older Pages artifacts had one-day retention. Only use a successful run of
  // our own notifier at that exact content commit, never a locally rebuilt site.
  const runs = await api(`/actions/workflows/notify-digests.yml/runs?head_sha=${deployment.head_sha}&status=success&per_page=100`);
  for (const run of runs.workflow_runs || []) {
    if (run.head_sha !== deployment.head_sha || run.head_branch !== "main" || run.conclusion !== "success"
      || run.path !== ".github/workflows/notify-digests.yml" || !["workflow_run", "workflow_dispatch"].includes(run.event)) continue;
    const data = await api(`/actions/runs/${run.id}/artifacts?per_page=100`);
    const artifact = data.artifacts?.find(item => item.name === `digest-notification-${run.id}-${run.run_attempt}` && !item.expired);
    if (artifact) return { mode: "manifest", runId: run.id, name: artifact.name };
  }
  throw new Error("No retained deployed artifact or trusted verification manifest; welcome cannot be sent");
}

export async function verifyWelcomeManifest({ manifest, snapshot, sha, deploymentRunId, siteUrl, fetchImpl = fetch }) {
  if (manifest.sha !== sha || String(manifest.deploymentRunId) !== String(deploymentRunId)
    || manifest.searchGzipMatches !== true || !Array.isArray(manifest.resources)) throw new Error("Welcome manifest does not identify the deployed artifact");
  const entries = new Map();
  for (const item of manifest.resources) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(item.path || "") || item.path.startsWith("/") || item.path.split("/").includes("..")
      || !fingerprint.test(item.sha256 || "") || entries.has(item.path)) throw new Error("Invalid verified resource manifest");
    entries.set(item.path, item);
  }
  const required = ["index.html", "digests/index.html", "reviews/index.html", "ideas/index.html", "landscape/index.html",
    "assets/notebook-search.json", "assets/notebook-search.json.gz", "assets/research-interests.json", `digests/${snapshot.id}/index.html`];
  for (const file of Object.keys(snapshot.sources)) {
    if (file.startsWith("content/papers/")) required.push(`papers/${path.basename(file, ".md")}/index.html`);
    if (file.startsWith("public/assets/papers/")) required.push(file.slice("public/".length));
  }
  if (required.some(file => !entries.has(file)) || ![...entries.keys()].some(file => file.startsWith("_astro/") && file.endsWith(".css"))) {
    throw new Error("Verified resource manifest does not cover the latest issue");
  }
  const queue = [...entries.values()]; const resources = []; const search = {};
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const item = queue.shift();
      const response = await fetchImpl(`${siteUrl.replace(/\/$/, "")}/${item.path}`, { cache: "no-store", headers: { "accept-encoding": "identity" }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Live welcome verification HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (sha256(bytes) !== item.sha256) throw new Error(`Live resource differs from verified deployed bytes: ${item.path}`);
      if (item.path.startsWith("assets/notebook-search.json")) search[item.path] = bytes;
      resources.push({ path: item.path, sha256: item.sha256 });
    }
  }));
  if (!gunzipSync(search["assets/notebook-search.json.gz"]).equals(search["assets/notebook-search.json"])) throw new Error("Search JSON/gzip differ");
  return { verifiedAt: new Date().toISOString(), resourceCount: resources.length, searchGzipMatches: true,
    source: "previously-verified-deployed-artifact-hashes", resources: resources.sort((a, b) => a.path.localeCompare(b.path)) };
}

export function recipientKey(email, key) {
  const [normalized] = parseRecipientsConfig([email]);
  return createHmac("sha256", receiptKey(key)).update(`paper-digest-welcome:${normalized}`).digest("hex");
}

export function welcomeRecipientState(data) {
  const state = parseRecipientState(data);
  if (!Array.isArray(data.welcomeBaselineRecipients)) {
    throw new Error("Initialize the frozen welcome baseline before enabling automatic welcomes");
  }
  const baseline = data.welcomeBaselineRecipients.length
    ? parseRecipientsConfig(data.welcomeBaselineRecipients) : [];
  return { ...state, baseline };
}

export function addSubscribers(data, emails) {
  const state = welcomeRecipientState(data);
  const requested = parseRecipientsConfig(emails.map(value => value.trim()));
  const added = requested.filter(email => !state.recipients.includes(email));
  return { data: { ...data, recipients: [...state.recipients, ...added] }, requested, added };
}

export function welcomeDecision(key, records, baseline = new Set()) {
  const parsed = records.map(record => ({ ...record,
    data: typeof record.payload === "string" ? JSON.parse(record.payload) : record.payload }));
  for (const { data } of parsed) {
    if (data?.schema !== 1 || !["attempt", "receipt"].includes(data.kind)
      || !fingerprint.test(data.recipientKey || "") || !fingerprint.test(data.fingerprint || "")
      || !digestId.test(data.issueId || "") || (data.kind === "receipt" && !outcomes.has(data.outcome))) {
      throw new Error("Malformed welcome ledger; no mail sent");
    }
  }
  const relevant = parsed.filter(record => record.data.recipientKey === key);
  const attempts = relevant.filter(record => record.data.kind === "attempt");
  const receipts = relevant.filter(record => record.data.kind === "receipt");
  for (const receipt of receipts) {
    if (!attempts.some(attempt => attempt.id === receipt.data.attemptId
      && attempt.data.issueId === receipt.data.issueId && attempt.data.fingerprint === receipt.data.fingerprint)) {
      throw new Error("Welcome receipt does not match its attempt");
    }
  }
  for (const attempt of attempts) {
    const receipt = receipts.filter(record => record.data.attemptId === attempt.id).sort((a, b) => b.id - a.id)[0];
    if (!receipt || !["sent", "not-sent"].includes(receipt.data.outcome)) {
      return { action: "blocked", reason: receipt ? `Previous welcome is ${receipt.data.outcome}` : "Welcome attempt has no receipt", attemptId: attempt.id };
    }
  }
  // Welcomes are deduplicated by recipient, independent of issue/version changes.
  if (receipts.some(record => record.data.outcome === "sent")) return { action: "skip", reason: "already-welcomed" };
  if (baseline.has(key)) return { action: "skip", reason: "legacy-onboarded-baseline" };
  return { action: "send" };
}

export function assertWelcomeKey(records, key) {
  const expected = sha256(receiptKey(key)).slice(0, 16);
  for (const record of records) {
    const data = typeof record.payload === "string" ? JSON.parse(record.payload) : record.payload;
    if (data?.keyId !== expected) throw new Error("Welcome receipt key changed; reconcile existing records before sending");
  }
}

export function welcomeMessage(snapshot, { recipient, from, sender, siteUrl }) {
  const [email] = parseRecipientsConfig([recipient]);
  const digest = { ...snapshot.digest, body: "", bodyHtml: "" };
  const sections = digestPaperGroups(digest).filter(group => group.papers.length);
  const url = `${siteUrl}/digests/${snapshot.id}/`;
  return {
    from, to: email, envelope: { from: sender, to: [email] },
    subject: `[Paper Digest 新成员指南] ${snapshot.id} ${digest.title}`,
    text: buildTextBody(digest, snapshot.id, url, "", sections, siteUrl, { welcome: true }),
    html: buildHtmlBody(digest, snapshot.id, url, "", sections, siteUrl, { welcome: true })
  };
}

export async function listWelcomeRecords(api) {
  const records = [];
  for (let page = 1; page <= 1000; page++) {
    const batch = await api(`/deployments?environment=${WELCOME_ENVIRONMENT}&task=${WELCOME_TASK}&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error("Invalid welcome ledger response");
    records.push(...batch);
    if (batch.length < 100) return records;
  }
  throw new Error("Welcome ledger pagination limit reached");
}

export function createWelcomeLedger(api, { sha, runUrl, key, receiptDirectory }) {
  const keyId = sha256(receiptKey(key)).slice(0, 16);
  const create = async data => {
    const record = await api("/deployments", { method: "POST", body: {
      ref: sha, task: WELCOME_TASK, environment: WELCOME_ENVIRONMENT,
      auto_merge: false, required_contexts: [], production_environment: false,
      description: `welcome ${data.kind} ${data.recipientKey.slice(0, 12)}`, payload: { ...data, keyId }
    } });
    if (!Number.isSafeInteger(record?.id)) throw new Error("GitHub did not confirm the welcome record");
    return record;
  };
  const status = (id, state) => api(`/deployments/${id}/statuses`, { method: "POST", body: { state, auto_inactive: false, log_url: runUrl } });
  return {
    async claim(snapshot, recipientId) {
      const attempt = await create({ schema: 1, kind: "attempt", recipientKey: recipientId,
        issueId: snapshot.id, fingerprint: snapshot.fingerprint, runUrl });
      await status(attempt.id, "in_progress");
      return attempt;
    },
    async persist(attempt, receipt) {
      const encrypted = encryptReceipt(receipt, key, `welcome:${receipt.recipientKey}:${attempt.id}`);
      await mkdir(receiptDirectory, { recursive: true, mode: 0o700 });
      await writeFile(path.join(receiptDirectory, `${attempt.id}.json`), `${JSON.stringify(encrypted, null, 2)}\n`, { mode: 0o600 });
      const record = await create({ schema: 1, kind: "receipt", attemptId: attempt.id,
        recipientKey: receipt.recipientKey, issueId: receipt.issueId, fingerprint: receipt.fingerprint,
        outcome: receipt.outcome, acceptedCount: receipt.acceptedCount ?? null,
        rejectedCount: receipt.rejectedCount ?? null, encrypted, runUrl });
      await status(record.id, receipt.outcome === "sent" ? "success" : "failure");
      await status(attempt.id, receipt.outcome === "sent" ? "success" : "failure");
      return record;
    }
  };
}

export async function executeWelcome({ snapshot, recipientId, decision, message, claim, persist, send, classifyError = () => false }) {
  if (decision.action !== "send") return decision;
  const recipients = message.envelope?.to;
  if (!Array.isArray(recipients) || recipients.length !== 1 || message.to !== recipients[0] || message.cc || message.bcc) {
    throw new Error("A welcome must have exactly one explicit envelope recipient");
  }
  const attempt = await claim(snapshot, recipientId);
  let result;
  try {
    const info = await send(message);
    const normalize = value => String(typeof value === "string" ? value : value?.address || "").toLowerCase();
    const accepted = (info.accepted || []).map(normalize), rejected = (info.rejected || []).map(normalize);
    const outcome = Array.isArray(info.accepted) && accepted.length === 1 && accepted[0] === recipients[0] && rejected.length === 0
      ? "sent" : accepted.length === 0 && rejected.includes(recipients[0]) ? "rejected" : "unknown";
    result = { outcome, acceptedCount: Array.isArray(info.accepted) ? accepted.length : null,
      rejectedCount: Array.isArray(info.rejected) ? rejected.length : null, transportResponse: info };
  } catch (error) {
    result = { outcome: classifyError(error) ? "not-sent" : "unknown", acceptedCount: null, rejectedCount: null,
      error: { code: String(error.code || "unknown"), command: String(error.command || ""), responseCode: error.responseCode || null } };
  }
  await persist(attempt, { ...result, recipientKey: recipientId, issueId: snapshot.id, fingerprint: snapshot.fingerprint,
    attemptedAt: new Date().toISOString(), message });
  if (result.outcome !== "sent") throw new Error(`Welcome ${result.outcome}; inspect its encrypted receipt before retrying`);
  return { action: "sent", attemptId: attempt.id, acceptedCount: result.acceptedCount, rejectedCount: result.rejectedCount };
}

export async function runWelcomes({ snapshot, config, api, key, sha, runUrl, directory, from, sender, siteUrl, send, classifyError }) {
  const state = welcomeRecipientState(config);
  const records = await listWelcomeRecords(api);
  assertWelcomeKey(records, key);
  const baseline = new Set(state.baseline.map(email => recipientKey(email, key)));
  const ledger = createWelcomeLedger(api, { sha, runUrl, key, receiptDirectory: path.join(directory, "receipts") });
  const plans = state.recipients.map(recipient => {
    const recipientId = recipientKey(recipient, key);
    return { recipient, recipientId, decision: welcomeDecision(recipientId, records, baseline) };
  });
  const results = [];
  for (const { recipient, recipientId, decision } of plans) {
    try {
      const result = await executeWelcome({ snapshot, recipientId, decision,
        message: welcomeMessage(snapshot, { recipient, from, sender, siteUrl }),
        claim: ledger.claim, persist: ledger.persist, send, classifyError });
      results.push({ recipientKey: recipientId, ...result });
    } catch (error) {
      results.push({ recipientKey: recipientId, action: "failed", reason: error.message });
    }
  }
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "summary.json"), `${JSON.stringify({ sha, latestIssue: snapshot.id, results }, null, 2)}\n`);
  return results;
}
