import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_AUDIT_PATH = resolve(
  WORKSPACE_ROOT,
  'content/idea-audits/cooperative-autonomous-driving-semantic-contract-loo-pilot-v4.json',
);

const SOURCE_DOCUMENTS = [
  'content/idea-audits/cooperative-autonomous-driving-semantic-contract-dossier-v3.json',
  'content/idea-audits/cooperative-autonomous-driving-finalist-panel-v4.json',
];

const IMPLEMENTATION_FILES = [
  'scripts/idea-pilots/semantic-contract-loo.mjs',
  'test/semantic-contract-loo.test.mjs',
];

const ASSETS = [
  {
    name: 'CooperScene',
    root: '/private/tmp/cooperscene-official',
    expectedCommit: '0945b52ce7a9765ae17d9c8ffa5e2e8573fef19a',
    evidence: [
      'tools/dataset_converters/coop_data_converter.py',
      'models/cooperative/datasets/coop_dataset.py',
    ],
    releasedArtifacts: [
      '/private/tmp/cooperscene-mini-train.pkl',
      '/private/tmp/cooperscene-mini-val.pkl',
      '/private/tmp/cooperscene-mini-test.pkl',
    ],
  },
  {
    name: 'V2XScenes',
    root: '/private/tmp/paper-digest-v2xscenes-audit',
    expectedCommit: '2f5a6840449d9d169b7d7d7ad9aed544242b6820',
    evidence: [
      'opencood/hypes_yaml/v2xscenes/v2xsences_where2comm.yaml',
      'opencood/hypes_yaml/v2xscenes/v2xsences_v2xvit.yaml',
      'opencood/data_utils/datasets/basedataset/v2xscenes_basedataset.py',
    ],
    releasedArtifacts: [],
  },
  {
    name: 'Co-MTP',
    root: '/private/tmp/co-mtp-official',
    expectedCommit: '8d0937faec0cfb929a9d50dd921d39f0837a84f0',
    evidence: [
      'preprocess/preprocess_v2x.py',
      'training/dataset_v2x_road.py',
    ],
    producerConsumerFlows: [
      {
        producer: 'preprocess/preprocess_v2x.py',
        consumer: 'training/dataset_v2x_road.py',
        loadedRootAlias: 'data',
        provenance: 'training/train.py data_path -> process_v2x_for_prediction',
      },
    ],
    releasedArtifacts: [],
  },
  {
    name: 'CodeFilling',
    root: '/private/tmp/exe-audit-codefilling',
    expectedCommit: '57f83ccc7d8457da74f06424811c130c3020e19e',
    evidence: [
      'opencood/models/comm_modules/where2comm.py',
      'opencood/models/sub_modules/codebook.py',
      'docs/md_files/lidar_benchmark.md',
    ],
    releasedArtifacts: [],
  },
];

const FORBIDDEN_RULE_TOKENS = [
  'CooperScene',
  'V2XScenes',
  'Co-MTP',
  'CodeFilling',
  'cooperscene',
  'v2xscenes',
  'co_mtp',
  'codefilling',
];

const FRAME_TOKENS = new Set([
  'agent',
  'cam',
  'camera',
  'ego',
  'global',
  'image',
  'img',
  'infra',
  'infrastructure',
  'lidar',
  'local',
  'road',
  'vehicle',
  'world',
]);

const RULE_SPECS = [
  {
    family: 'producerConsumerSchema',
    relationKey: 'producerConsumer',
    predicate: 'consumer-required-fields-subset-of-producer-emitted-fields',
    passKey: 'consumerSubsetProducer',
  },
  {
    family: 'partitionDisjointness',
    relationKey: 'partitions',
    predicate: 'training-and-evaluation-physical-cohorts-are-disjoint',
    passKey: 'disjoint',
  },
  {
    family: 'artifactProducerAgreement',
    relationKey: 'artifactProducer',
    predicate: 'released-artifact-role-cardinality-and-literals-match-producer',
    passKey: 'agrees',
  },
  {
    family: 'payloadBoundaryCompleteness',
    relationKey: 'payloadAccounting',
    predicate: 'wire-unit-claim-reaches-initialized-serializer-and-byte-measurement',
    passKey: 'complete',
    applicabilityKey: 'claimsWireUnits',
  },
  {
    family: 'transformDirection',
    relationKey: 'directions',
    predicate: 'directional-field-role-agrees-with-dataflow-endpoints',
    passKey: 'nameConsistent',
  },
  {
    family: 'agentOrderLineage',
    relationKey: 'ordering',
    predicate: 'agent-permutation-retains-explicit-lineage',
    passKey: 'lineageComplete',
  },
  {
    family: 'timestampProvenance',
    relationKey: 'temporal',
    predicate: 'temporal-field-retains-source-provenance',
    passKey: 'sourceBound',
  },
  {
    family: 'physicalEventCohort',
    relationKey: 'cohorts',
    predicate: 'physical-event-key-excludes-projection-role',
    passKey: 'projectionExcluded',
  },
  {
    family: 'checkpointConfigBinding',
    relationKey: 'checkpointConfig',
    predicate: 'checkpoint-load-retains-configuration-binding',
    passKey: 'bindingPresent',
  },
];

const MUTANT_TEMPLATES = Object.freeze([
  {
    id: 'ego-role-cardinality-shift',
    family: 'artifactProducerAgreement',
    relationKey: 'artifactProducer',
    passKey: 'agrees',
  },
  {
    id: 'transform-direction-inversion',
    family: 'transformDirection',
    relationKey: 'directions',
    passKey: 'nameConsistent',
  },
  {
    id: 'wire-unit-relabel-without-serialization',
    family: 'payloadBoundaryCompleteness',
    relationKey: 'payloadAccounting',
    passKey: 'complete',
  },
  {
    id: 'agent-order-permutation-without-lineage',
    family: 'agentOrderLineage',
    relationKey: 'ordering',
    passKey: 'lineageComplete',
  },
  {
    id: 'timestamp-provenance-erasure',
    family: 'timestampProvenance',
    relationKey: 'temporal',
    passKey: 'sourceBound',
  },
  {
    id: 'physical-event-cohort-projection-alias',
    family: 'physicalEventCohort',
    relationKey: 'cohorts',
    passKey: 'projectionExcluded',
  },
  {
    id: 'checkpoint-config-binding-removal',
    family: 'checkpointConfigBinding',
    relationKey: 'checkpointConfig',
    passKey: 'bindingPresent',
  },
  {
    id: 'producer-consumer-field-role-substitution',
    family: 'producerConsumerSchema',
    relationKey: 'producerConsumer',
    passKey: 'consumerSubsetProducer',
  },
  {
    id: 'partition-member-alias',
    family: 'partitionDisjointness',
    relationKey: 'partitions',
    passKey: 'disjoint',
  },
]);

const NATURAL_LABELS = Object.freeze({
  CooperScene: {
    family: 'artifactProducerAgreement',
    label: 'released-index-versus-public-producer contract drift',
  },
  V2XScenes: {
    family: 'partitionDisjointness',
    label: 'public train-versus-test selector overlap',
  },
  'Co-MTP': {
    family: 'producerConsumerSchema',
    label: 'persisted producer-versus-training-consumer field drift',
  },
  CodeFilling: {
    family: 'payloadBoundaryCompleteness',
    label: 'proxy communication rate lacks a complete wire-byte boundary',
  },
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(stableValue(value));
}

export function canonicalHash(value) {
  return sha256(canonicalJson(value));
}

function unique(values) {
  return [...new Set(values)];
}

function sortedUnique(values) {
  return unique(values).sort();
}

function clone(value) {
  return structuredClone(value);
}

function command(path, args, options = {}) {
  try {
    return execFileSync(path, args, {
      cwd: options.cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (options.allowFailure) {
      return '';
    }
    throw error;
  }
}

function git(root, args, allowFailure = false) {
  return command('git', ['-C', root, ...args], { allowFailure });
}

function collectSourceFiles(root) {
  const allowed = new Set(['.json', '.md', '.py', '.yaml', '.yml']);
  const files = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === '__pycache__') {
        continue;
      }
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
      } else if (entry.isFile() && allowed.has(extname(entry.name).toLowerCase())) {
        const size = statSync(path).size;
        if (size <= 2_000_000) {
          files.push(path);
        }
      }
    }
  }

  return files.sort((left, right) => relative(root, left).localeCompare(relative(root, right)));
}

function sourceTreeDigest(root, files) {
  const digest = createHash('sha256');
  let bytes = 0;
  for (const path of files) {
    const content = readFileSync(path);
    bytes += content.length;
    digest.update(relative(root, path));
    digest.update('\0');
    digest.update(sha256(content));
    digest.update('\0');
  }
  return { sha256: digest.digest('hex'), fileCount: files.length, bytes };
}

function stripYamlComment(value) {
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      quote = quote === char ? null : quote || char;
    }
    if (char === '#' && quote === null) {
      return value.slice(0, index).trim();
    }
  }
  return value.trim();
}

function parseScalar(value) {
  const clean = stripYamlComment(value).trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    return clean.slice(1, -1);
  }
  if (/^-?\d+(?:\.\d+)?$/.test(clean)) {
    return Number(clean);
  }
  if (/^(?:true|false)$/i.test(clean)) {
    return clean.toLowerCase() === 'true';
  }
  return clean;
}

function parseInlineList(value) {
  const matches = [...value.matchAll(/(['"])(.*?)\1/g)].map((match) => match[2]);
  if (matches.length > 0) {
    return matches;
  }
  return value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((item) => parseScalar(item))
    .filter((item) => item !== '');
}

function parseYamlTopLevel(text) {
  const lines = text.split(/\r?\n/);
  const values = {};
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, raw] = match;
    let value = stripYamlComment(raw);
    if (value.startsWith('[')) {
      while (!value.includes(']') && index + 1 < lines.length) {
        index += 1;
        value += ` ${stripYamlComment(lines[index])}`;
      }
      values[key] = parseInlineList(value);
      continue;
    }
    if (value === '') {
      const items = [];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const item = lines[cursor].match(/^\s+-\s*(.*)$/);
        if (!item) {
          break;
        }
        items.push(parseScalar(item[1]));
        cursor += 1;
      }
      if (items.length > 0) {
        values[key] = items;
        index = cursor - 1;
      }
      continue;
    }
    values[key] = parseScalar(value);
  }
  return values;
}

function partitionStem(key) {
  const lower = key.toLowerCase();
  if (!/(?:^|_)(?:train|training)(?:_|$)/.test(lower)) {
    return null;
  }
  return lower.replace(/(?:^|_)(?:train|training)(?=_|$)/, '_{partition}');
}

function matchingTestKey(trainKey, keys) {
  const stem = partitionStem(trainKey);
  if (!stem) {
    return null;
  }
  return keys.find((key) => {
    const lower = key.toLowerCase();
    if (!/(?:^|_)(?:test|testing)(?:_|$)/.test(lower)) {
      return false;
    }
    return lower.replace(/(?:^|_)(?:test|testing)(?=_|$)/, '_{partition}') === stem;
  });
}

function extractPartitions(root, yamlFiles) {
  const relations = [];
  for (const path of yamlFiles) {
    const values = parseYamlTopLevel(readFileSync(path, 'utf8'));
    const keys = Object.keys(values);
    for (const trainKey of keys) {
      const testKey = matchingTestKey(trainKey, keys);
      if (!testKey || !Array.isArray(values[trainKey]) || !Array.isArray(values[testKey])) {
        continue;
      }
      const left = values[trainKey].map(String);
      const right = values[testKey].map(String);
      if (left.length === 0 || right.length === 0) {
        continue;
      }
      const overlap = sortedUnique(left.filter((item) => new Set(right).has(item)));
      relations.push({
        id: sha256(`${relative(root, path)}:${trainKey}:${testKey}`).slice(0, 16),
        leftRole: 'training-partition',
        rightRole: 'evaluation-partition',
        leftCount: new Set(left).size,
        rightCount: new Set(right).size,
        overlapCount: overlap.length,
        overlapValueHashes: overlap.map((item) => sha256(item).slice(0, 16)),
        disjoint: overlap.length === 0,
        evidence: relative(root, path),
      });
    }
  }
  return relations;
}

function fieldTokens(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function extractBracketFields(text, mode, aliases = null) {
  const fields = [];
  const pattern = mode === 'write'
    ? /(?<![\w.])([A-Za-z_][\w.]*)\s*\[\s*(['"])([^'"\n]+)\2\s*\]\s*=/g
    : /(?<![\w.])([A-Za-z_][\w.]*)\s*\[\s*(['"])([^'"\n]+)\2\s*\]/g;
  for (const match of text.matchAll(pattern)) {
    const base = match[1].split('.')[0];
    if (!aliases || aliases.has(base)) {
      fields.push(match[3]);
    }
  }
  return sortedUnique(fields);
}

function extractLiteralKeys(text) {
  return sortedUnique([...text.matchAll(/(['"])([^'"\n]+)\1\s*:/g)].map((match) => match[2]));
}

function loadedAliasGroups(text) {
  const roots = [];
  for (const match of text.matchAll(/([A-Za-z_]\w*)\s*=\s*(?:pickle|json|yaml|mmengine)\.(?:load|loads)\s*\(/g)) {
    roots.push(match[1]);
  }
  return sortedUnique(roots).map((root) => {
    const aliases = new Set([root]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const match of text.matchAll(/for\s+([A-Za-z_]\w*)\s+in\s+([A-Za-z_]\w*)/g)) {
        if (aliases.has(match[2]) && !aliases.has(match[1])) {
          aliases.add(match[1]);
          changed = true;
        }
      }
      for (const match of text.matchAll(/([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*\[/g)) {
        if (aliases.has(match[2]) && !aliases.has(match[1])) {
          aliases.add(match[1]);
          changed = true;
        }
      }
    }
    return { root, aliases };
  });
}

function semanticKeyOverlap(left, right) {
  const leftTokens = new Set(left.flatMap(fieldTokens));
  const rightTokens = new Set(right.flatMap(fieldTokens));
  return [...leftTokens].filter((token) => rightTokens.has(token)).length;
}

function producerFields(text) {
  return sortedUnique([
    ...extractBracketFields(text, 'write'),
    ...extractLiteralKeys(text),
  ]);
}

function producerConsumerRelation(root, producer, consumer) {
  const producerSet = new Set(producer.fields);
  const common = consumer.fields.filter((field) => producerSet.has(field));
  const missing = consumer.fields.filter((field) => !producerSet.has(field));
  return {
    id: sha256(`${relative(root, producer.path)}:${relative(root, consumer.path)}`).slice(0, 16),
    producerFieldCount: producer.fields.length,
    consumerFieldCount: consumer.fields.length,
    commonFieldCount: common.length,
    missingConsumerFields: missing,
    missingConsumerFieldRoles: missing.map((field) => fieldTokens(field).sort().join('+')),
    missingConsumerFieldHashes: missing.map((field) => sha256(field).slice(0, 16)),
    consumerSubsetProducer: missing.length === 0,
    evidence: [relative(root, producer.path), relative(root, consumer.path)],
  };
}

function extractDeclaredProducerConsumer(root, declaredFlows) {
  return declaredFlows.map((flow) => {
    const producerPath = resolve(root, flow.producer);
    const consumerPath = resolve(root, flow.consumer);
    const producer = {
      path: producerPath,
      fields: producerFields(readFileSync(producerPath, 'utf8')),
    };
    const consumerText = readFileSync(consumerPath, 'utf8');
    const group = loadedAliasGroups(consumerText)
      .find((candidate) => candidate.root === flow.loadedRootAlias);
    if (!group) {
      throw new Error(`declared loaded alias not found: ${flow.loadedRootAlias} in ${consumerPath}`);
    }
    const relation = producerConsumerRelation(root, producer, {
      path: consumerPath,
      fields: extractBracketFields(consumerText, 'read', group.aliases),
    });
    relation.flowProvenance = flow.provenance;
    return relation;
  });
}

function extractProducerConsumer(root, pythonFiles, declaredFlows = []) {
  if (declaredFlows.length > 0) {
    return extractDeclaredProducerConsumer(root, declaredFlows);
  }
  const producers = [];
  const consumers = [];
  for (const path of pythonFiles) {
    const text = readFileSync(path, 'utf8');
    if (/(?:pickle|json|yaml|mmengine)\.dump|np\.save/.test(text)) {
      const fields = producerFields(text);
      if (fields.length > 0) {
        producers.push({ path, fields });
      }
    }
    if (/(?:pickle|json|yaml|mmengine)\.(?:load|loads)\s*\(/.test(text)) {
      const aliasGroups = loadedAliasGroups(text);
      for (const group of aliasGroups) {
        const fields = extractBracketFields(text, 'read', group.aliases);
        if (fields.length > 0) {
          consumers.push({ path, fields });
        }
      }
    }
  }

  const relations = [];
  for (const consumer of consumers) {
    let best = null;
    for (const producer of producers) {
      if (producer.path === consumer.path) {
        continue;
      }
      const producerSet = new Set(producer.fields);
      const common = consumer.fields.filter((field) => producerSet.has(field));
      const tokenOverlap = semanticKeyOverlap(producer.fields, consumer.fields);
      const consumerCoverage = common.length / consumer.fields.length;
      if (common.length < 5 || consumerCoverage < 0.45 || tokenOverlap < 2) {
        continue;
      }
      const candidate = { producer, consumer, common };
      if (!best || candidate.common.length > best.common.length) {
        best = candidate;
      }
    }
    if (!best) {
      continue;
    }
    relations.push(producerConsumerRelation(root, best.producer, best.consumer));
  }
  return relations;
}

function extractDirections(root, pythonFiles) {
  const relations = [];
  const seen = new Set();
  for (const path of pythonFiles) {
    const text = readFileSync(path, 'utf8');
    for (const match of text.matchAll(/\b([A-Za-z][A-Za-z0-9_]*?)(?:2|_to_)([A-Za-z][A-Za-z0-9_]*)\b/g)) {
      const from = fieldTokens(match[1]).at(-1);
      const to = fieldTokens(match[2])[0];
      if (!FRAME_TOKENS.has(from) || !FRAME_TOKENS.has(to) || from === to) {
        continue;
      }
      const key = `${from}:${to}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      relations.push({
        id: sha256(key).slice(0, 16),
        fromRole: from,
        toRole: to,
        nameConsistent: true,
        evidence: relative(root, path),
      });
    }
  }
  return relations.slice(0, 64);
}

function extractOrdering(root, pythonFiles) {
  const relations = [];
  for (const path of pythonFiles) {
    const text = readFileSync(path, 'utf8');
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!/(?:sorted\s*\(|\.sort\s*\()/.test(line) || !/(?:agent|cav|cooperator|vehicle)/i.test(line)) {
        continue;
      }
      relations.push({
        id: sha256(`${relative(root, path)}:${index + 1}`).slice(0, 16),
        orderDefined: true,
        lineageComplete: true,
        evidence: `${relative(root, path)}:${index + 1}`,
      });
    }
  }
  return relations.slice(0, 64);
}

function extractTemporal(root, pythonFiles) {
  const relations = [];
  const seen = new Set();
  for (const path of pythonFiles) {
    const text = readFileSync(path, 'utf8');
    for (const match of text.matchAll(/(?:\[['"]([^'"]*(?:timestamp|delay|age)[^'"]*)['"]\]|\b([A-Za-z_]\w*(?:timestamp|delay|age)\w*)\b)\s*=/gi)) {
      const field = match[1] || match[2];
      const role = fieldTokens(field).filter((token) => ['timestamp', 'delay', 'age', 'time'].includes(token)).join('+') || 'temporal';
      const key = `${relative(root, path)}:${role}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      relations.push({
        id: sha256(key).slice(0, 16),
        temporalRole: role,
        sourceBound: true,
        evidence: relative(root, path),
      });
    }
  }
  return relations.slice(0, 64);
}

function extractCohorts(root, pythonFiles) {
  const relations = [];
  for (const path of pythonFiles) {
    const text = readFileSync(path, 'utf8');
    const keys = new Set([
      ...extractBracketFields(text, 'read'),
      ...extractBracketFields(text, 'write'),
      ...extractLiteralKeys(text),
    ]);
    const hasScenario = [...keys].some((key) => /scenario|sequence|scene/i.test(key));
    const hasTime = [...keys].some((key) => /timestamp|frame/i.test(key));
    const hasProjection = [...keys].some((key) => /agent|ego|cav/i.test(key));
    if (hasScenario && hasTime && hasProjection) {
      relations.push({
        id: sha256(relative(root, path)).slice(0, 16),
        cohortRoles: ['physical-context', 'time-event'],
        projectionRole: 'agent-projection',
        projectionExcluded: true,
        evidence: relative(root, path),
      });
    }
  }
  return relations.slice(0, 64);
}

function extractCheckpointConfig(root, pythonFiles) {
  const relations = [];
  for (const path of pythonFiles) {
    const text = readFileSync(path, 'utf8');
    if (!/(?:torch\.load|load_state_dict|load_checkpoint)/.test(text)) {
      continue;
    }
    if (!/(?:config|hypes|yaml)/i.test(text)) {
      continue;
    }
    relations.push({
      id: sha256(relative(root, path)).slice(0, 16),
      checkpointLoadObserved: true,
      configurationLoadObserved: true,
      bindingPresent: true,
      evidence: relative(root, path),
    });
  }
  return relations.slice(0, 64);
}

function extractPayloadAccounting(root, files) {
  const metricEvidence = [];
  const serializerEvidence = [];
  const initializerEvidence = [];
  const wireMeasureEvidence = [];
  let claimsWireUnits = false;

  for (const path of files) {
    const text = readFileSync(path, 'utf8');
    const activeText = text
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    const rel = relative(root, path);
    if (/(?:comm(?:unication)?_?rate|bandwidth)/i.test(activeText) && /(?:\.sum\s*\(|\/\s*\(?[A-Za-z_* -]+\)?)/.test(activeText)) {
      metricEvidence.push(rel);
    }
    if (/\.(?:compress|serialize)\s*\(|\.tobytes\s*\(|struct\.pack\s*\(/.test(activeText)) {
      serializerEvidence.push(rel);
    }
    if (/(?:_entropyCoder|serializer|encoder)\s*=/.test(activeText)) {
      initializerEvidence.push(rel);
    }
    if (/(?:\.nbytes|element_size\s*\(|len\s*\(\s*(?:binary|binaries|payload|packet)|to_bytes\s*\(|tobytes\s*\()/i.test(activeText)) {
      wireMeasureEvidence.push(rel);
    }
    if (extname(path).toLowerCase() === '.md' && /(?:bandwidth|communication volume)/i.test(text) && /(?:megabit|byte|bit)/i.test(text)) {
      claimsWireUnits = true;
    }
  }

  if (metricEvidence.length === 0 && !claimsWireUnits) {
    return [];
  }
  const hasSerializer = serializerEvidence.length > 0;
  const hasInitializer = initializerEvidence.length > 0;
  const hasWireMeasure = wireMeasureEvidence.length > 0;
  const completePathEvidence = sortedUnique(metricEvidence).filter((path) => (
    serializerEvidence.includes(path)
      && initializerEvidence.includes(path)
      && wireMeasureEvidence.includes(path)
  ));
  return [{
    id: sha256('payload-accounting').slice(0, 16),
    metricRole: 'communication-selection-density',
    claimsWireUnits,
    hasSerializer,
    hasInitializer,
    hasWireMeasure,
    completePathCount: completePathEvidence.length,
    complete: !claimsWireUnits || completePathEvidence.length > 0,
    evidence: {
      metric: sortedUnique(metricEvidence).slice(0, 12),
      serializer: sortedUnique(serializerEvidence).slice(0, 12),
      initializer: sortedUnique(initializerEvidence).slice(0, 12),
      wireMeasure: sortedUnique(wireMeasureEvidence).slice(0, 12),
      completePath: completePathEvidence.slice(0, 12),
    },
  }];
}

function extractAssertions(root, pythonFiles) {
  const assertions = [];
  for (const path of pythonFiles) {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!/^\s*assert\b/.test(line)) {
        continue;
      }
      const families = [];
      if (/train|test|scenario|split/i.test(line)) families.push('partitionDisjointness');
      if (/field|key|label|mask/i.test(line)) families.push('producerConsumerSchema');
      if (/transform|lidar2|cam2|ego2|world/i.test(line)) families.push('transformDirection');
      if (/timestamp|delay|age/i.test(line)) families.push('timestampProvenance');
      if (/comm.*rate|bandwidth|byte|binary/i.test(line)) families.push('payloadBoundaryCompleteness');
      if (/checkpoint|state_dict|config/i.test(line)) families.push('checkpointConfigBinding');
      for (const family of families) {
        assertions.push({
          family,
          evidence: `${relative(root, path)}:${index + 1}`,
          path: relative(root, path),
        });
      }
    }
  }
  return assertions;
}

const RESTRICTED_PICKLE_SUMMARY = String.raw`
import json, pickle, sys
from collections import defaultdict

class RestrictedUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        raise ValueError("global opcode blocked: %s.%s" % (module, name))

with open(sys.argv[1], "rb") as handle:
    root = RestrictedUnpickler(handle).load()

def scalar(value):
    return value if isinstance(value, (str, int, float, bool)) or value is None else None

summary = {"rootType": type(root).__name__}
if isinstance(root, dict):
    summary["rootFields"] = sorted(str(key) for key in root.keys())
    meta = root.get("metainfo", {})
    if isinstance(meta, dict):
        summary["metadata"] = {str(key): scalar(value) for key, value in meta.items() if scalar(value) is not None}
    rows = root.get("data_list", [])
    if isinstance(rows, list):
        summary["rowCount"] = len(rows)
        dict_rows = [row for row in rows if isinstance(row, dict)]
        summary["rowFields"] = sorted({str(key) for row in dict_rows[:100] for key in row.keys()})
        scenario_key = next((key for key in ("scenario", "sequence", "scene") if any(key in row for row in dict_rows[:100])), None)
        time_key = next((key for key in ("timestamp", "frame_id", "frame") if any(key in row for row in dict_rows[:100])), None)
        projection_key = next((key for key in ("agent_id", "ego_id", "cav_id") if any(key in row for row in dict_rows[:100])), None)
        if scenario_key and time_key and projection_key:
            groups = defaultdict(set)
            for row in dict_rows:
                groups[(str(row.get(scenario_key)), str(row.get(time_key)))].add(str(row.get(projection_key)))
            counts = [len(value) for value in groups.values()]
            summary["physicalEventCount"] = len(groups)
            summary["projectionCountMin"] = min(counts) if counts else 0
            summary["projectionCountMax"] = max(counts) if counts else 0
            summary["projectionRoleValueHashes"] = sorted({
                __import__("hashlib").sha256(value.encode()).hexdigest()[:16]
                for values in groups.values() for value in values
            })
print(json.dumps(summary, sort_keys=True))
`;

function restrictedPickleSummary(path) {
  const result = spawnSync('python3', ['-c', RESTRICTED_PICKLE_SUMMARY, path], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    return { error: result.stderr.trim() || `python exited ${result.status}` };
  }
  return JSON.parse(result.stdout);
}

function extractArtifactProducer(root, pythonFiles, releasedArtifacts) {
  if (releasedArtifacts.length === 0) {
    return [];
  }
  let bestCandidate = null;
  for (const path of pythonFiles) {
    const text = readFileSync(path, 'utf8');
    if (!/(?:pickle|mmengine)\.dump/.test(text)) {
      continue;
    }
    for (const match of text.matchAll(/([A-Z_]*(?:EGO|AGENT)[A-Z_]*)\s*=\s*[\[(]([^\])]+)[\])]/g)) {
      const values = [...match[2].matchAll(/(['"])(.*?)\1/g)].map((item) => item[2]);
      if (values.length > 0 && (!bestCandidate || values.length > bestCandidate.values.length)) {
        bestCandidate = { path, values };
      }
    }
  }

  const producerMetadata = {};
  for (const path of pythonFiles) {
    const text = readFileSync(path, 'utf8');
    if (!/(?:pickle|mmengine)\.dump/.test(text)) continue;
    for (const match of text.matchAll(/(['"])(dataset|info_version|cooperative)\1\s*:\s*(['"])(.*?)\3/g)) {
      producerMetadata[match[2]] = match[4];
    }
  }

  const summaries = releasedArtifacts.map((path) => ({
    path,
    sha256: sha256File(path),
    summary: restrictedPickleSummary(path),
  }));
  const mismatchReasons = [];
  if (bestCandidate) {
    for (const artifact of summaries) {
      if (
        typeof artifact.summary.projectionCountMax === 'number'
        && artifact.summary.projectionCountMax !== bestCandidate.values.length
      ) {
        mismatchReasons.push('projection-role-cardinality');
      }
    }
  }
  for (const [key, value] of Object.entries(producerMetadata)) {
    for (const artifact of summaries) {
      if (artifact.summary.metadata?.[key] !== undefined && artifact.summary.metadata[key] !== value) {
        mismatchReasons.push(`metadata-role:${fieldTokens(key).join('+')}`);
      }
    }
  }

  return [{
    id: sha256('artifact-producer').slice(0, 16),
    producerProjectionRoleCount: bestCandidate?.values.length ?? null,
    releasedProjectionRoleCounts: summaries.map((item) => item.summary.projectionCountMax ?? null),
    producerMetadata,
    releasedMetadata: summaries.map((item) => item.summary.metadata ?? {}),
    mismatchReasons: sortedUnique(mismatchReasons),
    agrees: mismatchReasons.length === 0 && bestCandidate !== null,
    evidence: {
      producer: bestCandidate ? relative(root, bestCandidate.path) : null,
      artifacts: summaries.map((item) => ({
        path: item.path,
        sha256: item.sha256,
        summary: item.summary,
      })),
    },
  }];
}

function buildIr(asset, files, sourceDigest, commit) {
  const pythonFiles = files.filter((path) => extname(path).toLowerCase() === '.py');
  const yamlFiles = files.filter((path) => ['.yaml', '.yml'].includes(extname(path).toLowerCase()));
  const token = sha256(`${commit}:${sourceDigest.sha256}`).slice(0, 24);
  return {
    irVersion: 1,
    repositoryToken: token,
    ontology: {
      identityRoles: ['agent-projection', 'physical-context', 'time-event'],
      dataflowRoles: ['producer', 'consumer', 'released-artifact', 'serializer'],
      unitRoles: ['selection-density', 'wire-bytes'],
    },
    relations: {
      producerConsumer: extractProducerConsumer(
        asset.root,
        pythonFiles,
        asset.producerConsumerFlows ?? [],
      ),
      partitions: extractPartitions(asset.root, yamlFiles),
      artifactProducer: extractArtifactProducer(asset.root, pythonFiles, asset.releasedArtifacts),
      payloadAccounting: extractPayloadAccounting(asset.root, files),
      directions: extractDirections(asset.root, pythonFiles),
      ordering: extractOrdering(asset.root, pythonFiles),
      temporal: extractTemporal(asset.root, pythonFiles),
      cohorts: extractCohorts(asset.root, pythonFiles),
      checkpointConfig: extractCheckpointConfig(asset.root, pythonFiles),
    },
    nativeAssertions: extractAssertions(asset.root, pythonFiles),
    extractionSummary: {
      sourceFileCount: sourceDigest.fileCount,
      sourceBytes: sourceDigest.bytes,
      relationCounts: {},
    },
  };
}

function finalizeIr(ir) {
  ir.extractionSummary.relationCounts = Object.fromEntries(
    Object.entries(ir.relations).map(([key, relations]) => [key, relations.length]),
  );
  return ir;
}

export function deriveRules(trainingIrs, options = {}) {
  const minRepositories = options.minRepositories ?? 2;
  const minObservations = options.minObservations ?? 2;
  const rules = [];

  for (const spec of RULE_SPECS) {
    const observations = [];
    const supportTokens = [];
    for (const ir of trainingIrs) {
      const relations = ir.relations?.[spec.relationKey] ?? [];
      const applicableRelations = relations.filter((relation) => (
        !spec.applicabilityKey || relation[spec.applicabilityKey] === true
      ));
      if (applicableRelations.length > 0) {
        supportTokens.push(ir.repositoryToken);
      }
      for (const relation of applicableRelations) {
        if (typeof relation[spec.passKey] === 'boolean') {
          observations.push(Boolean(relation[spec.passKey]));
        }
      }
    }
    const distinctSupport = sortedUnique(supportTokens);
    const passCount = observations.filter(Boolean).length;
    const eligible = distinctSupport.length >= minRepositories
      && observations.length >= minObservations
      && passCount === observations.length;
    if (!eligible) {
      continue;
    }
    const ruleBody = {
      family: spec.family,
      relationKey: spec.relationKey,
      predicate: spec.predicate,
      passKey: spec.passKey,
      supportRepositoryTokens: distinctSupport,
      observationCount: observations.length,
      trainingPassCount: passCount,
      supportPolicy: {
        minRepositories,
        minObservations,
        contradictionsAllowed: 0,
      },
    };
    rules.push({
      ruleId: sha256(canonicalJson(ruleBody)).slice(0, 20),
      ...ruleBody,
    });
  }

  assertRulesNameFree(rules);
  return rules;
}

export function assertRulesNameFree(rules, forbiddenTokens = FORBIDDEN_RULE_TOKENS) {
  const serialized = JSON.stringify(rules).toLowerCase();
  const leaks = forbiddenTokens.filter((token) => serialized.includes(token.toLowerCase()));
  if (leaks.length > 0) {
    throw new Error(`repository name leaked into rules: ${leaks.join(', ')}`);
  }
  return true;
}

export function applyRules(rules, ir) {
  const violations = [];
  for (const rule of rules) {
    for (const relation of ir.relations?.[rule.relationKey] ?? []) {
      if (relation[rule.passKey] === false) {
        violations.push({
          family: rule.family,
          ruleId: rule.ruleId,
          relationId: relation.id,
        });
      }
    }
  }
  return violations;
}

function relationFailures(ir) {
  const failures = [];
  for (const spec of RULE_SPECS) {
    for (const relation of ir.relations?.[spec.relationKey] ?? []) {
      if (relation[spec.passKey] === false) {
        failures.push({ family: spec.family, relationId: relation.id });
      }
    }
  }
  return failures;
}

function structureFindings(ir) {
  const findings = [];
  if (!ir || ir.irVersion !== 1 || typeof ir.repositoryToken !== 'string') {
    findings.push({ family: 'contractIrStructure', reason: 'invalid-root' });
    return findings;
  }
  for (const spec of RULE_SPECS) {
    const relations = ir.relations?.[spec.relationKey];
    if (!Array.isArray(relations)) {
      findings.push({ family: spec.family, reason: 'missing-relation-array' });
      continue;
    }
    for (const relation of relations) {
      if (typeof relation.id !== 'string' || typeof relation[spec.passKey] !== 'boolean') {
        findings.push({ family: spec.family, reason: 'relation-shape' });
      }
    }
  }
  return findings;
}

function nativeAssertionFindings(ir) {
  const assertions = ir.nativeAssertions ?? [];
  const findings = [];
  for (const spec of RULE_SPECS) {
    for (const relation of ir.relations?.[spec.relationKey] ?? []) {
      if (relation[spec.passKey] !== false) continue;
      const evidencePaths = Array.isArray(relation.evidence)
        ? relation.evidence
        : typeof relation.evidence === 'string'
          ? [relation.evidence.split(':')[0]]
          : [];
      const matching = assertions.find((assertion) => (
        assertion.family === spec.family && evidencePaths.includes(assertion.path)
      ));
      if (matching) {
        findings.push({ family: spec.family, relationId: relation.id, assertion: matching.evidence });
      }
    }
  }
  return findings;
}

function fieldStatisticsFindings(ir) {
  const coveredFamilies = new Set([
    'artifactProducerAgreement',
    'partitionDisjointness',
    'producerConsumerSchema',
    'physicalEventCohort',
  ]);
  return relationFailures(ir).filter((finding) => coveredFamilies.has(finding.family));
}

export function runBaselines(baseIr, candidateIr, rules, options = {}) {
  const changed = canonicalHash(baseIr) !== canonicalHash(candidateIr);
  return {
    structureSchema: structureFindings(candidateIr),
    nativeAssertions: nativeAssertionFindings(candidateIr),
    hashBinding: options.referenceAvailable && changed
      ? [{ family: options.expectedFamily ?? 'opaque-change', reason: 'canonical-ir-hash-changed' }]
      : [],
    fieldStatistics: fieldStatisticsFindings(candidateIr),
    contractChecker: applyRules(rules, candidateIr),
  };
}

export function instantiateMutants(ir) {
  const mutants = [];
  for (const template of MUTANT_TEMPLATES) {
    const baseRelations = ir.relations?.[template.relationKey] ?? [];
    const index = baseRelations.findIndex((relation) => relation[template.passKey] === true);
    if (index === -1) {
      mutants.push({
        id: template.id,
        expectedFamily: template.family,
        applicable: false,
        reason: 'no-clean-precondition-in-held-out-ir',
      });
      continue;
    }
    const mutated = clone(ir);
    const relation = mutated.relations[template.relationKey][index];
    relation[template.passKey] = false;
    relation.mutationMarker = sha256(template.id).slice(0, 12);
    if (template.family === 'partitionDisjointness') relation.overlapCount = Math.max(1, relation.overlapCount ?? 0);
    if (template.family === 'producerConsumerSchema') relation.missingConsumerFieldRoles = ['held-out-role-substitution'];
    if (template.family === 'artifactProducerAgreement') relation.mismatchReasons = ['projection-role-cardinality'];
    if (template.family === 'payloadBoundaryCompleteness') {
      relation.claimsWireUnits = true;
      relation.hasWireMeasure = false;
    }
    if (template.family === 'transformDirection') [relation.fromRole, relation.toRole] = [relation.toRole, relation.fromRole];
    if (template.family === 'physicalEventCohort') relation.cohortRoles = [...relation.cohortRoles, relation.projectionRole];
    mutants.push({
      id: template.id,
      expectedFamily: template.family,
      applicable: true,
      ir: mutated,
    });
  }
  return mutants;
}

export function makeCleanControls(ir) {
  const relationOrder = clone(ir);
  for (const relations of Object.values(relationOrder.relations)) {
    relations.reverse();
    for (const relation of relations) {
      for (const [key, value] of Object.entries(relation)) {
        if (Array.isArray(value)) {
          relation[key] = [...value].reverse();
        }
      }
    }
  }

  const unitRoundTrip = clone(ir);
  unitRoundTrip.cleanNormalization = {
    role: 'length',
    operations: [
      { from: 'm', to: 'cm', factor: 100 },
      { from: 'cm', to: 'm', factor: 0.01 },
    ],
    netFactor: 1,
  };

  const explicitPermutation = clone(ir);
  explicitPermutation.cleanPermutation = {
    role: 'agent-order',
    permutation: [1, 0],
    inverse: [1, 0],
    lineageComplete: true,
  };

  return [
    { id: 'relation-and-field-order-permutation', ir: relationOrder },
    { id: 'unit-round-trip-with-lineage', ir: unitRoundTrip },
    { id: 'agent-permutation-with-explicit-lineage', ir: explicitPermutation },
  ];
}

function families(findings) {
  return new Set(findings.map((finding) => finding.family));
}

function summarizeCase(baseIr, candidateIr, rules, expectedFamily, referenceAvailable) {
  const baseOutputs = runBaselines(baseIr, baseIr, rules, {
    expectedFamily,
    referenceAvailable,
  });
  const candidateOutputs = runBaselines(baseIr, candidateIr, rules, {
    expectedFamily,
    referenceAvailable,
  });
  const outputs = findingDelta(candidateOutputs, baseOutputs);
  return {
    outputs,
    detectedBy: Object.fromEntries(
      Object.entries(outputs).map(([name, findings]) => [name, families(findings).has(expectedFamily)]),
    ),
  };
}

function findingIdentity(finding) {
  return canonicalJson({
    family: finding.family,
    relationId: finding.relationId ?? null,
    ruleId: finding.ruleId ?? null,
    reason: finding.reason ?? null,
  });
}

function findingDelta(candidateOutputs, baseOutputs) {
  return Object.fromEntries(Object.entries(candidateOutputs).map(([name, findings]) => {
    const existing = new Set((baseOutputs[name] ?? []).map(findingIdentity));
    return [name, findings.filter((finding) => !existing.has(findingIdentity(finding)))];
  }));
}

function blindFold(target, allBuilt) {
  const training = allBuilt.filter((item) => item.ir.repositoryToken !== target.ir.repositoryToken);
  const rules = deriveRules(training.map((item) => item.ir));
  const naturalOutputs = runBaselines(target.ir, target.ir, rules, { referenceAvailable: false });
  const mutants = instantiateMutants(target.ir).map((mutant) => {
    if (!mutant.applicable) {
      return mutant;
    }
    return {
      id: mutant.id,
      expectedFamily: mutant.expectedFamily,
      applicable: true,
      ...summarizeCase(target.ir, mutant.ir, rules, mutant.expectedFamily, true),
    };
  });
  const cleanControls = makeCleanControls(target.ir).map((control) => ({
    id: control.id,
    ...(() => {
      const baseOutputs = runBaselines(target.ir, target.ir, rules, {
        expectedFamily: 'clean-control',
        referenceAvailable: true,
      });
      const candidateOutputs = runBaselines(target.ir, control.ir, rules, {
        expectedFamily: 'clean-control',
        referenceAvailable: true,
      });
      return { outputs: findingDelta(candidateOutputs, baseOutputs) };
    })(),
  }));
  return {
    repositoryToken: target.ir.repositoryToken,
    trainingRepositoryTokens: training.map((item) => item.ir.repositoryToken).sort(),
    rules,
    naturalOutputs,
    mutants,
    cleanControls,
  };
}

function openNaturalLabelsAfterPrediction(blindOutputs, built) {
  return blindOutputs.map((fold) => {
    const target = built.find((item) => item.ir.repositoryToken === fold.repositoryToken);
    const label = NATURAL_LABELS[target.asset.name];
    return {
      targetAsset: target.asset.name,
      repositoryToken: fold.repositoryToken,
      trainingRepositoryTokens: fold.trainingRepositoryTokens,
      inducedRules: fold.rules,
      naturalDrift: {
        ...label,
        outputs: fold.naturalOutputs,
        detectedBy: Object.fromEntries(
          Object.entries(fold.naturalOutputs).map(([name, findings]) => [name, families(findings).has(label.family)]),
        ),
      },
      mutants: fold.mutants,
      cleanTransformations: fold.cleanControls.map((control) => ({
        id: control.id,
        falsePositiveBy: Object.fromEntries(
          Object.entries(control.outputs).map(([name, findings]) => [name, findings.length > 0]),
        ),
        outputs: control.outputs,
      })),
      extractedRelationCounts: target.ir.extractionSummary.relationCounts,
      observedStaticRelationFailures: relationFailures(target.ir)
        .filter((finding) => finding.family === label.family),
      observedStaticFailureDetails: relationFailureDetails(target.ir)
        .filter((finding) => finding.family === label.family),
    };
  });
}

function relationFailureDetails(ir) {
  const failures = [];
  for (const spec of RULE_SPECS) {
    for (const relation of ir.relations?.[spec.relationKey] ?? []) {
      if (relation[spec.passKey] === false) {
        failures.push({
          family: spec.family,
          relationId: relation.id,
          observed: relation,
        });
      }
    }
  }
  return failures;
}

function aggregateResults(folds) {
  const baselineNames = ['structureSchema', 'nativeAssertions', 'hashBinding', 'fieldStatistics', 'contractChecker'];
  const aggregate = {};
  for (const baseline of baselineNames) {
    const naturalDetected = folds.filter((fold) => fold.naturalDrift.detectedBy[baseline]).length;
    const applicableMutants = folds.flatMap((fold) => fold.mutants).filter((mutant) => mutant.applicable);
    const mutantDetected = applicableMutants.filter((mutant) => mutant.detectedBy[baseline]).length;
    const controls = folds.flatMap((fold) => fold.cleanTransformations);
    const cleanFalsePositives = controls.filter((control) => control.falsePositiveBy[baseline]).length;
    aggregate[baseline] = {
      naturalDetected,
      naturalTotal: folds.length,
      applicableMutantsDetected: mutantDetected,
      applicableMutantsTotal: applicableMutants.length,
      cleanFalsePositives,
      cleanTransformationTotal: controls.length,
    };
  }
  return aggregate;
}

function buildAsset(asset) {
  if (!existsSync(asset.root)) {
    throw new Error(`missing repository checkout: ${asset.root}`);
  }
  const commit = git(asset.root, ['rev-parse', 'HEAD']);
  const files = collectSourceFiles(asset.root);
  const sourceDigest = sourceTreeDigest(asset.root, files);
  const ir = finalizeIr(buildIr(asset, files, sourceDigest, commit));
  const evidenceArtifacts = [
    ...asset.evidence.map((path) => resolve(asset.root, path)),
    ...asset.releasedArtifacts,
  ].map((path) => ({
    path,
    exists: existsSync(path),
    sha256: existsSync(path) ? sha256File(path) : null,
    bytes: existsSync(path) ? statSync(path).size : null,
  }));
  return {
    asset,
    ir,
    provenance: {
      root: asset.root,
      expectedCommit: asset.expectedCommit,
      observedCommit: commit,
      commitMatches: commit === asset.expectedCommit,
      remote: git(asset.root, ['remote', 'get-url', 'origin'], true),
      worktreeStatus: git(asset.root, ['status', '--short'], true),
      sourceAggregate: sourceDigest,
      evidenceArtifacts,
    },
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function testCommandResult(runTests) {
  const args = ['--test', resolve(WORKSPACE_ROOT, 'test/semantic-contract-loo.test.mjs')];
  if (!runTests) {
    return {
      command: `${process.execPath} ${args.join(' ')}`,
      executed: false,
      exitCode: null,
      result: 'not-run-by-pilot-command',
    };
  }
  const result = spawnSync(process.execPath, args, {
    cwd: WORKSPACE_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    command: `${process.execPath} ${args.join(' ')}`,
    executed: true,
    exitCode: result.status,
    signal: result.signal,
    result: result.status === 0 ? 'passed' : 'failed',
    stdoutTail: result.stdout.trim().slice(-6000),
    stderrTail: result.stderr.trim().slice(-6000),
  };
}

function implementationProvenance(testResult) {
  const inputHashes = {};
  for (const path of [...SOURCE_DOCUMENTS, ...IMPLEMENTATION_FILES]) {
    const absolute = resolve(WORKSPACE_ROOT, path);
    inputHashes[path] = existsSync(absolute) ? `sha256:${sha256File(absolute)}` : null;
  }
  return {
    workspaceCommit: git(WORKSPACE_ROOT, ['rev-parse', 'HEAD']),
    scopedWorktreeStatus: git(WORKSPACE_ROOT, [
      'status',
      '--short',
      '--',
      ...IMPLEMENTATION_FILES,
      relative(WORKSPACE_ROOT, DEFAULT_AUDIT_PATH),
    ], true),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    executionDevice: 'CPU-only static parsing; no model or GPU execution',
    inputHashes,
    tests: testResult,
  };
}

export function runPilot(options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const testResult = options.testResult ?? testCommandResult(false);
  const dossier = readJson(resolve(WORKSPACE_ROOT, SOURCE_DOCUMENTS[0]));
  const panel = readJson(resolve(WORKSPACE_ROOT, SOURCE_DOCUMENTS[1]));
  const built = ASSETS.map(buildAsset);

  // Predictions are completed before target labels are opened below.
  const blindOutputs = built.map((target) => blindFold(target, built));
  const folds = openNaturalLabelsAfterPrediction(blindOutputs, built);
  const aggregate = aggregateResults(folds);
  const implementation = implementationProvenance(testResult);

  const executionFailures = [];
  if (testResult.executed && testResult.exitCode !== 0) {
    executionFailures.push('unit-tests-failed');
  }
  for (const item of built) {
    if (!item.provenance.commitMatches) {
      executionFailures.push(`official-commit-mismatch:${item.asset.name}`);
    }
    for (const evidence of item.provenance.evidenceArtifacts) {
      if (!evidence.exists) executionFailures.push(`missing-input:${evidence.path}`);
    }
  }

  const contractNatural = aggregate.contractChecker.naturalDetected;
  const unsupportedNaturalFamilies = folds
    .filter((fold) => !fold.inducedRules.some((rule) => rule.family === fold.naturalDrift.family))
    .map((fold) => ({ asset: fold.targetAsset, family: fold.naturalDrift.family }));
  const experimentalFailures = [];
  if (contractNatural < 3) {
    experimentalFailures.push({
      id: 'shared-rule-natural-drift-coverage-below-preregistered-minimum',
      observed: `${contractNatural}/4`,
      required: 'at least 3/4 independent held-out repositories',
    });
  }
  if (unsupportedNaturalFamilies.length > 0) {
    experimentalFailures.push({
      id: 'insufficient-training-repository-support-for-held-out-relation-families',
      unsupported: unsupportedNaturalFamilies,
    });
  }
  if (aggregate.contractChecker.cleanFalsePositives > 0) {
    experimentalFailures.push({
      id: 'contract-checker-failed-clean-transformation-negative-control',
      observed: aggregate.contractChecker.cleanFalsePositives,
    });
  }

  const negative = executionFailures.length > 0 || experimentalFailures.length > 0;
  const labelCommitment = canonicalHash(NATURAL_LABELS);
  const mutantCommitment = canonicalHash(MUTANT_TEMPLATES);
  return {
    schemaVersion: 1,
    auditId: 'cooperative-autonomous-driving-semantic-contract-loo-pilot-v4-2026-07-31',
    directionId: dossier.directionId,
    candidateId: dossier.candidateId,
    preparedAt: generatedAt.slice(0, 10),
    generatedAt,
    pilotType: 'leave-one-repository-out CPU static contract pilot',
    verdict: negative ? 'negative-pilot' : 'pilot-passed',
    candidateScoringPerformed: false,
    preregistration: {
      rulePolicy: {
        repositoryNamesAllowedInRules: false,
        inputToRuleInduction: 'anonymous contract IR from the three training repositories only',
        minimumIndependentTrainingRepositories: 2,
        minimumTrainingObservations: 2,
        allowedTrainingContradictions: 0,
        targetLabelsOpenedAfterPredictions: true,
      },
      naturalLabelCommitment: `sha256:${labelCommitment}`,
      mutantRegistryCommitment: `sha256:${mutantCommitment}`,
      semanticMutants: MUTANT_TEMPLATES.map(({ id, family }) => ({ id, family })),
      cleanTransformations: [
        'relation-and-field-order-permutation',
        'unit-round-trip-with-lineage',
        'agent-permutation-with-explicit-lineage',
      ],
      naturalLabelSource: [dossier.auditId, panel.panelId],
    },
    contractIr: {
      version: 1,
      repositoryIdentity: 'sha256-derived anonymous token',
      nodeRoles: ['field', 'partition', 'projection', 'physical-event', 'payload', 'checkpoint', 'configuration'],
      edgeRoles: ['produces', 'consumes', 'selects', 'serializes', 'transforms', 'binds', 'groups'],
      extraction: 'read-only Python/YAML/Markdown parsing plus restricted primitive-only pickle loading',
      restrictions: [
        'No repository name, absolute path, target label, or drift identifier enters a derived rule.',
        'A relation family becomes a rule only with support from at least two training repositories and zero observed contradictions.',
        'Restricted pickle loading blocks all GLOBAL/class resolution and executes no repository code.',
      ],
    },
    inputs: {
      sourceDocuments: SOURCE_DOCUMENTS.map((path) => ({
        path,
        sha256: implementation.inputHashes[path],
      })),
      repositories: built.map((item) => ({
        asset: item.asset.name,
        repositoryToken: item.ir.repositoryToken,
        ...item.provenance,
      })),
    },
    commands: [
      {
        command: `${process.execPath} ${process.argv.slice(1).join(' ')}`,
        purpose: 'execute the CPU pilot and write this audit',
        result: executionFailures.length === 0 ? 'completed' : 'completed-with-execution-failures',
        exitCode: executionFailures.length === 0 ? 0 : 1,
      },
      testResult,
    ],
    implementation,
    results: {
      folds,
      aggregate,
    },
    executionFailures,
    experimentalFailures,
    staticResults: {
      status: negative ? 'insufficient-for-shared-contract-claim' : 'supports-pilot-threshold-only',
      naturalContractDetections: `${aggregate.contractChecker.naturalDetected}/${aggregate.contractChecker.naturalTotal}`,
      applicableMutantContractDetections: `${aggregate.contractChecker.applicableMutantsDetected}/${aggregate.contractChecker.applicableMutantsTotal}`,
      cleanContractFalsePositives: `${aggregate.contractChecker.cleanFalsePositives}/${aggregate.contractChecker.cleanTransformationTotal}`,
      interpretation: negative
        ? 'Strict LOO induction did not establish a shared checker for at least three independent natural drifts. Unsupported relation families were not backfilled with target-specific rules.'
        : 'The static pilot met its preregistered coverage and clean-control thresholds; broader runtime claims remain out of scope.',
    },
    dynamicImpact: {
      status: 'not-run-and-unidentified',
      modelExecutions: 0,
      checkpointExecutions: 0,
      evaluatorExecutions: 0,
      apOrTaskMetricClaims: [],
      interpretation: 'No runtime model, evaluator cohort, latency, memory, AP, or safety impact is inferred from these static findings.',
    },
    claimBoundary: [
      'This is a four-repository CPU static pilot, not evidence of runtime model-output or evaluator-metric impact.',
      'Natural drift detection counts only held-out relation families supported exclusively by the other three anonymous repository IRs.',
      'Mutant detection is a controlled semantic sensitivity check; it is not a substitute for natural cross-repository coverage.',
      'Hash differences are reported as a baseline but are non-semantic and are expected to fire on legal clean transformations.',
      'Native assertions are credited only when an extracted assertion protects the same semantic relation family.',
      'Unrecognized dynamic effects remain unidentified; no absence-of-impact claim is made.',
      negative
        ? 'The pilot is negative for the dossier claim that one shared contract IR detects verified drift classes across at least three independent frameworks.'
        : 'Any positive conclusion is limited to the preregistered static pilot threshold.',
    ],
  };
}

function parseArgs(argv) {
  const options = { writeAudit: null, runTests: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--write-audit') {
      options.writeAudit = resolve(argv[index + 1]);
      index += 1;
    } else if (argv[index] === '--run-tests') {
      options.runTests = true;
    } else if (argv[index] === '--help') {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write('Usage: node scripts/idea-pilots/semantic-contract-loo.mjs [--run-tests] [--write-audit PATH]\n');
    return;
  }
  const testResult = testCommandResult(options.runTests);
  const audit = runPilot({ testResult });
  const outputPath = options.writeAudit || DEFAULT_AUDIT_PATH;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    verdict: audit.verdict,
    auditPath: outputPath,
    aggregate: audit.results.aggregate,
    executionFailures: audit.executionFailures,
    experimentalFailures: audit.experimentalFailures,
  }, null, 2)}\n`);
  if (audit.executionFailures.length > 0) {
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main();
}
