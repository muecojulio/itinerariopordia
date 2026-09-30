import { cacheGet, cacheSet, jsonCached, jsonNoStore } from "../../../lib/server-cache";
import { clampText, clientKey, rateLimit } from "../../../lib/security";

export async function GET(req) {
  if (!rateLimit(`holidays:${clientKey(req)}`)) {
    return jsonNoStore({ holidays: [] }, 429);
  }
  const { searchParams } = new URL(req.url);
  const country = clampText(searchParams.get("country") || "", 8).toUpperCase();
  const year = clampText(searchParams.get("year") || String(new Date().getFullYear()), 4);
  if (!/^[A-Z]{2}$/.test(country)) return jsonCached({ holidays: [] }, 300);

  const key = `hol:${country}:${year}`;
  const hit = cacheGet(key);
  if (hit) return jsonCached(hit, 86400);

  try {
    const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }
    });
    if (!r.ok) return jsonCached({ holidays: [] }, 600);
    const data = await r.json();
    const holidays = (Array.isArray(data) ? data : []).map((h) => ({
      date: h.date,
      name: h.localName || h.name,
      global: Boolean(h.global)
    }));
    return jsonCached(cacheSet(key, { holidays }, 86400000), 86400);
  } catch {
    return jsonCached({ holidays: [] }, 120);
  }
}
