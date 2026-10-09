const buckets = new Map();

export function clampText(value, max = 400) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max);
}

export function finiteNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/* lat ∈ [-90, 90], lon ∈ [-180, 180]: corta abusos y consultas absurdas. */
export function validCoord(lat, lon) {
  return (
    lat != null && lon != null &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}

export function clampInt(value, min, max, fallback = min) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const ISODATE = /^\d{4}-\d{2}-\d{2}$/;

export function validISODate(value) {
  if (typeof value !== "string" || !ISODATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export function rateLimit(key, limit = 40, windowMs = 60_000) {
  const now = Date.now();
  const slot = buckets.get(key) || { n: 0, start: now };
  if (now - slot.start > windowMs) {
    slot.n = 0;
    slot.start = now;
  }
  slot.n += 1;
  buckets.set(key, slot);
  if (buckets.size > 2000) buckets.clear();
  return slot.n <= limit;
}

export function clientKey(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}
