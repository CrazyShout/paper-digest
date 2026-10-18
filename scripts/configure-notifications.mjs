#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildTransportOptions, parseRecipientState } from "./email-publish.mjs";
import { receiptKey } from "./digest-notification.mjs";

const repository = "CrazyShout/paper-digest";
try {
  const smtp = JSON.parse(await readFile("config/smtp.local.json", "utf8"));
  const state = parseRecipientState(JSON.parse(await readFile("config/email-recipients.local.json", "utf8")));
  const options = buildTransportOptions(smtp);
  if (!options.auth?.user || !options.auth?.pass || !options.tls.rejectUnauthorized) throw new Error("Valid SMTP credentials and TLS verification are required");
  let local;
  try {
    local = JSON.parse(await readFile("config/notification-secrets.local.json", "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    local = { receiptKey: randomBytes(32).toString("base64") };
    await writeFile("config/notification-secrets.local.json", `${JSON.stringify(local, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  }
  receiptKey(local.receiptKey);
  const secrets = {
    DIGEST_SMTP_JSON: JSON.stringify(smtp),
    DIGEST_RECIPIENTS_JSON: JSON.stringify({ recipients: state.recipients }),
    DIGEST_RECEIPT_KEY: local.receiptKey
  };
  for (const [name, value] of Object.entries(secrets)) {
    try {
      execFileSync("gh", ["secret", "set", name, "--repo", repository], { input: value, stdio: ["pipe", "pipe", "pipe"] });
    } catch { throw new Error(`Could not update repository Secret ${name}; no values were logged`); }
  }
  console.log(`Notification Secrets synchronized for ${repository}; ${state.recipients.length} subscribers. No email sent.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
