import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  buildPaperSourceLinks,
  buildReviewSourceLinks,
  formalPrimaryLinkIsCanonical,
  getInterestConfig,
  getPapers,
  getReviewCenter,
  isValidIsoDate,
  sourceLinkIdentity,
  sourceLinkLabel
} from "../src/lib/content.js";
import {
  extractArxivIds,
  extractDois,
  legacySearchAuditCountFields,
  localCorpusRipgrepFlagsMatch,
  localCorpusSearchSnapshot,
  missingSourceAttemptFamilies,
  normalizeCanonicalId,
  registerCanonicalAlias,
  unusedAuditedSourceFamilies
} from "../src/lib/review-audit.js";

test("review dates must be real calendar dates", () => {
  assert.equal(isValidIsoDate("2026-07-26"), true);
  assert.equal(isValidIsoDate("2024-02-29"), true);
  assert.equal(isValidIsoDate("2026-02-29"), false);
  assert.equal(isValidIsoDate("2026-13-01"), false);
  assert.equal(isValidIsoDate("2026-7-26"), false);
});

test("review center covers every configured research direction", async () => {
  const [center, interests] = await Promise.all([
    getReviewCenter(),
    getInterestConfig()
  ]);
  const reviewIds = center.directions.map((direction) => direction.id);
  const configuredIds = interests.interests.map((interest) => interest.id);

  assert.deepEqual(reviewIds, configuredIds);
  assert.equal(new Set(reviewIds).size, reviewIds.length);
});

test("literature review workflow is pinned and covers every direction", async () => {
  const [workflow, interests] = await Promise.all([
    readFile("config/literature-review-workflow.json", "utf8").then(JSON.parse),
    getInterestConfig()
  ]);
  const configuredIds = interests.interests.map((interest) => interest.id);

  assert.match(workflow.upstream.commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(
    Object.keys(workflow.directions).sort(),
    [...configuredIds].sort()
  );
  assert.ok(workflow.requiredSkills.some((skill) => skill.name === "research-lit"));
  assert.ok(workflow.requiredSkills.some((skill) => skill.name === "citation-audit"));
  assert.ok(workflow.requirements.minExcludedCandidates >= 3);
  assert.ok(workflow.requirements.minQueryResultSamples >= 3);
  assert.ok(workflow.qualityChecks.some((check) => check.code === "local-candidate-closure"));
  assert.ok(workflow.qualityChecks.some((check) => check.code === "formal-arxiv-link-retention"));
  assert.deepEqual(workflow.stages, [
    "scope",
    "retrieve",
    "deduplicate",
    "verify",
    "synthesize",
    "independent-review",
    "publish"
  ]);
  for (const direction of Object.values(workflow.directions)) {
    assert.ok(direction.queryFamilies.length >= workflow.requirements.minQueryFamilies);
  }
});

test("OpenAlex review retrievals use the real search API parameter", async () => {
  const review = await readFile(
    "content/reviews/radar-occupancy-representation.json",
    "utf8"
  ).then(JSON.parse);
  const openAlexRuns = review.searchAudit.queryRuns.filter((run) =>
    run.retrieval.provider.includes("openalex")
  );

  assert.ok(openAlexRuns.length >= 2);
  for (const run of openAlexRuns) {
    assert.equal(run.retrieval.parameters.search, run.query);
    assert.equal(Object.hasOwn(run.retrieval.parameters, "query"), false);
    assert.ok(Number.isInteger(run.retrieval.parameters.per_page));
  }
});

test("ranked OpenAlex snapshots bind aliases and citation expansion counts", async () => {
  const review = JSON.parse(
    await readFile("content/reviews/radar-occupancy-representation.json", "utf8")
  );
  const snapshotRuns = review.searchAudit.queryRuns.filter(
    (run) => Array.isArray(run.retrieval?.rankedOpenAlexIds)
  );

  assert.equal(snapshotRuns.length, 2);
  for (const run of snapshotRuns) {
    const ids = run.retrieval.rankedOpenAlexIds;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(ids))
      .digest("hex");
    const mergedAliasRows = run.retrieval.aliasMerges.reduce(
      (sum, merge) => sum + merge.rankedOpenAlexIds.length - 1,
      0
    );

    assert.equal(ids.length, run.retrieval.limit);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(fingerprint, run.retrieval.rankedSnapshotSha256);
    assert.equal(mergedAliasRows, run.aliasMergedCount);
    assert.equal(
      run.rawHitCount,
      run.directCandidateCount + run.aliasMergedCount + run.screenedOutCount
    );
    assert.equal(
      run.resultCount,
      run.directCandidateCount + run.citationExpansionCount
    );
    assert.equal(
      run.retrieval.citationExpansion.resultIdSample.length,
      run.citationExpansionCount
    );
  }
});

test("review audit canonical IDs are compared case-insensitively", () => {
  const canonicalIds = new Set([
    normalizeCanonicalId("arxiv:2205.15997"),
    normalizeCanonicalId("ARXIV:2205.15997")
  ]);

  assert.equal(canonicalIds.size, 1);
});

test("canonical alias registration never overwrites another primary paper", () => {
  const aliases = new Map();
  assert.equal(
    registerCanonicalAlias(
      aliases,
      "arXiv:2203.00858",
      "doi:10.1145/3503161.3548171"
    ),
    true
  );
  assert.equal(
    registerCanonicalAlias(
      aliases,
      "arxiv:2203.00858",
      "arxiv:2203.00858"
    ),
    false
  );
  assert.equal(
    aliases.get("arxiv:2203.00858"),
    "doi:10.1145/3503161.3548171"
  );
});

test("canonical alias extraction decodes encoded arXiv and DOI URLs", () => {
  assert.deepEqual(
    extractArxivIds("https://arxiv.org/abs/2203%252E00858"),
    ["2203.00858"]
  );
  assert.deepEqual(
    extractArxivIds("https://arxiv.org/abs/2203%2E00858#%ZZ"),
    ["2203.00858"]
  );
  assert.deepEqual(
    extractArxivIds(
      "https://arxiv.org:443/x/../abs/2203.00858",
      "https://arxiv.org/./abs/2203.00858",
      "https://arxiv.org./abs/2203.00858"
    ),
    ["2203.00858"]
  );
  assert.deepEqual(
    extractDois("https://doi.org/10%2E1145%2F3503161%2E3548171"),
    ["10.1145/3503161.3548171"]
  );
});

test("review audit rejects declared source families that were never used", () => {
  assert.deepEqual(
    unusedAuditedSourceFamilies(
      new Set(["arxiv", "official-project", "local-corpus"]),
      new Set(["arxiv"]),
      new Set(["local-corpus"])
    ),
    ["official-project"]
  );
});

test("review audit rejects legacy count fields and missing source attempts", () => {
  assert.deepEqual(
    legacySearchAuditCountFields({
      counts: {},
      candidateCount: 20,
      includedCount: 10
    }),
    ["candidateCount", "includedCount"]
  );
  assert.deepEqual(
    missingSourceAttemptFamilies(
      new Set(["local-corpus", "arxiv", "openalex"]),
      [
        { sourceFamily: "local-corpus" },
        { sourceFamily: "arxiv" }
      ]
    ),
    ["openalex"]
  );
});

test("local corpus snapshots count raw revisions but deduplicate canonical candidates", () => {
  const snapshot = localCorpusSearchSnapshot(
    [
      {
        id: "paper-a",
        tags: ["world-models"],
        data: { id: "paper-a", title: "World Model A" },
        body: "simulation"
      },
      {
        id: "paper-a-revision",
        revisionOf: "paper-a",
        tags: ["world-models"],
        data: { id: "paper-a-revision", title: "World Model A" },
        body: "simulation"
      },
      {
        id: "paper-b",
        tags: ["autonomous-driving-testing"],
        data: { id: "paper-b", title: "World Model Test" },
        body: "simulation"
      }
    ],
    "world-models",
    "world model|simulation"
  );

  assert.deepEqual(snapshot.rawHitPaperIds, [
    "paper-a",
    "paper-a-revision",
    "paper-b"
  ]);
  assert.deepEqual(snapshot.candidateLocalPaperIds, ["paper-a"]);
});

test("local corpus snapshots execute ripgrep against raw Markdown files", async () => {
  const papers = await getPapers();
  const snapshot = localCorpusSearchSnapshot(
    papers,
    "world-models",
    "^---$",
    { corpusPath: path.join(process.cwd(), "content", "papers") }
  );

  assert.equal(snapshot.rawHitPaperIds.length, papers.length);
});

test("formal papers retain both publisher and arXiv links", () => {
  assert.deepEqual(
    buildReviewSourceLinks({
      publicationStatus: "peer-reviewed",
      canonicalId: "arxiv:2411.16816",
      url: "https://openaccess.thecvf.com/content/CVPR2025/html/example.html"
    }),
    [
      {
        label: "正式版",
        url: "https://openaccess.thecvf.com/content/CVPR2025/html/example.html"
      },
      {
        label: "arXiv",
        url: "https://arxiv.org/abs/2411.16816"
      }
    ]
  );
  assert.deepEqual(
    buildPaperSourceLinks(
      "CVPR 2025 / https://openaccess.thecvf.com/content/CVPR2025/html/example.html / arXiv:2411.16816"
    ),
    [
      {
        label: "正式版",
        url: "https://openaccess.thecvf.com/content/CVPR2025/html/example.html"
      },
      {
        label: "arXiv",
        url: "https://arxiv.org/abs/2411.16816"
      }
    ]
  );
  assert.deepEqual(
    buildReviewSourceLinks({
      publicationStatus: "peer-reviewed",
      canonicalId: "doi:10.1109/LSP.2026.3680426",
      url: "https://doi.org/10.1109/LSP.2026.3680426",
      links: [
        {
          label: "arXiv",
          url: "https://arxiv.org/abs/2606.27644"
        }
      ]
    }),
    [
      {
        label: "正式版",
        url: "https://doi.org/10.1109/LSP.2026.3680426"
      },
      {
        label: "arXiv",
        url: "https://arxiv.org/abs/2606.27644"
      }
    ]
  );
});

test("source links deduplicate equivalent arXiv URLs and derive honest labels", () => {
  assert.equal(
    sourceLinkIdentity("https://arxiv.org/pdf/2411.16816v2.pdf"),
    "arxiv:2411.16816"
  );
  assert.deepEqual(
    buildReviewSourceLinks({
      publicationStatus: "preprint",
      canonicalId: "arxiv:2411.16816",
      url: "https://arxiv.org/abs/2411.16816",
      links: [
        {
          label: "正式版",
          url: "https://arxiv.org/pdf/2411.16816v2.pdf"
        }
      ]
    }),
    [
      {
        label: "arXiv",
        url: "https://arxiv.org/abs/2411.16816"
      }
    ]
  );
  assert.deepEqual(
    buildReviewSourceLinks({
      publicationStatus: "peer-reviewed",
      canonicalId: "url:https://github.com/example/project",
      url: "https://github.com/example/project"
    }),
    [
      {
        label: "代码",
        url: "https://github.com/example/project"
      }
    ]
  );
  assert.equal(
    sourceLinkLabel("https://openaccess.thecvf.com/paper.html"),
    "正式版"
  );
  assert.equal(
    sourceLinkLabel("https://icml.cc/virtual/2024/38112"),
    "正式版"
  );
  assert.equal(
    sourceLinkLabel("https://openaccess.thecvf.com.evil.example/paper.html"),
    "项目页"
  );
  assert.equal(
    sourceLinkLabel("https://arxiv.org./abs/2411.16816"),
    "arXiv"
  );
  assert.equal(
    sourceLinkIdentity("https://arxiv.org./abs/2411.16816"),
    "arxiv:2411.16816"
  );
});

test("formal publication destinations remain the primary review link", () => {
  assert.equal(
    formalPrimaryLinkIsCanonical({
      publicationStatus: "peer-reviewed",
      url: "https://doi.org/10.1109/example",
      links: [{ url: "https://arxiv.org/abs/2401.00001" }]
    }),
    true
  );
  assert.equal(
    formalPrimaryLinkIsCanonical({
      publicationStatus: "peer-reviewed",
      url: "https://arxiv.org/abs/2401.00001",
      links: [{ url: "https://doi.org/10.1109/example" }]
    }),
    false
  );
  assert.equal(
    formalPrimaryLinkIsCanonical({
      publicationStatus: "peer-reviewed",
      url: "https://arxiv.org/abs/2401.00001",
      links: [{ url: "https://github.com/example/project" }]
    }),
    false
  );
  assert.equal(
    formalPrimaryLinkIsCanonical({
      publicationStatus: "accepted",
      url: "https://arxiv.org/abs/2401.00001"
    }),
    true
  );
});

test("local corpus retrieval flags must exactly match the executed command", () => {
  assert.equal(localCorpusRipgrepFlagsMatch(["-l", "-i"]), true);
  assert.equal(localCorpusRipgrepFlagsMatch(["-i", "-l"]), false);
  assert.equal(localCorpusRipgrepFlagsMatch(["-l", "-i", "--fixed-strings"]), false);
});

test("every formal arXiv reference with a publisher URL renders both destinations", async () => {
  const center = await getReviewCenter();

  for (const direction of center.directions) {
    for (const reference of direction.references) {
      if (
        !["peer-reviewed", "workshop"].includes(reference.publicationStatus)
        || !reference.canonicalId.startsWith("arxiv:")
        || sourceLinkLabel(reference.url) === "arXiv"
      ) {
        continue;
      }

      assert.ok(
        reference.sourceLinks.some((link) => link.label === "正式版" && link.url === reference.url),
        `${direction.id}:${reference.id}`
      );
      assert.ok(
        reference.sourceLinks.some((link) => link.label === "arXiv"),
        `${direction.id}:${reference.id}`
      );
    }
  }
});

test("paper source metadata retains arXiv beside every recorded formal destination", async () => {
  const papers = await getPapers();

  for (const paper of papers) {
    if (
      !/arXiv:?\s*\d{4}\.\d{4,5}/i.test(paper.source)
      || !paper.sourceLinks.some((link) => link.label === "正式版")
    ) {
      continue;
    }

    assert.ok(
      paper.sourceLinks.some((link) => link.label === "arXiv"),
      paper.id
    );
  }
});

test("local review searches separate raw hits and close every tagged candidate", async () => {
  const [center, papers] = await Promise.all([
    getReviewCenter(),
    getPapers()
  ]);

  for (const direction of center.directions) {
    const localRun = direction.searchAudit.queryRuns.find(
      (queryRun) => queryRun.sourceFamily === "local-corpus"
    );
    assert.ok(localRun, direction.id);
    assert.ok(Number.isInteger(localRun.rawHitCount), direction.id);
    assert.ok(Number.isInteger(localRun.screenedOutCount), direction.id);
    assert.ok(localRun.screeningNote, direction.id);
    assert.equal(
      localRun.rawHitCount,
      localRun.resultCount + localRun.screenedOutCount,
      direction.id
    );
    const snapshot = localCorpusSearchSnapshot(
      papers,
      direction.id,
      localRun.query,
      { corpusPath: path.join(process.cwd(), "content", "papers") }
    );
    assert.equal(localRun.rawHitCount, snapshot.rawHitPaperIds.length, direction.id);
    assert.deepEqual(
      localRun.localCandidateDisposition.candidateLocalPaperIds,
      snapshot.candidateLocalPaperIds,
      direction.id
    );
    const deferredIds = localRun.localCandidateDisposition.deferredGroups
      .flatMap((group) => group.localPaperIds);
    const includedCandidateIds = direction.references
      .map((reference) => reference.localPaperId)
      .filter((paperId) => snapshot.candidateLocalPaperIds.includes(paperId));
    assert.deepEqual(
      [...new Set([...includedCandidateIds, ...deferredIds])].sort(),
      snapshot.candidateLocalPaperIds,
      direction.id
    );
    assert.equal(
      direction.searchAudit.counts.candidates,
      direction.searchAudit.queryRuns.reduce(
        (sum, queryRun) => sum + queryRun.resultCount,
        0
      ),
      direction.id
    );
    const referenceCountsBySource = direction.references.reduce((counts, reference) => {
      counts.set(reference.sourceFamily, (counts.get(reference.sourceFamily) || 0) + 1);
      return counts;
    }, new Map());
    for (const attempt of direction.searchAudit.sourceAttempts) {
      assert.equal(
        attempt.acceptedCount,
        referenceCountsBySource.get(attempt.sourceFamily) || 0,
        `${direction.id}:${attempt.sourceFamily}`
      );
    }
  }
});

test("local-only review refreshes preserve core and external audit dates", async () => {
  const center = await getReviewCenter();

  for (const direction of center.directions) {
    const { searchAudit } = direction;
    if (!searchAudit.incrementalLocalAuditAt) {
      assert.equal(searchAudit.searchedAt, direction.reviewedAt, direction.id);
      continue;
    }

    assert.equal(
      searchAudit.incrementalLocalAuditAt,
      searchAudit.searchedAt,
      direction.id
    );
    assert.ok(direction.reviewedAt < searchAudit.searchedAt, direction.id);

    const postReviewRuns = searchAudit.queryRuns.filter(
      (queryRun) => queryRun.executedAt > direction.reviewedAt
    );
    assert.ok(postReviewRuns.length > 0, direction.id);
    assert.ok(
      postReviewRuns.every((queryRun) => queryRun.sourceFamily === "local-corpus"),
      direction.id
    );

    const postReviewAttempts = searchAudit.sourceAttempts.filter(
      (attempt) => attempt.executedAt > direction.reviewedAt
    );
    assert.ok(postReviewAttempts.length > 0, direction.id);
    assert.ok(
      postReviewAttempts.every((attempt) => attempt.sourceFamily === "local-corpus"),
      direction.id
    );
  }
});

test("every direction has a complete narrative and mixed-source reading list", async () => {
  const center = await getReviewCenter();
  const requiredKinds = [
    "scope",
    "evolution",
    "taxonomy",
    "evidence",
    "challenges",
    "outlook"
  ];

  for (const direction of center.directions) {
    assert.deepEqual(
      direction.sections.map((section) => section.kind).sort(),
      [...requiredKinds].sort(),
      direction.id
    );
    assert.ok(direction.references.length >= 10, direction.id);
    assert.ok(direction.references.some((reference) => reference.origin === "local"), direction.id);
    assert.ok(direction.references.some((reference) => reference.origin === "external"), direction.id);
    assert.ok(
      direction.references.some((reference) =>
        ["survey", "tutorial"].includes(reference.publicationType)
      ),
      direction.id
    );
    assert.equal(direction.searchAudit.counts.included, direction.references.length, direction.id);
    assert.equal(direction.searchAudit.independentReview.status, "passed", direction.id);
    assert.ok(direction.searchAudit.queryFamilies.length >= 5, direction.id);
    assert.equal(
      direction.searchAudit.queryRuns.length,
      direction.searchAudit.queryFamilies.length,
      direction.id
    );
    assert.deepEqual(
      new Set(direction.searchAudit.retainedCanonicalIds),
      new Set(direction.references.map((reference) => reference.canonicalId)),
      direction.id
    );
    const localRun = direction.searchAudit.queryRuns.find(
      (queryRun) => queryRun.sourceFamily === "local-corpus"
    );
    const deferredLocalCount = localRun.localCandidateDisposition.deferredGroups
      .flatMap((group) => group.localPaperIds)
      .length;
    assert.equal(
      direction.searchAudit.excludedCandidates.length + deferredLocalCount,
      direction.searchAudit.counts.excluded,
      direction.id
    );
    assert.ok(new Set(direction.searchAudit.sourceFamilies).size >= 4, direction.id);

    const usedReferences = new Set(
      direction.sections.flatMap((section) => section.referenceIds)
    );
    for (const reference of direction.references) {
      assert.ok(reference.authors, `${direction.id}:${reference.id}:authors`);
      assert.ok(reference.canonicalId, `${direction.id}:${reference.id}:canonicalId`);
      assert.ok(reference.supports, `${direction.id}:${reference.id}:supports`);
      assert.ok(reference.limitation, `${direction.id}:${reference.id}:limitation`);
      assert.ok(usedReferences.has(reference.id), `${direction.id}:${reference.id}`);
    }
  }
});

test("reference origin and destinations are derived from localPaperId, not sourceFamily", async () => {
  const [center, papers] = await Promise.all([getReviewCenter(), getPapers()]);
  const paperMap = new Map(papers.map((paper) => [paper.id, paper]));
  let hasPrimaryVerifiedLocalReference = false;

  for (const direction of center.directions) {
    for (const reference of direction.references) {
      if (reference.localPaperId) {
        if (reference.sourceFamily !== "local-corpus") {
          hasPrimaryVerifiedLocalReference = true;
        }
        const paper = paperMap.get(reference.localPaperId);
        assert.ok(paper, reference.localPaperId);
        assert.equal(reference.origin, "local");
        assert.equal(reference.badge, "本库已报告");
        assert.equal(reference.title, paper.title);
        assert.equal(reference.href, `../../papers/${paper.id}/`);
      } else {
        assert.equal(reference.origin, "external");
        assert.equal(reference.badge, "外部文献");
        assert.equal(reference.href, reference.url);
        assert.match(reference.href, /^https:\/\//);
      }
    }
  }

  assert.equal(hasPrimaryVerifiedLocalReference, true);
});
