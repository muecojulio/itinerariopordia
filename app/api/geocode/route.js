import { cacheGet, cacheSet, jsonCached, jsonNoStore } from "../../../lib/server-cache";
import { clampText, clientKey, rateLimit } from "../../../lib/security";

const UA = "RutaDias/1.1 (viaje personal; contacto: rutadias@local)";

export async function GET(req) {
  if (!rateLimit(`geo:${clientKey(req)}`)) {
    return jsonNoStore({ results: [], error: "Demasiadas consultas." }, 429);
  }
  const { searchParams } = new URL(req.url);
  const q = clampText(searchParams.get("q") || "", 160);
  const lang = clampText(searchParams.get("lang") || "es", 8);
  if (q.length < 2) return jsonCached({ results: [] }, 60);

  const ck = `geo:${lang}:${q.toLowerCase()}`;
  const cached = cacheGet(ck);
  if (cached) return jsonCached(cached, 3600);

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      q
    )}&count=6&language=${encodeURIComponent(lang)}&format=json`;
    const r = await fetch(url, { next: { revalidate: 3600 } });
    const data = await r.json();
    const results = (data.results || []).map((p) => ({
      name: p.name,
      label: [p.name, p.admin1, p.country].filter(Boolean).join(", "),
      lat: p.latitude,
      lon: p.longitude,
      country: p.country,
      countryCode: p.country_code
    }));
    if (results.length) return jsonCached(cacheSet(ck, { results }, 3600000), 3600);
  } catch {
    /* Photon */
  }

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=${encodeURIComponent(lang)}`;
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    const data = await r.json();
    const results = (data.features || [])
      .map((f) => {
        const p = f.properties || {};
        const [lon, lat] = f.geometry?.coordinates || [];
        return {
          name: p.name || q,
          label: [p.name, p.city, p.state, p.country].filter(Boolean).join(", "),
          lat,
          lon,
          country: p.country || "",
          countryCode: (p.countrycode || "").toUpperCase()
        };
      })
      .filter((x) => Number.isFinite(x.lat));
    if (results.length) return jsonCached(cacheSet(ck, { results }, 3600000), 3600);
  } catch {
    /* Nominatim */
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=${encodeURIComponent(
      lang
    )}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" }
    });
    const data = await r.json();
    const results = (Array.isArray(data) ? data : []).map((p) => ({
      name: p.name || p.display_name.split(",")[0],
      label: p.display_name,
      lat: Number(p.lat),
      lon: Number(p.lon),
      country: "",
      countryCode: ""
    }));
    return jsonCached(cacheSet(ck, { results }, 3600000), 3600);
  } catch {
    return jsonCached(
      { results: [], error: "No pude buscar ese lugar. Prueba con otra palabra." },
      60
    );
  }
}

export async function POST(req) {
  if (!rateLimit(`geopost:${clientKey(req)}`, 10)) {
    return jsonNoStore({ items: [] }, 429);
  }
  const body = await req.json().catch(() => ({}));
  // 24 ítems ≈ 27 s por la pausa de uso justo de Nominatim: cabe en los
  // límites de ejecución serverless. El cliente trocea lotes mayores.
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 24).map((item) => ({
    ...item,
    id: clampText(item?.id || "", 80),
    name: clampText(item?.name || "", 160),
    address: clampText(item?.address || "", 260),
    opening: clampText(item?.opening || "", 160),
    lat: Number.isFinite(Number(item?.lat)) ? Number(item.lat) : null,
    lon: Number.isFinite(Number(item?.lon)) ? Number(item.lon) : null
  }));
  const city = clampText(body.city || "", 120);
  const out = [];

  for (const item of items) {
    if (item.lat != null && item.lon != null) {
      out.push(item);
      continue;
    }
    const q = [item.address, item.name, city].filter(Boolean).join(", ");
    if (!q) {
      out.push(item);
      continue;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&extratags=1&accept-language=es&q=${encodeURIComponent(
        q
      )}`;
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" }
      });
      const data = await r.json();
      const hit = Array.isArray(data) && data[0];
      if (hit) {
        out.push({
          ...item,
          lat: Number(hit.lat),
          lon: Number(hit.lon),
          address: item.address || hit.display_name,
          opening: item.opening || hit.extratags?.opening_hours || ""
        });
      } else {
        out.push(item);
      }
    } catch {
      out.push(item);
    }
    await sleep(1100);
  }

  return jsonNoStore({ items: out });
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
