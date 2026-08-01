import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  buildSemanticDryRun,
  comparePopulation,
  crc32,
  extractConverterContract,
  inspectReleasedPickle,
  readZipMember,
} from "../scripts/idea-pilots/cooperscene-release-lineage.mjs";

const CERTIFICATE_PATH = resolve(
  "content/idea-audits/cooperative-autonomous-driving-release-population-lineage-pilot-v4.json",
);
const SCRIPT_PATH = resolve(
  "scripts/idea-pilots/cooperscene-release-lineage.mjs",
);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function makeStoredZipMember(name, raw) {
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
  return {
    bytes: Buffer.concat([header, nameBuffer, raw]),
    entry: {
      name,
      localOffset: 0,
      method: 0,
      crc,
      compressedSize: raw.length,
      uncompressedSize: raw.length,
    },
  };
}

function withTempDir(callback) {
  const directory = mkdtempSync(join(tmpdir(), "cooperscene-lineage-test-"));
  try {
    return callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("CRC32 implementation matches the standard check vector", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("ZIP member reader verifies local identity, length, CRC32, and SHA-256", () => {
  withTempDir((directory) => {
    const raw = Buffer.from("lidar_pose:\n- 0\n- 0\n- 0\n- 0\n- 0\n- 0\nvehicles: {}\n");
    const fixture = makeStoredZipMember(
      "mini/test/1/0/1.yaml",
      raw,
    );
    const path = join(directory, "member.zip");
    writeFileSync(path, fixture.bytes);
    const fd = openSync(path, "r");
    try {
      const result = readZipMember(fd, fixture.entry, fixture.bytes.length);
      assert.deepEqual(result.raw, raw);
      assert.equal(
        result.identity.crc32,
        `0x${fixture.entry.crc.toString(16).padStart(8, "0")}`,
      );
      assert.equal(result.identity.sha256, sha256(raw));
      assert.equal(result.identity.name, fixture.entry.name);
    } finally {
      closeSync(fd);
    }
  });
});

test("ZIP member reader rejects a one-byte payload mutation", () => {
  withTempDir((directory) => {
    const fixture = makeStoredZipMember(
      "mini/test/1/0/1.yaml",
      Buffer.from("vehicles: {}\n"),
    );
    fixture.bytes[fixture.bytes.length - 1] ^= 0x01;
    const path = join(directory, "corrupt.zip");
    writeFileSync(path, fixture.bytes);
    const fd = openSync(path, "r");
    try {
      assert.throws(
        () => readZipMember(fd, fixture.entry, fixture.bytes.length),
        /ZIP CRC32 mismatch/,
      );
    } finally {
      closeSync(fd);
    }
  });
});

test("restricted pickle inspection accepts the released plain-value shape", () => {
  withTempDir((directory) => {
    const path = join(directory, "safe.pkl");
    const program = [
      "import pickle,sys",
      "row={'sample_idx':0,'scenario':'1','timestamp':1.0,'agent_id':'0',",
      "'lidar_points':{'lidar_path':'test/1/0/1.bin','num_pts_feats':4},",
      "'instances':[],'cooperators':[]}",
      "payload={'data_list':[row,row],'metainfo':{'classes':('vehicle',),",
      "'categories':{'vehicle':0},'dataset':'OPV2V','info_version':'1.0',",
      "'cooperative':True}}",
      "open(sys.argv[1],'wb').write(pickle.dumps(payload,protocol=2))",
    ].join("\n");
    const generated = spawnSync(
      "python3",
      ["-I", "-c", program, path],
      { encoding: "utf8" },
    );
    assert.equal(generated.status, 0, generated.stderr);

    const result = inspectReleasedPickle(path);
    assert.equal(result.classLookupPolicy, "deny-all");
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].egoAgentId, "0");
    assert.equal(result.metainfo.dataset, "OPV2V");
  });
});

test("restricted pickle inspection rejects GLOBAL before unpickling", () => {
  withTempDir((directory) => {
    const path = join(directory, "unsafe.pkl");
    writeFileSync(path, Buffer.from("cos\nsystem\n.", "ascii"));
    assert.throws(
      () => inspectReleasedPickle(path),
      /forbidden pickle opcodes: GLOBAL/,
    );
  });
});

test("converter contract is extracted from literals and generation statements", () => {
  const source = [
    '"""infra agent 0 as cooperator; only vehicles 1/2/3 ever taking the ego role"""',
    "EGO_CANDIDATE_IDS = ('1', '2', '3')",
    "groups[(scenario, timestamp)].append(entry)",
    "for ego in agent_data:",
    "  if ego['agent_id'] not in EGO_CANDIDATE_IDS:",
    "    continue",
    "  infos.append({})",
    "mmengine.dump({'metainfo': {",
    "  'classes': ('vehicle',),",
    "  'categories': {'vehicle': 0},",
    "  'dataset': 'CooperScene',",
    "  'info_version': '1.0',",
    "  'cooperative': True,",
    "}}, out_path)",
  ].join("\n");

  const contract = extractConverterContract(source);
  assert.deepEqual(contract.egoCandidateIds, ["1", "2", "3"]);
  assert.equal(contract.metainfo.dataset, "CooperScene");
  assert.equal(
    contract.generationEvidence.agentRoleDescriptions.infrastructure.line,
    1,
  );
  assert.equal(contract.generationEvidence.eligibilityFilter.line, 5);
});

test("population comparison isolates one released infrastructure ego per event", () => {
  const contract = {
    egoCandidateIds: ["1", "2", "3"],
    metainfo: {
      classes: ["vehicle"],
      categories: { vehicle: 0 },
      dataset: "CooperScene",
      info_version: "1.0",
      cooperative: true,
    },
  };
  const eventManifest = ["10", "11"].map((timestamp) => ({
    physicalEvent: { scenario: "1", timestamp },
    agents: ["0", "1", "2", "3"].map((agentId) => ({
      agentId,
      pcdMember: `mini/test/1/${agentId}/${timestamp}.pcd`,
    })),
  }));
  const dryRunRows = buildSemanticDryRun({
    eventManifest,
    converterContract: contract,
  });
  const rows = eventManifest.flatMap((event) =>
    event.agents.map((ego) => ({
      scenario: "1",
      timestamp: event.physicalEvent.timestamp,
      egoAgentId: ego.agentId,
      sourcePaths: event.agents.map(
        (agent) =>
          `test/1/${agent.agentId}/${event.physicalEvent.timestamp}.bin`,
      ),
      rowSha256: `${event.physicalEvent.timestamp}-${ego.agentId}`,
    })));
  const comparison = comparePopulation({
    released: {
      rows,
      metainfo: {
        ...contract.metainfo,
        dataset: "OPV2V",
      },
    },
    dryRunRows,
    converterContract: contract,
  });

  assert.equal(dryRunRows.length, 6);
  assert.equal(comparison.released.rowCount, 8);
  assert.equal(comparison.parityChecks.releaseOnlyRowCount, 2);
  assert.equal(
    comparison.parityChecks.releasedVehicleKeysEqualDryRunKeys,
    true,
  );
  assert.equal(comparison.parityChecks.sourcePcdIdentitySetsEqual, true);
  assert.equal(comparison.parityChecks.metainfoEqual, false);
});

test("checked-in certificate preserves evidence-class and claim boundaries", () => {
  const certificate = JSON.parse(readFileSync(CERTIFICATE_PATH, "utf8"));
  assert.equal(
    certificate.evidenceClasses.actualPublicConverterExecution.status,
    "not-executed",
  );
  assert.equal(
    certificate.evidenceClasses
      .actualPublicConverterExecution
      .probe
      .actualConverterExecuted,
    false,
  );
  assert.equal(
    certificate.populationContract
      .comparison
      .parityChecks
      .releasedVehicleKeysEqualDryRunKeys,
    true,
  );
  assert.equal(
    certificate.populationContract
      .comparison
      .parityChecks
      .releaseOnlyRowCount,
    30,
  );
  assert.equal(
    certificate.archivePrefixValidation.sourceMemberIdentities.length,
    336,
  );
  assert.equal(
    certificate.archivePrefixValidation.eventManifest.length,
    30,
  );
  assert.ok(
    certificate.negativeControls.every(
      (control) => control.status === "passed",
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(certificate.populationContract),
    /paper-digest-cooperscene-audit|cooperscene-official/,
  );
  assert.match(
    certificate.claimBoundary.join("\n"),
    /No paper table, metric inflation, performance direction.*author intent/,
  );
  assert.equal(
    certificate.reproducibility.script.sha256,
    sha256(readFileSync(SCRIPT_PATH)),
  );
});
