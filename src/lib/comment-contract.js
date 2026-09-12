export const MAX_COMMENT_LENGTH = 1200;

export function validDigestId(value) {
  return typeof value === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}(?:-[a-z0-9-]+)?$/.test(value);
}

export function commentValidationError(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Invalid comment payload";
  if (!validDigestId(payload.digestId)) return "Invalid digestId";
  if (typeof payload.text !== "string" || !payload.text.trim()) return "Empty comment";
  if (payload.text.trim().length > MAX_COMMENT_LENGTH) return `Comment exceeds ${MAX_COMMENT_LENGTH} characters`;
  return "";
}
