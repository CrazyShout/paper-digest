import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

export async function resolveIdeaAuditArtifact(root, relativePath, label) {
  if (!/^content\/idea-audits\/[a-z0-9][a-z0-9-]*\.json$/.test(relativePath || "")) {
    throw new Error(`${label} must link a JSON artifact inside content/idea-audits.`);
  }

  const auditRoot = path.join(root, "content", "idea-audits");
  const absolutePath = path.resolve(root, relativePath);
  const fileStat = await lstat(absolutePath);
  if (fileStat.isSymbolicLink()) {
    throw new Error(`${label} cannot be a symbolic link.`);
  }

  const [resolvedRoot, resolvedTarget] = await Promise.all([
    realpath(auditRoot),
    realpath(absolutePath)
  ]);
  const traversal = path.relative(resolvedRoot, resolvedTarget);
  if (!traversal || traversal.startsWith(`..${path.sep}`) || traversal === ".." || path.isAbsolute(traversal)) {
    throw new Error(`${label} must stay inside content/idea-audits.`);
  }

  return resolvedTarget;
}
