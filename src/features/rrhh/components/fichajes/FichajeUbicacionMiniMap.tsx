"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinOff } from "lucide-react";
import type { Fichaje } from "@/features/rrhh/data/fichajes";

// CDN URLs idénticas a las que usa MapPicker para mantener una sola versión
// de Leaflet en cache del navegador.
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

// Interfaces locales (declaramos solo lo que usamos). Leaflet en runtime tiene
// muchas más APIs, pero acotando aquí evitamos importar @types/leaflet.
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
  extend: (point: [number, number]) => LeafletLatLngBounds;
}
interface LeafletLayer {
  addTo: (map: LeafletMap) => LeafletLayer;
  remove: () => void;
  bindPopup: (html: string) => LeafletLayer;
  getLatLng?: () => LeafletLatLng;
}
interface LeafletMap {
  setView: (latlng: [number, number], zoom: number) => LeafletMap;
  fitBounds: (bounds: LeafletLatLngBounds, opts?: { padding?: [number, number] }) => LeafletMap;
  remove: () => void;
  removeLayer: (layer: LeafletLayer) => void;
}
interface LeafletGlobal {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (m: LeafletMap) => unknown };
  marker: (latlng: [number, number], opts?: { icon?: LeafletDivIcon }) => LeafletLayer;
  circle: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletLayer;
  divIcon: (opts: {
    className?: string;
    html: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
  }) => LeafletDivIcon;
  latLngBounds: (points: Array<[number, number]>) => LeafletLatLngBounds;
}

// Nota: NO usamos `declare global { Window.L }` aquí porque MapPicker.tsx ya
// declara `Window.L` con su propia interfaz local de Leaflet. Dos `declare
// global` con tipos diferentes para la misma propiedad provocan TS2717.
// En su lugar, hacemos cast local de `window` cuando accedemos a `L`.
function getWindowL(): LeafletGlobal | undefined {
  return (window as unknown as { L?: LeafletGlobal }).L;
}

async function cargarLeaflet(): Promise<LeafletGlobal> {
  const existing = getWindowL();
  if (existing) return existing;
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
  await new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      if (getWindowL()) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Leaflet"));
    document.head.appendChild(script);
  });
  const L = getWindowL();
  if (!L) throw new Error("Leaflet no inicializado");
  return L;
}

function divIconColor(L: LeafletGlobal, color: string): LeafletDivIcon {
  return L.divIcon({
    className: "fichaje-pin",
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function formatDistancia(m: number | null | undefined): string {
  if (m == null) return "—";
  if (m >= 50000) return ">50 km";
  if (m >= 5000) return ">5 km";
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

function formatPrecision(m: number | null | undefined): string {
  if (m == null) return "";
  return `±${Math.round(m)} m`;
}

function formatHora(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 5);
  }
}

interface Props {
  fichaje: Fichaje;
}

/**
 * Mini-mapa Leaflet con la ubicación de un fichaje respecto a su local.
 * Muestra pin de entrada, pin de salida (si existe), círculo del radio
 * del local y leyenda con distancias y modo de fichaje.
 *
 * Casos fallback:
 *  - Local sin `lat/lng` → mensaje "Sin ubicación configurada".
 *  - Fichaje sin `latEntrada` (típico de fichajes manuales `tipo='MAN'`)
 *    → mensaje "Entrada sin geolocalización (manual)".
 *
 * Cleanup correcto: el mapa se libera en el cleanup del useEffect al
 * desmontar el modal, evitando memory leaks al abrir/cerrar fichajes
 * sucesivamente.
 */
export function FichajeUbicacionMiniMap({ fichaje }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LeafletLayer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const local = fichaje.local ?? null;
  const tieneCoordsLocal =
    !!local && local.lat != null && local.lng != null;
  const tieneCoordsEntrada =
    fichaje.latEntrada != null && fichaje.lngEntrada != null;
  const tieneCoordsSalida =
    fichaje.latSalida != null && fichaje.lngSalida != null;
  const fichajeManual = !tieneCoordsEntrada && fichaje.horaEntrada !== null;
  const puedeRenderizarMapa = tieneCoordsLocal && tieneCoordsEntrada;

  useEffect(() => {
    if (!puedeRenderizarMapa || !containerRef.current) return;
    let cancelado = false;

    cargarLeaflet()
      .then((L) => {
        if (cancelado || !containerRef.current) return;
        if (mapRef.current) return; // ya inicializado

        // local!.lat / lng están garantizados por `puedeRenderizarMapa`
        const localLat = local!.lat as number;
        const localLng = local!.lng as number;

        const map = L.map(containerRef.current, {
          zoomControl: true,
          scrollWheelZoom: false,
        }).setView([localLat, localLng], 17);
        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(map);

        // Círculo del local con su radio configurado.
        const circle = L.circle([localLat, localLng], {
          radius: local!.radioMetros,
          color: "#7c3aed",
          fillColor: "#7c3aed",
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(map);
        layersRef.current.push(circle);

        // Pin de entrada (azul).
        const entradaLat = fichaje.latEntrada as number;
        const entradaLng = fichaje.lngEntrada as number;
        const pinEntrada = L.marker([entradaLat, entradaLng], {
          icon: divIconColor(L, "#2563eb"),
        })
          .addTo(map)
          .bindPopup(
            `<strong>Entrada</strong><br>${formatHora(fichaje.horaEntrada)} ${formatPrecision(
              fichaje.precisionEntradaMetros,
            )}`,
          );
        layersRef.current.push(pinEntrada);

        // Pin de salida (morado) si existe.
        let pinSalida: LeafletLayer | null = null;
        if (tieneCoordsSalida) {
          const salidaLat = fichaje.latSalida as number;
          const salidaLng = fichaje.lngSalida as number;
          pinSalida = L.marker([salidaLat, salidaLng], {
            icon: divIconColor(L, "#9333ea"),
          })
            .addTo(map)
            .bindPopup(
              `<strong>Salida</strong><br>${formatHora(fichaje.horaSalida)} ${formatPrecision(
                fichaje.precisionSalidaMetros,
              )}`,
            );
          layersRef.current.push(pinSalida);
        }

        // Ajuste de viewport: si hay 1 solo pin además del local, hacemos
        // setView para evitar zoom desmesurado de fitBounds con bounds tan
        // pequeñas. Si hay más, encajamos todos los puntos.
        if (pinSalida) {
          const bounds = L.latLngBounds([
            [localLat, localLng],
            [entradaLat, entradaLng],
            [fichaje.latSalida as number, fichaje.lngSalida as number],
          ]);
          map.fitBounds(bounds.pad(0.25), { padding: [20, 20] });
        } else {
          const bounds = L.latLngBounds([
            [localLat, localLng],
            [entradaLat, entradaLng],
          ]);
          map.fitBounds(bounds.pad(0.4), { padding: [20, 20] });
        }
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el mapa de ubicación.",
        );
      });

    return () => {
      cancelado = true;
      // Limpia capas y mapa para evitar memory leak al abrir/cerrar modal.
      if (mapRef.current) {
        for (const layer of layersRef.current) {
          try {
            mapRef.current.removeLayer(layer);
          } catch {
            // Layer puede haberse removido ya
          }
        }
        layersRef.current = [];
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
    };
  }, [
    fichaje.id,
    fichaje.latEntrada,
    fichaje.lngEntrada,
    fichaje.latSalida,
    fichaje.lngSalida,
    fichaje.horaEntrada,
    fichaje.horaSalida,
    fichaje.precisionEntradaMetros,
    fichaje.precisionSalidaMetros,
    local,
    puedeRenderizarMapa,
    tieneCoordsSalida,
  ]);

  // ─── Estados fallback ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="h-64 rounded-md border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!tieneCoordsLocal) {
    return (
      <div className="h-64 rounded-md border bg-muted/40 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground text-center px-6">
        <MapPinOff className="h-6 w-6" />
        <p>Sin ubicación configurada para este local.</p>
        <p className="text-xs">
          Configúrala en <span className="font-medium">Ajustes → Locales</span>.
        </p>
      </div>
    );
  }

  if (fichajeManual) {
    return (
      <div className="h-64 rounded-md border bg-muted/40 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground text-center px-6">
        <MapPinOff className="h-6 w-6" />
        <p>Entrada sin geolocalización (manual).</p>
        <p className="text-xs">
          Los fichajes registrados manualmente desde RRHH no incluyen coordenadas.
        </p>
      </div>
    );
  }

  if (!tieneCoordsEntrada) {
    return (
      <div className="h-64 rounded-md border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos de geolocalización del fichaje.
      </div>
    );
  }

  // ─── Render normal ────────────────────────────────────────────────────
  const distanciaEntrada = formatDistancia(fichaje.distanciaEntradaMetros);
  const distanciaSalida = tieneCoordsSalida
    ? formatDistancia(fichaje.distanciaSalidaMetros)
    : null;
  const modoLabel = fichaje.modoTeletrabajo ? "teletrabajo" : "presencial";

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-64 rounded-md border overflow-hidden"
      />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <div>
          <span className="text-foreground font-medium">Entrada:</span>{" "}
          {distanciaEntrada} de {local!.nombre}{" "}
          <span className="tabular-nums">
            {formatPrecision(fichaje.precisionEntradaMetros)}
          </span>
        </div>
        {distanciaSalida && (
          <div>
            <span className="text-foreground font-medium">Salida:</span>{" "}
            {distanciaSalida} de {local!.nombre}{" "}
            <span className="tabular-nums">
              {formatPrecision(fichaje.precisionSalidaMetros)}
            </span>
          </div>
        )}
        <div className="col-span-2">
          <span className="text-foreground font-medium">Modo:</span> {modoLabel}
        </div>
      </div>
    </div>
  );
}
