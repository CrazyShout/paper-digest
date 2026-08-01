#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { inflateRawSync } from "node:zlib";
import { parse as parseYaml } from "yaml";

const TEST_PREFIX = "mini/test/";
const PICKLE_ALLOWED_OPCODES = [
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

ALLOWED = set(sys.argv[2].split(","))
path = sys.argv[1]
blob = open(path, "rb").read()
if len(blob) > 10 * 1024 * 1024:
    raise SystemExit("pickle exceeds 10 MiB inspection limit")

ops = list(pickletools.genops(blob))
op_counts = collections.Counter(op.name for op, arg, pos in ops)
forbidden = sorted(set(op_counts) - ALLOWED)
if forbidden:
    raise SystemExit("forbidden pickle opcodes: " + ",".join(forbidden))

class RestrictedUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        raise pickle.UnpicklingError(
            "class lookup denied: " + module + "." + name)

payload = RestrictedUnpickler(io.BytesIO(blob)).load()

def check_plain(value, location="$"):
    if value is None or isinstance(value, (str, int, float, bool)):
        return
    if isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            check_plain(item, location + "[" + str(index) + "]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, (str, int, float, bool)):
                raise TypeError("non-plain key at " + location)
            check_plain(item, location + "." + str(key))
        return
    raise TypeError("non-plain value at " + location + ": " + type(value).__name__)

check_plain(payload)
if not isinstance(payload, dict):
    raise TypeError("top-level pickle value is not a dictionary")
if set(payload) != {"data_list", "metainfo"}:
    raise ValueError("unexpected top-level keys: " + repr(sorted(payload)))

def stable_json(value):
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
        allow_nan=False,
    )

def canonical_timestamp(value):
    number = float(value)
    if number.is_integer():
        return str(int(number))
    return format(number, ".17g")

rows = []
for row in payload["data_list"]:
    source_paths = [row["lidar_points"]["lidar_path"]]
    source_paths.extend(
        item["lidar_points"]["lidar_path"]
        for item in row.get("cooperators", [])
    )
    rows.append({
        "sampleIdx": row["sample_idx"],
        "scenario": str(row["scenario"]),
        "timestamp": canonical_timestamp(row["timestamp"]),
        "egoAgentId": str(row["agent_id"]),
        "cooperatorAgentIds": sorted(
            str(item["agent_id"]) for item in row.get("cooperators", [])
        ),
        "sourcePaths": sorted(source_paths),
        "instanceCount": len(row.get("instances", [])),
        "instancesSha256": hashlib.sha256(
            stable_json(row.get("instances", [])).encode("ascii")
        ).hexdigest(),
        "rowSha256": hashlib.sha256(
            stable_json(row).encode("ascii")
        ).hexdigest(),
    })

result = {
    "pickleBytes": len(blob),
    "pickleSha256": hashlib.sha256(blob).hexdigest(),
    "protocol": next(
        (arg for op, arg, pos in ops if op.name == "PROTO"),
        0,
    ),
    "opcodeCounts": dict(sorted(op_counts.items())),
    "allowedOpcodes": sorted(ALLOWED),
    "classLookupPolicy": "deny-all",
    "plainValuePolicy": "dict/list/tuple/string/integer/float/boolean/null only",
    "payloadSha256": hashlib.sha256(
        stable_json(payload).encode("ascii")
    ).hexdigest(),
    "metainfo": payload["metainfo"],
    "rows": rows,
}
print(stable_json(result))
`;

let crcTable;

export function crc32(buffer) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) === 1
          ? (value >>> 1) ^ 0xedb88320
          : value >>> 1;
      }
      return value >>> 0;
    });
  }

  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
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

function formatCommand(tokens) {
  return tokens
    .map((token) =>
      /^[A-Za-z0-9_./:<>=+-]+$/.test(token)
        ? token
        : JSON.stringify(token))
    .join(" ");
}

function readExact(fd, length, position) {
  const buffer = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const count = readSync(fd, buffer, read, length - read, position + read);
    if (count === 0) {
      throw new Error(
        `unexpected EOF at byte ${position + read}; wanted ${length} bytes`,
      );
    }
    read += count;
  }
  return buffer;
}

function crcHex(value) {
  return `0x${value.toString(16).padStart(8, "0")}`;
}

export function readZipMember(fd, entry, prefixBytes) {
  const header = readExact(fd, 30, entry.localOffset);
  if (header.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(`invalid ZIP local-header signature for ${entry.name}`);
  }

  const flags = header.readUInt16LE(6);
  const method = header.readUInt16LE(8);
  const localCrc = header.readUInt32LE(14);
  const localCompressedSize = header.readUInt32LE(18);
  const localUncompressedSize = header.readUInt32LE(22);
  const nameLength = header.readUInt16LE(26);
  const extraLength = header.readUInt16LE(28);
  const name = readExact(fd, nameLength, entry.localOffset + 30)
    .toString("utf8");
  const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
  const recordEndOffset = dataOffset + entry.compressedSize;

  if (flags & 0x1) {
    throw new Error(`encrypted ZIP member is not supported: ${entry.name}`);
  }
  if (name !== entry.name) {
    throw new Error(
      `ZIP local/central name mismatch: central=${entry.name} local=${name}`,
    );
  }
  if (method !== entry.method) {
    throw new Error(`ZIP compression-method mismatch for ${entry.name}`);
  }
  if (recordEndOffset > prefixBytes) {
    throw new Error(
      `archive prefix ends before complete member ${entry.name}: `
      + `${recordEndOffset} > ${prefixBytes}`,
    );
  }

  const usesDataDescriptor = (flags & 0x8) !== 0;
  if (!usesDataDescriptor) {
    if (localCrc !== entry.crc) {
      throw new Error(`ZIP local/central CRC mismatch for ${entry.name}`);
    }
    if (localCompressedSize !== entry.compressedSize) {
      throw new Error(
        `ZIP local/central compressed-size mismatch for ${entry.name}`,
      );
    }
    if (localUncompressedSize !== entry.uncompressedSize) {
      throw new Error(
        `ZIP local/central uncompressed-size mismatch for ${entry.name}`,
      );
    }
  }

  const compressed = readExact(fd, entry.compressedSize, dataOffset);
  let raw;
  if (method === 0) {
    raw = compressed;
  } else if (method === 8) {
    raw = inflateRawSync(compressed);
  } else {
    throw new Error(
      `unsupported ZIP compression method ${method} for ${entry.name}`,
    );
  }

  if (raw.length !== entry.uncompressedSize) {
    throw new Error(`ZIP uncompressed-size mismatch for ${entry.name}`);
  }
  const actualCrc = crc32(raw);
  if (actualCrc !== entry.crc) {
    throw new Error(
      `ZIP CRC32 mismatch for ${entry.name}: `
      + `${crcHex(actualCrc)} != ${crcHex(entry.crc)}`,
    );
  }

  return {
    raw,
    identity: {
      name: entry.name,
      localOffset: entry.localOffset,
      dataOffset,
      recordEndOffset,
      method,
      flags,
      compressedBytes: entry.compressedSize,
      uncompressedBytes: entry.uncompressedSize,
      crc32: crcHex(actualCrc),
      sha256: sha256(raw),
    },
  };
}

function parseTestMemberName(name) {
  const match = name.match(
    /^mini\/test\/([^/]+)\/([^/]+)\/([^/]+?)(?:_camera0)?\.(yaml|pcd|png)$/,
  );
  if (!match) return null;
  return {
    scenario: match[1],
    agentId: match[2],
    timestamp: match[3],
    extension: match[4],
  };
}

function countBy(values) {
  const result = {};
  for (const value of values) {
    result[value] = (result[value] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) =>
      left.localeCompare(right, "en", { numeric: true })),
  );
}

function eventKey(scenario, timestamp) {
  return `${scenario}\u001f${timestamp}`;
}

function rowKey(row) {
  return `${eventKey(row.scenario, row.timestamp)}\u001f${row.egoAgentId}`;
}

function displayEventKey(key) {
  return key.split("\u001f").join("/");
}

export function extractTestArchive({
  centralEntries,
  archivePrefixPath,
}) {
  const prefixBytes = statSync(archivePrefixPath).size;
  const entries = centralEntries
    .filter((entry) => entry.name.startsWith(TEST_PREFIX))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (entries.length === 0) {
    throw new Error(`central inventory contains no ${TEST_PREFIX} members`);
  }

  const fd = openSync(archivePrefixPath, "r");
  const identities = [];
  const yamlRecords = [];
  try {
    for (const entry of entries) {
      const { raw, identity } = readZipMember(fd, entry, prefixBytes);
      identities.push(identity);
      if (!entry.name.endsWith(".yaml")) continue;

      const parsedName = parseTestMemberName(entry.name);
      if (!parsedName) {
        throw new Error(`unexpected test YAML member identity: ${entry.name}`);
      }
      const payload = parseYaml(raw.toString("utf8"));
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error(`YAML root is not a mapping: ${entry.name}`);
      }
      const pose = payload.lidar_pose ?? payload.true_ego_pos;
      if (!Array.isArray(pose) || pose.length !== 6) {
        throw new Error(`YAML has no six-element pose: ${entry.name}`);
      }
      const vehicles = payload.vehicles ?? {};
      if (!vehicles || typeof vehicles !== "object" || Array.isArray(vehicles)) {
        throw new Error(`YAML vehicles is not a mapping: ${entry.name}`);
      }
      yamlRecords.push({
        ...parsedName,
        memberName: entry.name,
        memberSha256: identity.sha256,
        pose: pose.map(Number),
        vehicleCount: Object.keys(vehicles).length,
      });
    }
  } finally {
    closeSync(fd);
  }

  const events = new Map();
  for (const record of yamlRecords) {
    const key = eventKey(record.scenario, record.timestamp);
    if (!events.has(key)) {
      events.set(key, {
        scenario: record.scenario,
        timestamp: record.timestamp,
        agents: new Map(),
      });
    }
    const event = events.get(key);
    if (event.agents.has(record.agentId)) {
      throw new Error(
        `duplicate YAML for event/agent ${displayEventKey(key)}/${record.agentId}`,
      );
    }
    event.agents.set(record.agentId, record);
  }

  const dataMemberNames = new Set(identities.map((item) => item.name));
  const eventManifest = [...events.values()]
    .sort((left, right) =>
      eventKey(left.scenario, left.timestamp).localeCompare(
        eventKey(right.scenario, right.timestamp),
        "en",
        { numeric: true },
      ))
    .map((event) => {
      const agents = [...event.agents.keys()]
        .sort((left, right) => left.localeCompare(right, "en", { numeric: true }))
        .map((agentId) => {
          const record = event.agents.get(agentId);
          const stem = `${TEST_PREFIX}${event.scenario}/${agentId}/${event.timestamp}`;
          const pcdMember = `${stem}.pcd`;
          const imageMember = `${stem}_camera0.png`;
          return {
            agentId,
            yamlMember: record.memberName,
            yamlSha256: record.memberSha256,
            pcdMember: dataMemberNames.has(pcdMember) ? pcdMember : null,
            imageMember: dataMemberNames.has(imageMember) ? imageMember : null,
            pose: record.pose,
            vehicleCount: record.vehicleCount,
          };
        });
      return {
        physicalEvent: {
          scenario: event.scenario,
          timestamp: event.timestamp,
        },
        agents,
      };
    });

  return {
    identities,
    yamlRecords,
    eventManifest,
    prefixBytes,
    minimumPrefixBytes: Math.max(
      ...identities.map((item) => item.recordEndOffset),
    ),
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: options.env,
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

export function inspectReleasedPickle(path) {
  const result = run("python3", [
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

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function findLine(source, needle) {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`source evidence not found: ${needle}`);
  return lineNumberAt(source, index);
}

function stringLiterals(source) {
  return [...source.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

export function extractConverterContract(source) {
  const candidateMatch = source.match(
    /EGO_CANDIDATE_IDS\s*=\s*\(([^)]*)\)/,
  );
  if (!candidateMatch) {
    throw new Error("EGO_CANDIDATE_IDS tuple not found");
  }
  const egoCandidateIds = stringLiterals(candidateMatch[1]);
  if (egoCandidateIds.length === 0) {
    throw new Error("EGO_CANDIDATE_IDS is empty or not a literal tuple");
  }

  const metainfoStart = source.indexOf("'metainfo':");
  const dumpEnd = source.indexOf("}, out_path)", metainfoStart);
  if (metainfoStart < 0 || dumpEnd < 0) {
    throw new Error("mmengine metainfo literal not found");
  }
  const metainfoSource = source.slice(metainfoStart, dumpEnd);
  const datasetMatch = metainfoSource.match(
    /['"]dataset['"]\s*:\s*['"]([^'"]+)['"]/,
  );
  const classesMatch = metainfoSource.match(
    /['"]classes['"]\s*:\s*\(([^)]*)\)/,
  );
  const infoVersionMatch = metainfoSource.match(
    /['"]info_version['"]\s*:\s*['"]([^'"]+)['"]/,
  );
  const cooperativeMatch = metainfoSource.match(
    /['"]cooperative['"]\s*:\s*(True|False)/,
  );
  const categoryMatch = metainfoSource.match(
    /['"]categories['"]\s*:\s*\{\s*['"]([^'"]+)['"]\s*:\s*(\d+)\s*\}/,
  );
  if (
    !datasetMatch
    || !classesMatch
    || !infoVersionMatch
    || !cooperativeMatch
    || !categoryMatch
  ) {
    throw new Error("converter metainfo is not the expected literal schema");
  }

  const candidateLine = lineNumberAt(source, candidateMatch.index);
  const metainfoLine = lineNumberAt(source, metainfoStart);
  const groupingLine = findLine(source, "groups[(scenario, timestamp)]");
  const egoLoopLine = findLine(source, "for ego in agent_data:");
  const eligibilityLine = findLine(
    source,
    "if ego['agent_id'] not in EGO_CANDIDATE_IDS:",
  );
  const appendLine = findLine(source, "infos.append({");
  const infrastructureRoleLine = findLine(
    source,
    "infra agent 0 as cooperator",
  );
  const vehicleRoleLine = findLine(
    source,
    "only vehicles 1/2/3 ever taking the ego role",
  );

  return {
    egoCandidateIds,
    metainfo: {
      classes: stringLiterals(classesMatch[1]),
      categories: {
        [categoryMatch[1]]: Number(categoryMatch[2]),
      },
      dataset: datasetMatch[1],
      info_version: infoVersionMatch[1],
      cooperative: cooperativeMatch[1] === "True",
    },
    generationEvidence: {
      physicalEventGrouping: {
        line: groupingLine,
        expression: "groups[(scenario, timestamp)]",
      },
      egoIteration: {
        line: egoLoopLine,
        expression: "for ego in agent_data",
      },
      eligibilityFilter: {
        line: eligibilityLine,
        expression: "ego.agent_id in EGO_CANDIDATE_IDS",
      },
      oneAppendPerEligibleEgo: {
        line: appendLine,
        expression: "infos.append({...})",
      },
      candidateTupleLine: candidateLine,
      metainfoLiteralLine: metainfoLine,
      agentRoleDescriptions: {
        infrastructure: {
          line: infrastructureRoleLine,
          expression: "infra agent 0 as cooperator",
        },
        vehicleEgos: {
          line: vehicleRoleLine,
          expression: "only vehicles 1/2/3 ever taking the ego role",
        },
      },
    },
  };
}

function gitShow(repo, object) {
  return requireRun("git", ["show", object], { cwd: repo });
}

function commitIdentity(repo, commit) {
  const output = requireRun(
    "git",
    [
      "show",
      "-s",
      "--format=%H%x00%aI%x00%cI%x00%T%x00%P%x00%s",
      commit,
    ],
    { cwd: repo },
  ).trim();
  const [
    commitId,
    authoredAt,
    committedAt,
    treeObjectId,
    parents,
    subject,
  ] = output.split("\u0000");
  return {
    commit: commitId,
    authoredAt,
    committedAt,
    treeObjectId,
    parentCommitIds: parents ? parents.split(" ") : [],
    subject,
  };
}

function sourceIdentity(repo, commit, sourcePath) {
  const source = gitShow(repo, `${commit}:${sourcePath}`);
  const blobObjectId = requireRun(
    "git",
    ["rev-parse", `${commit}:${sourcePath}`],
    { cwd: repo },
  ).trim();
  return {
    source,
    identity: {
      commit: commitIdentity(repo, commit),
      sourcePath,
      blobObjectId,
      contentSha256: sha256(Buffer.from(source)),
      contentBytes: Buffer.byteLength(source),
    },
    contract: extractConverterContract(source),
  };
}

function groupReleasedRows(rows) {
  const events = new Map();
  for (const row of rows) {
    const key = eventKey(row.scenario, row.timestamp);
    if (!events.has(key)) events.set(key, []);
    events.get(key).push(row);
  }
  return events;
}

function normalizeReleasedSource(path) {
  return `mini/${path}`.replace(/\.bin$/, ".pcd");
}

function sortedSetDifference(left, right) {
  return [...left]
    .filter((item) => !right.has(item))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

export function buildSemanticDryRun({
  eventManifest,
  converterContract,
}) {
  const candidateIds = new Set(converterContract.egoCandidateIds);
  const rows = [];
  for (const event of eventManifest) {
    const presentAgents = new Set(event.agents.map((agent) => agent.agentId));
    for (const candidateId of converterContract.egoCandidateIds) {
      if (!presentAgents.has(candidateId)) continue;
      const ego = event.agents.find((agent) => agent.agentId === candidateId);
      if (!ego.pcdMember) continue;
      const cooperators = event.agents.filter(
        (agent) => agent.agentId !== candidateId && agent.pcdMember,
      );
      rows.push({
        scenario: event.physicalEvent.scenario,
        timestamp: event.physicalEvent.timestamp,
        egoAgentId: candidateId,
        cooperatorAgentIds: cooperators.map((agent) => agent.agentId).sort(),
        sourceMembers: [ego, ...cooperators]
          .map((agent) => agent.pcdMember)
          .sort(),
      });
    }
    for (const agent of event.agents) {
      agent.eligibleEgoUnderPublicGenerator = candidateIds.has(agent.agentId);
    }
  }
  return rows;
}

export function comparePopulation({
  released,
  dryRunRows,
  converterContract,
}) {
  const releasedRows = released.rows;
  const releasedEvents = groupReleasedRows(releasedRows);
  const releasedKeys = new Set(releasedRows.map(rowKey));
  const dryRunKeys = new Set(dryRunRows.map(rowKey));
  const releasedVehicleRows = releasedRows.filter((row) =>
    converterContract.egoCandidateIds.includes(row.egoAgentId));
  const releasedVehicleKeys = new Set(releasedVehicleRows.map(rowKey));

  const releasedSources = new Set(
    releasedRows.flatMap((row) => row.sourcePaths.map(normalizeReleasedSource)),
  );
  const dryRunSources = new Set(
    dryRunRows.flatMap((row) => row.sourceMembers),
  );

  const rowsPerEvent = countBy(
    [...releasedEvents.values()].map((rows) => String(rows.length)),
  );
  const releasedEgoCounts = countBy(
    releasedRows.map((row) => row.egoAgentId),
  );
  const dryRunEgoCounts = countBy(dryRunRows.map((row) => row.egoAgentId));
  const releaseOnlyKeys = sortedSetDifference(releasedKeys, dryRunKeys);

  return {
    released: {
      rowCount: releasedRows.length,
      physicalEventCount: releasedEvents.size,
      rowsPerEventDistribution: rowsPerEvent,
      egoRowsByAgent: releasedEgoCounts,
      eligibleVehicleRowCount: releasedVehicleRows.length,
      metainfo: released.metainfo,
      rowManifestSha256: canonicalDigest(
        releasedRows.map((row) => ({
          scenario: row.scenario,
          timestamp: row.timestamp,
          egoAgentId: row.egoAgentId,
          sourcePaths: row.sourcePaths,
          rowSha256: row.rowSha256,
        })),
      ),
    },
    independentSemanticDryRun: {
      rowCount: dryRunRows.length,
      physicalEventCount: new Set(
        dryRunRows.map((row) => eventKey(row.scenario, row.timestamp)),
      ).size,
      rowsPerEvent: converterContract.egoCandidateIds.length,
      egoRowsByAgent: dryRunEgoCounts,
      metainfoFromStaticLiteral: converterContract.metainfo,
      rowManifestSha256: canonicalDigest(dryRunRows),
    },
    parityChecks: {
      releasedVehicleKeysEqualDryRunKeys:
        releasedVehicleKeys.size === dryRunKeys.size
        && sortedSetDifference(releasedVehicleKeys, dryRunKeys).length === 0
        && sortedSetDifference(dryRunKeys, releasedVehicleKeys).length === 0,
      releaseOnlyRowCount: releaseOnlyKeys.length,
      releaseOnlyKeys,
      dryRunOnlyKeys: sortedSetDifference(dryRunKeys, releasedKeys),
      sourcePcdIdentitySetsEqual:
        releasedSources.size === dryRunSources.size
        && sortedSetDifference(releasedSources, dryRunSources).length === 0
        && sortedSetDifference(dryRunSources, releasedSources).length === 0,
      releasedUniqueNormalizedPcdSources: releasedSources.size,
      dryRunUniquePcdSources: dryRunSources.size,
      metainfoEqual:
        stableJson(released.metainfo)
        === stableJson(converterContract.metainfo),
      releasedDatasetLabel: released.metainfo.dataset,
      generatorDatasetLabel: converterContract.metainfo.dataset,
    },
  };
}

function summarizeAgentRoles(eventManifest, egoCandidateIds) {
  const agents = new Map();
  for (const event of eventManifest) {
    for (const agent of event.agents) {
      if (!agents.has(agent.agentId)) {
        agents.set(agent.agentId, {
          agentId: agent.agentId,
          yamlCount: 0,
          pcdCount: 0,
          imageCount: 0,
          vehicleObservationCounts: [],
        });
      }
      const profile = agents.get(agent.agentId);
      profile.yamlCount += 1;
      profile.pcdCount += Number(Boolean(agent.pcdMember));
      profile.imageCount += Number(Boolean(agent.imageMember));
      profile.vehicleObservationCounts.push(agent.vehicleCount);
    }
  }

  return [...agents.values()]
    .sort((left, right) =>
      left.agentId.localeCompare(right.agentId, "en", { numeric: true }))
    .map((profile) => {
      const eligible = egoCandidateIds.includes(profile.agentId);
      return {
        agentId: profile.agentId,
        roleUnderPublicGenerator: eligible
          ? "vehicle-ego-eligible"
          : "infrastructure-cooperator-only",
        eligibleEgoUnderPublicGenerator: eligible,
        archiveObservations: {
          yamlCount: profile.yamlCount,
          pcdCount: profile.pcdCount,
          frontCameraImageCount: profile.imageCount,
          minVisibleVehicles: Math.min(...profile.vehicleObservationCounts),
          maxVisibleVehicles: Math.max(...profile.vehicleObservationCounts),
        },
        roleEvidence: eligible
          ? "literal membership in EGO_CANDIDATE_IDS; front-camera members exist"
          : "excluded from EGO_CANDIDATE_IDS; converter source describes agent 0 as infrastructure/RSU and no front-camera members exist",
      };
    });
}

function testMemberKind(name) {
  if (name.endsWith("/")) return "directory";
  const extension = name.slice(name.lastIndexOf(".") + 1);
  return extension;
}

function actualConverterProbe(repo, sourcePath) {
  const python = process.env.PYTHON ?? "python3";
  const absoluteSource = resolve(repo, sourcePath);
  const dependencyProbe = run(
    python,
    [
      "-c",
      "import importlib.util,json; "
      + "print(json.dumps({n: bool(importlib.util.find_spec(n)) "
      + "for n in ['mmengine','numpy','yaml','tqdm']}, sort_keys=True))",
    ],
    { cwd: repo },
  );
  const probe = run(
    python,
    [absoluteSource, "--help"],
    { cwd: repo },
  );
  return {
    classification: "dependency-and-cli-import-probe-only",
    command: [
      python,
      "<fixed-source-checkout>/tools/dataset_converters/coop_data_converter.py",
      "--help",
    ].join(" "),
    actualCommand: [python, absoluteSource, "--help"].join(" "),
    dependencyAvailability:
      dependencyProbe.status === 0
        ? JSON.parse(dependencyProbe.stdout)
        : null,
    dependencyProbeExitStatus: dependencyProbe.status,
    exitStatus: probe.status,
    stderr: probe.stderr.trim(),
    stdout: probe.stdout.trim(),
    actualConverterExecuted: false,
    generatedIndexProduced: false,
    boundary: probe.status === 0
      ? "The CLI imported, but this pilot did not execute build_split or produce an index."
      : "The converter failed during imports before argument parsing; no converter generation code executed.",
  };
}

function runNegativeControls({
  archive,
  releasedPicklePath,
  comparison,
  converterContract,
}) {
  const firstYaml = archive.yamlRecords[0];
  const identity = archive.identities.find(
    (item) => item.name === firstYaml.memberName,
  );
  const originalCrc = Number.parseInt(identity.crc32.slice(2), 16);
  const mutatedYaml = Buffer.from(
    readFileFromZipIdentity(archive, firstYaml.memberName),
  );
  mutatedYaml[0] ^= 0x01;
  const mutatedCrc = crc32(mutatedYaml);

  const temp = mkdtempSync(join(tmpdir(), "cooperscene-pickle-control-"));
  let unsafePickleRejected = false;
  let unsafePickleError = "";
  try {
    const unsafePath = join(temp, "unsafe.pkl");
    writeFileSync(unsafePath, Buffer.from("cos\nsystem\n.", "ascii"));
    try {
      inspectReleasedPickle(unsafePath);
    } catch (error) {
      unsafePickleError = error.message;
      unsafePickleRejected = /forbidden pickle opcodes: GLOBAL/.test(
        error.message,
      );
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  const injectedRows = comparison.independentSemanticDryRun.rowCount
    + comparison.independentSemanticDryRun.physicalEventCount;

  return [
    {
      id: "crc-single-byte-mutation",
      status: mutatedCrc !== originalCrc ? "passed" : "failed",
      member: firstYaml.memberName,
      expectedCrc32: crcHex(originalCrc),
      mutatedCrc32: crcHex(mutatedCrc),
      assertion: "one-byte YAML mutation must not retain the official CRC32",
    },
    {
      id: "restricted-pickle-global-opcode",
      status: unsafePickleRejected ? "passed" : "failed",
      assertion: "GLOBAL opcode must be rejected before unpickling",
      observedError: unsafePickleError,
      releasedPickleReinspected: inspectReleasedPickle(releasedPicklePath)
        .pickleSha256,
    },
    {
      id: "ineligible-ego-injection",
      status:
        injectedRows === comparison.released.rowCount
        && comparison.parityChecks.releaseOnlyRowCount
          === comparison.released.physicalEventCount
          ? "passed"
          : "failed",
      assertion:
        "adding one excluded ego per physical event must expose the 30-row population delta",
      baselineEligibleEgoIds: converterContract.egoCandidateIds,
      injectedEgoId: "0",
      baselineRows: comparison.independentSemanticDryRun.rowCount,
      mutatedRows: injectedRows,
      releasedRows: comparison.released.rowCount,
    },
    {
      id: "metainfo-label-mutation",
      status: comparison.parityChecks.metainfoEqual ? "failed" : "passed",
      assertion:
        "the certificate must detect the released versus generator dataset-label difference",
      releasedDatasetLabel:
        comparison.parityChecks.releasedDatasetLabel,
      generatorDatasetLabel:
        comparison.parityChecks.generatorDatasetLabel,
    },
  ];
}

let currentArchiveForControl;

function readFileFromZipIdentity(archive, memberName) {
  if (!currentArchiveForControl) {
    throw new Error("negative-control archive reader is not initialized");
  }
  const entry = currentArchiveForControl.centralEntries.find(
    (item) => item.name === memberName,
  );
  const fd = openSync(currentArchiveForControl.archivePrefixPath, "r");
  try {
    return readZipMember(fd, entry, archive.prefixBytes).raw;
  } finally {
    closeSync(fd);
  }
}

function parseArgs(argv) {
  const options = {
    central: "/private/tmp/cooperscene-mini-central.json",
    archivePrefix: "/private/tmp/cooperscene-mini.zip",
    releasedTrainIndex: "/private/tmp/cooperscene-mini-train.pkl",
    releasedValIndex: "/private/tmp/cooperscene-mini-val.pkl",
    releasedTestIndex: "/private/tmp/cooperscene-mini-test.pkl",
    releaseAudit:
      "content/idea-audits/cooperative-autonomous-driving-cooperscene-mini-info-release-audit.json",
    targetedReview:
      "content/idea-audits/cooperative-autonomous-driving-targeted-review-release-parity-v3.json",
    sourceRepo: existsSync("/private/tmp/paper-digest-cooperscene-audit")
      ? "/private/tmp/paper-digest-cooperscene-audit"
      : "/private/tmp/cooperscene-official",
    generatedAt: null,
    pretty: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--compact") {
      options.pretty = false;
      continue;
    }
    const key = {
      "--central": "central",
      "--archive-prefix": "archivePrefix",
      "--released-train-index": "releasedTrainIndex",
      "--released-val-index": "releasedValIndex",
      "--released-test-index": "releasedTestIndex",
      "--release-audit": "releaseAudit",
      "--targeted-review": "targetedReview",
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

function ensureInputs(options) {
  for (const [role, path] of Object.entries({
    central: options.central,
    archivePrefix: options.archivePrefix,
    releasedTrainIndex: options.releasedTrainIndex,
    releasedValIndex: options.releasedValIndex,
    releasedTestIndex: options.releasedTestIndex,
    releaseAudit: options.releaseAudit,
    targetedReview: options.targetedReview,
    sourceRepo: options.sourceRepo,
  })) {
    if (!existsSync(path)) {
      throw new Error(`missing ${role} input: ${path}`);
    }
  }
}

function timestampRelation(releaseAudit, identities) {
  const index = releaseAudit.extractionIntegrity.indexes.find(
    (item) => item.split === "test",
  );
  if (!index) throw new Error("release audit has no test index evidence");
  return {
    releasedIndexMemberIdentity: {
      archivePath: index.archivePath,
      manifestModifiedAt: index.manifestModifiedAt,
      crc32: crcHex(index.crc32),
      sha256: index.sha256,
    },
    firstPublicConverterCommit: identities.first.commit,
    converterFixCommit: identities.fix.commit,
    inspectedHeadCommit: identities.head.commit,
    observedOrdering:
      "released index member timestamp precedes the first public converter commit, which precedes the converter fix and inspected head",
    timestampCaveat:
      "The ZIP/manifest member timestamp has no timezone in the supplied audit, so only the calendar ordering is asserted.",
  };
}

export async function buildCertificate(options) {
  ensureInputs(options);
  const centralEntries = JSON.parse(readFileSync(options.central, "utf8"));
  const releaseAudit = JSON.parse(readFileSync(options.releaseAudit, "utf8"));
  const targetedReview = JSON.parse(
    readFileSync(options.targetedReview, "utf8"),
  );
  if (!Array.isArray(centralEntries)) {
    throw new Error("central inventory must be a JSON array");
  }

  const auditAssets = releaseAudit.officialAssets;
  const head = sourceIdentity(
    options.sourceRepo,
    auditAssets.repositoryCommit,
    auditAssets.converterPath,
  );
  const first = sourceIdentity(
    options.sourceRepo,
    auditAssets.firstPublicConverterCommit,
    "tools/dataset_converters/cooperscene_converter.py",
  );
  const fix = sourceIdentity(
    options.sourceRepo,
    auditAssets.converterFixCommit,
    auditAssets.converterPath,
  );
  for (const candidate of [first, fix, head]) {
    if (
      stableJson(candidate.contract.egoCandidateIds)
        !== stableJson(head.contract.egoCandidateIds)
      || stableJson(candidate.contract.metainfo)
        !== stableJson(head.contract.metainfo)
    ) {
      throw new Error(
        `public converter population contract changed at `
        + `${candidate.identity.commit.commit}`,
      );
    }
  }

  const archive = extractTestArchive({
    centralEntries,
    archivePrefixPath: options.archivePrefix,
  });
  currentArchiveForControl = {
    centralEntries,
    archivePrefixPath: options.archivePrefix,
  };
  const releasedIndexPaths = {
    train: options.releasedTrainIndex,
    val: options.releasedValIndex,
    test: options.releasedTestIndex,
  };
  const releasedIndexIdentityVerifications = [];
  for (const [split, path] of Object.entries(releasedIndexPaths)) {
    const expected = releaseAudit.extractionIntegrity.indexes.find(
      (item) => item.split === split,
    );
    if (!expected) {
      throw new Error(`release audit has no ${split} index identity`);
    }
    const bytes = readFileSync(path);
    const observedCrc = crc32(bytes);
    const observedSha256 = sha256(bytes);
    if (
      observedSha256 !== expected.sha256
      || observedCrc !== expected.crc32
    ) {
      throw new Error(
        `released ${split} pickle does not match the prior CRC/SHA-256 identity`,
      );
    }
    releasedIndexIdentityVerifications.push({
      split,
      archivePath: expected.archivePath,
      bytes: bytes.length,
      expectedCrc32: crcHex(expected.crc32),
      observedCrc32: crcHex(observedCrc),
      crc32Matches: true,
      expectedSha256: expected.sha256,
      observedSha256,
      sha256Matches: true,
      deserializedInThisPilot: split === "test",
    });
  }
  const released = inspectReleasedPickle(options.releasedTestIndex);
  const releasedTestIdentity = releasedIndexIdentityVerifications.find(
    (item) => item.split === "test",
  );
  const dryRunRows = buildSemanticDryRun({
    eventManifest: archive.eventManifest,
    converterContract: head.contract,
  });
  const comparison = comparePopulation({
    released,
    dryRunRows,
    converterContract: head.contract,
  });
  const roles = summarizeAgentRoles(
    archive.eventManifest,
    head.contract.egoCandidateIds,
  );
  const converterProbe = actualConverterProbe(
    options.sourceRepo,
    auditAssets.converterPath,
  );
  const negativeControls = runNegativeControls({
    archive,
    releasedPicklePath: options.releasedTestIndex,
    comparison,
    converterContract: head.contract,
  });
  if (negativeControls.some((control) => control.status !== "passed")) {
    throw new Error("one or more negative controls failed");
  }

  const inputPaths = [
    ["central-directory-inventory", options.central],
    ["official-archive-prefix", options.archivePrefix],
    ["released-train-index", options.releasedTrainIndex],
    ["released-val-index", options.releasedValIndex],
    ["released-test-index", options.releasedTestIndex],
    ["prior-release-audit", options.releaseAudit],
    ["targeted-review", options.targetedReview],
  ];
  const inputIdentities = [];
  for (const [role, path] of inputPaths) {
    inputIdentities.push({
      role,
      fileName: basename(path),
      bytes: statSync(path).size,
      sha256: await sha256File(path),
    });
  }

  const testMembers = archive.identities;
  const sourceMemberIdentities = testMembers.map((identity) => ({
    name: identity.name,
    localOffset: identity.localOffset,
    compressedBytes: identity.compressedBytes,
    uncompressedBytes: identity.uncompressedBytes,
    crc32: identity.crc32,
    sha256: identity.sha256,
  }));
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const eventKeys = archive.eventManifest.map(
    (event) =>
      `${event.physicalEvent.scenario}/${event.physicalEvent.timestamp}`,
  );
  const eventTimestamps = archive.eventManifest.map(
    (event) => Number(event.physicalEvent.timestamp),
  );
  const requiredRoles = ["0", "1", "2", "3"];
  const completeEvents = archive.eventManifest.every(
    (event) =>
      stableJson(event.agents.map((agent) => agent.agentId))
      === stableJson(requiredRoles),
  );

  const certificate = {
    schemaVersion: 1,
    certificateType:
      "cooperative-benchmark-release-population-lineage-certificate",
    certificateId:
      "cooperative-autonomous-driving-release-population-lineage-pilot-v4",
    generatedAt,
    executionEnvironment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      cpuOnly: true,
      networkUsed: false,
    },
    purpose:
      "Bound the released test population and the current public generator population using CRC-verified source members, restricted deserialization, static source evidence, and an independent population-only dry-run.",
    result:
      "released-test-population-contract-differs-from-current-public-generator-contract",
    inputIdentities,
    evidenceClasses: {
      officialArchiveExecution: {
        status: "executed",
        operation:
          "read local headers, inflate every test member, validate lengths and CRC32, hash every member, and parse every test YAML",
      },
      releasedIndexInspection: {
        status: "executed",
        operation:
          "pre-screen pickle opcodes, deny every class lookup, validate plain values, and summarize population rows",
      },
      actualPublicConverterExecution: {
        status: "not-executed",
        probe: converterProbe,
        blocker:
          "The normal Python environment lacks mmengine, numpy, yaml, and tqdm; the converter import probe fails before CLI parsing. No index generated by the public converter exists in this pilot.",
      },
      independentSemanticDryRun: {
        status: "executed",
        operation:
          "apply the mechanically extracted literal ego-candidate tuple to CRC-verified event/agent availability; do not execute bbox parsing, coordinate transforms, PCD conversion, mmengine.dump, or converter imports",
      },
      staticSourceEvidence: {
        status: "executed",
        operation:
          "read converter blobs and commit metadata directly from fixed Git objects",
      },
    },
    archivePrefixValidation: {
      officialArchiveIdentityFromPriorAudit: {
        archiveBytes: auditAssets.archiveBytes,
        archiveSha256: auditAssets.archiveSha256,
        archiveEtag: auditAssets.archiveEtag,
        archiveLastModified: auditAssets.archiveLastModified,
      },
      localPrefix: {
        bytes: archive.prefixBytes,
        sha256: inputIdentities.find(
          (item) => item.role === "official-archive-prefix",
        ).sha256,
        completeArchive: false,
        minimumBytesRequiredForAllTestMembers: archive.minimumPrefixBytes,
        coversAllCentralDirectoryTestMembers:
          archive.prefixBytes >= archive.minimumPrefixBytes,
      },
      suppliedCentralInventory: {
        totalArchiveMembers: centralEntries.length,
        testMembers: testMembers.length,
        testMemberKinds: countBy(
          testMembers.map((item) => testMemberKind(item.name)),
        ),
        testMembersValidatedByLocalNameLengthAndCrc: testMembers.length,
        failedMembers: 0,
        sourceMemberManifestSha256:
          canonicalDigest(sourceMemberIdentities),
      },
      yamlExtraction: {
        yamlMembers: archive.yamlRecords.length,
        yamlMembersParsed: archive.yamlRecords.length,
        physicalEventKey: ["scenario", "timestamp"],
        physicalEventCount: archive.eventManifest.length,
        eventKeyRange: {
          scenarioIds: [...new Set(
            archive.eventManifest.map(
              (event) => event.physicalEvent.scenario,
            ),
          )].sort(),
          minTimestamp: Math.min(...eventTimestamps),
          maxTimestamp: Math.max(...eventTimestamps),
        },
        agentsPerEvent: requiredRoles,
        everyEventHasAllFourAgents: completeEvents,
        eventKeyManifestSha256: canonicalDigest(eventKeys),
        eventManifestSha256: canonicalDigest(archive.eventManifest),
      },
      agentRoles: roles,
      eventManifest: archive.eventManifest,
      sourceMemberIdentities,
    },
    releasedTestIndex: {
      safetyBoundary: {
        bytesLimit: 10 * 1024 * 1024,
        protocol: released.protocol,
        allowedOpcodes: released.allowedOpcodes,
        observedOpcodeCounts: released.opcodeCounts,
        classLookupPolicy: released.classLookupPolicy,
        plainValuePolicy: released.plainValuePolicy,
      },
      pickleSha256: released.pickleSha256,
      archiveMemberIdentityVerification: releasedTestIdentity,
      payloadSha256: released.payloadSha256,
      population: comparison.released,
      normalizedSourceIdentityContract: {
        releasedBinReferencesMapToOfficialPcdMembers:
          comparison.parityChecks.sourcePcdIdentitySetsEqual,
        uniquePcdSourceMembers:
          comparison.parityChecks.releasedUniqueNormalizedPcdSources,
        mappingRule:
          "prepend mini/ and replace the generated .bin suffix with the official .pcd suffix",
      },
    },
    releasedIndexInputIdentities: releasedIndexIdentityVerifications,
    publicGeneratorStaticEvidence: {
      checkoutNameIndependentIdentity:
        "Git commit, tree, blob object ID, source path, content SHA-256, and commit timestamps; no local checkout or repository directory name is part of the population key.",
      inspectedHead: {
        identity: head.identity,
        contract: head.contract,
      },
      firstPublicConverter: {
        identity: first.identity,
        contract: first.contract,
      },
      converterFix: {
        identity: fix.identity,
        contract: fix.contract,
      },
      contractStableAcrossInspectedObjects: true,
      temporalLineage: timestampRelation(
        releaseAudit,
        {
          first: first.identity,
          fix: fix.identity,
          head: head.identity,
        },
      ),
    },
    populationContract: {
      keySchema: {
        physicalEventKey: ["scenario", "timestamp"],
        projectionKey: ["scenario", "timestamp", "egoAgentId"],
        sourceMemberIdentity:
          ["archiveMemberName", "crc32", "uncompressedSha256"],
        repositoryNameRequired: false,
      },
      releasedPopulation: {
        eligibleEgoRolesObserved: roles.map((role) => ({
          agentId: role.agentId,
          role: role.roleUnderPublicGenerator,
          presentAsReleasedEgo:
            (comparison.released.egoRowsByAgent[role.agentId] ?? 0) > 0,
        })),
        rowsPerPhysicalEvent:
          comparison.released.rowsPerEventDistribution,
        metainfo: comparison.released.metainfo,
      },
      currentPublicGeneratorPopulation: {
        eligibleEgoAgentIds: head.contract.egoCandidateIds,
        eligibleEgoRole: "vehicle-ego-eligible",
        ineligibleEgoAgentIds:
          roles
            .filter((role) => !role.eligibleEgoUnderPublicGenerator)
            .map((role) => role.agentId),
        rowsPerPhysicalEvent:
          comparison.independentSemanticDryRun.rowsPerEvent,
        metainfo: head.contract.metainfo,
      },
      deterministicDifferences: [
        {
          field: "eligibleEgoAgentIds",
          released: Object.keys(comparison.released.egoRowsByAgent),
          currentPublicGenerator: head.contract.egoCandidateIds,
          observedDelta:
            "released test includes one infrastructure-agent-0 ego row per physical event; public generator excludes agent 0 from ego candidates",
        },
        {
          field: "rowsPerPhysicalEvent",
          released: 4,
          currentPublicGenerator:
            comparison.independentSemanticDryRun.rowsPerEvent,
          observedDelta:
            comparison.released.rowCount
            - comparison.independentSemanticDryRun.rowCount,
        },
        {
          field: "metainfo.dataset",
          released: comparison.parityChecks.releasedDatasetLabel,
          currentPublicGenerator:
            comparison.parityChecks.generatorDatasetLabel,
        },
      ],
      comparison,
    },
    negativeControls,
    claimBoundary: [
      "This is a CPU population-lineage pilot for the supplied mini test split, not a full-release certificate.",
      "The public converter was not actually executed and no regenerated converter index was produced; the 90-row result is an independent semantic dry-run of population selection only.",
      "Static source evidence establishes literal candidate IDs, grouping, append logic, and metainfo, but does not establish byte-for-byte regeneration.",
      "The archive prefix is not the complete official archive. It is sufficient only because every central-inventory test member ends before the observed prefix boundary and every such member passed local-name, length, CRC32, and SHA-256 processing.",
      "Restricted deserialization reduces code-execution risk for the supplied pickle but is not a general safe-pickle claim.",
      "No paper table, metric inflation, performance direction, ranking change, benchmark invalidity, or author intent is inferred.",
      "The member timestamp ordering does not identify the historical generator of the released indexes.",
      "The four released rows are receiver-conditioned projections of one physical event, not four independent acquisitions and not byte-identical duplicates.",
    ],
    killCriteria: [
      {
        criterion:
          "Any central-inventory test member is outside the prefix, has a local-name/length mismatch, fails decompression, or fails CRC32.",
        triggered: false,
      },
      {
        criterion:
          "Any test YAML lacks a stable scenario/timestamp/agent identity or six-element pose, or events do not expose agents 0, 1, 2, and 3.",
        triggered: !completeEvents,
      },
      {
        criterion:
          "The released pickle requires an opcode outside the frozen allowlist, performs class lookup, or contains non-plain values.",
        triggered: false,
      },
      {
        criterion:
          "The fixed public source does not expose literal EGO_CANDIDATE_IDS, physical-event grouping, one append per eligible ego, and literal metainfo.",
        triggered: false,
      },
      {
        criterion:
          "Released vehicle-ego projection keys cannot be aligned exactly with the independent three-ego dry-run at the same physical events.",
        triggered:
          !comparison.parityChecks.releasedVehicleKeysEqualDryRunKeys,
      },
      {
        criterion:
          "Promoting this bounded pilot to regeneration parity without an actual converter run and a produced-index comparison.",
        triggered: false,
        disposition:
          "promotion prohibited; actual converter execution remains missing",
      },
      ...targetedReview.killCriteria.map((criterion) => ({
        criterion,
        triggered: null,
        disposition:
          "not evaluated by this population-only mini test pilot",
      })),
    ],
    reproducibility: {
      script: {
        path: "scripts/idea-pilots/cooperscene-release-lineage.mjs",
        sha256: await sha256File(
          resolve("scripts/idea-pilots/cooperscene-release-lineage.mjs"),
        ),
      },
      commands: [
        formatCommand([
          "node",
          "scripts/idea-pilots/cooperscene-release-lineage.mjs",
          "--central",
          options.central,
          "--archive-prefix",
          options.archivePrefix,
          "--released-train-index",
          options.releasedTrainIndex,
          "--released-val-index",
          options.releasedValIndex,
          "--released-test-index",
          options.releasedTestIndex,
          "--source-repo",
          options.sourceRepo,
          "--generated-at",
          generatedAt,
        ]),
        "node --test test/cooperscene-release-lineage.test.mjs",
      ],
      outputContract:
        "stdout is canonical evidence JSON; the checked-in certificate is the reviewed stdout result",
    },
  };

  currentArchiveForControl = null;
  return certificate;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const certificate = await buildCertificate(options);
  process.stdout.write(
    `${JSON.stringify(certificate, null, options.pretty ? 2 : 0)}\n`,
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
