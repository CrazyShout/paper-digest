import { extractArxivIds, extractDois } from "./review-audit.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  return typeof value === "string" && DATE.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function httpsUrl(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function validPublicationDate(value, basis) {
  if (basis === "issue" && /^\d{4}-\d{2}$/.test(value || "")) return validDate(`${value}-01`);
  return validDate(value);
}

export function sortedSurveyReadings(reading) {
  return [...(reading?.entries || [])].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
}

// Reading suggestions have their own dated evidence, separate from the article's
// historical source audit. All of this data is included in its review fingerprint.
export function surveyReadingErrors(reading, today) {
  const errors = [];
  if (!reading || !Array.isArray(reading.entries) || !reading.entries.length) {
    return ["surveyReading.entries must contain recent survey recommendations"];
  }
  if (!validDate(reading.checkedAt) || reading.checkedAt > today) errors.push("invalid checkedAt");
  const earliestYear = Number(reading.checkedAt?.slice(0, 4)) - 2;
  const ids = new Set();
  const canonicalIds = new Set();
  const aliases = new Set();
  const workIds = new Set();
  for (const entry of reading.entries) {
    const label = entry.id || "entry";
    if (!/^[a-z0-9-]+$/.test(entry.id || "") || ids.has(entry.id)) errors.push(`${label}: invalid or duplicate id`);
    ids.add(entry.id);
    const identity = entry.canonicalId?.normalize("NFKC").trim().toLowerCase();
    if (!/^(doi|arxiv):\S+$/.test(identity || "") || canonicalIds.has(identity)) errors.push(`${label}: invalid or duplicate canonicalId`);
    canonicalIds.add(identity);
    const destinations = [entry.canonicalId, entry.url, ...(entry.links || []).map(link => link.url)];
    const entryAliases = new Set([
      identity,
      ...extractArxivIds(...destinations).map(id => `arxiv:${id}`),
      ...extractDois(...destinations).map(id => `doi:${id}`)
    ].filter(Boolean));
    if ([...entryAliases].some(alias => aliases.has(alias))) errors.push(`${label}: duplicate DOI/arXiv identity`);
    for (const alias of entryAliases) aliases.add(alias);
    for (const field of ["title", "authors", "publicationLabel", "readingNote"]) {
      if (typeof entry[field] !== "string" || !entry[field].trim()) errors.push(`${label}: missing ${field}`);
    }
    if (!validPublicationDate(entry.publishedAt, entry.dateBasis) || entry.publishedAt > reading.checkedAt
      || Number(entry.publishedAt?.slice(0, 4)) < earliestYear) errors.push(`${label}: publication date outside recent window`);
    if (!["online", "conference", "preprint", "issue"].includes(entry.dateBasis)) errors.push(`${label}: invalid dateBasis`);
    if (!httpsUrl(entry.url) || !httpsUrl(entry.dateSource)) errors.push(`${label}: missing primary source URL`);
    for (const link of entry.links || []) {
      if (!httpsUrl(link.url) || !link.label?.trim()) errors.push(`${label}: invalid reading link`);
    }
    const citation = entry.citation;
    if (workIds.has(citation?.workId)) errors.push(`${label}: duplicate OpenAlex work`);
    workIds.add(citation?.workId);
    if (!citation || citation.provider !== "OpenAlex" || !/^W\d+$/.test(citation.workId || "")
      || !Number.isInteger(citation.count) || citation.count < 0
      || citation.checkedAt !== reading.checkedAt) errors.push(`${label}: invalid citation snapshot`);
    if (citation?.url !== `https://openalex.org/${citation?.workId}`) errors.push(`${label}: citation URL must match its work ID`);
  }
  if (JSON.stringify(reading.entries.map(entry => entry.id)) !== JSON.stringify(sortedSurveyReadings(reading).map(entry => entry.id))) {
    errors.push("entries must be ordered newest to oldest");
  }
  return errors;
}

export function surveyReadingSearchText(reading) {
  return (reading?.entries || []).map(entry => [
    "推荐综述阅读", entry.title, entry.authors, entry.publicationLabel,
    entry.publishedAt, entry.readingNote
  ].join(" ")).join(" ");
}
