"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Search, Crosshair, Loader2 } from "lucide-react";
import { obtenerPosicionActual } from "@/features/rrhh/utils/geo";
import { toast } from "sonner";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

interface LeafletMap {
  setView: (latlng: [number, number], zoom: number) => LeafletMap;
  remove: () => void;
  removeLayer: (layer: unknown) => void;
}
interface LeafletMarker {
  setLatLng: (latlng: [number, number]) => LeafletMarker;
  getLatLng: () => { lat: number; lng: number };
  on: (event: string, fn: () => void) => void;
  addTo: (map: LeafletMap) => LeafletMarker;
}
interface LeafletCircle {
  setLatLng: (latlng: [number, number]) => LeafletCircle;
  setRadius: (r: number) => LeafletCircle;
  addTo: (map: LeafletMap) => LeafletCircle;
}
interface LeafletGlobal {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (m: LeafletMap) => unknown };
  marker: (latlng: [number, number], opts?: { draggable?: boolean }) => LeafletMarker;
  circle: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletCircle;
}

declare global {
  interface Window { L?: LeafletGlobal }
}

async function cargarLeaflet(): Promise<LeafletGlobal> {
  if (window.L) return window.L;
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      if (window.L) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Leaflet"));
    document.head.appendChild(script);
  });
  if (!window.L) throw new Error("Leaflet no inicializado");
  return window.L;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

// Quita sufijos comerciales/residenciales españoles que Nominatim no entiende.
// Ej: "calle leganes 51 local 2" → "calle leganes 51"
function limpiarCalle(street: string): string {
  return street
    .replace(/[,;]?\s*(local|piso|planta|puerta|escalera|esc\.?|pta\.?|bajo|bajos|atico|ático|sotano|sótano|nave)\s*[\w-]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function geocodificarLibre(query: string): Promise<NominatimResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Geocoding falló");
  return res.json();
}

async function geocodificarEstructurado(params: {
  street?: string;
  city?: string;
  postalcode?: string;
  country?: string;
}): Promise<NominatimResult[]> {
  const search = new URLSearchParams({ format: "json", limit: "5", addressdetails: "0" });
  if (params.street) search.set("street", params.street);
  if (params.city) search.set("city", params.city);
  if (params.postalcode) search.set("postalcode", params.postalcode);
  if (params.country) search.set("country", params.country);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${search.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Geocoding falló");
  return res.json();
}

interface Props {
  lat: number | null;
  lng: number | null;
  radio: number;
  direccionInicial?: string;
  ciudad?: string;
  codigoPostal?: string;
  pais?: string;
  onChange: (pos: { lat: number; lng: number }) => void;
  onRadioChange: (r: number) => void;
}

export function MapPicker({
  lat,
  lng,
  radio,
  direccionInicial,
  ciudad,
  codigoPostal,
  pais,
  onChange,
  onRadioChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [busqueda, setBusqueda] = useState(direccionInicial ?? "");
  const [resultados, setResultados] = useState<NominatimResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [obteniendoGeo, setObteniendoGeo] = useState(false);

  const [centro] = useState<[number, number]>(() =>
    lat != null && lng != null ? [lat, lng] : [40.4168, -3.7038]
  );

  useEffect(() => {
    let cancelado = false;
    cargarLeaflet().then((L) => {
      if (cancelado || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: true }).setView(centro, lat != null ? 17 : 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;

      if (lat != null && lng != null) {
        crearMarker(L, [lat, lng]);
      }

      function crearMarker(LL: LeafletGlobal, pos: [number, number]) {
        const m = LL.marker(pos, { draggable: true }).addTo(map);
        const c = LL.circle(pos, {
          radius: radio,
          color: "#7c3aed",
          fillColor: "#7c3aed",
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(map);
        m.on("dragend", () => {
          const ll = m.getLatLng();
          c.setLatLng([ll.lat, ll.lng]);
          onChangeRef.current({ lat: ll.lat, lng: ll.lng });
        });
        markerRef.current = m;
        circleRef.current = c;
      }

      // Click en mapa → posicionar pin
      (map as unknown as { on: (ev: string, fn: (e: { latlng: { lat: number; lng: number } }) => void) => void }).on(
        "click",
        (e) => {
          const pos: [number, number] = [e.latlng.lat, e.latlng.lng];
          if (!markerRef.current) {
            crearMarker(L, pos);
          } else {
            markerRef.current.setLatLng(pos);
            circleRef.current?.setLatLng(pos);
          }
          onChangeRef.current({ lat: pos[0], lng: pos[1] });
        }
      );
    }).catch((err) => {
      console.error("[MapPicker] Leaflet:", err);
      toast.error("No se pudo cargar el mapa. Revisa la conexión.");
    });

    return () => {
      cancelado = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza radio externo con círculo
  useEffect(() => {
    circleRef.current?.setRadius(radio);
  }, [radio]);

  // Sincroniza coords externas con marker (al cargar centro existente)
  useEffect(() => {
    if (lat == null || lng == null) return;
    if (!mapRef.current || !window.L) return;
    if (!markerRef.current) {
      const L = window.L;
      const m = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
      const c = L.circle([lat, lng], {
        radius: radio,
        color: "#7c3aed",
        fillColor: "#7c3aed",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(mapRef.current);
      m.on("dragend", () => {
        const ll = m.getLatLng();
        c.setLatLng([ll.lat, ll.lng]);
        onChangeRef.current({ lat: ll.lat, lng: ll.lng });
      });
      markerRef.current = m;
      circleRef.current = c;
    } else {
      markerRef.current.setLatLng([lat, lng]);
      circleRef.current?.setLatLng([lat, lng]);
    }
    mapRef.current.setView([lat, lng], 17);
  }, [lat, lng, radio]);

  const buscar = useCallback(async () => {
    const raw = busqueda.trim();
    if (!raw) return;
    setBuscando(true);
    try {
      const calleLimpia = limpiarCalle(raw);
      // 1) Búsqueda estructurada con ciudad / CP / país (mejor precisión).
      let r: NominatimResult[] = [];
      if (ciudad || codigoPostal || pais) {
        r = await geocodificarEstructurado({
          street: calleLimpia,
          city: ciudad,
          postalcode: codigoPostal,
          country: pais,
        });
      }
      // 2) Fallback: texto libre con calle limpia + ciudad + país.
      if (r.length === 0) {
        const partes = [calleLimpia, codigoPostal, ciudad, pais].filter(Boolean);
        r = await geocodificarLibre(partes.join(", "));
      }
      // 3) Último fallback: texto libre tal cual escribió el usuario.
      if (r.length === 0 && calleLimpia !== raw) {
        r = await geocodificarLibre(raw);
      }
      if (r.length === 0) {
        toast.error("Sin resultados para esa dirección");
        setResultados([]);
        return;
      }
      setResultados(r);
      seleccionar(r[0]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de búsqueda");
    } finally {
      setBuscando(false);
    }
  }, [busqueda, ciudad, codigoPostal, pais]);

  const seleccionar = (r: NominatimResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    onChangeRef.current({ lat, lng });
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 17);
    }
    setResultados([]);
  };

  const usarMiUbicacion = async () => {
    setObteniendoGeo(true);
    try {
      const pos = await obtenerPosicionActual();
      onChangeRef.current({ lat: pos.lat, lng: pos.lng });
      mapRef.current?.setView([pos.lat, pos.lng], 17);
      toast.success(`Ubicación capturada (±${Math.round(pos.precision)} m)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de geolocalización");
    } finally {
      setObteniendoGeo(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); buscar(); }
            }}
            placeholder="Buscar dirección (calle, número, ciudad)…"
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" onClick={buscar} disabled={buscando}>
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="outline" onClick={usarMiUbicacion} disabled={obteniendoGeo} title="Usar mi ubicación actual">
          {obteniendoGeo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
        </Button>
      </div>

      {resultados.length > 1 && (
        <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
          {resultados.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => seleccionar(r)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50"
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-[320px] rounded-xl overflow-hidden border bg-muted"
      />
      <p className="text-[11px] text-muted-foreground">
        Haz click en el mapa o arrastra el pin para ajustar la ubicación exacta. El círculo violeta
        muestra el radio dentro del cual los empleados podrán fichar.
      </p>
    </div>
  );
}
