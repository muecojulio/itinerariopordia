const DB_NAME = "rutadias-db";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("trips")) {
        const trips = db.createObjectStore("trips", { keyPath: "id" });
        trips.createIndex("name", "name", { unique: false });
        trips.createIndex("start", "start", { unique: false });
      }
      if (!db.objectStoreNames.contains("places")) {
        const places = db.createObjectStore("places", { keyPath: "id" });
        places.createIndex("tripId", "tripId", { unique: false });
        places.createIndex("day", "day", { unique: false });
        places.createIndex("date", "date", { unique: false });
        places.createIndex("name", "name", { unique: false });
        places.createIndex("tripDay", ["tripId", "day"], { unique: false });
      }
      if (!db.objectStoreNames.contains("geoCache")) {
        const geo = db.createObjectStore("geoCache", { keyPath: "key" });
        geo.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveState({ trips, currentId, geoCache, notifyOn, voiceUri, toneId }) {
  const db = await openDb();
  const tx = db.transaction(["trips", "places", "geoCache", "meta"], "readwrite");
  const tripStore = tx.objectStore("trips");
  const placeStore = tx.objectStore("places");
  const geoStore = tx.objectStore("geoCache");
  const metaStore = tx.objectStore("meta");

  const existingTrips = await new Promise((resolve, reject) => {
    const r = tripStore.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
  const keep = new Set((trips || []).map((t) => t.id));
  existingTrips.forEach((t) => {
    if (!keep.has(t.id)) tripStore.delete(t.id);
  });

  const existingPlaces = await new Promise((resolve, reject) => {
    const r = placeStore.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
  const keepPlaces = new Set();
  (trips || []).forEach((t) => {
    const { places, ...rest } = t;
    tripStore.put(rest);
    (places || []).forEach((p) => {
      const row = { ...p, tripId: t.id };
      keepPlaces.add(row.id);
      placeStore.put(row);
    });
  });
  existingPlaces.forEach((p) => {
    if (!keepPlaces.has(p.id)) placeStore.delete(p.id);
  });

  Object.entries(geoCache || {}).forEach(([key, value]) => {
    geoStore.put({ key, ...value, updatedAt: Date.now() });
  });

  metaStore.put({ id: "session", currentId, notifyOn, voiceUri, toneId });
  await txDone(tx);
  db.close();
}

export async function loadState() {
  const db = await openDb();
  const tx = db.transaction(["trips", "places", "geoCache", "meta"], "readonly");
  const tripsRaw = await getAll(tx.objectStore("trips"));
  const placesRaw = await getAll(tx.objectStore("places"));
  const geoRaw = await getAll(tx.objectStore("geoCache"));
  const session = await getOne(tx.objectStore("meta"), "session");
  db.close();

  const byTrip = {};
  placesRaw.forEach((p) => {
    const { tripId, ...rest } = p;
    if (!byTrip[tripId]) byTrip[tripId] = [];
    byTrip[tripId].push(rest);
  });
  const trips = tripsRaw.map((t) => ({
    ...t,
    places: (byTrip[t.id] || []).sort(
      (a, b) => (a.day || 99) - (b.day || 99) || (a.excelOrder ?? 0) - (b.excelOrder ?? 0)
    )
  }));
  const geoCache = {};
  geoRaw.forEach((g) => {
    geoCache[g.key] = { lat: g.lat, lon: g.lon, address: g.address, opening: g.opening };
  });
  return {
    trips,
    currentId: session?.currentId || trips[0]?.id || "",
    geoCache,
    notifyOn: Boolean(session?.notifyOn),
    voiceUri: session?.voiceUri || "",
    toneId: session?.toneId || "natural"
  };
}

export async function placesByTripDay(tripId, day) {
  const db = await openDb();
  const tx = db.transaction("places", "readonly");
  const idx = tx.objectStore("places").index("tripDay");
  const rows = await new Promise((resolve, reject) => {
    const r = idx.getAll([tripId, Number(day)]);
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return rows;
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const r = store.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

function getOne(store, key) {
  return new Promise((resolve, reject) => {
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}
