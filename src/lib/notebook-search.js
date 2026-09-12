import { HOME_DESCRIPTION } from "./reading-ui.js";

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
      title: direction.title, description: direction.abstract,
      content: [
        text(direction.researchQuestions), text(direction.takeaways),
        ...direction.sections.map((section) => fields(section, ["title", "thesis", "body"])),
        ...direction.references.map((reference) => fields(reference, [
          "title", "authors", "venue", "year", "supports", "limitation"
        ]))
      ].join(" "),
      breadcrumbs: ["方向综述", direction.label]
    })),
    record({
      id: "idea-center", kind: "idea", url: url("ideas"),
      title: ideaCenter.title, description: ideaCenter.summary,
      content: ideaCenter.directions.map((direction) => fields(direction, ["label", "scope", "outcome"])).join(" "),
      breadcrumbs: ["Paper Digest", "Idea 中心"], featured: true
    }),
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
