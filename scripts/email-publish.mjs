#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDigests } from "../src/lib/content.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(SCRIPT_DIR, "..");
const CONFIG = path.join(ROOT, "config");
const DEFAULT_SITE_URL = "https://crazyshout.github.io/paper-digest";
const DEFAULT_RECIPIENTS = ["7608331@qq.com"];
const DEFAULT_SMTP_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 800;
const DEFAULT_CONNECTION_TIMEOUT_MS = 15_000;
const DEFAULT_GREETING_TIMEOUT_MS = 10_000;
const DEFAULT_SOCKET_TIMEOUT_MS = 30_000;
const EMAIL_LIST_PATH = path.join(CONFIG, "email-recipients.local.json");
const SMTP_CONFIG_PATH = path.join(CONFIG, "smtp.local.json");
const FEISHU_PUBLICATIONS_PATH = path.join(CONFIG, "feishu-publications.json");

let nodemailer;
try {
  nodemailer = await import("nodemailer");
} catch {
  throw new Error("请先安装 nodemailer 依赖：npm install");
}

function usage() {
  console.error("Usage: npm run email:check");
  console.error("       npm run email:preview -- <digest-id>");
  console.error("       npm run email:publish -- <digest-id>");
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = normalizeString(value).toLowerCase();
  if (!text) return fallback;
  if (["1", "true", "yes", "on", "y"].includes(text)) return true;
  if (["0", "false", "no", "off", "n"].includes(text)) return false;
  return fallback;
}

function normalizeNumber(value, fallback, options = {}) {
  const number = Number(value);
  if (Number.isNaN(number)) return fallback;
  if (options.min !== undefined && number < options.min) return fallback;
  if (options.max !== undefined && number > options.max) return fallback;
  return number;
}

function siteUrl(config = {}) {
  return String(
    config.siteUrl ||
      process.env.PAPER_DIGEST_SITE_URL ||
      process.env.PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      DEFAULT_SITE_URL
  ).replace(/\/$/, "");
}

function loadOptionalJson(pathname) {
  return readFile(pathname, "utf8")
    .then((text) => JSON.parse(text))
    .then((data) => (typeof data === "object" && data !== null ? data : {}))
    .catch((error) => {
      if (error.code === "ENOENT") return {};
      throw error;
    });
}

async function loadSmtpConfig() {
  const envSiteUrl = process.env.PAPER_DIGEST_SITE_URL || process.env.PUBLIC_SITE_URL || process.env.SITE_URL;
  try {
    const config = await loadOptionalJson(SMTP_CONFIG_PATH);
    const siteConfigUrl = config.siteUrl ?? config.PAPER_DIGEST_SITE_URL;
    const port = normalizeNumber(
      config.port ?? config.SMTP_PORT ?? process.env.SMTP_PORT ?? 587,
      587,
      { min: 1, max: 65_535 }
    );
    return {
      host: normalizeString(config.host ?? config.SMTP_HOST ?? process.env.SMTP_HOST),
      port,
      secure: normalizeBoolean(config.secure ?? config.SMTP_SECURE ?? process.env.SMTP_SECURE, port === 465),
      user: normalizeString(config.user ?? config.SMTP_USER ?? process.env.SMTP_USER),
      pass: normalizeString(config.pass ?? config.SMTP_PASS ?? process.env.SMTP_PASS),
      rejectUnauthorized: normalizeBoolean(config.rejectUnauthorized ?? config.SMTP_REJECT_UNAUTHORIZED ?? process.env.SMTP_REJECT_UNAUTHORIZED, true),
      from: normalizeString(config.from ?? config.EMAIL_FROM ?? process.env.EMAIL_FROM),
      siteUrl: normalizeString(siteConfigUrl || envSiteUrl),
      retries: Math.floor(normalizeNumber(
        config.retries ?? config.SMTP_RETRIES ?? process.env.SMTP_RETRIES ?? DEFAULT_SMTP_RETRIES,
        DEFAULT_SMTP_RETRIES,
        { min: 0, max: 5 }
      )),
      retryDelayMs: Math.floor(normalizeNumber(
        config.retryDelayMs ?? config.SMTP_RETRY_DELAY_MS ?? process.env.SMTP_RETRY_DELAY_MS ?? DEFAULT_RETRY_DELAY_MS,
        DEFAULT_RETRY_DELAY_MS,
        { min: 0, max: 10_000 }
      )),
      connectionTimeout: Math.floor(normalizeNumber(
        config.connectionTimeout ?? config.SMTP_CONNECTION_TIMEOUT ?? process.env.SMTP_CONNECTION_TIMEOUT ?? DEFAULT_CONNECTION_TIMEOUT_MS,
        DEFAULT_CONNECTION_TIMEOUT_MS,
        { min: 1_000, max: 120_000 }
      )),
      greetingTimeout: Math.floor(normalizeNumber(
        config.greetingTimeout ?? config.SMTP_GREETING_TIMEOUT ?? process.env.SMTP_GREETING_TIMEOUT ?? DEFAULT_GREETING_TIMEOUT_MS,
        DEFAULT_GREETING_TIMEOUT_MS,
        { min: 1_000, max: 120_000 }
      )),
      socketTimeout: Math.floor(normalizeNumber(
        config.socketTimeout ?? config.SMTP_SOCKET_TIMEOUT ?? process.env.SMTP_SOCKET_TIMEOUT ?? DEFAULT_SOCKET_TIMEOUT_MS,
        DEFAULT_SOCKET_TIMEOUT_MS,
        { min: 1_000, max: 300_000 }
      ))
    };
  } catch (error) {
    throw new Error(`读取SMTP配置失败：${error.message}`);
  }
}

function escapeText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return String(value || "").replaceAll('"', "&quot;");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueEmails(values) {
  const result = [];
  const seen = new Set();

  for (const item of values) {
    const value = normalizeEmail(item);
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function isValidEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

async function loadRecipients() {
  try {
    const text = await readFile(EMAIL_LIST_PATH, "utf8");
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : (Array.isArray(data?.recipients) ? data.recipients : []);
    const valid = uniqueEmails(list.filter(isValidEmail));
    return valid.length ? valid : uniqueEmails(DEFAULT_RECIPIENTS);
  } catch (error) {
    if (error.code === "ENOENT") {
      return uniqueEmails(DEFAULT_RECIPIENTS);
    }
    throw new Error(`读取邮箱配置失败：${error.message}`);
  }
}

async function loadFeishuLink(digestId) {
  try {
    const text = await readFile(FEISHU_PUBLICATIONS_PATH, "utf8");
    const data = JSON.parse(text);
    return data?.publications?.[digestId]?.url || "";
  } catch (error) {
    if (error.code === "ENOENT") return "";
    return "";
  }
}

function collectPapersByDirection(digest) {
  return digest.tags.map((tag) => ({
    tag,
    papers: digest.papers.filter((paper) => paper.tags.includes(tag.id))
  }));
}

function buildEmailSubject(digestId, digest) {
  return `[Paper Digest] ${digestId} ${digest.title}`;
}

function buildTextBody(digest, digestId, digestUrl, feishuUrl, sections, currentSiteUrl) {
  const lines = [];
  lines.push(`[Paper Digest] ${digestId} ${digest.title}`);
  lines.push(`日期：${digest.displayDate || digest.date}`);
  lines.push(`关键词：${(digest.keywords || []).join(" / ")}`);
  lines.push(`摘要：${digest.summary}`);
  lines.push("");
  lines.push(`网页端：${digestUrl}`);
  if (feishuUrl) {
    lines.push(`飞书：${feishuUrl}`);
  }
  lines.push("");
  lines.push("本期方向：");
  for (const { tag, papers } of sections) {
    lines.push(`- ${tag.label}（${papers.length} 篇）`);
    for (const paper of papers) {
      const paperUrl = `${currentSiteUrl}/papers/${paper.id}/index.html`;
      lines.push(`  ${paper.title}`);
      lines.push(`    ${paperUrl}`);
      lines.push(`    ${paper.comment}`);
    }
    lines.push("");
  }

  lines.push("发送时间： " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }));
  lines.push("");
  return lines.join("\n");
}

function buildHtmlBody(digest, digestId, digestUrl, feishuUrl, sections, currentSiteUrl) {
  const sectionBlocks = sections
    .map((item) => {
      const paperList = item.papers
        .map((paper) => {
          const paperUrl = `${currentSiteUrl}/papers/${paper.id}/index.html`;
          const authors = (paper.authors || []).join("，");
          const tags = (paper.tags || []).join(" / ");
          return `
            <li style="margin-bottom:12px;">
              <a href="${escapeAttr(paperUrl)}" style="color:#1f6feb;">${escapeText(paper.title)}</a><br/>
              ${escapeText(paper.comment)}<br/>
              <span style="font-size:12px;color:#59616d;">${escapeText(authors)}${authors ? " / " : ""}${escapeText(tags)}</span>
            </li>
          `.trim();
        })
        .join("");

      return `
        <h3>${escapeText(item.tag.label)}（${item.papers.length}篇）</h3>
        <ul style="padding-left:20px;margin:10px 0;">
          ${paperList || "<li>本方向暂无论文</li>"}
        </ul>
      `.trim();
    })
    .join("");

  const digestSummary = `
    <p><strong>日期：</strong>${escapeText(digest.displayDate || digest.date)}</p>
    <p><strong>关键词：</strong>${escapeText((digest.keywords || []).join(" / "))}</p>
    <p><strong>摘要：</strong>${escapeText(digest.summary)}</p>
    <p><strong>网页端：</strong><a href="${escapeAttr(digestUrl)}">打开本期内容</a></p>
    ${feishuUrl ? `<p><strong>飞书：</strong><a href="${escapeAttr(feishuUrl)}">查看飞书版本</a></p>` : ""}
  `.trim();

  return `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.6;">
      <h2>${escapeText(`${digestId} ${digest.title}`)}</h2>
      ${digestSummary}
      <div>${escapeText(digest.body || "").split("\n\n").map((item) => `<p>${escapeText(item)}</p>`).join("")}</div>
      ${sectionBlocks}
      <p style="font-size: 12px;color:#777;">发送时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p>
    </div>
  `.trim();
}

function getDigestNavUrl(digestId, currentSiteUrl) {
  return `${currentSiteUrl}/index.html`;
}

export function buildTransportOptions(config) {
  const smtpHost = String(config.host || "").trim();
  if (!smtpHost) {
    throw new Error("请设置 SMTP_HOST（如 smtp.qq.com）");
  }

  const portValue = Number.isInteger(config.port) && config.port > 0 ? config.port : 587;
  const secureValue = normalizeBoolean(config.secure, false);
  const username = String(config.user || "").trim();
  const password = String(config.pass || "").trim();
  const rejectUnauthorized = normalizeBoolean(config.rejectUnauthorized, true);

  const options = {
    host: smtpHost,
    port: Number.isNaN(portValue) ? 587 : portValue,
    secure: secureValue,
    connectionTimeout: normalizeNumber(config.connectionTimeout, DEFAULT_CONNECTION_TIMEOUT_MS, { min: 1_000 }),
    greetingTimeout: normalizeNumber(config.greetingTimeout, DEFAULT_GREETING_TIMEOUT_MS, { min: 1_000 }),
    socketTimeout: normalizeNumber(config.socketTimeout, DEFAULT_SOCKET_TIMEOUT_MS, { min: 1_000 }),
    tls: {
      rejectUnauthorized
    }
  };

  if (username || password) {
    if (!username || !password) {
      throw new Error("SMTP_USER 与 SMTP_PASS 必须同时设置");
    }
    options.auth = { user: username, pass: password };
  }

  return options;
}

function errorContext(error) {
  const codes = [];
  const messages = [];
  const visited = new Set();
  let current = error;

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    if (current.code) codes.push(String(current.code).toUpperCase());
    if (current.errno) codes.push(String(current.errno).toUpperCase());
    if (current.message) messages.push(String(current.message));
    if (current.response) messages.push(String(current.response));
    current = current.cause;
  }

  return {
    codes: [...new Set(codes)],
    command: String(error?.command || "").toUpperCase(),
    text: messages.join(" ")
  };
}

export function isRetryableSmtpError(error) {
  const { codes, command, text } = errorContext(error);
  const safeDnsOrConnectCodes = new Set(["EDNS", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"]);
  if (codes.some((code) => safeDnsOrConnectCodes.has(code))) return true;

  const isEarlySmtpCommand = ["CONN", "EHLO", "HELO", "STARTTLS"].includes(command);
  const isEarlyTimeout = codes.some((code) => ["ETIMEDOUT", "ESOCKET", "ECONNRESET"].includes(code));
  if (isEarlySmtpCommand && isEarlyTimeout) return true;

  return /getaddrinfo|dns lookup|connection timeout before greeting/i.test(text);
}

function smtpErrorCode(error) {
  const { codes } = errorContext(error);
  return codes.join("/") || "unknown";
}

export async function withSmtpRetry(action, options = {}) {
  const retries = Math.max(0, Math.floor(normalizeNumber(options.retries, DEFAULT_SMTP_RETRIES, { min: 0, max: 5 })));
  const retryDelayMs = Math.max(0, Math.floor(normalizeNumber(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS, { min: 0, max: 10_000 })));
  const wait = options.wait || ((duration) => new Promise((resolve) => setTimeout(resolve, duration)));
  const maxAttempts = retries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await action(attempt);
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableSmtpError(error)) throw error;
      const delayMs = retryDelayMs * attempt;
      options.onRetry?.({ attempt, delayMs, error, maxAttempts });
      await wait(delayMs);
    }
  }

  throw new Error("SMTP重试流程异常结束");
}

export function explainSmtpError(error, config = {}) {
  const { codes, text } = errorContext(error);
  const code = codes.join("/") || "unknown";
  const response = error?.response || "";
  const endpoint = config.host ? `${config.host}:${config.port || 587}` : (error?.hostname || "SMTP服务器");
  if (/certificate|self[- ]signed|unable to verify/i.test(text)) {
    return `SMTP TLS 校验失败（${code}）：请检查系统证书和 SMTP 主机名，不要通过关闭证书校验绕过生产环境问题。`;
  }
  if (isRetryableSmtpError(error) || codes.some((item) => ["ETIMEDOUT", "ESOCKET", "ECONNRESET"].includes(item))) {
    return `SMTP连接失败（${code}）：无法与 ${endpoint} 建立稳定连接。配置文件已读取，但当前环境的 DNS 或网络可能拦截了 SMTP；请运行 npm run email:check 复核。`;
  }
  if (codes.includes("EAUTH") || String(error?.responseCode || "").startsWith("535")) {
    const providerHint = String(config.host || "").includes("gmail")
      ? "Gmail 需启用两步验证并使用应用专用密码，而不是账号登录密码。"
      : "请确认邮箱已开启 SMTP，并使用服务商要求的授权码或应用专用密码。";
    return `SMTP认证失败（${code}）：${providerHint}`;
  }
  return `SMTP发送失败（${code}）：${error.message}${response ? `；服务端回复：${response}` : ""}`.trim();
}

async function withTransport(config, action) {
  const transporter = nodemailer.default.createTransport(buildTransportOptions(config));
  try {
    return await action(transporter);
  } finally {
    transporter.close?.();
  }
}

function retryOptions(config) {
  return {
    retries: config.retries,
    retryDelayMs: config.retryDelayMs,
    onRetry: ({ attempt, delayMs, error, maxAttempts }) => {
      console.error(`SMTP连接暂时失败（${smtpErrorCode(error)}），${delayMs}ms 后重试 ${attempt + 1}/${maxAttempts}...`);
    }
  };
}

function normalizeDeliveryAddress(value) {
  return normalizeEmail(typeof value === "string" ? value : value?.address);
}

export function validateDelivery(info, recipients) {
  const rejected = uniqueEmails((info?.rejected || []).map(normalizeDeliveryAddress));
  if (rejected.length) {
    throw new Error(`SMTP服务端拒绝了 ${rejected.length} 位收件人：${rejected.join(", ")}`);
  }

  if (Array.isArray(info?.accepted)) {
    const accepted = new Set(info.accepted.map(normalizeDeliveryAddress).filter(Boolean));
    const missing = recipients.filter((item) => !accepted.has(normalizeEmail(item)));
    if (missing.length) {
      throw new Error(`SMTP服务端未确认接受 ${missing.length} 位收件人：${missing.join(", ")}`);
    }
    return accepted.size;
  }

  return recipients.length;
}

async function checkSmtpConnection() {
  const smtpConfig = await loadSmtpConfig();
  const recipients = await loadRecipients();

  try {
    await withSmtpRetry(
      () => withTransport(smtpConfig, (transporter) => transporter.verify()),
      retryOptions(smtpConfig)
    );
  } catch (error) {
    throw new Error(explainSmtpError(error, smtpConfig));
  }

  const mode = smtpConfig.secure ? "TLS" : "STARTTLS";
  console.error(`SMTP自检通过：${smtpConfig.host}:${smtpConfig.port}（${mode}），本地收件人 ${recipients.length} 位。`);
}

async function publishDigest(digestId, dryRun = false) {
  const digests = await getDigests();
  const digest = digests.find((item) => item.id === digestId);
  if (!digest) {
    throw new Error(`未找到简报：${digestId}`);
  }

  const smtpConfig = await loadSmtpConfig();
  const currentSiteUrl = siteUrl(smtpConfig);
  const recipients = await loadRecipients();
  const sections = collectPapersByDirection(digest);
  const digestUrl = getDigestNavUrl(digestId, currentSiteUrl);
  const feishuUrl = await loadFeishuLink(digestId);
  const subject = buildEmailSubject(digestId, digest);
  const text = buildTextBody(digest, digestId, digestUrl, feishuUrl, sections, currentSiteUrl);
  const html = buildHtmlBody(digest, digestId, digestUrl, feishuUrl, sections, currentSiteUrl);
  const from = smtpConfig.from || smtpConfig.user;

  if (dryRun) {
    console.error(`Preview digest: ${digestId}`);
    console.error(`Recipients: ${recipients.join(", ")}`);
    console.error(`From: ${from || "<未设置>"}`);
    console.error("----- Subject -----");
    console.error(subject);
    console.error("----- Body -----");
    console.error(text);
    return;
  }

  if (!from) {
    throw new Error("请设置 EMAIL_FROM 或 SMTP_USER（用于发件人地址）");
  }

  if (!recipients.length) {
    throw new Error("收件人列表为空");
  }

  let info;
  try {
    info = await withSmtpRetry(
      () => withTransport(smtpConfig, (transporter) => transporter.sendMail({
        from,
        to: recipients.join(","),
        subject,
        text,
        html
      })),
      retryOptions(smtpConfig)
    );
  } catch (error) {
    throw new Error(explainSmtpError(error, smtpConfig));
  }

  const acceptedCount = validateDelivery(info, recipients);
  const messageId = normalizeString(info?.messageId);
  console.error(`SMTP服务端已接受 ${acceptedCount} 位收件人：${digestId}${messageId ? `（messageId: ${messageId}）` : ""}`);
}

export async function main(argv = process.argv.slice(2)) {
  const [command, digestId] = argv;

  if (command === "check") {
    await checkSmtpConnection();
    return;
  }

  if (!digestId || !["preview", "publish"].includes(command)) {
    usage();
    throw new Error("邮件命令参数不完整");
  }

  await publishDigest(digestId, command === "preview");
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
