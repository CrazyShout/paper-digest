#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXED_COMMIT = "e722a8d34cb4f5003bc6972bad4b9a456f366731";
export const DEFAULT_REMOTE_ROOT = "/tmp/van3twin-pseudonym-cache-v8-fixed";
export const CANDIDATE_ID = "pseudonym-rotation-perception-cache-continuity";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT_PATH = "scripts/idea-pilots/pseudonym-cache-execution-v8.mjs";
const TEST_PATH = "test/pseudonym-cache-execution-v8.test.mjs";
const AUDIT_PATH =
  "content/idea-audits/cooperative-autonomous-driving-pseudonym-cache-execution-gate-v8.json";

export const OFFICIAL_RANGES = Object.freeze([
  {
    path: "src/automotive/model/Applications/cooperativePerception.cc",
    start: 491,
    end: 558,
    functions: ["cooperativePerception::receiveCPM"],
    mode: "compiled-and-executed-exact-method-body",
  },
  {
    path: "src/automotive/model/Facilities/LDM.cc",
    start: 85,
    end: 110,
    functions: ["LDM::insert"],
    mode: "compiled-and-executed-exact-method-body",
  },
  {
    path: "src/automotive/model/Facilities/LDM.cc",
    start: 128,
    end: 141,
    functions: ["LDM::lookup"],
    mode: "compiled-and-executed-exact-method-body",
  },
  {
    path: "src/automotive/model/Facilities/LDM.cc",
    start: 187,
    end: 199,
    functions: ["LDM::getAllIDs"],
    mode: "compiled-and-executed-exact-method-body",
  },
]);

export function buildTraceContract() {
  const base = [
    { timeMs: 0, stationId: 100, objectId: 10, sensorId: 7, xCm: 0 },
    { timeMs: 100, stationId: 100, objectId: 10, sensorId: 7, xCm: 100 },
    { timeMs: 200, stationId: 100, objectId: 10, sensorId: 7, xCm: 200 },
    { timeMs: 300, stationId: 100, objectId: 10, sensorId: 7, xCm: 300 },
  ];

  return [
    {
      id: "no-rotation",
      standardsConformance: "control-no-id-change",
      rotationAtMs: null,
      frames: base.map((frame) => ({ ...frame })),
    },
    {
      id: "synchronous-station-object-sensor-rotation",
      standardsConformance: "schema-level-conformant-id-change",
      rotationAtMs: 200,
      frames: base.map((frame) =>
        frame.timeMs < 200
          ? { ...frame }
          : { ...frame, stationId: 200, objectId: 77, sensorId: 29 }
      ),
    },
    {
      id: "station-only-rotation-negative-control",
      standardsConformance: "intentional-incomplete-rotation-negative-control",
      rotationAtMs: 200,
      frames: base.map((frame) =>
        frame.timeMs < 200 ? { ...frame } : { ...frame, stationId: 200 }
      ),
    },
  ];
}

function smallestFreePositiveId(ids) {
  let candidate = 1;
  for (const id of [...ids].sort((left, right) => left - right)) {
    if (id === candidate) {
      candidate += 1;
    } else if (id > candidate) {
      break;
    }
  }
  return candidate;
}

export function simulateOfficialReceiverSemantics(trace) {
  const receiverMap = new Map();
  const ldm = new Map();
  let shardsBeforeRotation = null;
  let mappingsBeforeRotation = null;

  for (const frame of trace.frames) {
    if (frame.timeMs === trace.rotationAtMs) {
      shardsBeforeRotation = receiverMap.size;
      mappingsBeforeRotation = [...receiverMap.values()].reduce(
        (sum, mappings) => sum + mappings.size,
        0
      );
    }

    if (!receiverMap.has(frame.stationId)) {
      receiverMap.set(frame.stationId, new Map());
    }
    const senderMap = receiverMap.get(frame.stationId);
    let ldmId = senderMap.get(frame.objectId);
    if (ldmId === undefined) {
      if (ldm.has(frame.objectId)) {
        ldmId = smallestFreePositiveId(ldm.keys());
      } else {
        ldmId = frame.objectId;
      }
      senderMap.set(frame.objectId, ldmId);
    }
    ldm.set(ldmId, {
      ldmId,
      perceivedBy: frame.stationId,
      sourceObjectId: frame.objectId,
      lastUpdateMs: frame.timeMs,
    });
  }

  const finalFrame = trace.frames.at(-1);
  const mappings = [...receiverMap.values()].reduce(
    (sum, senderMap) => sum + senderMap.size,
    0
  );
  const ghosts = [...ldm.values()].filter(
    (entry) => entry.perceivedBy !== finalFrame.stationId
  ).length;
  const hasCurrentRecord = [...ldm.values()].some(
    (entry) => entry.perceivedBy === finalFrame.stationId
  );
  const oldSenderShardRetained =
    trace.rotationAtMs !== null && receiverMap.has(trace.frames[0].stationId);

  return {
    traceId: trace.id,
    framesProcessed: trace.frames.length,
    cacheSenderShards: receiverMap.size,
    cacheMappings: mappings,
    staleCacheMappings: oldSenderShardRetained
      ? receiverMap.get(trace.frames[0].stationId).size
      : 0,
    ldmCardinality: ldm.size,
    ldmIds: [...ldm.keys()].sort((left, right) => left - right),
    duplicateRecords: Math.max(0, ldm.size - 1),
    ghostRecords: ghosts,
    missingObjects: hasCurrentRecord ? 0 : 1,
    hardReset: {
      applied: false,
      newSenderShardStarted:
        trace.rotationAtMs !== null && receiverMap.size > shardsBeforeRotation,
      oldSenderShardRetained,
      oldMappingsRetained:
        trace.rotationAtMs !== null && mappings > mappingsBeforeRotation,
    },
  };
}

export function deterministicExpectedResults() {
  return buildTraceContract().map(simulateOfficialReceiverSemantics);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function shellSafe(value, label) {
  if (!/^[A-Za-z0-9_./:@+-]+$/.test(value)) {
    throw new Error(`${label} contains unsupported shell characters: ${value}`);
  }
  return value;
}

function remote(host, command, options = {}) {
  return execFileSync("ssh", [host, command], {
    encoding: options.encoding ?? "utf8",
    input: options.input,
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.stdio,
  });
}

function extractRemoteRange(host, root, range) {
  return remote(
    host,
    `sed -n '${range.start},${range.end}p' ${root}/${range.path}`
  );
}

function remoteSha256(host, path) {
  return remote(host, `sha256sum ${path}`).trim().split(/\s+/)[0];
}

function cxxFrames(trace) {
  return trace.frames
    .map(
      (frame) =>
        `{${frame.timeMs}, ${frame.stationId}, ${frame.objectId}, ${frame.sensorId}, ${frame.xCm}}`
    )
    .join(", ");
}

export function makeHarnessSource(excerpts, traces = buildTraceContract()) {
  const byFunction = new Map();
  for (const item of excerpts) {
    for (const name of item.functions) {
      byFunction.set(name, item.text);
    }
  }

  const receive = byFunction.get("cooperativePerception::receiveCPM");
  const insert = byFunction.get("LDM::insert");
  const lookup = byFunction.get("LDM::lookup");
  const getAllIDs = byFunction.get("LDM::getAllIDs");
  if (![receive, insert, lookup, getAllIDs].every(Boolean)) {
    throw new Error("Missing one or more required official excerpts");
  }

  const scenarioInitializers = traces
    .map(
      (trace) =>
        `{"${trace.id}", ${trace.rotationAtMs ?? -1}, {${cxxFrames(trace)}}}`
    )
    .join(",\n    ");

  return `
#include <algorithm>
#include <cstdint>
#include <iostream>
#include <map>
#include <memory>
#include <set>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

namespace ns3 {

using Address = int;

class Time {
 public:
  explicit Time(std::uint64_t microseconds) : microseconds_(microseconds) {}
  double GetSeconds() const { return static_cast<double>(microseconds_) / 1000000.0; }
  std::uint64_t GetMicroSeconds() const { return microseconds_; }

 private:
  std::uint64_t microseconds_;
};

class Simulator {
 public:
  static Time Now() { return Time(nowMicroseconds_); }
  static void SetNowMs(std::uint64_t milliseconds) {
    nowMicroseconds_ = milliseconds * 1000;
  }

 private:
  static std::uint64_t nowMicroseconds_;
};

std::uint64_t Simulator::nowMicroseconds_ = 0;

struct PerceivedObject {
  long objectId = 0;
  long xCm = 0;
};

struct PerceivedObjectContainer {
  std::vector<std::shared_ptr<PerceivedObject>> perceivedObjects;
};

enum WrappedCpmContainer__containerData_PR {
  WrappedCpmContainer__containerData_PR_NOTHING = 0,
  WrappedCpmContainer__containerData_PR_SensorInformationContainer = 1,
  WrappedCpmContainer__containerData_PR_PerceivedObjectContainer = 2,
};

struct WrappedChoice {
  std::shared_ptr<ns3::PerceivedObjectContainer> PerceivedObjectContainer;
};

struct WrappedContainerData {
  WrappedCpmContainer__containerData_PR present =
      WrappedCpmContainer__containerData_PR_NOTHING;
  WrappedChoice choice;
};

struct WrappedCpmContainer {
  WrappedContainerData containerData;
};

struct CpmHeader {
  long stationId = 0;
};

struct CpmPayload {
  long sensorId = 0;
  std::vector<std::shared_ptr<WrappedCpmContainer>> cpmContainers;
};

struct CollectivePerceptionMessage {
  CpmHeader header;
  CpmPayload payload;
};

namespace asn1cpp {
template <typename T>
using Seq = std::shared_ptr<T>;

template <typename R, typename T>
R getterField(const T& field) {
  return static_cast<R>(field);
}

template <typename R, typename T>
Seq<R> getterSeq(const std::shared_ptr<T>& field) {
  return std::static_pointer_cast<R>(field);
}

template <typename T>
Seq<T> makeSeq() {
  return std::make_shared<T>();
}

namespace sequenceof {
template <typename T>
int getSize(const std::vector<std::shared_ptr<T>>& field) {
  return static_cast<int>(field.size());
}

template <typename R, typename T>
Seq<R> getterSeq(const std::vector<std::shared_ptr<T>>& field, int index) {
  return std::static_pointer_cast<R>(field.at(static_cast<std::size_t>(index)));
}
}  // namespace sequenceof
}  // namespace asn1cpp

#define getField(field, R, ...) getterField<R>(field, ##__VA_ARGS__)
#define getSeq(field, R, ...) getterSeq<R>(field, ##__VA_ARGS__)
#define makeSeq(T) makeSeq<T>()

struct vehicleData_t {
  bool detected = true;
  std::uint64_t stationID = 0;
  std::uint64_t age_us = 0;
  long perceivedBy = 0;
  long sourceObjectId = 0;
  long xCm = 0;
};

class PHpoints {
 public:
  void insert(const vehicleData_t&, std::uint64_t) { insertions_ += 1; }

 private:
  std::size_t insertions_ = 0;
};

class LDM {
 public:
  enum LDM_error_t {
    LDM_OK,
    LDM_UPDATED,
    LDM_ITEM_NOT_FOUND,
    LDM_MAP_FULL,
    LDM_UNKNOWN_ERROR,
  };

  struct returnedVehicleData_t {
    vehicleData_t vehData;
    PHpoints phData;
  };

  LDM_error_t insert(vehicleData_t newVehicleData);
  LDM_error_t lookup(std::uint64_t stationID, returnedVehicleData_t& retVehicleData);
  bool getAllIDs(std::set<int>& IDs);
  std::size_t cardinality() const { return m_LDM.size(); }
  const std::unordered_map<std::uint64_t, returnedVehicleData_t>& records() const {
    return m_LDM;
  }

 private:
  std::unordered_map<std::uint64_t, returnedVehicleData_t> m_LDM;
  std::uint64_t m_card = 0;
  std::uint64_t m_stationID = 0;
};

${insert}

${lookup}

${getAllIDs}

class cooperativePerception {
 public:
  cooperativePerception() : m_LDM(std::make_shared<LDM>()) {}
  void receiveCPM(asn1cpp::Seq<CollectivePerceptionMessage> cpm, Address from);

  vehicleData_t translateCPMdata(
      asn1cpp::Seq<CollectivePerceptionMessage> cpm,
      asn1cpp::Seq<PerceivedObject> object,
      int,
      int newID) {
    vehicleData_t value;
    value.stationID = newID == -1
        ? static_cast<std::uint64_t>(object->objectId)
        : static_cast<std::uint64_t>(newID);
    value.perceivedBy = cpm->header.stationId;
    value.sourceObjectId = object->objectId;
    value.xCm = object->xCm;
    return value;
  }

  std::size_t senderShardCount() const { return m_recvCPMmap.size(); }
  std::size_t mappingCount() const {
    std::size_t count = 0;
    for (const auto& [sender, mappings] : m_recvCPMmap) {
      (void)sender;
      count += mappings.size();
    }
    return count;
  }
  std::size_t senderMappingCount(int sender) const {
    auto found = m_recvCPMmap.find(sender);
    return found == m_recvCPMmap.end() ? 0 : found->second.size();
  }
  bool hasSender(int sender) const { return m_recvCPMmap.count(sender) != 0; }
  const LDM& ldm() const { return *m_LDM; }

 private:
  int m_cpm_received = 0;
  std::string m_id = "ego";
  std::shared_ptr<LDM> m_LDM;
  std::map<int, std::map<int, int>> m_recvCPMmap;
};

${receive}

#undef getField
#undef getSeq
#undef makeSeq

struct Frame {
  int timeMs;
  int stationId;
  int objectId;
  int sensorId;
  int xCm;
};

struct Scenario {
  std::string id;
  int rotationAtMs;
  std::vector<Frame> frames;
};

void emitScenario(const Scenario& scenario, bool firstScenario) {
  cooperativePerception receiver;
  std::size_t shardsBeforeRotation = 0;
  std::size_t mappingsBeforeRotation = 0;
  std::ostringstream officialDebugOutput;
  std::streambuf* standardOutput = std::cout.rdbuf(officialDebugOutput.rdbuf());

  for (const Frame& frame : scenario.frames) {
    if (frame.timeMs == scenario.rotationAtMs) {
      shardsBeforeRotation = receiver.senderShardCount();
      mappingsBeforeRotation = receiver.mappingCount();
    }

    Simulator::SetNowMs(static_cast<std::uint64_t>(frame.timeMs));
    auto cpm = std::make_shared<CollectivePerceptionMessage>();
    cpm->header.stationId = frame.stationId;
    cpm->payload.sensorId = frame.sensorId;
    auto object = std::make_shared<PerceivedObject>();
    object->objectId = frame.objectId;
    object->xCm = frame.xCm;
    auto objects = std::make_shared<PerceivedObjectContainer>();
    objects->perceivedObjects.push_back(object);
    auto wrapped = std::make_shared<WrappedCpmContainer>();
    wrapped->containerData.present =
        WrappedCpmContainer__containerData_PR_PerceivedObjectContainer;
    wrapped->containerData.choice.PerceivedObjectContainer = objects;
    cpm->payload.cpmContainers.push_back(wrapped);
    receiver.receiveCPM(cpm, 0);
  }
  std::cout.rdbuf(standardOutput);

  const int initialSender = scenario.frames.front().stationId;
  const int finalSender = scenario.frames.back().stationId;
  int ghosts = 0;
  bool currentRecord = false;
  std::vector<int> ids;
  for (const auto& [id, record] : receiver.ldm().records()) {
    ids.push_back(static_cast<int>(id));
    if (record.vehData.perceivedBy != finalSender) {
      ghosts += 1;
    } else {
      currentRecord = true;
    }
  }
  std::sort(ids.begin(), ids.end());

  const bool rotated = scenario.rotationAtMs >= 0;
  const bool oldSenderRetained = rotated && receiver.hasSender(initialSender);
  const bool newSenderStarted = rotated && receiver.senderShardCount() > shardsBeforeRotation;
  const bool oldMappingsRetained = rotated && receiver.mappingCount() > mappingsBeforeRotation;

  if (!firstScenario) std::cout << ",";
  std::cout << R"JSON({"traceId":")JSON" << scenario.id
            << R"JSON(","framesProcessed":)JSON" << scenario.frames.size()
            << R"JSON(,"cacheSenderShards":)JSON" << receiver.senderShardCount()
            << R"JSON(,"cacheMappings":)JSON" << receiver.mappingCount()
            << R"JSON(,"staleCacheMappings":)JSON"
            << (oldSenderRetained ? receiver.senderMappingCount(initialSender) : 0)
            << R"JSON(,"ldmCardinality":)JSON" << receiver.ldm().cardinality()
            << R"JSON(,"ldmIds":[)JSON";
  for (std::size_t index = 0; index < ids.size(); ++index) {
    if (index != 0) std::cout << ",";
    std::cout << ids[index];
  }
  std::cout << "]"
            << R"JSON(,"duplicateRecords":)JSON"
            << (receiver.ldm().cardinality() > 0 ? receiver.ldm().cardinality() - 1 : 0)
            << R"JSON(,"ghostRecords":)JSON" << ghosts
            << R"JSON(,"missingObjects":)JSON" << (currentRecord ? 0 : 1)
            << R"JSON(,"hardReset":{"applied":false,"newSenderShardStarted":)JSON"
            << (newSenderStarted ? "true" : "false")
            << R"JSON(,"oldSenderShardRetained":)JSON"
            << (oldSenderRetained ? "true" : "false")
            << R"JSON(,"oldMappingsRetained":)JSON"
            << (oldMappingsRetained ? "true" : "false")
            << "}}";
}

}  // namespace ns3

int main() {
  const std::vector<ns3::Scenario> scenarios = {
    ${scenarioInitializers}
  };
  std::cout << "[";
  for (std::size_t index = 0; index < scenarios.size(); ++index) {
    ns3::emitScenario(scenarios[index], index == 0);
  }
  std::cout << "]\\n";
  return 0;
}
`;
}

function environmentFromRemote(host) {
  const command = [
    "hostname",
    ". /etc/os-release; printf '%s %s\\n' \"$NAME\" \"$VERSION_ID\"",
    "uname -srmo",
    "g++ --version | head -n 1",
    "cmake --version | head -n 1",
    "ninja --version",
    "node --version 2>/dev/null || true",
  ].join("; ");
  const [hostname, os, kernel, compiler, cmake, ninja, node = ""] = remote(
    host,
    command
  )
    .trim()
    .split("\n");
  return { host, hostname, os, kernel, compiler, cmake, ninja, node };
}

function localFileHash(path) {
  const absolute = resolve(REPOSITORY_ROOT, path);
  return existsSync(absolute) ? sha256(readFileSync(absolute)) : null;
}

export function runRemoteConformance({ host, remoteRoot }) {
  shellSafe(host, "host");
  shellSafe(remoteRoot, "remoteRoot");
  const fixedCommit = remote(host, `git -C ${remoteRoot} rev-parse HEAD`).trim();
  if (fixedCommit !== FIXED_COMMIT) {
    throw new Error(`Expected ${FIXED_COMMIT}, found ${fixedCommit}`);
  }

  const submoduleStatus = remote(
    host,
    `git -C ${remoteRoot} submodule status --recursive`
  ).trim();
  const excerpts = OFFICIAL_RANGES.map((range) => ({
    ...range,
    text: extractRemoteRange(host, remoteRoot, range),
    sourceSha256: remoteSha256(host, `${remoteRoot}/${range.path}`),
  })).map((range) => ({ ...range, excerptSha256: sha256(range.text) }));

  const harnessSource = makeHarnessSource(excerpts);
  const remotePrefix = `/tmp/pseudonym-cache-execution-v8-${process.pid}`;
  const remoteSource = `${remotePrefix}.cc`;
  const remoteBinary = `${remotePrefix}.bin`;
  remote(host, `tee ${remoteSource} >/dev/null`, { input: harnessSource });
  const compileCommand =
    `g++ -std=gnu++17 -O2 -Wall -Wextra ${remoteSource} -o ${remoteBinary}`;
  const compileOutput = remote(host, compileCommand);
  const binarySha256 = remoteSha256(host, remoteBinary);
  const observed = JSON.parse(remote(host, remoteBinary));
  const expected = deterministicExpectedResults();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error(
      `Compiled official-path result diverged from regression model:\n` +
        `observed=${JSON.stringify(observed)}\nexpected=${JSON.stringify(expected)}`
    );
  }

  return {
    fixedCommit,
    submoduleStatus,
    excerpts,
    environment: environmentFromRemote(host),
    compileCommand,
    compileOutput: compileOutput.trim(),
    harnessSha256: sha256(harnessSource),
    binarySha256,
    observed,
    remoteSource,
    remoteBinary,
  };
}

export function buildAudit(remoteResult) {
  const traceContract = buildTraceContract();
  const synchronized = traceContract.find(
    (trace) => trace.id === "synchronous-station-object-sensor-rotation"
  );
  const stationOnly = traceContract.find(
    (trace) => trace.id === "station-only-rotation-negative-control"
  );

  return {
    schemaVersion: 1,
    candidateId: CANDIDATE_ID,
    gateType: "official-asset-execution-gate",
    generatedAt: new Date().toISOString(),
    fixedCommit: {
      asset: "VaN3Twin",
      repository: "https://github.com/DriveX-devs/VaN3Twin.git",
      commit: remoteResult.fixedCommit,
      clonePath: DEFAULT_REMOTE_ROOT,
      recursiveSubmoduleStatus: remoteResult.submoduleStatus
        ? remoteResult.submoduleStatus.split("\n")
        : [],
      recursiveSubmoduleFinding:
        "No registered submodules were present at the fixed commit.",
    },
    environment: {
      ...remoteResult.environment,
      fullStackBuildHostAccess: "no-passwordless-sudo",
      missingObservedPackages: [
        "libopencv-dev",
        "libboost-dev",
        "libgrpc++-dev",
        "libprotobuf-dev",
        "sumo",
      ],
    },
    buildCommands: [
      {
        command:
          "git init; git remote add origin https://github.com/DriveX-devs/VaN3Twin.git; git fetch --depth 1 origin e722a8d34cb4f5003bc6972bad4b9a456f366731; git checkout --detach FETCH_HEAD; git submodule update --init --recursive --depth 1",
        workingDirectory: DEFAULT_REMOTE_ROOT,
        outcome: "success",
      },
      {
        command: "printf '\\n' | timeout 900 ./sandbox_builder.sh",
        workingDirectory: "/tmp/van3twin-pseudonym-cache-v8-build",
        outcome:
          "successfully assembled the official ns-3-dev-v2x-v0.2 and nr-v2x-dev sandbox",
      },
      {
        command:
          "./ns3 configure --build-profile=debug --enable-tests --disable-python --disable-werror",
        workingDirectory:
          "/tmp/van3twin-pseudonym-cache-v8-build/ns-3-dev",
        outcome:
          "blocked at find_package(OpenCV REQUIRED): OpenCVConfig.cmake/opencv-config.cmake not found",
      },
      {
        command: remoteResult.compileCommand,
        workingDirectory: "/tmp",
        outcome: "success",
      },
      {
        command: remoteResult.remoteBinary,
        workingDirectory: "/tmp",
        outcome: "success; deterministic output matched the independent JS regression model",
      },
    ],
    exactOfficialFilesAndLines: remoteResult.excerpts.map((excerpt) => ({
      path: excerpt.path,
      lines: `${excerpt.start}-${excerpt.end}`,
      functions: excerpt.functions,
      sourceSha256: excerpt.sourceSha256,
      excerptSha256: excerpt.excerptSha256,
      mode: excerpt.mode,
    })),
    executedOfficialCode: {
      compiledAndExecuted: [
        {
          function: "cooperativePerception::receiveCPM",
          officialLines:
            "src/automotive/model/Applications/cooperativePerception.cc:491-558",
          fidelity:
            "Exact fixed-commit method body; receiver map allocation, object lookup, collision handling, ID allocation, and calls into LDM were unchanged.",
        },
        {
          function: "LDM::insert",
          officialLines: "src/automotive/model/Facilities/LDM.cc:85-110",
          fidelity:
            "Exact fixed-commit method body executed with deterministic Simulator and PHpoints adapters.",
        },
        {
          function: "LDM::lookup",
          officialLines: "src/automotive/model/Facilities/LDM.cc:128-141",
          fidelity: "Exact fixed-commit method body.",
        },
        {
          function: "LDM::getAllIDs",
          officialLines: "src/automotive/model/Facilities/LDM.cc:187-199",
          fidelity: "Exact fixed-commit method body.",
        },
      ],
      adapterCode: [
        "Minimal in-memory ASN-shaped CPM containers expose stationId, objectId, sensorId, and xCm without UPER encode/decode.",
        "translateCPMdata is a harness adapter limited to the official ID rule at cooperativePerception.cc:563-569 and observable provenance; the full official coordinate conversion was not compiled.",
        "Simulator time and PHpoints are deterministic stubs; they do not alter receiver-map or LDM key semantics.",
      ],
      staticallyAuditedOnly: [
        "CPBasicService network receive/decode and callback registration",
        "full cooperativePerception application lifecycle",
        "full translateCPMdata coordinate and kinematic conversion",
        "LDM timeout scheduler and deleteOlderThan",
        "ETSI ASN.1 UPER wire encoding/decoding",
      ],
      notClaimed:
        "The adapter is not a full VaN3Twin build and is not presented as a new cache implementation. The cache and LDM decision methods under test are exact official method bodies.",
    },
    traceContract: {
      format:
        "Schema-level CPM semantic trace: one sender stationId, one PerceivedObject.objectId, one SensorInformation.sensorId, monotonic reception time, and kinematic xCm per frame.",
      receiverVisibleFields: [
        "timeMs",
        "stationId",
        "objectId",
        "sensorId",
        "xCm",
      ],
      scorerOnlyFields: ["trace id", "rotationAtMs", "standardsConformance"],
      forbiddenFieldsAbsent: [
        "oldStationId",
        "newStationId",
        "oldNewMap",
        "actorId",
        "cavId",
        "simulatorNodePointer",
      ],
      traces: traceContract,
      conformityChecks: {
        noRotationStableIds: true,
        synchronizedRotationChangesStationObjectAndSensor:
          synchronized.frames[1].stationId !== synchronized.frames[2].stationId &&
          synchronized.frames[1].objectId !== synchronized.frames[2].objectId &&
          synchronized.frames[1].sensorId !== synchronized.frames[2].sensorId,
        stationOnlyIsExplicitNegativeControl:
          stationOnly.standardsConformance ===
          "intentional-incomplete-rotation-negative-control",
        oldNewOracleProvidedToReceiver: false,
        wireEncodingValidated: false,
      },
    },
    results: {
      deterministicRuns: 1,
      observed: remoteResult.observed,
      regressionModelMatched: true,
      interpretation: [
        "No rotation keeps one sender shard, one mapping, and one LDM record with no duplicate, ghost, or missing object.",
        "Synchronized station/object/sensor rotation starts a fresh sender shard but retains the old shard and old LDM record; the current official semantics end with two mappings and two LDM records for one physical-object trace, yielding one duplicate and one ghost immediately after rotation.",
        "The intentionally incomplete station-only rotation also duplicates the record because the object-ID collision branch allocates a new LDM ID; it is a negative control, not standards evidence.",
        "No hard reset hook is applied by receiveCPM. Its observable behavior is per-new-station shard creation plus residual old cache/LDM state.",
        "Missing remains zero in these one-object, no-loss traces because a current-pseudonym record is inserted; omission/loss and timeout behavior remain unexecuted.",
      ],
    },
    controls: {
      noOldNewOracle: true,
      receiverAndScorerSeparation:
        "Rotation metadata is used only after execution to label residual records; receiveCPM receives only current-frame CPM fields.",
      sameTrajectoryAndTimingAcrossTraces: true,
      sensorIdRotationVisibleButUnusedByOfficialReceiver: true,
      stationOnlyTracePurpose:
        "Explicit standards-negative control for incomplete rotation; never pooled with the synchronized trace.",
      deterministicCrossCheck:
        "The compiled C++ result must byte-for-byte match the independent JS transition model or the script fails.",
    },
    limitations: [
      "Full VaN3Twin CMake configuration was blocked by missing required OpenCV before libautomotive could compile; the host also lacked the other recorded packages and passwordless sudo.",
      "The conformance harness compiles exact official receiver/cache method bodies but not the full linked application, network decoder, coordinate conversion, or timeout scheduler.",
      "Trace validity is checked at the CPM field-contract level; ASN.1 constraints and UPER round-trip validity were not executed.",
      "The trace has one physical object and no packet loss, omission, ambiguity, or silent period, so it is a deterministic execution gate rather than the full minimumExecutableStudy.",
      "Ghost and duplicate labels use scorer-side knowledge that the trace contains one physical object; that knowledge is not available to receiver code.",
      "Immediate residuals are measured through 300 ms. The statically audited one-second LDM cleanup path was not compiled or exercised.",
    ],
    hashes: {
      harnessSourceSha256: remoteResult.harnessSha256,
      harnessBinarySha256: remoteResult.binarySha256,
      repositoryFiles: {
        [SCRIPT_PATH]: localFileHash(SCRIPT_PATH),
        [TEST_PATH]: localFileHash(TEST_PATH),
      },
      officialSourceExcerpts: Object.fromEntries(
        remoteResult.excerpts.map((excerpt) => [
          `${excerpt.path}:${excerpt.start}-${excerpt.end}`,
          excerpt.excerptSha256,
        ])
      ),
    },
    verdict: "revise",
    nextActions: [
      "Provision a disposable Ubuntu 22.04 image with the official builder dependencies, then compile libautomotive and execute the same traces through real ASN.1 decode, CPBasicService callback, full translateCPMdata, and LDM timeout scheduling.",
      "Add CPM omission, packet loss, silent period, and greater-than-one-second post-rotation observations to measure missing and cleanup behavior.",
      "Preserve synchronized station/object rotation as the primary condition; treat sensor rotation/omission as explicit conditions and keep station-only rotation solely as a negative control.",
      "Do not implement continuity policy work until the full linked replay reproduces or falsifies the immediate duplicate/ghost result without any old-new oracle.",
    ],
  };
}

function parseArguments(argv) {
  const options = {
    host: "hk-wsl",
    remoteRoot: DEFAULT_REMOTE_ROOT,
    output: null,
    resultFile: null,
    runRemote: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run-remote") {
      options.runRemote = true;
    } else if (argument === "--ssh-host") {
      options.host = argv[++index];
    } else if (argument === "--remote-root") {
      options.remoteRoot = argv[++index];
    } else if (argument === "--output") {
      options.output = argv[++index];
    } else if (argument === "--result-file") {
      options.resultFile = argv[++index];
    } else if (argument === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/idea-pilots/pseudonym-cache-execution-v8.mjs",
    "  node scripts/idea-pilots/pseudonym-cache-execution-v8.mjs --run-remote [--ssh-host hk-wsl] [--remote-root PATH] [--output PATH]",
    "  node scripts/idea-pilots/pseudonym-cache-execution-v8.mjs --result-file PATH --output PATH",
  ].join("\n");
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!options.runRemote && !options.resultFile) {
    process.stdout.write(`${JSON.stringify(deterministicExpectedResults(), null, 2)}\n`);
    return;
  }

  const remoteResult = options.resultFile
    ? JSON.parse(readFileSync(resolve(options.resultFile), "utf8"))
    : runRemoteConformance(options);
  const audit = buildAudit(remoteResult);
  const serialized = `${JSON.stringify(audit, null, 2)}\n`;
  if (options.output) {
    writeFileSync(resolve(REPOSITORY_ROOT, options.output), serialized);
  } else {
    process.stdout.write(serialized);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}

export const DEFAULT_AUDIT_PATH = AUDIT_PATH;
