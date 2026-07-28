import { createHash } from "node:crypto";

function sha256(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

export function reviewCenterFingerprint(center) {
  return sha256(center).slice(0, 20);
}

export function reviewSnapshotFingerprint(review) {
  const searchAudit = review?.searchAudit || {};
  const {
    independentReview: _independentReview,
    ...auditedSearch
  } = searchAudit;
  return sha256({
    ...review,
    searchAudit: auditedSearch
  });
}
