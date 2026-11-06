import { normalizeCanonicalId } from "./review-audit.js";

const text = (value) => typeof value === "string" && value.trim().length > 0;
const list = (value) => Array.isArray(value) && value.length > 0 && value.every(text);
const url = (value) => typeof value === "string" && /^https?:\/\/[^\s]+$/.test(value);
const date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "")
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

// Checks evidence links and coverage accounting; semantic adequacy remains a review task.
export function validateFoundationsAudit(review, { requiredFrom, today } = {}) {
  const audit = review.searchAudit?.foundationsAudit;
  if (!audit && (!requiredFrom || review.reviewedAt < requiredFrom)) return [];
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  if (!audit || typeof audit !== "object") return ["missing foundationsAudit"];
  const references = new Map((review.references || []).map((item) => [item.id, item]));
  const included = new Set([...references.values()].map((item) => normalizeCanonicalId(item.canonicalId)));
  const excluded = new Set((review.searchAudit.excludedCandidates || []).map((item) => normalizeCanonicalId(item.canonicalId)));
  check(date(audit.auditedAt)
    && audit.auditedAt <= (today || review.reviewedAt)
    && audit.auditedAt <= review.reviewedAt, "invalid foundations audit date");
  check(text(audit.scope), "missing foundation coverage scope");
  check(list(audit.limitations), "missing foundation coverage limits");
  const anchors = Array.isArray(audit.surveyAnchors) ? audit.surveyAnchors : [];
  const anchorIds = new Set(anchors.map((anchor) => anchor.referenceId));
  check(anchorIds.size === anchors.length, "duplicate survey anchors");
  for (const anchor of anchors) {
    const reference = references.get(anchor.referenceId);
    check(["survey", "tutorial"].includes(reference?.publicationType), `survey anchor is not a cited survey: ${anchor.referenceId}`);
    check(["established", "frontier"].includes(anchor.role), `invalid survey role: ${anchor.referenceId}`);
    check(list(anchor.sectionsRead) && text(anchor.use) && text(anchor.coverageCutoff), `survey reading evidence incomplete: ${anchor.referenceId}`);
  }
  const gap = audit.surveyGap;
  const documentedGap = text(gap?.reason) && list(gap?.queries) && list(gap?.primaryUrls) && gap.primaryUrls.every(url);
  check((anchors.some((item) => item.role === "established")
    && anchors.some((item) => item.role === "frontier")) || documentedGap,
  "need complementary survey anchors or a documented survey gap");
  const milestones = Array.isArray(audit.milestones) ? audit.milestones : [];
  check(milestones.length > 0, "missing method and benchmark milestones");
  for (const item of milestones) {
    check(references.has(item.referenceId) && text(item.branch) && text(item.role) && text(item.reason),
      `milestone evidence incomplete: ${item.referenceId}`);
  }
  const coverage = Array.isArray(audit.coverage) ? audit.coverage : [];
  check(coverage.length > 0, "missing branch coverage comparison");
  for (const branch of coverage) {
    check(text(branch.branch) && text(branch.rationale) && ["covered", "bounded", "gap"].includes(branch.status), "incomplete branch coverage");
    check(Array.isArray(branch.foundationalReferenceIds) && branch.foundationalReferenceIds.every((id) => references.has(id)), `unresolved milestone in ${branch.branch}`);
    check(Array.isArray(branch.surveyReferenceIds) && branch.surveyReferenceIds.every((id) => anchorIds.has(id)), `unresolved survey in ${branch.branch}`);
    if (branch.status === "covered") check(branch.foundationalReferenceIds?.length > 0 && branch.surveyReferenceIds?.length > 0,
      `covered branch lacks foundations or surveys: ${branch.branch}`);
  }
  const traces = Array.isArray(audit.citationTrace) ? audit.citationTrace : [];
  check(traces.length > 0, "missing backward citation tracing");
  for (const trace of traces) {
    const id = normalizeCanonicalId(trace.candidateCanonicalId);
    check(anchorIds.has(trace.surveyReferenceId) && text(trace.sourceLocator) && url(trace.primaryUrl) && text(trace.reason), "incomplete citation trace provenance");
    check(["existing", "included", "excluded"].includes(trace.disposition), `invalid trace disposition: ${id}`);
    check((trace.disposition === "excluded" ? excluded : included).has(id), `citation trace has no matching disposition: ${id}`);
  }
  return errors;
}
