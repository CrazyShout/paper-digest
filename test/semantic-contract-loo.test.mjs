import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyRules,
  assertRulesNameFree,
  canonicalHash,
  deriveRules,
  instantiateMutants,
  makeCleanControls,
  runBaselines,
} from '../scripts/idea-pilots/semantic-contract-loo.mjs';

function relationSet(overrides = {}) {
  return {
    producerConsumer: [],
    partitions: [],
    artifactProducer: [],
    payloadAccounting: [],
    directions: [],
    ordering: [],
    temporal: [],
    cohorts: [],
    checkpointConfig: [],
    ...overrides,
  };
}

function ir(token, relations, extras = {}) {
  return {
    irVersion: 1,
    repositoryToken: token,
    ontology: {},
    relations: relationSet(relations),
    nativeAssertionFamilies: [],
    extractionSummary: { relationCounts: {} },
    ...extras,
  };
}

test('rules require two training repositories and never inspect the held-out IR', () => {
  const trainA = ir('a'.repeat(24), {
    partitions: [{ id: 'a1', disjoint: true }],
  }, { publicName: 'CooperScene' });
  const trainB = ir('b'.repeat(24), {
    partitions: [{ id: 'b1', disjoint: true }],
  }, { publicName: 'V2XScenes' });
  const heldOutPoison = ir('c'.repeat(24), {
    partitions: [{ id: 'c1', disjoint: false }],
  }, { publicName: 'CodeFilling' });

  const rules = deriveRules([trainA, trainB]);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].family, 'partitionDisjointness');
  assert.equal(rules[0].observationCount, 2);
  assert.deepEqual(rules[0].supportRepositoryTokens, [trainA.repositoryToken, trainB.repositoryToken]);
  assertRulesNameFree(rules);
  assert.equal(applyRules(rules, heldOutPoison)[0].family, 'partitionDisjointness');

  assert.equal(deriveRules([trainA]).length, 0);
});

test('a contradiction in training suppresses rather than weakens a semantic rule', () => {
  const trainA = ir('a'.repeat(24), {
    producerConsumer: [{ id: 'a1', consumerSubsetProducer: true }],
  });
  const trainB = ir('b'.repeat(24), {
    producerConsumer: [{ id: 'b1', consumerSubsetProducer: false }],
  });
  assert.deepEqual(deriveRules([trainA, trainB]), []);
});

test('vacuous non-wire observations cannot induce a wire-boundary rule', () => {
  const trainA = ir('a'.repeat(24), {
    payloadAccounting: [{ id: 'a1', claimsWireUnits: false, complete: true }],
  });
  const trainB = ir('b'.repeat(24), {
    payloadAccounting: [{ id: 'b1', claimsWireUnits: false, complete: true }],
  });
  assert.deepEqual(deriveRules([trainA, trainB]), []);

  trainA.relations.payloadAccounting[0].claimsWireUnits = true;
  trainB.relations.payloadAccounting[0].claimsWireUnits = true;
  assert.equal(deriveRules([trainA, trainB])[0].family, 'payloadBoundaryCompleteness');
});

test('repo names cannot enter serialized rules even when acquisition metadata contains them', () => {
  const rules = deriveRules([
    ir('a'.repeat(24), { directions: [{ id: 'd1', nameConsistent: true }] }, { repository: 'Co-MTP' }),
    ir('b'.repeat(24), { directions: [{ id: 'd2', nameConsistent: true }] }, { repository: 'CodeFilling' }),
  ]);
  assert.equal(rules.length, 1);
  assert.doesNotMatch(JSON.stringify(rules), /Co-MTP|CodeFilling/i);
  assertRulesNameFree(rules);
});

test('semantic mutants remain structurally valid and are checked only when training supports the family', () => {
  const base = ir('c'.repeat(24), {
    directions: [{ id: 'd0', fromRole: 'lidar', toRole: 'cam', nameConsistent: true }],
  });
  const rules = deriveRules([
    ir('a'.repeat(24), { directions: [{ id: 'd1', nameConsistent: true }] }),
    ir('b'.repeat(24), { directions: [{ id: 'd2', nameConsistent: true }] }),
  ]);
  const mutant = instantiateMutants(base).find((item) => item.id === 'transform-direction-inversion');
  assert.equal(mutant.applicable, true);

  const outputs = runBaselines(base, mutant.ir, rules, {
    expectedFamily: mutant.expectedFamily,
    referenceAvailable: true,
  });
  assert.equal(outputs.structureSchema.length, 0);
  assert.equal(outputs.hashBinding.length, 1);
  assert.equal(outputs.fieldStatistics.length, 0);
  assert.equal(outputs.contractChecker[0].family, 'transformDirection');
});

test('clean legal transformations remain quiet for semantic baselines while byte/hash binding fires', () => {
  const base = ir('c'.repeat(24), {
    directions: [
      { id: 'd0', fromRole: 'lidar', toRole: 'cam', nameConsistent: true },
      { id: 'd1', fromRole: 'cam', toRole: 'img', nameConsistent: true },
    ],
    ordering: [{ id: 'o1', orderDefined: true, lineageComplete: true }],
  });
  const rules = deriveRules([
    ir('a'.repeat(24), {
      directions: [{ id: 'x1', nameConsistent: true }],
      ordering: [{ id: 'x2', lineageComplete: true }],
    }),
    ir('b'.repeat(24), {
      directions: [{ id: 'y1', nameConsistent: true }],
      ordering: [{ id: 'y2', lineageComplete: true }],
    }),
  ]);

  for (const control of makeCleanControls(base)) {
    const outputs = runBaselines(base, control.ir, rules, {
      expectedFamily: 'clean-control',
      referenceAvailable: true,
    });
    assert.equal(outputs.structureSchema.length, 0, control.id);
    assert.equal(outputs.nativeAssertions.length, 0, control.id);
    assert.equal(outputs.fieldStatistics.length, 0, control.id);
    assert.equal(outputs.contractChecker.length, 0, control.id);
    assert.equal(outputs.hashBinding.length, 1, control.id);
    assert.notEqual(canonicalHash(base), canonicalHash(control.ir), control.id);
  }
});
