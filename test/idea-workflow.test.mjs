import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { promisify } from "node:util";

import { validateIdeaDossier } from "../scripts/validate-idea-dossier.mjs";
import { evaluateIdeaReviewGate } from "../scripts/idea-review-gate.mjs";
import { validateIdeaReview } from "../scripts/validate-idea-review.mjs";

const ROOT = new URL("../", import.meta.url);
const execFileAsync = promisify(execFile);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, ROOT), "utf8"));
}

test("idea workflow covers every configured research direction", async () => {
  const [workflow, reviews, interests] = await Promise.all([
    readJson("config/idea-exploration-workflow.json"),
    readJson("config/literature-review-workflow.json"),
    readJson("config/research-interests.json")
  ]);
  const directionIds = interests.interests.map((interest) => interest.id).sort();

  assert.deepEqual(Object.keys(reviews.directions).sort(), directionIds);
  assert.equal(workflow.directionQuerySource, "config/literature-review-workflow.json#directions");
  assert.ok(workflow.requirements.minQueryFamilies >= 6);
  assert.ok(workflow.requirements.minExternalReferences > workflow.requirements.minLocalReferences);
  assert.deepEqual(
    new Set(workflow.candidateHardStops.map((rule) => rule.id)).size,
    workflow.candidateHardStops.length
  );
  assert.ok(workflow.candidateHardStops.length >= 5);
});

test("every blind reviewer scores all required dimensions without seeing an acceptance threshold", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const dimensionIds = workflow.evaluation.dimensions.map((dimension) => dimension.id);
  const serializedPolicy = workflow.evaluation.promptPolicy.join("\n");

  assert.deepEqual(dimensionIds, [
    "novelty",
    "feasibility",
    "success-probability",
    "impact",
    "comparison-readiness"
  ]);
  assert.ok(workflow.evaluation.reviewerLenses.length >= 5);
  assert.match(serializedPolicy, /评估提示不得包含/);
  assert.doesNotMatch(serializedPolicy, /满分|10\s*分通过|acceptanceScore|passScore/i);
});

test("idea feasibility uses a falsifiable build path instead of turnkey assets", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const repositoryRule = workflow.candidateHardStops.find(
    (hardStop) => hardStop.id === "repository-is-not-executability"
  );

  assert.match(workflow.feasibilityPolicy.definition, /可证伪/);
  assert.match(workflow.feasibilityPolicy.nonRejectionRule, /不得仅因/);
  assert.match(repositoryRule.rule, /不得作为淘汰理由/);
  assert.ok(
    workflow.evaluation.promptPolicy.some(
      (rule) => rule.includes("不以是否已有开箱即用代码")
    )
  );
});

test("idea artifacts preserve local and external evidence provenance", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const requiredIdeaFields = new Set(workflow.artifactContract.requiredIdeaFields);

  assert.equal(workflow.artifactContract.localEvidenceMarker, "localPaperId");
  assert.equal(workflow.artifactContract.externalEvidenceMarker, "sourceOrigin=external");
  assert.ok(workflow.artifactContract.requiredDirectionFields.includes("candidateLedger"));
  assert.ok(requiredIdeaFields.has("blindReview"));
  for (const field of [
    "keyProblem",
    "currentLimitations",
    "hypothesis",
    "noveltyClaims",
    "method",
    "implementationPath",
    "minimumStudy",
    "strongBaselines",
    "metrics",
    "successCriteria",
    "killCriteria",
    "risks",
    "impact",
    "evidence"
  ]) {
    assert.ok(requiredIdeaFields.has(field), `missing required Idea field ${field}`);
  }
});

test("cross-direction candidate routing prevents duplicate publication claims", async () => {
  const [routing, interests] = await Promise.all([
    readJson("content/idea-audits/cross-direction-candidate-routing-v1.json"),
    readJson("config/research-interests.json")
  ]);
  const directionIds = new Set(interests.interests.map((interest) => interest.id));
  const candidateIds = routing.reservations.map((reservation) => reservation.candidateId);

  assert.equal(new Set(candidateIds).size, candidateIds.length);
  assert.ok(routing.reservations.length >= 8);
  assert.ok(
    routing.reservations.every(
      (reservation) => directionIds.has(reservation.primaryDirection)
        && reservation.reason.length >= 24
    )
  );
});

test("pre-review idea dossiers enforce substantive fields and exclusive provenance", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const dossier = {
    candidateId: "frozen-counterfactual-audit",
    frozenAt: "2026-08-01T02:00:00Z",
    title: "Frozen counterfactual audit for a measurable planning failure",
    hook: "Test whether one observed intermediate failure causally changes planning.",
    output: "Audit protocol",
    effort: "Medium",
    timeline: "Six weeks",
    whyNow: "Public checkpoints and a stable intervention boundary now make the claim falsifiable.",
    keyProblem: "Existing aggregate metrics do not identify whether one observed failure changes action.",
    currentLimitations: "Prior studies mix occurrence, intervention validity, and safety interpretation.",
    hypothesis: "A frozen paired intervention will isolate a reproducible local planning effect.",
    impact: "The result would determine whether this failure deserves system-level mitigation effort.",
    noveltyClaims: [
      "Separate natural occurrence from the ability to inject a synthetic failure.",
      "Keep the planner state fixed while changing only the audited intermediate object."
    ],
    method: [
      "Freeze the occurrence definition before inspecting downstream action differences.",
      "Replay paired branches from identical state and retain null outcomes."
    ],
    implementationPath: [
      "Pin the public repository and model checkpoint used by the minimum study.",
      "Add a deterministic snapshot and replay adapter at the documented handoff.",
      "Export a complete event ledger with intervention checks and outcome hashes."
    ],
    minimumStudy: [
      "Run a discovery split only to freeze definitions and exclusion rules.",
      "Apply the frozen occurrence gate to a held-out confirmation split.",
      "Estimate paired effects and report the full null-inclusive distribution."
    ],
    strongBaselines: [
      "No-op versus no-op deterministic replay.",
      "Ordinary confidence and geometry filtering.",
      "A matched true-positive intervention under the same planner state."
    ],
    metrics: [
      "Held-out event occurrence with a confidence interval.",
      "Paired trajectory and control differences.",
      "Agreement with an independent safety reference."
    ],
    successCriteria: [
      "The held-out occurrence gate passes under the frozen definition.",
      "The paired effect survives no-op, order-swap, and placebo controls."
    ],
    killCriteria: [
      "No qualifying event occurs in the held-out confirmation split.",
      "The effect disappears after deterministic replay controls."
    ],
    risks: [
      "The public stack may expose an intervention boundary but not source provenance.",
      "A local action change may not have an interpretable safety direction."
    ],
    evidence: [
      {
        title: "Local paper report one",
        url: "https://example.com/local-one",
        role: "Establishes the locally observed limitation used by the hypothesis.",
        localPaperId: "local-paper-one",
        localLink: "papers/local-paper-one/"
      },
      {
        title: "Local paper report two",
        url: "https://example.com/local-two",
        role: "Provides the local system boundary and comparison baseline.",
        localPaperId: "local-paper-two",
        localLink: "papers/local-paper-two/"
      },
      {
        title: "External primary paper",
        url: "https://example.com/external-paper",
        role: "Verifies the nearest external method and its unresolved limitation.",
        sourceOrigin: "external"
      },
      {
        title: "External fixed repository",
        url: "https://example.com/external-repository",
        role: "Verifies the concrete implementation boundary for the minimum study.",
        sourceOrigin: "external"
      }
    ]
  };

  assert.deepEqual(validateIdeaDossier(dossier, workflow), {
    candidateId: dossier.candidateId,
    evidence: 4,
    methodSteps: 2,
    studySteps: 3
  });

  const structuredDossier = structuredClone(dossier);
  structuredDossier.implementationPath = [
    {
      asset: "Fixed public repository",
      work: "Pin the public repository and checkpoint before changing the evaluation path."
    },
    {
      asset: "Deterministic replay adapter",
      work: "Build and validate a snapshot adapter at the documented system handoff."
    },
    {
      asset: "Null-inclusive event ledger",
      work: "Export every included, excluded, and null event with reproducibility hashes."
    }
  ];
  assert.equal(
    validateIdeaDossier(structuredDossier, workflow).candidateId,
    dossier.candidateId
  );

  const ambiguousEvidence = structuredClone(dossier);
  ambiguousEvidence.evidence[0].sourceOrigin = "external";
  assert.throws(
    () => validateIdeaDossier(ambiguousEvidence, workflow),
    /exactly one provenance marker/
  );
});

test("blind-review reports require every score, reviewer identity, and reopened evidence", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const review = {
    candidateId: "frozen-counterfactual-audit",
    dossierSnapshotFingerprint: "a".repeat(64),
    lens: "novelty-reviewer",
    reviewerAgentId: "019fbb32-330c-7a62-add9-1c00bd35be00",
    reviewedAt: "2026-08-01T11:00:00+08:00",
    scores: {
      novelty: 8,
      feasibility: 8,
      "success-probability": 7,
      impact: 8,
      "comparison-readiness": 9
    },
    rationales: {
      novelty: "The frozen estimand is narrower than generic planner-aware evaluation but still has one adjacent-method collision to resolve.",
      feasibility: "The pinned repository exposes the intervention boundary, while the required replay adapter is concrete and bounded.",
      "success-probability": "The occurrence gate can return a decisive null, although the event prevalence remains uncertain before execution.",
      impact: "Either result changes whether the system team should invest in a targeted mitigation or retain the current design.",
      "comparison-readiness": "The dossier specifies direct baselines, matched controls, public data, and metrics at the same evaluation grain."
    },
    strongestObjection: "The remaining contribution may collapse into a domain-specific application of an established counterfactual evaluation method.",
    requiredExperiment: "Run the held-out occurrence gate and frozen paired intervention against the nearest direct method with all null events retained.",
    evidenceReopened: [
      {
        url: "https://example.com/primary-paper",
        finding: "The primary paper covers the generic intervention but not the frozen domain-specific estimand."
      },
      {
        url: "https://example.com/fixed-repository",
        finding: "The fixed repository exposes the required handoff but does not provide the proposed evaluator."
      }
    ],
    overall: 8
  };

  assert.deepEqual(validateIdeaReview(review, workflow), {
    candidateId: review.candidateId,
    lens: review.lens,
    overall: review.overall,
    evidence: 2
  });

  const incomplete = structuredClone(review);
  delete incomplete.scores.impact;
  assert.throws(
    () => validateIdeaReview(incomplete, workflow),
    /exactly the five configured dimensions/
  );
});

test("review gate rejects any non-perfect dimension instead of averaging reviewers", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const dimensions = workflow.evaluation.dimensions.map((dimension) => dimension.id);
  const reviews = workflow.evaluation.reviewerLenses.map((lens, index) => ({
    candidateId: "frozen-counterfactual-audit",
    lens: lens.id,
    reviewerAgentId: `019fbb32-330c-7a62-add9-${String(index + 1).padStart(12, "0")}`,
    reviewedAt: "2026-08-01T11:00:00+08:00",
    dossierSnapshotFingerprint: "b".repeat(64),
    scores: Object.fromEntries(dimensions.map((dimension) => [dimension, 10])),
    rationales: Object.fromEntries(dimensions.map((dimension) => [
      dimension,
      `The ${dimension} evidence, comparison, implementation boundary, and falsification path have no material unresolved gap.`
    ])),
    strongestObjection: "The strongest remaining objection is bounded by the preregistered direct comparison and explicit stop condition.",
    requiredExperiment: "Execute the frozen minimum study against the direct baseline and retain every null, exclusion, and adverse result.",
    evidenceReopened: [
      "https://example.com/primary-paper",
      "https://example.com/fixed-repository"
    ],
    overall: 10
  }));

  assert.equal(evaluateIdeaReviewGate(reviews, workflow).status, "passed");

  reviews[0].scores.novelty = 9;
  const result = evaluateIdeaReviewGate(reviews, workflow);
  assert.equal(result.status, "revise");
  assert.deepEqual(result.deficits, [
    {
      reviewerAgentId: reviews[0].reviewerAgentId,
      lens: reviews[0].lens,
      field: "novelty",
      score: 9
    }
  ]);
});

test("sequential review gate stops immediately after the first non-perfect report", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const dimensions = workflow.evaluation.dimensions.map((dimension) => dimension.id);
  const lens = workflow.evaluation.reviewerLenses[0];
  const review = {
    candidateId: "frozen-counterfactual-audit",
    lens: lens.id,
    reviewerAgentId: "019fbb32-330c-7a62-add9-000000000101",
    reviewedAt: "2026-08-01T11:00:00+08:00",
    dossierSnapshotFingerprint: "c".repeat(64),
    scores: Object.fromEntries(dimensions.map((dimension) => [dimension, 10])),
    rationales: Object.fromEntries(dimensions.map((dimension) => [
      dimension,
      `The ${dimension} evidence and falsification path are independently supported by reopened primary sources.`
    ])),
    strongestObjection: "The causal interpretation still depends on one intervention-validity assumption.",
    requiredExperiment: "Run the frozen intervention-validity audit before any broader benchmark claim.",
    evidenceReopened: [
      "https://example.com/primary-paper",
      "https://example.com/fixed-repository"
    ],
    overall: 10
  };

  review.scores.feasibility = 9;
  review.overall = 9;
  const result = evaluateIdeaReviewGate([review], workflow, { sequential: true });

  assert.equal(result.status, "rejected-early");
  assert.equal(result.panelComplete, false);
  assert.ok(result.missingLenses.length > 0);
  assert.deepEqual(result.deficits, [
    {
      reviewerAgentId: review.reviewerAgentId,
      lens: review.lens,
      field: "feasibility",
      score: 9
    },
    {
      reviewerAgentId: review.reviewerAgentId,
      lens: review.lens,
      field: "overall",
      score: 9
    }
  ]);
});

test("sequential review gate cannot pass before every reviewer lens is complete", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const dimensions = workflow.evaluation.dimensions.map((dimension) => dimension.id);
  const lens = workflow.evaluation.reviewerLenses[0];
  const review = {
    candidateId: "frozen-counterfactual-audit",
    lens: lens.id,
    reviewerAgentId: "019fbb32-330c-7a62-add9-000000000102",
    reviewedAt: "2026-08-01T11:00:00+08:00",
    dossierSnapshotFingerprint: "d".repeat(64),
    scores: Object.fromEntries(dimensions.map((dimension) => [dimension, 10])),
    rationales: Object.fromEntries(dimensions.map((dimension) => [
      dimension,
      `The ${dimension} evidence and falsification path are independently supported by reopened primary sources.`
    ])),
    strongestObjection: "The final result still needs independent validation under the remaining reviewer lenses.",
    requiredExperiment: "Execute the frozen minimum study and preserve every null and adverse result.",
    evidenceReopened: [
      "https://example.com/primary-paper",
      "https://example.com/fixed-repository"
    ],
    overall: 10
  };

  const result = evaluateIdeaReviewGate([review], workflow, { sequential: true });

  assert.equal(result.status, "continue-review");
  assert.equal(result.panelComplete, false);
  assert.ok(result.missingLenses.length > 0);
  assert.throws(
    () => evaluateIdeaReviewGate([review], workflow),
    /at least 5 reports/
  );
});

test("candidate prompts apply the permanent evidence hard stops", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/idea-workflow.mjs",
      "prompt",
      "cooperative-autonomous-driving",
      "retrieve"
    ],
    { cwd: new URL("../", import.meta.url) }
  );

  for (const rule of workflow.candidateHardStops) {
    assert.match(stdout, new RegExp(rule.id));
  }
});

test("evaluation prompts are lens-specific and keep the publication threshold hidden", async () => {
  const workflow = await readJson("config/idea-exploration-workflow.json");
  const prompts = [];

  for (const lens of workflow.evaluation.reviewerLenses) {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "scripts/idea-workflow.mjs",
        "prompt",
        "cooperative-autonomous-driving",
        "evaluate",
        lens.id,
        "candidate-under-review"
      ],
      { cwd: new URL("../", import.meta.url) }
    );
    prompts.push(stdout);

    assert.match(stdout, new RegExp(`lens 必须原样写为 ${lens.id}`));
    assert.match(stdout, new RegExp(lens.focus.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(stdout, /新颖性/);
    assert.match(stdout, /实现可行性/);
    assert.match(stdout, /成功率/);
    assert.match(stdout, /影响力/);
    assert.match(stdout, /前人实验可对比性/);
    assert.match(stdout, /缺少开箱即用代码或完整现成闭环本身不是降分理由/);
    assert.doesNotMatch(stdout, /publicationScore|acceptanceScore|passScore/i);
    assert.doesNotMatch(stdout, /(?:10|十)\s*分[^。\n]{0,16}(?:通过|接受|发布)/i);
    assert.doesNotMatch(stdout, /满分[^。\n]{0,16}(?:通过|接受|发布)/i);
  }

  assert.equal(new Set(prompts).size, workflow.evaluation.reviewerLenses.length);
});

test("idea template uses the same ten-point blind-review contract as the workflow", async () => {
  const template = await readFile(
    new URL("content/templates/idea-exploration-template.md", ROOT),
    "utf8"
  );

  assert.doesNotMatch(template, /0[–-]100\s*分/);
  assert.doesNotMatch(template, /低于\s*(?:55|65|70|75)\s*分/);
  assert.match(template, /新颖性/);
  assert.match(template, /实现可行性/);
  assert.match(template, /成功率/);
  assert.match(template, /影响力/);
  assert.match(template, /前人实验可对比性/);
  assert.match(template, /发布分不得写入评估提示/);
  assert.match(template, /可信自建路径/);
  assert.match(template, /不要求已有开箱即用代码/);
});
