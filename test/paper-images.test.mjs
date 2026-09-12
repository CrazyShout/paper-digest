import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { preparePaperImages } from "../scripts/prepare-paper-images.mjs";
import { markdownToHtml } from "../src/lib/content.js";
import { figureDimensions } from "../scripts/figure-dimensions.mjs";

test("image preparation preserves originals and reuses content-addressed previews", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "paper-images-test-"));
  try {
    const source = path.join(root, "public/assets/papers");
    await mkdir(source, { recursive: true });
    const original = path.join(source, "figure.png");
    await sharp({ create: { width: 1200, height: 600, channels: 3, background: "white" } }).png().toFile(original);
    const before = await readFile(original);
    await preparePaperImages(root);
    const manifest = JSON.parse(await readFile(path.join(root, ".generated/paper-images.json"), "utf8"));
    assert.deepEqual(manifest["figure.png"].variants.map((item) => item.width), [640, 960, 1200]);
    const output = path.join(root, "public/assets/paper-previews");
    const files = await readdir(output);
    for (const variant of manifest["figure.png"].variants) {
      const image = await sharp(path.join(output, variant.file)).metadata();
      assert.equal(image.width, variant.width);
      assert.equal(image.height, variant.width / 2);
      assert.equal(image.format, "webp");
    }
    await preparePaperImages(root);
    assert.deepEqual(await readdir(output), files);
    assert.deepEqual(await readFile(original), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("paper figures have intrinsic dimensions, responsive previews and an original link", () => {
  const source = "../../assets/papers/figure.png";
  const html = markdownToHtml(`![官方图](${source})`, { images: new Map([[source, {
    width: 1200, height: 600, srcset: "/paper-digest/assets/paper-previews/example.webp 640w"
  }]]) });
  assert.match(html, /width="1200" height="600"/);
  assert.match(html, /<source type="image\/webp"/);
  assert.match(html, /srcset="\/paper-digest\/assets\/paper-previews\//);
  assert.match(html, /<a href="\.\.\/\.\.\/assets\/papers\/figure.png"/);
  assert.match(html, /loading="lazy"/);
});

test("PNG dimensions can be measured before large embedded editor metadata", async () => {
  const input = await sharp({ create: { width: 400, height: 150, channels: 3, background: "white" } }).png().toBuffer();
  assert.deepEqual(await figureDimensions(input.subarray(0, 33)), { width: 400, height: 150 });
  await assert.rejects(figureDimensions(Buffer.from("not an image")));
});
