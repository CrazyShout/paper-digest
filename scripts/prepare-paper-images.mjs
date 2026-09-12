import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const WIDTHS = [640, 960, 1600, 1920];
const RECIPE = "webp-q90-effort4-auto-orient-v1";

export async function preparePaperImages(root = process.cwd()) {
  const sourceDir = path.join(root, "public/assets/papers");
  const outputDir = path.join(root, "public/assets/paper-previews");
  const manifestDir = path.join(root, ".generated");
  await mkdir(outputDir, { recursive: true });
  await mkdir(manifestDir, { recursive: true });
  const manifest = {};
  const outputs = new Set();
  let sourceBytes = 0;
  let previewBytes = 0;

  const files = (await readdir(sourceDir)).filter((file) => /\.(?:png|jpe?g|webp)$/i.test(file)).sort();
  for (const file of files) {
    const input = await readFile(path.join(sourceDir, file));
    const metadata = await sharp(input).metadata();
    const rotated = metadata.orientation >= 5;
    const width = rotated ? metadata.height : metadata.width;
    const height = rotated ? metadata.width : metadata.height;
    if (!width || !height) throw new Error(`Image has no dimensions: ${file}`);
    const digest = createHash("sha256").update(RECIPE).update(input).digest("hex").slice(0, 16);
    const widths = [...new Set(WIDTHS.map((size) => Math.min(size, width)))];
    const variants = [];

    for (const size of widths) {
      const name = `${digest}-${size}.webp`;
      const destination = path.join(outputDir, name);
      outputs.add(name);
      const exists = await stat(destination).catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      });
      if (!exists) {
        await sharp(input).autoOrient().resize({ width: size, withoutEnlargement: true })
          .webp({ quality: 90, effort: 4 }).toFile(destination);
      }
      variants.push({ file: name, width: size });
    }

    sourceBytes += input.length;
    previewBytes += (await stat(path.join(outputDir, variants.at(-1).file))).size;
    manifest[file] = { width, height, variants };
  }

  const temporary = path.join(manifestDir, "paper-images.json.tmp");
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(temporary, path.join(manifestDir, "paper-images.json"));
  for (const file of await readdir(outputDir)) {
    if (/^[a-f0-9]{16}-\d+\.webp$/.test(file) && !outputs.has(file)) {
      await unlink(path.join(outputDir, file));
    }
  }
  return { images: files.length, sourceBytes, previewBytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log("Paper images prepared:", JSON.stringify(await preparePaperImages()));
}
