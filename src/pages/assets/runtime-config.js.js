import { getRuntimeConfig } from "../../lib/content.js";

export async function GET() {
  const runtime = await getRuntimeConfig();
  return new Response(`window.PAPER_DIGEST_RUNTIME = ${JSON.stringify(runtime, null, 2)};\n`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8"
    }
  });
}
