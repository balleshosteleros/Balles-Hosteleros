"use client";

import { useEffect, useRef } from "react";

type LeafletMapInstance = {
  setView: (latlng: [number, number], zoom: number) => LeafletMapInstance;
  fitBounds: (bounds: unknown, opts?: { padding?: [number, number] }) => LeafletMapInstance;
  remove: () => void;
  invalidateSize: () => LeafletMapInstance;
  whenReady: (cb: () => void) => LeafletMapInstance;
};
type LeafletLayer = { addTo: (map: LeafletMapInstance) => LeafletLayer; remove: () => void };
type LeafletMarker = LeafletLayer & { setLatLng: (latlng: [number, number]) => LeafletMarker };
type LeafletCircle = LeafletLayer & {
  setLatLng: (latlng: [number, number]) => LeafletCircle;
  setRadius: (radius: number) => LeafletCircle;
  getBounds: () => unknown;
};
type LeafletNamespace = {
  map: (el: HTMLElement, opts?: { zoomControl?: boolean; scrollWheelZoom?: boolean }) => LeafletMapInstance;
  tileLayer: (
    url: string,
    opts?: { attribution?: string; maxZoom?: number },
  ) => LeafletLayer;
  marker: (latlng: [number, number]) => LeafletMarker;
  circle: (
    latlng: [number, number],
    opts: { radius: number; color?: string; fillColor?: string; fillOpacity?: number; weight?: number },
  ) => LeafletCircle;
};

let leafletPromise: Promise<LeafletNamespace> | null = null;

function loadLeaflet(): Promise<LeafletNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const w = window as unknown as { L?: LeafletNamespace };
    if (w.L) {
      resolve(w.L);
      return;
    }
    if (!document.querySelector('link[data-leaflet="1"]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      css.dataset.leaflet = "1";
      document.head.appendChild(css);
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-leaflet="1"]');
    const onReady = () => {
      const L = (window as unknown as { L?: LeafletNamespace }).L;
      if (L) resolve(L);
      else reject(new Error("Leaflet no se cargó"));
    };
    if (existing) {
      if ((window as unknown as { L?: LeafletNamespace }).L) onReady();
      else existing.addEventListener("load", onReady, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.leaflet = "1";
    script.onload = onReady;
    script.onerror = () => reject(new Error("No se pudo descargar Leaflet"));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

interface Props {
  lat: number;
  lng: number;
  radioKm: number;
  className?: string;
}

export function MapaUbicacionRadio({ lat, lng, radioKm, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(
          [lat, lng],
          13,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        const marker = L.marker([lat, lng]);
        marker.addTo(map);
        const circle = L.circle([lat, lng], {
          radius: Math.max(radioKm, 0.1) * 1000,
          color: "#2563eb",
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          weight: 2,
        });
        circle.addTo(map);
        mapRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;
        const ajustar = () => {
          map.invalidateSize();
          map.fitBounds(circle.getBounds(), { padding: [20, 20] });
        };
        requestAnimationFrame(ajustar);
        const ro = new ResizeObserver(() => map.invalidateSize());
        if (containerRef.current) ro.observe(containerRef.current);
        resizeObserverRef.current = ro;
      })
      .catch((err) => console.error("[MapaUbicacionRadio]", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!map || !marker || !circle) return;
    marker.setLatLng([lat, lng]);
    circle.setLatLng([lat, lng]);
    circle.setRadius(Math.max(radioKm, 0.1) * 1000);
    map.fitBounds(circle.getBounds(), { padding: [20, 20] });
  }, [lat, lng, radioKm]);

  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className={className ?? "w-full h-[360px]"} />;
}
