import { memoizeContent, withContentSnapshot } from "./content-cache.js";
import { buildNotebookSearchIndex } from "./notebook-search.js";
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

export function getNotebookData(basePath = "/") {
  const base = normalizeBasePath(basePath);
  return withContentSnapshot(() => memoizeContent(`notebook:${base}`, () => loadNotebookData(base)));
}

export function getNotebookSearchIndex(basePath = "/") {
  const base = normalizeBasePath(basePath);
  return withContentSnapshot(() => memoizeContent(`notebook-search:${base}`, async () => (
    buildNotebookSearchIndex(await getNotebookData(base))
  )));
}

async function loadNotebookData(base) {
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

  const publicPaperIds = new Set(
    digests.flatMap((digest) => digest.papers.map((paper) => paper.id))
  );
  const revisionsByOriginalId = new Map(
    papers
      .filter((paper) => paper.revisionOf)
      .map((paper) => [paper.revisionOf, paper])
  );
  const canonicalPapers = papers
    .filter((paper) => !paper.revisionOf)
    .map((paper) => {
      const revision = revisionsByOriginalId.get(paper.id);
      if (!revision) return paper;
      return {
        ...revision,
        id: paper.id,
        link: paper.link,
        revisionOf: undefined,
        revisionId: revision.id
      };
    });
  const publicPapers = canonicalPapers.filter((paper) => publicPaperIds.has(paper.id));
  const auditPapers = canonicalPapers.filter((paper) => !publicPaperIds.has(paper.id));
  const papersByTag = new Map(tags.map((tag) => [tag.id, []]));
  for (const paper of publicPapers) {
    const primaryTag = paper.tags[0];
    if (!papersByTag.has(primaryTag)) papersByTag.set(primaryTag, []);
    papersByTag.get(primaryTag).push(paper);
  }

  const tree = {
    name: "Paper Digest",
    children: [
      {
        type: "page",
        name: "首页",
        url: routeUrl(base)
      },
      {
        type: "page",
        name: "研究态势",
        url: routeUrl(base, "landscape")
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
        children: reviewCenter.directionGroups.map((group) => ({
          type: "folder",
          name: group.label,
          defaultOpen: false,
          children: group.directions.map((direction) => ({
            type: "page",
            name: direction.label,
            url: routeUrl(base, `reviews/${direction.id}`)
          }))
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
        defaultOpen: false,
        index: {
          type: "page",
          name: "全部简报",
          url: routeUrl(base, "digests")
        },
        children: [
          ...digests.slice(0, 5).map((digest) => ({
            type: "page",
            name: `${digest.displayDate || digest.date} · ${digest.title}`,
            url: routeUrl(base, `digests/${digest.id}`)
          })),
          ...(digests.length > 5 ? [{
            type: "folder",
            name: "更早的简报",
            defaultOpen: false,
            children: digests.slice(5).map((digest) => ({
              type: "page",
              name: `${digest.displayDate || digest.date} · ${digest.title}`,
              url: routeUrl(base, `digests/${digest.id}`)
            }))
          }] : [])
        ]
      },
      {
        type: "separator",
        name: "论文档案"
      },
      {
        type: "folder",
        name: `详细报告 · ${publicPapers.length}`,
        defaultOpen: false,
        children: reviewCenter.directionGroups
          .map((group) => ({
            type: "folder",
            name: group.label,
            defaultOpen: false,
            children: group.directions
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
          }))
          .filter((folder) => folder.children.length > 0)
      },
      {
        type: "folder",
        name: `人工核验修订 · ${auditPapers.length}`,
        defaultOpen: false,
        children: auditPapers
          .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
          .map((paper) => ({
            type: "page",
            name: `${paper.title} · 人工核验版`,
            url: routeUrl(base, `papers/${paper.id}`)
          }))
      }
    ]
  };


  return {
    base,
    tree,
    digests,
    papers: canonicalPapers,
    tags,
    reviewCenter,
    ideaCenter,
    landscape,
    runtime
  };
}
