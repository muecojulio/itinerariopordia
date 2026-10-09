import { cacheGet, cacheSet, jsonCached, jsonNoStore } from "../../../lib/server-cache";
import { clientKey, finiteNum, rateLimit, validCoord } from "../../../lib/security";

export async function GET(req) {
  if (!rateLimit(`air:${clientKey(req)}`)) {
    return jsonNoStore({ air: null }, 429);
  }
  const { searchParams } = new URL(req.url);
  const lat = finiteNum(searchParams.get("lat"));
  const lon = finiteNum(searchParams.get("lon"));
  if (!validCoord(lat, lon)) return jsonCached({ air: null }, 60);

  const key = `air:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const hit = cacheGet(key);
  if (hit) return jsonCached(hit, 1800);

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: "european_aqi,pm2_5,us_aqi"
    });
    const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, {
      next: { revalidate: 1800 }
    });
    const data = await r.json();
    const cur = data.current || {};
    const aqi = cur.european_aqi;
    const out = {
      air: {
        aqi: aqi ?? null,
        pm25: cur.pm2_5 ?? null,
        label: aqiLabel(aqi)
      }
    };
    return jsonCached(cacheSet(key, out, 1800000), 1800);
  } catch {
    return jsonCached({ air: null }, 120);
  }
}

function aqiLabel(aqi) {
  if (aqi == null) return "";
  if (aqi <= 20) return "Aire bueno";
  if (aqi <= 40) return "Aire aceptable";
  if (aqi <= 60) return "Aire regular";
  if (aqi <= 80) return "Aire malo";
  return "Aire muy malo";
}
