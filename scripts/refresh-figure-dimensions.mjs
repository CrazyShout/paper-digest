import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getPapers } from "../src/lib/content.js";
import { figureDimensions } from "./figure-dimensions.mjs";

const destination = "config/remote-figure-dimensions.json";
const officialFigureHosts = new Set(["arxiv.org", "research.zenseact.com"]);
const execFileAsync = promisify(execFile);
const urls = [...new Set((await getPapers()).flatMap((paper) => (
  [...paper.body.matchAll(/^!\[[^\]]*\]\((https:\/\/[^)\s]+)/gm)].map((match) => match[1])
)))].sort();
const dimensions = JSON.parse(await readFile(destination, "utf8").catch((error) => {
  if (error.code !== "ENOENT") throw error;
  return "{}";
}));
const failures = [];
let cursor = 0;

async function inspect(url) {
  if (!officialFigureHosts.has(new URL(url).hostname)) throw new Error("Unsupported official figure host");
  // curl honors the user's existing proxy environment on Node 22 as well as
  // Node 24. Arguments are passed directly, without a shell or URL interpolation.
  const { stdout } = await execFileAsync("curl", [
    "--fail", "--location", "--silent", "--show-error",
    "--connect-timeout", "8", "--max-time", "20",
    "--range", "0-524287", "--max-filesize", "524288", url
  ], { encoding: "buffer", maxBuffer: 600000 });
  return figureDimensions(stdout);
}

async function worker() {
  while (cursor < urls.length) {
    const url = urls[cursor++];
    if (dimensions[url]) continue;
    try {
      dimensions[url] = await inspect(url);
    } catch (error) {
      failures.push({ url, error: error.message });
    }
    if (cursor % 20 === 0) console.log(`Inspected ${cursor}/${urls.length} figure URLs`);
  }
}

await Promise.all(Array.from({ length: 4 }, worker));
const current = Object.fromEntries(urls.filter((url) => dimensions[url]).map((url) => [url, dimensions[url]]));
await writeFile(destination, `${JSON.stringify(current, null, 2)}\n`);
console.log(JSON.stringify({ figures: urls.length, measured: Object.keys(current).length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
