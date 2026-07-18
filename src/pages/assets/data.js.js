import { buildClientDigestData, getDigests } from "../../lib/content.js";

export async function GET() {
  const digests = buildClientDigestData(await getDigests());
  return new Response(`window.PAPER_DIGESTS=${JSON.stringify(digests)};\n`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8"
    }
  });
}
