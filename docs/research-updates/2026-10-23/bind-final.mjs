import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {reviewSnapshotFingerprint} from '../../../src/lib/review-fingerprint.js';

const dir = 'docs/research-updates/2026-10-23';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = async path => JSON.parse(await fs.readFile(path, 'utf8'));
const integrationPath = `${dir}/review-integration-round1.json`;
const integration = await read(integrationPath);
if (!['PASS', 'passed'].includes(integration.finalOutcome) || integration.openFindings.length) throw new Error('Integration approval missing');
for (const input of integration.declaredInputs) {
  if (hash(await fs.readFile(input.path)) !== input.sha256) throw new Error(`Input drift: ${input.path}`);
}
const artifactPaths = [
  `${dir}/review-testing-prior-round1.json`,
  `${dir}/review-policy-binding-round2.json`,
  `${dir}/review-representation-round2.json`
];
const approved = new Map();
function collect(value, artifactPath) {
  if (!value || typeof value !== 'object') return;
  if (value.path && value.sha256 && /^(content\/papers|public\/assets\/papers)\//.test(value.path)) {
    approved.set(value.path, {path: value.path, sha256: value.sha256, artifactPath});
  }
  for (const item of Object.values(value)) collect(item, artifactPath);
}
for (const artifactPath of artifactPaths) {
  const artifact = await read(artifactPath);
  const status = artifact.verdict || artifact.finalDisposition || artifact.status;
  if (!['PASS', 'passed'].includes(status)) throw new Error(`No pass: ${artifactPath}`);
  collect(artifact, artifactPath);
}
const digestPath = 'content/digests/2026-10-23.md';
const digest = JSON.parse((await fs.readFile(digestPath, 'utf8')).split('---')[1]);
const required = new Set(digest.papers.map(id => `content/papers/${id}.md`));
for (const path of [...required]) {
  const text = await fs.readFile(path, 'utf8');
  for (const match of text.matchAll(/!\[[^\]]*\]\(\.\.\/\.\.\/assets\/papers\/([^\s)]+)\)/g)) required.add(`public/assets/papers/${match[1]}`);
}
for (const path of required) {
  const item = approved.get(path);
  if (!item || hash(await fs.readFile(path)) !== item.sha256) throw new Error(`Missing/stale report/image approval: ${path}`);
}
const integrationSha = hash(await fs.readFile(integrationPath));
for (const item of integration.directionReviews) {
  const review = await read(item.path);
  if (reviewSnapshotFingerprint(review) !== item.reviewSnapshotFingerprint) throw new Error(`Review drift: ${item.path}`);
  review.searchAudit.independentReview = {
    status: 'passed', completedAt: '2026-10-23', reviewers: 1, rounds: 1, finalOutcome: 'passed',
    finalFinding: 'Independent current-corpus audit verified candidate/count closure and unchanged substantive references, narrative and external review dates. Same-family provisional; no new external full-review claim.',
    reviewerAgentId: integration.reviewerAgentId, artifactPath: integrationPath, artifactSha256: integrationSha,
    snapshotFingerprint: item.reviewSnapshotFingerprint, assurance: 'same-family provisional'
  };
  if (reviewSnapshotFingerprint(review) !== item.reviewSnapshotFingerprint) throw new Error('Approval mutation altered reviewed content');
  await fs.writeFile(item.path, `${JSON.stringify(review, null, 2)}\n`);
}
const auditPath = 'content/digest-audits/2026-10-23.json';
const audit = await read(auditPath);
const {independentReview: previousApproval, ...content} = audit;
const contentHash = hash(JSON.stringify(content));
if (contentHash !== integration.bindingRules.digestAuditContentFingerprint.sha256) throw new Error('Digest audit content drift');
audit.independentReview = {finalOutcome: 'passed', reviewerAgentId: integration.reviewerAgentId, completedAt: integration.completedAt,
  finalFinding: integration.finalFinding, artifactPath: integrationPath, artifactSha256: integrationSha,
  approvedContentSha256: contentHash, contentFingerprintAlgorithm: 'sha256-json-stringify-without-independentReview',
  assurance: 'same-family provisional', paperReviewArtifacts: artifactPaths};
await fs.writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
const finalPaths = new Set([...required, digestPath, auditPath, 'content/research-landscape.json', 'content/idea-center.json', 'content/reported-papers.md', ...integration.directionReviews.map(r => r.path)]);
const files = [];
for (const path of [...finalPaths].sort()) files.push({path, sha256: hash(await fs.readFile(path)), approvalArtifact: approved.get(path)?.artifactPath || integrationPath});
const artifacts = [];
for (const path of [...artifactPaths, integrationPath]) artifacts.push({path, sha256: hash(await fs.readFile(path))});
await fs.writeFile(`${dir}/final-bindings.json`, `${JSON.stringify({issue: '2026-10-23', boundAt: new Date().toISOString(), assurance: 'same-family provisional', reportCount: digest.papers.length, citedFigureCount: required.size - digest.papers.length, reviewCount: integration.directionReviews.length, approvalOnlyChanges: ['searchAudit.independentReview', 'digestAudit.independentReview'], digestAuditContentSha256: contentHash, artifacts, files}, null, 2)}\n`);
console.log(`Bound ${digest.papers.length} reports, ${required.size - digest.papers.length} figures, ${integration.directionReviews.length} reviews.`);
