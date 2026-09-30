export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(d) {
  return (d * Math.PI) / 180;
}

export function walkMinutes(km) {
  if (km == null) return null;
  return Math.max(1, Math.round((km / 4.4) * 60));
}

export function formatKm(km) {
  if (km == null || Number.isNaN(km)) return "—";
  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function formatWalk(min) {
  if (min == null) return "—";
  if (min < 60) return `${min} min a pie`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min a pie` : `${h} h a pie`;
}

export function mapsUrl(origin, dest, mode) {
  const o =
    origin && origin.lat != null ? `${origin.lat},${origin.lon}` : "";
  const d = dest && dest.lat != null ? `${dest.lat},${dest.lon}` : dest?.address || dest?.name || "";
  const params = new URLSearchParams({
    api: "1",
    destination: d
  });
  if (o) params.set("origin", o);
  params.set("travelmode", mode === "walk" ? "walking" : "transit");
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function datesInRange(start, end) {
  if (!start || !end) return [];
  const out = [];
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) return [];
  const cur = new Date(a);
  while (cur <= b) {
    const iso = cur.toISOString().slice(0, 10);
    out.push(iso);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function dayNumber(start, date) {
  const dates = datesInRange(start, date);
  return dates.length || 1;
}

export function formatDayLabel(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
}
