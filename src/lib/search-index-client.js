function validateIndex(data) {
  if (!Array.isArray(data)) throw new Error("Invalid search index");
  return data;
}

// The compressed asset works on static hosts without configurable HTTP
// compression. Older browsers and stale deployments retain the JSON fallback.
export async function loadSearchIndex(sourceUrl, {
  signal,
  fetchImpl = globalThis.fetch,
  Decompressor = globalThis.DecompressionStream
} = {}) {
  const compressedUrl = sourceUrl.replace(/\.json(?=[?#]|$)/, ".json.gz");
  if (Decompressor && compressedUrl !== sourceUrl) {
    try {
      const response = await fetchImpl(compressedUrl, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      // Some hosts transparently decode gzip through Content-Encoding.
      const data = bytes[0] === 0x1f && bytes[1] === 0x8b
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new Decompressor("gzip"))).json()
        : JSON.parse(new TextDecoder().decode(bytes));
      return validateIndex(data);
    } catch (error) {
      if (signal?.aborted || error.name === "AbortError") throw error;
    }
  }

  const response = await fetchImpl(sourceUrl, {
    headers: { Accept: "application/json" }, signal
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return validateIndex(await response.json());
}
