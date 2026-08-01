import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ideaCenterSnapshotFingerprint,
  ideaDirectionSnapshotFingerprint,
  ideaSnapshotFingerprint
} from "../src/lib/idea-fingerprint.js";

const direction = {
  id: "example",
  ideas: [
    {
      id: "idea",
      title: "Testable idea",
      evidence: [{ url: "https://example.com/paper" }],
      blindReview: {
        round: 1,
        reviewers: [{ overall: 10 }]
      }
    }
  ],
  panelReview: {
    decision: "passed"
  }
};

test("direction fingerprints ignore mutable review metadata", () => {
  const original = ideaDirectionSnapshotFingerprint(direction);
  const changedReview = structuredClone(direction);
  changedReview.ideas[0].blindReview.reviewers[0].overall = 8;
  changedReview.panelReview.decision = "revise";

  assert.equal(ideaDirectionSnapshotFingerprint(changedReview), original);
});

test("Idea fingerprints bind content but ignore blind-review metadata", () => {
  const original = ideaSnapshotFingerprint(direction.ideas[0]);
  const changedReview = structuredClone(direction.ideas[0]);
  changedReview.blindReview.reviewers[0].overall = 7;
  const changedContent = structuredClone(direction.ideas[0]);
  changedContent.title = "Revised idea";

  assert.equal(ideaSnapshotFingerprint(changedReview), original);
  assert.notEqual(ideaSnapshotFingerprint(changedContent), original);
});

test("direction fingerprints change when idea content or evidence changes", () => {
  const original = ideaDirectionSnapshotFingerprint(direction);
  const changedIdea = structuredClone(direction);
  changedIdea.ideas[0].title = "Changed idea";
  const changedEvidence = structuredClone(direction);
  changedEvidence.ideas[0].evidence[0].url = "https://example.com/other-paper";

  assert.notEqual(ideaDirectionSnapshotFingerprint(changedIdea), original);
  assert.notEqual(ideaDirectionSnapshotFingerprint(changedEvidence), original);
});

test("center fingerprints bind direction reviews but ignore final review metadata", () => {
  const center = {
    version: 2,
    directions: [direction],
    finalReview: {
      decision: "passed"
    }
  };
  const original = ideaCenterSnapshotFingerprint(center);
  const changedFinalReview = structuredClone(center);
  changedFinalReview.finalReview.decision = "revise";
  const changedPanelReview = structuredClone(center);
  changedPanelReview.directions[0].panelReview.decision = "revise";

  assert.equal(ideaCenterSnapshotFingerprint(changedFinalReview), original);
  assert.notEqual(ideaCenterSnapshotFingerprint(changedPanelReview), original);
});
