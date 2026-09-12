import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { createReviewCorpusResolver } from "../src/lib/review-corpus-snapshot.js";
import { reviewSnapshotFingerprint } from "../src/lib/review-fingerprint.js";
import { localCorpusSearchSnapshot } from "../src/lib/review-audit.js";

const sha = (s) => createHash("sha256").update(s).digest("hex");

function fixture(t, edit = (value) => value) {
  const root = mkdtempSync(path.join(tmpdir(), "review-corpus-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const review = { id: "radar", searchAudit: { queryRuns: [{ query: "Doppler" }] } };
  const markdown = '---\n{"id":"sensor","tag":"radar"}\n---\nDoppler evidence.';
  const data = edit({ schemaVersion: 1, boundReviews: { radar: reviewSnapshotFingerprint(review) },
    papers: [{ file: "sensor.md", markdown, sha256: sha(markdown) }] });
  const bytes = gzipSync(JSON.stringify(data));
  writeFileSync(path.join(root, "snapshot.gz"), bytes);
  return { root, review, config: { file: "snapshot.gz", sha256: sha(bytes) } };
}

test("a bound historical review reruns rg on original bytes after corpus edits", (t) => {
  const { root, review, config } = fixture(t);
  const resolver = createReviewCorpusResolver(config, root);
  t.after(() => resolver.close());
  const current = [{ id: "sensor", tag: "radar", body: "rewritten without the search term" }];
  const result = resolver.resolve(review, current, root);
  assert.equal(result.frozen, true);
  assert.match(readFileSync(path.join(result.corpusPath, "sensor.md"), "utf8"), /Doppler evidence/);
  assert.deepEqual(localCorpusSearchSnapshot(result.papers, "radar", "Doppler", result), {
    rawHitPaperIds: ["sensor"], candidateLocalPaperIds: ["sensor"]
  });
});

test("a changed query or narrative cannot reuse an earlier corpus binding", (t) => {
  const { root, review, config } = fixture(t);
  const resolver = createReviewCorpusResolver(config, root);
  t.after(() => resolver.close());
  const current = [];
  for (const changed of [
    { ...review, abstract: "new claim" },
    { ...review, searchAudit: { queryRuns: [{ query: "new query" }] } }
  ]) {
    assert.deepEqual(resolver.resolve(changed, current, root), { papers: current, corpusPath: root, frozen: false });
  }
});

test("corrupt archives and unsafe or altered paper entries fail closed", (t) => {
  const f = fixture(t);
  assert.throws(() => createReviewCorpusResolver({ ...f.config, sha256: "0".repeat(64) }, f.root), /hash mismatch/);
  for (const edit of [
    (s) => { s.papers[0].file = "../escape.md"; return s; },
    (s) => { s.papers.push(s.papers[0]); return s; },
    (s) => { s.papers[0].markdown += "tampered"; return s; }
  ]) {
    const item = fixture(t, edit);
    assert.throws(() => createReviewCorpusResolver(item.config, item.root), /Invalid or duplicate/);
  }
});
