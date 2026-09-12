import { gzipSync } from "node:zlib";
import { getNotebookSearchIndex } from "../../lib/navigation.js";

export async function GET() {
  const searchRecords = await getNotebookSearchIndex(import.meta.env.BASE_URL);
  return new Response(gzipSync(JSON.stringify(searchRecords), { level: 9 }), {
    headers: {
      "Content-Type": "application/gzip",
      "Cache-Control": "public, max-age=300"
    }
  });
}
