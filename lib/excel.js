import * as XLSX from "xlsx";

const ALIAS = {
  dia: "day",
  día: "day",
  day: "day",
  fecha: "date",
  date: "date",
  hora: "time",
  time: "time",
  hour: "time",
  lugar: "name",
  sitio: "name",
  nombre: "name",
  place: "name",
  name: "name",
  tipo: "type",
  type: "type",
  categoria: "type",
  categoría: "type",
  cocina: "cuisine",
  comida: "cuisine",
  cuisine: "cuisine",
  food: "cuisine",
  direccion: "address",
  dirección: "address",
  address: "address",
  dir: "address",
  que_hacer: "what",
  qué_hacer: "what",
  quehacer: "what",
  actividad: "what",
  what: "what",
  pedir: "order",
  recomendado: "order",
  recomendaciones: "order",
  order: "order",
  notas: "notes",
  notes: "notes",
  note: "notes",
  horario: "opening",
  opening: "opening",
  opening_hours: "opening",
  lat: "lat",
  latitude: "lat",
  lon: "lon",
  lng: "lon",
  long: "lon",
  longitude: "lon"
};

function normHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function parseItineraryFile(buffer) {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  const mapped = rows.map((row, i) => mapRow(row, i));
  const warnings = [];
  mapped.forEach((r, i) => {
    if (!r.name) warnings.push(`Fila ${i + 2}: falta el lugar.`);
    if (!r.day && !r.date) warnings.push(`Fila ${i + 2} (${r.name || "sin nombre"}): falta día o fecha.`);
  });
  if (!mapped.some((r) => r.name)) warnings.push("No encontré una columna Lugar / Nombre.");
  return {
    rows: mapped.filter((r) => r.name),
    skipped: mapped.filter((r) => !r.name).length,
    warnings
  };
}

export function exportPlanWorkbook(places, dayWeather = null) {
  const header = ["Dia","Fecha","Hora","Lugar","Tipo","Cocina","Direccion","Que_hacer","Pedir","Notas","Km","Min_a_pie","Lat","Lon","Horario","Clima","Consejo de trayecto"];
  const data = places.map((p) => [
    p.day || "",
    p.date || "",
    p.time || "",
    p.name || "",
    p.type || "",
    p.cuisine || "",
    p.address || "",
    p.what || "",
    p.order || "",
    p.notes || "",
    p.distanceKm != null ? Number(p.distanceKm.toFixed(2)) : "",
    p.walkMin || "",
    p.lat || "",
    p.lon || "",
    p.opening || "",
    p.weather ? `${p.weather.label} ${p.weather.min ?? ""}–${p.weather.max ?? ""}°` : dayWeather ? `${dayWeather.label} ${dayWeather.min ?? ""}–${dayWeather.max ?? ""}°` : "",
    p.distanceKm != null ? (p.distanceKm <= 1 ? "Conviene ir andando" : "Conviene valorar transporte") : "Sin mapa"
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  XLSX.utils.book_append_sheet(wb, ws, "Itinerario");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

function mapRow(row, index) {
  const mapped = {};
  for (const [k, v] of Object.entries(row)) {
    const key = ALIAS[normHeader(k)];
    if (key) mapped[key] = typeof v === "string" ? v.trim() : v;
  }
  let date = toIsoDate(mapped.date);
  const day = Number(mapped.day) || null;
  let time = String(mapped.time || "").trim();
  if (time && time.includes("T")) time = time.split("T")[1]?.slice(0, 5) || time;
  if (/^\d{1,2}:\d{2}/.test(time)) time = time.slice(0, 5);
  return {
    id: `excel-${index}-${slug(mapped.name || "lugar")}`,
    day,
    date,
    time,
    name: String(mapped.name || "").trim(),
    type: String(mapped.type || "otro").trim().toLowerCase(),
    cuisine: String(mapped.cuisine || "").trim(),
    address: String(mapped.address || "").trim(),
    what: String(mapped.what || "").trim(),
    order: String(mapped.order || "").trim(),
    notes: String(mapped.notes || "").trim(),
    opening: String(mapped.opening || "").trim(),
    lat: toNum(mapped.lat),
    lon: toNum(mapped.lon),
    source: "excel",
    excelOrder: index
  };
}

function toNum(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(v) {
  if (!v) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

function slug(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 24);
}

export function downloadExampleCsv() {
  const header = ["Dia","Fecha","Hora","Lugar","Tipo","Cocina","Direccion","Que_hacer","Pedir","Notas"];
  const rows = [
    ["1","","09:30","Mercado central","mercado","local","","Pasear puestos y desayunar de pie","Lo que tenga más cola de gente local","Llevar efectivo"],
    ["1","","13:00","Restaurante del barrio","restaurante","local","","Comer menú del día","Plato del día y agua",""],
    ["1","","16:00","Museo o templo principal","visita","","","Visita corta de 60–90 min","","Revisar horario"]
  ];
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  return "\uFEFF" + csv;
}
