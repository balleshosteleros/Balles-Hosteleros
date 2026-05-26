"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ImagePlus, MapPin, Search, Loader2, Trash2, X, ChevronLeft, ChevronRight,
  Store, Armchair, Wine, Umbrella, ChefHat, Bath, Boxes, Car, LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import {
  CATEGORIAS_FOTOS_LOCAL,
  type BloqueLocal,
  type CaracteristicasLocal,
  type CategoriaFotoLocal,
  type FotoEstudio,
  type UbicacionLocal,
} from "@/features/direccion/data/aperturas";
import {
  uploadFotoCategoria,
  deleteFotoStorage,
} from "@/features/direccion/actions/estudios-apertura-actions";
import { prepararFotoParaSubida } from "@/features/direccion/lib/foto-upload";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { MapaUbicacionRadio } from "./MapaUbicacionRadio";
import { BadgeSugerenciaIA } from "@/features/direccion/components/aperturas/shared/BadgeSugerenciaIA";
import type { DraftLocal } from "@/features/direccion/types/aperturas-ia";

export type SeccionLocalIA = "caracteristicas" | "ubicacion";

const ICONOS_CATEGORIA: Record<CategoriaFotoLocal, LucideIcon> = {
  fachada: Store,
  interior: Armchair,
  barra: Wine,
  terraza: Umbrella,
  cocina: ChefHat,
  aseos: Bath,
  almacen: Boxes,
  parking: Car,
  otras: LayoutGrid,
};

type NominatimHit = {
  display_name: string;
  lat: string;
  lon: string;
  address?: { city?: string; town?: string; village?: string; postcode?: string; country?: string };
};

interface Props {
  estudioId: string;
  local: BloqueLocal;
  onChange: (next: BloqueLocal, opts?: { flush?: boolean }) => void;
  readOnly?: boolean;
  portada?: {
    imagen?: string;
    nombre: string;
    onUpload: (file: File) => void;
    onRemove: () => void;
  };
  iaDraft?: DraftLocal;
  onClearIaField?: (seccion: SeccionLocalIA, campo: string) => void;
}

export function LocalTab({
  estudioId,
  local,
  onChange,
  readOnly = false,
  portada,
  iaDraft,
  onClearIaField,
}: Props) {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const iaCar = (campo: string): boolean => {
    const sec = iaDraft?.caracteristicas as Record<string, unknown> | undefined;
    return sec ? sec[campo] !== undefined : false;
  };
  const iaUbi = (campo: string): boolean => {
    const sec = iaDraft?.ubicacion as Record<string, unknown> | undefined;
    return sec ? sec[campo] !== undefined : false;
  };
  const setCar = (patch: Partial<CaracteristicasLocal>) => {
    if (readOnly) return;
    onChange({ ...local, caracteristicas: { ...local.caracteristicas, ...patch } });
    if (onClearIaField) {
      for (const k of Object.keys(patch)) onClearIaField("caracteristicas", k);
    }
  };
  const setUbi = (patch: Partial<UbicacionLocal>) => {
    if (readOnly) return;
    onChange({ ...local, ubicacion: { ...local.ubicacion, ...patch } });
    if (onClearIaField) {
      for (const k of Object.keys(patch)) onClearIaField("ubicacion", k);
    }
  };

  /* ── Subida / borrado de fotos por categoría ── */
  const handleUpload = async (cat: CategoriaFotoLocal, file: File) => {
    try {
      const prep = await prepararFotoParaSubida(file);
      if (!prep.ok) {
        window.alert(prep.error);
        return;
      }
      const res = await uploadFotoCategoria({
        estudioId,
        categoria: cat,
        fileBase64: prep.dataUrl,
        fileType: prep.tipo,
        fileSize: prep.tamano,
      });
      if (!res.ok) {
        console.error("[LocalTab] upload:", res.error);
        window.alert(`No se pudo subir la imagen: ${res.error}`);
        return;
      }
      const finales = [...(local.fotos[cat] ?? []), res.foto];
      onChange({ ...local, fotos: { ...local.fotos, [cat]: finales } }, { flush: true });
    } catch (err) {
      console.error("[LocalTab] upload threw:", err);
      window.alert("No se pudo subir la imagen. Prueba con un archivo más pequeño.");
    }
  };

  const handleRemove = async (cat: CategoriaFotoLocal, foto: FotoEstudio) => {
    const ok = await confirmDelete({
      title: "¿Quitar esta foto del local?",
      description: "Se eliminará la imagen de esta galería. Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    const fotosCat = (local.fotos[cat] ?? []).filter((f) => f.id !== foto.id);
    onChange({ ...local, fotos: { ...local.fotos, [cat]: fotosCat } }, { flush: true });
    if (foto.path) {
      const res = await deleteFotoStorage({ estudioId, path: foto.path });
      if (!res.ok) console.error("[LocalTab] delete:", res.error);
    }
  };

  return (
    <div className="space-y-4">
      {confirmDeleteDialog}
      <CaracteristicasCard car={local.caracteristicas} onChange={setCar} readOnly={readOnly} ia={iaCar} />
      <UbicacionCard ubicacion={local.ubicacion} onChange={setUbi} readOnly={readOnly} ia={iaUbi} />
      <FotosCard fotos={local.fotos} onUpload={handleUpload} onRemove={handleRemove} readOnly={readOnly} portada={portada} />
    </div>
  );
}

/* ── Características físicas ── */
function CaracteristicasCard({
  car,
  onChange,
  readOnly = false,
  ia,
}: { car: CaracteristicasLocal; onChange: (patch: Partial<CaracteristicasLocal>) => void; readOnly?: boolean; ia: (campo: string) => boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Características del local</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Datos físicos, contractuales y técnicos del local objetivo.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <Field label="Tipo de establecimiento" iaActive={ia("tipoEstablecimiento")}>
          <Input disabled={readOnly} value={car.tipoEstablecimiento} onChange={(e) => onChange({ tipoEstablecimiento: e.target.value })} placeholder="Bajo comercial, esquina…" />
        </Field>
        <Field label="m² útiles" iaActive={ia("metrosUtiles")}>
          <Input disabled={readOnly} type="number" value={car.metrosUtiles || ""} onChange={(e) => onChange({ metrosUtiles: Number(e.target.value) })} />
        </Field>
        <Field label="m² terraza" iaActive={ia("metrosTerraza")}>
          <Input disabled={readOnly} type="number" value={car.metrosTerraza || ""} onChange={(e) => onChange({ metrosTerraza: Number(e.target.value) })} />
        </Field>
        <Field label="Comensales interior" iaActive={ia("plazasInterior")}>
          <Input disabled={readOnly} type="number" value={car.plazasInterior || ""} onChange={(e) => onChange({ plazasInterior: Number(e.target.value) })} />
        </Field>
        <Field label="Comensales terraza" iaActive={ia("plazasTerraza")}>
          <Input disabled={readOnly} type="number" value={car.plazasTerraza || ""} onChange={(e) => onChange({ plazasTerraza: Number(e.target.value) })} />
        </Field>
        <Field label="Plantas" iaActive={ia("plantasLocal")}>
          <Input disabled={readOnly} type="number" value={car.plantasLocal || ""} onChange={(e) => onChange({ plantasLocal: Number(e.target.value) })} />
        </Field>
        <Field label="Baños" iaActive={ia("banos")}>
          <Input disabled={readOnly} type="number" value={car.banos || ""} onChange={(e) => onChange({ banos: Number(e.target.value) })} />
        </Field>
        <Field label="Estado del local" iaActive={ia("estadoLocal")}>
          <Input disabled={readOnly} value={car.estadoLocal} onChange={(e) => onChange({ estadoLocal: e.target.value })} placeholder="A reformar, llave en mano…" />
        </Field>
        <Field label="Licencia de actividad" iaActive={ia("licenciaActividad")}>
          <Input disabled={readOnly} value={car.licenciaActividad} onChange={(e) => onChange({ licenciaActividad: e.target.value })} placeholder="Bar-restaurante cat. 2…" />
        </Field>
        <Field label="Salida de humos" iaActive={ia("salidaHumos")}>
          <Input disabled={readOnly} value={car.salidaHumos} onChange={(e) => onChange({ salidaHumos: e.target.value })} placeholder="Sí / No / hasta cubierta" />
        </Field>
        <Field label="Alquiler mensual (€)" iaActive={ia("alquilerMensual")}>
          <Input disabled={readOnly} type="number" value={car.alquilerMensual || ""} onChange={(e) => onChange({ alquilerMensual: Number(e.target.value) })} />
        </Field>
        <Field label="Traspaso (€)" iaActive={ia("traspaso")}>
          <Input disabled={readOnly} type="number" value={car.traspaso || ""} onChange={(e) => onChange({ traspaso: Number(e.target.value) })} />
        </Field>
        <Field label="Duración del contrato" iaActive={ia("duracionContrato")}>
          <Input disabled={readOnly} value={car.duracionContrato} onChange={(e) => onChange({ duracionContrato: e.target.value })} placeholder="5 años + 5 años" />
        </Field>
        <Field label="Punto de acceso" iaActive={ia("acceso")}>
          <Input disabled={readOnly} value={car.acceso} onChange={(e) => onChange({ acceso: e.target.value })} placeholder="Planta calle, sin escalones…" />
        </Field>
        <div className="col-span-2 md:col-span-3">
          <Field label="Observaciones" iaActive={ia("observaciones")}>
            <Textarea disabled={readOnly} value={car.observaciones} onChange={(e) => onChange({ observaciones: e.target.value })} rows={3} />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Ubicación: input + búsqueda Nominatim + iframe OSM ── */
function UbicacionCard({
  ubicacion,
  onChange,
  readOnly = false,
  ia,
}: { ubicacion: UbicacionLocal; onChange: (patch: Partial<UbicacionLocal>) => void; readOnly?: boolean; ia: (campo: string) => boolean }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NominatimHit[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si la dirección guardada cambia desde fuera, sincroniza el input
  useEffect(() => {
    setQuery(ubicacion.direccion);
  }, [ubicacion.direccion]);

  const buscar = async (q: string) => {
    if (!q.trim() || q.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { "Accept-Language": "es" } });
      if (!res.ok) throw new Error("Búsqueda fallida");
      const data = (await res.json()) as NominatimHit[];
      setResults(data);
    } catch (err) {
      console.error("[UbicacionCard] nominatim:", err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const onQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(val), 400);
  };

  const seleccionar = (hit: NominatimHit) => {
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    onChange({
      direccion: hit.display_name,
      ciudad: hit.address?.city || hit.address?.town || hit.address?.village || ubicacion.ciudad,
      codigoPostal: hit.address?.postcode || ubicacion.codigoPostal,
      pais: hit.address?.country || ubicacion.pais,
      lat,
      lng,
    });
    setQuery(hit.display_name);
    setResults([]);
  };

  const tieneCoords = ubicacion.lat != null && ubicacion.lng != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Ubicación del local
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Busca la dirección o zona aproximada. El plano sitúa el marcador donde quieres abrir.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          {!readOnly && (
            <div className="md:col-span-4 relative">
              <Label className="text-muted-foreground text-xs">Buscar dirección</Label>
              <div className="relative mt-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="Calle, plaza o zona aproximada"
                  className="pl-9"
                />
                {searching && <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
              {results.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
                  {results.map((r, i) => (
                    <li
                      key={`${r.lat}-${r.lon}-${i}`}
                      className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                      onClick={() => seleccionar(r)}
                    >
                      {r.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {readOnly && (
            <div className="md:col-span-4">
              <Label className="text-muted-foreground text-xs">Dirección</Label>
              <Input disabled value={ubicacion.direccion} className="mt-1" />
            </div>
          )}
          <Field label="Ciudad" iaActive={ia("ciudad")}>
            <Input disabled={readOnly} value={ubicacion.ciudad} onChange={(e) => onChange({ ciudad: e.target.value })} />
          </Field>
          <Field label="Código postal" iaActive={ia("codigoPostal")}>
            <Input disabled={readOnly} value={ubicacion.codigoPostal} onChange={(e) => onChange({ codigoPostal: e.target.value })} />
          </Field>
          <Field label="País" iaActive={ia("pais")}>
            <Input disabled={readOnly} value={ubicacion.pais} onChange={(e) => onChange({ pais: e.target.value })} />
          </Field>
          <Field label="Radio a la redonda">
            <select
              disabled={readOnly}
              value={ubicacion.radioKm}
              onChange={(e) => onChange({ radioKm: Number(e.target.value) })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value={0.5}>0,5 km</option>
              <option value={1}>1 km</option>
              <option value={2}>2 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={20}>20 km</option>
              <option value={50}>50 km</option>
            </select>
          </Field>
        </div>

        <div className="rounded-md overflow-hidden border bg-muted/20">
          {tieneCoords ? (
            <MapaUbicacionRadio
              lat={ubicacion.lat as number}
              lng={ubicacion.lng as number}
              radioKm={ubicacion.radioKm}
              className="w-full h-[360px]"
            />
          ) : (
            <div className="h-[360px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
              <MapPin className="h-8 w-8" strokeWidth={1.5} />
              <span>Busca una dirección o introduce coordenadas para ver el plano.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Galerías de fotos por categoría (compacto, en pestañas) ── */

type GalleryItem = {
  url: string;
  label: string;
  Icono: LucideIcon;
};

function FotosCard({
  fotos,
  onUpload,
  onRemove,
  readOnly = false,
  portada,
}: {
  fotos: BloqueLocal["fotos"];
  onUpload: (cat: CategoriaFotoLocal, file: File) => void;
  onRemove: (cat: CategoriaFotoLocal, foto: FotoEstudio) => void;
  readOnly?: boolean;
  portada?: {
    imagen?: string;
    nombre: string;
    onUpload: (file: File) => void;
    onRemove: () => void;
  };
}) {
  const totalFotos = CATEGORIAS_FOTOS_LOCAL.reduce(
    (acc, c) => acc + (fotos[c.key]?.length ?? 0),
    0,
  );

  const defaultTab = portada ? "__portada" : CATEGORIAS_FOTOS_LOCAL[0].key;

  // Lista plana global: portada + todas las categorías en orden.
  // Permite que el lightbox navegue por TODO sin cerrarse al cambiar de zona.
  const itemsGlobales: GalleryItem[] = [];
  if (portada?.imagen) {
    itemsGlobales.push({
      url: portada.imagen,
      label: "Portada",
      Icono: ImagePlus,
    });
  }
  for (const cat of CATEGORIAS_FOTOS_LOCAL) {
    for (const f of fotos[cat.key] ?? []) {
      if (f.url) {
        itemsGlobales.push({
          url: f.url,
          label: cat.label,
          Icono: ICONOS_CATEGORIA[cat.key],
        });
      }
    }
  }

  // Calcula el índice global a partir de la zona y el índice local
  // (la fila del grid local le pide "ábrelo en mi posición", aquí lo traducimos a la posición global).
  const offsetCategoria = (cat: CategoriaFotoLocal): number => {
    let acc = portada?.imagen ? 1 : 0;
    for (const c of CATEGORIAS_FOTOS_LOCAL) {
      if (c.key === cat) return acc;
      acc += (fotos[c.key] ?? []).filter((f) => !!f.url).length;
    }
    return acc;
  };

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const abrirEnPortada = () => setLightboxIndex(0);
  const abrirEnCategoria = (cat: CategoriaFotoLocal, idxLocal: number) =>
    setLightboxIndex(offsetCategoria(cat) + idxLocal);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Infografías del concepto</CardTitle>
          <span className="text-xs text-muted-foreground">
            {totalFotos} {totalFotos === 1 ? "imagen" : "imágenes"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Renders y referencias visuales del local proyectado. No son fotos reales: muestran cómo quedará el espacio una vez ejecutado.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1">
            {portada && (
              <TabsTrigger
                value="__portada"
                className="text-xs px-2.5 py-1 h-auto"
              >
                Portada
                {portada.imagen && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-foreground/10 text-[10px] font-semibold px-1">
                    1
                  </span>
                )}
              </TabsTrigger>
            )}
            {CATEGORIAS_FOTOS_LOCAL.map((cat) => {
              const n = fotos[cat.key]?.length ?? 0;
              return (
                <TabsTrigger
                  key={cat.key}
                  value={cat.key}
                  className="text-xs px-2.5 py-1 h-auto"
                >
                  {cat.label}
                  {n > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-foreground/10 text-[10px] font-semibold px-1">
                      {n}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {portada && (
            <TabsContent value="__portada" className="mt-3">
              <PortadaSection
                imagen={portada.imagen}
                nombre={portada.nombre}
                onUpload={portada.onUpload}
                onRemove={portada.onRemove}
                readOnly={readOnly}
                onOpenLightbox={abrirEnPortada}
              />
            </TabsContent>
          )}
          {CATEGORIAS_FOTOS_LOCAL.map((cat) => (
            <TabsContent key={cat.key} value={cat.key} className="mt-3">
              <Galeria
                label={cat.label}
                categoria={cat.key}
                fotos={fotos[cat.key] ?? []}
                onUpload={onUpload}
                onRemove={onRemove}
                readOnly={readOnly}
                onOpenLightbox={(idxLocal) => abrirEnCategoria(cat.key, idxLocal)}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
      {lightboxIndex !== null && itemsGlobales[lightboxIndex] && (
        <Lightbox
          items={itemsGlobales}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </Card>
  );
}

function PortadaSection({
  imagen,
  nombre,
  onUpload,
  onRemove,
  readOnly = false,
  onOpenLightbox,
}: {
  imagen?: string;
  nombre: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
  readOnly?: boolean;
  onOpenLightbox: () => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
      {imagen && (
        <div className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
          <button
            type="button"
            onClick={onOpenLightbox}
            className="block w-full h-full cursor-zoom-in"
            title="Ver en grande"
            aria-label="Abrir foto de portada en grande"
          >
            <img src={imagen} alt={nombre} className="w-full h-full object-cover" />
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/80"
              title="Quitar foto"
              aria-label="Quitar foto"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      {!readOnly && (
        <label className="aspect-square flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer text-[11px]">
          <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
          <span>{imagen ? "Cambiar" : "Añadir"}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(ev) => {
              const file = ev.target.files?.[0];
              if (file) onUpload(file);
              ev.target.value = "";
            }}
          />
        </label>
      )}
      {readOnly && !imagen && (
        <div className="col-span-full text-center text-xs text-muted-foreground py-4">
          Sin foto de portada.
        </div>
      )}
    </div>
  );
}

function Galeria({
  label,
  categoria,
  fotos,
  onUpload,
  onRemove,
  readOnly = false,
  onOpenLightbox,
}: {
  label: string;
  categoria: CategoriaFotoLocal;
  fotos: FotoEstudio[];
  onUpload: (cat: CategoriaFotoLocal, file: File) => void;
  onRemove: (cat: CategoriaFotoLocal, foto: FotoEstudio) => void;
  readOnly?: boolean;
  onOpenLightbox: (idxLocal: number) => void;
}) {
  const fotosConUrl = fotos.filter((f) => !!f.url);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
      {fotos.map((f) => {
        const idxAbrible = fotosConUrl.findIndex((x) => x.id === f.id);
        const abrible = idxAbrible >= 0;
        return (
          <div
            key={f.id}
            className="relative group aspect-square rounded-md overflow-hidden border bg-muted"
          >
            {f.url ? (
              <button
                type="button"
                onClick={() => onOpenLightbox(idxAbrible)}
                className="block w-full h-full cursor-zoom-in"
                title="Ver en grande"
                aria-label={`Abrir foto ${label} en grande`}
              >
                <img src={f.url} alt={label} className="w-full h-full object-cover" />
              </button>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                Sin previsualización
              </div>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => onRemove(categoria, f)}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/80"
                title="Quitar foto"
                aria-label="Quitar foto"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            {!abrible && f.url && (
              <span className="sr-only">no abrible</span>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <label className="aspect-square flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer text-[11px]">
          <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
          <span>Añadir</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(ev) => {
              const file = ev.target.files?.[0];
              if (file) onUpload(categoria, file);
              ev.target.value = "";
            }}
          />
        </label>
      )}
      {readOnly && fotos.length === 0 && (
        <div className="col-span-full text-center text-xs text-muted-foreground py-4">
          Sin fotos para esta zona.
        </div>
      )}
    </div>
  );
}

function Lightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: GalleryItem[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const total = items.length;
  const item = items[index];

  const prev = () => onIndexChange((index - 1 + total) % total);
  const next = () => onIndexChange((index + 1) % total);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, total]);

  if (!item?.url) return null;

  // Agrupa los índices por zona para los chips de navegación rápida.
  // Cada zona se ofrece como acceso directo a su primera foto.
  const zonas: Array<{ label: string; Icono: LucideIcon; startIndex: number; activa: boolean }> = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const last = zonas[zonas.length - 1];
    if (!last || last.label !== it.label) {
      zonas.push({ label: it.label, Icono: it.Icono, startIndex: i, activa: false });
    }
  }
  for (const z of zonas) {
    z.activa = z.label === item.label;
  }

  const { Icono } = item;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Galería ${item.label}`}
    >
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-sm font-medium tracking-wide">
            <Icono className="h-4 w-4" strokeWidth={1.75} />
            {item.label}
          </span>
          <span className="text-xs text-white/70">
            {index + 1} / {total}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          aria-label="Cerrar"
          title="Cerrar (Esc)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Foto anterior"
            title="Anterior (←)"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Foto siguiente"
            title="Siguiente (→)"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <img
        src={item.url}
        alt={item.label}
        className="max-w-[92vw] max-h-[82vh] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {zonas.length > 1 && (
        <div
          className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {zonas.map((z) => {
              const ZIco = z.Icono;
              return (
                <button
                  key={`${z.label}-${z.startIndex}`}
                  type="button"
                  onClick={() => onIndexChange(z.startIndex)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors " +
                    (z.activa
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/85 hover:bg-white/20")
                  }
                  title={`Ir a ${z.label}`}
                >
                  <ZIco className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {z.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  iaActive,
}: {
  label: string;
  children: React.ReactNode;
  iaActive?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Label className="text-muted-foreground text-xs">{label}</Label>
        {iaActive && <BadgeSugerenciaIA />}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
