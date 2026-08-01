import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { validateIdeaReview } from "./validate-idea-review.mjs";

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, "config", "idea-exploration-workflow.json");

function assertValid(condition, message) {
  if (!condition) throw new Error(message);
}

export function evaluateIdeaReviewGate(reviews, workflow, { sequential = false } = {}) {
  assertValid(Array.isArray(reviews) && reviews.length > 0, "Review gate needs reports.");
  const candidateIds = new Set(reviews.map((review) => review.candidateId));
  assertValid(candidateIds.size === 1, "Review gate cannot mix candidate IDs.");

  for (const [index, review] of reviews.entries()) {
    validateIdeaReview(review, workflow, `Review ${index + 1}`);
  }

  const requiredLenses = workflow.evaluation.reviewerLenses.map((lens) => lens.id);
  const requiredDimensions = workflow.evaluation.dimensions.map((dimension) => dimension.id);
  const reviewerIds = reviews.map((review) => review.reviewerAgentId);
  const lenses = reviews.map((review) => review.lens);
  assertValid(
    reviewerIds.length === new Set(reviewerIds).size,
    "Review gate requires unique reviewer agent IDs."
  );
  const publicationScore = workflow.evaluation.publicationScore;
  const deficits = [];
  for (const review of reviews) {
    for (const dimension of requiredDimensions) {
      if (review.scores[dimension] !== publicationScore) {
        deficits.push({
          reviewerAgentId: review.reviewerAgentId,
          lens: review.lens,
          field: dimension,
          score: review.scores[dimension]
        });
      }
    }
    if (review.overall !== publicationScore) {
      deficits.push({
        reviewerAgentId: review.reviewerAgentId,
        lens: review.lens,
        field: "overall",
        score: review.overall
      });
    }
  }

  const panelComplete = reviews.length >= workflow.requirements.minBlindReviewersPerIdea
    && requiredLenses.every((lens) => lenses.includes(lens));
  if (!sequential) {
    assertValid(
      reviews.length >= workflow.requirements.minBlindReviewersPerIdea,
      `Review gate needs at least ${workflow.requirements.minBlindReviewersPerIdea} reports.`
    );
    assertValid(
      requiredLenses.every((lens) => lenses.includes(lens)),
      "Review gate must cover every configured reviewer lens."
    );
  }

  const status = panelComplete
    ? (deficits.length === 0 ? "passed" : "revise")
    : deficits.length > 0
      ? "rejected-early"
      : "continue-review";

  return {
    candidateId: reviews[0].candidateId,
    status,
    publicationScore,
    reviewerCount: reviews.length,
    panelComplete,
    lenses: [...new Set(lenses)],
    missingLenses: requiredLenses.filter((lens) => !lenses.includes(lens)),
    deficits
  };
}

async function main() {
  const args = process.argv.slice(2);
  const sequential = args.includes("--sequential");
  const inputPaths = args.filter((arg) => arg !== "--sequential");
  assertValid(
    inputPaths.length > 0,
    "Usage: node scripts/idea-review-gate.mjs [--sequential] <review.json> [...]"
  );
  const [workflow, ...reviews] = await Promise.all([
    readFile(WORKFLOW_PATH, "utf8").then(JSON.parse),
    ...inputPaths.map((inputPath) => readFile(path.resolve(ROOT, inputPath), "utf8").then(JSON.parse))
  ]);
  const result = evaluateIdeaReviewGate(reviews, workflow, { sequential });
  console.log(JSON.stringify(result, null, 2));
  if (!["passed", "continue-review"].includes(result.status)) process.exitCode = 2;
}

const isDirect = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
