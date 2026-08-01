#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const TEST_DIR = path.join(ROOT, "test");

const CLOCK_TEST = "test/clock-age-identifiability-v6.test.mjs";
const CONVERTER_TEST = "test/cooperscene-converter-smoke.test.mjs";
const RELEASE_PREFLIGHT_TEST = "test/release-population-preflight-v7.test.mjs";

const CLOCK_RUNTIME_TEST = "^audit records hashes, methods, controls, failures, and claim boundary$";
const CONVERTER_PARSER_TEST = "^restricted parser accepts plain protocol-2 payloads and rejects GLOBAL$";

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function testFiles() {
  return readdirSync(TEST_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.mjs"))
    .map((entry) => `test/${entry.name}`)
    .sort();
}

export function createTestPlan(files, conditions = {}) {
  const general = new Set(files);
  const isolated = [];
  const omitted = [];

  if (general.has(CLOCK_TEST) && conditions.clockRuntimeMatches === false) {
    general.delete(CLOCK_TEST);
    isolated.push({
      file: CLOCK_TEST,
      skipPattern: CLOCK_RUNTIME_TEST,
      reason: "checked audit records the original Node, platform, and architecture"
    });
  }

  if (general.has(CONVERTER_TEST) && conditions.converterPythonAvailable === false) {
    general.delete(CONVERTER_TEST);
    isolated.push({
      file: CONVERTER_TEST,
      skipPattern: CONVERTER_PARSER_TEST,
      reason: "checked converter audit uses a content-addressed local Python runtime"
    });
  }

  if (general.has(RELEASE_PREFLIGHT_TEST) && conditions.releasePreflightInputsAvailable === false) {
    general.delete(RELEASE_PREFLIGHT_TEST);
    omitted.push({
      file: RELEASE_PREFLIGHT_TEST,
      reason: "content-addressed released pickle is an external local audit asset"
    });
  }

  return {
    general: [...general].sort(),
    isolated,
    omitted
  };
}

function currentConditions() {
  const clockAudit = readJson(
    "content/idea-audits/cooperative-autonomous-driving-clock-age-pilot-v6.json"
  );
  const converterAudit = readJson(
    "content/idea-audits/cooperative-autonomous-driving-converter-execution-smoke-v5.json"
  );
  const releaseCertificate = readJson(
    "content/idea-audits/cooperative-autonomous-driving-release-population-preflight-v7.json"
  );
  const recordedRuntime = clockAudit.execution?.runtime || {};
  const converterPython = converterAudit.executionEnvironment?.pythonExecutable;
  const sourceArtifacts = Object.values(releaseCertificate.sourceArtifacts || {});
  const releaseInputsAvailable = sourceArtifacts.length > 0
    && sourceArtifacts.every((artifact) => {
      const artifactPath = path.isAbsolute(artifact.path)
        ? artifact.path
        : path.join(ROOT, artifact.path);
      return existsSync(artifactPath);
    });

  return {
    clockRuntimeMatches: recordedRuntime.node === process.version
      && recordedRuntime.platform === process.platform
      && recordedRuntime.arch === process.arch,
    converterPythonAvailable: Boolean(converterPython && existsSync(converterPython)),
    releasePreflightInputsAvailable: releaseInputsAvailable
  };
}

function splitArguments(argv) {
  const explicitFiles = argv.filter((argument) => argument.endsWith(".test.mjs"));
  return {
    files: explicitFiles.length ? explicitFiles : testFiles(),
    nodeArguments: argv.filter((argument) => !explicitFiles.includes(argument))
  };
}

function runBatch(files, nodeArguments, skipPattern) {
  if (!files.length) return 0;
  const args = ["--test"];
  if (skipPattern) args.push(`--test-skip-pattern=${skipPattern}`);
  args.push(...nodeArguments, ...files);
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit"
  });
  return result.status ?? 1;
}

export function main(argv = process.argv.slice(2)) {
  const { files, nodeArguments } = splitArguments(argv);
  const plan = createTestPlan(files, currentConditions());

  for (const item of plan.omitted) {
    console.error(`[test prerequisite] omitted ${item.file}: ${item.reason}.`);
  }
  for (const item of plan.isolated) {
    console.error(`[test prerequisite] ${item.file}: ${item.reason}; one provenance replay is skipped.`);
  }

  let status = runBatch(plan.general, nodeArguments);
  for (const item of plan.isolated) {
    if (status !== 0) break;
    status = runBatch([item.file], nodeArguments, item.skipPattern);
  }
  process.exitCode = status;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main();
}
