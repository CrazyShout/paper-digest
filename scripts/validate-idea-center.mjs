import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  ideaArtifactSnapshotFingerprint,
  ideaCenterSnapshotFingerprint,
  ideaDirectionSnapshotFingerprint,
  ideaSnapshotFingerprint,
  reviewedCenterArtifactFingerprint,
  reviewedDirectionArtifactFingerprint
} from "../src/lib/idea-fingerprint.js";
import { resolveIdeaAuditArtifact } from "./idea-artifact-path.mjs";
import { validateIdeaAuditPool } from "./validate-idea-audit-pool.mjs";
import { validateIdeaDossier as validatePreReviewDossier } from "./validate-idea-dossier.mjs";
import { validateIdeaReview } from "./validate-idea-review.mjs";
import { evaluateIdeaReviewGate } from "./idea-review-gate.mjs";

const ROOT = process.cwd();
const CENTER_PATH = path.join(ROOT, "content", "idea-center.json");
const WORKFLOW_PATH = path.join(ROOT, "config", "idea-exploration-workflow.json");
const INTERESTS_PATH = path.join(ROOT, "config", "research-interests.json");

function assertValid(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNotFutureTimestamp(value, label) {
  const timestamp = Date.parse(value);
  assertValid(Number.isFinite(timestamp), `${label} must be a valid timestamp.`);
  assertValid(
    timestamp <= Date.now() + 60_000,
    `${label} cannot be future-dated.`
  );
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function validateEvidence(evidence, ideaId, requirements) {
  assertValid(
    evidence.length >= requirements.minEvidencePerIdea
      && evidence.length <= requirements.maxEvidencePerIdea,
    `${ideaId}: evidence must contain ${requirements.minEvidencePerIdea}-`
      + `${requirements.maxEvidencePerIdea} sources.`
  );

  for (const source of evidence) {
    assertValid(/^https:\/\//.test(source.url), `${ideaId}: evidence URL must use HTTPS.`);
    const isLocal = Boolean(source.localPaperId);
    const isExternal = source.sourceOrigin === "external";
    assertValid(
      isLocal !== isExternal,
      `${ideaId}: evidence must declare exactly one provenance marker.`
    );
    if (isLocal) {
      assertValid(
        /^papers\/[^/]+\/$/.test(source.localLink || ""),
        `${ideaId}: local evidence ${source.localPaperId} must resolve to a paper report.`
      );
    }
  }
}

async function validateReviewer(reviewer, ideaId, dimensionIds, lenses) {
  assertValid(reviewer.agentId, `${ideaId}: blind reviewer is missing agentId.`);
  assertValid(lenses.has(reviewer.lens), `${ideaId}: unknown reviewer lens ${reviewer.lens}.`);
  assertNotFutureTimestamp(reviewer.reviewedAt, `${ideaId}: reviewer timestamp`);
  assertValid(Number.isInteger(reviewer.overall), `${ideaId}: reviewer overall must be an integer.`);
  assertValid(
    reviewer.overall >= 1 && reviewer.overall <= 10,
    `${ideaId}: reviewer overall must be within 1-10.`
  );
  assertValid(
    reviewer.strongestObjection && reviewer.requiredExperiment,
    `${ideaId}: reviewer must record the strongest objection and required experiment.`
  );

  for (const dimensionId of dimensionIds) {
    const score = reviewer.scores?.[dimensionId];
    assertValid(
      Number.isInteger(score) && score >= 1 && score <= 10,
      `${ideaId}: reviewer ${reviewer.agentId} must score ${dimensionId} within 1-10.`
    );
    assertValid(
      reviewer.rationales?.[dimensionId],
      `${ideaId}: reviewer ${reviewer.agentId} must justify ${dimensionId}.`
    );
  }

  assertValid(
    /^content\/idea-audits\/[a-z0-9][a-z0-9-]*\.json$/.test(reviewer.reportPath || ""),
    `${ideaId}: reviewer ${reviewer.agentId} must link a stored audit report.`
  );
  const absoluteReportPath = await resolveIdeaAuditArtifact(
    ROOT,
    reviewer.reportPath,
    `${ideaId}: reviewer report`
  );
  const report = await readJson(absoluteReportPath);
  assertValid(
    report.candidateId === ideaId && report.lens === reviewer.lens,
    `${ideaId}: stored reviewer report targets a different candidate or lens.`
  );
  assertValid(
    report.reviewerAgentId === reviewer.agentId,
    `${ideaId}: stored reviewer agent does not match the publication ledger.`
  );
  assertValid(
    report.reviewedAt && report.reviewedAt === reviewer.reviewedAt,
    `${ideaId}: reviewer timestamp does not match the stored report.`
  );
  assertValid(
    report.overall === reviewer.overall
      && report.strongestObjection === reviewer.strongestObjection
      && report.requiredExperiment === reviewer.requiredExperiment,
    `${ideaId}: stored reviewer verdict does not match the publication ledger.`
  );
  for (const dimensionId of dimensionIds) {
    assertValid(
      report.scores?.[dimensionId] === reviewer.scores[dimensionId]
        && report.rationales?.[dimensionId] === reviewer.rationales[dimensionId],
      `${ideaId}: stored ${dimensionId} review does not match the publication ledger.`
    );
  }
  assertValid(
    report.evidenceReopened?.length >= 2,
    `${ideaId}: reviewer ${reviewer.agentId} must reopen at least two sources.`
  );
  for (const source of report.evidenceReopened) {
    const url = typeof source === "string" ? source : source.url;
    assertValid(
      /^https:\/\//.test(url || ""),
      `${ideaId}: reviewer evidence must use a reopened HTTPS primary source.`
    );
  }
}

async function validateBlindReview(idea, workflow) {
  const review = idea.blindReview;
  const requirements = workflow.requirements;
  const dimensionIds = workflow.evaluation.dimensions.map((dimension) => dimension.id);
  const lenses = new Set(workflow.evaluation.reviewerLenses.map((lens) => lens.id));

  assertValid(review?.status === "passed", `${idea.id}: blind review has not passed.`);
  assertValid(
    review.snapshotFingerprint === ideaSnapshotFingerprint(idea),
    `${idea.id}: Idea content changed after its blind review.`
  );
  assertValid(
    review.reviewers?.length >= requirements.minBlindReviewersPerIdea,
    `${idea.id}: blind review needs at least ${requirements.minBlindReviewersPerIdea} reviewers.`
  );
  assertValid(
    new Set(review.reviewers.map((reviewer) => reviewer.agentId)).size
      === review.reviewers.length,
    `${idea.id}: blind reviewer agent IDs must be unique.`
  );
  assertValid(
    new Set(review.reviewers.map((reviewer) => reviewer.lens)).size >= lenses.size,
    `${idea.id}: blind review must cover every configured reviewer lens.`
  );
  assertValid(
    new Set(review.reviewers.map((reviewer) => reviewer.reportPath)).size
      === review.reviewers.length,
    `${idea.id}: blind reviewer report paths must be unique.`
  );

  for (const reviewer of review.reviewers) {
    await validateReviewer(reviewer, idea.id, dimensionIds, lenses);
    assertValid(
      reviewer.overall === workflow.evaluation.publicationScore
        && dimensionIds.every(
          (dimensionId) => reviewer.scores[dimensionId]
            === workflow.evaluation.publicationScore
        ),
      `${idea.id}: a published Idea contains a non-passing blind review.`
    );
  }
}

function validateSearchAudit(direction, workflow) {
  const { requirements, sourceFamilies } = workflow;
  const audit = direction.searchAudit;
  assertValid(audit, `${direction.id}: missing searchAudit.`);
  assertValid(
    audit.queryRuns?.length >= requirements.minQueryFamilies,
    `${direction.id}: too few query runs.`
  );
  assertValid(
    new Set(audit.queryRuns.map((run) => run.family)).size
      >= requirements.minQueryFamilies,
    `${direction.id}: too few distinct query families.`
  );
  assertValid(
    audit.references?.length >= requirements.minVerifiedReferences,
    `${direction.id}: too few verified references.`
  );
  assertValid(
    audit.references.filter(
      (reference) => Number(reference.year) >= requirements.recentSinceYear
    ).length >= requirements.minRecentReferences,
    `${direction.id}: too few recent verified references.`
  );
  assertValid(
    audit.references.filter((reference) => reference.localPaperId).length
      >= requirements.minLocalReferences,
    `${direction.id}: too few local-corpus references.`
  );
  assertValid(
    audit.references.filter((reference) => reference.sourceOrigin === "external").length
      >= requirements.minExternalReferences,
    `${direction.id}: too few external references.`
  );
  assertValid(
    sourceFamilies.every(
      (family) => audit.sourceAttempts?.some((attempt) => attempt.family === family)
    ),
    `${direction.id}: source-attempt ledger does not cover every source family.`
  );
}

function validateCandidateLedger(direction, workflow) {
  const ledger = direction.candidateLedger;
  assertValid(
    ledger?.length >= workflow.requirements.minGeneratedCandidates,
    `${direction.id}: too few generated candidates.`
  );
  assertValid(
    ledger.filter((candidate) => candidate.disposition === "rejected").length
      >= workflow.requirements.minRejectedCandidates,
    `${direction.id}: too few explicit candidate rejections.`
  );
  assertValid(
    new Set(ledger.map((candidate) => candidate.id)).size === ledger.length,
    `${direction.id}: candidate IDs must be unique.`
  );
  assertValid(
    direction.ideas.every((idea) => ledger.some(
      (candidate) => candidate.id === idea.id && candidate.disposition === "published"
    )),
    `${direction.id}: every published Idea must resolve to a published ledger row.`
  );
}

function validateAssetAudit(direction, workflow) {
  const assets = direction.assetAudit?.assets || [];
  assertValid(
    assets.filter((asset) => ["code", "dataset", "simulator"].includes(asset.type)).length
      >= workflow.requirements.minOfficialCodeOrDataAssets,
    `${direction.id}: too few official code/data assets.`
  );
}

function validateIdeaDossier(idea) {
  for (const field of ["keyProblem", "currentLimitations", "hypothesis", "impact"]) {
    assertValid(
      typeof idea[field] === "string" && idea[field].trim().length >= 24,
      `${idea.id}: ${field} must be a substantive text field.`
    );
  }

  const listRequirements = {
    noveltyClaims: 2,
    method: 2,
    implementationPath: 3,
    minimumStudy: 3,
    strongBaselines: 3,
    metrics: 3,
    successCriteria: 2,
    killCriteria: 2,
    risks: 2
  };
  for (const [field, minimum] of Object.entries(listRequirements)) {
    assertValid(
      Array.isArray(idea[field])
        && idea[field].length >= minimum
        && idea[field].every((item) => typeof item === "string" && item.trim()),
      `${idea.id}: ${field} must contain at least ${minimum} substantive items.`
    );
  }
}

async function validateDirection(direction, workflow) {
  const requirements = workflow.requirements;
  assertValid(direction.status === "ready", `${direction.id}: direction is not ready.`);
  assertValid(
    direction.ideas?.length >= requirements.minPublishedIdeas
      && direction.ideas.length <= requirements.maxPublishedIdeas,
    `${direction.id}: publish ${requirements.minPublishedIdeas}-`
      + `${requirements.maxPublishedIdeas} Ideas only.`
  );

  validateSearchAudit(direction, workflow);
  validateAssetAudit(direction, workflow);
  validateCandidateLedger(direction, workflow);

  for (const idea of direction.ideas) {
    for (const field of workflow.artifactContract.requiredIdeaFields) {
      assertValid(idea[field], `${direction.id}/${idea.id}: missing ${field}.`);
    }
    validateIdeaDossier(idea);
    validateEvidence(idea.evidence, idea.id, requirements);
    await validateBlindReview(idea, workflow);
  }

  const panel = direction.panelReview;
  assertValid(panel?.status === "passed", `${direction.id}: direction panel has not passed.`);
  const ideaReviewerIds = new Set(
    direction.ideas.flatMap((idea) => idea.blindReview.reviewers.map((reviewer) => reviewer.agentId))
  );
  assertValid(
    panel.reviewerAgentIds?.length >= requirements.minBlindReviewersPerIdea,
    `${direction.id}: direction panel must list its independent reviewer agents.`
  );
  assertValid(
    new Set(panel.reviewerAgentIds).size === panel.reviewerAgentIds.length,
    `${direction.id}: direction panel reviewer agent IDs must be unique.`
  );
  assertValid(
    panel.reviewerAgentIds.length === ideaReviewerIds.size
      && panel.reviewerAgentIds.every((agentId) => ideaReviewerIds.has(agentId)),
    `${direction.id}: direction panel reviewer ledger does not match Idea blind reviews.`
  );
  assertValid(
    panel.snapshotFingerprint === ideaDirectionSnapshotFingerprint(direction),
    `${direction.id}: direction content changed after blind review.`
  );
}

async function validateFinalReview(center, workflow) {
  const review = center.finalReview;
  const dimensionIds = workflow.evaluation.dimensions.map((dimension) => dimension.id);
  const priorAgentIds = new Set(
    center.directions.flatMap((direction) => direction.ideas.flatMap(
      (idea) => idea.blindReview.reviewers.map((reviewer) => reviewer.agentId)
    ))
  );

  assertValid(review?.status === "passed", "Global independent review has not passed.");
  assertValid(review.reviewerAgentId, "Global review is missing reviewerAgentId.");
  assertNotFutureTimestamp(review.reviewedAt, "Global review timestamp");
  assertValid(
    !priorAgentIds.has(review.reviewerAgentId),
    "Global reviewer must be independent from every direction panel."
  );
  assertValid(
    review.overall === workflow.evaluation.publicationScore,
    "Global review overall score has not reached the publication score."
  );
  assertValid(
    dimensionIds.every(
      (dimensionId) => review.scores?.[dimensionId]
        === workflow.evaluation.publicationScore
        && review.rationales?.[dimensionId]
    ),
    "Global review must pass and justify every required dimension."
  );
  assertValid(
    review.snapshotFingerprint === ideaCenterSnapshotFingerprint(center),
    "Idea center content changed after global independent review."
  );
  assertValid(
    /^content\/idea-audits\/[a-z0-9][a-z0-9-]*\.json$/.test(review.reportPath || ""),
    "Global review must link a stored audit report."
  );
  const absoluteReportPath = await resolveIdeaAuditArtifact(
    ROOT,
    review.reportPath,
    "Global review report"
  );
  const report = await readJson(absoluteReportPath);
  assertValid(
    report.reviewerAgentId === review.reviewerAgentId
      && report.reviewedAt === review.reviewedAt
      && report.overall === review.overall,
    "Stored global reviewer identity, timestamp, or score does not match."
  );
  for (const dimensionId of dimensionIds) {
    assertValid(
      report.scores?.[dimensionId] === review.scores[dimensionId]
        && report.rationales?.[dimensionId] === review.rationales[dimensionId],
      `Stored global ${dimensionId} review does not match.`
    );
  }
  const directionIds = center.directions.map((direction) => direction.id);
  const reopenedDirectionIds = report.directionReportsReopened?.map(
    (entry) => entry.directionId
  ) || [];
  assertValid(
    reopenedDirectionIds.length === directionIds.length
      && new Set(reopenedDirectionIds).size === directionIds.length
      && directionIds.every((directionId) => reopenedDirectionIds.includes(directionId)),
    "Global reviewer must reopen every direction report exactly once."
  );
  for (const direction of center.directions) {
    const reopened = report.directionReportsReopened.find(
      (entry) => entry.directionId === direction.id
    );
    assertValid(
      reopened.snapshotFingerprint === ideaDirectionSnapshotFingerprint(direction),
      `Global reviewer used a stale ${direction.id} direction snapshot.`
    );
  }
  assertValid(
    report.evidenceReopened?.length >= directionIds.length
      && report.evidenceReopened.every((entry) => /^https:\/\//.test(entry.url || "")),
    "Global reviewer must reopen primary HTTPS evidence across all directions."
  );
  assertValid(
    report.strongestObjection && report.requiredAction,
    "Global reviewer must record its strongest objection and required action."
  );
}

async function readAuditArtifact(relativePath, label) {
  const absolutePath = await resolveIdeaAuditArtifact(ROOT, relativePath, label);
  const data = await readJson(absolutePath);
  return {
    path: relativePath,
    data,
    fingerprint: ideaArtifactSnapshotFingerprint(data)
  };
}

function substantive(value, minimum = 16) {
  return typeof value === "string" && value.trim().length >= minimum;
}

function candidateIdFromEntry(entry) {
  return typeof entry === "string" ? entry : entry?.candidateId || entry?.id;
}

export function validateSelectionReport(report, poolArtifact, pool, workflow, label) {
  assertValid(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      report.selectionAgentId || ""
    ),
    `${label}: selectionAgentId must be the runtime agent UUID.`
  );
  assertNotFutureTimestamp(report.selectedAt, `${label}: selectedAt`);
  assertValid(
    Date.parse(report.selectedAt) >= Date.parse(pool.searchedAt),
    `${label}: selection predates the frozen candidate pool.`
  );
  assertValid(
    report.directionId === (pool.directionId || pool.scope?.direction || pool.scope?.directionId),
    `${label}: selection report belongs to a different direction.`
  );
  assertValid(
    report.candidatePoolPath === poolArtifact.path,
    `${label}: selection report targets a different candidate pool.`
  );
  assertValid(
    report.candidatePoolSnapshotFingerprint === poolArtifact.fingerprint,
    `${label}: selection report was not bound to the current candidate-pool snapshot.`
  );

  const ledgerIds = pool.candidateLedger.map(candidateIdFromEntry);
  const selectedIds = report.selectedCandidateIds || [];
  const decisions = report.candidateDecisions || [];
  assertValid(
    Array.isArray(selectedIds)
      && new Set(selectedIds).size === selectedIds.length
      && selectedIds.length <= workflow.requirements.maxPublishedIdeas,
    `${label}: selectedCandidateIds must be unique and within the shortlist limit.`
  );
  assertValid(
    Array.isArray(decisions)
      && decisions.length === ledgerIds.length
      && new Set(decisions.map((entry) => entry.candidateId)).size === ledgerIds.length
      && ledgerIds.every((candidateId) => decisions.some(
        (entry) => entry.candidateId === candidateId
      )),
    `${label}: candidateDecisions must cover the candidate ledger exactly once.`
  );
  for (const decision of decisions) {
    assertValid(
      ["shortlist", "reject"].includes(decision.decision)
        && substantive(decision.reason, 32),
      `${label}/${decision.candidateId}: decision and evidence-based reason are required.`
    );
    assertValid(
      selectedIds.includes(decision.candidateId) === (decision.decision === "shortlist"),
      `${label}/${decision.candidateId}: decision disagrees with selectedCandidateIds.`
    );
  }
  const poolShortlistIds = (pool.shortlist || []).map(candidateIdFromEntry);
  assertValid(
    selectedIds.length === poolShortlistIds.length
      && selectedIds.every((candidateId) => poolShortlistIds.includes(candidateId)),
    `${label}: independent selection does not match the published pool shortlist.`
  );
  assertValid(
    substantive(report.crossDirectionFinding, 32),
    `${label}: crossDirectionFinding must be substantive.`
  );
  for (const forbidden of ["scores", "overall", "threshold", "passScore"]) {
    assertValid(!(forbidden in report), `${label}: selection report cannot contain ${forbidden}.`);
  }

  return {
    agentId: report.selectionAgentId,
    selectedAt: Date.parse(report.selectedAt)
  };
}

async function validateReviewedCandidate(candidate, workflow, shortlistIds) {
  assertValid(
    Number.isInteger(candidate.rank) && candidate.rank > 0,
    `${candidate.dossierPath || "candidate"}: rank must be a positive integer.`
  );

  const dossierArtifact = await readAuditArtifact(
    candidate.dossierPath,
    "Candidate dossierPath"
  );
  const dossier = dossierArtifact.data;
  const candidateId = dossier.candidateId || dossier.id;
  validatePreReviewDossier(dossier, workflow, candidate.dossierPath);
  assertValid(
    shortlistIds.has(candidateId),
    `${candidateId}: dossier is not present in the direction shortlist.`
  );

  assertValid(
    Array.isArray(candidate.reviewPaths) && candidate.reviewPaths.length >= 2,
    `${candidateId}: a completed direction audit needs at least two independent review reports.`
  );
  assertValid(
    new Set(candidate.reviewPaths).size === candidate.reviewPaths.length,
    `${candidateId}: review report paths must be unique.`
  );
  const reviews = [];
  const reviewArtifacts = [];
  for (const reportPath of candidate.reviewPaths) {
    const reviewArtifact = await readAuditArtifact(reportPath, `${candidateId}: reviewPath`);
    const review = reviewArtifact.data;
    validateIdeaReview(review, workflow, reportPath);
    assertValid(
      review.candidateId === candidateId,
      `${candidateId}: review report targets a different candidate.`
    );
    assertValid(
      review.dossierSnapshotFingerprint === dossierArtifact.fingerprint,
      `${candidateId}: review report was not bound to the current dossier snapshot.`
    );
    assertValid(
      Date.parse(review.reviewedAt) >= Date.parse(dossier.frozenAt),
      `${candidateId}: review predates the frozen dossier snapshot.`
    );
    reviews.push(review);
    reviewArtifacts.push(reviewArtifact);
  }

  assertValid(
    new Set(reviews.map((review) => review.reviewerAgentId)).size === reviews.length,
    `${candidateId}: review agent IDs must be unique.`
  );
  assertValid(
    new Set(reviews.map((review) => review.lens)).size === reviews.length,
    `${candidateId}: completed sequential reviews must use distinct lenses.`
  );

  const gate = evaluateIdeaReviewGate(reviews, workflow, { sequential: true });
  assertValid(
    gate.status !== "continue-review",
    `${candidateId}: every submitted review is perfect but the reviewer panel is incomplete.`
  );
  const expectedStatus = gate.status === "passed" ? "passed" : "rejected";
  assertValid(
    candidate.reviewStatus === expectedStatus,
    `${candidateId}: reviewStatus=${candidate.reviewStatus} disagrees with gate=${gate.status}.`
  );
  if (expectedStatus === "passed") {
    assertValid(
      gate.panelComplete,
      `${candidateId}: a passed candidate must include the complete reviewer panel.`
    );
  }

  return {
    candidateId,
    status: expectedStatus,
    reviewerAgentIds: reviews.map((review) => review.reviewerAgentId),
    reviewPaths: candidate.reviewPaths,
    artifacts: [dossierArtifact, ...reviewArtifacts],
    latestTimestamp: Math.max(
      Date.parse(dossier.frozenAt),
      ...reviews.map((review) => Date.parse(review.reviewedAt))
    )
  };
}

async function validateReviewedGlobalReview(
  center,
  workflow,
  priorAgentIds,
  directionFingerprints,
  centerFingerprint,
  latestArtifactTimestamp
) {
  const pointer = center.finalReview;
  assertValid(pointer?.reportPath, "Reviewed Idea center must link a global review report.");
  const reportArtifact = await readAuditArtifact(
    pointer.reportPath,
    "Global review reportPath"
  );
  const report = reportArtifact.data;
  const dimensionIds = workflow.evaluation.dimensions.map((dimension) => dimension.id);

  assertValid(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      report.reviewerAgentId || ""
    ),
    "Global review must record the fresh runtime reviewer UUID."
  );
  assertValid(
    !priorAgentIds.has(report.reviewerAgentId),
    "Global reviewer must be independent from every retrieval and candidate reviewer agent."
  );
  assertNotFutureTimestamp(report.reviewedAt, "Global review timestamp");
  assertValid(
    Date.parse(report.reviewedAt) >= latestArtifactTimestamp,
    "Global review predates at least one direction artifact."
  );
  assertValid(
    report.centerSnapshotFingerprint === centerFingerprint,
    "Global reviewer used a stale Idea-center artifact snapshot."
  );
  for (const field of ["scores", "rationales"]) {
    assertValid(
      report[field] && !Array.isArray(report[field])
        && JSON.stringify(Object.keys(report[field]).sort())
          === JSON.stringify([...dimensionIds].sort()),
      `Global review ${field} must contain exactly the configured dimensions.`
    );
  }
  assertValid(
    Number.isInteger(report.overall) && report.overall >= 1 && report.overall <= 10,
    "Global review overall must be an integer within 1-10."
  );
  for (const dimensionId of dimensionIds) {
    assertValid(
      Number.isInteger(report.scores?.[dimensionId])
        && report.scores[dimensionId] >= 1
        && report.scores[dimensionId] <= 10,
      `Global review must score ${dimensionId} within 1-10.`
    );
    assertValid(
      substantive(report.rationales?.[dimensionId]),
      `Global review must justify ${dimensionId}.`
    );
  }

  const directionIds = center.directions.map((direction) => direction.id);
  const reopenedDirectionIds = report.directionReportsReopened?.map(
    (entry) => entry.directionId
  ) || [];
  assertValid(
    reopenedDirectionIds.length === directionIds.length
      && new Set(reopenedDirectionIds).size === directionIds.length
      && directionIds.every((directionId) => reopenedDirectionIds.includes(directionId)),
    "Global reviewer must reopen every direction report exactly once."
  );
  assertValid(
    report.directionReportsReopened.every((entry) => substantive(entry.finding)),
    "Global reviewer must record a substantive finding for every direction."
  );
  for (const entry of report.directionReportsReopened) {
    assertValid(
      entry.snapshotFingerprint === directionFingerprints.get(entry.directionId),
      `Global reviewer used a stale ${entry.directionId} artifact snapshot.`
    );
  }
  assertValid(
    report.evidenceReopened?.length >= directionIds.length
      && report.evidenceReopened.every((entry) => {
        return entry && typeof entry === "object"
          && directionIds.includes(entry.directionId)
          && /^https:\/\//.test(entry.url || "")
          && substantive(entry.finding);
      }),
    "Global reviewer must record structured primary HTTPS evidence across all directions."
  );
  assertValid(
    directionIds.every((directionId) => report.evidenceReopened.some(
      (entry) => entry.directionId === directionId
    )),
    "Global reviewer must reopen at least one primary source for every direction."
  );
  const evidenceUrls = report.evidenceReopened.map(
    (entry) => entry.url
  );
  assertValid(
    new Set(evidenceUrls).size === evidenceUrls.length,
    "Global reviewer evidence URLs must be unique."
  );
  assertValid(
    substantive(report.strongestObjection) && substantive(report.requiredAction),
    "Global reviewer must record its strongest objection and required action."
  );
  assertValid(substantive(report.summary), "Global reviewer must record a reader-facing summary.");
  for (const forbidden of ["decision", "verdict", "accepted", "threshold", "passScore", "status"]) {
    assertValid(!(forbidden in report), `Global blind review cannot contain ${forbidden}.`);
  }

  const allCandidatesPassed = center.directions.every((direction) => (
    direction.candidateRefs.filter((candidate) => candidate.reviewStatus === "passed").length
      >= workflow.requirements.minPublishedIdeas
  ));
  const allScoresPassed = report.overall === workflow.evaluation.publicationScore
    && dimensionIds.every(
      (dimensionId) => report.scores[dimensionId] === workflow.evaluation.publicationScore
    );
  const expectedStatus = allCandidatesPassed && allScoresPassed ? "passed" : "rejected";
  assertValid(
    pointer.status === expectedStatus,
    `Global review status must be ${expectedStatus} for the stored direction outcomes and scores.`
  );
  return { ...report, status: expectedStatus };
}

export async function validateReviewedCenter(center, workflow, { requireGlobal = true } = {}) {
  const allReviewPaths = [];
  const retrievalAgentIds = new Set();
  const selectionAgentIds = new Set();
  const candidateReviewerIds = new Set();
  const reviewerAssignments = new Map();
  const directionSnapshotEntries = [];
  let candidateCount = 0;
  let passedCount = 0;
  let latestArtifactTimestamp = 0;

  for (const direction of center.directions) {
    assertValid(direction.status === "reviewed", `${direction.id}: direction is not reviewed.`);
    assertValid(
      !Array.isArray(direction.ideas) || direction.ideas.length === 0,
      `${direction.id}: reviewed directions cannot retain embedded legacy ideas.`
    );
    assertValid(
      substantive(direction.scope) && substantive(direction.outcome?.summary),
      `${direction.id}: scope and outcome summary are required.`
    );
    const directionArtifacts = [];

    if (direction.legacyAuditPath) {
      const legacyAuditArtifact = await readAuditArtifact(
        direction.legacyAuditPath,
        `${direction.id}: legacyAuditPath`
      );
      const legacyAudit = legacyAuditArtifact.data;
      directionArtifacts.push(legacyAuditArtifact);
      assertValid(
        legacyAudit.directionId === direction.id,
        `${direction.id}: legacy Idea audit belongs to a different direction.`
      );
      const legacyIdeas = legacyAudit.ideas || [];
      assertValid(legacyIdeas.length > 0, `${direction.id}: legacy Idea audit is empty.`);
      assertValid(
        new Set(legacyIdeas.map((idea) => idea.originalIdeaId)).size === legacyIdeas.length,
        `${direction.id}: legacy Idea IDs must be unique.`
      );
      for (const idea of legacyIdeas) {
        assertValid(
          ["retain", "revise", "reject"].includes(idea.decision)
            && substantive(idea.rationale)
            && substantive(idea.requiredNextAction),
          `${direction.id}/${idea.originalIdeaId}: legacy closure is incomplete.`
        );
      }
      assertValid(
        direction.outcome.legacyIdeaCount === legacyIdeas.length,
        `${direction.id}: legacy Idea count disagrees with its closure audit.`
      );
    }

    const candidatePoolPaths = direction.candidatePoolPaths
      || (direction.candidatePoolPath ? [direction.candidatePoolPath] : []);
    assertValid(
      candidatePoolPaths.length > 0 && new Set(candidatePoolPaths).size === candidatePoolPaths.length,
      `${direction.id}: at least one unique candidate-pool path is required.`
    );
    const selectionReportPaths = direction.selectionReportPaths || [];
    assertValid(
      selectionReportPaths.length === candidatePoolPaths.length
        && new Set(selectionReportPaths).size === selectionReportPaths.length,
      `${direction.id}: every candidate pool needs one unique independent selection report.`
    );
    const selectionReportsByPool = new Map();
    for (const selectionReportPath of selectionReportPaths) {
      const selectionArtifact = await readAuditArtifact(
        selectionReportPath,
        `${direction.id}: selectionReportPath`
      );
      const poolPath = selectionArtifact.data.candidatePoolPath;
      assertValid(
        candidatePoolPaths.includes(poolPath) && !selectionReportsByPool.has(poolPath),
        `${direction.id}: selection reports must target each candidate pool exactly once.`
      );
      selectionReportsByPool.set(poolPath, selectionArtifact);
    }
    const shortlistIds = new Set();
    let shortlistedAcrossPools = 0;
    for (const candidatePoolPath of candidatePoolPaths) {
      const poolArtifact = await readAuditArtifact(
        candidatePoolPath,
        `${direction.id}: candidatePoolPath`
      );
      const pool = poolArtifact.data;
      directionArtifacts.push(poolArtifact);
      const counts = validateIdeaAuditPool(pool, workflow, candidatePoolPath);
      const poolDirectionId = pool.directionId || pool.scope?.direction || pool.scope?.directionId;
      assertValid(
        poolDirectionId === direction.id,
        `${direction.id}: candidate pool belongs to ${poolDirectionId || "an unknown direction"}.`
      );
      const poolRetrievalAgentIds = pool.retrievalAgentIds || [pool.reviewerAgentId];
      poolRetrievalAgentIds.forEach((agentId) => retrievalAgentIds.add(agentId));
      const selectionArtifact = selectionReportsByPool.get(candidatePoolPath);
      const selectionResult = validateSelectionReport(
        selectionArtifact.data,
        poolArtifact,
        pool,
        workflow,
        selectionArtifact.path
      );
      directionArtifacts.push(selectionArtifact);
      selectionAgentIds.add(selectionResult.agentId);
      latestArtifactTimestamp = Math.max(
        latestArtifactTimestamp,
        selectionResult.selectedAt
      );
      const searchedAt = Date.parse(pool.searchedAt);
      if (Number.isFinite(searchedAt)) latestArtifactTimestamp = Math.max(
        latestArtifactTimestamp,
        searchedAt
      );
      shortlistedAcrossPools += counts.shortlisted;
      for (const entry of pool.shortlist || []) {
        shortlistIds.add(typeof entry === "string" ? entry : entry.candidateId || entry.id);
      }
    }
    assertValid(
      shortlistIds.size === shortlistedAcrossPools,
      `${direction.id}: shortlisted candidate IDs must be unique across retrieval rounds.`
    );
    assertValid(
      Array.isArray(direction.candidateRefs)
        && direction.candidateRefs.length === shortlistIds.size,
      `${direction.id}: candidateRefs must exactly cover the candidate-pool shortlist.`
    );
    assertValid(
      new Set(direction.candidateRefs.map((candidate) => candidate.rank)).size
        === direction.candidateRefs.length,
      `${direction.id}: candidate ranks must be unique.`
    );
    for (let rank = 1; rank <= direction.candidateRefs.length; rank += 1) {
      assertValid(
        direction.candidateRefs.some((candidate) => candidate.rank === rank),
        `${direction.id}: candidate ranks must be contiguous; missing ${rank}.`
      );
    }

    const results = [];
    for (const candidate of direction.candidateRefs) {
      const result = await validateReviewedCandidate(candidate, workflow, shortlistIds);
      results.push(result);
      directionArtifacts.push(...result.artifacts);
      latestArtifactTimestamp = Math.max(latestArtifactTimestamp, result.latestTimestamp);
      allReviewPaths.push(...result.reviewPaths);
      for (const [index, agentId] of result.reviewerAgentIds.entries()) {
        candidateReviewerIds.add(agentId);
        const review = result.artifacts[index + 1].data;
        const assignment = reviewerAssignments.get(agentId) || {
          directions: new Set(),
          lenses: new Set()
        };
        assignment.directions.add(direction.id);
        assignment.lenses.add(review.lens);
        reviewerAssignments.set(agentId, assignment);
      }
    }
    assertValid(
      new Set(results.map((result) => result.candidateId)).size === shortlistIds.size,
      `${direction.id}: candidate dossiers must be unique and cover the shortlist.`
    );
    assertValid(
      [...shortlistIds].every((candidateId) => (
        results.some((result) => result.candidateId === candidateId)
      )),
      `${direction.id}: at least one shortlisted candidate has no reviewed dossier.`
    );

    const directionPassed = results.filter((result) => result.status === "passed").length;
    assertValid(
      direction.outcome.passedCount === directionPassed
        && direction.outcome.reviewedCount === results.length,
      `${direction.id}: outcome counts disagree with the reviewed candidate artifacts.`
    );
    if (directionPassed === 0) {
      assertValid(
        substantive(direction.outcome.noPassedReason),
        `${direction.id}: directions with no passing candidate must explain why.`
      );
    }
    candidateCount += results.length;
    passedCount += directionPassed;
    directionSnapshotEntries.push({
      directionId: direction.id,
      fingerprint: reviewedDirectionArtifactFingerprint(direction, directionArtifacts)
    });
  }

  assertValid(
    new Set(allReviewPaths).size === allReviewPaths.length,
    "Candidate review report paths must be unique across the whole Idea center."
  );
  assertValid(
    [...candidateReviewerIds].every((agentId) => !retrievalAgentIds.has(agentId)),
    "Retrieval and blind-review agent identities must be disjoint across the whole Idea center."
  );
  assertValid(
    [...selectionAgentIds].every(
      (agentId) => !retrievalAgentIds.has(agentId) && !candidateReviewerIds.has(agentId)
    ),
    "Selection agents must be independent from retrieval and blind-review agents."
  );
  for (const [agentId, assignment] of reviewerAssignments) {
    assertValid(
      assignment.lenses.size === 1,
      `${agentId}: a blind reviewer cannot switch reviewer lenses across candidates.`
    );
  }

  const directionFingerprints = new Map(
    directionSnapshotEntries.map((entry) => [entry.directionId, entry.fingerprint])
  );
  const centerFingerprint = reviewedCenterArtifactFingerprint(
    center,
    directionSnapshotEntries
  );
  const priorAgentIds = new Set([
    ...retrievalAgentIds,
    ...selectionAgentIds,
    ...candidateReviewerIds
  ]);

  if (!requireGlobal) {
    assertValid(
      !center.finalReview,
      "A reviewing Idea center cannot publish a finalReview pointer."
    );
    console.log(
      `Idea center review in progress: ${center.directions.length} directions, `
        + `${candidateCount} reviewed candidates, ${passedCount} exact-score passes; `
        + "global independent review pending."
    );
    return {
      candidateCount,
      passedCount,
      directionSnapshotEntries,
      centerFingerprint,
      latestArtifactTimestamp,
      priorAgentIds
    };
  }

  const globalReview = await validateReviewedGlobalReview(
    center,
    workflow,
    priorAgentIds,
    directionFingerprints,
    centerFingerprint,
    latestArtifactTimestamp
  );
  console.log(
    `Idea center audited: ${center.directions.length} directions, ${candidateCount} reviewed candidates, `
      + `${passedCount} exact-score passes; global review ${globalReview.status}.`
  );
  return {
    candidateCount,
    passedCount,
    directionSnapshotEntries,
    centerFingerprint,
    latestArtifactTimestamp,
    priorAgentIds,
    globalReview
  };
}

function validateDraftCenter(center) {
  assertValid(!center.finalReview, "Draft Idea center cannot contain a final review.");
  for (const direction of center.directions) {
    assertValid(
      !["ready", "reviewed"].includes(direction.status),
      `${direction.id}: draft center cannot expose a completed direction.`
    );
    assertValid(
      !direction.candidatePoolPath
        && !(direction.candidatePoolPaths?.length)
        && !(direction.candidateRefs?.length),
      `${direction.id}: draft center cannot publish candidate audit references.`
    );
  }
}

export async function validateIdeaCenter(center, workflow, interests) {
  const configuredIds = interests.interests.map((interest) => interest.id);
  const centerIds = center.directions.map((direction) => direction.id);

  assertValid(
    configuredIds.length === centerIds.length
      && configuredIds.every((id) => centerIds.includes(id)),
    "Idea center directions do not match configured research interests."
  );

  const allowedStatuses = new Set(["draft", "reviewing", "reviewed", "complete"]);
  assertValid(
    allowedStatuses.has(center.explorationStatus),
    `Unknown or missing explorationStatus: ${center.explorationStatus || "unset"}.`
  );

  if (center.explorationStatus === "draft") {
    validateDraftCenter(center);
    console.log("Idea center is a non-publishable draft; no reviewed candidates are exposed.");
    return;
  }

  if (center.explorationStatus === "reviewing") {
    await validateReviewedCenter(center, workflow, { requireGlobal: false });
    return;
  }

  if (center.explorationStatus === "reviewed") {
    await validateReviewedCenter(center, workflow, { requireGlobal: true });
    return;
  }

  for (const direction of center.directions) {
    await validateDirection(direction, workflow);
  }
  await validateFinalReview(center, workflow);
  console.log(
    `Idea center ready: ${center.directions.length} directions, `
      + `${center.directions.reduce((sum, direction) => sum + direction.ideas.length, 0)} Ideas, `
      + "all blind reviews and the global review passed."
  );
}

async function main() {
  const [center, workflow, interests] = await Promise.all([
    readJson(CENTER_PATH),
    readJson(WORKFLOW_PATH),
    readJson(INTERESTS_PATH)
  ]);
  await validateIdeaCenter(center, workflow, interests);
}

const isDirect = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
