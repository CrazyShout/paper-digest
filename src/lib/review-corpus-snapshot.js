import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { reviewSnapshotFingerprint } from "./review-fingerprint.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// Historical retrieval counts belong to a particular corpus. A changed review
// must use today's corpus again; it cannot inherit an earlier snapshot binding.
export function createReviewCorpusResolver(config, root = process.cwd()) {
  let snapshot;
  let frozen;
  let directory;
  if (config) {
    if (typeof config.file !== "string" || !/^[a-f0-9]{64}$/.test(config.sha256 || "")) {
      throw new Error("Invalid review corpus snapshot configuration");
    }
    const bytes = readFileSync(path.resolve(root, config.file));
    if (sha256(bytes) !== config.sha256) throw new Error("Review corpus snapshot hash mismatch");
    snapshot = JSON.parse(gunzipSync(bytes, { maxOutputLength: 10_000_000 }).toString("utf8"));
    if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.papers)
      || !snapshot.boundReviews || typeof snapshot.boundReviews !== "object") {
      throw new Error("Invalid review corpus snapshot schema");
    }
    const seen = new Set();
    frozen = snapshot.papers.map((paper) => {
      if (!/^[a-z0-9-]+\.md$/.test(paper.file) || seen.has(paper.file)
        || typeof paper.markdown !== "string" || sha256(paper.markdown) !== paper.sha256) {
        throw new Error("Invalid or duplicate frozen paper entry");
      }
      seen.add(paper.file);
      const match = paper.markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
      if (!match) throw new Error(`Missing frozen frontmatter: ${paper.file}`);
      const data = JSON.parse(match[1]);
      if (`${data.id}.md` !== paper.file) throw new Error(`Frozen paper id mismatch: ${paper.file}`);
      return { file: paper.file, data, body: match[2], id: data.id };
    });
  }

  function close() {
    if (directory) rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  }

  return {
    resolve(review, papers, corpusPath) {
      if (!snapshot || snapshot.boundReviews[review.id] !== reviewSnapshotFingerprint(review)) {
        return { papers, corpusPath, frozen: false };
      }
      if (!directory) {
        directory = mkdtempSync(path.join(tmpdir(), "paper-digest-review-corpus-"));
        for (const paper of snapshot.papers) {
          writeFileSync(path.join(directory, paper.file), paper.markdown);
        }
      }
      return { papers: frozen, corpusPath: directory, frozen: true };
    },
    close
  };
}
