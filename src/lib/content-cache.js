import { AsyncLocalStorage } from "node:async_hooks";

const snapshots = new AsyncLocalStorage();
const buildCache = new Map();

// Astro builds are immutable snapshots. Dev requests and Node callers get a
// fresh cache each time, so edits and validation fixtures are never hidden.
export function withContentSnapshot(load) {
  if (import.meta.env?.PROD || snapshots.getStore()) return load();
  return snapshots.run(new Map(), load);
}

export function memoizeContent(key, load) {
  const cache = import.meta.env?.PROD ? buildCache : snapshots.getStore();
  if (!cache) return load();
  if (cache.has(key)) return cache.get(key);

  const result = Promise.resolve().then(load);
  cache.set(key, result);
  result.catch(() => {
    if (cache.get(key) === result) cache.delete(key);
  });
  return result;
}
