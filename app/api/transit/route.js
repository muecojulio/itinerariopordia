const UA = "RutaDias/1.0 (viaje personal)";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radius = Number(searchParams.get("radius") || 700);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ stops: [] });
  }

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
    if (!r.ok) return Response.json({ stops: [] });
    const data = await r.json();
    const stops = (data.elements || [])
      .map((el) => {
        const t = el.tags || {};
        const kind = labelStop(t);
        return {
          id: String(el.id),
          name: t.name || t.ref || kind,
          kind,
          lat: el.lat,
          lon: el.lon
        };
      })
      .filter((s) => s.lat)
      .filter((s, i, arr) => arr.findIndex((x) => x.name === s.name) === i)
      .slice(0, 8);
    return Response.json({ stops });
  } catch {
    return Response.json({ stops: [] });
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
