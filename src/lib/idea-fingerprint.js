import { createHash } from "node:crypto";

function sha256(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

export function ideaArtifactSnapshotFingerprint(artifact) {
  return sha256(artifact);
}

function ideaWithoutReviewMetadata(idea) {
  const {
    blindReview: _blindReview,
    ...ideaContent
  } = idea;
  return ideaContent;
}

function directionWithoutReviewMetadata(direction) {
  const {
    panelReview: _panelReview,
    ...directionContent
  } = direction;

  return {
    ...directionContent,
    ideas: (directionContent.ideas || []).map(ideaWithoutReviewMetadata)
  };
}

export function ideaSnapshotFingerprint(idea) {
  return sha256(ideaWithoutReviewMetadata(idea));
}

export function ideaDirectionSnapshotFingerprint(direction) {
  return sha256(directionWithoutReviewMetadata(direction));
}

export function ideaCenterSnapshotFingerprint(center) {
  const {
    finalReview: _finalReview,
    ...centerContent
  } = center;
  return sha256(centerContent);
}

export function reviewedDirectionArtifactFingerprint(direction, artifacts) {
  return sha256({
    direction,
    artifacts: [...artifacts]
      .map(({ path, fingerprint }) => ({ path, fingerprint }))
      .sort((left, right) => left.path.localeCompare(right.path))
  });
}

export function reviewedCenterArtifactFingerprint(center, directionFingerprints) {
  const {
    finalReview: _finalReview,
    ...centerContent
  } = center;

  return sha256({
    center: centerContent,
    directions: [...directionFingerprints]
      .map(({ directionId, fingerprint }) => ({ directionId, fingerprint }))
      .sort((left, right) => left.directionId.localeCompare(right.directionId))
  });
}
