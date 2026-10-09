import { cacheGet, cacheSet, jsonCached, jsonNoStore } from "../../../lib/server-cache";
import { clientKey, finiteNum, rateLimit, validCoord, validISODate } from "../../../lib/security";

export async function GET(req) {
  if (!rateLimit(`weather:${clientKey(req)}`, 40)) {
    return jsonNoStore({ weather: null }, 429);
  }
  const { searchParams } = new URL(req.url);
  const lat = finiteNum(searchParams.get("lat"));
  const lon = finiteNum(searchParams.get("lon"));
  const rawDate = searchParams.get("date") || "";
  const date = validISODate(rawDate) ? rawDate : "";

  if (!validCoord(lat, lon)) return jsonCached({ weather: null }, 60);

  const key = `w:${lat.toFixed(3)}:${lon.toFixed(3)}:${date}`;
  const hit = cacheGet(key);
  if (hit) return jsonCached(hit, 1800);

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: "auto",
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
  });
  if (date) {
    params.set("start_date", date);
    params.set("end_date", date);
  }

  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: 1800 }
    });
    const data = await r.json();
    const daily = data.daily;
    let weather = null;
    if (daily?.time?.[0]) {
      weather = {
        date: daily.time[0],
        code: daily.weather_code[0],
        max: daily.temperature_2m_max[0],
        min: daily.temperature_2m_min[0],
        rain: daily.precipitation_probability_max?.[0],
        label: weatherLabel(daily.weather_code[0])
      };
    } else if (data.current) {
      weather = {
        date: "",
        code: data.current.weather_code,
        max: data.current.temperature_2m,
        min: data.current.temperature_2m,
        rain: null,
        label: weatherLabel(data.current.weather_code)
      };
    }
    return jsonCached(cacheSet(key, { weather }, 1800000), 1800);
  } catch {
    return jsonCached({ weather: null }, 120);
  }
}

function weatherLabel(code) {
  if (code === 0) return "Soleado";
  if (code === 1 || code === 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code >= 45 && code <= 48) return "Niebla";
  if (code >= 51 && code <= 67) return "Lluvia";
  if (code >= 71 && code <= 77) return "Nieve";
  if (code >= 80 && code <= 82) return "Chubascos";
  if (code >= 95) return "Tormenta";
  return "Cielo variable";
}
