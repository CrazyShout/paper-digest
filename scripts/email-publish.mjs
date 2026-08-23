#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDigests, getIdeaCenter, getReviewCenter } from "../src/lib/content.js";
import { ideaArtifactSnapshotFingerprint } from "../src/lib/idea-fingerprint.js";
import { reviewCenterFingerprint } from "../src/lib/review-fingerprint.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(SCRIPT_DIR, "..");
const CONFIG = path.join(ROOT, "config");
const DEFAULT_SITE_URL = "https://crazyshout.github.io/paper-digest";
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
  console.error("       npm run email:welcome:preview -- <digest-id>");
  console.error("       npm run email:welcome -- <digest-id>");
  console.error("       npm run email:review-update:preview");
  console.error("       npm run email:review-update");
  console.error("       npm run email:idea-update:preview");
  console.error("       npm run email:idea-update");
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
      )),
      actionsDeploymentFallback: normalizeBoolean(
        config.actionsDeploymentFallback
          ?? config.PAPER_DIGEST_ACTIONS_DEPLOYMENT_FALLBACK
          ?? process.env.PAPER_DIGEST_ACTIONS_DEPLOYMENT_FALLBACK,
        false
      ),
      deploymentWorkflow: normalizeString(
        config.deploymentWorkflow
          ?? config.PAPER_DIGEST_DEPLOYMENT_WORKFLOW
          ?? process.env.PAPER_DIGEST_DEPLOYMENT_WORKFLOW
          ?? "deploy-pages.yml"
      ),
      deploymentBranch: normalizeString(
        config.deploymentBranch
          ?? config.PAPER_DIGEST_DEPLOYMENT_BRANCH
          ?? process.env.PAPER_DIGEST_DEPLOYMENT_BRANCH
          ?? "main"
      )
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
  return escapeText(value);
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

export function parseRecipientsConfig(data) {
  const list = Array.isArray(data) ? data : (Array.isArray(data?.recipients) ? data.recipients : null);
  if (!list) {
    throw new Error("邮箱配置必须是数组，或包含 recipients 数组");
  }

  const invalid = list.filter((item) => typeof item !== "string" || !isValidEmail(item));
  if (invalid.length) {
    throw new Error(`邮箱配置包含 ${invalid.length} 个无效地址`);
  }

  const recipients = uniqueEmails(list);
  if (!recipients.length) {
    throw new Error("邮箱配置中的 recipients 不能为空");
  }

  return recipients;
}

export function parseRecipientState(data) {
  const recipients = parseRecipientsConfig(data);
  const list = data && !Array.isArray(data) && Array.isArray(data.onboardedRecipients)
    ? data.onboardedRecipients
    : [];
  const invalid = list.filter((item) => typeof item !== "string" || !isValidEmail(item));
  if (invalid.length) {
    throw new Error(`已介绍收件人配置包含 ${invalid.length} 个无效地址`);
  }

  const onboardedRecipients = uniqueEmails(list);
  const recipientSet = new Set(recipients);
  const unknown = onboardedRecipients.filter((item) => !recipientSet.has(item));
  if (unknown.length) {
    throw new Error(`已介绍收件人中有 ${unknown.length} 个地址不在推送名单内`);
  }

  const onboardedSet = new Set(onboardedRecipients);
  return {
    data,
    recipients,
    onboardedRecipients,
    welcomeRecipients: recipients.filter((item) => !onboardedSet.has(item))
  };
}

async function loadRecipientState() {
  try {
    const text = await readFile(EMAIL_LIST_PATH, "utf8");
    const data = JSON.parse(text);
    return parseRecipientState(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("未找到 config/email-recipients.local.json，请先配置本地收件人列表");
    }
    throw new Error(`读取邮箱配置失败：${error.message}`);
  }
}

async function loadRecipients() {
  return (await loadRecipientState()).recipients;
}

async function markRecipientsOnboarded(state, recipients) {
  const onboardedRecipients = uniqueEmails([
    ...state.onboardedRecipients,
    ...recipients
  ]);
  const base = state.data && !Array.isArray(state.data) ? state.data : {};
  const next = {
    ...base,
    recipients: state.recipients,
    onboardedRecipients
  };
  await writeFile(EMAIL_LIST_PATH, `${JSON.stringify(next, null, 2)}\n`);
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

function buildEmailSubject(digestId, digest, options = {}) {
  const prefix = options.welcome ? "[Paper Digest 新成员指南]" : "[Paper Digest]";
  return `${prefix} ${digestId} ${digest.title}`;
}

function buildWelcomeText() {
  return [
    "欢迎加入 Paper Digest。",
    "",
    "这是面向课题组论文跟踪、周报阅读和科研方向判断的静态知识库，重点是高质量筛选、证据化整理和跨期检索，不提供 AI 问答。",
    "",
    "主要功能：",
    "- 每期周报给出本期判断、筛选口径、应用场景与讨论线索。",
    "- 每篇论文都有独立详细报告，包含问题、方法、关键图、量化证据、局限和可借鉴方向。",
    "- 首页汇总全库趋势、热点和各研究方向的可行切入点；Idea 中心用于查看候选课题、证据和可行性判断。",
    "- 搜索支持论文标题、作者、单位和关键词；网页端与飞书知识库可以按个人方向自由阅读。",
    "",
    "建议用法：",
    "1. 先看本期判断和方向标签，只选择与你当前研究相关的条目，不设统一阅读顺序。",
    "2. 对感兴趣的论文打开单篇报告，重点核对方法图、关键结果和局限，再决定是否阅读原文。",
    "3. 需要回溯某个作者、机构或主题时使用首页搜索；需要找课题切口时再看研究态势和 Idea 中心。",
    "",
    "下面是最新一期周报。"
  ].join("\n");
}

function buildWelcomeHtml() {
  return `
    <section style="margin:0 0 28px;padding:0 0 24px;border-bottom:1px solid #dfe3e8;">
      <h2 style="margin:0 0 12px;">欢迎加入 Paper Digest</h2>
      <p>这是面向课题组论文跟踪、周报阅读和科研方向判断的静态知识库，重点是高质量筛选、证据化整理和跨期检索，不提供 AI 问答。</p>
      <p><strong>主要功能</strong></p>
      <ul style="padding-left:20px;margin:8px 0 18px;">
        <li>每期周报给出本期判断、筛选口径、应用场景与讨论线索。</li>
        <li>每篇论文都有独立详细报告，包含问题、方法、关键图、量化证据、局限和可借鉴方向。</li>
        <li>首页汇总全库趋势、热点和各研究方向的可行切入点；Idea 中心用于查看候选课题、证据和可行性判断。</li>
        <li>搜索支持论文标题、作者、单位和关键词；网页端与飞书知识库可以按个人方向自由阅读。</li>
      </ul>
      <p><strong>建议用法</strong></p>
      <ol style="padding-left:20px;margin:8px 0 18px;">
        <li>先看本期判断和方向标签，只选择与你当前研究相关的条目，不设统一阅读顺序。</li>
        <li>对感兴趣的论文打开单篇报告，重点核对方法图、关键结果和局限，再决定是否阅读原文。</li>
        <li>需要回溯某个作者、机构或主题时使用首页搜索；需要找课题切口时再看研究态势和 Idea 中心。</li>
      </ol>
      <p style="margin-bottom:0;">下面是最新一期周报。</p>
    </section>
  `.trim();
}

export function buildTextBody(digest, digestId, digestUrl, feishuUrl, sections, currentSiteUrl, options = {}) {
  const lines = [];
  if (options.welcome) {
    lines.push(buildWelcomeText());
    lines.push("");
    lines.push("------------------------------------------------------------");
    lines.push("");
  }
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
  if (normalizeString(digest.body)) {
    lines.push("本期内容与更新：");
    lines.push(String(digest.body).trim());
    lines.push("");
  }
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

export function buildHtmlBody(digest, digestId, digestUrl, feishuUrl, sections, currentSiteUrl, options = {}) {
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

  const digestBodyHtml = normalizeString(digest.bodyHtml)
    ? digest.bodyHtml
    : String(digest.body || "")
      .split(/\n\s*\n/)
      .filter(Boolean)
      .map((item) => `<p>${escapeText(item)}</p>`)
      .join("");

  return `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.6;">
      ${options.welcome ? buildWelcomeHtml() : ""}
      <h2>${escapeText(`${digestId} ${digest.title}`)}</h2>
      ${digestSummary}
      <div>${digestBodyHtml}</div>
      ${sectionBlocks}
      <p style="font-size: 12px;color:#777;">发送时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p>
    </div>
  `.trim();
}

export function getReviewCenterUrl(currentSiteUrl) {
  return `${currentSiteUrl}/reviews/index.html`;
}

export function assertReviewCenterReady(center) {
  if (!center || !Array.isArray(center.directions) || !center.directions.length) {
    throw new Error("综述中心没有可发布的研究方向");
  }

  const incomplete = center.directions.filter((direction) => {
    const review = direction?.searchAudit?.independentReview;
    return review?.status !== "passed"
      || !Number.isInteger(review?.reviewers)
      || review.reviewers < 1
      || !Number.isInteger(review?.rounds)
      || review.rounds < 1
      || !/^[0-9a-f]{64}$/.test(review?.snapshotFingerprint || "")
      || review.snapshotFingerprint !== direction.currentSnapshotFingerprint;
  });
  if (incomplete.length) {
    throw new Error(`仍有 ${incomplete.length} 个方向未通过独立复核，禁止发送综述更新`);
  }
}

export async function verifyPublishedReviewCenter(center, currentSiteUrl, fetchImpl = fetch) {
  const fingerprint = reviewCenterFingerprint(center);
  const verificationUrl = `${getReviewCenterUrl(currentSiteUrl)}?verify=${encodeURIComponent(fingerprint)}`;
  let response;
  try {
    response = await fetchImpl(verificationUrl, {
      headers: {
        "cache-control": "no-cache"
      }
    });
  } catch (error) {
    throw new Error(`无法核验线上综述中心：${error.message}`);
  }
  if (!response?.ok) {
    throw new Error(`线上综述中心核验失败：HTTP ${response?.status || "unknown"}`);
  }

  const html = await response.text();
  const markers = [
    `data-review-version="${center.version}"`,
    `data-review-updated="${center.updatedAt}"`,
    `data-review-directions="${center.directions.length}"`,
    `data-review-fingerprint="${fingerprint}"`
  ];
  if (markers.some((marker) => !html.includes(marker))) {
    throw new Error("线上综述中心仍不是当前本地版本，禁止发送更新通知");
  }
}

export function buildReviewUpdateSubject(center) {
  return `[Paper Digest] ${center.updatedAt} 动态综述中心完成新一轮更新`;
}

function reviewDirectionTitle(direction) {
  const title = normalizeString(direction.title);
  const prefix = `${normalizeString(direction.label)}：`;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}

export function buildReviewUpdateTextBody(center, currentSiteUrl) {
  const centerUrl = getReviewCenterUrl(currentSiteUrl);
  const lines = [
    "[Paper Digest] 动态综述中心更新",
    `更新日期：${center.updatedAt}`,
    "",
    "综述中心刚完成一轮系统更新。这里不是一次性论文列表，而是一张持续更新的研究证据地图：新论文、正式版本、复现结果或反例出现后，各方向都会重新检索、核验并改写。",
    "",
    "本轮更新重点：",
    "- 每个方向同时覆盖奠基工作、正式发表论文、近期前沿和本库已报告论文。",
    "- 关键判断回到论文、标准、正式会议或项目页等一手来源核验。",
    "- 每条参考文献明确写出它能支撑什么、不能证明什么，避免把预印本、离线指标和真实部署证据混为一谈。",
    "- 每篇综述公开检索范围、来源覆盖、候选去重情况和仍待补足的证据。",
    "",
    `进入综述中心：${centerUrl}`,
    "",
    `当前共 ${center.directions.length} 个研究方向：`
  ];

  for (const direction of center.directions) {
    lines.push(`- ${direction.label}：${reviewDirectionTitle(direction)}`);
    lines.push(`  ${currentSiteUrl}/reviews/${encodeURIComponent(direction.id)}/index.html`);
    if (direction.subtitle) lines.push(`  ${direction.subtitle}`);
  }

  lines.push("");
  lines.push("建议按自己的研究方向进入对应综述，不设统一阅读顺序。每个方向都保留问题边界、方法演进、证据冲突、可做切口和尚未解决的问题，后续会继续滚动更新。");
  lines.push("");
  lines.push(`发送时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  return lines.join("\n");
}

export function buildReviewUpdateHtmlBody(center, currentSiteUrl) {
  const centerUrl = getReviewCenterUrl(currentSiteUrl);
  const directionItems = center.directions
    .map((direction) => {
      const directionUrl = `${currentSiteUrl}/reviews/${encodeURIComponent(direction.id)}/index.html`;
      return `
        <li style="margin:0 0 14px;">
          <a href="${escapeAttr(directionUrl)}" style="color:#175b69;font-weight:650;text-decoration:none;">${escapeText(direction.label)}</a>
          <div style="margin-top:3px;color:#27333a;">${escapeText(reviewDirectionTitle(direction))}</div>
          ${direction.subtitle ? `<div style="margin-top:3px;color:#667178;font-size:13px;">${escapeText(direction.subtitle)}</div>` : ""}
        </li>
      `.trim();
    })
    .join("");

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.65;color:#202b31;max-width:720px;margin:0 auto;">
      <p style="margin:0 0 8px;color:#667178;font-size:13px;">PAPER DIGEST · ${escapeText(center.updatedAt)}</p>
      <h2 style="margin:0 0 14px;font-size:25px;">动态综述中心完成新一轮更新</h2>
      <p>综述中心不是一次性论文列表，而是一张<strong>持续更新的研究证据地图</strong>：新论文、正式版本、复现结果或反例出现后，各方向都会重新检索、核验并改写。</p>
      <p><strong>本轮更新重点</strong></p>
      <ul style="padding-left:20px;margin:8px 0 22px;">
        <li>同时覆盖奠基工作、正式发表论文、近期前沿和本库已报告论文。</li>
        <li>关键判断回到论文、标准、正式会议或项目页等一手来源核验。</li>
        <li>每条参考文献明确写出可支撑结论与证据边界。</li>
        <li>公开检索范围、来源覆盖、候选去重情况和仍待补足的证据。</li>
      </ul>
      <p style="margin:0 0 24px;">
        <a href="${escapeAttr(centerUrl)}" style="display:inline-block;padding:10px 16px;background:#175b69;color:#fff;text-decoration:none;border-radius:4px;">进入综述中心</a>
      </p>
      <h3 style="margin:0 0 12px;">当前 ${center.directions.length} 个研究方向</h3>
      <ul style="padding-left:20px;margin:0 0 24px;">${directionItems}</ul>
      <p>建议按自己的研究方向进入对应综述，不设统一阅读顺序。每个方向都保留问题边界、方法演进、证据冲突、可做切口和尚未解决的问题，后续会继续滚动更新。</p>
      <p style="font-size:12px;color:#78838a;">发送时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p>
    </div>
  `.trim();
}

export function getIdeaCenterUrl(currentSiteUrl) {
  return `${currentSiteUrl}/ideas/index.html`;
}

export function summarizeIdeaCenter(center) {
  const directions = Array.isArray(center?.directions) ? center.directions : [];
  const pools = directions.map((direction) => direction?.candidatePool).filter(Boolean);
  const ideas = directions.flatMap((direction) => (
    Array.isArray(direction?.ideas) ? direction.ideas : []
  ));
  const total = (key) => pools.reduce((sum, pool) => {
    const value = Number(pool?.counts?.[key]);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const finalReview = center?.finalReview?.report || center?.finalReview || {};

  return {
    directions: directions.length,
    queryRuns: total("queries"),
    references: total("references"),
    assets: total("assets"),
    candidates: total("candidates"),
    reviewedIdeas: ideas.length,
    passedIdeas: ideas.filter((idea) => idea?.reviewStatus === "passed").length,
    globalStatus: normalizeString(finalReview.status),
    globalScore: Number.isFinite(Number(finalReview.overall)) ? Number(finalReview.overall) : null
  };
}

export function assertIdeaCenterReady(center) {
  if (!center || !Array.isArray(center.directions) || !center.directions.length) {
    throw new Error("Idea 中心没有可发布的研究方向");
  }

  const incomplete = center.directions.filter((direction) => {
    const ideas = Array.isArray(direction?.ideas) ? direction.ideas : [];
    return direction?.status !== "reviewed"
      || !direction?.candidatePool
      || !ideas.length
      || ideas.some((idea) => {
        const reviewers = idea?.blindReview?.reviewers;
        return !["passed", "rejected"].includes(idea?.reviewStatus)
          || !Array.isArray(reviewers)
          || reviewers.length < 2;
      });
  });
  if (incomplete.length) {
    throw new Error(`仍有 ${incomplete.length} 个方向未完成候选检索与独立盲评，禁止发送 Idea 中心更新`);
  }

  const finalReview = center.finalReview?.report;
  if (center.explorationStatus !== "reviewed"
    || !finalReview
    || !["passed", "rejected"].includes(finalReview.status)
    || !Number.isInteger(finalReview.overall)) {
    throw new Error("Idea 中心尚未完成独立全局终审，禁止发送更新");
  }
}

function ideaCenterReleaseMarkers(center) {
  const fingerprint = ideaArtifactSnapshotFingerprint(center);
  return {
    fingerprint,
    markers: [
      `data-idea-version="${center.version}"`,
      `data-idea-updated="${center.updatedAt}"`,
      `data-idea-directions="${center.directions.length}"`,
      `data-idea-fingerprint="${fingerprint}"`
    ]
  };
}

function assertIdeaCenterMarkers(center, html, message) {
  const { markers } = ideaCenterReleaseMarkers(center);
  if (markers.some((marker) => !html.includes(marker))) {
    throw new Error(message);
  }
}

export function parseGitHubRepository(remoteUrl) {
  const match = normalizeString(remoteUrl)
    .match(/github\.com(?::|\/)([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  return match ? `${match[1]}/${match[2]}` : "";
}

function localGitDeploymentIdentity() {
  try {
    const headSha = normalizeString(execFileSync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: ROOT, encoding: "utf8" }
    ));
    const remoteUrl = normalizeString(execFileSync(
      "git",
      ["remote", "get-url", "origin"],
      { cwd: ROOT, encoding: "utf8" }
    ));
    const repository = parseGitHubRepository(remoteUrl);
    if (!/^[0-9a-f]{40}$/.test(headSha) || !repository) {
      throw new Error("本地 Git 身份不完整");
    }
    return { headSha, repository };
  } catch (error) {
    throw new Error(`无法读取部署提交身份：${error.message}`);
  }
}

export async function verifyIdeaCenterActionsDeployment(center, options = {}) {
  const repository = normalizeString(options.repository);
  const headSha = normalizeString(options.headSha);
  const workflow = normalizeString(options.workflow) || "deploy-pages.yml";
  const branch = normalizeString(options.branch) || "main";
  const fetchImpl = options.fetchImpl || fetch;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("GitHub Actions 部署核验缺少合法仓库名");
  }
  if (!/^[0-9a-f]{40}$/.test(headSha)) {
    throw new Error("GitHub Actions 部署核验缺少完整提交 SHA");
  }

  let builtHtml = options.builtHtml;
  if (typeof builtHtml !== "string") {
    try {
      builtHtml = await readFile(path.join(ROOT, "dist", "ideas", "index.html"), "utf8");
    } catch (error) {
      throw new Error(`无法读取本地构建指纹：${error.message}`);
    }
  }
  assertIdeaCenterMarkers(center, builtHtml, "本地构建的 Idea 中心不是当前内容版本");

  const apiUrl = `https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/runs`
    + `?branch=${encodeURIComponent(branch)}&status=success&per_page=10`;
  let response;
  try {
    response = await fetchImpl(apiUrl, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "paper-digest-deployment-verifier"
      }
    });
  } catch (error) {
    throw new Error(`无法核验 GitHub Actions 部署：${error.message}`);
  }
  if (!response?.ok) {
    throw new Error(`GitHub Actions 部署核验失败：HTTP ${response?.status || "unknown"}`);
  }
  const payload = await response.json();
  const run = (Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [])
    .find((item) => item?.head_sha === headSha
      && item?.head_branch === branch
      && item?.status === "completed"
      && item?.conclusion === "success");
  if (!run) {
    throw new Error("没有找到与本地提交完全匹配的成功 Pages 工作流，禁止发送更新通知");
  }
  return {
    runId: run.id,
    runUrl: run.html_url,
    headSha
  };
}

export async function verifyPublishedIdeaCenter(center, currentSiteUrl, fetchImpl = fetch) {
  const { fingerprint } = ideaCenterReleaseMarkers(center);
  const verificationUrl = `${getIdeaCenterUrl(currentSiteUrl)}?verify=${encodeURIComponent(fingerprint)}`;
  let response;
  try {
    response = await fetchImpl(verificationUrl, {
      headers: {
        "cache-control": "no-cache"
      }
    });
  } catch (error) {
    const wrapped = new Error(`无法核验线上 Idea 中心：${error.message}`);
    wrapped.code = "IDEA_LIVE_FETCH_FAILED";
    wrapped.cause = error;
    throw wrapped;
  }
  if (!response?.ok) {
    throw new Error(`线上 Idea 中心核验失败：HTTP ${response?.status || "unknown"}`);
  }

  const html = await response.text();
  assertIdeaCenterMarkers(
    center,
    html,
    "线上 Idea 中心仍不是当前本地版本，禁止发送更新通知"
  );
}

export function buildIdeaUpdateSubject(center) {
  return `[Paper Digest] ${center.updatedAt} Idea 中心与阅读框架完成更新`;
}

function ideaReviewResult(stats) {
  if (stats.globalStatus === "passed") return "已通过全局终审";
  if (stats.globalStatus === "rejected") return "未通过全局终审";
  return "全局终审状态待确认";
}

export function buildIdeaUpdateTextBody(center, currentSiteUrl) {
  const stats = summarizeIdeaCenter(center);
  const centerUrl = getIdeaCenterUrl(currentSiteUrl);
  const scoreText = stats.globalScore === null ? "未记录" : `${stats.globalScore}/10`;
  const lines = [
    "[Paper Digest] Idea 中心与网站阅读框架更新",
    `更新日期：${center.updatedAt}`,
    "",
    "本次更新把网站整理为更紧凑的 Notebook 文档结构，并重新审计了 Idea 中心的全部研究方向。目录、全站搜索、方向综述、简报和单篇论文报告现在使用统一的阅读框架。",
    "",
    "Idea 中心本轮变化：",
    "- 不再只依据站内已总结论文：每个方向先判断问题意义，再检索站外顶级论文、正式版本、预印本、标准和公开资产。",
    "- 检索者、候选筛选者、档案作者和盲评者相互隔离；每个候选公开最近工作差分、证据、实现路径、决定性实验与淘汰理由。",
    "- 评分采用所有独立评审中的逐维最低分，不取平均；只有所有维度与总体分都达到 10/10 才算通过。",
    "- 未通过的候选也会保留，作为问题边界和下一轮实验依据，不包装成立项推荐。",
    "",
    "本轮审计规模：",
    `- ${stats.directions} 个研究方向，${stats.queryRuns} 个查询运行`,
    `- ${stats.references} 条一手证据，${stats.assets} 个固定版本资产`,
    `- ${stats.candidates} 个去重候选，${stats.reviewedIdeas} 个进入独立盲评`,
    `- ${stats.passedIdeas} 个候选达到全维度满分；全局终审 ${scoreText}（${ideaReviewResult(stats)}）`,
    "",
    "当前没有候选达到满分门槛。这不是空结果：页面明确给出了每个方向最有价值的剩余切口、最强反对意见，以及下一步必须先跑的零阶段实验。",
    "",
    `进入 Idea 中心：${centerUrl}`,
    "",
    `当前方向：${center.directions.map((direction) => direction.label).join(" / ")}`,
    "",
    `发送时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`
  ];
  return lines.join("\n");
}

export function buildIdeaUpdateHtmlBody(center, currentSiteUrl) {
  const stats = summarizeIdeaCenter(center);
  const centerUrl = getIdeaCenterUrl(currentSiteUrl);
  const scoreText = stats.globalScore === null ? "未记录" : `${stats.globalScore}/10`;
  const directionItems = center.directions
    .map((direction) => {
      const ideas = Array.isArray(direction.ideas) ? direction.ideas : [];
      const passed = ideas.filter((idea) => idea?.reviewStatus === "passed").length;
      return `<li style="margin:0 0 7px;"><strong>${escapeText(direction.label)}</strong>：${ideas.length} 个进入盲评，${passed} 个全项通过</li>`;
    })
    .join("");

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.65;color:#202b31;max-width:720px;margin:0 auto;">
      <p style="margin:0 0 8px;color:#667178;font-size:13px;">PAPER DIGEST · ${escapeText(center.updatedAt)}</p>
      <h2 style="margin:0 0 14px;font-size:25px;">Idea 中心与网站阅读框架完成更新</h2>
      <p>本次更新把网站整理为更紧凑的 <strong>Notebook 文档结构</strong>，并重新审计了 Idea 中心的全部研究方向。目录、全站搜索、方向综述、简报和单篇论文报告现在使用统一的阅读框架。</p>
      <h3 style="margin:22px 0 10px;">Idea 中心本轮变化</h3>
      <ul style="padding-left:20px;margin:8px 0 20px;">
        <li>每个方向从问题意义出发，检索站外顶级论文、正式版本、预印本、标准和公开资产。</li>
        <li>检索、筛选、档案写作和盲评相互隔离，公开最近工作差分、证据、实现路径、决定性实验与淘汰理由。</li>
        <li>采用所有独立评审中的逐维最低分；只有所有维度与总体分都达到 10/10 才算通过。</li>
        <li>未通过候选继续保留为问题边界和下一轮实验依据，不包装成立项推荐。</li>
      </ul>
      <h3 style="margin:22px 0 10px;">本轮审计规模</h3>
      <p>${stats.directions} 个方向 · ${stats.queryRuns} 个查询运行 · ${stats.references} 条一手证据 · ${stats.assets} 个固定版本资产</p>
      <p>${stats.candidates} 个去重候选 · ${stats.reviewedIdeas} 个进入独立盲评 · ${stats.passedIdeas} 个全维度满分通过</p>
      <p><strong>全局终审：</strong>${escapeText(scoreText)}（${escapeText(ideaReviewResult(stats))}）</p>
      <p>当前没有候选达到满分门槛。页面明确给出了每个方向最有价值的剩余切口、最强反对意见，以及下一步必须先跑的零阶段实验。</p>
      <p style="margin:22px 0 24px;">
        <a href="${escapeAttr(centerUrl)}" style="display:inline-block;padding:10px 16px;background:#175b69;color:#fff;text-decoration:none;border-radius:4px;">进入 Idea 中心</a>
      </p>
      <h3 style="margin:0 0 10px;">方向审计</h3>
      <ul style="padding-left:20px;margin:0 0 24px;">${directionItems}</ul>
      <p style="font-size:12px;color:#78838a;">发送时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p>
    </div>
  `.trim();
}

export function getDigestNavUrl(digestId, currentSiteUrl) {
  return `${currentSiteUrl}/digests/${encodeURIComponent(digestId)}/`;
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
  const responseCode = Number.isInteger(error?.responseCode)
    ? `，SMTP ${error.responseCode}`
    : "";
  return `SMTP发送失败（${code}${responseCode}）：服务端未接受本次投递；详细回复已省略以保护收件人信息。`;
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
    throw new Error(`SMTP服务端拒绝了 ${rejected.length} 位收件人`);
  }

  if (!Array.isArray(info?.accepted)) {
    throw new Error("SMTP服务端未返回 accepted 收件人列表，无法确认投递");
  }

  const accepted = new Set(info.accepted.map(normalizeDeliveryAddress).filter(Boolean));
  const missingCount = recipients.filter((item) => !accepted.has(normalizeEmail(item))).length;
  if (missingCount) {
    throw new Error(`SMTP服务端未确认接受 ${missingCount} 位收件人`);
  }
  return recipients.length;
}

export function buildBulkMailOptions({ from, envelopeTo, recipients, subject, text, html }) {
  return {
    from,
    to: envelopeTo || from,
    bcc: recipients.join(","),
    subject,
    text,
    html
  };
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

async function publishDigest(digestId, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const welcome = Boolean(options.welcome);
  const digests = await getDigests();
  const digest = digests.find((item) => item.id === digestId);
  if (!digest) {
    throw new Error(`未找到简报：${digestId}`);
  }

  const smtpConfig = await loadSmtpConfig();
  const currentSiteUrl = siteUrl(smtpConfig);
  const recipientState = await loadRecipientState();
  const recipients = welcome ? recipientState.welcomeRecipients : recipientState.recipients;
  const sections = collectPapersByDirection(digest);
  const digestUrl = getDigestNavUrl(digestId, currentSiteUrl);
  const feishuUrl = await loadFeishuLink(digestId);
  const subject = buildEmailSubject(digestId, digest, { welcome });
  const text = buildTextBody(digest, digestId, digestUrl, feishuUrl, sections, currentSiteUrl, { welcome });
  const html = buildHtmlBody(digest, digestId, digestUrl, feishuUrl, sections, currentSiteUrl, { welcome });
  const from = smtpConfig.from || smtpConfig.user;

  if (dryRun) {
    console.error(`Preview ${welcome ? "welcome digest" : "digest"}: ${digestId}`);
    console.error(`Recipients: ${recipients.length}`);
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
    throw new Error(welcome ? "没有尚未完成新人介绍的收件人" : "收件人列表为空");
  }

  let info;
  try {
    info = await withSmtpRetry(
      () => withTransport(smtpConfig, (transporter) => transporter.sendMail({
        ...buildBulkMailOptions({
          from,
          envelopeTo: smtpConfig.user || from,
          recipients,
          subject,
          text,
          html
        })
      })),
      retryOptions(smtpConfig)
    );
  } catch (error) {
    throw new Error(explainSmtpError(error, smtpConfig));
  }

  const acceptedCount = validateDelivery(info, recipients);
  if (welcome) {
    await markRecipientsOnboarded(recipientState, recipients);
  }
  const messageId = normalizeString(info?.messageId);
  console.error(`SMTP服务端已接受 ${acceptedCount} 位${welcome ? "新人" : "收件人"}：${digestId}${messageId ? `（messageId: ${messageId}）` : ""}`);
}

async function publishReviewUpdate(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const [center, smtpConfig, recipientState] = await Promise.all([
    getReviewCenter(),
    loadSmtpConfig(),
    loadRecipientState()
  ]);
  const currentSiteUrl = siteUrl(smtpConfig);
  const recipients = recipientState.recipients;
  assertReviewCenterReady(center);
  const subject = buildReviewUpdateSubject(center);
  const text = buildReviewUpdateTextBody(center, currentSiteUrl);
  const html = buildReviewUpdateHtmlBody(center, currentSiteUrl);
  const from = smtpConfig.from || smtpConfig.user;

  if (dryRun) {
    console.error(`Preview review update: ${center.updatedAt}`);
    console.error(`Recipients: ${recipients.length}`);
    console.error(`Directions: ${center.directions.length}`);
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
  await verifyPublishedReviewCenter(center, currentSiteUrl);

  let info;
  try {
    info = await withSmtpRetry(
      () => withTransport(smtpConfig, (transporter) => transporter.sendMail(
        buildBulkMailOptions({
          from,
          envelopeTo: smtpConfig.user || from,
          recipients,
          subject,
          text,
          html
        })
      )),
      retryOptions(smtpConfig)
    );
  } catch (error) {
    throw new Error(explainSmtpError(error, smtpConfig));
  }

  const acceptedCount = validateDelivery(info, recipients);
  const messageId = normalizeString(info?.messageId);
  console.error(`SMTP服务端已接受 ${acceptedCount} 位收件人的综述中心更新通知${messageId ? `（messageId: ${messageId}）` : ""}`);
}

async function publishIdeaUpdate(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const [center, smtpConfig, recipientState] = await Promise.all([
    getIdeaCenter(),
    loadSmtpConfig(),
    loadRecipientState()
  ]);
  const currentSiteUrl = siteUrl(smtpConfig);
  const recipients = recipientState.recipients;
  assertIdeaCenterReady(center);
  const subject = buildIdeaUpdateSubject(center);
  const text = buildIdeaUpdateTextBody(center, currentSiteUrl);
  const html = buildIdeaUpdateHtmlBody(center, currentSiteUrl);
  const from = smtpConfig.from || smtpConfig.user;

  if (dryRun) {
    const stats = summarizeIdeaCenter(center);
    console.error(`Preview idea update: ${center.updatedAt}`);
    console.error(`Recipients: ${recipients.length}`);
    console.error(`Directions: ${stats.directions}`);
    console.error(`Reviewed ideas: ${stats.reviewedIdeas}`);
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
  try {
    await verifyPublishedIdeaCenter(center, currentSiteUrl);
  } catch (error) {
    if (error.code !== "IDEA_LIVE_FETCH_FAILED" || !smtpConfig.actionsDeploymentFallback) {
      throw error;
    }
    const identity = localGitDeploymentIdentity();
    const deployment = await verifyIdeaCenterActionsDeployment(center, {
      ...identity,
      workflow: smtpConfig.deploymentWorkflow,
      branch: smtpConfig.deploymentBranch
    });
    console.error(
      `GitHub Pages 直播地址暂不可达；已核验同一提交的成功 Actions 部署：${deployment.runId}`
    );
  }

  let info;
  try {
    info = await withSmtpRetry(
      () => withTransport(smtpConfig, (transporter) => transporter.sendMail(
        buildBulkMailOptions({
          from,
          envelopeTo: smtpConfig.user || from,
          recipients,
          subject,
          text,
          html
        })
      )),
      retryOptions(smtpConfig)
    );
  } catch (error) {
    throw new Error(explainSmtpError(error, smtpConfig));
  }

  const acceptedCount = validateDelivery(info, recipients);
  const messageId = normalizeString(info?.messageId);
  console.error(`SMTP服务端已接受 ${acceptedCount} 位收件人的 Idea 中心更新通知${messageId ? `（messageId: ${messageId}）` : ""}`);
}

export async function main(argv = process.argv.slice(2)) {
  const [command, digestId] = argv;

  if (command === "check") {
    await checkSmtpConnection();
    return;
  }

  if (["review-update-preview", "review-update"].includes(command)) {
    await publishReviewUpdate({ dryRun: command === "review-update-preview" });
    return;
  }

  if (["idea-update-preview", "idea-update"].includes(command)) {
    await publishIdeaUpdate({ dryRun: command === "idea-update-preview" });
    return;
  }

  if (!digestId || !["preview", "publish", "welcome-preview", "welcome"].includes(command)) {
    usage();
    throw new Error("邮件命令参数不完整");
  }

  await publishDigest(digestId, {
    dryRun: command === "preview" || command === "welcome-preview",
    welcome: command === "welcome" || command === "welcome-preview"
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
