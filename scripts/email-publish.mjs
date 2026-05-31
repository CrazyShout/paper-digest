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

function siteUrl() {
  return String(process.env.PAPER_DIGEST_SITE_URL || process.env.PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
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

function buildTextBody(digest, digestId, digestUrl, feishuUrl, sections) {
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
      const paperUrl = `${siteUrl()}/papers/${paper.id}/index.html`;
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

function buildHtmlBody(digest, digestId, digestUrl, feishuUrl, sections) {
  const sectionBlocks = sections
    .map((item) => {
      const paperList = item.papers
        .map((paper) => {
          const paperUrl = `${siteUrl()}/papers/${paper.id}/index.html`;
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

function getDigestNavUrl(digestId) {
  return `${siteUrl()}/index.html`;
}

function buildTransportOptions() {
  const smtpHost = String(process.env.SMTP_HOST || "").trim();
  if (!smtpHost) {
    throw new Error("请设置 SMTP_HOST（如 smtp.qq.com）");
  }

  const portValue = Number(process.env.SMTP_PORT || 587);
  const secureValue = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const username = String(process.env.SMTP_USER || "").trim();
  const password = String(process.env.SMTP_PASS || "").trim();
  const rejectUnauthorized = String(process.env.SMTP_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false";

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

async function publishDigest(digestId, dryRun = false) {
  const digests = await getDigests();
  const digest = digests.find((item) => item.id === digestId);
  if (!digest) {
    throw new Error(`未找到简报：${digestId}`);
  }

  const recipients = await loadRecipients();
  const sections = collectPapersByDirection(digest);
  const digestUrl = getDigestNavUrl(digestId);
  const feishuUrl = await loadFeishuLink(digestId);
  const subject = buildEmailSubject(digestId, digest);
  const text = buildTextBody(digest, digestId, digestUrl, feishuUrl, sections);
  const html = buildHtmlBody(digest, digestId, digestUrl, feishuUrl, sections);
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

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

  const transporter = nodemailer.default.createTransport(buildTransportOptions());
  await transporter.sendMail({
    from,
    to: recipients.join(","),
    subject,
    text,
    html
  });

  console.error(`已向 ${recipients.length} 位收件人发送：${digestId}`);
}

const command = process.argv[2];
const digestId = process.argv[3];

if (!digestId || !["preview", "publish"].includes(command)) {
  usage();
  process.exit(1);
}

await publishDigest(digestId, command === "preview");
