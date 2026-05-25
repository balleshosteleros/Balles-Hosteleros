"use client";

import { useEffect, useRef, useState } from "react";
import type { Fichaje, LocalGeo } from "@/features/rrhh/data/fichajes";
import { getFichajeGeoStatus } from "@/features/rrhh/utils/fichaje-geo-status";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const MARKERCLUSTER_JS =
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
const MARKERCLUSTER_CSS_1 =
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
const MARKERCLUSTER_CSS_2 =
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";

// Interfaces locales — solo lo que usamos. NO `declare global { Window.L }`:
// MapPicker.tsx ya lo declara con su propia interfaz local y duplicarlo causa
// TS2717 (ver Aprendizaje del PRP-037 TASK-002.03).
interface LeafletDivIcon {
  __divIconBrand?: true;
}
interface LeafletLatLng {
  lat: number;
  lng: number;
}
interface LeafletLatLngBounds {
  isValid: () => boolean;
  pad: (ratio: number) => LeafletLatLngBounds;
}
interface LeafletLayer {
  addTo: (map: LeafletMap) => LeafletLayer;
  remove: () => void;
}
interface LeafletMarker extends LeafletLayer {
  on: (event: string, fn: () => void) => LeafletMarker;
  getLatLng: () => LeafletLatLng;
}
interface LeafletClusterGroup {
  addTo: (map: LeafletMap) => LeafletClusterGroup;
  addLayer: (layer: LeafletMarker) => LeafletClusterGroup;
  clearLayers: () => LeafletClusterGroup;
}
interface LeafletMap {
  setView: (latlng: [number, number], zoom: number) => LeafletMap;
  fitBounds: (
    bounds: LeafletLatLngBounds,
    opts?: { padding?: [number, number] },
  ) => LeafletMap;
  remove: () => void;
  removeLayer: (layer: LeafletLayer) => void;
}
interface LeafletGlobal {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap;
  tileLayer: (
    url: string,
    opts?: Record<string, unknown>,
  ) => { addTo: (m: LeafletMap) => unknown };
  marker: (latlng: [number, number], opts?: { icon?: LeafletDivIcon }) => LeafletMarker;
  circle: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletLayer;
  divIcon: (opts: {
    className?: string;
    html: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
  }) => LeafletDivIcon;
  latLngBounds: (points: Array<[number, number]>) => LeafletLatLngBounds;
  markerClusterGroup?: (opts?: Record<string, unknown>) => LeafletClusterGroup;
}

function getWindowL(): LeafletGlobal | undefined {
  return (window as unknown as { L?: LeafletGlobal }).L;
}

async function inyectarScript(src: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      // Si el script ya cargó previamente, no se reemite "load"; comprobamos.
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(script);
  });
}

function inyectarCss(href: string): void {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

async function cargarLeafletConCluster(): Promise<LeafletGlobal> {
  // 1. Leaflet base
  if (!getWindowL()) {
    inyectarCss(LEAFLET_CSS);
    await inyectarScript(LEAFLET_JS);
  }
  let L = getWindowL();
  if (!L) throw new Error("Leaflet no inicializado");

  // 2. Plugin markercluster (depende de L estar en window)
  if (typeof L.markerClusterGroup !== "function") {
    inyectarCss(MARKERCLUSTER_CSS_1);
    inyectarCss(MARKERCLUSTER_CSS_2);
    await inyectarScript(MARKERCLUSTER_JS);
    L = getWindowL();
    if (!L || typeof L.markerClusterGroup !== "function") {
      throw new Error("MarkerCluster plugin no inicializado");
    }
  }
  return L;
}

const STATUS_COLOR: Record<string, string> = {
  "en-local": "#10b981", // emerald-500
  teletrabajo: "#8b5cf6", // violet-500
  fuera: "#ef4444", // rose-500
  "sin-datos": "#94a3b8", // slate-400
};

function divIconForStatus(L: LeafletGlobal, status: string): LeafletDivIcon {
  const color = STATUS_COLOR[status] ?? STATUS_COLOR["sin-datos"];
  return L.divIcon({
    className: "fichaje-mapa-pin",
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

interface Props {
  fichajes: Fichaje[];
  locales: LocalGeo[];
  onFichajeClick: (fichaje: Fichaje) => void;
}

/**
 * Tab "Mapa" de auditoría geográfica de fichajes (PRP-037 TASK-002.04).
 *
 * Renderiza un mapa Leaflet con clustering automático (`leaflet.markercluster`)
 * mostrando todos los fichajes del filtro actual como pines coloreados por
 * status geo (verde/violeta/rojo/gris) y los locales de la empresa con su
 * radio en color tenue. Click en pin → abre `FichajeDetalleDialog` vía
 * callback. `fitBounds` automático al renderizar.
 *
 * Multi-tenant: depende de que el padre pase `fichajes` y `locales` ya
 * filtrados por empresa activa. Esta vista no hace queries.
 */
export function FichajesMapaView({ fichajes, locales, onFichajeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const clusterRef = useRef<LeafletClusterGroup | null>(null);
  const localesLayersRef = useRef<LeafletLayer[]>([]);
  const onClickRef = useRef(onFichajeClick);
  onClickRef.current = onFichajeClick;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Inicialización del mapa (una sola vez al montar).
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelado = false;

    cargarLeafletConCluster()
      .then((L) => {
        if (cancelado || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        }).setView([40.4168, -3.7038], 6); // Madrid como vista por defecto
        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(map);

        // markerClusterGroup garantizado por cargarLeafletConCluster.
        const cluster = L.markerClusterGroup!({
          showCoverageOnHover: false,
          maxClusterRadius: 50,
        });
        cluster.addTo(map);
        clusterRef.current = cluster;
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el mapa con clustering.",
        );
      });

    return () => {
      cancelado = true;
      if (mapRef.current) {
        for (const layer of localesLayersRef.current) {
          try {
            mapRef.current.removeLayer(layer);
          } catch {
            // ignore
          }
        }
        localesLayersRef.current = [];
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
        clusterRef.current = null;
      }
    };
  }, []);

  // Re-pintar locales y fichajes cuando cambian (incluye cambio de filtros
  // y cambio de empresa activa, que repobla ambos arrays).
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    const L = getWindowL();
    if (!L) return;

    // Limpiar locales previos.
    for (const layer of localesLayersRef.current) {
      try {
        map.removeLayer(layer);
      } catch {
        // ignore
      }
    }
    localesLayersRef.current = [];

    // Pintar locales con círculo de radio en color tenue.
    for (const local of locales) {
      if (local.lat == null || local.lng == null) continue;
      const circle = L.circle([local.lat, local.lng], {
        radius: local.radioMetros,
        color: "#7c3aed",
        fillColor: "#7c3aed",
        fillOpacity: 0.1,
        weight: 1.5,
      }).addTo(map);
      localesLayersRef.current.push(circle);
    }

    // Limpiar cluster previo y poblar con los fichajes del filtro.
    cluster.clearLayers();
    const puntos: Array<[number, number]> = [];
    for (const f of fichajes) {
      if (f.latEntrada == null || f.lngEntrada == null) continue;
      const status = getFichajeGeoStatus(f, f.local ?? null);
      const marker = L.marker([f.latEntrada, f.lngEntrada], {
        icon: divIconForStatus(L, status),
      });
      marker.on("click", () => onClickRef.current(f));
      cluster.addLayer(marker);
      puntos.push([f.latEntrada, f.lngEntrada]);
    }

    // Añadir centros de locales a puntos para que el fitBounds no recorte
    // un local sin fichajes.
    for (const local of locales) {
      if (local.lat != null && local.lng != null) {
        puntos.push([local.lat, local.lng]);
      }
    }

    if (puntos.length > 0) {
      const bounds = L.latLngBounds(puntos);
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.15), { padding: [20, 20] });
      }
    }
  }, [fichajes, locales, ready]);

  if (error) {
    return (
      <div className="h-[600px] rounded-md border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-[600px] rounded-md border overflow-hidden"
      />
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Leyenda:</span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: STATUS_COLOR["en-local"] }}
          />
          En local
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: STATUS_COLOR.teletrabajo }}
          />
          Teletrabajo
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: STATUS_COLOR.fuera }}
          />
          Fuera del radio
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: STATUS_COLOR["sin-datos"] }}
          />
          Sin datos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-violet-500/60" />
          Radio del local
        </span>
        {fichajes.length > 0 && (
          <span className="ml-auto tabular-nums">
            {fichajes.length} fichaje{fichajes.length === 1 ? "" : "s"} •{" "}
            {locales.length} local{locales.length === 1 ? "" : "es"}
          </span>
        )}
      </div>
    </div>
  );
}
