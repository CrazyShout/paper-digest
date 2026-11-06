const unique = (values) => [...new Set(values)];
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

export function validateDirectionReading(reading, { tags, digests, papers }) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  check(reading?.version === 1, "unsupported direction reading version");
  check(/^\d{4}-\d{2}-\d{2}$/.test(reading?.updatedAt || ""), "missing reading update date");
  const tagIds = new Set(tags.map((tag) => tag.id));
  const publicIds = new Set(digests.flatMap((digest) => digest.papers.map((paper) => paper.id)));
  const paperMap = new Map(papers.map((paper) => [paper.id, paper]));
  const seen = new Set();
  for (const entry of reading.directions || []) {
    check(tagIds.has(entry.id) && !seen.has(entry.id), `unknown or duplicate direction: ${entry.id}`);
    seen.add(entry.id);
    const issue = digests.find((digest) => digest.id === entry.issueId);
    check(issue?.papers.some((paper) => paper.tags.includes(entry.id)), `${entry.id}: issue does not cover this direction`);
    check(nonempty(entry.changeSummary), `${entry.id}: missing change summary`);
    for (const key of ["comparisons", "connections", "followUps"]) {
      check(Array.isArray(entry[key]), `${entry.id}: ${key} must be a list`);
      for (const item of entry[key] || []) {
        const ids = item.paperIds || [];
        check(ids.length > 0 && unique(ids).length === ids.length
          && ids.every((id) => publicIds.has(id) && paperMap.has(id)), `${entry.id}: unresolved ${key} papers`);
        check(ids.some((id) => paperMap.get(id)?.tags.includes(entry.id)), `${entry.id}: ${key} has no paper in this direction`);
        check(nonempty(key === "followUps" ? item.text : item.reason), `${entry.id}: missing ${key} explanation`);
        if (key === "comparisons") check(ids.length >= 2, `${entry.id}: comparison needs two papers`);
        if (key === "connections") {
          check(tagIds.has(item.targetDirectionId) && item.targetDirectionId !== entry.id,
            `${entry.id}: invalid connected direction`);
          check(nonempty(item.boundary), `${entry.id}: missing transfer boundary`);
        }
      }
    }
  }
  return errors;
}

export function buildDirectionReading({ tags, digests, papers, reading }) {
  const errors = validateDirectionReading(reading, { tags, digests, papers });
  if (errors.length) throw new Error(`Direction reading: ${errors.join("; ")}`);
  const paperMap = new Map(papers.map((paper) => [paper.id, paper]));
  const editorial = new Map(reading.directions.map((entry) => [entry.id, entry]));
  const sortedIssues = [...digests].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return tags.map((tag) => {
    const issues = sortedIssues.flatMap((digest) => {
      const relevant = unique(digest.papers.filter((paper) => paper.tags.includes(tag.id)).map((paper) => paper.id));
      if (!relevant.length) return [];
      const entries = relevant.map((id) => {
        const paper = paperMap.get(id) || digest.papers.find((item) => item.id === id);
        return { id, title: paper.title, comment: paper.comment, tags: paper.tags,
          sourceLinks: paper.sourceLinks, revisionId: paper.revisionId,
          primary: paper.tags[0] === tag.id };
      });
      return [{ id: digest.id, date: digest.date, displayDate: digest.displayDate || digest.date,
        title: digest.title, papers: entries }];
    });
    const allPapers = new Map(issues.flatMap((issue) => issue.papers).map((paper) => [paper.id, paper]));
    const latest = issues[0] || null;
    const current = issues.find((issue) => issue.id === sortedIssues[0]?.id);
    return { ...tag, issues, latest, editorial: editorial.get(tag.id) || null,
      paperCount: allPapers.size,
      primaryCount: [...allPapers.values()].filter((paper) => paper.primary).length,
      currentCount: current?.papers.length || 0,
      currentPrimaryCount: current?.papers.filter((paper) => paper.primary).length || 0 };
  });
}

export function readerFeedbackUrl({ direction, issueId, pageUrl } = {}) {
  const query = new URLSearchParams({
    title: ["读者反馈", direction, issueId].filter(Boolean).join(" · "),
    body: ["想补充的论文、纠错或阅读建议：", "", "论文链接 / 具体位置：", "",
      direction ? `方向：${direction}` : "", issueId ? `简报：${issueId}` : "", pageUrl ? `页面：${pageUrl}` : ""].filter((line) => line !== false).join("\n")
  });
  return `https://github.com/CrazyShout/paper-digest/issues/new?${query}`;
}
