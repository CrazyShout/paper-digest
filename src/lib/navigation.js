import {
  getDigests,
  getIdeaCenter,
  getPapers,
  getResearchLandscape,
  getReviewCenter,
  getRuntimeConfig,
  getTags
} from "./content.js";

export function normalizeBasePath(value = "/") {
  const trimmed = String(value).replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

export function routeUrl(basePath, route = "") {
  const base = normalizeBasePath(basePath);
  const cleanRoute = String(route).replace(/^\/+|\/+$/g, "");
  return cleanRoute ? `${base}${cleanRoute}/` : base;
}

function flattenText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (typeof value === "object") {
    return Object.values(value).map(flattenText).join(" ");
  }
  return "";
}

function searchRecord({
  id,
  url,
  title,
  description = "",
  content = "",
  breadcrumbs = [],
  featured = false
}) {
  return {
    id,
    url,
    title,
    description,
    content,
    breadcrumbs,
    featured
  };
}

export async function getNotebookData(basePath = "/") {
  const base = normalizeBasePath(basePath);
  const [
    digests,
    papers,
    tags,
    reviewCenter,
    ideaCenter,
    landscape,
    runtime
  ] = await Promise.all([
    getDigests(),
    getPapers(),
    getTags(),
    getReviewCenter(),
    getIdeaCenter(),
    getResearchLandscape(),
    getRuntimeConfig()
  ]);

  const papersByTag = new Map(tags.map((tag) => [tag.id, []]));
  for (const paper of papers) {
    const primaryTag = paper.tags[0];
    if (!papersByTag.has(primaryTag)) papersByTag.set(primaryTag, []);
    papersByTag.get(primaryTag).push(paper);
  }

  const tree = {
    name: "Paper Digest",
    children: [
      {
        type: "page",
        name: "研究态势",
        url: routeUrl(base)
      },
      {
        type: "separator",
        name: "研究工作台"
      },
      {
        type: "folder",
        name: "方向综述",
        defaultOpen: false,
        index: {
          type: "page",
          name: "综述中心",
          url: routeUrl(base, "reviews")
        },
        children: reviewCenter.directions.map((direction) => ({
          type: "page",
          name: direction.label,
          url: routeUrl(base, `reviews/${direction.id}`)
        }))
      },
      {
        type: "page",
        name: "Idea 中心",
        url: routeUrl(base, "ideas")
      },
      {
        type: "separator",
        name: "定期简报"
      },
      {
        type: "folder",
        name: "简报归档",
        defaultOpen: true,
        index: {
          type: "page",
          name: "全部简报",
          url: routeUrl(base, "digests")
        },
        children: digests.map((digest) => ({
          type: "page",
          name: `${digest.displayDate || digest.date} · ${digest.title}`,
          url: routeUrl(base, `digests/${digest.id}`)
        }))
      },
      {
        type: "separator",
        name: "论文档案"
      },
      {
        type: "folder",
        name: `详细报告 · ${papers.length}`,
        defaultOpen: false,
        children: tags
          .map((tag) => ({
            type: "folder",
            name: `${tag.label} · ${papersByTag.get(tag.id)?.length || 0}`,
            defaultOpen: false,
            children: (papersByTag.get(tag.id) || [])
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((paper) => ({
                type: "page",
                name: paper.title,
                url: routeUrl(base, `papers/${paper.id}`)
              }))
          }))
          .filter((folder) => folder.children.length > 0)
      }
    ]
  };

  const searchRecords = [
    searchRecord({
      id: "research-landscape",
      url: routeUrl(base),
      title: "全库研究态势",
      description: landscape.title,
      content: flattenText(landscape),
      breadcrumbs: ["Paper Digest", "研究态势"],
      featured: true
    }),
    searchRecord({
      id: "review-center",
      url: routeUrl(base, "reviews"),
      title: reviewCenter.title,
      description: reviewCenter.summary,
      content: flattenText(reviewCenter.directions),
      breadcrumbs: ["Paper Digest", "综述中心"],
      featured: true
    }),
    ...reviewCenter.directions.map((direction) => searchRecord({
      id: `review-${direction.id}`,
      url: routeUrl(base, `reviews/${direction.id}`),
      title: direction.title,
      description: direction.abstract,
      content: flattenText(direction),
      breadcrumbs: ["方向综述", direction.label]
    })),
    searchRecord({
      id: "idea-center",
      url: routeUrl(base, "ideas"),
      title: ideaCenter.title,
      description: ideaCenter.summary,
      content: flattenText(ideaCenter),
      breadcrumbs: ["Paper Digest", "Idea 中心"],
      featured: true
    }),
    searchRecord({
      id: "archive-digests",
      url: routeUrl(base, "digests"),
      title: "简报归档",
      description: `${digests.length} 期论文简报`,
      content: flattenText(digests.map((digest) => ({
        title: digest.title,
        summary: digest.summary,
        keywords: digest.keywords
      }))),
      breadcrumbs: ["Paper Digest", "简报归档"],
      featured: true
    }),
    ...digests.map((digest, index) => searchRecord({
      id: `digest-${digest.id}`,
      url: routeUrl(base, `digests/${digest.id}`),
      title: digest.title,
      description: digest.summary,
      content: [
        digest.body,
        digest.keywords?.join(" "),
        ...digest.papers.map((paper) => [
          paper.title,
          paper.comment,
          paper.authors.join(" "),
          paper.affiliations.join(" ")
        ].join(" "))
      ].join(" "),
      breadcrumbs: ["简报归档", digest.displayDate || digest.date],
      featured: index < 3
    })),
    ...papers.map((paper) => searchRecord({
      id: `paper-${paper.id}`,
      url: routeUrl(base, `papers/${paper.id}`),
      title: paper.title,
      description: paper.comment,
      content: [
        paper.body,
        paper.source,
        paper.authors.join(" "),
        paper.affiliations.join(" ")
      ].join(" "),
      breadcrumbs: [
        "论文报告",
        tags.find((tag) => tag.id === paper.tags[0])?.label || "未分类"
      ]
    }))
  ];

  return {
    base,
    tree,
    searchRecords,
    digests,
    papers,
    tags,
    reviewCenter,
    ideaCenter,
    landscape,
    runtime
  };
}
