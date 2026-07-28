import { spawnSync } from "node:child_process";
import path from "node:path";
import { canonicalUrlHostname } from "./source-url.js";

export const LOCAL_CORPUS_RIPGREP_FLAGS = Object.freeze(["-l", "-i"]);

export function localCorpusRipgrepFlagsMatch(flags) {
  return Array.isArray(flags)
    && flags.length === LOCAL_CORPUS_RIPGREP_FLAGS.length
    && flags.every((flag, index) => flag === LOCAL_CORPUS_RIPGREP_FLAGS[index]);
}

export function normalizeCanonicalId(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

export function registerCanonicalAlias(aliasToPrimary, alias, primary) {
  const normalizedAlias = normalizeCanonicalId(alias);
  const normalizedPrimary = normalizeCanonicalId(primary);
  const existingPrimary = aliasToPrimary.get(normalizedAlias);
  if (existingPrimary && existingPrimary !== normalizedPrimary) {
    return false;
  }
  aliasToPrimary.set(normalizedAlias, normalizedPrimary);
  return true;
}

export function decodeCanonicalSourceText(value) {
  let decoded = String(value || "");
  for (let round = 0; round < 3; round += 1) {
    const next = decoded.replace(/%([0-9a-f]{2})/gi, (escape, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      return codePoint >= 0x20 && codePoint <= 0x7e
        ? String.fromCharCode(codePoint)
        : escape;
    });
    if (next === decoded) break;
    decoded = next;
  }
  return decoded.normalize("NFKC");
}

export function extractArxivIds(...values) {
  const ids = new Set();
  for (const value of values.filter(Boolean)) {
    const text = decodeCanonicalSourceText(value);
    const pattern = /arXiv:?\s*(\d{4}\.\d{4,5})(?:v\d+)?/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      ids.add(match[1]);
    }
    for (const urlMatch of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
      const candidate = urlMatch[0].replace(/[),.;\]]+$/g, "");
      try {
        const url = new URL(candidate);
        const hostname = canonicalUrlHostname(url);
        if (hostname !== "arxiv.org" && !hostname.endsWith(".arxiv.org")) {
          continue;
        }
        const pathname = decodeCanonicalSourceText(url.pathname);
        const pathMatch = pathname.match(
          /^\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?\/?$/i
        );
        if (pathMatch) ids.add(pathMatch[1]);
      } catch {
        // Malformed URLs are handled by the caller's URL validation.
      }
    }
  }

  return [...ids].sort();
}

export function extractDois(...values) {
  const dois = new Set();
  const text = values
    .filter(Boolean)
    .map(decodeCanonicalSourceText)
    .join(" ");
  const pattern = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    dois.add(match[0].replace(/[.,;]+$/g, "").toLowerCase());
  }

  return [...dois].sort();
}

export function unusedAuditedSourceFamilies(
  auditedSourceFamilies,
  querySourceFamilies,
  referenceSourceFamilies
) {
  const usedSourceFamilies = new Set([
    ...querySourceFamilies,
    ...referenceSourceFamilies
  ]);
  return [...auditedSourceFamilies].filter(
    (sourceFamily) => !usedSourceFamilies.has(sourceFamily)
  );
}

export function legacySearchAuditCountFields(searchAudit) {
  return [
    "candidateCount",
    "deduplicatedCount",
    "includedCount",
    "excludedCount"
  ].filter((field) => field in searchAudit);
}

export function missingSourceAttemptFamilies(
  configuredSourceFamilies,
  sourceAttempts
) {
  const attempted = new Set(
    sourceAttempts.map((attempt) => attempt.sourceFamily)
  );
  return [...configuredSourceFamilies].filter(
    (sourceFamily) => !attempted.has(sourceFamily)
  );
}

function paperTags(paper) {
  if (Array.isArray(paper.tags)) return paper.tags;
  const data = paper.data || paper;
  return [...new Set([
    data.tag,
    ...(Array.isArray(data.tags) ? data.tags : [])
  ].filter(Boolean))];
}

function ripgrepPaperIds(corpusPath, query) {
  const result = spawnSync(
    "rg",
    [...LOCAL_CORPUS_RIPGREP_FLAGS, "--", query, corpusPath],
    { encoding: "utf8" }
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      result.stderr?.trim() || `ripgrep exited with status ${result.status}`
    );
  }
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((file) => path.basename(file, ".md"))
    .sort();
}

export function localCorpusSearchSnapshot(
  papers,
  reviewId,
  query,
  { corpusPath = "" } = {}
) {
  let rawHitPaperIds;
  if (corpusPath) {
    rawHitPaperIds = ripgrepPaperIds(corpusPath, query);
  } else {
    const expression = new RegExp(query, "im");
    rawHitPaperIds = papers
      .filter((paper) => {
        const data = paper.data || Object.fromEntries(
          Object.entries(paper).filter(
            ([key]) => !["body", "link", "sourceLinks"].includes(key)
          )
        );
        const searchableText = [
          "---",
          JSON.stringify(data, null, 2),
          "---",
          paper.body || ""
        ].join("\n");
        return expression.test(searchableText);
      })
      .map((paper) => paper.id || paper.data?.id)
      .filter(Boolean)
      .sort();
  }

  const paperById = new Map(
    papers.map((paper) => [paper.id || paper.data?.id, paper])
  );
  const candidateLocalPaperIds = new Set();

  for (const paperId of rawHitPaperIds) {
    const paper = paperById.get(paperId);
    if (!paper) continue;
    const data = paper.data || paper;
    if (paperTags(paper).includes(reviewId)) {
      candidateLocalPaperIds.add(
        paper.revisionOf || data.revisionOf || paperId
      );
    }
  }

  return {
    rawHitPaperIds,
    candidateLocalPaperIds: [...candidateLocalPaperIds].sort()
  };
}
