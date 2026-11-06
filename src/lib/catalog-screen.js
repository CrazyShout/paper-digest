import { createHash } from "node:crypto";

// Preserve the November 6 broad screen, then union current direction keywords.
export const BROAD_TITLE_PATTERN = "autonom|driv|vehicle|traffic|v2x|radar|lidar|occupancy|road|street|splatting|gaussian|world.model|world.action|out.of.distribution|anomaly|open.set|open.world|motion.forecast|scene.flow|connected.autom|multi.agent.*(planning|perception|forecast)|counterfactual|collision|scene.reconstruct";
const normalized = (value) => String(value).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function screenCatalogTitles(records, interests, { sampleSize = 20, seed = "paper-digest", broadPattern = BROAD_TITLE_PATTERN } = {}) {
  const broad = new RegExp(broadPattern, "i");
  const vocabulary = interests.map((direction) => ({ id: direction.id,
    terms: [...new Set(direction.includeKeywords || [])].map((term) => ({ term, match: normalized(term) })).filter((item) => item.match) }));
  const unique = new Map();
  for (const record of records) {
    const id = String(record.canonicalId || record.id || "").trim().toLowerCase();
    if (!id || typeof record.title !== "string" || !record.title.trim()) throw new Error("Every catalog record needs a canonicalId/id and title");
    const rawCategories = record.categoriesSeen ?? record.categories ?? record.category ?? [];
    const categories = typeof rawCategories === "string" ? [rawCategories] : rawCategories;
    if (!Array.isArray(categories) || categories.some((category) => typeof category !== "string" || !category.trim())) {
      throw new Error(`Catalog categories must be a string or non-empty strings: ${id}`);
    }
    if (!unique.has(id)) unique.set(id, { canonicalId: id, title: record.title, categories: [] });
    const entry = unique.get(id);
    entry.categories = [...new Set([...entry.categories, ...categories.map((category) => category.trim())])];
  }
  const matched = [];
  const unmatched = [];
  for (const record of unique.values()) {
    const title = ` ${normalized(record.title)} `;
    const keywordMatches = vocabulary.flatMap((direction) => {
      const terms = direction.terms.filter((term) => title.includes(` ${term.match} `)).map((item) => item.term);
      return terms.length ? [{ directionId: direction.id, terms }] : [];
    });
    const broadMatch = broad.test(record.title);
    if (broadMatch || keywordMatches.length) matched.push({ ...record, broadMatch, keywordMatches });
    else unmatched.push(record);
  }
  const buckets = new Map();
  for (const record of unmatched) {
    for (const category of record.categories.length ? record.categories : ["uncategorized"]) {
      if (!buckets.has(category)) buckets.set(category, []);
      buckets.get(category).push(record);
    }
  }
  const score = (record) => createHash("sha256").update(`${seed}:${record.canonicalId}`).digest("hex");
  const queues = [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([, rows]) => rows.sort((a, b) => score(a).localeCompare(score(b))));
  const sampled = new Map();
  while (sampled.size < sampleSize && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      while (queue.length && sampled.has(queue[0].canonicalId)) queue.shift();
      if (queue.length && sampled.size < sampleSize) { const row = queue.shift(); sampled.set(row.canonicalId, row); }
    }
  }
  return { counts: { inputOccurrences: records.length, uniqueRecords: unique.size,
    broadMatches: matched.filter((row) => row.broadMatch).length,
    additionalKeywordMatches: matched.filter((row) => !row.broadMatch).length,
    matched: matched.length, unmatched: unmatched.length },
  matched, unmatchedSample: [...sampled.values()], sampleSeed: seed,
  boundary: "Lexical discovery only. Matches are not accepted papers; the category-balanced sample is for manual inspection, not a recall estimate." };
}
