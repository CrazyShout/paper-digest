import { commentValidationError } from "./comment-contract.js";

// Resolve only after the full comment has been persisted somewhere. Callers
// must retain their draft if both the remote service and local storage fail.
export async function saveComment(note, { endpoint, persistLocal, fetchImpl = fetch }) {
  const validationError = commentValidationError(note);
  if (validationError) throw new Error(validationError);

  if (endpoint) {
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(note)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.comment?.text !== note.text) throw new Error("Incomplete comment response");
      return { mode: "remote", comment: data.comment };
    } catch {
      // Preserve the full input locally when synchronization is unavailable.
    }
  }

  const comment = { ...note, id: `local-${crypto.randomUUID()}` };
  await persistLocal(comment);
  return { mode: "local", comment };
}
