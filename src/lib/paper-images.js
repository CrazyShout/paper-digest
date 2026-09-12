import { readFile } from "node:fs/promises";
import path from "node:path";
import { memoizeContent } from "./content-cache.js";

async function readManifest(file) {
  return JSON.parse(await readFile(path.resolve(file), "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return "{}";
  }));
}

export async function getPaperImages(markdown, base = "/") {
  const [local, remote] = await Promise.all([
    memoizeContent("local-image-manifest", () => readManifest(".generated/paper-images.json")),
    memoizeContent("remote-image-manifest", () => readManifest("config/remote-figure-dimensions.json"))
  ]);
  const images = new Map();
  for (const match of markdown.matchAll(/^!\[[^\]]*\]\(([^)\s]+)/gm)) {
    const source = match[1];
    if (remote[source]) {
      images.set(source, remote[source]);
      continue;
    }
    const file = source.match(/^(?!https?:).*assets\/papers\/([^/?#]+)$/)?.[1];
    const metadata = file && local[file];
    if (!metadata) continue;
    images.set(source, {
      width: metadata.width,
      height: metadata.height,
      srcset: metadata.variants.map((variant) => (
        `${base}assets/paper-previews/${variant.file} ${variant.width}w`
      )).join(", ")
    });
  }
  return images;
}
