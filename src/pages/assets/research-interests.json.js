import { getInterestConfig } from "../../lib/content.js";

export async function GET() {
  const interests = await getInterestConfig();
  return new Response(`${JSON.stringify(interests, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
