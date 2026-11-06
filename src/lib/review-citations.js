// Keep audited Markdown intact; only the reader-facing projection uses numbers.
export function projectReviewCitations(markdown = "", references = [], { links = true } = {}) {
  const numbers = new Map(references.map((reference, index) => [reference.id, index + 1]));
  const tokens = /`[^`\n]*`|\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$|!?\[[^\]\n]*\]\([^\n)]*\)|\[([^\]\n]+)\]/g;
  return String(markdown).replace(tokens, (match, citation, offset, input) => {
    if (!citation) return match;
    const prefix = input.slice(0, offset).match(/\\+$/)?.[0] || "";
    if (prefix.length % 2) return match;
    const ids = citation.split(/[,，]/).map((id) => id.trim());
    if (!ids.length || ids.some((id) => !numbers.has(id))) return match;
    if (!links) return `[${ids.map((id) => numbers.get(id)).join(", ")}]`;
    return `(${ids.map((id) => `[${numbers.get(id)}](#reference-${encodeURIComponent(id)})`).join(", ")})`;
  });
}
