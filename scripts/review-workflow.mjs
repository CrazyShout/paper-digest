import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "config", "literature-review-workflow.json");
const INTERESTS_PATH = path.join(ROOT, "config", "research-interests.json");
const REVIEWS_DIR = path.join(ROOT, "content", "reviews");
const execFileAsync = promisify(execFile);

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function skillPath(runtime, name) {
  return path.join(os.homedir(), `.${runtime}`, "skills", name, "SKILL.md");
}

function sharedReferencePath(runtime, name) {
  return path.join(os.homedir(), `.${runtime}`, "skills", "shared-references", name);
}

function upstreamSkillDir(repoRoot, runtime, name) {
  return path.join(
    repoRoot,
    "skills",
    ...(runtime === "codex" ? ["skills-codex"] : []),
    name
  );
}

function upstreamReferencePath(repoRoot, runtime, name) {
  return path.join(
    repoRoot,
    "skills",
    ...(runtime === "codex" ? ["skills-codex"] : []),
    "shared-references",
    name
  );
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function treeDigest(root) {
  const hash = createHash("sha256");

  async function visit(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === ".DS_Store") continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        hash.update(path.relative(root, absolute));
        hash.update("\0");
        hash.update(await readFile(absolute));
        hash.update("\0");
      }
    }
  }

  try {
    await visit(root);
    return hash.digest("hex");
  } catch {
    return "";
  }
}

export async function treesMatch(left, right) {
  const [leftDigest, rightDigest] = await Promise.all([
    treeDigest(left),
    treeDigest(right)
  ]);
  return Boolean(leftDigest) && leftDigest === rightDigest;
}

async function filesMatch(left, right) {
  try {
    const [leftData, rightData] = await Promise.all([
      readFile(left),
      readFile(right)
    ]);
    return leftData.equals(rightData);
  } catch {
    return false;
  }
}

async function manifestRepoRoot(runtime) {
  const manifestName = runtime === "codex"
    ? "installed-skills-codex.txt"
    : "installed-skills.txt";
  const manifest = path.join(ROOT, ".aris", manifestName);
  try {
    const lines = (await readFile(manifest, "utf8")).split(/\r?\n/);
    const repoLine = lines.find((line) => line.startsWith("repo_root\t"));
    return repoLine?.split("\t").slice(1).join("\t").trim() || "";
  } catch {
    return "";
  }
}

async function repoHead(repoRoot) {
  if (!repoRoot) return "";
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoRoot, "rev-parse", "HEAD"]);
    return stdout.trim();
  } catch {
    return "";
  }
}

async function repoIsClean(repoRoot) {
  if (!repoRoot) return false;
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", repoRoot, "status", "--porcelain=v1"]
    );
    return stdout.trim() === "";
  } catch {
    return false;
  }
}

export function isExpectedCommit(actual, expected) {
  return /^[0-9a-f]{40}$/.test(actual)
    && /^[0-9a-f]{40}$/.test(expected)
    && actual === expected;
}

export function isoDateInTimeZone(date = new Date(), timeZone = "Asia/Shanghai") {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function checkInstall(workflow) {
  const checks = [];
  for (const runtime of ["codex", "claude"]) {
    const repoRoot = process.env.ARIS_REPO || await manifestRepoRoot(runtime);
    for (const skill of workflow.requiredSkills) {
      const file = skillPath(runtime, skill.name);
      const installedDir = path.dirname(file);
      const sourceDir = upstreamSkillDir(repoRoot, runtime, skill.name);
      checks.push({
        runtime,
        kind: "skill",
        name: skill.name,
        file: `${installedDir} <= ${sourceDir}`,
        present: await treesMatch(installedDir, sourceDir)
      });
    }
    for (const reference of workflow.requiredReferences) {
      const file = sharedReferencePath(runtime, reference);
      const source = upstreamReferencePath(repoRoot, runtime, reference);
      checks.push({
        runtime,
        kind: "reference",
        name: reference,
        file: `${file} <= ${source}`,
        present: await filesMatch(file, source)
      });
    }
    const head = await repoHead(repoRoot);
    checks.push({
      runtime,
      kind: "upstream",
      name: workflow.upstream.commit,
      file: repoRoot ? `${repoRoot}@${head || "unreadable"}` : "(missing repo root)",
      present: isExpectedCommit(head, workflow.upstream.commit)
    });
    checks.push({
      runtime,
      kind: "upstream-clean",
      name: "working tree",
      file: repoRoot || "(missing repo root)",
      present: await repoIsClean(repoRoot)
    });
    for (const helper of workflow.requiredHelpers || []) {
      const file = path.join(repoRoot, "tools", helper);
      checks.push({
        runtime,
        kind: "helper",
        name: helper,
        file,
        present: Boolean(repoRoot) && await exists(file)
      });
    }
  }

  for (const check of checks) {
    console.log(
      `${check.present ? "OK" : "MISSING"} ${check.runtime} ${check.kind} ${check.name}`
    );
  }

  const missing = checks.filter((check) => !check.present);
  if (missing.length) {
    throw new Error(`${missing.length} required ARIS skill files are missing`);
  }

  console.log(
    `ARIS review workflow ready: ${workflow.upstream.commit.slice(0, 12)} (${workflow.upstream.syncedAt})`
  );
}

export function buildPrompt(workflow, interest, review, runtime = "codex") {
  if (!["codex", "claude"].includes(runtime)) {
    throw new Error(`Unsupported review runtime: ${runtime}`);
  }
  const direction = workflow.directions[interest.id];
  const skills = workflow.requiredSkills
    .filter((skill) => skill.scope === "all" || direction.profile === skill.scope)
    .map((skill) => skill.name);
  const requirements = workflow.requirements;

  return [
    `更新 Paper Digest 的“${interest.label}”动态方向综述。`,
    "",
    "开始前必须完整读取并遵循以下已安装 ARIS 技能：",
    ...skills.map((name) => `- ~/.${runtime}/skills/${name}/SKILL.md`),
    ...workflow.requiredReferences.map(
      (name) => `- ~/.${runtime}/skills/shared-references/${name}`
    ),
    "- content/templates/review-quality-checklist.md",
    "",
    `目标文件：content/reviews/${interest.id}.json`,
    `现有复核日期：${review.reviewedAt}`,
    `检索截止日：${isoDateInTimeZone()}`,
    "",
    "必须覆盖的查询族：",
    ...direction.queryFamilies.map((query, index) => `${index + 1}. ${query}`),
    "",
    "强制流程：",
    "1. 先检索本库，随后并行检索 arXiv、正式出版社/会议、Semantic Scholar、OpenAlex 与官方项目页。",
    "2. 检索分片只抽取候选，不排序质量；父流程按 DOI、arXiv ID 或规范化标题机械去重。",
    "3. 每条纳入引用必须打开一手来源，核对标题、作者、年份、出版状态、venue、URL、支撑论断和限制。",
    "4. 综合时按 scope/evolution/taxonomy/evidence/challenges/outlook 组织，明确共识、冲突证据、失败边界和可验证研究议程。",
    "5. 完成后由未参与撰写的独立审阅者复核事实、覆盖、结构和可读性；通过后记录当前内容的 snapshotFingerprint，任何后续内容变化都必须重新复核。",
    "",
    "强制终审检查：",
    ...workflow.qualityChecks.map(
      (check) => `- ${check.code}: ${check.instruction}`
    ),
    "",
    "最低证据覆盖：",
    `- 查询族 ${requirements.minQueryFamilies}+，来源族 ${requirements.minSourceFamilies}+。`,
    `- 引用 ${requirements.minReferences}+；其中 ${requirements.recentSinceYear} 年以来 ${requirements.minRecentReferences}+，${requirements.foundationalBeforeYear} 年以前基础文献 ${requirements.minFoundationalReferences}+。`,
    `- 正式同行评审 ${requirements.minFormalReferences}+，综述/教程 ${requirements.minSurveyOrTutorialReferences}+，本库 ${requirements.minLocalReferences}+，站外 ${requirements.minExternalReferences}+。`,
    `- 每个配置查询族必须保存一条 queryRuns 记录和至少 ${requirements.minQueryResultSamples} 个规范化候选 ID；完整记录至少 ${requirements.minExcludedCandidates} 个排除候选及理由。`,
    "- 不得把搜索摘要、二手博客、模型记忆或无法打开的 URL 当作论据。",
    "- 不得将预印本写成已同行评审；无法核实的内容必须标记为未确认或删除。",
    "",
    `同时更新 searchAudit：queryRuns 保存 family/sourceFamily/query/scopeRationale/executedAt/resultCount/resultIdSample，并在 retrieval 中保存 provider/endpoint/parameters/sort/limit；resultCount 只统计经过范围复核、实际进入跨源去重池的论文候选。本库宽泛检索还必须保存 rawHitCount、screenedOutCount 和 screeningNote，且 rawHitCount = resultCount + screenedOutCount，不能把 rg 命中文件数直接当候选数；命中且带当前方向标签的规范化论文必须完整写入 localCandidateDisposition.candidateLocalPaperIds，并逐篇落到最终引用或有理由的 deferredGroups，不得静默漏筛；sourceAttempts 对所有配置来源记录成功或受限的真实尝试，其中 acceptedCount 只统计最终纳入并以该来源族核验的引用，必须与 references[].sourceFamily 逐源一致；已录用且同时存在正式出版页与 arXiv 的论文，url 指向正式版，有正式 DOI 时以 DOI 作为 canonicalId 并在 links 显式保留 arXiv；retainedCanonicalIds 必须与 references 完全一致；excludedCandidates 保存 canonicalId/title/url/reasonCode/reason；deduplicationKeys 固定记录 DOI、arXiv、venue ID 和规范化标题；检索日期自 ${requirements.candidateLedgerRequiredFrom} 起必须保存 candidateLedger，逐篇记录主 canonicalId、disposition、queryFamilies 与 occurrences，先归并 DOI/arXiv/venue 别名，再由台账重算每族 resultCount、候选总数与去重数；只允许使用 counts 这一套计数字段。`
  ].join("\n");
}

async function main() {
  const [workflow, interests] = await Promise.all([
    readJson(CONFIG_PATH),
    readJson(INTERESTS_PATH)
  ]);
  const command = process.argv[2] || "check";

  if (command === "check") {
    await checkInstall(workflow);
    return;
  }

  if (command !== "prompt") {
    throw new Error("Usage: node scripts/review-workflow.mjs check|prompt <direction-id> [codex|claude]");
  }

  const directionId = process.argv[3];
  const runtime = process.argv[4] || process.env.REVIEW_RUNTIME || "codex";
  const interest = interests.interests.find((item) => item.id === directionId);
  const direction = workflow.directions[directionId];
  if (!interest || !direction) {
    throw new Error(`Unknown review direction: ${directionId || "(missing)"}`);
  }

  await checkInstall(workflow);
  const review = await readJson(path.join(REVIEWS_DIR, `${directionId}.json`));
  console.log("\n" + buildPrompt(workflow, interest, review, runtime));
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
