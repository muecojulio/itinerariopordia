const VALHALLA = "https://valhalla1.openstreetmap.de/route";
const OSRM = "https://router.project-osrm.org/route/v1/driving";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const points = Array.isArray(body.points)
    ? body.points.filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)))
    : [];
  if (points.length < 2) return Response.json({ ok: false, distanceKm: 0, durationMin: 0, legs: [], geometry: [] });

  try {
    const r = await fetch(VALHALLA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: points.map((p) => ({ lat: Number(p.lat), lon: Number(p.lon) })),
        costing: "pedestrian",
        units: "kilometers",
        directions_options: { units: "kilometers" }
      }),
      cache: "no-store"
    });
    if (r.ok) {
      const d = await r.json();
      const trip = d.trip;
      if (trip) {
        const legs = (trip.legs || []).map((leg) => ({
          distanceKm: Number(leg.summary?.length || 0),
          durationMin: Number(leg.summary?.time || 0) / 60
        }));
        return Response.json({
          ok: true,
          provider: "Valhalla",
          distanceKm: Number(trip.summary?.length || 0),
          durationMin: Number(trip.summary?.time || 0) / 60,
          legs,
          geometry: decodePolyline6(trip.shape || "")
        });
      }
    }
  } catch {}

  try {
    const coords = points.map((p) => `${p.lon},${p.lat}`).join(";");
    const r = await fetch(`${OSRM}/${coords}?overview=full&geometries=geojson`, { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      const route = d.routes?.[0];
      if (route) {
        const legs = (route.legs || []).map((leg) => ({
          distanceKm: Number(leg.distance || 0) / 1000,
          durationMin: (Number(leg.distance || 0) / 1000 / 4.4) * 60
        }));
        return Response.json({
          ok: true,
          provider: "OSRM",
          distanceKm: Number(route.distance || 0) / 1000,
          durationMin: (Number(route.distance || 0) / 1000 / 4.4) * 60,
          legs,
          geometry: route.geometry?.coordinates?.map(([lon, lat]) => [lat, lon]) || []
        });
      }
    }
  } catch {}

  return Response.json({ ok: false, distanceKm: 0, durationMin: 0, legs: [], geometry: [] });
}

function decodePolyline6(str) {
  let index = 0, lat = 0, lon = 0, out = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 31) << shift; shift += 5; } while (b >= 32);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 31) << shift; shift += 5; } while (b >= 32);
    const dlon = result & 1 ? ~(result >> 1) : result >> 1;
    lon += dlon;
    out.push([lat / 1e6, lon / 1e6]);
  }
  return out;
}
