import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  ACCESS_AUDIT_SOURCE,
  BUNDLED_PYTHON,
  FIXED_COMMIT,
  SHIM_SOURCES,
  inspectPlainPickle,
  prepareMiniInput,
  summarizeFileAccess,
} from "../scripts/idea-pilots/cooperscene-converter-smoke.mjs";
import {
  crc32,
  readZipMember,
} from "../scripts/idea-pilots/cooperscene-release-lineage.mjs";

const AUDIT_PATH = resolve(
  "content/idea-audits/cooperative-autonomous-driving-converter-execution-smoke-v5.json",
);
const SCRIPT_PATH = resolve(
  "scripts/idea-pilots/cooperscene-converter-smoke.mjs",
);
const TEST_PATH = resolve("test/cooperscene-converter-smoke.test.mjs");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function withTempDir(callback) {
  const directory = mkdtempSync(join(tmpdir(), "cooperscene-smoke-test-"));
  try {
    return callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function makeStoredArchive(members) {
  const chunks = [];
  const entries = [];
  let localOffset = 0;
  for (const [name, rawValue] of members) {
    const raw = Buffer.from(rawValue);
    const nameBuffer = Buffer.from(name);
    const crc = crc32(raw);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(10, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(raw.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(nameBuffer.length, 26);
    header.writeUInt16LE(0, 28);
    chunks.push(header, nameBuffer, raw);
    entries.push({
      name,
      method: 0,
      crc,
      compressedSize: raw.length,
      uncompressedSize: raw.length,
      localOffset,
    });
    localOffset += header.length + nameBuffer.length + raw.length;
  }
  return { bytes: Buffer.concat(chunks), entries };
}

test("mini materialization reads real YAML but creates zero-byte PCD/PNG stubs", () => {
  withTempDir((directory) => {
    const yaml = Buffer.from([
      "lidar_pose:",
      "- 0",
      "- 0",
      "- 0",
      "- 0",
      "- 0",
      "- 0",
      "vehicles: {}",
      "",
    ].join("\n"));
    const archive = makeStoredArchive([
      ["mini/test/", Buffer.alloc(0)],
      ["mini/test/1/", Buffer.alloc(0)],
      ["mini/test/1/1/", Buffer.alloc(0)],
      ["mini/test/1/1/10.yaml", yaml],
      ["mini/test/1/1/10.pcd", Buffer.from("official-pcd")],
      ["mini/test/1/1/10_camera0.png", Buffer.from("official-png")],
    ]);
    const archivePath = join(directory, "prefix.zip");
    const miniRoot = join(directory, "mini");
    writeFileSync(archivePath, archive.bytes);

    const result = prepareMiniInput({
      centralEntries: archive.entries,
      archivePrefixPath: archivePath,
      miniRoot,
      expectedCounts: { directory: 3, pcd: 1, png: 1, yaml: 1 },
    });

    assert.deepEqual(
      readFileSync(join(miniRoot, "test/1/1/10.yaml")),
      yaml,
    );
    assert.equal(statSync(join(miniRoot, "test/1/1/10.pcd")).size, 0);
    assert.equal(
      statSync(join(miniRoot, "test/1/1/10_camera0.png")).size,
      0,
    );
    assert.equal(result.yamlIdentities.length, 1);
    assert.equal(result.stubIdentities.length, 2);
    assert.equal(result.yamlIdentities[0].crc32,
      `0x${crc32(yaml).toString(16).padStart(8, "0")}`);
  });
});

test("mini materialization rejects a one-byte YAML payload mutation", () => {
  withTempDir((directory) => {
    const archive = makeStoredArchive([
      ["mini/test/1/1/10.yaml", Buffer.from("vehicles: {}\n")],
    ]);
    archive.bytes[archive.bytes.length - 1] ^= 0x01;
    const archivePath = join(directory, "corrupt.zip");
    writeFileSync(archivePath, archive.bytes);
    assert.throws(
      () => prepareMiniInput({
        centralEntries: archive.entries,
        archivePrefixPath: archivePath,
        miniRoot: join(directory, "mini"),
        expectedCounts: { yaml: 1 },
      }),
      /ZIP CRC32 mismatch/,
    );
  });
});

test("restricted parser accepts plain protocol-2 payloads and rejects GLOBAL", () => {
  withTempDir((directory) => {
    const safePath = join(directory, "safe.pkl");
    const program = [
      "import pickle,sys",
      "row={'sample_idx':0,'scenario':'1','timestamp':10.0,'agent_id':'1',",
      "'lidar_points':{'lidar_path':'test/1/1/10.pcd','num_pts_feats':4},",
      "'instances':[],'cooperators':[]}",
      "payload={'data_list':[row],'metainfo':{'classes':('vehicle',),",
      "'categories':{'vehicle':0},'dataset':'CooperScene',",
      "'info_version':'1.0','cooperative':True}}",
      "open(sys.argv[1],'wb').write(pickle.dumps(payload,protocol=2))",
    ].join("\n");
    const generated = spawnSync(
      BUNDLED_PYTHON,
      ["-I", "-c", program, safePath],
      { encoding: "utf8" },
    );
    assert.equal(generated.status, 0, generated.stderr);
    const inspected = inspectPlainPickle(safePath);
    assert.equal(inspected.rows.length, 1);
    assert.equal(inspected.rows[0].egoAgentId, "1");
    assert.equal(inspected.metainfo.dataset, "CooperScene");
    assert.equal(inspected.classLookupPolicy, "deny-all");

    const unsafePath = join(directory, "unsafe.pkl");
    writeFileSync(unsafePath, Buffer.from("cos\nsystem\n.", "ascii"));
    assert.throws(
      () => inspectPlainPickle(unsafePath),
      /forbidden pickle opcodes: GLOBAL/,
    );
  });
});

test("file-access summary distinguishes YAML reads from stub reads", () => {
  const root = resolve("/private/tmp/cooperscene-access-fixture/mini");
  const materialized = {
    miniRoot: root,
    yamlIdentities: [{ name: "mini/test/1/1/10.yaml" }],
    stubIdentities: [
      { name: "mini/test/1/1/10.pcd", kind: "pcd" },
      { name: "mini/test/1/1/10_camera0.png", kind: "png" },
    ],
  };
  const yamlPath = join(root, "test/1/1/10.yaml");
  const pcdPath = join(root, "test/1/1/10.pcd");
  const baseline = summarizeFileAccess(
    [{ path: yamlPath, mode: "r", flags: 524288 }],
    materialized,
  );
  assert.equal(baseline.uniqueYamlPathsRead, 1);
  assert.equal(baseline.stubReadEventCount, 0);

  const injected = summarizeFileAccess(
    [
      { path: yamlPath, mode: "r", flags: 524288 },
      { path: pcdPath, mode: "rb", flags: 524288 },
    ],
    materialized,
  );
  assert.equal(injected.stubReadEventCount, 1);
  assert.deepEqual(injected.stubReadsByKind, { pcd: 1 });
});

test("checked audit records actual converter execution and bounded parity", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
  assert.equal(
    audit.result,
    "fixed-public-converter-executed-and-matched-released-vehicle-projection-keys",
  );
  assert.equal(audit.fixedPublicConverter.fixedCommit, FIXED_COMMIT);
  assert.equal(audit.fixedPublicConverter.checkoutHead, FIXED_COMMIT);
  assert.equal(
    audit.fixedPublicConverter.sourceFilesUnchangedDuringRun,
    true,
  );
  assert.equal(audit.executionEnvironment.pythonExecutable, BUNDLED_PYTHON);
  assert.equal(audit.executionEnvironment.officialEnvironmentClaimed, false);

  assert.equal(audit.converterExecution.exitCode, 0);
  assert.match(
    audit.converterExecution.exactCommand,
    /coop_data_converter\.py --data-root \/.*\/mini$/,
  );
  assert.match(
    audit.converterExecution.exactCommand,
    /COOPERSCENE_AUDIT_ROOT=\/.*\/mini/,
  );
  assert.match(
    audit.converterExecution.exactCommand,
    /COOPERSCENE_AUDIT_TRACE=\/.*\/python-open-audit\.json/,
  );
  assert.match(audit.converterExecution.stdout, /SKIP train, not found/);
  assert.match(audit.converterExecution.stdout, /SKIP validate, not found/);
  assert.match(audit.converterExecution.stdout, /30 \(scenario, timestamp\) groups/);
  assert.match(audit.converterExecution.stdout, /wrote 90 samples/);
  assert.equal(audit.converterExecution.stderr, "");

  assert.deepEqual(audit.materialization.memberCounts, {
    directory: 6,
    pcd: 120,
    png: 90,
    yaml: 120,
  });
  assert.equal(audit.materialization.realYaml.count, 120);
  assert.equal(
    audit.officialInputs.archiveBoundary.prefixSha256RecomputedInThisRun,
    false,
  );
  assert.equal(
    audit.materialization.realYaml
      .eachMemberValidatedAgainstCentralLocalNameSizeAndCrc32,
    true,
  );
  assert.equal(audit.materialization.existenceStubs.pcdCount, 120);
  assert.equal(audit.materialization.existenceStubs.pngCount, 90);
  assert.equal(
    audit.materialization.existenceStubs.officialPayloadBytesReadByThisRunner,
    0,
  );
  assert.equal(
    audit.materialization.existenceStubs.converterStubReadEvents,
    0,
  );
  assert.equal(
    audit.materialization.temporaryDirectoryRemovedAfterRun,
    true,
  );

  assert.equal(
    audit.restrictedGeneratedIndexInspection.physicalEventCount,
    30,
  );
  assert.equal(audit.restrictedGeneratedIndexInspection.rowCount, 90);
  assert.deepEqual(
    audit.restrictedGeneratedIndexInspection.egoRowsByAgent,
    { 1: 30, 2: 30, 3: 30 },
  );
  assert.deepEqual(
    audit.restrictedGeneratedIndexInspection.metainfo,
    {
      classes: ["vehicle"],
      categories: { vehicle: 0 },
      dataset: "CooperScene",
      info_version: "1.0",
      cooperative: true,
    },
  );
  assert.equal(
    audit.releasedVehicleProjectionComparison.exactSetEquality,
    true,
  );
  assert.equal(
    audit.releasedVehicleProjectionComparison.generatedVehicleKeyCount,
    90,
  );
  assert.equal(
    audit.releasedVehicleProjectionComparison.releasedVehicleKeyCount,
    90,
  );
  assert.equal(
    audit.releasedVehicleProjectionComparison.generatedManifestSha256,
    audit.releasedVehicleProjectionComparison.releasedVehicleManifestSha256,
  );
  assert.ok(audit.negativeControls.every((item) => item.status === "passed"));
});

test("checked audit records shim sources, hashes, and claim boundaries", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
  const modules = Object.fromEntries(
    audit.temporaryCompatibility.modules.map((item) => [item.name, item]),
  );
  for (const [name, source] of Object.entries(SHIM_SOURCES)) {
    assert.equal(modules[name].source, source);
    assert.equal(modules[name].sha256, sha256(Buffer.from(source)));
  }
  assert.equal(
    audit.temporaryCompatibility.accessAudit.source,
    ACCESS_AUDIT_SOURCE,
  );
  assert.equal(
    audit.temporaryCompatibility.accessAudit.sha256,
    sha256(Buffer.from(ACCESS_AUDIT_SOURCE)),
  );
  assert.match(
    audit.temporaryCompatibility.classification,
    /not an official CooperScene environment/,
  );
  assert.match(
    audit.claimBoundary.join("\n"),
    /No benchmark score, model output, metric, ranking/,
  );

  const keys = [];
  function collectKeys(value) {
    if (Array.isArray(value)) {
      for (const item of value) collectKeys(item);
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        keys.push(key);
        collectKeys(item);
      }
    }
  }
  collectKeys(audit);
  assert.equal(keys.some((key) => /score|rating/i.test(key)), false);
  assert.equal(audit.reproducibility.runner.sha256,
    sha256(readFileSync(SCRIPT_PATH)));
  assert.equal(audit.reproducibility.test.sha256,
    sha256(readFileSync(TEST_PATH)));
});

test("public ZIP reader still enforces CRC on the fixture member", () => {
  withTempDir((directory) => {
    const archive = makeStoredArchive([
      ["mini/test/1/1/10.yaml", Buffer.from("vehicles: {}\n")],
    ]);
    const archivePath = join(directory, "member.zip");
    writeFileSync(archivePath, archive.bytes);
    const fd = openSync(archivePath, "r");
    try {
      const { identity } = readZipMember(
        fd,
        archive.entries[0],
        archive.bytes.length,
      );
      assert.equal(identity.crc32,
        `0x${archive.entries[0].crc.toString(16).padStart(8, "0")}`);
    } finally {
      closeSync(fd);
    }
  });
});
