import { execFile as execFileCallback } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const CONTENT = path.join(ROOT, "content");
const CONFIG = path.join(ROOT, "config");
const PUBLICATIONS_PATH = path.join(CONFIG, "feishu-publications.json");
const LOCAL_CONFIG_PATH = path.join(CONFIG, "feishu.local.json");
const FEISHU_API = "https://open.feishu.cn/open-apis";
const MAX_BLOCKS_PER_REQUEST = 50;
const MAX_IMAGES_PER_REQUEST = 20;
const FETCH_TIMEOUT_MS = 30000;
const DEFAULT_SITE_URL = "https://crazyshout.github.io/paper-digest/";
const HIERARCHY_FORMAT = "feishu-wiki-hierarchy-v1";

function loadLocalConfig() {
  try {
    const data = JSON.parse(readFileSync(LOCAL_CONFIG_PATH, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error(`读取飞书本地配置失败：${error.message}`);
  }
}

const localConfig = loadLocalConfig();

function configValue(...keys) {
  for (const key of keys) {
    const value = localConfig[key] ?? process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function usage() {
  console.error("Usage: npm run feishu:preview -- <digest-id>");
  console.error("       npm run feishu:publish -- <digest-id> [--force-new] [--parent-only]");
}

function parseMarkdownFile(text, filePath) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filePath} is missing JSON frontmatter`);
  }

  return {
    data: JSON.parse(match[1]),
    body: match[2].trim()
  };
}

async function readContentMarkdown(type, id) {
  const filePath = path.join(CONTENT, type, `${id}.md`);
  const text = await readFile(filePath, "utf8");
  return { filePath, ...parseMarkdownFile(text, filePath) };
}

async function readInterestConfig() {
  return JSON.parse(await readFile(path.join(CONFIG, "research-interests.json"), "utf8"));
}

function normalizePaperTags(data) {
  const tags = [];

  if (typeof data.tag === "string" && data.tag.trim()) {
    tags.push(data.tag.trim());
  }

  if (Array.isArray(data.tags)) {
    for (const tag of data.tags) {
      if (typeof tag === "string" && tag.trim() && !tags.includes(tag.trim())) {
        tags.push(tag.trim());
      }
    }
  }

  return tags;
}

function parseWikiToken(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/\/wiki\/([^/?#]+)/);
  return match ? match[1] : raw;
}

function siteUrl() {
  return String(configValue("siteUrl", "SITE_URL", "PUBLIC_SITE_URL") || DEFAULT_SITE_URL).replace(/\/$/, "");
}

function feishuWikiOrigin() {
  const wikiUrl = configValue("wikiUrl", "FEISHU_WIKI_URL");
  if (wikiUrl) {
    try {
      return new URL(wikiUrl).origin;
    } catch {
      // Fall back to the common Feishu China domain when a raw wiki token is used.
    }
  }
  return "https://my.feishu.cn";
}

function resolveImageUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("../../assets/")) return `${siteUrl()}/${url.replace(/^(?:\.\.\/)+/, "")}`;
  if (url.startsWith("/")) return `${siteUrl()}${url}`;
  return url;
}

function normalizeImageUrls(markdown) {
  return markdown.replace(/!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (full, alt, url) => {
    return `![${alt}](${resolveImageUrl(url)})`;
  });
}

function normalizeMarkdownForFeishu(markdown) {
  return normalizeImageUrls(markdown)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function digestDisplayDate(digest) {
  return digest.data.displayDate || digest.data.date;
}

function digestPublicationTitle(digest) {
  return `${digestDisplayDate(digest)} - ${digest.data.title}`;
}

async function buildPublicationModel(digestId) {
  const interestConfig = await readInterestConfig();
  const tagMap = new Map((interestConfig.interests || []).map((tag) => [tag.id, tag]));
  const digest = await readContentMarkdown("digests", digestId);
  const papers = [];

  for (const paperId of digest.data.papers || []) {
    const paper = await readContentMarkdown("papers", paperId);
    const tagIds = normalizePaperTags(paper.data);
    papers.push({
      ...paper,
      tagIds,
      tags: tagIds.map((tagId) => tagMap.get(tagId) || {
        id: tagId,
        label: tagId,
        description: "",
        color: "#2f6f8f"
      })
    });
  }

  const digestTags = [];
  for (const paper of papers) {
    for (const tag of paper.tags) {
      if (!digestTags.some((item) => item.id === tag.id)) {
        digestTags.push(tag);
      }
    }
  }

  return {
    digestId,
    digest,
    papers,
    tags: digestTags,
    title: digestPublicationTitle(digest)
  };
}

function paperTitleWithIndex(paper, index) {
  return `${String(index + 1).padStart(2, "0")} ${paper.data.title}`;
}

function buildPaperMarkdown(model, paper, parentDoc) {
  const lines = [];

  lines.push(`# ${paper.data.title}`);
  lines.push("");
  if (parentDoc?.url) {
    lines.push(`[返回本期简报](${parentDoc.url})`);
    lines.push("");
  }
  lines.push(`- 论文 ID：${paper.data.id}`);
  lines.push(`- 所属简报：${digestPublicationTitle(model.digest)}`);
  lines.push(`- 方向：${paper.tags.map((tag) => tag.label).join(" / ")}`);
  lines.push(`- 来源：${paper.data.source}`);
  lines.push(`- 作者：${(paper.data.authors || []).join(", ")}`);
  lines.push(`- 单位：${(paper.data.affiliations || []).join("; ")}`);
  lines.push(`- 简评：${paper.data.comment}`);
  lines.push("");
  lines.push(normalizeMarkdownForFeishu(paper.body));
  lines.push("");

  return `${lines.join("\n").trim()}\n`;
}

function childLink(child) {
  return child?.url || "";
}

function formatPaperBullet(paper, child) {
  const title = childLink(child) ? `[${paper.data.title}](${child.url})` : paper.data.title;
  return `- ${title}：${paper.data.comment}`;
}

function directionLink(parentDoc, tag) {
  if (parentDoc?.url) {
    return `${parentDoc.url}#${tag.label}`;
  }
  return `#${tag.label}`;
}

function buildDigestMarkdown(model, childDocsByPaperId = {}, parentDoc = null) {
  const lines = [];
  const digest = model.digest;

  lines.push(`# ${digestPublicationTitle(digest)}`);
  lines.push("");
  lines.push(`- 日期：${digest.data.displayDate || digest.data.date}`);
  lines.push(`- 关键词：${(digest.data.keywords || []).join(" / ")}`);
  lines.push(`- 摘要：${digest.data.summary}`);
  lines.push("");
  lines.push("## 方向导航");
  lines.push("");

  for (const tag of model.tags) {
    const papers = model.papers.filter((paper) => paper.tagIds.includes(tag.id));
    lines.push(`- [${tag.label}（${papers.length} 篇）](${directionLink(parentDoc, tag)})`);
  }

  lines.push("");
  lines.push("## 按方向阅读");
  lines.push("");

  for (const tag of model.tags) {
    const papers = model.papers.filter((paper) => paper.tagIds.includes(tag.id));
    lines.push(`### ${tag.label}`);
    if (tag.description) {
      lines.push("");
      lines.push(tag.description);
    }
    lines.push("");
    for (const paper of papers) {
      lines.push(formatPaperBullet(paper, childDocsByPaperId[paper.data.id]));
    }
    lines.push("");
  }

  lines.push("## 本期简报");
  lines.push("");
  if (digest.body) {
    lines.push(normalizeMarkdownForFeishu(digest.body));
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

async function readPublications() {
  try {
    return JSON.parse(await readFile(PUBLICATIONS_PATH, "utf8"));
  } catch (error) {
    return { publications: {} };
  }
}

async function writePublications(publications) {
  await writeFile(PUBLICATIONS_PATH, `${JSON.stringify(publications, null, 2)}\n`);
}

async function feishuFetch(pathname, tenantAccessToken, options = {}) {
  const response = await fetch(`${FEISHU_API}${pathname}`, {
    ...options,
    signal: options.signal || AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${tenantAccessToken}`,
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Feishu API returned non-JSON response for ${pathname}: ${text.slice(0, 200)}`);
  }

  if (!response.ok || data.code !== 0) {
    const message = data.msg || data.message || text;
    const hint = data.code === 131006 && pathname.includes("/wiki/v2/spaces/")
      ? " Hint: add this Feishu app/bot as a member or admin of the target wiki space/node, and grant edit permission."
      : "";
    throw new Error(`Feishu API failed for ${pathname}: HTTP ${response.status}, code ${data.code}, msg ${message}.${hint}`);
  }

  return data.data || {};
}

async function getTenantAccessToken() {
  const appId = configValue("appId", "FEISHU_APP_ID");
  const appSecret = configValue("appSecret", "FEISHU_APP_SECRET");

  if (!appId || !appSecret) {
    throw new Error("Missing FEISHU_APP_ID or FEISHU_APP_SECRET environment variable");
  }

  const response = await fetch(`${FEISHU_API}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  });
  const data = await response.json();

  if (!response.ok || data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Could not get tenant_access_token: HTTP ${response.status}, code ${data.code}, msg ${data.msg || data.message || ""}`);
  }

  return data.tenant_access_token;
}

let wikiParentCache = null;

async function resolveWikiParent(tenantAccessToken) {
  if (wikiParentCache) return wikiParentCache;

  const parentNodeToken = parseWikiToken(
    configValue("wikiParentToken", "FEISHU_WIKI_PARENT_TOKEN") ||
    configValue("wikiUrl", "FEISHU_WIKI_URL") ||
    configValue("parentNodeToken", "FEISHU_PARENT_NODE_TOKEN")
  );
  const explicitSpaceId = configValue("spaceId", "FEISHU_SPACE_ID");

  if (!parentNodeToken) {
    throw new Error("Missing FEISHU_WIKI_URL or FEISHU_WIKI_PARENT_TOKEN environment variable");
  }

  if (explicitSpaceId) {
    wikiParentCache = { spaceId: explicitSpaceId, parentNodeToken };
    return wikiParentCache;
  }

  const attempts = [
    `/wiki/v2/spaces/get_node?token=${encodeURIComponent(parentNodeToken)}&obj_type=wiki`,
    `/wiki/v2/spaces/get_node?token=${encodeURIComponent(parentNodeToken)}`
  ];
  const errors = [];

  for (const pathname of attempts) {
    try {
      const data = await feishuFetch(pathname, tenantAccessToken);
      const node = data.node || data;
      const spaceId = node.space_id || data.space_id;
      const nodeToken = node.node_token || node.token || parentNodeToken;
      if (spaceId) {
        wikiParentCache = { spaceId, parentNodeToken: nodeToken };
        return wikiParentCache;
      }
    } catch (error) {
      errors.push(error.message);
    }
  }

  throw new Error(`Could not resolve Feishu wiki space from token. Set FEISHU_SPACE_ID manually. Details: ${errors.join(" | ")}`);
}

async function createWikiDocument(tenantAccessToken, title, parentNodeTokenOverride = "") {
  const { spaceId, parentNodeToken } = await resolveWikiParent(tenantAccessToken);
  const data = await feishuFetch(`/wiki/v2/spaces/${encodeURIComponent(spaceId)}/nodes`, tenantAccessToken, {
    method: "POST",
    body: JSON.stringify({
      obj_type: "docx",
      node_type: "origin",
      parent_node_token: parentNodeTokenOverride || parentNodeToken,
      title
    })
  });
  const node = data.node || data;
  const documentId = node.obj_token || node.object_token || node.token;

  if (!documentId) {
    throw new Error(`Feishu wiki node created but no docx token returned: ${JSON.stringify(data)}`);
  }

  return {
    documentId,
    nodeToken: node.node_token || "",
    url: node.url || node.node_url || (node.node_token ? `${feishuWikiOrigin()}/wiki/${node.node_token}` : "")
  };
}

async function updateWikiDocumentTitle(tenantAccessToken, nodeToken, title) {
  if (!nodeToken) return;
  const { spaceId } = await resolveWikiParent(tenantAccessToken);
  await feishuFetch(
    `/wiki/v2/spaces/${encodeURIComponent(spaceId)}/nodes/${encodeURIComponent(nodeToken)}/update_title`,
    tenantAccessToken,
    {
      method: "POST",
      body: JSON.stringify({ title })
    }
  );
}

function cloneBlockWithoutRuntimeIds(block) {
  const cloned = structuredClone(block);
  delete cloned.block_id;
  delete cloned.parent_id;
  return cloned;
}

function orderedConvertedBlocks(converted) {
  const byId = new Map((converted.blocks || []).map((block) => [block.block_id, block]));
  const ids = converted.first_level_block_ids?.length
    ? converted.first_level_block_ids
    : (converted.blocks || []).map((block) => block.block_id);

  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((block) => ({
      sourceBlockId: block.block_id,
      block: cloneBlockWithoutRuntimeIds(block)
    }));
}

async function convertMarkdownToBlocks(tenantAccessToken, markdown) {
  const converted = await feishuFetch("/docx/v1/documents/blocks/convert", tenantAccessToken, {
    method: "POST",
    body: JSON.stringify({
      content_type: "markdown",
      content: normalizeMarkdownForFeishu(markdown)
    })
  });
  const imageUrls = new Map(
    (converted.block_id_to_image_urls || []).map((item) => [item.block_id, item.image_url])
  );
  return orderedConvertedBlocks(converted).map((entry) => ({
    ...entry,
    imageUrl: imageUrls.get(entry.sourceBlockId) || ""
  }));
}

function blockBatchHasRoom(batch, nextEntry) {
  if (batch.length >= MAX_BLOCKS_PER_REQUEST) return false;
  const imageCount = batch.filter((entry) => entry.imageUrl).length;
  return imageCount + (nextEntry.imageUrl ? 1 : 0) <= MAX_IMAGES_PER_REQUEST;
}

async function appendConvertedBlocks(tenantAccessToken, documentId, entries) {
  const createdEntries = [];
  let batch = [];

  async function flush() {
    if (!batch.length) return;
    const data = await feishuFetch(
      `/docx/v1/documents/${encodeURIComponent(documentId)}/blocks/${encodeURIComponent(documentId)}/children`,
      tenantAccessToken,
      {
        method: "POST",
        body: JSON.stringify({ children: batch.map((entry) => entry.block) })
      }
    );
    const createdBlocks = data.children || data.items || data.blocks || [];
    for (let offset = 0; offset < batch.length; offset += 1) {
      createdEntries.push({
        ...batch[offset],
        createdBlockId: createdBlocks[offset]?.block_id || ""
      });
    }
    batch = [];
  }

  for (const entry of entries) {
    if (!blockBatchHasRoom(batch, entry)) {
      await flush();
    }
    batch.push(entry);
  }

  await flush();
  return createdEntries;
}

async function listRootChildren(tenantAccessToken, documentId) {
  const children = [];
  let pageToken = "";

  do {
    const query = new URLSearchParams({
      page_size: "500",
      document_revision_id: "-1"
    });
    if (pageToken) query.set("page_token", pageToken);
    const data = await feishuFetch(
      `/docx/v1/documents/${encodeURIComponent(documentId)}/blocks/${encodeURIComponent(documentId)}/children?${query}`,
      tenantAccessToken
    );
    children.push(...(data.items || data.children || []));
    pageToken = data.page_token || "";
  } while (pageToken);

  return children;
}

async function clearRootChildren(tenantAccessToken, documentId) {
  const children = await listRootChildren(tenantAccessToken, documentId);
  if (!children.length) return;

  await feishuFetch(
    `/docx/v1/documents/${encodeURIComponent(documentId)}/blocks/${encodeURIComponent(documentId)}/children/batch_delete`,
    tenantAccessToken,
    {
      method: "DELETE",
      body: JSON.stringify({
        start_index: 0,
        end_index: children.length
      })
    }
  );
}

function publicAssetPathFromUrl(url) {
  const raw = String(url || "");
  if (raw.startsWith("../../assets/")) {
    return path.join(ROOT, "public", raw.replace(/^(?:\.\.\/)+/, ""));
  }
  if (raw.startsWith("/assets/")) {
    return path.join(ROOT, "public", raw.replace(/^\//, ""));
  }
  if (raw.startsWith(`${siteUrl()}/assets/`)) {
    return path.join(ROOT, "public", raw.slice(siteUrl().length + 1));
  }
  return "";
}

function contentTypeFromFileName(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "application/octet-stream";
}

function fileNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(path.basename(parsed.pathname)) || "paper-image.png";
  } catch {
    return path.basename(url) || "paper-image.png";
  }
}

function imageFallbackTextBlock(imageUrl) {
  return {
    block_type: 2,
    text: {
      elements: [
        {
          text_run: {
            content: `图片：${imageUrl}`,
            text_element_style: {
              link: {
                url: encodeURIComponent(imageUrl)
              }
            }
          }
        }
      ],
      style: {}
    }
  };
}

async function readImageAsset(imageUrl) {
  const localPath = publicAssetPathFromUrl(imageUrl);
  if (localPath) {
    const buffer = await readFile(localPath);
    const fileName = path.basename(localPath);
    return {
      buffer,
      fileName,
      contentType: contentTypeFromFileName(fileName)
    };
  }

  const fileName = fileNameFromUrl(imageUrl);
  try {
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; paper-digest-feishu-publisher/1.0)"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      fileName,
      contentType: response.headers.get("content-type") || contentTypeFromFileName(fileName)
    };
  } catch (error) {
    console.warn(`Node fetch failed for ${imageUrl}; trying curl fallback. ${error.message}`);
  }

  const { stdout } = await execFile(
    "curl",
    [
      "-L",
      "--fail",
      "--silent",
      "--show-error",
      "--max-time",
      String(Math.ceil(FETCH_TIMEOUT_MS / 1000) * 2),
      "-A",
      "Mozilla/5.0 (compatible; paper-digest-feishu-publisher/1.0)",
      imageUrl
    ],
    {
      encoding: "buffer",
      maxBuffer: 30 * 1024 * 1024
    }
  );

  if (!stdout.length) {
    throw new Error(`curl returned an empty image response for ${imageUrl}`);
  }

  return {
    buffer: Buffer.from(stdout),
    fileName,
    contentType: contentTypeFromFileName(fileName)
  };
}

async function prepareImageAssets(entries) {
  const imageEntries = entries.filter((entry) => entry.imageUrl);

  for (let index = 0; index < imageEntries.length; index += 1) {
    const entry = imageEntries[index];
    console.error(`Preparing image ${index + 1}/${imageEntries.length}: ${entry.imageUrl}`);
    try {
      entry.imageAsset = await readImageAsset(entry.imageUrl);
    } catch (error) {
      console.warn(`Image will be published as a link instead of an embedded image: ${entry.imageUrl}. ${error.message}`);
      entry.block = imageFallbackTextBlock(entry.imageUrl);
      entry.imageUrl = "";
    }
  }

  return entries;
}

async function uploadImageToBlock(tenantAccessToken, documentId, blockId, imageAsset) {
  const formData = new FormData();
  formData.append("file_name", imageAsset.fileName);
  formData.append("parent_type", "docx_image");
  formData.append("parent_node", blockId);
  formData.append("size", String(imageAsset.buffer.byteLength));
  formData.append("file", new Blob([imageAsset.buffer], { type: imageAsset.contentType }), imageAsset.fileName);

  const response = await fetch(`${FEISHU_API}/drive/v1/medias/upload_all`, {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${tenantAccessToken}`
    },
    body: formData
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Feishu media upload returned non-JSON response: ${text.slice(0, 200)}`);
  }
  if (!response.ok || data.code !== 0) {
    throw new Error(`Feishu media upload failed for ${imageAsset.fileName}: HTTP ${response.status}, code ${data.code}, msg ${data.msg || data.message || text}`);
  }

  const fileToken = data.data?.file_token;
  if (!fileToken) return;

  await feishuFetch(
    `/docx/v1/documents/${encodeURIComponent(documentId)}/blocks/${encodeURIComponent(blockId)}`,
    tenantAccessToken,
    {
      method: "PATCH",
      body: JSON.stringify({
        replace_image: {
          token: fileToken
        }
      })
    }
  );
}

async function uploadImages(tenantAccessToken, documentId, createdEntries) {
  let fallbackChildren = null;
  const imageEntries = createdEntries.filter((entry) => entry.imageUrl);
  let uploaded = 0;

  for (let index = 0; index < createdEntries.length; index += 1) {
    const entry = createdEntries[index];
    if (!entry.imageUrl) continue;
    let blockId = entry.createdBlockId;
    if (!blockId) {
      fallbackChildren = fallbackChildren || await listRootChildren(tenantAccessToken, documentId);
      blockId = fallbackChildren[index]?.block_id || "";
    }
    if (!blockId) {
      throw new Error(`Could not resolve created Feishu image block for ${entry.imageUrl}`);
    }
    uploaded += 1;
    console.error(`Uploading image ${uploaded}/${imageEntries.length}: ${entry.imageAsset.fileName}`);
    await uploadImageToBlock(tenantAccessToken, documentId, blockId, entry.imageAsset);
  }
}

function textElementsForBlock(block) {
  return block.heading1?.elements ||
    block.heading2?.elements ||
    block.heading3?.elements ||
    block.heading4?.elements ||
    block.heading5?.elements ||
    block.heading6?.elements ||
    block.heading7?.elements ||
    block.heading8?.elements ||
    block.heading9?.elements ||
    block.text?.elements ||
    block.bullet?.elements ||
    block.ordered?.elements ||
    [];
}

function textContentForBlock(block) {
  return textElementsForBlock(block)
    .map((element) => element.text_run?.content || "")
    .join("");
}

function blockJumpUrl(doc, blockId) {
  const origin = doc.url ? new URL(doc.url).origin : feishuWikiOrigin();
  return `${origin}/docx/${doc.documentId}?from=from_copylink&blockId=${blockId}#${blockId}`;
}

async function patchDirectionNavigationLinks(tenantAccessToken, doc, model) {
  const blocks = await listRootChildren(tenantAccessToken, doc.documentId);
  const navStart = blocks.findIndex((block) => textContentForBlock(block) === "方向导航");
  const readingStart = blocks.findIndex((block) => textContentForBlock(block) === "按方向阅读");
  if (navStart < 0 || readingStart < 0 || readingStart <= navStart) {
    console.warn("Could not locate direction navigation headings; skip block-link patching.");
    return;
  }

  const navBlocks = blocks.slice(navStart + 1, readingStart);
  const sectionBlocks = blocks.slice(readingStart + 1);
  const requests = [];

  for (const tag of model.tags) {
    const papers = model.papers.filter((paper) => paper.tagIds.includes(tag.id));
    const label = `${tag.label}（${papers.length} 篇）`;
    const navBlock = navBlocks.find((block) => textContentForBlock(block) === label);
    const sectionBlock = sectionBlocks.find((block) => block.block_type === 5 && textContentForBlock(block) === tag.label);

    if (!navBlock || !sectionBlock) {
      console.warn(`Could not locate navigation or section block for ${tag.label}`);
      continue;
    }

    requests.push({
      block_id: navBlock.block_id,
      update_text_elements: {
        elements: [
          {
            text_run: {
              content: label,
              text_element_style: {
                link: {
                  url: encodeURIComponent(blockJumpUrl(doc, sectionBlock.block_id))
                }
              }
            }
          }
        ]
      }
    });
  }

  if (!requests.length) return;

  await feishuFetch(
    `/docx/v1/documents/${encodeURIComponent(doc.documentId)}/blocks/batch_update`,
    tenantAccessToken,
    {
      method: "PATCH",
      body: JSON.stringify({ requests })
    }
  );
  console.error(`Patched ${requests.length} direction navigation links to Feishu block URLs.`);
}

async function writeMarkdownToDocument(tenantAccessToken, documentId, markdown, label) {
  console.error(`Converting Markdown to Feishu Docx blocks: ${label}`);
  const entries = await convertMarkdownToBlocks(tenantAccessToken, markdown);
  console.error(`Converted ${entries.length} blocks, including ${entries.filter((entry) => entry.imageUrl).length} image blocks: ${label}`);
  await prepareImageAssets(entries);

  console.error(`Clearing existing Feishu document body: ${label}`);
  await clearRootChildren(tenantAccessToken, documentId);

  console.error(`Appending Feishu Docx blocks: ${label}`);
  const createdEntries = await appendConvertedBlocks(tenantAccessToken, documentId, entries);
  await uploadImages(tenantAccessToken, documentId, createdEntries);

  return {
    blocks: entries.length,
    images: entries.filter((entry) => entry.imageUrl).length
  };
}

async function sendWebhookNotification(title, url, digestId) {
  const webhookUrl = configValue("webhookUrl", "FEISHU_WEBHOOK_URL");
  if (!webhookUrl) return;

  const response = await fetch(webhookUrl, {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      msg_type: "interactive",
      card: {
        header: {
          title: { tag: "plain_text", content: "论文简报已发布" },
          template: "blue"
        },
        elements: [
          {
            tag: "markdown",
            content: `**${title}**\n\nDigest ID: ${digestId}\n\n[打开飞书文档](${url})`
          }
        ]
      }
    })
  });

  if (!response.ok) {
    console.warn(`Feishu webhook notification failed: HTTP ${response.status}`);
  }
}

async function preview(digestId) {
  const model = await buildPublicationModel(digestId);
  process.stdout.write(buildDigestMarkdown(model));
}

async function publish(digestId, options) {
  const publications = await readPublications();
  const existing = publications.publications?.[digestId];
  const model = await buildPublicationModel(digestId);
  const tenantAccessToken = await getTenantAccessToken();
  const doc = existing && !options.forceNew && existing.documentId
    ? {
        documentId: existing.documentId,
        nodeToken: existing.nodeToken || "",
        url: existing.url || (existing.nodeToken ? `${feishuWikiOrigin()}/wiki/${existing.nodeToken}` : "")
      }
    : await createWikiDocument(tenantAccessToken, model.title);

  if (!doc.nodeToken) {
    throw new Error(`Could not create child paper reports because the digest wiki node token is missing for ${digestId}`);
  }

  await updateWikiDocumentTitle(tenantAccessToken, doc.nodeToken, model.title);

  const existingPaperReports = existing && !options.forceNew ? existing.paperReports || {} : {};
  const paperReports = {};

  if (options.parentOnly) {
    for (const paper of model.papers) {
      if (!existingPaperReports[paper.data.id]?.documentId) {
        throw new Error(`Cannot use --parent-only because ${paper.data.id} has no existing Feishu child report`);
      }
      paperReports[paper.data.id] = existingPaperReports[paper.data.id];
    }
  } else {
    for (let index = 0; index < model.papers.length; index += 1) {
      const paper = model.papers[index];
      const existingChild = existingPaperReports[paper.data.id];
      const childTitle = paperTitleWithIndex(paper, index);
      const childDoc = existingChild?.documentId
        ? {
            title: existingChild.title || childTitle,
            documentId: existingChild.documentId,
            nodeToken: existingChild.nodeToken || "",
            url: existingChild.url || (existingChild.nodeToken ? `${feishuWikiOrigin()}/wiki/${existingChild.nodeToken}` : "")
          }
        : await createWikiDocument(tenantAccessToken, childTitle, doc.nodeToken);

      await writeMarkdownToDocument(
        tenantAccessToken,
        childDoc.documentId,
        buildPaperMarkdown(model, paper, doc),
        `paper ${index + 1}/${model.papers.length}: ${paper.data.id}`
      );

      paperReports[paper.data.id] = {
        title: childTitle,
        documentId: childDoc.documentId,
        nodeToken: childDoc.nodeToken,
        url: childDoc.url,
        updatedAt: new Date().toISOString()
      };
    }
  }

  await writeMarkdownToDocument(
    tenantAccessToken,
    doc.documentId,
    buildDigestMarkdown(model, paperReports, doc),
    "digest parent"
  );
  await patchDirectionNavigationLinks(tenantAccessToken, doc, model);

  publications.publications = publications.publications || {};
  publications.publications[digestId] = {
    title: model.title,
    documentId: doc.documentId,
    nodeToken: doc.nodeToken,
    url: doc.url,
    format: HIERARCHY_FORMAT,
    paperReports,
    publishedAt: new Date().toISOString()
  };
  await writePublications(publications);
  await sendWebhookNotification(model.title, doc.url, digestId);

  const action = existing && !options.forceNew ? "Updated" : "Published";
  console.log(`${action} ${digestId} to Feishu: ${doc.url || doc.documentId}`);
}

async function main() {
  const [command, digestId, ...rest] = process.argv.slice(2);
  if (!command || !digestId || !["preview", "publish"].includes(command)) {
    usage();
    process.exit(1);
  }

  if (command === "preview") {
    await preview(digestId);
    return;
  }

  await publish(digestId, {
    forceNew: rest.includes("--force-new"),
    parentOnly: rest.includes("--parent-only")
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
