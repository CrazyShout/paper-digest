#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDigests } from "../src/lib/content.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const CONFIG = path.join(ROOT, "config");
const DEFAULT_SITE_URL = "https://crazyshout.github.io/paper-digest";
const DEFAULT_RECIPIENTS = ["7608331@qq.com"];
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
  console.error("Usage: npm run email:preview -- <digest-id>");
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
    return {
      host: normalizeString(config.host ?? config.SMTP_HOST ?? process.env.SMTP_HOST),
      port: normalizeNumber(
        config.port ?? config.SMTP_PORT ?? process.env.SMTP_PORT ?? 587,
        587,
        { min: 1 }
      ),
      secure: normalizeBoolean(config.secure ?? config.SMTP_SECURE ?? process.env.SMTP_SECURE, false),
      user: normalizeString(config.user ?? config.SMTP_USER ?? process.env.SMTP_USER),
      pass: normalizeString(config.pass ?? config.SMTP_PASS ?? process.env.SMTP_PASS),
      rejectUnauthorized: normalizeBoolean(config.rejectUnauthorized ?? config.SMTP_REJECT_UNAUTHORIZED ?? process.env.SMTP_REJECT_UNAUTHORIZED, true),
      from: normalizeString(config.from ?? config.EMAIL_FROM ?? process.env.EMAIL_FROM),
      siteUrl: normalizeString(siteConfigUrl || envSiteUrl)
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

function buildTransportOptions(config) {
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

function explainSmtpError(error) {
  const code = error?.code || error?.errno || "unknown";
  const response = error?.response || "";
  if (code === "ETIMEDOUT" || code === "ESOCKET" || code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ENOTFOUND") {
    return `SMTP连接失败（${code}）：无法与 ${error?.hostname || "smtp server"} 建立连接。请确认 SMTP_HOST/SMTP_PORT 可达，且当前网络未拦截 587/465 端口。`;
  }
  if (code === "EAUTH") {
    return "SMTP认证失败（EAUTH）：请确认使用的是 Gmail 应用专用密码（非登录密码），且账号已开启两步验证。";
  }
  if (code === "535" || String(error?.responseCode || "").startsWith("535")) {
    return "SMTP认证失败（535）：用户名/密码不正确，或账号策略要求应用专用密码。";
  }
  return `SMTP发送失败（${code}）：${error.message}${response ? `；服务端回复：${response}` : ""}`.trim();
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

  const transporter = nodemailer.default.createTransport(buildTransportOptions(smtpConfig));
  try {
    await transporter.sendMail({
      from,
      to: recipients.join(","),
      subject,
      text,
      html
    });
  } catch (error) {
    throw new Error(explainSmtpError(error));
  }

  console.error(`已向 ${recipients.length} 位收件人发送：${digestId}`);
}

const command = process.argv[2];
const digestId = process.argv[3];

if (!digestId || !["preview", "publish"].includes(command)) {
  usage();
  process.exit(1);
}

await publishDigest(digestId, command === "preview");
