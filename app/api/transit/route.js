import { clampInt, clampText, clientKey, finiteNum, rateLimit, validCoord } from "../../../lib/security";
import { cacheGet, cacheSet, jsonCached, jsonNoStore } from "../../../lib/server-cache";

const UA = "RutaDias/1.0 (viaje personal)";

export async function GET(req) {
  if (!rateLimit(`transit:${clientKey(req)}`, 25)) {
    return jsonNoStore({ stops: [] }, 429);
  }
  const { searchParams } = new URL(req.url);
  const lat = finiteNum(searchParams.get("lat"));
  const lon = finiteNum(searchParams.get("lon"));
  // Radio limitado: un radio enorme convierte la petición en un DoS contra Overpass.
  const radius = clampInt(searchParams.get("radius"), 150, 1500, 700);

  if (!validCoord(lat, lon)) {
    return jsonCached({ stops: [] }, 60);
  }

  const ck = `tr:${lat.toFixed(3)}:${lon.toFixed(3)}:${radius}`;
  const cached = cacheGet(ck);
  if (cached) return jsonCached(cached, 1800);

  const query = `
    [out:json][timeout:20];
    (
      node["highway"="bus_stop"](around:${radius},${lat},${lon});
      node["public_transport"="stop_position"](around:${radius},${lat},${lon});
      node["public_transport"="station"](around:${radius},${lat},${lon});
      node["amenity"="bus_station"](around:${radius},${lat},${lon});
      node["railway"~"station|halt|tram_stop|subway_entrance"](around:${radius},${lat},${lon});
      node["station"="subway"](around:${radius},${lat},${lon});
    );
    out body 20;
  `;

  try {
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `data=${encodeURIComponent(query)}`
    });
    if (!r.ok) return jsonCached({ stops: [] }, 120);
    const data = await r.json();
    const stops = (data.elements || [])
      .map((el) => {
        const t = el.tags || {};
        const kind = labelStop(t);
        return {
          id: String(el.id),
          name: clampText(t.name || t.ref || kind, 120),
          kind,
          lat: el.lat,
          lon: el.lon
        };
      })
      .filter((s) => s.lat)
      .filter((s, i, arr) => arr.findIndex((x) => x.name === s.name) === i)
      .slice(0, 8);
    return jsonCached(cacheSet(ck, { stops }, 1800000), 1800);
  } catch {
    return jsonCached({ stops: [] }, 120);
  }
}

function labelStop(t) {
  if (t.station === "subway" || t.railway === "subway_entrance") return "Metro";
  if (t.railway === "tram_stop") return "Tranvía";
  if (t.railway === "station" || t.railway === "halt") return "Tren";
  if (t.amenity === "bus_station") return "Terminal de bus";
  if (t.highway === "bus_stop" || t.public_transport) return "Bus";
  return "Parada";
}
