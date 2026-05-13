import { getDigests } from "../../lib/content.js";

export async function GET() {
  const digests = await getDigests();
  return new Response(`window.PAPER_DIGESTS = ${JSON.stringify(digests, null, 2)};\n`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8"
    }
  });
}
