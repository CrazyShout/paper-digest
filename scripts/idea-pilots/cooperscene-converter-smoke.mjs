#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import {
  crc32,
  readZipMember,
} from "./cooperscene-release-lineage.mjs";

export const BUNDLED_PYTHON =
  "/Users/atlas/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
export const FIXED_COMMIT =
  "0945b52ce7a9765ae17d9c8ffa5e2e8573fef19a";
export const CONVERTER_PATH =
  "tools/dataset_converters/coop_data_converter.py";
export const HELPER_PATH =
  "tools/dataset_converters/data_converter.py";

export const PINNED_INPUTS = {
  central: {
    path: "/private/tmp/cooperscene-mini-central.json",
    bytes: 283250,
    sha256: "f8686d3db3727380430cfe48ad6613f2828535783505d086383d739e93f36e5d",
  },
  archivePrefix: {
    path: "/private/tmp/cooperscene-mini.zip",
    bytes: 875724800,
    sha256: "3fbd8e3833b9417bcec2680781c1c00dd6bca53d13ab99195ebeaafa6db4788c",
  },
  releasedTestIndex: {
    path: "/private/tmp/cooperscene-mini-test.pkl",
    bytes: 182702,
    sha256: "d1d6c1f74f1159f99098534c5243a7e59722a2820d514394805c597a0a312789",
  },
};

const PINNED_SOURCE_HASHES = {
  [CONVERTER_PATH]:
    "679453ec927e86a21d60acc8ad9eebc6490b81d943f2d75b34c93e40b2ad9e68",
  [HELPER_PATH]:
    "17280b7851c4d3c43b2475167e3384e9eee5d53ff715862b0a6a61b4a8d0e94e",
};

const EXPECTED_TEST_MEMBER_COUNTS = {
  directory: 6,
  pcd: 120,
  png: 90,
  yaml: 120,
};

const EXPECTED_METAINFO = {
  classes: ["vehicle"],
  categories: { vehicle: 0 },
  dataset: "CooperScene",
  info_version: "1.0",
  cooperative: true,
};

export const SHIM_SOURCES = {
  "mmengine.py": [
    "import pickle",
    "",
    "def dump(obj, path):",
    "    with open(path, 'wb') as stream:",
    "        pickle.dump(obj, stream, protocol=2)",
    "",
  ].join("\n"),
  "tqdm.py": [
    "def tqdm(iterable, *args, **kwargs):",
    "    return iterable",
    "",
  ].join("\n"),
};

export const ACCESS_AUDIT_SOURCE = [
  "import atexit",
  "import json",
  "import os",
  "import sys",
  "",
  "root = os.environ.get('COOPERSCENE_AUDIT_ROOT')",
  "trace_path = os.environ.get('COOPERSCENE_AUDIT_TRACE')",
  "events = []",
  "",
  "if root and trace_path:",
  "    root = os.path.abspath(root)",
  "",
  "    def audit(event, args):",
  "        if event != 'open' or not args or not isinstance(args[0], (str, bytes)):",
  "            return",
  "        path = os.path.abspath(os.fsdecode(args[0]))",
  "        if path == root or path.startswith(root + os.sep):",
  "            events.append({",
  "                'path': path,",
  "                'mode': args[1] if len(args) > 1 else None,",
  "                'flags': args[2] if len(args) > 2 else None,",
  "            })",
  "",
  "    def finish():",
  "        with open(trace_path, 'w', encoding='utf-8') as stream:",
  "            json.dump(events, stream, sort_keys=True, separators=(',', ':'))",
  "",
  "    sys.addaudithook(audit)",
  "    atexit.register(finish)",
  "",
].join("\n");

const PICKLE_ALLOWED_OPCODES = [
  "APPEND",
  "APPENDS",
  "BINFLOAT",
  "BINGET",
  "BININT1",
  "BINPUT",
  "BINUNICODE",
  "EMPTY_DICT",
  "EMPTY_LIST",
  "LONG_BINGET",
  "LONG_BINPUT",
  "MARK",
  "NEWTRUE",
  "PROTO",
  "SETITEM",
  "SETITEMS",
  "STOP",
  "TUPLE1",
];

const PICKLE_INSPECTOR = String.raw`
import collections
import hashlib
import io
import json
import pickle
import pickletools
import sys

path = sys.argv[1]
allowed = set(sys.argv[2].split(','))
blob = open(path, 'rb').read()
if len(blob) > 20 * 1024 * 1024:
    raise SystemExit('pickle exceeds 20 MiB inspection limit')

ops = list(pickletools.genops(blob))
op_counts = collections.Counter(op.name for op, arg, pos in ops)
forbidden = sorted(set(op_counts) - allowed)
if forbidden:
    raise SystemExit('forbidden pickle opcodes: ' + ','.join(forbidden))

class RestrictedUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        raise pickle.UnpicklingError(
            'class lookup denied: ' + module + '.' + name)

payload = RestrictedUnpickler(io.BytesIO(blob)).load()

def check_plain(value, location='$'):
    if value is None or isinstance(value, (str, int, float, bool)):
        return
    if isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            check_plain(item, location + '[' + str(index) + ']')
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, (str, int, float, bool)):
                raise TypeError('non-plain key at ' + location)
            check_plain(item, location + '.' + str(key))
        return
    raise TypeError(
        'non-plain value at ' + location + ': ' + type(value).__name__)

check_plain(payload)
if not isinstance(payload, dict) or set(payload) != {'data_list', 'metainfo'}:
    raise ValueError('unexpected top-level payload shape')

def stable_json(value):
    return json.dumps(
        value,
        sort_keys=True,
        separators=(',', ':'),
        ensure_ascii=True,
        allow_nan=False,
    )

def timestamp(value):
    number = float(value)
    return str(int(number)) if number.is_integer() else format(number, '.17g')

rows = []
for row in payload['data_list']:
    source_paths = [row['lidar_points']['lidar_path']]
    source_paths.extend(
        item['lidar_points']['lidar_path']
        for item in row.get('cooperators', []))
    rows.append({
        'sampleIdx': row['sample_idx'],
        'scenario': str(row['scenario']),
        'timestamp': timestamp(row['timestamp']),
        'egoAgentId': str(row['agent_id']),
        'cooperatorAgentIds': sorted(
            str(item['agent_id']) for item in row.get('cooperators', [])),
        'sourcePaths': sorted(source_paths),
        'instanceCount': len(row.get('instances', [])),
    })

print(stable_json({
    'pickleBytes': len(blob),
    'pickleSha256': hashlib.sha256(blob).hexdigest(),
    'protocol': next((arg for op, arg, pos in ops if op.name == 'PROTO'), 0),
    'opcodeCounts': dict(sorted(op_counts.items())),
    'allowedOpcodes': sorted(allowed),
    'classLookupPolicy': 'deny-all',
    'plainValuePolicy': 'dict/list/tuple/string/integer/float/boolean/null only',
    'payloadSha256': hashlib.sha256(
        stable_json(payload).encode('ascii')).hexdigest(),
    'metainfo': payload['metainfo'],
    'rows': rows,
}))
`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalDigest(value) {
  return sha256(Buffer.from(stableJson(value)));
}

function crcHex(value) {
  return `0x${value.toString(16).padStart(8, "0")}`;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort());
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    command,
    args,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message ?? null,
  };
}

function requireRun(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status}): `
      + `${result.stderr || result.stdout || result.error}`,
    );
  }
  return result.stdout;
}

function formatCommand(tokens) {
  return tokens.map((token) =>
    /^[A-Za-z0-9_./:<>=+-]+$/.test(token)
      ? token
      : JSON.stringify(token)).join(" ");
}

function assertEqual(actual, expected, label) {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(
      `${label} mismatch: ${stableJson(actual)} != ${stableJson(expected)}`,
    );
  }
}

function checkedTarget(root, memberName) {
  if (!memberName.startsWith("mini/")) {
    throw new Error(`member is outside mini/: ${memberName}`);
  }
  const target = resolve(root, memberName.slice("mini/".length));
  const absoluteRoot = resolve(root);
  if (target !== absoluteRoot && !target.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error(`member escapes mini root: ${memberName}`);
  }
  return target;
}

function memberKind(name) {
  if (name.endsWith("/")) return "directory";
  const match = name.match(
    /^mini\/test\/[^/]+\/[^/]+\/[^/]+(?:_camera0)?\.(yaml|pcd|png)$/,
  );
  if (!match) throw new Error(`unexpected test member: ${name}`);
  return match[1];
}

export function prepareMiniInput({
  centralEntries,
  archivePrefixPath,
  miniRoot,
  expectedCounts = EXPECTED_TEST_MEMBER_COUNTS,
}) {
  const entries = centralEntries
    .filter((entry) => entry.name.startsWith("mini/test/"))
    .sort((left, right) => left.name.localeCompare(right.name));
  const names = new Set(entries.map((entry) => entry.name));
  if (names.size !== entries.length) {
    throw new Error("central inventory has duplicate test member names");
  }
  const counts = countBy(entries.map((entry) => memberKind(entry.name)));
  if (expectedCounts) assertEqual(counts, expectedCounts, "test member counts");

  mkdirSync(miniRoot, { recursive: true });
  const prefixBytes = statSync(archivePrefixPath).size;
  const yamlIdentities = [];
  const stubIdentities = [];
  let firstYamlRaw = null;
  const fd = openSync(archivePrefixPath, "r");
  try {
    for (const entry of entries) {
      const kind = memberKind(entry.name);
      const target = checkedTarget(miniRoot, entry.name);
      if (kind === "directory") {
        mkdirSync(target, { recursive: true });
        continue;
      }
      mkdirSync(dirname(target), { recursive: true });
      if (kind === "yaml") {
        const { raw, identity } = readZipMember(fd, entry, prefixBytes);
        writeFileSync(target, raw);
        if (firstYamlRaw === null) firstYamlRaw = Buffer.from(raw);
        yamlIdentities.push({
          name: identity.name,
          bytes: identity.uncompressedBytes,
          crc32: identity.crc32,
          sha256: identity.sha256,
        });
        continue;
      }
      writeFileSync(target, Buffer.alloc(0));
      stubIdentities.push({
        name: entry.name,
        kind,
        officialBytesFromCentralInventory: entry.uncompressedSize,
        officialCrc32FromCentralInventory: crcHex(entry.crc),
        stubBytes: 0,
        stubSha256: sha256(Buffer.alloc(0)),
      });
    }
  } finally {
    closeSync(fd);
  }

  return {
    counts,
    prefixBytes,
    yamlIdentities,
    yamlManifestSha256: canonicalDigest(yamlIdentities),
    stubIdentities,
    stubManifestSha256: canonicalDigest(stubIdentities),
    firstYamlRaw,
  };
}

export function inspectPlainPickle(path, python = BUNDLED_PYTHON) {
  const result = run(python, [
    "-I",
    "-c",
    PICKLE_INSPECTOR,
    path,
    PICKLE_ALLOWED_OPCODES.join(","),
  ]);
  if (result.status !== 0) {
    throw new Error(
      `restricted pickle inspection failed: `
      + `${result.stderr || result.stdout || result.error}`.trim(),
    );
  }
  return JSON.parse(result.stdout);
}

function isReadEvent(event) {
  if (typeof event.mode === "string") {
    return event.mode.includes("r") || event.mode.includes("+");
  }
  if (Number.isInteger(event.flags)) {
    return (event.flags & 3) !== 1;
  }
  return true;
}

export function summarizeFileAccess(events, materialized) {
  const stubPaths = new Map(materialized.stubIdentities.map((item) => [
    resolve(materialized.miniRoot, item.name.slice("mini/".length)),
    item.kind,
  ]));
  const yamlPaths = new Set(materialized.yamlIdentities.map((item) =>
    resolve(materialized.miniRoot, item.name.slice("mini/".length))));
  const reads = events.filter(isReadEvent);
  const stubReads = reads.filter((event) => stubPaths.has(resolve(event.path)));
  const yamlReads = reads.filter((event) => yamlPaths.has(resolve(event.path)));
  return {
    auditEventCount: events.length,
    readEventCount: reads.length,
    uniqueYamlPathsRead: new Set(yamlReads.map((event) =>
      resolve(event.path))).size,
    yamlReadEventCount: yamlReads.length,
    stubReadEventCount: stubReads.length,
    uniqueStubPathsRead: new Set(stubReads.map((event) =>
      resolve(event.path))).size,
    stubReadsByKind: countBy(stubReads.map((event) =>
      stubPaths.get(resolve(event.path)))),
    stubReadPaths: [...new Set(stubReads.map((event) => resolve(event.path)))],
  };
}

function projectionKey(row) {
  return `${row.scenario}/${row.timestamp}/${row.egoAgentId}`;
}

function compareProjectionKeys(generatedRows, releasedRows) {
  const generated = [...new Set(generatedRows.map(projectionKey))].sort();
  const releasedVehicles = [...new Set(releasedRows
    .filter((row) => ["1", "2", "3"].includes(row.egoAgentId))
    .map(projectionKey))].sort();
  const generatedSet = new Set(generated);
  const releasedSet = new Set(releasedVehicles);
  const missing = releasedVehicles.filter((key) => !generatedSet.has(key));
  const unexpected = generated.filter((key) => !releasedSet.has(key));
  return {
    keySchema: ["scenario", "timestamp", "egoAgentId"],
    generatedVehicleKeyCount: generated.length,
    releasedVehicleKeyCount: releasedVehicles.length,
    generatedManifestSha256: canonicalDigest(generated),
    releasedVehicleManifestSha256: canonicalDigest(releasedVehicles),
    exactSetEquality: missing.length === 0 && unexpected.length === 0,
    missingReleasedVehicleKeys: missing,
    unexpectedGeneratedKeys: unexpected,
    generatedKeys: generated,
    releasedVehicleKeys: releasedVehicles,
  };
}

function sourceIdentity(sourceRepo, sourcePath) {
  const absolutePath = resolve(sourceRepo, sourcePath);
  const worktreeBytes = readFileSync(absolutePath);
  const objectBytes = Buffer.from(requireRun(
    "git",
    ["show", `${FIXED_COMMIT}:${sourcePath}`],
    { cwd: sourceRepo },
  ));
  const worktreeSha256 = sha256(worktreeBytes);
  const objectSha256 = sha256(objectBytes);
  if (worktreeSha256 !== PINNED_SOURCE_HASHES[sourcePath]) {
    throw new Error(`worktree source hash mismatch: ${sourcePath}`);
  }
  if (objectSha256 !== PINNED_SOURCE_HASHES[sourcePath]) {
    throw new Error(`Git object source hash mismatch: ${sourcePath}`);
  }
  return {
    path: sourcePath,
    absolutePath,
    bytes: worktreeBytes.length,
    worktreeSha256,
    fixedCommitObjectSha256: objectSha256,
    blobObjectId: requireRun(
      "git",
      ["rev-parse", `${FIXED_COMMIT}:${sourcePath}`],
      { cwd: sourceRepo },
    ).trim(),
    worktreeMatchesFixedCommitObject: true,
  };
}

async function verifiedInput(role, path, expected, options = {}) {
  if (!existsSync(path)) throw new Error(`missing ${role}: ${path}`);
  const recomputeSha256 = options.recomputeSha256 ?? true;
  const observed = {
    role,
    path,
    fileName: basename(path),
    bytes: statSync(path).size,
    sha256: recomputeSha256 ? await sha256File(path) : expected.sha256,
  };
  assertEqual(
    { bytes: observed.bytes, sha256: observed.sha256 },
    { bytes: expected.bytes, sha256: expected.sha256 },
    role,
  );
  return {
    ...observed,
    sha256Verification: recomputeSha256
      ? "recomputed-in-this-run"
      : "not-recomputed-in-this-run; inherited from the prior full-member pilot to avoid reading non-YAML archive payload bytes",
    pinnedIdentityMatches: true,
  };
}

function moduleProbe(python, env) {
  const program = [
    "import json,mmengine,numpy,sys,tqdm,yaml;",
    "print(json.dumps({",
    "'executable':sys.executable,",
    "'python':sys.version,",
    "'mmengine':mmengine.__file__,",
    "'tqdm':tqdm.__file__,",
    "'numpy':{'version':numpy.__version__,'path':numpy.__file__},",
    "'yaml':{'version':yaml.__version__,'path':yaml.__file__}",
    "},sort_keys=True))",
  ].join("");
  return JSON.parse(requireRun(python, ["-c", program], { env }));
}

function buildNegativeControls({
  materialized,
  generated,
  released,
  accessEvents,
  projectionComparison,
  tempRoot,
}) {
  const firstYaml = materialized.yamlIdentities[0];
  const mutatedYaml = Buffer.from(materialized.firstYamlRaw);
  mutatedYaml[0] ^= 0x01;
  const mutatedCrc = crc32(mutatedYaml);
  const expectedCrc = Number.parseInt(firstYaml.crc32.slice(2), 16);

  const unsafePath = join(tempRoot, "unsafe-global.pkl");
  writeFileSync(unsafePath, Buffer.from("cos\nsystem\n.", "ascii"));
  let unsafeError = "";
  try {
    inspectPlainPickle(unsafePath);
  } catch (error) {
    unsafeError = error.message;
  }

  const generatedKeys = new Set(generated.rows.map(projectionKey));
  for (const event of new Set(generated.rows.map((row) =>
    `${row.scenario}/${row.timestamp}`))) {
    generatedKeys.add(`${event}/0`);
  }
  const releasedKeys = new Set(released.rows.map(projectionKey));
  const injectedMatchesReleased = generatedKeys.size === releasedKeys.size
    && [...generatedKeys].every((key) => releasedKeys.has(key));

  const firstStub = resolve(
    materialized.miniRoot,
    materialized.stubIdentities[0].name.slice("mini/".length),
  );
  const injectedAccess = summarizeFileAccess(
    [...accessEvents, { path: firstStub, mode: "r", flags: 0 }],
    materialized,
  );
  const mutatedMetainfo = { ...generated.metainfo, dataset: "OPV2V" };

  return [
    {
      id: "yaml-crc-single-byte-mutation",
      status: mutatedCrc !== expectedCrc ? "passed" : "failed",
      member: firstYaml.name,
      expectedCrc32: firstYaml.crc32,
      mutatedCrc32: crcHex(mutatedCrc),
      assertion: "a one-byte YAML mutation must not retain the central-inventory CRC32",
    },
    {
      id: "restricted-pickle-global-opcode",
      status: /forbidden pickle opcodes: GLOBAL/.test(unsafeError)
        ? "passed"
        : "failed",
      assertion: "GLOBAL must be rejected before restricted unpickling",
      observedError: unsafeError,
    },
    {
      id: "infrastructure-ego-injection",
      status: injectedMatchesReleased ? "passed" : "failed",
      assertion: "injecting ego 0 for every event must reconstruct the 120 released projection keys",
      baselineGeneratedKeys: projectionComparison.generatedVehicleKeyCount,
      injectedKeys: generatedKeys.size,
      releasedAllEgoKeys: releasedKeys.size,
    },
    {
      id: "stub-read-detector-injection",
      status: injectedAccess.stubReadEventCount === 1 ? "passed" : "failed",
      assertion: "a synthetic read event for one existence stub must be detected",
      injectedPath: firstStub,
      observedStubReadEvents: injectedAccess.stubReadEventCount,
    },
    {
      id: "metainfo-dataset-mutation",
      status: stableJson(mutatedMetainfo) !== stableJson(EXPECTED_METAINFO)
        ? "passed"
        : "failed",
      assertion: "changing metainfo.dataset away from CooperScene must break equality",
      mutatedDataset: mutatedMetainfo.dataset,
    },
  ];
}

function parseArgs(argv) {
  const options = {
    central: PINNED_INPUTS.central.path,
    archivePrefix: PINNED_INPUTS.archivePrefix.path,
    releasedTestIndex: PINNED_INPUTS.releasedTestIndex.path,
    priorCertificate:
      "content/idea-audits/cooperative-autonomous-driving-release-population-lineage-pilot-v4.json",
    sourceRepo: existsSync("/private/tmp/paper-digest-cooperscene-audit")
      ? "/private/tmp/paper-digest-cooperscene-audit"
      : "/private/tmp/cooperscene-official",
    generatedAt: null,
    keepTemp: false,
    pretty: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--compact") {
      options.pretty = false;
      continue;
    }
    if (argument === "--keep-temp") {
      options.keepTemp = true;
      continue;
    }
    const key = {
      "--central": "central",
      "--archive-prefix": "archivePrefix",
      "--released-test-index": "releasedTestIndex",
      "--prior-certificate": "priorCertificate",
      "--source-repo": "sourceRepo",
      "--generated-at": "generatedAt",
    }[argument];
    if (!key || index + 1 >= argv.length) {
      throw new Error(`unknown or incomplete argument: ${argument}`);
    }
    options[key] = argv[index + 1];
    index += 1;
  }
  return options;
}

export async function buildEvidence(options) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const sourceRepo = resolve(options.sourceRepo);
  const head = requireRun("git", ["rev-parse", "HEAD"], {
    cwd: sourceRepo,
  }).trim();
  if (head !== FIXED_COMMIT) {
    throw new Error(`source checkout HEAD is ${head}, expected ${FIXED_COMMIT}`);
  }

  const [centralIdentity, prefixIdentity, releasedIdentity] =
    await Promise.all([
      verifiedInput("central-directory-inventory", options.central,
        PINNED_INPUTS.central),
      verifiedInput("official-archive-prefix", options.archivePrefix,
        PINNED_INPUTS.archivePrefix, { recomputeSha256: false }),
      verifiedInput("released-test-index", options.releasedTestIndex,
        PINNED_INPUTS.releasedTestIndex),
    ]);
  const priorCertificatePath = resolve(options.priorCertificate);
  const priorCertificate = JSON.parse(readFileSync(priorCertificatePath));
  const priorMemberEvidence =
    priorCertificate.archivePrefixValidation.suppliedCentralInventory;
  assertEqual(
    {
      testMembers: priorMemberEvidence.testMembers,
      testMemberKinds: priorMemberEvidence.testMemberKinds,
      validated: priorMemberEvidence.testMembersValidatedByLocalNameLengthAndCrc,
      failedMembers: priorMemberEvidence.failedMembers,
    },
    {
      testMembers: 336,
      testMemberKinds: EXPECTED_TEST_MEMBER_COUNTS,
      validated: 336,
      failedMembers: 0,
    },
    "prior full-member verification",
  );
  assertEqual(
    {
      bytes: priorCertificate.archivePrefixValidation.localPrefix.bytes,
      sha256: priorCertificate.archivePrefixValidation.localPrefix.sha256,
    },
    {
      bytes: PINNED_INPUTS.archivePrefix.bytes,
      sha256: PINNED_INPUTS.archivePrefix.sha256,
    },
    "prior archive-prefix identity",
  );

  const sourcesBefore = [
    sourceIdentity(sourceRepo, CONVERTER_PATH),
    sourceIdentity(sourceRepo, HELPER_PATH),
  ];
  const tempRoot = mkdtempSync(join(tmpdir(), "cooperscene-converter-smoke-"));
  const miniRoot = join(tempRoot, "mini");
  const compatRoot = join(tempRoot, "compat");
  const tracePath = join(tempRoot, "python-open-audit.json");
  mkdirSync(compatRoot, { recursive: true });
  for (const [name, source] of Object.entries(SHIM_SOURCES)) {
    writeFileSync(join(compatRoot, name), source);
  }
  writeFileSync(join(compatRoot, "sitecustomize.py"), ACCESS_AUDIT_SOURCE);

  let evidence;
  try {
    const centralEntries = JSON.parse(readFileSync(options.central, "utf8"));
    if (!Array.isArray(centralEntries)) {
      throw new Error("central inventory must be a JSON array");
    }
    const prepared = prepareMiniInput({
      centralEntries,
      archivePrefixPath: options.archivePrefix,
      miniRoot,
    });
    prepared.miniRoot = miniRoot;

    const converterAbsolutePath = resolve(sourceRepo, CONVERTER_PATH);
    const converterArgs = [converterAbsolutePath, "--data-root", miniRoot];
    const converterEnv = {
      ...process.env,
      COOPERSCENE_AUDIT_ROOT: miniRoot,
      COOPERSCENE_AUDIT_TRACE: tracePath,
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONPATH: compatRoot,
    };
    const dependencyProvenance = moduleProbe(BUNDLED_PYTHON, converterEnv);
    const converterRun = run(BUNDLED_PYTHON, converterArgs, {
      cwd: sourceRepo,
      env: converterEnv,
    });
    if (converterRun.status !== 0) {
      throw new Error(
        `public converter failed (${converterRun.status}): `
        + `${converterRun.stderr || converterRun.stdout || converterRun.error}`,
      );
    }
    if (!existsSync(tracePath)) {
      throw new Error("Python open audit did not produce a trace");
    }
    const accessEvents = JSON.parse(readFileSync(tracePath, "utf8"));
    const accessSummary = summarizeFileAccess(accessEvents, prepared);
    assertEqual(accessSummary.stubReadEventCount, 0, "stub read events");
    assertEqual(accessSummary.uniqueYamlPathsRead, 120, "YAML paths read");

    for (const stub of prepared.stubIdentities) {
      const path = checkedTarget(miniRoot, stub.name);
      if (statSync(path).size !== 0) {
        throw new Error(`existence stub was modified: ${stub.name}`);
      }
    }

    const generatedPath = join(
      miniRoot,
      "cooperscene_coop_infos_test.pkl",
    );
    if (!existsSync(generatedPath)) {
      throw new Error("public converter did not write the test pickle");
    }
    const generated = inspectPlainPickle(generatedPath);
    const released = inspectPlainPickle(options.releasedTestIndex);
    const events = [...new Set(generated.rows.map((row) =>
      `${row.scenario}/${row.timestamp}`))].sort();
    const egos = countBy(generated.rows.map((row) => row.egoAgentId));
    const projectionComparison = compareProjectionKeys(
      generated.rows,
      released.rows,
    );
    assertEqual(events.length, 30, "generated physical event count");
    assertEqual(generated.rows.length, 90, "generated row count");
    assertEqual(egos, { 1: 30, 2: 30, 3: 30 }, "generated ego rows");
    assertEqual(generated.metainfo, EXPECTED_METAINFO, "generated metainfo");
    assertEqual(
      projectionComparison.exactSetEquality,
      true,
      "released vehicle projection key equality",
    );

    const negativeControls = buildNegativeControls({
      materialized: prepared,
      generated,
      released,
      accessEvents,
      projectionComparison,
      tempRoot,
    });
    if (negativeControls.some((item) => item.status !== "passed")) {
      throw new Error("one or more negative controls failed");
    }

    const sourcesAfter = [
      sourceIdentity(sourceRepo, CONVERTER_PATH),
      sourceIdentity(sourceRepo, HELPER_PATH),
    ];
    assertEqual(sourcesAfter, sourcesBefore, "public source identities");

    const shimEvidence = Object.entries(SHIM_SOURCES).map(([name, source]) => ({
      name,
      source,
      bytes: Buffer.byteLength(source),
      sha256: sha256(Buffer.from(source)),
      boundary: name === "tqdm.py"
        ? "tqdm.tqdm returns the supplied iterable and implements no progress behavior"
        : "mmengine.dump opens the requested path and uses only standard-library pickle.dump with protocol 2",
    }));
    const scriptPath = resolve(
      "scripts/idea-pilots/cooperscene-converter-smoke.mjs",
    );
    const testPath = resolve("test/cooperscene-converter-smoke.test.mjs");
    const converterCommand = formatCommand([
      `PYTHONPATH=${compatRoot}`,
      "PYTHONDONTWRITEBYTECODE=1",
      `COOPERSCENE_AUDIT_ROOT=${miniRoot}`,
      `COOPERSCENE_AUDIT_TRACE=${tracePath}`,
      BUNDLED_PYTHON,
      ...converterArgs,
    ]);

    evidence = {
      schemaVersion: 1,
      certificateType: "cooperscene-public-converter-execution-smoke",
      certificateId:
        "cooperative-autonomous-driving-converter-execution-smoke-v5",
      generatedAt,
      purpose:
        "Execute the fixed public CooperScene converter on CRC-verified official test YAML while bounding PCD and PNG inputs to unread existence stubs.",
      result:
        "fixed-public-converter-executed-and-matched-released-vehicle-projection-keys",
      executionEnvironment: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        networkUsed: false,
        pythonExecutable: BUNDLED_PYTHON,
        pythonExecutableSha256: await sha256File(BUNDLED_PYTHON),
        dependencyProvenance,
        officialEnvironmentClaimed: false,
      },
      officialInputs: {
        identities: [centralIdentity, prefixIdentity, releasedIdentity],
        archiveBoundary: {
          completeOfficialArchive: false,
          localPrefixBytes: prepared.prefixBytes,
          prefixSha256RecomputedInThisRun: false,
          testYamlRecoveredFromOfficialPrefix: true,
          centralInventoryUsedForOffsetsSizesAndCrc32: true,
        },
        priorFullMemberVerification: {
          path: options.priorCertificate,
          sha256: await sha256File(priorCertificatePath),
          verifiedTestMembers: 336,
          memberKinds: EXPECTED_TEST_MEMBER_COUNTS,
          failedMembers: 0,
          useInThisSmoke:
            "PCD and PNG official payloads were previously read and CRC-verified there; this runner does not read them again.",
        },
      },
      fixedPublicConverter: {
        repository: "https://github.com/UCR-CISL/CooperScene",
        sourceRepo,
        fixedCommit: FIXED_COMMIT,
        checkoutHead: head,
        sourceFilesBefore: sourcesBefore,
        sourceFilesAfter: sourcesAfter,
        sourceFilesUnchangedDuringRun: true,
      },
      temporaryCompatibility: {
        classification:
          "local minimal compatibility modules, not an official CooperScene environment",
        directory: compatRoot,
        modules: shimEvidence,
        accessAudit: {
          name: "sitecustomize.py",
          classification: "instrumentation, not a compatibility shim",
          source: ACCESS_AUDIT_SOURCE,
          bytes: Buffer.byteLength(ACCESS_AUDIT_SOURCE),
          sha256: sha256(Buffer.from(ACCESS_AUDIT_SOURCE)),
          operation:
            "records Python open audit events only for paths below the temporary mini root",
        },
      },
      materialization: {
        temporaryRoot: tempRoot,
        miniRoot,
        memberCounts: prepared.counts,
        realYaml: {
          count: prepared.yamlIdentities.length,
          bytes: prepared.yamlIdentities.reduce(
            (sum, item) => sum + item.bytes,
            0,
          ),
          eachMemberValidatedAgainstCentralLocalNameSizeAndCrc32: true,
          manifestSha256: prepared.yamlManifestSha256,
          firstMember: prepared.yamlIdentities[0],
          lastMember: prepared.yamlIdentities.at(-1),
        },
        existenceStubs: {
          pcdCount: prepared.stubIdentities.filter(
            (item) => item.kind === "pcd",
          ).length,
          pngCount: prepared.stubIdentities.filter(
            (item) => item.kind === "png",
          ).length,
          bytesPerStub: 0,
          sha256PerStub: sha256(Buffer.alloc(0)),
          manifestSha256: prepared.stubManifestSha256,
          officialPayloadBytesMaterializedByThisRunner: 0,
          officialPayloadBytesReadByThisRunner: 0,
          converterStubReadEvents: accessSummary.stubReadEventCount,
          converterUniqueStubPathsRead: accessSummary.uniqueStubPathsRead,
          boundary:
            "Only paths and empty files were created so os.path.exists succeeds. This runner did not recompute the whole-prefix hash and neither copied nor read PCD/PNG local records; the converter opened no PCD/PNG stub for reading.",
        },
      },
      converterExecution: {
        classification: "actual-public-converter-main-execution",
        exactCommand: converterCommand,
        argv: [BUNDLED_PYTHON, ...converterArgs],
        cwd: sourceRepo,
        environmentOverrides: {
          PYTHONPATH: compatRoot,
          PYTHONDONTWRITEBYTECODE: "1",
          COOPERSCENE_AUDIT_ROOT: miniRoot,
          COOPERSCENE_AUDIT_TRACE: tracePath,
        },
        exitCode: converterRun.status,
        signal: converterRun.signal,
        stdout: converterRun.stdout,
        stderr: converterRun.stderr,
        generatedTestPickle: {
          path: generatedPath,
          bytes: generated.pickleBytes,
          sha256: generated.pickleSha256,
          payloadSha256: generated.payloadSha256,
        },
        fileAccess: accessSummary,
      },
      restrictedGeneratedIndexInspection: {
        parser: "pickletools pre-screen plus deny-all find_class unpickler",
        bytesLimit: 20 * 1024 * 1024,
        protocol: generated.protocol,
        allowedOpcodes: generated.allowedOpcodes,
        observedOpcodeCounts: generated.opcodeCounts,
        classLookupPolicy: generated.classLookupPolicy,
        plainValuePolicy: generated.plainValuePolicy,
        physicalEventCount: events.length,
        eventManifestSha256: canonicalDigest(events),
        rowCount: generated.rows.length,
        egoRowsByAgent: egos,
        metainfo: generated.metainfo,
        metainfoMatchesExpectedPublicLiteral: true,
        instanceCountRange: [
          Math.min(...generated.rows.map((row) => row.instanceCount)),
          Math.max(...generated.rows.map((row) => row.instanceCount)),
        ],
      },
      releasedVehicleProjectionComparison: {
        releasedPickleSha256: released.pickleSha256,
        releasedAllEgoRowCount: released.rows.length,
        ...projectionComparison,
      },
      negativeControls,
      claimBoundary: [
        "This is an actual execution of the fixed public converter main entrypoint for the supplied mini test split; train and validate are intentionally absent and skipped.",
        "The execution uses the required bundled Python plus two recorded local compatibility shims. It is not an official CooperScene environment, dependency lock, or container reproduction.",
        "All 120 YAML files contain CRC-verified official bytes. The 120 PCD and 90 PNG files are empty existence stubs whose official payloads were not read by this runner or opened for reading by the converter.",
        "The command omits --convert-pcd, so no point-cloud conversion is exercised. No point or image content, sensor decoding, or model input loading is tested.",
        "The generated pickle is restricted-inspected for plain-value population fields. This smoke does not claim byte parity, annotation parity, bounding-box correctness, or full-release regeneration parity.",
        "Equality is asserted only for the 30 physical-event keys, 90 vehicle-ego projection keys, ego IDs 1/2/3, and public CooperScene metainfo requested here.",
        "The released pickle contributes only its projection keys to the equality check. No benchmark score, model output, metric, ranking, statistical effect, or paper result is read or inferred.",
        "The local archive is an incomplete official prefix. Its sufficiency here is limited to the test YAML members whose complete local records fit inside the prefix and pass central/local identity, size, decompression, and CRC32 checks.",
      ],
      reproducibility: {
        runner: {
          path: "scripts/idea-pilots/cooperscene-converter-smoke.mjs",
          sha256: await sha256File(scriptPath),
        },
        test: {
          path: "test/cooperscene-converter-smoke.test.mjs",
          sha256: existsSync(testPath) ? await sha256File(testPath) : null,
        },
        exactRunnerCommand: formatCommand(process.argv),
        testCommand: "node --test test/cooperscene-converter-smoke.test.mjs",
        outputContract:
          "stdout is evidence JSON; this checked-in audit records one completed official-input execution",
      },
    };
  } finally {
    if (!options.keepTemp) rmSync(tempRoot, { recursive: true, force: true });
  }
  evidence.materialization.temporaryDirectoryRetained = options.keepTemp;
  evidence.materialization.temporaryDirectoryRemovedAfterRun =
    !options.keepTemp;
  return evidence;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const evidence = await buildEvidence(options);
  process.stdout.write(
    `${JSON.stringify(evidence, null, options.pretty ? 2 : 0)}\n`,
  );
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
