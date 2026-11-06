import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewSnapshotFingerprint} from '../../../src/lib/review-fingerprint.js';
for (const group of process.argv.slice(2)) {
  const artifactPath = `docs/review-foundations/2026-11-06/independent-review/${group}-round1.json`;
  const bytes = fs.readFileSync(artifactPath);
  const artifact = JSON.parse(bytes);
  for (const verdict of artifact.reviews || artifact.directions) {
    const file = `content/reviews/${verdict.directionId}.json`;
    const review = JSON.parse(fs.readFileSync(file));
    const fingerprint = reviewSnapshotFingerprint(review);
    if ((verdict.verdict || verdict.outcome) !== 'PASS' || fingerprint !== (verdict.snapshotFingerprint || verdict.reviewSnapshotFingerprint || verdict.finalReviewSnapshotFingerprint)) throw Error(`Stale or failed approval: ${file}`);
    review.searchAudit.independentReview = {
      status: 'passed', completedAt: '2026-11-06', reviewers: 1, rounds: 1, finalOutcome: 'passed',
      finalFinding: '本轮新增经典工作、综述阅读路径、引文定位及增量审计已由未参与撰写的审阅者核对；先前同日复核的未改正文沿用原记录。未运行模型实验。',
      reviewerAgentId: artifact.reviewer || artifact.reviewerAgentId || `/root/foundations_review_${group}`,
      artifactPath, artifactSha256: createHash('sha256').update(bytes).digest('hex'),
      snapshotFingerprint: fingerprint, assurance: 'same-family provisional'
    };
    fs.writeFileSync(file, JSON.stringify(review,null,2)+'\n');
    console.log(verdict.directionId, fingerprint);
  }
}
