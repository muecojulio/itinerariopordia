import Papa from "papaparse";

/*
 * Lectura y escritura de itinerarios.
 *
 * - .xlsx  → exceljs (carga perezosa con dynamic import: ~solo se descarga
 *   cuando alguien sube o exporta un Excel).
 * - .csv   → papaparse (pequeño, tolera comillas, comas y BOM).
 * - .xls   → formato binario 1997-2003: ya NO se admite (la única librería
 *   que lo leía, SheetJS/xlsx, acumula CVEs sin parche; ver npm audit).
 *   Se detecta por firma y se explica cómo convertirlo.
 */

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

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default || mod;
}

async function readXlsx(buffer) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const table = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = textOf(cell);
    });
    table.push(cells);
  });
  return objectsFromTable(table);
}

function readCsv(buffer) {
  const text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return (parsed.data || []).map((row) => {
    const clean = {};
    for (const [k, v] of Object.entries(row)) {
      if (k != null && k !== "") clean[k] = v == null ? "" : String(v).trim();
    }
    return clean;
  });
}

/* Primera fila con contenido = títulos; el resto = datos. */
function objectsFromTable(table) {
  const rows = table.filter((cells) => cells.some((c) => String(c).trim() !== ""));
  if (rows.length < 2) return [];
  const header = rows[0].map((h, i) => String(h || "").trim() || `COL${i}`);
  return rows.slice(1).map((cells) => {
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = String(cells[i] ?? "").trim();
    });
    return obj;
  });
}

/* Texto visible tal como lo muestra Excel (igual que sheet_to_json raw:false). */
function textOf(cell) {
  const t = cell?.text;
  if (t != null && String(t).trim() !== "") return String(t).trim();
  const v = cell?.value;
  if (v == null) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if (v.result != null) return String(v.result);
    if (v.text) return String(v.text);
    if (v.error) return "";
  }
  return String(v);
}

export async function parseItineraryFile(buffer) {
  const bytes = new Uint8Array(buffer);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isLegacy =
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;

  if (isLegacy || (!isZip && looksBinary(bytes))) {
    const err = new Error(
      "Ese archivo usa el formato .xls antiguo (1997-2003). Ábrelo en Excel y guárdalo como .xlsx, o exporta un .csv."
    );
    err.code = "LEGACY_XLS";
    throw err;
  }

  const rawRows = isZip ? await readXlsx(buffer) : readCsv(buffer);
  const mapped = rawRows.map((row, i) => mapRow(row, i));
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

function looksBinary(bytes) {
  // Un CSV suele ser texto; si hay muchos NUL en la cabecera, es binario.
  const head = bytes.slice(0, 512);
  let nul = 0;
  for (const b of head) if (b === 0) nul += 1;
  return head.length > 8 && nul > head.length * 0.05;
}

export async function exportPlanWorkbook(places, dayWeather = null) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = "RutaDías";
  wb.created = new Date();
  const ws = wb.addWorksheet("Itinerario", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  ws.columns = [
    { header: "Dia", key: "day", width: 6 },
    { header: "Fecha", key: "date", width: 12 },
    { header: "Hora", key: "time", width: 8 },
    { header: "Lugar", key: "name", width: 34 },
    { header: "Tipo", key: "type", width: 12 },
    { header: "Cocina", key: "cuisine", width: 16 },
    { header: "Direccion", key: "address", width: 34 },
    { header: "Que_hacer", key: "what", width: 40 },
    { header: "Pedir", key: "order", width: 40 },
    { header: "Notas", key: "notes", width: 26 },
    { header: "Km", key: "km", width: 8 },
    { header: "Min_a_pie", key: "walk", width: 10 },
    { header: "Lat", key: "lat", width: 12 },
    { header: "Lon", key: "lon", width: 12 },
    { header: "Horario", key: "opening", width: 18 },
    { header: "Clima", key: "weather", width: 20 },
    { header: "Consejo de trayecto", key: "tip", width: 26 }
  ];

  places.forEach((p) => {
    ws.addRow({
      day: p.day || "",
      date: p.date || "",
      time: p.time || "",
      name: p.name || "",
      type: p.type || "",
      cuisine: p.cuisine || "",
      address: p.address || "",
      what: p.what || "",
      order: p.order || "",
      notes: p.notes || "",
      km: p.distanceKm != null ? Number(p.distanceKm.toFixed(2)) : "",
      walk: p.walkMin || "",
      lat: p.lat || "",
      lon: p.lon || "",
      opening: p.opening || "",
      weather: p.weather
        ? `${p.weather.label} ${p.weather.min ?? ""}–${p.weather.max ?? ""}°`
        : dayWeather
          ? `${dayWeather.label} ${dayWeather.min ?? ""}–${dayWeather.max ?? ""}°`
          : "",
      tip:
        p.distanceKm != null
          ? p.distanceKm <= 1
            ? "Conviene ir andando"
            : "Conviene valorar transporte"
          : "Sin mapa"
    });
  });

  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF53D6E" } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFC22A5E" } } };
  });
  ws.eachRow((row, n) => {
    if (n === 1) return;
    if (n % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E4" } };
      });
    }
  });

  return wb.xlsx.writeBuffer();
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
