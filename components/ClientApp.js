"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView from "./MapView";
import InstallHint from "./InstallHint";
import VoicePanel from "./VoicePanel";
import Switch from "./Switch";
import ActionButton from "./ActionButton";
import SearchSelect from "./SearchSelect";
import DayRail from "./DayRail";
import PlaceCard from "./PlaceCard";
import { downloadExampleCsv, exportPlanWorkbook, parseItineraryFile } from "../lib/excel";
import { datesInRange, dayNumber, formatDayLabel, formatKm, haversineKm, walkMinutes } from "../lib/geo";
import { cocinaEnEspanol, etiquetaTipo, tipoEnEspanol, tipsPara } from "../lib/tips";
import { applyCache, clothingTip, daySummary, localISODate, minutesUntil, rememberCache, shareText } from "../lib/plan";
import { scriptForPlaces, speakText, stopTalking } from "../lib/voice";
import { loadState, saveState } from "../lib/idb";
import usePressStates from "../lib/usePressStates";
import useSwipePanels from "../lib/useSwipePanels";
import useHorizontalRail from "../lib/useHorizontalRail";
import { stepIndex } from "../lib/gestures";

const STORAGE = "rutadias-v4";
const TABS = [
  { id: "plan", label: "Plan", icon: "🗓️" },
  { id: "mapa", label: "Mapa", icon: "🗺️" },
  { id: "subir", label: "Excel", icon: "📤" },
  { id: "instalar", label: "App", icon: "📲" }
];

function weatherEmoji(code) {
  if (code == null) return "🌤️";
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  return "⛈️";
}

function newTrip(name) {
  const t = localISODate();
  const end = localISODate(new Date(Date.now() + 2 * 86400000));
  return {
    id: `viaje-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: name || "Viaje nuevo",
    start: t,
    end,
    city: "",
    cityPos: null,
    places: [],
    startSource: "gps",
    manualStart: null
  };
}

export default function ClientApp() {
  const [tab, setTab] = useState("plan");
  const [dir, setDir] = useState(0);
  const [trips, setTrips] = useState([newTrip("Mi viaje")]);
  const [currentId, setCurrentId] = useState("");
  const [geoCache, setGeoCache] = useState({});
  const [cityHits, setCityHits] = useState([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [startHits, setStartHits] = useState([]);
  const [startLoading, setStartLoading] = useState(false);
  const [startQuery, setStartQuery] = useState("");
  const [myPos, setMyPos] = useState(null);
  const [geoMsg, setGeoMsg] = useState("");
  const [voiceUri, setVoiceUri] = useState("");
  const [toneId, setToneId] = useState("natural");
  const [speaking, setSpeaking] = useState(false);
  const [dayFilter, setDayFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [dayWeather, setDayWeather] = useState(null);
  const [notifyOn, setNotifyOn] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [airInfo, setAirInfo] = useState(null);
  const [ready, setReady] = useState(false);
  const seenAlarms = useRef(new Set());
  const fileRef = useRef(null);
  const navRef = useRef(null);
  const panesRef = useRef(null);
  const timers = useRef({});
  const upload = usePressStates({ successMs: 2400, errorMs: 4200 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const idb = await loadState();
        if (!cancelled && idb?.trips?.length) {
          setTrips(idb.trips);
          setCurrentId(idb.currentId || idb.trips[0].id);
          if (idb.geoCache) setGeoCache(idb.geoCache);
          if (idb.notifyOn) setNotifyOn(true);
          if (idb.voiceUri) setVoiceUri(idb.voiceUri);
          if (idb.toneId) setToneId(idb.toneId);
          setReady(true);
          return;
        }
      } catch {}
      try {
        const raw = localStorage.getItem(STORAGE);
        if (raw) {
          const s = JSON.parse(raw);
          if (Array.isArray(s.trips) && s.trips.length) {
            setTrips(s.trips);
            setCurrentId(s.currentId || s.trips[0].id);
          } else if (Array.isArray(s.places)) {
            const migrated = { ...newTrip(s.city || "Viaje guardado"), start: s.start, end: s.end, city: s.city || "", cityPos: s.cityPos || null, places: s.places };
            setTrips([migrated]);
            setCurrentId(migrated.id);
          }
          if (s.geoCache) setGeoCache(s.geoCache);
          if (s.notifyOn) setNotifyOn(true);
          if (s.voiceUri) setVoiceUri(s.voiceUri);
          if (s.toneId) setToneId(s.toneId);
        } else {
          const first = newTrip("Mi viaje");
          setTrips([first]);
          setCurrentId(first.id);
        }
      } catch {
        const first = newTrip("Mi viaje");
        setTrips([first]);
        setCurrentId(first.id);
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload = { trips, currentId, geoCache, notifyOn, voiceUri, toneId };
    try { localStorage.setItem(STORAGE, JSON.stringify(payload)); } catch {}
    saveState(payload).catch(() => {});
  }, [trips, currentId, geoCache, notifyOn, voiceUri, toneId, ready]);

  useEffect(() => () => {
    Object.values(timers.current).forEach((t) => clearTimeout(t));
  }, []);

  const trip = trips.find((t) => t.id === currentId) || trips[0];
  const start = trip?.start || localISODate();
  const end = trip?.end || start;
  const city = trip?.city || "";
  const cityPos = trip?.cityPos || null;
  const places = trip?.places || [];
  const startSource = trip?.startSource || "gps";
  const manualStart = trip?.manualStart || null;
  const days = useMemo(() => datesInRange(start, end), [start, end]);
  const today = localISODate();
  const todayIndex = days.indexOf(today);

  function patchTrip(partial) {
    const id = trip?.id;
    if (!id) return;
    setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, ...partial } : t)));
  }
  function ping(msg) {
    setToast(msg);
    clearTimeout(timers.current.toast);
    timers.current.toast = setTimeout(() => setToast(""), 3400);
  }

  const origin = useMemo(() => {
    if (startSource === "manual" && manualStart?.lat != null) return manualStart;
    if (myPos?.lat != null) return myPos;
    return cityPos;
  }, [startSource, manualStart, myPos, cityPos]);
  const originLabel = startSource === "manual" && manualStart?.label ? manualStart.label : myPos ? "Tu GPS" : city || "Centro de la ciudad";

  const decorated = useMemo(() => {
    return places
      .map((p) => {
        const km = origin && p.lat != null ? haversineKm(origin, p) : null;
        return { ...p, distanceKm: km, walkMin: walkMinutes(km) };
      })
      .sort((a, b) => (a.day || 99) - (b.day || 99) || (a.excelOrder ?? 0) - (b.excelOrder ?? 0));
  }, [places, origin]);

  const typeOptions = useMemo(() => {
    const labels = new Map();
    decorated.forEach((p) => {
      const label = etiquetaTipo(p.type);
      labels.set(label, (labels.get(label) || 0) + 1);
    });
    return [...labels.entries()].sort((a, b) => b[1] - a[1]);
  }, [decorated]);
  const activeType = typeFilter !== "all" && typeOptions.some(([label]) => label === typeFilter) ? typeFilter : "all";

  const visible = useMemo(
    () => decorated.filter((p) => (dayFilter === "all" || String(p.day) === String(dayFilter)) && (activeType === "all" || etiquetaTipo(p.type) === activeType)),
    [decorated, dayFilter, activeType]
  );
  const summary = useMemo(() => daySummary(visible, origin, routeData), [visible, origin, routeData]);

  const dayItems = useMemo(() => {
    const counts = new Map();
    decorated.forEach((p) => {
      const key = String(p.day);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const items = [
      {
        id: "all",
        label: "Todo el viaje",
        sub: days.length === 1 ? formatDayLabel(days[0]) : `${days.length} días`,
        count: decorated.length
      }
    ];
    days.forEach((d, i) => {
      items.push({
        id: String(i + 1),
        label: `Día ${i + 1}`,
        sub: formatDayLabel(d),
        count: counts.get(String(i + 1)) || 0,
        today: d === today
      });
    });
    return items;
  }, [days, decorated, today]);

  useEffect(() => {
    const points = (origin ? [origin, ...visible] : visible).filter((p) => p?.lat != null && p?.lon != null);
    if (points.length < 2) { setRouteData(null); return; }
    let cancelled = false;
    fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points }) })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRouteData(d?.ok ? d : null); })
      .catch(() => { if (!cancelled) setRouteData(null); });
    return () => { cancelled = true; };
  }, [origin?.lat, origin?.lon, visible.map((p) => `${p.id}:${p.lat}:${p.lon}`).join("|")]);

  const selectedDate = dayFilter === "all" ? (days.includes(today) ? today : days[0]) : days[Number(dayFilter) - 1];
  const tripHolidays = useMemo(() => holidays.filter((h) => days.includes(h.date)), [holidays, days]);
  const dayHoliday = tripHolidays.find((h) => h.date === selectedDate) || null;

  useEffect(() => {
    const point = cityPos || visible.find((p) => p.lat != null);
    if (!point || !selectedDate) { setDayWeather(null); return undefined; }
    let cancel = false;
    fetch(`/api/weather?lat=${point.lat}&lon=${point.lon}&date=${selectedDate}`)
      .then((r) => r.json())
      .then((d) => { if (!cancel) setDayWeather(d.weather || null); })
      .catch(() => { if (!cancel) setDayWeather(null); });
    return () => { cancel = true; };
  }, [selectedDate, cityPos, visible.length]);

  useEffect(() => {
    const code = cityPos?.countryCode;
    const year = (start || today).slice(0, 4);
    if (!code) { setHolidays([]); return undefined; }
    let cancel = false;
    fetch(`/api/holidays?country=${encodeURIComponent(code)}&year=${year}`)
      .then((r) => r.json())
      .then((d) => { if (!cancel) setHolidays(d.holidays || []); })
      .catch(() => { if (!cancel) setHolidays([]); });
    return () => { cancel = true; };
  }, [cityPos?.countryCode, start, today]);

  useEffect(() => {
    const point = cityPos || visible.find((p) => p.lat != null);
    if (!point) { setAirInfo(null); return undefined; }
    let cancel = false;
    fetch(`/api/air?lat=${point.lat}&lon=${point.lon}`)
      .then((r) => r.json())
      .then((d) => { if (!cancel) setAirInfo(d.air || null); })
      .catch(() => { if (!cancel) setAirInfo(null); });
    return () => { cancel = true; };
  }, [cityPos?.lat, cityPos?.lon, visible.length]);

  useEffect(() => {
    if (!notifyOn) return undefined;
    const tick = () => {
      const todays = decorated.filter((p) => p.date === today || (todayIndex >= 0 && p.day === todayIndex + 1));
      todays.forEach((p) => {
        const mins = minutesUntil(p.time);
        if (mins == null || mins > 20 || mins < -5) return;
        if (seenAlarms.current.has(p.id)) return;
        seenAlarms.current.add(p.id);
        const body = `${p.time || ""} ${p.name}`.trim();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Siguiente parada", { body });
        }
        ping(`En breve: ${body}`);
      });
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, [notifyOn, decorated, today, todayIndex]);

  useEffect(() => {
    if (ready && todayIndex >= 0 && dayFilter === "all") setDayFilter(String(todayIndex + 1));
  }, [ready, todayIndex]);

  function locate(asStart) {
    if (!navigator.geolocation) { setGeoMsg("Este dispositivo no da ubicación."); return { ok: false, error: "Este dispositivo no da ubicación." }; }
    setGeoMsg("Pidiendo permiso de ubicación…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setMyPos(next);
        if (asStart) { patchTrip({ startSource: "gps", manualStart: null }); setGeoMsg(""); }
        setGeoMsg("GPS listo. Las distancias salen desde este punto.");
      },
      () => setGeoMsg("No pude usar el GPS. Elige un punto de partida escribiendo la dirección."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
    return { ok: true };
  }

  function searchCity(q) {
    patchTrip({ city: q });
    clearTimeout(timers.current.city);
    if (q.trim().length < 2) { setCityHits([]); setCityLoading(false); return; }
    setCityLoading(true);
    timers.current.city = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        setCityHits(data.results || []);
      } catch {
        setCityHits([]);
      } finally {
        setCityLoading(false);
      }
    }, 320);
  }
  function pickCity(hit) {
    patchTrip({ city: hit.label, cityPos: { lat: hit.lat, lon: hit.lon, country: hit.country, countryCode: hit.countryCode || "" } });
    setCityHits([]);
    ping(`Ciudad: ${hit.label}`);
  }
  function searchStart(q) {
    setStartQuery(q);
    clearTimeout(timers.current.start);
    if (q.trim().length < 2) { setStartHits([]); setStartLoading(false); return; }
    setStartLoading(true);
    timers.current.start = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        setStartHits(data.results || []);
      } catch {
        setStartHits([]);
      } finally {
        setStartLoading(false);
      }
    }, 320);
  }
  function pickStart(hit) {
    patchTrip({ startSource: "manual", manualStart: { lat: hit.lat, lon: hit.lon, label: hit.label } });
    setStartQuery(hit.label);
    setStartHits([]);
    ping("Punto de partida guardado");
  }
  function listenDay() {
    if (!visible.length) return { ok: false, error: "Primero sube un Excel con paradas." };
    const text = scriptForPlaces(visible, { toneId, city, startLabel: originLabel });
    const res = speakText(text, { voiceUri, toneId });
    if (!res.ok) return res;
    setSpeaking(true);
    setTimeout(() => setSpeaking(false), Math.min(120000, text.length * 80));
    return { ok: true };
  }
  function listenPlace(p) {
    return speakText(scriptForPlaces([p], { toneId, city, startLabel: originLabel }), { voiceUri, toneId });
  }

  async function onExcel(file) {
    if (!file) return { ok: false, error: "No elegiste ningún archivo." };
    setWarnings([]);
    setBusy("Leyendo Excel…");
    try {
      const buf = await file.arrayBuffer();
      const parsed = await parseItineraryFile(buf);
      const notes = [...(parsed.warnings || [])];
      let rows = parsed.rows.map((row) => {
        const date = row.date || (row.day && days[row.day - 1] ? days[row.day - 1] : "");
        const day = row.day || (date && start ? dayNumber(start, date) : null);
        const type = tipoEnEspanol(row.type);
        const cuisine = cocinaEnEspanol(row.cuisine);
        const tips = tipsPara(type, cuisine);
        return { ...row, date, day, type, cuisine, what: row.what || tips.que, order: row.order || tips.pedir };
      });
      rows.forEach((p, i) => {
        if (!p.name) notes.push(`Fila ${i + 2}: falta el lugar y no se cargará.`);
        if (!p.day && !p.date) notes.push(`Fila ${i + 2} (${p.name || "sin nombre"}): falta el día o la fecha y no se cargará.`);
        if (p.day && (p.day < 1 || p.day > days.length)) notes.push(`Fila ${i + 2} (${p.name}): el Día ${p.day} está fuera del periodo y no se cargará.`);
        if (p.date && days.length && !days.includes(p.date)) notes.push(`Fila ${i + 2} (${p.name}): la fecha ${p.date} está fuera del periodo y no se cargará.`);
      });
      rows = rows.filter((p) => p.name && (p.day || p.date) && (!p.day || (p.day >= 1 && p.day <= days.length)) && (!p.date || !days.length || days.includes(p.date)));
      rows = applyCache(rows, geoCache, city);
      const pending = rows.filter((p) => p.lat == null || p.lon == null);
      // El servidor geocodifica lotes de 24 (pausa de uso justo de Nominatim);
      // aquí se trocea para no perder paradas en itinerarios grandes.
      const BATCH = 24;
      for (let i = 0; i < pending.length; i += BATCH) {
        const part = pending.slice(i, i + BATCH);
        setBusy(`Buscando mapa de ${pending.length} lugares (${Math.min(i + BATCH, pending.length)} de ${pending.length})…`);
        const r = await fetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: part, city }) });
        const data = await r.json();
        const found = data.items || part;
        const byId = new Map(found.map((p) => [p.id, p]));
        rows = rows.map((p) => byId.get(p.id) || p);
      }
      rows.forEach((p) => { if (p.lat == null) notes.push(`${p.name}: no encontré la ubicación en el mapa.`); });
      if (!rows.length) {
        setWarnings(notes);
        return { ok: false, error: "El archivo no tenía paradas válidas para estas fechas." };
      }
      setGeoCache((prev) => rememberCache(rows, prev, city));
      patchTrip({ places: rows });
      setWarnings(notes);
      setTypeFilter("all");
      goTab("plan", -1);
      return { ok: true, count: rows.length };
    } catch (err) {
      return {
        ok: false,
        error:
          err?.code === "LEGACY_XLS"
            ? err.message
            : "No pude leer ese archivo. Usa .xlsx o .csv."
      };
    } finally {
      setBusy("");
    }
  }

  async function loadExtras(place) {
    if (!place.lat) return { ok: false, error: "Ese lugar aún no tiene mapa." };
    setBusy("Paradas y clima…");
    try {
      const q = [place.name, city].filter(Boolean).join(" ");
      const [t, w, ph, wiki, air] = await Promise.all([
        fetch(`/api/transit?lat=${place.lat}&lon=${place.lon}`).then((r) => r.json()),
        fetch(`/api/weather?lat=${place.lat}&lon=${place.lon}&date=${place.date || start}`).then((r) => r.json()),
        fetch(`/api/photo?q=${encodeURIComponent(q)}`).then((r) => r.json()),
        fetch(`/api/wiki?q=${encodeURIComponent(place.name)}`).then((r) => r.json()),
        fetch(`/api/air?lat=${place.lat}&lon=${place.lon}`).then((r) => r.json())
      ]);
      patchTrip({
        places: places.map((p) => p.id === place.id ? { ...p, stops: t.stops || [], weather: w.weather, photo: ph.url ? ph : p.photo, wiki: wiki.summary ? wiki : p.wiki, air: air.air || p.air } : p)
      });
      setFocus(place);
      goTab("mapa", 1);
      return { ok: true };
    } catch {
      return { ok: false, error: "No pude cargar los extras ahora." };
    } finally {
      setBusy("");
    }
  }

  async function enrichAll() {
    if (!places.length) return { ok: false, error: "No hay paradas que mejorar." };
    setBusy("Mejorando textos…");
    try {
      const next = [];
      for (const p of places) {
        const r = await fetch("/api/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place: p, city }) });
        const d = await r.json();
        next.push({ ...p, what: d.what || p.what, order: d.order || p.order });
      }
      patchTrip({ places: next });
      return { ok: true };
    } catch {
      return { ok: false, error: "No pude mejorar los textos ahora." };
    } finally {
      setBusy("");
    }
  }

  function downloadTemplate() {
    try {
      const csv = downloadExampleCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ejemplo-rutadias.csv";
      a.click();
      return { ok: true };
    } catch {
      return { ok: false, error: "No pude generar el ejemplo." };
    }
  }
  async function exportPlan() {
    if (!visible.length) return { ok: false, error: "No hay paradas que exportar." };
    try {
      const bytes = await exportPlanWorkbook(visible, dayWeather);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(trip?.name || "itinerario").replace(/\s+/g, "-")}.xlsx`;
      a.click();
      return { ok: true };
    } catch {
      return { ok: false, error: "No pude exportar el plan." };
    }
  }
  async function shareDay() {
    if (!visible.length) return { ok: false, error: "No hay paradas que compartir." };
    const label = dayFilter === "all" ? "Todo el viaje" : `Día ${dayFilter} · ${formatDayLabel(selectedDate || "")}`;
    const text = shareText(label, city, visible, summary, dayWeather);
    try {
      if (navigator.share) { await navigator.share({ title: "RutaDías", text }); return { ok: true }; }
    } catch {
      return { ok: false, error: "Se canceló el compartir." };
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    return { ok: true };
  }
  async function enableNotify() {
    if (typeof Notification === "undefined") return { ok: false, error: "Este navegador no admite avisos." };
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { setNotifyOn(false); return { ok: false, error: "No diste permiso de avisos." }; }
    setNotifyOn(true);
    return { ok: true };
  }
  function goToday() {
    if (todayIndex < 0) return { ok: false, error: "Hoy no está dentro del periodo del viaje." };
    setDayFilter(String(todayIndex + 1));
    goTab("plan", -1);
    return { ok: true };
  }

  const activeTabIndex = Math.max(0, TABS.findIndex((t) => t.id === tab));
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  const goTab = useCallback((id, direction) => {
    const previous = tabRef.current;
    if (previous === id) return;
    stopTalking();
    const from = TABS.findIndex((t) => t.id === previous);
    const to = TABS.findIndex((t) => t.id === id);
    setDir(direction ?? Math.sign(to - from));
    tabRef.current = id;
    setTab(id);
  }, []);

  function onNavKeyDown(event) {
    const keys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : stepIndex(activeTabIndex, event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1, TABS.length);
    const target = TABS[next];
    if (!target) return;
    goTab(target.id, Math.sign(next - activeTabIndex) || 1);
    requestAnimationFrame(() => {
      navRef.current?.querySelectorAll('[role="tab"]')?.[next]?.focus({ preventScroll: true });
    });
  }

  const swipeEnabled = tab !== "mapa";
  const paneHandlers = useSwipePanels({
    order: TABS.map((t) => t.id),
    active: tab,
    onChange: goTab,
    containerRef: panesRef,
    enabled: swipeEnabled
  });

  const typeRail = useHorizontalRail({ deps: [typeOptions.length, activeType] });
  useEffect(() => {
    if (activeType === "all") return;
    typeRail.centerOn(`[data-type="${CSS.escape(activeType)}"]`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType]);

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow"><span aria-hidden="true">✈️</span> RutaDías</p>
          <h1>{trip?.name || "Mi viaje"}</h1>
        </div>
        <ActionButton
          variant="ghost"
          icon="◉"
          onPress={goToday}
          successMessage="Vamos al día de hoy"
          errorMessage="Hoy no está en el viaje"
        >
          Hoy
        </ActionButton>
      </header>
      {geoMsg ? <p className="banner" id="geo-msg" role="status">{geoMsg}</p> : null}
      {busy ? <p className="banner busy" role="status" aria-live="polite">{busy}</p> : null}
      {toast ? <p className="toast" role="status" aria-live="polite">{toast}</p> : null}
      <main
        className={swipeEnabled ? "main swipeable" : "main"}
        ref={panesRef}
        {...paneHandlers}
      >
        <div
          className="tabpanel"
          id="panel-plan"
          role="tabpanel"
          aria-labelledby="tab-plan"
          hidden={tab !== "plan"}
        >
          {tab === "plan" ? (
            <section className="stack pane" key={`plan-${dir}`} data-dir={dir}>
              <div className="card origin-card">
                <h2>Punto de partida</h2>
                <p className="origin-now">Salida: {originLabel}</p>
                <div className="start-actions">
                  <ActionButton
                    block
                    variant={startSource === "gps" ? "primary" : "plain"}
                    icon="⌖"
                    busyLabel="Pidiendo permiso…"
                    onPress={() => locate(true)}
                    successMessage="Distancias desde tu GPS"
                    errorMessage="No pude usar el GPS"
                    aria-describedby={geoMsg ? "geo-msg" : undefined}
                  >
                    Punto de partida con geolocalización
                  </ActionButton>
                  <ActionButton
                    block
                    variant={startSource === "manual" ? "primary" : "plain"}
                    icon="✎"
                    onPress={() => { patchTrip({ startSource: "manual" }); return { ok: true }; }}
                    successMessage="Escribe la dirección de salida"
                  >
                    Elegir otro punto de partida
                  </ActionButton>
                </div>
                {startSource === "manual" ? (
                  <SearchSelect
                    id="salida"
                    label="Dirección o lugar de salida"
                    value={startQuery}
                    onChangeText={searchStart}
                    options={startHits.map((h) => ({ id: `${h.lat}-${h.lon}`, label: h.label, data: h }))}
                    onSelect={(item) => pickStart(item.data)}
                    placeholder="Hotel, estación, calle…"
                    loading={startLoading}
                    emptyMessage="Sin coincidencias. Prueba con otra dirección."
                  />
                ) : null}
              </div>
              <VoicePanel voiceUri={voiceUri} toneId={toneId} onVoice={setVoiceUri} onTone={setToneId} onListen={listenDay} speaking={speaking} />
              <div className="card">
                <h2>Viaje</h2>
                <div className="row wrap">
                  <label className="field">
                    <span className="field-label">Viaje activo</span>
                    <select value={trip?.id || ""} onChange={(e) => { setCurrentId(e.target.value); setDayFilter("all"); setTypeFilter("all"); }}>
                      {trips.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                    </select>
                  </label>
                  <ActionButton
                    icon="＋"
                    onPress={() => { const n = newTrip(`Viaje ${trips.length + 1}`); setTrips((prev) => [...prev, n]); setCurrentId(n.id); setDayFilter("all"); setTypeFilter("all"); return { ok: true }; }}
                    successMessage="Viaje nuevo creado"
                  >
                    Nuevo
                  </ActionButton>
                  {trips.length > 1 ? (
                    <ActionButton
                      variant="danger"
                      icon="✕"
                      onPress={() => { const rest = trips.filter((t) => t.id !== trip.id); setTrips(rest); setCurrentId(rest[0].id); return { ok: true }; }}
                      successMessage="Viaje borrado"
                    >
                      Borrar
                    </ActionButton>
                  ) : null}
                </div>
                <label className="field">
                  <span className="field-label">Nombre del viaje</span>
                  <input value={trip?.name || ""} onChange={(e) => patchTrip({ name: e.target.value })} />
                </label>
                <div className="row">
                  <label className="field">
                    <span className="field-label">Desde</span>
                    <input type="date" value={start} onChange={(e) => patchTrip({ start: e.target.value })} />
                  </label>
                  <label className="field">
                    <span className="field-label">Hasta</span>
                    <input type="date" value={end} onChange={(e) => patchTrip({ end: e.target.value })} />
                  </label>
                </div>
                <SearchSelect
                  id="ciudad"
                  label="Ciudad del viaje"
                  value={city}
                  onChangeText={searchCity}
                  options={cityHits.map((h) => ({ id: `${h.lat}-${h.lon}`, label: h.label, data: h }))}
                  onSelect={(item) => pickCity(item.data)}
                  placeholder="Lisboa, Tokio, CDMX…"
                  hint="Escribe al menos 2 letras. Se ignoran mayúsculas y acentos."
                  loading={cityLoading}
                  emptyMessage="Sin coincidencias. Revisa la ortografía."
                />
              </div>
              {dayWeather ? (
                <div className="weather-strip">
                  <span className="weather-emoji" aria-hidden="true">{weatherEmoji(dayWeather.code)}</span>
                  <strong>{dayFilter === "all" ? "Clima del día" : `Día ${dayFilter}`}</strong>
                  <span>{String(dayWeather.label || "").toLowerCase()} · {Math.round(dayWeather.min)}–{Math.round(dayWeather.max)}°</span>
                  <span>{clothingTip(dayWeather)}</span>
                  {airInfo?.label ? <span>🍃 {airInfo.label}</span> : null}
                </div>
              ) : null}
              <DayRail
                items={dayItems}
                active={dayFilter}
                onChange={(id) => setDayFilter(id)}
                label="Días del viaje"
              />
              <div id="day-panel" className="day-panel" role="tabpanel" aria-labelledby={`daytab-${dayFilter}`}>
                {typeOptions.length > 1 ? (
                  <div
                    className="rail-wrap chips-wrap"
                    data-overflow={typeRail.edges.overflows ? "yes" : "no"}
                    data-start={typeRail.edges.atStart ? "no" : "yes"}
                    data-end={typeRail.edges.atEnd ? "no" : "yes"}
                  >
                    <div className="rail chips" role="group" aria-label="Filtros por tipo de parada" ref={typeRail.ref}>
                      <button
                        type="button"
                        className={activeType === "all" ? "chip on" : "chip"}
                        aria-pressed={activeType === "all"}
                        data-type="all"
                        onClick={() => setTypeFilter("all")}
                      >
                        Todos
                      </button>
                      {typeOptions.map(([label, count]) => (
                        <button
                          key={label}
                          type="button"
                          className={activeType === label ? "chip on" : "chip"}
                          aria-pressed={activeType === label}
                          data-type={label}
                          onClick={() => setTypeFilter(activeType === label ? "all" : label)}
                        >
                          {label} <span className="chip-count">{count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {warnings.length > 0 ? (
                  <div className="card warn">
                    <h2>Avisos</h2>
                    <ul>{warnings.map((w) => (<li key={w}>{w}</li>))}</ul>
                  </div>
                ) : null}
                {visible.length > 0 ? (
                  <div className="card summary">
                    <h2>{dayFilter === "all" ? "Resumen" : `Día ${dayFilter}`}</h2>
                    <div className="metrics">
                      <span>{summary.count} paradas</span>
                      <span>{formatKm(summary.routeKm)} de recorrido</span>
                      <span>{formatKm(summary.walkKm)} a pie</span>
                      <span>{summary.walkMin} min caminando</span>
                      <span>{summary.transportLegs} tramos en transporte</span>
                    </div>
                    {dayHoliday ? (
                      <p className="holiday-note">
                        <strong>Festivo:</strong> {dayHoliday.name}
                      </p>
                    ) : null}
                    <div className="row wrap">
                      <ActionButton variant="primary" icon="↗" onPress={shareDay} busyLabel="Compartiendo…" successMessage="Compartido" errorMessage="No pude compartir">Compartir</ActionButton>
                      <ActionButton icon="⇩" onPress={exportPlan} successMessage="Excel descargado" errorMessage="No pude exportar">Exportar</ActionButton>
                      <ActionButton icon="✦" onPress={enrichAll} busyLabel="Mejorando…" successMessage="Textos actualizados" errorMessage="No pude mejorar los textos">Mejorar textos</ActionButton>
                      <Switch on={notifyOn} label={notifyOn ? "Avisos on" : "Avisos"} onToggle={() => (notifyOn ? setNotifyOn(false) : enableNotify())} />
                    </div>
                  </div>
                ) : null}
                {visible.length === 0 ? (
                  <div className="empty card">
                    <p className="empty-emoji" aria-hidden="true">{decorated.length ? "🔎" : "🧳"}</p>
                    <h2>{decorated.length ? "Sin paradas en esta selección" : "¡Tu aventura empieza aquí!"}</h2>
                    <p>
                      {decorated.length
                        ? "Este día o este filtro no tiene paradas. Elige otro día, otro tipo o Todo el viaje."
                        : "Sube el Excel del viaje. Solo se muestran esas visitas."}
                    </p>
                    {decorated.length ? (
                      <ActionButton block variant="primary" onPress={() => { setDayFilter("all"); setTypeFilter("all"); return { ok: true }; }} successMessage="Mostrando todo el viaje">
                        Ver todo el viaje
                      </ActionButton>
                    ) : (
                      <ActionButton block variant="primary" icon="↑" onPress={() => { goTab("subir", 1); return { ok: true }; }}>
                        Subir Excel
                      </ActionButton>
                    )}
                  </div>
                ) : (
                  <div className="places">
                    {visible.map((p, idx) => {
                      const next = visible[idx + 1];
                      const legKm = p.lat != null && next?.lat != null ? haversineKm(p, next) : null;
                      return (
                        <PlaceCard
                          key={p.id}
                          place={p}
                          position={idx + 1}
                          legKm={legKm}
                          origin={origin}
                          onListen={listenPlace}
                          onMap={loadExtras}
                          onRemove={(place) => {
                            patchTrip({ places: places.filter((x) => x.id !== place.id) });
                            return { ok: true };
                          }}
                        />
                      );
                    })}
                  </div>
                )}
                {tripHolidays.length > 0 ? (
                  <p className="muted tiny">
                    Festivos en las fechas del viaje:{" "}
                    {tripHolidays.slice(0, 4).map((h) => `${h.name} (${h.date})`).join(" · ")}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <div
          className="tabpanel"
          id="panel-mapa"
          role="tabpanel"
          aria-labelledby="tab-mapa"
          hidden={tab !== "mapa"}
        >
          {tab === "mapa" ? (
            <section className="stack pane" key={`mapa-${dir}`} data-dir={dir}>
              <div className="card map-wrap">
                <MapView myPos={origin} places={visible} focus={focus} routeGeometry={routeData?.geometry || []} />
              </div>
            </section>
          ) : null}
        </div>

        <div
          className="tabpanel"
          id="panel-subir"
          role="tabpanel"
          aria-labelledby="tab-subir"
          hidden={tab !== "subir"}
        >
          {tab === "subir" ? (
            <section className="stack pane" key={`subir-${dir}`} data-dir={dir}>
              <div className="card upload-card">
                <h2>Itinerario</h2>
                <p className="muted">Excel o CSV. Primera fila = títulos.</p>
                <p className="muted tiny">Formatos: .xlsx o .csv (el .xls viejo de 1997-2003 ya no se admite).</p>
                <ActionButton
                  block
                  variant="primary"
                  icon="↑"
                  status={upload.state}
                  statusMessage={upload.message}
                  busyLabel={busy || "Leyendo archivo…"}
                  announceBusy={false}
                  onPress={() => { fileRef.current?.click(); }}
                  successMessage="Itinerario cargado"
                  errorMessage="No pude leer el archivo"
                >
                  Subir Excel o CSV
                </ActionButton>
                <input
                  ref={fileRef}
                  className="sr-only"
                  type="file"
                  accept=".xlsx,.csv"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    await upload.run(
                      async () => {
                        const res = await onExcel(file);
                        if (res?.ok) {
                          ping(`Se cargaron ${res.count} lugares`);
                          return { ok: true };
                        }
                        return { ok: false, error: res?.error || "No pude leer el archivo." };
                      },
                      { success: "Itinerario cargado" }
                    );
                  }}
                />
                <div className="row wrap">
                  <ActionButton icon="⇩" onPress={downloadTemplate} successMessage="Ejemplo descargado" errorMessage="No pude generar el ejemplo">Ejemplo</ActionButton>
                  <ActionButton icon="⇧" onPress={exportPlan} successMessage="Excel exportado" errorMessage="No pude exportar">Exportar</ActionButton>
                </div>
                {warnings.length > 0 ? (
                  <div className="warn-inline">
                    <strong>Avisos del archivo</strong>
                    <ul>{warnings.slice(0, 6).map((w) => (<li key={w}>{w}</li>))}</ul>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <div
          className="tabpanel"
          id="panel-instalar"
          role="tabpanel"
          aria-labelledby="tab-instalar"
          hidden={tab !== "instalar"}
        >
          {tab === "instalar" ? (
            <section className="stack pane" key={`instalar-${dir}`} data-dir={dir}>
              <InstallHint />
            </section>
          ) : null}
        </div>
      </main>
      <p className="legal-link"><a href="/privacidad">Privacidad</a></p>
      <nav className="tabs" role="tablist" aria-label="Secciones de la app" ref={navRef} onKeyDown={onNavKeyDown}>
        <span
          className="tabs-indicator"
          aria-hidden="true"
          data-ready="yes"
          style={{ "--tab-index": activeTabIndex }}
        />
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              className={on ? "tab on" : "tab"}
              aria-selected={on ? "true" : "false"}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => goTab(t.id)}
            >
              <span className="tab-icon" aria-hidden="true">{t.icon}</span>
              <span className="tab-label">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
