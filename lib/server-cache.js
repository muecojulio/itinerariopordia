const store = new Map();

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key, value, ttlMs = 30 * 60 * 1000) {
  if (store.size > 400) {
    const first = store.keys().next().value;
    store.delete(first);
  }
  store.set(key, { value, exp: Date.now() + ttlMs });
  return value;
}

export function jsonCached(data, seconds = 1800) {
  return Response.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function jsonNoStore(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
