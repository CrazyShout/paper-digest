import { getNotebookData } from "../../lib/navigation.js";

export async function GET() {
  const { searchRecords } = await getNotebookData(import.meta.env.BASE_URL);
  return new Response(JSON.stringify(searchRecords), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
