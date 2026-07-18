import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateIdeaScore,
  getIdeaCenter,
  getInterestConfig
} from "../src/lib/content.js";

test("idea center covers every configured research direction", async () => {
  const [center, interests] = await Promise.all([getIdeaCenter(), getInterestConfig()]);
  const directionIds = center.directions.map((direction) => direction.id).sort();
  const configuredIds = interests.interests.map((interest) => interest.id).sort();

  assert.deepEqual(directionIds, configuredIds);
  assert.equal(new Set(directionIds).size, directionIds.length);
});

test("ready directions pass every hard gate before publishing ideas", async () => {
  const center = await getIdeaCenter();
  const thresholds = new Map(center.workflow.gates.map((gate) => [gate.id, gate.threshold]));
  const readyDirections = center.directions.filter((direction) => direction.status === "ready");

  assert.ok(readyDirections.length > 0);
  for (const direction of readyDirections) {
    assert.ok(direction.ideas.length > 0);
    assert.deepEqual(
      new Set(direction.explorationRun.gates.map((gate) => gate.id)),
      new Set(thresholds.keys())
    );
    for (const gate of direction.explorationRun.gates) {
      assert.ok(gate.score >= thresholds.get(gate.id));
    }
  }
});

test("idea scores are reproducible from the shared rubric", async () => {
  const center = await getIdeaCenter();

  for (const direction of center.directions) {
    for (const idea of direction.ideas || []) {
      const computed = calculateIdeaScore(center.scoring, idea.score.dimensions);
      assert.equal(computed, idea.score.overall, idea.id);
      assert.equal(idea.computedScore, idea.score.overall, idea.id);
    }
  }
});

test("idea evidence is primary-source heavy and local reports resolve", async () => {
  const center = await getIdeaCenter();

  for (const direction of center.directions.filter((item) => item.status === "ready")) {
    const uniqueSources = new Set();
    for (const idea of direction.ideas) {
      assert.ok(idea.evidence.length >= 3 && idea.evidence.length <= 5, idea.id);
      for (const source of idea.evidence) {
        assert.match(source.url, /^https:\/\//);
        uniqueSources.add(source.url);
        if (source.localPaperId) {
          assert.match(source.localLink, /^papers\/.+\/$/, source.localPaperId);
        }
      }
    }
    assert.equal(uniqueSources.size, direction.explorationRun.coreEvidenceCount);
  }
});

test("planned directions do not present unreviewed ideas", async () => {
  const center = await getIdeaCenter();

  for (const direction of center.directions.filter((item) => item.status === "planned")) {
    assert.equal(direction.ideas?.length || 0, 0);
    assert.equal(direction.explorationRun, undefined);
  }
});
