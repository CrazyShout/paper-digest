import { HOME_DESCRIPTION } from "./reading-ui.js";
import { projectReviewCitations } from "./review-citations.js";

function text(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (typeof value === "object") return Object.values(value).map(text).join(" ");
  return String(value);
}

function fields(record, keys) {
  return keys.map((key) => text(record[key])).filter(Boolean).join(" ");
}

function record({ content = "", description = "", featured = false, ...rest }) {
  return { ...rest, description, content, featured };
}

// Index reading content once. Provenance ledgers, fingerprints and repeated
// projections remain in their source files instead of the browser payload.
export function buildNotebookSearchIndex(notebook) {
  const { base, digests, papers, tags, reviewCenter, ideaCenter, landscape } = notebook;
  const url = (route = "") => `${base}${route ? `${route}/` : ""}`;
  const publicPaperIds = new Set(digests.flatMap((digest) => digest.papers.map((paper) => paper.id)));

  return [
    record({
      id: "home", kind: "overview", url: url(),
      title: "论文简报", description: HOME_DESCRIPTION,
      breadcrumbs: ["Paper Digest", "首页"], featured: true
    }),
    record({
      id: "reading-directions", kind: "direction", url: url("directions"),
      title: "按方向阅读", description: "各方向的近期短评、跨期对照、完整报告与系统综述。",
      breadcrumbs: ["Paper Digest", "按方向阅读"], featured: true
    }),
    ...(notebook.directionReading || []).map((direction) => record({
      id: `direction-${direction.id}`, kind: "direction", url: url(`directions/${direction.id}`),
      title: direction.label, description: direction.editorial?.changeSummary || "近期与历期论文",
      content: [text(direction.searchAliases), fields(direction.editorial || {}, ["changeSummary", "comparisons", "connections", "followUps"]),
        ...direction.issues.map((issue) => [issue.date, ...issue.papers.map((paper) => paper.title)].join(" "))].join(" "),
      breadcrumbs: ["按方向阅读", "近期与历期"]
    })),
    record({
      id: "research-landscape", kind: "overview", url: url("landscape"),
      title: "全库研究态势", description: landscape.summary,
      content: [
        ...landscape.directions.map((direction) => fields(direction, [
          "label", "focus", "gap", "ideaTitle", "idea", "method", "validation", "novelty"
        ])),
        ...[...landscape.trends, ...landscape.hotspots, ...landscape.opportunities]
          .map((item) => fields(item, [
            "title", "evidence", "judgement", "whyItMatters", "question", "whyNow",
            "minimumStudy", "proposal", "successSignal", "risk"
          ]))
      ].join(" "),
      breadcrumbs: ["Paper Digest", "研究态势"], featured: true
    }),
    record({
      id: "review-center", kind: "review", url: url("reviews"),
      title: reviewCenter.title, description: reviewCenter.summary,
      content: reviewCenter.directions.map((direction) => direction.title).join(" "),
      breadcrumbs: ["Paper Digest", "综述中心"], featured: true
    }),
    ...reviewCenter.directions.map((direction) => record({
      id: `review-${direction.id}`, kind: "review", url: url(`reviews/${direction.id}`),
      title: direction.title, description: direction.abstractText,
      content: [
        text(direction.researchQuestions), text(direction.takeaways),
        ...direction.sections.map((section) => [section.title, section.thesis, projectReviewCitations(section.body, direction.references, { links: false })].join(" ")),
        ...direction.references.map((reference) => fields(reference, [
          "title", "authors", "venue", "year", "supports", "limitation"
        ]))
      ].join(" "),
      breadcrumbs: ["方向综述", direction.label]
    })),
    record({
      id: "idea-center", kind: "idea", url: url("ideas"),
      title: ideaCenter.title, description: ideaCenter.summary,
      content: [
        ...ideaCenter.directions.map((direction) => fields(direction, ["label", "scope", "outcome"])),
        ...(ideaCenter.currentExploration?.directions || []).map((direction) => fields(direction, ["progress", "opportunity"]))
      ].join(" "),
      breadcrumbs: ["Paper Digest", "Idea 中心"], featured: true
    }),
    ...(ideaCenter.currentExploration?.candidates || []).map((candidate) => record({
      id: `exploration-${candidate.id}`, kind: "idea", url: `${url("ideas")}#explore-${candidate.id}`,
      title: candidate.title, description: candidate.hypothesis,
      content: fields(candidate, ["method", "whyNow", "upside", "risk", "priorWork", "researchPosition", "sharedExperiment", "implementation", "firstExperiment"]),
      breadcrumbs: ["Idea 中心", "当前探索", tags.find((tag) => tag.id === candidate.directionId)?.label || candidate.directionId]
    })),
    ...ideaCenter.directions.flatMap((direction) => direction.ideas.map((idea) => record({
      id: `idea-${idea.id}`, kind: "idea", url: `${url("ideas")}#idea-${idea.id}`,
      title: idea.title, description: idea.hook,
      content: fields(idea, [
        "keyProblem", "currentLimitations", "hypothesis", "claimBoundary", "method",
        "minimumStudy", "strongBaselines", "successCriteria", "killCriteria", "risks"
      ]),
      breadcrumbs: ["Idea 中心", direction.label]
    }))),
    record({
      id: "archive-digests", kind: "digest", url: url("digests"),
      title: "简报归档", description: `${digests.length} 期论文简报`,
      breadcrumbs: ["Paper Digest", "简报归档"], featured: true
    }),
    ...digests.map((digest, index) => record({
      id: `digest-${digest.id}`, kind: "digest", url: url(`digests/${digest.id}`),
      title: digest.title, description: digest.summary,
      content: [digest.body, text(digest.keywords), ...digest.papers.map((paper) => paper.title)].join(" "),
      breadcrumbs: ["简报归档", digest.displayDate || digest.date], featured: index < 3
    })),
    ...papers.map((paper) => record({
      id: `paper-${paper.id}`, kind: "paper", url: url(`papers/${paper.id}`),
      title: paper.title, description: paper.comment,
      content: [paper.body, paper.source, ...paper.authors, ...paper.affiliations,
        ...paper.tags.map((id) => tags.find((tag) => tag.id === id)?.label || id)
      ].join(" "),
      breadcrumbs: publicPaperIds.has(paper.id)
        ? ["论文报告", tags.find((tag) => tag.id === paper.tags[0])?.label || "未分类"]
        : ["人工核验修订", "人工核验版"]
    }))
  ];
}
