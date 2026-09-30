import { cacheGet, cacheSet, jsonCached, jsonNoStore } from "../../../lib/server-cache";
import { clampText, clientKey, rateLimit } from "../../../lib/security";

export async function GET(req) {
  if (!rateLimit(`wiki:${clientKey(req)}`)) {
    return jsonNoStore({ summary: null, error: "Demasiadas consultas." }, 429);
  }
  const q = clampText(new URL(req.url).searchParams.get("q") || "", 120);
  if (q.length < 2) return jsonCached({ summary: null, title: "", url: "" }, 60);

  const key = `wiki:${q.toLowerCase()}`;
  const hit = cacheGet(key);
  if (hit) return jsonCached(hit, 86400);

  try {
    const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "RutaDias/1.1 (itinerario personal)" },
      next: { revalidate: 86400 }
    });
    if (!r.ok) {
      const empty = { summary: null, title: "", url: "" };
      return jsonCached(cacheSet(key, empty, 600000), 300);
    }
    const data = await r.json();
    const out = {
      title: data.title || q,
      summary: data.extract || null,
      url: data.content_urls?.desktop?.page || "",
      thumb: data.thumbnail?.source || null
    };
    return jsonCached(cacheSet(key, out, 86400000), 86400);
  } catch {
    return jsonCached({ summary: null, title: "", url: "" }, 120);
  }
}
