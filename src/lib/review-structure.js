export const REVIEW_COVERAGE_KINDS = [
  "scope", "evolution", "taxonomy", "evidence", "challenges", "outlook"
];

export function reviewStructureErrors(review, historicalIds = []) {
  const errors = [];
  const article = review.structureVersion === 2;
  if (review.structureVersion !== undefined && !article) errors.push("unsupported structureVersion");
  const sections = Array.isArray(review.sections) ? review.sections : [];
  if (!sections.length) errors.push("sections must not be empty");
  if (!article && sections.length !== REVIEW_COVERAGE_KINDS.length) errors.push("legacy reviews require six sections");
  const ids = new Set();
  const coverage = new Set();
  const reserved = new Set(["references", "referencesTitle", "search-audit", "searchAuditTitle",
    ...(review.references || []).map(reference => `reference-${reference.id}`)]);
  if (!article) ["research-questions", "researchQuestionsTitle", "takeaways", "takeawaysTitle"].forEach(id => reserved.add(id));
  for (const section of sections) {
    for (const field of ["id", "title", "body", ...(!article ? ["kind", "thesis"] : [])]) {
      if (typeof section[field] !== "string" || !section[field].trim()) errors.push(`section ${field} must be non-empty`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(section.id || "")) errors.push(`invalid section id: ${section.id}`);
    for (const id of [section.id, `${section.id}-title`]) {
      if (ids.has(id) || reserved.has(id)) errors.push(`duplicate or reserved anchor: ${id}`);
      ids.add(id);
    }
    const kinds = article ? section.covers : [section.kind];
    if (!Array.isArray(kinds) || !kinds.length || new Set(kinds).size !== kinds.length) {
      errors.push(`${section.id}: covers must contain distinct review dimensions`);
      continue;
    }
    for (const kind of kinds) {
      if (!REVIEW_COVERAGE_KINDS.includes(kind)) errors.push(`unsupported coverage dimension: ${kind}`);
      if (!article && coverage.has(kind)) errors.push(`duplicate legacy section kind: ${kind}`);
      coverage.add(kind);
    }
  }
  for (const kind of REVIEW_COVERAGE_KINDS) if (!coverage.has(kind)) errors.push(`missing review coverage: ${kind}`);
  if (article) {
    const aliases = review.legacyAnchors;
    if (!aliases || typeof aliases !== "object" || Array.isArray(aliases)) {
      errors.push("legacyAnchors must map historical anchors to current sections");
    } else {
      for (const [alias, target] of Object.entries(aliases)) {
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(alias) || ids.has(alias) || reserved.has(alias)) errors.push(`invalid or duplicate legacy anchor: ${alias}`);
        if (!sections.some(section => section.id === target)) errors.push(`missing legacy anchor target: ${target}`);
      }
      for (const id of historicalIds) {
        if (!ids.has(id) && !Object.hasOwn(aliases, id)) errors.push(`missing historical anchor: ${id}`);
      }
    }
  }
  return errors;
}

export function reviewSectionAliases(review, sectionId) {
  return Object.entries(review.legacyAnchors || {}).filter(([, target]) => target === sectionId).map(([id]) => id);
}

export function reviewFigureDimensionErrors(svg, figure) {
  const root = String(svg).match(/<svg\b([^>]*)>/i)?.[1] || "";
  const attributes = Object.fromEntries([...root.matchAll(/\b(width|height|viewBox)\s*=\s*(["'])(.*?)\2/g)].map(match => [match[1], match[3]]));
  const errors = [];
  for (const dimension of ["width", "height"]) {
    const value = attributes[dimension];
    if (!Number.isInteger(figure[dimension]) || figure[dimension] <= 0 || !/^\d+(?:px)?$/.test(value || "")
      || Number.parseInt(value, 10) !== figure[dimension]) errors.push(`${dimension} does not match root SVG`);
  }
  const box = (attributes.viewBox || "").trim().split(/[\s,]+/).map(Number);
  if (box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0
    || Math.abs(box[2] / box[3] - figure.width / figure.height) > 0.000001) errors.push("viewBox aspect ratio does not match dimensions");
  return errors;
}
