export function normalizeUrlHostname(hostname) {
  return String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/u, "");
}

export function canonicalUrlHostname(value) {
  return normalizeUrlHostname(new URL(value).hostname);
}

export function urlMatchesHostname(value, domain) {
  const hostname = canonicalUrlHostname(value);
  const normalizedDomain = normalizeUrlHostname(domain);
  return hostname === normalizedDomain
    || hostname.endsWith(`.${normalizedDomain}`);
}
