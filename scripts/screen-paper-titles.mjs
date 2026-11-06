import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { screenCatalogTitles } from "../src/lib/catalog-screen.js";

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
if (!args.includes("--input")) throw new Error("Usage: npm run discover:screen -- --input records.json [--output screen.json] [--sample-size 20] [--seed issue-id]");
const inputPath = path.resolve(value("--input"));
const outputPath = args.includes("--output") ? path.resolve(value("--output")) : null;
if (inputPath === outputPath) throw new Error("Screen output must not overwrite the input snapshot");
const bytes = await readFile(inputPath);
const input = JSON.parse(bytes);
const records = Array.isArray(input) ? input : input.records;
if (!Array.isArray(records)) throw new Error("Input must be an array or { records: [...] } of canonicalId/title metadata");
const configBytes = await readFile("config/research-interests.json");
const config = JSON.parse(configBytes);
const sampleSize = args.includes("--sample-size") ? Number(value("--sample-size")) : 20;
if (!Number.isInteger(sampleSize) || sampleSize < 0 || sampleSize > 200) throw new Error("sample-size must be an integer from 0 to 200");
const report = { generatedAt: new Date().toISOString(),
  inputSha256: createHash("sha256").update(bytes).digest("hex"),
  configSha256: createHash("sha256").update(configBytes).digest("hex"),
  ...screenCatalogTitles(records, config.interests, { sampleSize, seed: args.includes("--seed") ? value("--seed") : "paper-digest" }) };
if (outputPath) { await writeFile(outputPath, JSON.stringify(report,null,2)+"\n"); console.log(JSON.stringify(report.counts)); }
else console.log(JSON.stringify(report,null,2));
