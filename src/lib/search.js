export const SEARCH_KINDS = [
  { id: "all", label: "全部" },
  { id: "paper", label: "论文" },
  { id: "digest", label: "简报" },
  { id: "review", label: "综述" },
  { id: "idea", label: "Idea" }
];

export function normalizeSearchText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN");
}

export function prepareSearchRecords(records) {
  return records.map((record) => ({
    ...record,
    searchTitle: normalizeSearchText(record.title),
    searchDescription: normalizeSearchText(record.description),
    searchText: normalizeSearchText([
      record.title,
      record.description,
      record.content,
      ...(record.breadcrumbs || [])
    ].join(" "))
  }));
}

export function searchRecords(records, search, kind = "all") {
  const query = normalizeSearchText(search).trim();
  const terms = query.split(/\s+/).filter(Boolean);
  const wordQuery = /^[a-z0-9][a-z0-9 ._-]*$/.test(query);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const phrasePattern = wordQuery
    ? new RegExp(`(^|[^\\p{L}\\p{N}_])${escapedQuery}($|[^\\p{L}\\p{N}_])`, "u")
    : null;
  const matches = [];

  for (const record of records) {
    if (kind !== "all" && record.kind !== kind) continue;
    if (!terms.length) {
      if (kind !== "all" || record.featured) matches.push({ record, score: 0 });
      continue;
    }
    if (!terms.every((term) => record.searchText.includes(term))) continue;

    const title = record.searchTitle;
    const phraseMatch = phrasePattern?.exec(title);
    const wholePhrase = Boolean(phraseMatch);
    const score = title === query ? 1000
      : title.startsWith(query) && (!wordQuery || phraseMatch?.index === 0) ? 800
      : wholePhrase ? 700
      : title.includes(query) ? 600
      : terms.every((term) => title.includes(term)) ? 400
      : terms.filter((term) => title.includes(term)).length * 40
        + terms.filter((term) => record.searchDescription.includes(term)).length * 10;
    matches.push({ record, score });
  }

  // Stable ties preserve the source ordering for featured and archive entries.
  return matches.sort((a, b) => b.score - a.score).map(({ record }) => record);
}
