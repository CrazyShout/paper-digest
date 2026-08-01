import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "config", "idea-exploration-workflow.json");
const REVIEW_CONFIG_PATH = path.join(ROOT, "config", "literature-review-workflow.json");
const INTERESTS_PATH = path.join(ROOT, "config", "research-interests.json");
const TEMPLATE_PATH = path.join(ROOT, "content", "templates", "idea-exploration-template.md");
const SKILL_ROOT = path.join(process.env.HOME || "", ".codex", "skills");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadContracts() {
  const [workflow, reviewWorkflow, interests] = await Promise.all([
    readJson(CONFIG_PATH),
    readJson(REVIEW_CONFIG_PATH),
    readJson(INTERESTS_PATH)
  ]);
  return { workflow, reviewWorkflow, interests };
}

function directionIds(interests) {
  return interests.interests.map((interest) => interest.id);
}

function assertContract(condition, message) {
  if (!condition) throw new Error(message);
}

async function check() {
  const { workflow, reviewWorkflow, interests } = await loadContracts();
  const configuredDirections = directionIds(interests);
  const reviewDirections = Object.keys(reviewWorkflow.directions);

  assertContract(workflow.version >= 1, "Idea workflow version is missing.");
  assertContract(
    configuredDirections.length === reviewDirections.length
      && configuredDirections.every((id) => reviewDirections.includes(id)),
    "Idea directions must match the literature-review direction contract."
  );
  assertContract(
    workflow.evaluation.dimensions.length === 5,
    "Blind review must define exactly five required dimensions."
  );
  assertContract(
    workflow.evaluation.reviewerLenses.length >= 5,
    "Blind review must use at least five independent reviewer lenses."
  );
  assertContract(
    workflow.evaluation.promptPolicy.some((rule) => rule.includes("不得包含")),
    "The reviewer prompt policy must keep the acceptance threshold hidden."
  );
  assertContract(
    workflow.evaluation.snapshotPolicy?.includes("dossierSnapshotFingerprint"),
    "Idea reviews must bind to a frozen dossier snapshot."
  );
  assertContract(
    workflow.evaluation.reviewerReusePolicy?.includes("不得参与任何候选的检索、筛选或方案撰写"),
    "Idea workflow must separate retrieval, selection, design, and blind-review roles."
  );
  assertContract(
    workflow.candidateHardStops?.length >= 5
      && new Set(workflow.candidateHardStops.map((rule) => rule.id)).size
        === workflow.candidateHardStops.length,
    "Idea workflow must define unique evidence-based candidate hard stops."
  );

  for (const skill of workflow.requiredSkills) {
    const skillPath = path.join(SKILL_ROOT, skill.name, "SKILL.md");
    assertContract(await fileExists(skillPath), `Missing Codex skill: ${skill.name}`);
    console.log(`OK codex skill ${skill.name}`);
  }

  assertContract(await fileExists(TEMPLATE_PATH), "Missing Idea exploration template.");
  console.log(`OK template ${path.relative(ROOT, TEMPLATE_PATH)}`);
  console.log(
    `Idea workflow ready: ${configuredDirections.length} directions, `
      + `${workflow.evaluation.reviewerLenses.length} blind-review lenses`
  );
}

function assertReviewerPromptIsBlind(prompt) {
  const forbiddenPatterns = [
    /publicationScore/i,
    /acceptanceScore/i,
    /passScore/i,
    /(?:10|十)\s*分[^。\n]{0,16}(?:通过|接受|发布)/i,
    /满分[^。\n]{0,16}(?:通过|接受|发布)/i
  ];

  for (const pattern of forbiddenPatterns) {
    assertContract(!pattern.test(prompt), "Reviewer prompt leaks the acceptance threshold.");
  }
}

function renderPrompt(
  directionId,
  phase,
  workflow,
  reviewWorkflow,
  interests,
  lensId,
  candidateId
) {
  const direction = interests.interests.find((interest) => interest.id === directionId);
  const queryConfig = reviewWorkflow.directions[directionId];
  assertContract(direction && queryConfig, `Unknown direction: ${directionId}`);

  const dimensionLines = workflow.evaluation.dimensions
    .map((dimension) => `- ${dimension.label}: ${dimension.question}`)
    .join("\n");

  if (phase === "evaluate") {
    const lens = workflow.evaluation.reviewerLenses.find((item) => item.id === lensId);
    assertContract(
      lens,
      "Evaluation prompts require a configured reviewer lens."
    );
    assertContract(candidateId, "Evaluation prompts require a candidate ID.");
    const anchorLines = workflow.evaluation.scale.anchors
      .map((anchor) => `- ${anchor.range}: ${anchor.meaning}`)
      .join("\n");
    const prompt = [
      `你是 ${direction.label} Idea 的独立盲评者。`,
      `候选 ID：${candidateId}`,
      `本轮主审视角：${lens.focus}。`,
      "不要推测主流程如何接受或拒绝候选，也不要询问其他评估者的分数。",
      "你看不到其他评估者的结果；不得假定其他视角会替你补证据。",
      "请重新打开候选的关键一手证据，并独立评估全部五个维度：",
      dimensionLines,
      "",
      "统一使用以下刻度：",
      anchorLines,
      "",
      "主审视角决定你优先复核的证据，但仍须独立评价全部五个维度。",
      "实现可行性按可信、可分解的实现路径和可证伪最小实验判断；缺少开箱即用代码或完整现成闭环本身不是降分理由，但依赖、工期或识别缺口必须反映在证据和评分中。",
      "每个维度给出 1-10 分、支持证据、最强反例和必须补做的实验；最后给出 1-10 的总体分。",
      "若证据不足必须降分，不得用愿景、未经核验的链接或作者自述补齐事实。",
      "只输出一个 JSON 对象，字段为 candidateId、lens、reviewerAgentId、reviewedAt、dossierSnapshotFingerprint、scores、rationales、strongestObjection、requiredExperiment、evidenceReopened、overall。",
      `candidateId 必须原样写为 ${candidateId}，lens 必须原样写为 ${lens.id}。`
    ].join("\n");
    assertReviewerPromptIsBlind(prompt);
    return prompt;
  }

  const queryLines = queryConfig.queryFamilies.map((family) => `- ${family}`).join("\n");
  const hardStopLines = workflow.candidateHardStops
    .map((rule) => `- ${rule.id}: ${rule.rule}`)
    .join("\n");
  return [
    `方向：${direction.label} (${directionId})`,
    `阶段：${phase}`,
    "先把本库论文作为线索，再从外部一手来源重新建立边界；本库与外部证据必须分开标记。",
    "至少覆盖以下查询族：",
    queryLines,
    "",
    "只用论文原文、正式 proceedings/出版社页、arXiv、官方项目页与作者代码仓库支持事实。",
    "对数据层或实现层缺口，优先用公开代码、元数据或 1-2 个小样本做可复现检查；没有实际检查不得宣称缺陷存在。",
    `候选生成不少于 ${workflow.requirements.minGeneratedCandidates} 个，先机械去重，再做新颖性碰撞与客观预算检查。`,
    `可行性口径：${workflow.feasibilityPolicy.definition}`,
    workflow.feasibilityPolicy.nonRejectionRule,
    "",
    "以下情况直接淘汰，不送入评分：",
    hardStopLines
  ].join("\n");
}

async function prompt(
  directionId,
  phase = "retrieve",
  lensId,
  candidateId
) {
  const { workflow, reviewWorkflow, interests } = await loadContracts();
  console.log(renderPrompt(
    directionId,
    phase,
    workflow,
    reviewWorkflow,
    interests,
    lensId,
    candidateId
  ));
}

const [command = "check", directionId, phase, lensId, candidateId] = process.argv.slice(2);

try {
  if (command === "check") {
    await check();
  } else if (command === "prompt") {
    assertContract(
      directionId,
      "Usage: npm run idea:prompt -- <direction-id> [phase] [lens-id] [candidate-id]"
    );
    await prompt(directionId, phase, lensId, candidateId);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
