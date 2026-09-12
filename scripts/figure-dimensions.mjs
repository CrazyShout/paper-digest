import sharp from "sharp";

export async function figureDimensions(input) {
  try {
    const metadata = await sharp(input).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Missing image dimensions");
    return metadata.orientation >= 5
      ? { width: metadata.height, height: metadata.width }
      : { width: metadata.width, height: metadata.height };
  } catch (error) {
    // draw.io PNGs can embed more than 512 KB of editor metadata before IDAT.
    // Their mandatory IHDR already contains the actual raster dimensions.
    if (input.length >= 33
      && input.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
      && input.readUInt32BE(8) === 13
      && input.subarray(12, 16).toString("ascii") === "IHDR") {
      const width = input.readUInt32BE(16);
      const height = input.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }
    throw error;
  }
}
