import { formatKm, formatWalk, haversineKm, walkMinutes } from "./geo";
import { etiquetaTipo } from "./tips";

export function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function cacheKey(place, city) {
  return [place.name, place.address, city]
    .filter(Boolean)
    .join("|")
    .toLowerCase()
    .trim();
}

export function applyCache(places, cache, city) {
  return places.map((p) => {
    if (p.lat != null && p.lon != null) return p;
    const hit = cache[cacheKey(p, city)];
    if (!hit) return p;
    return {
      ...p,
      lat: hit.lat,
      lon: hit.lon,
      address: p.address || hit.address || "",
      opening: p.opening || hit.opening || ""
    };
  });
}

export function rememberCache(places, cache, city) {
  const next = { ...cache };
  places.forEach((p) => {
    if (p.lat == null || p.lon == null) return;
    next[cacheKey(p, city)] = {
      lat: p.lat,
      lon: p.lon,
      address: p.address || "",
      opening: p.opening || ""
    };
  });
  return next;
}

export function daySummary(places, origin, routed = null) {
  const withCoord = places.filter((p) => p.lat != null && p.lon != null);
  let fallbackRouteKm = 0;
  for (let i = 0; i < places.length; i++) {
    const a = i === 0 ? origin : places[i - 1];
    const b = places[i];
    const km = a?.lat != null && b?.lat != null ? haversineKm(a, b) : null;
    if (km != null) fallbackRouteKm += km;
  }
  const routeKm = routed?.distanceKm ?? fallbackRouteKm;
  const routeMin = routed?.durationMin ?? walkMinutes(routeKm);
  const hasOriginRoute = Boolean(origin && routed?.legs?.length === places.length);
  const legs = places.map((b, i) => {
    const leg = routed?.legs?.[hasOriginRoute ? i : i - 1];
    const a = i === 0 ? origin : places[i - 1];
    const fallbackKm =
      a?.lat != null && b?.lat != null ? haversineKm(a, b) : null;
    const km = leg?.distanceKm ?? fallbackKm;
    const walk = km != null && km <= 1;
    return {
      to: b.name,
      km,
      walkMin: leg?.durationMin != null ? Math.round(leg.durationMin) : walkMinutes(km),
      mode: walk ? "a pie" : "transporte"
    };
  });
  const walkKm = legs.filter((l) => l.mode === "a pie").reduce((s, l) => s + (l.km || 0), 0);
  const walkMin = legs.filter((l) => l.mode === "a pie").reduce((s, l) => s + (l.walkMin || 0), 0);
  const transportLegs = legs.filter((l) => l.mode === "transporte").length;
  const fromMe = places.map((p) => p.distanceKm).filter((n) => n != null);
  return {
    count: places.length,
    located: withCoord.length,
    missing: places.length - withCoord.length,
    routeKm,
    routeMin: Math.round(routeMin || 0),
    walkKm,
    walkMin: Math.round(walkMin),
    transportLegs,
    nearestKm: fromMe.length ? Math.min(...fromMe) : null,
    legs
  };
}

export function clothingTip(weather) {
  if (!weather) return "";
  const max = weather.max;
  if (weather.rain >= 50) return "Lleva chaqueta o paraguas.";
  if (max != null && max <= 12) return "Abrígate: va a hacer fresco.";
  if (max != null && max >= 28) return "Agua y gorra: va a hacer calor.";
  if ((weather.code || 0) >= 3) return "Capa ligera por si se nublan.";
  return "Ropa cómoda para caminar.";
}

export function shareText(dayLabel, city, places, summary, weather) {
  const lines = [
    `RutaDías · ${dayLabel}${city ? ` · ${city}` : ""}`,
    weather
      ? `Clima: ${weather.label} ${Math.round(weather.max)}° / ${Math.round(weather.min)}°`
      : "",
    summary
      ? `${summary.count} paradas · ${formatKm(summary.routeKm)} del recorrido · ${formatWalk(summary.routeMin)}`
      : "",
    ""
  ].filter((x, i, arr) => x || arr[i - 1] !== "");

  places.forEach((p, i) => {
    lines.push(
      `${i + 1}. ${p.time ? p.time + " · " : ""}${p.name} (${etiquetaTipo(p.type)})`
    );
    if (p.cuisine) lines.push(`   Cocina ${p.cuisine}`);
    if (p.distanceKm != null) lines.push(`   ${formatKm(p.distanceKm)} · ${formatWalk(p.walkMin)}`);
    if (p.order) lines.push(`   Pedir: ${p.order}`);
  });
  return lines.filter(Boolean).join("\n");
}

export function minutesUntil(timeHHmm) {
  if (!timeHHmm || !/^\d{1,2}:\d{2}$/.test(timeHHmm)) return null;
  const [h, m] = timeHHmm.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}
