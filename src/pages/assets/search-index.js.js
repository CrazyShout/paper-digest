import { buildPaperSearchIndex, getDigests } from "../../lib/content.js";

export async function GET() {
  const searchIndex = buildPaperSearchIndex(await getDigests());
  return new Response(`window.PAPER_DIGEST_SEARCH_INDEX=${JSON.stringify(searchIndex)};\n`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8"
    }
  });
}
