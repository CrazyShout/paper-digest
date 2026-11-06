import { ideaArtifactSnapshotFingerprint } from "./idea-fingerprint.js";

export const EXPLORATION_DECISIONS = {
  pilot: "优先试验",
  develop: "继续展开",
  park: "暂存"
};

export function explorationSnapshotFingerprint(exploration) {
  const { review: _review, ...content } = exploration;
  return ideaArtifactSnapshotFingerprint(content);
}

export function validateExploration(exploration, { directionIds, paperIds = [] }) {
  function require(condition, message) {
    if (!condition) throw new Error(`Idea exploration: ${message}`);
  }
  const substantive = (value) => typeof value === "string" && value.trim().length > 0;
  const unique = (values) => new Set(values).size === values.length;
  require(exploration?.version === 1, "unsupported version");
  require(/^\d{4}-\d{2}-\d{2}$/.test(exploration.id), "invalid round ID");
  require(substantive(exploration.title) && substantive(exploration.summary), "missing introduction");
  const directions = exploration.directions || [];
  require(unique(directions.map((entry) => entry.id)), "duplicate direction");
  require(directions.length === directionIds.length
    && directionIds.every((id) => directions.some((entry) => entry.id === id)), "direction coverage differs from configuration");
  const candidates = exploration.candidates || [];
  const sources = exploration.sources || [];
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  require(unique(sources.map((source) => source.id)), "duplicate source");
  require(unique(candidates.map((candidate) => candidate.id)), "duplicate candidate");
  for (const source of sources) {
    require(substantive(source.id) && substantive(source.title), "missing source identity");
    require(/^https:\/\//.test(source.url), `${source.id}: missing primary URL`);
    require(substantive(source.finding) && substantive(source.readingDepth), `${source.id}: missing reading evidence`);
    require(Boolean(source.localPaperId) !== (source.sourceOrigin === "external"), `${source.id}: ambiguous provenance`);
    if (source.localPaperId) require(paperIds.includes(source.localPaperId), `${source.id}: missing local report`);
  }
  for (const direction of directions) {
    require(substantive(direction.progress) && substantive(direction.opportunity), `${direction.id}: missing research synthesis`);
    require(candidates.some((candidate) => candidate.directionId === direction.id), `${direction.id}: no candidate considered`);
  }
  for (const candidate of candidates) {
    require(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.id), "invalid candidate ID");
    require(directionIds.includes(candidate.directionId), `${candidate.id}: unknown direction`);
    for (const field of ["title", "hypothesis", "whyNow", "upside", "risk"]) {
      require(substantive(candidate[field]), `${candidate.id}: missing ${field}`);
    }
    require(candidate.method?.length >= 2 && candidate.method.every(substantive), `${candidate.id}: explain the method`);
    require(Array.isArray(candidate.implementation?.reuse) && candidate.implementation.reuse.length
      && Array.isArray(candidate.implementation?.build) && candidate.implementation.build.length,
      `${candidate.id}: distinguish reusable assets and work to implement`);
    require(candidate.priorWork?.length >= 2, `${candidate.id}: missing closest-work comparison`);
    for (const prior of candidate.priorWork) {
      require(sourceMap.has(prior.sourceId) && substantive(prior.overlap) && substantive(prior.difference),
        `${candidate.id}: incomplete prior-work comparison`);
    }
    require(candidate.evidenceIds?.length >= 3 && candidate.evidenceIds.every((id) => sourceMap.has(id)),
      `${candidate.id}: unresolved evidence`);
    require(candidate.evidenceIds.some((id) => sourceMap.get(id).sourceOrigin === "external"),
      `${candidate.id}: needs evidence beyond the local corpus`);
    for (const field of ["question", "setup", "measurement", "positive", "negative", "unclear", "budget"]) {
      require(substantive(candidate.firstExperiment?.[field]), `${candidate.id}: missing experiment ${field}`);
    }
    require(Array.isArray(candidate.firstExperiment.baselines) && candidate.firstExperiment.baselines.length >= 2
      && candidate.firstExperiment.baselines.every(substantive), `${candidate.id}: comparative baselines must be a list`);
    require(candidate.pilot?.status === "not-run" && substantive(candidate.pilot.reason),
      `${candidate.id}: this literature-stage round must not imply completed experiments`);
  }
  const review = exploration.review;
  require(review?.status === "passed", "independent content review is incomplete");
  require(review.snapshotFingerprint === explorationSnapshotFingerprint(exploration), "content changed after review");
  require(substantive(review.reviewerAgentId)
    && ![...(exploration.authorAgentIds || []), ...(exploration.retrievalAgentIds || [])].includes(review.reviewerAgentId),
  "reviewer must be independent of retrieval and writing");
  require(substantive(review.summary), "missing review findings");
  const recommendations = review.recommendations || [];
  require(recommendations.length === candidates.length && unique(recommendations.map((item) => item.candidateId))
    && candidates.every((candidate) => recommendations.some((item) => item.candidateId === candidate.id)),
  "review must account for every candidate");
  for (const recommendation of recommendations) {
    require(Object.hasOwn(EXPLORATION_DECISIONS, recommendation.decision) && substantive(recommendation.reason),
      `${recommendation.candidateId}: missing research decision`);
  }
  return { directions: directions.length, candidates: candidates.length, sources: sources.length };
}
