"use client";
import { useTT } from "@/lib/i18n/tt-client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Leaflet CDN'den global olarak yüklenir, tip paketi yok */
import { useEffect, useRef, useState } from "react";

/**
 * Haritadan konum seçici (Leaflet + OpenStreetMap, API anahtarı gerektirmez).
 * Haritaya tıklanınca lat/lng gizli inputlara yazılır. Leaflet CDN'den yüklenir.
 */
declare global {
  interface Window {
    L?: any;
  }
}

function loadLeaflet(): Promise<void> {
  if (window.L) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Harita yüklenemedi"));
    document.body.appendChild(s);
  });
}

export function MapPicker({ latName = "latitude", lngName = "longitude", defaultLat, defaultLng }: { latName?: string; lngName?: string; defaultLat?: number | null; defaultLng?: number | null }) {
  const tt = useTT();
  const ref = useRef<HTMLDivElement>(null);
  const [lat, setLat] = useState<number | null>(defaultLat ?? null);
  const [lng, setLng] = useState<number | null>(defaultLng ?? null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let map: any;
    let marker: any;
    let cancelled = false;
    loadLeaflet()
      .then(() => {
        if (cancelled || !ref.current) return;
        const L = window.L;
        const start: [number, number] = [defaultLat ?? 41.0082, defaultLng ?? 28.9784];
        map = L.map(ref.current).setView(start, defaultLat != null ? 14 : 11);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
        if (defaultLat != null && defaultLng != null) marker = L.marker(start).addTo(map);
        map.on("click", (e: any) => {
          const { lat: la, lng: ln } = e.latlng;
          setLat(Number(la.toFixed(6)));
          setLng(Number(ln.toFixed(6)));
          if (marker) marker.setLatLng(e.latlng);
          else marker = L.marker(e.latlng).addTo(map);
        });
        setReady(true);
      })
      .catch(() => setErr("Harita yüklenemedi; konumu boş bırakabilir veya daha sonra ekleyebilirsiniz."));
    return () => {
      cancelled = true;
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label text-fg-muted">{tt("Konum (haritaya tıklayarak seçin)")}</span>
      <input type="hidden" name={latName} value={lat ?? ""} />
      <input type="hidden" name={lngName} value={lng ?? ""} />
      <div ref={ref} className="h-64 w-full overflow-hidden rounded-xl border border-line" style={{ background: "#0b0b14" }} />
      {err ? <span className="text-[12px] text-neon-amber">{err}</span> : null}
      {lat != null && lng != null ? (
        <span className="text-[12px] text-fg-muted">{tt("Seçilen konum:")}{" "}{lat}, {lng}</span>
      ) : ready ? (
        <span className="text-[12px] text-fg-passive">{tt("Henüz konum seçilmedi (opsiyonel).")}</span>
      ) : null}
    </div>
  );
}
