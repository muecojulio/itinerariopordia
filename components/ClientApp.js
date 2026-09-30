"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MapView from "./MapView";
import InstallHint from "./InstallHint";
import VoicePanel from "./VoicePanel";
import Switch from "./Switch";
import { downloadExampleCsv, exportPlanWorkbook, parseItineraryFile } from "../lib/excel";
import { datesInRange, dayNumber, formatDayLabel, formatKm, formatWalk, haversineKm, mapsUrl, walkMinutes } from "../lib/geo";
import { cocinaEnEspanol, etiquetaTipo, tipoEnEspanol, tipsPara } from "../lib/tips";
import { applyCache, clothingTip, daySummary, localISODate, minutesUntil, rememberCache, shareText } from "../lib/plan";
import { scriptForPlaces, speakText, stopTalking } from "../lib/voice";
import { loadState, saveState } from "../lib/idb";

const STORAGE = "rutadias-v4";
const TABS = [
  { id: "plan", label: "Plan", icon: "▣" },
  { id: "mapa", label: "Mapa", icon: "◎" },
  { id: "subir", label: "Excel", icon: "↑" },
  { id: "instalar", label: "App", icon: "+" }
];

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
  const [trips, setTrips] = useState([newTrip("Mi viaje")]);
  const [currentId, setCurrentId] = useState("");
  const [geoCache, setGeoCache] = useState({});
  const [cityHits, setCityHits] = useState([]);
  const [startHits, setStartHits] = useState([]);
  const [startQuery, setStartQuery] = useState("");
  const [myPos, setMyPos] = useState(null);
  const [geoMsg, setGeoMsg] = useState("");
  const [voiceUri, setVoiceUri] = useState("");
  const [toneId, setToneId] = useState("natural");
  const [speaking, setSpeaking] = useState(false);
  const [dayFilter, setDayFilter] = useState("all");
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
    setTimeout(() => setToast(""), 3400);
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
  const visible = decorated.filter((p) => dayFilter === "all" || String(p.day) === String(dayFilter));
  const summary = useMemo(() => daySummary(visible, origin, routeData), [visible, origin, routeData]);

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
    if (!navigator.geolocation) { setGeoMsg("Este dispositivo no da ubicación."); return; }
    setGeoMsg("Pidiendo permiso de ubicación…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setMyPos(next);
        if (asStart) { patchTrip({ startSource: "gps", manualStart: null }); ping("Punto de partida: tu ubicación"); }
        setGeoMsg("GPS listo. Las distancias salen desde este punto.");
      },
      () => setGeoMsg("No pude usar el GPS. Elige un punto de partida escribiendo la dirección."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function searchCity(q) {
    patchTrip({ city: q });
    if (q.trim().length < 2) { setCityHits([]); return; }
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    const data = await r.json();
    setCityHits(data.results || []);
  }
  function pickCity(hit) {
    patchTrip({ city: hit.label, cityPos: { lat: hit.lat, lon: hit.lon, country: hit.country, countryCode: hit.countryCode || "" } });
    setCityHits([]);
    ping(`Ciudad: ${hit.label}`);
  }
  async function searchStart(q) {
    setStartQuery(q);
    if (q.trim().length < 2) { setStartHits([]); return; }
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    const data = await r.json();
    setStartHits(data.results || []);
  }
  function pickStart(hit) {
    patchTrip({ startSource: "manual", manualStart: { lat: hit.lat, lon: hit.lon, label: hit.label } });
    setStartQuery(hit.label);
    setStartHits([]);
    ping("Punto de partida guardado");
  }
  function listenDay() {
    if (!visible.length) { ping("Sube un Excel primero"); return; }
    const text = scriptForPlaces(visible, { toneId, city, startLabel: originLabel });
    const res = speakText(text, { voiceUri, toneId });
    if (!res.ok) { ping(res.error); return; }
    setSpeaking(true);
    setTimeout(() => setSpeaking(false), Math.min(120000, text.length * 80));
  }
  function listenPlace(p) {
    speakText(scriptForPlaces([p], { toneId, city, startLabel: originLabel }), { voiceUri, toneId });
  }

  async function onExcel(file) {
    if (!file) return;
    setBusy("Leyendo Excel…");
    setWarnings([]);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseItineraryFile(buf);
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
      if (pending.length) {
        setBusy(`Buscando mapa de ${pending.length} lugares…`);
        const r = await fetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: pending, city }) });
        const data = await r.json();
        const found = data.items || pending;
        const byId = new Map(found.map((p) => [p.id, p]));
        rows = rows.map((p) => byId.get(p.id) || p);
      }
      rows.forEach((p) => { if (p.lat == null) notes.push(`${p.name}: no encontré la ubicación en el mapa.`); });
      setGeoCache((prev) => rememberCache(rows, prev, city));
      patchTrip({ places: rows });
      setWarnings(notes);
      ping(`Se cargaron ${rows.length} lugares`);
      setTab("plan");
    } catch {
      ping("No pude leer ese archivo. Usa .xlsx o .csv");
    } finally {
      setBusy("");
    }
  }

  async function loadExtras(place) {
    if (!place.lat) { ping("Ese lugar aún no tiene mapa"); return; }
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
      setTab("mapa");
    } catch {
      ping("No pude cargar extras");
    } finally {
      setBusy("");
    }
  }

  async function enrichAll() {
    if (!places.length) return;
    setBusy("Mejorando textos…");
    try {
      const next = [];
      for (const p of places) {
        const r = await fetch("/api/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place: p, city }) });
        const d = await r.json();
        next.push({ ...p, what: d.what || p.what, order: d.order || p.order });
      }
      patchTrip({ places: next });
      ping("Textos actualizados");
    } catch {
      ping("No pude mejorar los textos ahora");
    } finally {
      setBusy("");
    }
  }

  function downloadTemplate() {
    const csv = downloadExampleCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ejemplo-rutadias.csv";
    a.click();
  }
  function exportPlan() {
    const bytes = exportPlanWorkbook(visible, dayWeather);
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(trip?.name || "itinerario").replace(/\s+/g, "-")}.xlsx`;
    a.click();
  }
  async function shareDay() {
    const label = dayFilter === "all" ? "Todo el viaje" : `Día ${dayFilter} · ${formatDayLabel(selectedDate || "")}`;
    const text = shareText(label, city, visible, summary, dayWeather);
    try {
      if (navigator.share) { await navigator.share({ title: "RutaDías", text }); return; }
    } catch {}
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }
  async function enableNotify() {
    if (typeof Notification === "undefined") { ping("Este navegador no admite avisos"); return; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { ping("No diste permiso de avisos"); setNotifyOn(false); return; }
    setNotifyOn(true);
    ping("Avisaré 20 min antes si la app está abierta");
  }
  function goToday() {
    if (todayIndex < 0) { ping("Hoy no está dentro del periodo"); return; }
    setDayFilter(String(todayIndex + 1));
    setTab("plan");
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">RutaDías</p>
          <h1>{trip?.name || "Mi viaje"}</h1>
        </div>
        <button className="btn ghost" onClick={goToday}>Hoy</button>
      </header>
      {geoMsg ? <p className="banner">{geoMsg}</p> : null}
      {busy ? <p className="banner busy">{busy}</p> : null}
      {toast ? <p className="toast">{toast}</p> : null}
      <main className="main" key={tab}>
        {tab === "plan" && (
          <section className="stack pane">
            <div className="card origin-card">
              <h2>Punto de partida</h2>
              <p className="origin-now">Salida: {originLabel}</p>
              <div className="start-actions">
                <button className={startSource === "gps" ? "btn primary block" : "btn block"} onClick={() => locate(true)} type="button">Punto de partida con geolocalización</button>
                <button className={startSource === "manual" ? "btn primary block" : "btn block"} onClick={() => patchTrip({ startSource: "manual" })} type="button">Elegir otro punto de partida</button>
              </div>
              {startSource === "manual" ? (
                <>
                  <label>Dirección o lugar de salida<input value={startQuery} placeholder="Hotel, estación, calle…" onChange={(e) => searchStart(e.target.value)} /></label>
                  {startHits.length > 0 && (
                    <ul className="hits">{startHits.map((h) => (<li key={`${h.lat}-${h.lon}`}><button className="hit" onClick={() => pickStart(h)}>{h.label}</button></li>))}</ul>
                  )}
                </>
              ) : null}
            </div>
            <VoicePanel voiceUri={voiceUri} toneId={toneId} onVoice={setVoiceUri} onTone={setToneId} onListen={listenDay} speaking={speaking} />
            <div className="card">
              <h2>Viaje</h2>
              <div className="row wrap">
                <select value={trip?.id || ""} onChange={(e) => { setCurrentId(e.target.value); setDayFilter("all"); }}>
                  {trips.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
                <button className="btn" onClick={() => { const n = newTrip(`Viaje ${trips.length + 1}`); setTrips((prev) => [...prev, n]); setCurrentId(n.id); setDayFilter("all"); }}>Nuevo</button>
                {trips.length > 1 ? (<button className="btn danger" onClick={() => { const rest = trips.filter((t) => t.id !== trip.id); setTrips(rest); setCurrentId(rest[0].id); }}>Borrar</button>) : null}
              </div>
              <label>Nombre<input value={trip?.name || ""} onChange={(e) => patchTrip({ name: e.target.value })} /></label>
              <div className="row">
                <label>Desde<input type="date" value={start} onChange={(e) => patchTrip({ start: e.target.value })} /></label>
                <label>Hasta<input type="date" value={end} onChange={(e) => patchTrip({ end: e.target.value })} /></label>
              </div>
              <label>Ciudad del viaje<input value={city} placeholder="Lisboa, Tokio, CDMX…" onChange={(e) => searchCity(e.target.value)} /></label>
              {cityHits.length > 0 && (<ul className="hits">{cityHits.map((h) => (<li key={`${h.lat}-${h.lon}`}><button className="hit" onClick={() => pickCity(h)}>{h.label}</button></li>))}</ul>)}
            </div>
            {dayWeather ? (
              <div className="weather-strip">
                <strong>{dayFilter === "all" ? "Clima del día" : `Día ${dayFilter}`}</strong>
                <span>{String(dayWeather.label || "").toLowerCase()} · {Math.round(dayWeather.min)}–{Math.round(dayWeather.max)}°</span>
                <span>{clothingTip(dayWeather)}</span>
                {airInfo?.label ? <span>{airInfo.label}</span> : null}
              </div>
            ) : null}
            <div className="chips">
              <button className={dayFilter === "all" ? "chip on" : "chip"} onClick={() => setDayFilter("all")}>Todos</button>
              {days.map((d, i) => (<button key={d} className={dayFilter === String(i + 1) ? "chip on" : "chip"} onClick={() => setDayFilter(String(i + 1))}>Día {i + 1}</button>))}
            </div>
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
                <div className="row wrap">
                  <button className="btn primary" onClick={shareDay}>Compartir</button>
                  <button className="btn" onClick={exportPlan}>Exportar</button>
                  <button className="btn" onClick={enrichAll}>Mejorar textos</button>
                  <Switch on={notifyOn} label={notifyOn ? "Avisos on" : "Avisos"} onToggle={() => (notifyOn ? setNotifyOn(false) : enableNotify())} />
                </div>
              </div>
            ) : null}
            {warnings.length > 0 ? (<div className="card warn"><h2>Avisos</h2><ul>{warnings.map((w) => (<li key={w}>{w}</li>))}</ul></div>) : null}
            {visible.length === 0 ? (
              <div className="empty card">
                <h2>Sin itinerario</h2>
                <p>Sube el Excel del viaje. Solo se muestran esas visitas.</p>
                <button className="btn primary block" onClick={() => setTab("subir")}>Subir Excel</button>
              </div>
            ) : visible.map((p, idx) => {
              const next = visible[idx + 1];
              const legKm = p.lat != null && next?.lat != null ? haversineKm(p, next) : null;
              return (
                <article key={p.id} className="place card">
                  {p.photo?.url ? <img className="place-photo" src={p.photo.url} alt="" /> : null}
                  <div className="place-top"><span className="tag">{idx + 1} · {etiquetaTipo(p.type)}</span><span className="day">{p.time || `Día ${p.day || "?"}`}</span></div>
                  <h3>{p.name}</h3>
                  {p.cuisine ? <p className="cuisine">Cocina {p.cuisine}</p> : null}
                  {p.address ? <p className="muted">{p.address}</p> : null}
                  <div className="metrics"><span>{formatKm(p.distanceKm)}</span><span>{formatWalk(p.walkMin)}</span></div>
                  {p.what ? <p><strong>Qué hacer:</strong> {p.what}</p> : null}
                  {p.order ? <p><strong>Qué pedir:</strong> {p.order}</p> : null}
                  {legKm != null ? <p className="leg">Al siguiente: {formatKm(legKm)} · {legKm <= 1 ? "a pie" : "transporte"}</p> : null}
                  <div className="row wrap">
                    <a className="btn primary" href={mapsUrl(origin, p, "transit")} target="_blank" rel="noreferrer">Transporte</a>
                    <a className="btn" href={mapsUrl(origin, p, "walk")} target="_blank" rel="noreferrer">Caminando</a>
                    <button className="btn" onClick={() => listenPlace(p)}>Escuchar</button>
                    <button className="btn" onClick={() => loadExtras(p)}>Mapa</button>
                    <button className="btn danger" onClick={() => patchTrip({ places: places.filter((x) => x.id !== p.id) })}>Quitar</button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
        {tab === "mapa" && (
          <section className="stack pane">
            <div className="card map-wrap"><MapView myPos={origin} places={visible} focus={focus} routeGeometry={routeData?.geometry || []} /></div>
          </section>
        )}
        {tab === "subir" && (
          <section className="stack pane">
            <div className="card">
              <h2>Itinerario</h2>
              <p className="muted">Excel o CSV. Primera fila = títulos.</p>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onExcel(e.target.files?.[0])} />
              <div className="row wrap">
                <button className="btn" onClick={downloadTemplate}>Ejemplo</button>
                <button className="btn" onClick={exportPlan}>Exportar</button>
              </div>
            </div>
          </section>
        )}
        {tab === "instalar" && <section className="stack pane"><InstallHint /></section>}
      </main>
      <p className="legal-link"><a href="/privacidad">Privacidad</a></p>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "tab on" : "tab"} aria-pressed={tab === t.id} onClick={() => { stopTalking(); setTab(t.id); }}>
            <span className="tab-icon">{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
