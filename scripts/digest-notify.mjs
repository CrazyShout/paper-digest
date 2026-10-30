#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { runWelcomes, verifyWelcomeManifest, welcomeRecipientState, welcomeVerificationInput } from "./welcome-notification.mjs";
import { buildTransportOptions, isRetryableSmtpError, parseRecipientsConfig, withSmtpRetry } from "./email-publish.mjs";
import {
  assertDeploymentRun, createLedger, decryptReceipt, digestMessage, digestSnapshots, gitBlobSha256,
  executeNotification, githubApi, listNotificationRecords, notificationDecision,
  publicSnapshot, receiptKey, sha256, verifyLiveArtifact
} from "./digest-notification.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW = "notify-digests.yml";
const SITE = "https://crazyshout.github.io/paper-digest";

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function apiClient() {
  const repository = process.env.GITHUB_REPOSITORY || "CrazyShout/paper-digest";
  const token = process.env.GITHUB_TOKEN || execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
  return { repository, api: (pathname, options) => githubApi(repository, token, pathname, options) };
}

export async function dispatchNotification(digestId) {
  if (!/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/.test(digestId || "")) throw new Error("A valid digest ID is required");
  const { repository, api } = apiClient();
  const sha = git("rev-parse", "HEAD");
  if (git("status", "--porcelain", "content", "config/research-interests.json", "public/assets/papers")) throw new Error("Commit digest content before requesting notification");
  const data = await api(`/actions/workflows/deploy-pages.yml/runs?head_sha=${sha}&status=success&per_page=100`);
  const run = data.workflow_runs?.find((item) => item.head_sha === sha && item.conclusion === "success");
  if (!run) throw new Error("No successful Pages run for HEAD; push and wait for deployment first");
  assertDeploymentRun(run, { sha, repository });
  await api(`/actions/workflows/${WORKFLOW}/dispatches`, { method: "POST", body: { ref: "main", inputs: { deployment_run_id: String(run.id), digest_id: digestId } } });
  console.log(`Queued guarded notification for ${digestId}; delivery is not yet confirmed. Check the Notify digest subscribers workflow.`);
}

async function prepare() {
  const { api, repository } = apiClient();
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const id = process.env.GITHUB_EVENT_NAME === "workflow_run" ? event.workflow_run?.id : event.inputs?.deployment_run_id;
  if (!/^\d+$/.test(String(id || ""))) throw new Error("A successful Pages run ID is required");
  const run = await api(`/actions/runs/${id}`);
  assertDeploymentRun(run, { sha: run.head_sha, repository });
  const welcomeOnly = process.env.GITHUB_EVENT_NAME === "workflow_dispatch" && String(event.inputs?.welcome_only) === "true";
  const current = await api("/commits/main");
  if (!welcomeOnly && current.sha !== run.head_sha) throw new Error("This deployment has been superseded; notify from the current deployment");
  const digestId = process.env.GITHUB_EVENT_NAME === "workflow_dispatch" ? String(event.inputs?.digest_id || "") : "";
  if (digestId && !/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/.test(digestId)) throw new Error("Invalid digest ID");
  const verification = welcomeOnly ? await welcomeVerificationInput(api, run) : { mode: "artifact", runId: id, name: "github-pages" };
  await appendFile(process.env.GITHUB_OUTPUT, `sha=${run.head_sha}\ncode_sha=${welcomeOnly ? current.sha : run.head_sha}\ndeployment_run_id=${id}\ndigest_id=${digestId}\nwelcome_only=${welcomeOnly}\nverification_mode=${verification.mode}\nartifact_run_id=${verification.runId}\nartifact_name=${verification.name}\n`);
}

async function run() {
  if (process.env.GITHUB_ACTIONS !== "true") throw new Error("Sending runs only in the serialized notification workflow; use npm run email:publish -- <issue>");
  const { api, repository } = apiClient();
  const sha = git("rev-parse", "HEAD");
  const deploymentRunId = process.env.DIGEST_DEPLOYMENT_RUN_ID;
  if (!/^\d+$/.test(deploymentRunId || "")) throw new Error("Missing Pages deployment run ID");
  const deployment = await api(`/actions/runs/${deploymentRunId}`);
  const welcomeOnly = process.env.WELCOME_ONLY === "true";
  const contentSha = welcomeOnly ? deployment.head_sha : sha;
  assertDeploymentRun(deployment, { sha: contentSha, repository });
  const current = await api("/commits/main");
  if (current.sha !== sha) throw new Error("Checked-out release is no longer main; wait for its replacement deployment");
  const baseline = JSON.parse(await readFile(path.join(ROOT, "config/digest-notification-baseline.json"), "utf8"));
  const exclusions = JSON.parse(await readFile(path.join(ROOT, "config/digest-notification-exclusions.json"), "utf8"));
  const all = await digestSnapshots(ROOT);
  if (welcomeOnly) {
    // Welcome-only runs use restored published content, not unshipped reports
    // from the newer automation commit. Check provenance before SMTP or claims.
    for (const [file, expected] of Object.entries(all[0].sources)) {
      if (await gitBlobSha256(contentSha, file, ROOT) !== expected) throw new Error(`Welcome content differs from its deployed commit: ${file}`);
    }
    const labelsFile = "config/research-interests.json";
    if (await gitBlobSha256(contentSha, labelsFile, ROOT) !== sha256(await readFile(path.join(ROOT, labelsFile)))) {
      throw new Error("Welcome direction labels differ from the deployed commit");
    }
  }
  const targets = process.env.DIGEST_ID ? all.filter((item) => item.id === process.env.DIGEST_ID) : all;
  if (!targets.length) throw new Error("No matching digest");
  const records = await listNotificationRecords(api);
  const plans = (welcomeOnly ? [] : targets).map((snapshot) => {
    const decision = notificationDecision(snapshot, records, baseline.digests);
    const exclusion = exclusions.versions?.[`${snapshot.id}:${snapshot.fingerprint}`];
    if (exclusion?.reason && decision.action === "send") return { snapshot, decision: { action: "skip", reason: "explicit-user-exclusion" } };
    return { snapshot, decision };
  });
  const verifyTargets = plans.filter((item) => item.decision.action === "send").map((item) => item.snapshot);
  if (!verifyTargets.some(snapshot => snapshot.id === all[0].id)) verifyTargets.push(all[0]);
  const directory = path.join(ROOT, ".generated/published-site");
  const manifestMode = welcomeOnly && process.env.VERIFICATION_MODE === "manifest";
  const verification = manifestMode
    ? await verifyWelcomeManifest({ manifest: JSON.parse(await readFile(path.join(ROOT, ".generated/verification-input/notification-checks/live.json"), "utf8")),
      snapshot: all[0], sha: contentSha, deploymentRunId, siteUrl: SITE })
    : await verifyLiveArtifact({ directory, siteUrl: SITE, snapshots: verifyTargets });
  await mkdir(path.join(ROOT, ".generated/notification-checks"), { recursive: true });
  await writeFile(path.join(ROOT, ".generated/notification-checks/live.json"), `${JSON.stringify({ deploymentRunId, sha: contentSha, codeSha: sha,
    verificationRunId: process.env.VERIFICATION_RUN_ID || deploymentRunId, ...verification }, null, 2)}\n`);
  if (!process.env.DIGEST_SMTP_JSON || !process.env.DIGEST_RECIPIENTS_JSON || !process.env.DIGEST_RECEIPT_KEY) {
    throw new Error("Live verification passed; notification Secrets are not configured. No email was attempted.");
  }
  const config = JSON.parse(process.env.DIGEST_SMTP_JSON);
  const recipientConfig = JSON.parse(process.env.DIGEST_RECIPIENTS_JSON);
  welcomeRecipientState(recipientConfig);
  const recipients = parseRecipientsConfig(recipientConfig);
  const key = process.env.DIGEST_RECEIPT_KEY;
  receiptKey(key);
  if (!config || config.rejectUnauthorized === false) throw new Error("SMTP configuration with TLS verification is required");
  const from = config.from || config.user;
  if (!from || !config.user || !config.pass) throw new Error("SMTP sender and credentials are required");
  const options = buildTransportOptions(config);
  if (!options.tls.rejectUnauthorized) throw new Error("SMTP TLS verification cannot be disabled");
  // Verify transport even when every issue is already accounted for, so setup
  // cannot look healthy merely because this run did not need to send mail.
  const probe = nodemailer.createTransport(options);
  try { await probe.verify(); } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error.code || "") ? error.code : "unknown";
    throw new Error(`SMTP connection/authentication check failed (${code}); no notification was attempted`);
  }
  finally { probe.close(); }
  const runUrl = `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const receiptDirectory = path.join(ROOT, ".generated/notification-receipts");
  const ledger = createLedger(api, { sha, runUrl, key, receiptDirectory });
  const results = [];
  for (const { snapshot, decision } of plans) {
    if (decision.action === "blocked") {
      results.push({ issue: snapshot.id, action: "blocked", reason: decision.reason });
      continue;
    }
    const message = digestMessage(snapshot, { siteUrl: SITE, recipients, from, to: config.user, previous: decision.previous });
    try {
      const result = await executeNotification({ snapshot, decision, message, claim: ledger.claim, persist: ledger.persist,
        classifyError: (error) => isRetryableSmtpError(error) || error.code === "EAUTH",
        send: (mail) => withSmtpRetry(async () => {
          const transport = nodemailer.createTransport(options);
          try { return await transport.sendMail(mail); } finally { transport.close(); }
        }, { retries: 2 })
      });
      results.push({ issue: snapshot.id, ...result });
    } catch (error) {
      results.push({ issue: snapshot.id, action: "failed", reason: error.message });
    }
  }
  await writeFile(path.join(ROOT, ".generated/notification-checks/summary.json"), `${JSON.stringify({ sha: contentSha, codeSha: sha, deploymentRunId, verification: { resourceCount: verification.resourceCount, searchGzipMatches: true }, results }, null, 2)}\n`);
  const welcomes = await runWelcomes({ snapshot: all[0], config: recipientConfig, api, key, sha: contentSha, runUrl,
    directory: path.join(ROOT, ".generated/welcome-notifications"), from, sender: config.user, siteUrl: SITE,
    classifyError: error => isRetryableSmtpError(error) || error.code === "EAUTH",
    send: async mail => {
      const transport = nodemailer.createTransport(options);
      try { return await transport.sendMail(mail); } finally { transport.close(); }
    }
  });
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `Verified deployment: ${deploymentRunId}, content commit \`${contentSha}\`, code commit \`${sha}\`.\n\n| Issue | Notification |\n| --- | --- |\n${results.map((item) => `| ${item.issue} | ${item.action}${item.reason ? `: ${item.reason}` : ""} |`).join("\n")}\n\nReceipts describe provider acceptance, not recipient inbox delivery.\n`);
  console.log(JSON.stringify(results));
  console.log(`Welcome notifications: ${welcomes.filter(item => item.action === "sent").length} sent, ${welcomes.filter(item => item.action === "skip").length} skipped.`);
  if ([...results, ...welcomes].some((item) => ["blocked", "failed"].includes(item.action))) throw new Error("Some notifications remain unresolved; inspect the retained encrypted receipts");
}

async function importReceipt(evidenceFile, attemptId) {
  const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
  if (evidence.status !== "sent-and-readback-verified" || !Object.values(evidence.checks || {}).length || !Object.values(evidence.checks).every(Boolean)
    || !evidence.messageId || !evidence.contentCommit) throw new Error("Import requires a provider-confirmed readback receipt with content commit");
  const { api, repository } = apiClient();
  const snapshot = (await digestSnapshots(ROOT)).find((item) => item.id === evidence.issueId);
  if (!snapshot) throw new Error("Receipt issue does not exist");
  for (const [file, expected] of Object.entries(snapshot.sources)) {
    if (await gitBlobSha256(evidence.contentCommit, file, ROOT) !== expected) throw new Error(`Receipt content changed since confirmed delivery: ${file}`);
  }
  const records = await listNotificationRecords(api);
  const decision = notificationDecision(snapshot, records);
  if (decision.action === "skip") { console.log("Existing receipt already recorded"); return; }
  if (decision.action === "blocked" && !attemptId) throw new Error("An unresolved attempt requires the reconcile command and provider-confirmed readback");
  const key = process.env.DIGEST_RECEIPT_KEY || (JSON.parse(await readFile(path.join(ROOT, "config/notification-secrets.local.json"), "utf8"))).receiptKey;
  const ledger = createLedger(api, { sha: evidence.contentCommit, runUrl: `https://github.com/${repository}/commit/${evidence.contentCommit}`, key, receiptDirectory: path.join(ROOT, ".generated/notification-receipts") });
  let attempt;
  if (attemptId) {
    if (!/^\d+$/.test(attemptId)) throw new Error("Invalid attempt ID");
    attempt = records.find((record) => record.id === Number(attemptId));
    const data = typeof attempt?.payload === "string" ? JSON.parse(attempt.payload) : attempt?.payload;
    if (data?.kind !== "attempt" || data.issueId !== snapshot.id || data.fingerprint !== snapshot.fingerprint) throw new Error("Reconciliation evidence does not match the pending version");
  } else attempt = await ledger.claim(snapshot);
  const providerReceipt = evidence.privateReceipt
    ? JSON.parse(await readFile(path.resolve(path.dirname(evidenceFile), evidence.privateReceipt), "utf8")) : null;
  await ledger.persist(attempt, { ...evidence, providerReceipt, outcome: "sent", fingerprint: snapshot.fingerprint, acceptedCount: evidence.acceptedRecipientCount, rejectedCount: evidence.rejectedRecipientCount, importedAt: new Date().toISOString() });
  console.log(`Imported confirmed receipt for ${snapshot.id}; no email was sent`);
}

async function main([command, arg, output] = process.argv.slice(2)) {
  if (command === "prepare") return prepare();
  if (command === "run") return run();
  if (command === "dispatch") return dispatchNotification(arg);
  if (command === "import-receipt") return importReceipt(arg);
  if (command === "reconcile") return importReceipt(arg, output);
  if (command === "exclude") {
    if (!output?.trim()) throw new Error("Record the user's explicit no-email instruction as the reason");
    const snapshot = (await digestSnapshots(ROOT)).find((item) => item.id === arg);
    if (!snapshot) throw new Error("Issue not found");
    const file = path.join(ROOT, "config/digest-notification-exclusions.json");
    const exclusions = JSON.parse(await readFile(file, "utf8"));
    exclusions.versions[`${snapshot.id}:${snapshot.fingerprint}`] = { reason: output, recordedAt: new Date().toISOString() };
    await writeFile(file, `${JSON.stringify(exclusions, null, 2)}\n`);
    console.log("Recorded exclusion for this exact version; commit it with the release");
    return;
  }
  if (command === "baseline") {
    const snapshots = await digestSnapshots(ROOT);
    const data = { schema: 1, capturedAt: new Date().toISOString(), commit: git("rev-parse", "HEAD"),
      note: "Frozen pre-automation content baseline. This does not assert historical email delivery. Never regenerate to clear a pending notification.",
      digests: Object.fromEntries(snapshots.map((snapshot) => [snapshot.id, publicSnapshot(snapshot)])) };
    await writeFile(path.join(ROOT, "config/digest-notification-baseline.json"), `${JSON.stringify(data, null, 2)}\n`, { flag: "wx" });
    console.log(`Captured ${snapshots.length} existing issues; no mail sent`);
    return;
  }
  if (command === "decrypt") {
    if (!output) throw new Error("Supply encrypted receipt input and private output path");
    const key = process.env.DIGEST_RECEIPT_KEY || (JSON.parse(await readFile(path.join(ROOT, "config/notification-secrets.local.json"), "utf8"))).receiptKey;
    const receipt = decryptReceipt(JSON.parse(await readFile(arg, "utf8")), key);
    await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    console.log("Decrypted receipt written to the requested private file");
    return;
  }
  throw new Error("Usage: digest-notify.mjs prepare|run|dispatch <issue>|import-receipt <file>|decrypt <input> <private-output>");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
