#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncNotificationSecrets } from "./configure-notifications.mjs";
import { parseRecipientState, parseRecipientsConfig } from "./email-publish.mjs";
import { assertDeploymentRun, decryptReceipt, digestSnapshots } from "./digest-notification.mjs";
import { addSubscribers, assertWelcomeKey, createWelcomeLedger, listWelcomeRecords, recipientKey, welcomeDecision, welcomeRecipientState } from "./welcome-notification.mjs";

const repository = "CrazyShout/paper-digest";
const file = "config/email-recipients.local.json";
const json = async pathname => JSON.parse(await readFile(pathname, "utf8"));
const keyValue = async () => (await json("config/notification-secrets.local.json")).receiptKey;
export async function withSubscriberLock(action, lock = "config/.env.subscriber-lock") {
  try {
    await writeFile(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("Subscriber update is locked; inspect the recorded process before removing a stale lock");
    throw error;
  }
  try { return await action(); } finally { await unlink(lock); }
}
async function save(data) {
  // .env.* is ignored even if a process exits before the atomic rename.
  const temporary = `config/.env.recipients-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}
export async function localApi(pathname, options = {}) {
  const args = ["api", `repos/${repository}${pathname}`];
  if (options.method) args.push("--method", options.method);
  if (options.body) args.push("--input", "-");
  try {
    const raw = execFileSync("gh", args, { encoding: "utf8", input: options.body ? JSON.stringify(options.body) : undefined,
      stdio: ["pipe", "pipe", "pipe"], timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
    return raw.trim() ? JSON.parse(raw) : null;
  } catch { throw new Error(`GitHub request failed (${options.method || "GET"} ${pathname.split("?")[0]}); do not retry an uncertain receipt import blindly`); }
}

export async function dispatchWelcomes() {
  const data = await localApi("/actions/workflows/deploy-pages.yml/runs?branch=main&status=success&per_page=100");
  const run = data.workflow_runs?.find(item => item.head_branch === "main" && item.conclusion === "success");
  if (!run) throw new Error("Subscriber list is saved; welcome awaits a successful Pages deployment");
  assertDeploymentRun(run, { sha: run.head_sha, repository });
  await localApi("/actions/workflows/notify-digests.yml/dispatches", { method: "POST",
    body: { ref: "main", inputs: { deployment_run_id: String(run.id), welcome_only: "true" } } });
  console.log("Queued the protected welcome workflow for the latest published issue. No direct SMTP send.");
}

export async function welcomeStatus(emails) {
  const state = welcomeRecipientState(await json(file));
  const requested = emails?.length ? parseRecipientsConfig(emails) : state.recipients;
  if (requested.some(email => !state.recipients.includes(email))) throw new Error("Status target must be in the current subscriber list");
  const key = await keyValue();
  const baseline = new Set(state.baseline.map(email => recipientKey(email, key)));
  const records = await listWelcomeRecords(localApi);
  assertWelcomeKey(records, key);
  const results = requested.map(email => ({ email, ...welcomeDecision(recipientKey(email, key), records, baseline) }));
  const latest = welcomeRecipientState(await json(file));
  const completed = results.filter(item => item.action === "skip").map(item => item.email);
  await save({ ...latest.data, onboardedRecipients: [...new Set([...latest.onboardedRecipients, ...completed])].filter(email => latest.recipients.includes(email)) });
  return { completed: completed.length, pending: results.filter(item => item.action === "send").length,
    blocked: results.filter(item => item.action === "blocked").length };
}

async function add(emails) {
  const result = addSubscribers(await json(file), emails);
  await save(result.data);
  await syncNotificationSecrets();
  let status = await welcomeStatus(result.requested);
  if (status.blocked) throw new Error("An unresolved welcome receipt blocks sending; reconcile provider evidence first");
  if (status.pending) {
    await dispatchWelcomes();
    const deadline = Date.now() + 10 * 60 * 1000;
    while (status.pending && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 15000));
      status = await welcomeStatus(result.requested);
      // A claim without its receipt can be a currently running send. Continue
      // observing; never dispatch again or turn it into another SMTP attempt.
      if (status.blocked) {
        while (status.blocked && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 15000));
          status = await welcomeStatus(result.requested);
        }
      }
    }
  }
  console.log(JSON.stringify({ added: result.added.length, ...status }));
  if (status.pending || status.blocked) throw new Error("Welcome is not confirmed; inspect email:welcome:status and the retained receipt. No resend was requested.");
}

export async function importWelcomeReceipt(encryptedPath, attemptId) {
  const key = await keyValue();
  const receipt = decryptReceipt(await json(encryptedPath), key);
  const email = receipt.message?.to;
  const state = welcomeRecipientState(await json(file));
  if (!state.recipients.includes(email) || receipt.message.cc || receipt.message.bcc
    || JSON.stringify(receipt.message.envelope?.to) !== JSON.stringify([email])) throw new Error("Import requires a confirmed single-recipient welcome");
  const verifiedGmail = receipt.provider === "gmail" && receipt.messageId
    && ["sent", "fromMatches", "onlyRequestedRecipient", "subjectMatches", "textMatches", "htmlMatches", "papersPresent"].every(name => receipt.checks?.[name] === true);
  const accepted = receipt.transport?.accepted;
  const verifiedSmtp = Array.isArray(accepted) && accepted.length === 1 && accepted[0] === email && receipt.transport?.rejected?.length === 0 && receipt.transport?.messageId;
  if (receipt.outcome !== "sent" || (!verifiedGmail && !verifiedSmtp)) throw new Error("Provider-confirmed welcome evidence is required");
  const snapshot = (await digestSnapshots()).find(item => item.id === (receipt.issueId || receipt.issue));
  if (!snapshot || snapshot.fingerprint !== receipt.fingerprint) throw new Error("Receipt content does not match the recorded issue");
  const recipientId = recipientKey(email, key);
  const records = await listWelcomeRecords(localApi);
  assertWelcomeKey(records, key);
  const decision = welcomeDecision(recipientId, records);
  if (decision.reason === "already-welcomed") { console.log("Welcome receipt already recorded; nothing sent."); return; }
  if (decision.action === "blocked" && !attemptId) throw new Error("An unresolved welcome attempt requires its exact attempt ID");
  const current = await localApi("/commits/main");
  const ledger = createWelcomeLedger(localApi, { sha: current.sha, runUrl: `https://github.com/${repository}/commit/${current.sha}`,
    key, receiptDirectory: "docs/email-welcomes/imported" });
  let attempt;
  if (attemptId) {
    attempt = records.find(item => item.id === Number(attemptId));
    const data = typeof attempt?.payload === "string" ? JSON.parse(attempt.payload) : attempt?.payload;
    assert.ok(data?.kind === "attempt" && data.recipientKey === recipientId && data.issueId === snapshot.id && data.fingerprint === snapshot.fingerprint,
      "Import attempt does not match recipient and issue");
  } else attempt = await ledger.claim(snapshot, recipientId);
  await ledger.persist(attempt, { ...receipt, recipientKey: recipientId, issueId: snapshot.id, importedAt: new Date().toISOString() });
  console.log("Imported the encrypted provider-confirmed welcome receipt. No email sent.");
}

export async function main([command, ...args] = process.argv.slice(2)) {
  if (command === "add") return add(args);
  if (command === "dispatch") return dispatchWelcomes();
  if (command === "status") { const status = await welcomeStatus(args); console.log(JSON.stringify(status)); return; }
  if (command === "import-receipt") return importWelcomeReceipt(args[0], args[1]);
  if (command === "initialize") {
    const data = await json(file);
    if (Object.hasOwn(data, "welcomeBaselineRecipients")) throw new Error("Welcome baseline already exists; never regenerate it to suppress pending mail");
    const state = parseRecipientState(data);
    const base = Array.isArray(data) ? { recipients: state.recipients, onboardedRecipients: state.onboardedRecipients } : data;
    await save({ ...base, welcomeBaselineRecipients: state.onboardedRecipients, welcomeBaselineCapturedAt: new Date().toISOString() });
    console.log(`Captured ${state.onboardedRecipients.length} legacy onboarding entries. This is not proof of historical delivery.`);
    return;
  }
  throw new Error("Usage: subscribers.mjs add <email...>|dispatch|status [email...]|initialize|import-receipt <encrypted-file> [attempt-id]");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const action = () => main(args);
  const run = ["add", "status", "initialize"].includes(args[0]) ? withSubscriberLock(action) : action();
  run.catch(error => { console.error(error.message); process.exitCode = 1; });
}
