"use client";

import { useEffect, useRef } from "react";

export default function MapView({ myPos, places, focus, routeGeometry = [] }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
      });

      const center = myPos || { lat: 19.4326, lon: -99.1332 };
      const map = L.map(ref.current, { zoomControl: false }).setView(
        [center.lat, center.lon],
        13
      );
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      draw(L);
    }

    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    import("leaflet").then((mod) => draw(mod.default));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, myPos, focus, routeGeometry]);

  function draw(L) {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds = [];

    if (myPos?.lat != null) {
      const here = L.circleMarker([myPos.lat, myPos.lon], {
        radius: 9,
        color: "#1f6f4a",
        fillColor: "#7dcaa6",
        fillOpacity: 1,
        weight: 3
      }).addTo(layer);
      here.bindPopup("Estás aquí");
      bounds.push([myPos.lat, myPos.lon]);
    }

    const located = places.filter((p) => p.lat != null && p.lon != null);
    if (routeGeometry.length >= 2) {
      L.polyline(routeGeometry, {
        color: "#1f6f4a",
        weight: 5,
        opacity: 0.82
      }).addTo(layer);
      routeGeometry.forEach((pt) => bounds.push(pt));
    } else if (located.length >= 2) {
      L.polyline(
        located.map((p) => [p.lat, p.lon]),
        { color: "#1f6f4a", weight: 4, opacity: 0.75, dashArray: "8 7" }
      ).addTo(layer);
    }

    located.forEach((p, i) => {
      const icon = L.divIcon({
        className: "num-pin",
        html: `<span>${i + 1}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const m = L.marker([p.lat, p.lon], { icon }).addTo(layer);
      m.bindPopup(
        `<strong>${escapeHtml(p.name)}</strong><br/>${escapeHtml(p.address || "")}`
      );
      bounds.push([p.lat, p.lon]);
    });

    if (focus?.lat != null) {
      map.setView([focus.lat, focus.lon], 15);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    }
  }

  return <div ref={ref} className="map-canvas" />;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}
