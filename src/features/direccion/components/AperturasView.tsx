"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { TrendingUp, TrendingDown, FileText, Calculator, ArrowLeft, Landmark, Target, Clock, Settings, ImagePlus, X, ChevronDown, ChevronRight, Plus, Trash2, Receipt, Building2, Sparkles, ChefHat, Activity, Ticket, Layers, Share2, Link2, Copy, RefreshCw, EyeOff, Check, Lightbulb } from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, Sector } from "recharts";
import {
  ESCENARIOS, EstudioApertura, DatosProyecto, EstructuraCostes,
  EstructuraFacturacion, PartidaFacturacion, FacturacionPilar, FactPilarKey,
  FACT_PILAR_KEYS, FACT_PILAR_NAMES,
  calcularEscenario, calcularPilar, CostePilar, PartidaCoste, PilarKey,
  pilarFijo, pilarVariablePct, nuevaPartida, crearCostesIniciales,
  totalFacturacion, totalClientes, ticketMedioPonderado,
  pilarFactClientes, pilarFactTotal, pilarFactTicketPonderado,
  lineasPlanas,
  nuevaPartidaFacturacion, crearFacturacionInicial,
  EstadoViabilidad, EstadoActividad,
  bloqueLocalInicial, imagenMarcaInicial, propuestaGastronomicaInicial,
  bloqueOcupacionInicial,
} from "@/features/direccion/data/aperturas";
import { ProcedenciaTab } from "@/features/direccion/components/aperturas/ProcedenciaTab";
import { DestinoTab } from "@/features/direccion/components/aperturas/DestinoTab";
import { AmortizacionTab } from "@/features/direccion/components/aperturas/AmortizacionTab";
import { LocalTab } from "@/features/direccion/components/aperturas/LocalTab";
import { MarcaTab } from "@/features/direccion/components/aperturas/MarcaTab";
import { GastronomiaTab } from "@/features/direccion/components/aperturas/GastronomiaTab";
import { OcupacionTab } from "@/features/direccion/components/aperturas/OcupacionTab";
import {
  listEstudiosApertura,
  createEstudioApertura,
  updateEstudioApertura,
  uploadFotoEstudio,
  deleteFotoEstudio,
  enableShareEstudio,
  disableShareEstudio,
  regenerateShareEstudio,
  type EstudioRow,
} from "@/features/direccion/actions/estudios-apertura-actions";
import { prepararFotoParaSubida } from "@/features/direccion/lib/foto-upload";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { BotonRellenarIA } from "@/features/direccion/components/aperturas/shared/BotonRellenarIA";
import { BarraConfirmarIA } from "@/features/direccion/components/aperturas/shared/BarraConfirmarIA";
import { BadgeSugerenciaIA } from "@/features/direccion/components/aperturas/shared/BadgeSugerenciaIA";
import { ModoPresentacion } from "@/features/direccion/components/aperturas/presentacion/ModoPresentacion";
import { Monitor as MonitorIcon, Presentation as PresentationIcon } from "lucide-react";
import { RellenoIADialog } from "@/features/direccion/components/aperturas/ia/RellenoIADialog";
import { aplicarDraftCompleto } from "@/features/direccion/services/aperturas-ia/merge";
import type {
  BloqueIAKey,
  BloqueIAAnyKey,
  DraftIAEstudio,
} from "@/features/direccion/types/aperturas-ia";

function rowToEstudio(row: EstudioRow): EstudioApertura {
  return {
    id: row.id,
    datos: row.datos,
    facturacion: row.facturacion,
    costes: row.costes,
    procedencia: row.procedencia,
    destinos: row.destinos,
    amortizacion: row.amortizacion,
    creado: row.creado,
    imagen: row.foto_url ?? undefined,
    viabilidad: row.viabilidad,
    actividad: row.actividad,
    local: row.local ?? bloqueLocalInicial(),
    imagenMarca: row.imagen_marca ?? imagenMarcaInicial(),
    propuesta: row.propuesta_gastronomica ?? propuestaGastronomicaInicial(),
    ocupacion: row.ocupacion ?? bloqueOcupacionInicial(),
    shareSlug: row.share_slug,
    shareActive: row.share_active,
  };
}

const COLORS = ["hsl(var(--primary))", "hsl(210 70% 50%)", "hsl(150 60% 45%)", "hsl(40 90% 55%)", "hsl(340 70% 50%)"];
const PILAR_COLORS = ["hsl(210 70% 55%)", "hsl(340 65% 55%)", "hsl(150 60% 45%)", "hsl(40 90% 55%)"];
const PILAR_NAMES = ["Generales", "Personal", "Producto", "Marketing"];
const FACT_PILAR_COLORS: Record<FactPilarKey, string> = {
  franjas:  "hsl(210 70% 55%)",
  acuerdos: "hsl(40 90% 55%)",
  eventos:  "hsl(340 65% 55%)",
  tienda:   "hsl(150 60% 45%)",
};

function fmt(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

function formatRecuperacion(mesesTotal: number): string {
  const meses = Math.max(0, Math.ceil(mesesTotal));
  const anos = Math.floor(meses / 12);
  const mesesRest = meses % 12;
  if (anos === 0) return `${mesesRest} ${mesesRest === 1 ? "mes" : "meses"}`;
  if (mesesRest === 0) return `${anos} ${anos === 1 ? "año" : "años"}`;
  return `${anos} ${anos === 1 ? "año" : "años"} ${mesesRest} ${mesesRest === 1 ? "mes" : "meses"}`;
}

export function AperturasView() {
  const { empresaActual } = useEmpresa();
  const [estudios, setEstudios] = useState<EstudioApertura[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EstudioApertura | null>(null);
  const [showNew, setShowNew] = useState(false);
  const saveTimeoutsRef = useRef<
    Map<string, { timer: ReturnType<typeof setTimeout>; est: EstudioApertura }>
  >(new Map());

  // Carga inicial desde Supabase (re-carga al cambiar empresa)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listEstudiosApertura()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setEstudios(res.data.map(rowToEstudio));
          setLoadError(null);
        } else {
          console.error("[aperturas] list failed:", res.error);
          setLoadError(res.error ?? "No se pudieron cargar los estudios");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[aperturas] list threw:", err);
        setLoadError(err instanceof Error ? err.message : "Error de red");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [empresaActual?.id]);

  // Persiste el estudio inmediatamente (sin debounce)
  const persistEstudio = useCallback(async (est: EstudioApertura) => {
    const res = await updateEstudioApertura(est.id, {
      datos: est.datos,
      facturacion: est.facturacion,
      costes: est.costes,
      procedencia: est.procedencia,
      destinos: est.destinos,
      amortizacion: est.amortizacion,
      local: est.local,
      imagen_marca: est.imagenMarca,
      propuesta_gastronomica: est.propuesta,
      ocupacion: est.ocupacion,
    });
    if (!res.ok) console.error("[aperturas] save:", res.error);
  }, []);

  // Persiste cambios del detalle con debounce de 500ms
  const scheduleSave = useCallback((est: EstudioApertura) => {
    const map = saveTimeoutsRef.current;
    const existing = map.get(est.id);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      map.delete(est.id);
      void persistEstudio(est);
    }, 500);
    map.set(est.id, { timer, est });
  }, [persistEstudio]);

  // Persiste ya, cancelando cualquier debounce pendiente para ese estudio
  const saveNow = useCallback((est: EstudioApertura) => {
    const map = saveTimeoutsRef.current;
    const existing = map.get(est.id);
    if (existing) clearTimeout(existing.timer);
    map.delete(est.id);
    return persistEstudio(est);
  }, [persistEstudio]);

  // Al desmontar, dispara los debounces pendientes (no los cancela)
  useEffect(() => {
    const timers = saveTimeoutsRef.current;
    return () => {
      timers.forEach(({ timer, est }) => {
        clearTimeout(timer);
        void persistEstudio(est);
      });
      timers.clear();
    };
  }, [persistEstudio]);

  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [showConfig, setShowConfig] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const acceso = (e: EstudioApertura, campo: string): unknown => {
    if (campo === "nombre") return e.datos.nombre;
    if (campo === "ciudad") return e.datos.ciudad;
    if (campo === "zona") return e.datos.zona;
    if (campo === "ventas") return e.datos.ventasEstimadas;
    if (campo === "creado") return e.creado;
    return (e as unknown as Record<string, unknown>)[campo];
  };

  const estudiosFiltrados = useMemo(() => {
    let lista = estudios.filter((e) => {
      if (!busqueda) return true;
      const txt = `${e.datos.nombre} ${e.datos.ciudad} ${e.datos.zona}`.toLowerCase();
      return txt.includes(busqueda.toLowerCase());
    });
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [estudios, busqueda, filtros, orden]);

  const removeImagen = async (id: string) => {
    const ok = await confirmDelete({
      title: "¿Borrar la foto del estudio?",
      description: "Se eliminará la imagen de portada de este estudio. Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    setEstudios(prev => prev.map(x => x.id === id ? { ...x, imagen: undefined } : x));
    setSelected(s => s && s.id === id ? { ...s, imagen: undefined } : s);
    const res = await deleteFotoEstudio(id);
    if (!res.ok) console.error("[aperturas] deleteFoto:", res.error);
  };

  const onUploadImagen = async (id: string, file: File) => {
    const previo = estudios.find(x => x.id === id)?.imagen;
    try {
      const prep = await prepararFotoParaSubida(file);
      if (!prep.ok) {
        window.alert(prep.error);
        return;
      }
      setEstudios(prev => prev.map(x => x.id === id ? { ...x, imagen: prep.dataUrl } : x));
      setSelected(s => s && s.id === id ? { ...s, imagen: prep.dataUrl } : s);
      const res = await uploadFotoEstudio({
        estudioId: id,
        fileBase64: prep.dataUrl,
        fileType: prep.tipo,
        fileSize: prep.tamano,
      });
      if (!res.ok) {
        console.error("[aperturas] uploadFoto:", res.error);
        window.alert(`No se pudo subir la imagen: ${res.error}`);
        setEstudios(prev => prev.map(x => x.id === id ? { ...x, imagen: previo } : x));
        setSelected(s => s && s.id === id ? { ...s, imagen: previo } : s);
        return;
      }
      setEstudios(prev => prev.map(x => x.id === id ? { ...x, imagen: res.foto_url } : x));
      setSelected(s => s && s.id === id ? { ...s, imagen: res.foto_url } : s);
    } catch (err) {
      console.error("[aperturas] uploadFoto threw:", err);
      window.alert("No se pudo subir la imagen. Prueba con un archivo más pequeño.");
      setEstudios(prev => prev.map(x => x.id === id ? { ...x, imagen: previo } : x));
      setSelected(s => s && s.id === id ? { ...s, imagen: previo } : s);
    }
  };

  if (selected) {
    return (
      <>
        {confirmDeleteDialog}
        <DetalleEstudio
          estudio={selected}
          onBack={() => setSelected(null)}
          onUpdate={(e, opts) => {
            setEstudios(prev => prev.map(x => x.id === e.id ? e : x));
            setSelected(e);
            if (opts?.suppressSave) return;
            if (opts?.flush) void saveNow(e);
            else scheduleSave(e);
          }}
          onSetViabilidad={(v) => setViabilidad(selected.id, v)}
          onSetActividad={(v) => setActividad(selected.id, v)}
          onEnableShare={() => handleEnableShare(selected.id)}
          onDisableShare={() => handleDisableShare(selected.id)}
          onRegenerateShare={() => handleRegenerateShare(selected.id)}
          onUploadPortada={(file) => onUploadImagen(selected.id, file)}
          onRemovePortada={() => removeImagen(selected.id)}
        />
      </>
    );
  }

  const setViabilidad = async (id: string, viabilidad: EstadoViabilidad) => {
    setEstudios(prev => prev.map(x => x.id === id ? { ...x, viabilidad } : x));
    const res = await updateEstudioApertura(id, { viabilidad });
    if (!res.ok) console.error("[aperturas] updateViabilidad:", res.error);
  };

  const setActividad = async (id: string, actividad: EstadoActividad) => {
    setEstudios(prev => prev.map(x => x.id === id ? { ...x, actividad } : x));
    const res = await updateEstudioApertura(id, { actividad });
    if (!res.ok) console.error("[aperturas] updateActividad:", res.error);
  };

  const handleEnableShare = async (id: string) => {
    const res = await enableShareEstudio(id);
    if (!res.ok) {
      window.alert(`No se pudo activar el enlace: ${res.error}`);
      return;
    }
    const slug = res.share_slug;
    setEstudios(prev => prev.map(x => x.id === id ? { ...x, shareSlug: slug, shareActive: true } : x));
    setSelected(s => s && s.id === id ? { ...s, shareSlug: slug, shareActive: true } : s);
  };

  const handleDisableShare = async (id: string) => {
    setEstudios(prev => prev.map(x => x.id === id ? { ...x, shareActive: false } : x));
    setSelected(s => s && s.id === id ? { ...s, shareActive: false } : s);
    const res = await disableShareEstudio(id);
    if (!res.ok) {
      window.alert(`No se pudo desactivar el enlace: ${res.error}`);
      setEstudios(prev => prev.map(x => x.id === id ? { ...x, shareActive: true } : x));
      setSelected(s => s && s.id === id ? { ...s, shareActive: true } : s);
    }
  };

  const handleRegenerateShare = async (id: string) => {
    const ok = window.confirm(
      "¿Regenerar el enlace? El enlace anterior dejará de funcionar inmediatamente.",
    );
    if (!ok) return;
    const res = await regenerateShareEstudio(id);
    if (!res.ok) {
      window.alert(`No se pudo regenerar: ${res.error}`);
      return;
    }
    const slug = res.share_slug;
    setEstudios(prev => prev.map(x => x.id === id ? { ...x, shareSlug: slug, shareActive: true } : x));
    setSelected(s => s && s.id === id ? { ...s, shareSlug: slug, shareActive: true } : s);
  };

  const columnasDef: ToolbarColumna[] = [
    { campo: "nombre", label: "Nombre" },
    { campo: "ciudad", label: "Ciudad" },
    { campo: "zona", label: "Zona" },
    { campo: "ventas", label: "Ventas" },
    { campo: "creado", label: "Creado" },
  ];

  return (
    <div className="p-6 space-y-6">
      {confirmDeleteDialog}
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={() => setShowNew(true)}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        orden={orden}
        onOrdenChange={setOrden}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <Button
            size="icon"
            variant={showConfig ? "default" : "outline"}
            className="h-9 w-9"
            onClick={() => setShowConfig((v) => !v)}
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        }
      />

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo estudio de apertura</DialogTitle></DialogHeader>
          <NuevoEstudioForm
            onSave={async (e, fotoFile) => {
              const res = await createEstudioApertura({
                datos: e.datos,
                facturacion: e.facturacion,
                costes: e.costes,
                procedencia: e.procedencia,
                destinos: e.destinos,
                amortizacion: e.amortizacion,
              });
              if (!res.ok) {
                console.error("[aperturas] create:", res.error);
                return;
              }
              const nuevoEstudio = rowToEstudio(res.data);
              setEstudios(prev => [nuevoEstudio, ...prev]);
              setShowNew(false);

              if (fotoFile) {
                try {
                  const prep = await prepararFotoParaSubida(fotoFile);
                  if (!prep.ok) {
                    window.alert(prep.error);
                    return;
                  }
                  setEstudios(prev => prev.map(x => x.id === nuevoEstudio.id ? { ...x, imagen: prep.dataUrl } : x));
                  const up = await uploadFotoEstudio({
                    estudioId: nuevoEstudio.id,
                    fileBase64: prep.dataUrl,
                    fileType: prep.tipo,
                    fileSize: prep.tamano,
                  });
                  if (!up.ok) {
                    console.error("[aperturas] uploadFoto:", up.error);
                    window.alert(`No se pudo subir la imagen: ${up.error}`);
                    setEstudios(prev => prev.map(x => x.id === nuevoEstudio.id ? { ...x, imagen: undefined } : x));
                    return;
                  }
                  setEstudios(prev => prev.map(x => x.id === nuevoEstudio.id ? { ...x, imagen: up.foto_url } : x));
                } catch (err) {
                  console.error("[aperturas] uploadFoto threw:", err);
                  window.alert("No se pudo subir la imagen. Prueba con un archivo más pequeño.");
                  setEstudios(prev => prev.map(x => x.id === nuevoEstudio.id ? { ...x, imagen: undefined } : x));
                }
              }
            }}
            onClose={() => setShowNew(false)}
          />
        </DialogContent>
      </Dialog>

      {loading && (
        <p className="text-sm text-muted-foreground">Cargando estudios…</p>
      )}
      {!loading && loadError && (
        <p className="text-sm text-red-600">Error: {loadError}</p>
      )}
      {!loading && !loadError && estudiosFiltrados.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {estudios.length === 0
            ? 'Aún no hay estudios. Crea el primero con "+ Nuevo".'
            : "Ningún estudio coincide con los filtros."}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {estudiosFiltrados.map(e => {
          const ventasEstudio = totalFacturacion(e.facturacion);
          const esc = calcularEscenario(ventasEstudio, 1, e.costes);
          const inversionTotal = e.procedencia.reduce((s, l) => s + (l.total || 0), 0);
          const facturacionMensual = ventasEstudio;
          const facturacionAnual = facturacionMensual * 12;
          const beneficioMensual = esc.beneficio;
          const beneficioAnual = beneficioMensual * 12;
          const tieneInversion = inversionTotal > 0;
          const recuperaInversion = tieneInversion && beneficioMensual > 0;
          const roiAnualPct = tieneInversion ? (beneficioAnual / inversionTotal) * 100 : 0;
          const margenAnualPct = facturacionAnual > 0 ? (beneficioAnual / facturacionAnual) * 100 : 0;
          return (
            <Card key={e.id} className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden flex flex-col" onClick={() => setSelected(e)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{e.datos.nombre}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{e.datos.ciudad} — {e.datos.zona}</p>
                  </div>
                  <div className="flex items-start gap-1.5 shrink-0" onClick={(ev) => ev.stopPropagation()}>
                    <ShareMenu
                      slug={e.shareSlug ?? null}
                      active={Boolean(e.shareActive)}
                      onEnable={() => handleEnableShare(e.id)}
                      onDisable={() => handleDisableShare(e.id)}
                      onRegenerate={() => handleRegenerateShare(e.id)}
                    />
                    <div className="flex flex-col items-end gap-1.5">
                      <EstadoBadgeMenu
                        value={e.viabilidad}
                        options={[
                          { value: "viable", label: "Viable", className: "bg-green-500 text-white hover:bg-green-600" },
                          { value: "no_viable", label: "No viable", className: "bg-red-500 text-white hover:bg-red-600" },
                        ]}
                        onChange={(v) => setViabilidad(e.id, v as EstadoViabilidad)}
                      />
                      <EstadoBadgeMenu
                        value={e.actividad}
                        options={[
                          { value: "activo", label: "Activo", className: "bg-blue-500 text-white hover:bg-blue-600" },
                          { value: "no_activo", label: "No activo", className: "bg-gray-400 text-white hover:bg-gray-500" },
                        ]}
                        onChange={(v) => setActividad(e.id, v as EstadoActividad)}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5">
                  <span className="text-xs text-muted-foreground">Inversión total</span>
                  <strong className="text-sm">{tieneInversion ? `${fmt(inversionTotal)}€` : "—"}</strong>
                </div>
                <div className="space-y-1 text-xs px-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Facturación / mes</span>
                    <span className="font-medium">{fmt(facturacionMensual)}€</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Facturación / año</span>
                    <span className="font-medium">{fmt(facturacionAnual)}€</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-muted-foreground">Beneficio / año</span>
                    <span className={`font-semibold ${beneficioAnual >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(beneficioAnual)}€</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">% Beneficio / año</span>
                    <span className={`font-semibold ${facturacionAnual > 0 && margenAnualPct >= 0 ? "text-green-600" : facturacionAnual > 0 ? "text-red-600" : ""}`}>
                      {facturacionAnual > 0 ? `${margenAnualPct.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ROI anual</span>
                    <span className={`font-semibold ${tieneInversion && roiAnualPct >= 0 ? "text-green-600" : tieneInversion ? "text-red-600" : ""}`}>
                      {tieneInversion ? `${roiAnualPct.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recuperación</span>
                    <span className="font-medium">
                      {recuperaInversion ? formatRecuperacion(inversionTotal / beneficioMensual) : "—"}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Creado: {e.creado}</p>
              </CardContent>
              <div className="mt-auto px-4 pb-4" onClick={(ev) => ev.stopPropagation()}>
                {e.imagen ? (
                  <div className="relative group">
                    <img
                      src={e.imagen}
                      alt={e.datos.nombre}
                      className="w-full h-32 object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImagen(e.id)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/80"
                      title="Quitar imagen"
                      aria-label="Quitar imagen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-1 h-32 w-full rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer text-xs">
                    <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
                    <span>Añadir foto del proyecto</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(ev) => {
                        const file = ev.target.files?.[0];
                        if (file) onUploadImagen(e.id, file);
                        ev.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ── Selector de estado tipo badge con dropdown ── */
type EstadoBadgeOption = { value: string; label: string; className: string };

function EstadoBadgeMenu({
  value,
  options,
  onChange,
}: {
  value: string;
  options: EstadoBadgeOption[];
  onChange: (next: string) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            current.className,
          )}
        >
          {current.label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={(ev) => {
              ev.preventDefault();
              onChange(o.value);
            }}
          >
            <span className={cn("mr-2 h-2.5 w-2.5 rounded-full", o.className)} />
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Menú de compartir: estado + acciones (copiar / desactivar / regenerar) ── */
function ShareMenu({
  slug,
  active,
  onEnable,
  onDisable,
  onRegenerate,
}: {
  slug: string | null;
  active: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => {
    if (!slug || typeof window === "undefined") return "";
    return `${window.location.origin}/p/${slug}`;
  }, [slug]);

  const isOn = active && !!slug;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copia el enlace:", url);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={isOn ? "Enlace público activo" : "Compartir"}
          aria-label={isOn ? "Enlace público activo" : "Compartir"}
          className={cn(
            "inline-flex items-center justify-center rounded-full p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {isOn ? <Link2 className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {!isOn ? (
          <>
            <div className="px-2 py-2 text-xs text-muted-foreground">
              Genera un enlace de solo lectura para compartir este estudio.
            </div>
            <DropdownMenuItem
              onSelect={(ev) => { ev.preventDefault(); onEnable(); }}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Activar enlace público
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <div className="px-2 py-2 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Enlace público</div>
              <div className="text-xs break-all rounded bg-muted px-2 py-1.5 font-mono">{url}</div>
            </div>
            <DropdownMenuItem onSelect={(ev) => { ev.preventDefault(); void copy(); }}>
              {copied ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "¡Copiado!" : "Copiar enlace"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(ev) => { ev.preventDefault(); onRegenerate(); }}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerar (rompe el actual)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(ev) => { ev.preventDefault(); onDisable(); }}
              className="text-red-600 focus:text-red-700"
            >
              <EyeOff className="mr-2 h-4 w-4" />
              Desactivar enlace
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Detalle completo del estudio ── */
type Periodo = "mensual" | "trimestral" | "anual";
const PERIODO_FACTOR: Record<Periodo, number> = { mensual: 1, trimestral: 3, anual: 12 };
const PERIODO_SUFIJO: Record<Periodo, string> = { mensual: "/mes", trimestral: "/trim.", anual: "/año" };

type KpiKey = "facturacion" | "costeTotal" | "beneficio" | "margen";

function DetalleEstudio({
  estudio,
  onBack,
  onUpdate,
  onSetViabilidad,
  onSetActividad,
  onEnableShare,
  onDisableShare,
  onRegenerateShare,
  onUploadPortada,
  onRemovePortada,
}: {
  estudio: EstudioApertura;
  onBack: () => void;
  onUpdate: (e: EstudioApertura, opts?: { flush?: boolean; suppressSave?: boolean }) => void;
  onSetViabilidad: (v: EstadoViabilidad) => void;
  onSetActividad: (v: EstadoActividad) => void;
  onEnableShare: () => void;
  onDisableShare: () => void;
  onRegenerateShare: () => void;
  onUploadPortada: (file: File) => void;
  onRemovePortada: () => void;
}) {
  const { empresaActual } = useEmpresa();
  const [costes, setCostes] = useState<EstructuraCostes>(estudio.costes);
  const [facturacion, setFacturacion] = useState<EstructuraFacturacion>(estudio.facturacion);
  const [periodo, setPeriodo] = useState<Periodo>("mensual");

  /* ── Modo Presentación (PRP-038, Fase 7) ── */
  const [modoPresentacion, setModoPresentacion] = useState(false);

  /* ── Estado del flujo "Rellenar con IA" (PRP-038) ── */
  const [iaDraft, setIaDraft] = useState<DraftIAEstudio>({});
  const [iaSnapshot, setIaSnapshot] = useState<EstudioApertura | null>(null);
  type IaDialogState =
    | { tipo: "bloque"; bloque: BloqueIAKey }
    | { tipo: "completa" }
    | null;
  const [iaDialogState, setIaDialogState] = useState<IaDialogState>(null);
  const iaDialogOpen = iaDialogState !== null;
  const hayDraftIA = Object.keys(iaDraft).length > 0;
  const numBloquesDraft = Object.keys(iaDraft).length;

  const recibirDraftIA = useCallback(
    (draft: DraftIAEstudio, _bloques: BloqueIAAnyKey[]) => {
      // Snapshot solo la primera vez (para "Descartar")
      setIaSnapshot((prev) => prev ?? estudio);
      setIaDraft((prev) => ({ ...prev, ...draft }));
      // Aplica el draft al estudio sin disparar scheduleSave
      const merged = aplicarDraftCompleto(estudio, draft);
      onUpdate(merged, { suppressSave: true });
    },
    [estudio, onUpdate],
  );

  const limpiarBloqueIA = useCallback((bloque: keyof DraftIAEstudio) => {
    setIaDraft((prev) => {
      if (!(bloque in prev)) return prev;
      const next = { ...prev };
      delete next[bloque];
      // Si ya no queda nada en draft, liberar snapshot
      if (Object.keys(next).length === 0) setIaSnapshot(null);
      return next;
    });
  }, []);

  const clearIaField = useCallback((bloque: keyof DraftIAEstudio, campo: string) => {
    setIaDraft((prev) => {
      const bloqueDraft = prev[bloque] as Record<string, unknown> | undefined;
      if (!bloqueDraft || !(campo in bloqueDraft)) return prev;
      const nuevoBloque = { ...bloqueDraft };
      delete nuevoBloque[campo];
      const next = { ...prev };
      if (Object.keys(nuevoBloque).length === 0) {
        delete next[bloque];
      } else {
        (next as Record<string, unknown>)[bloque] = nuevoBloque;
      }
      if (Object.keys(next).length === 0) setIaSnapshot(null);
      return next;
    });
  }, []);

  const aceptarBloqueIA = useCallback(
    (bloque: keyof DraftIAEstudio) => {
      // El estudio ya está mergeado en memoria → solo flush y limpiar
      onUpdate(estudio, { flush: true });
      limpiarBloqueIA(bloque);
    },
    [estudio, onUpdate, limpiarBloqueIA],
  );

  const descartarBloqueIA = useCallback(
    (bloque: keyof DraftIAEstudio) => {
      // Restaurar el campo correspondiente del snapshot pre-IA
      if (iaSnapshot) {
        let restaurado: EstudioApertura = estudio;
        if (bloque === "datos") restaurado = { ...restaurado, datos: iaSnapshot.datos };
        else if (bloque === "local") restaurado = { ...restaurado, local: iaSnapshot.local };
        else if (bloque === "marca") restaurado = { ...restaurado, imagenMarca: iaSnapshot.imagenMarca };
        else if (bloque === "gastronomia") restaurado = { ...restaurado, propuesta: iaSnapshot.propuesta };
        else if (bloque === "ocupacion") restaurado = { ...restaurado, ocupacion: iaSnapshot.ocupacion };
        onUpdate(restaurado, { suppressSave: true });
      }
      limpiarBloqueIA(bloque);
    },
    [estudio, iaSnapshot, onUpdate, limpiarBloqueIA],
  );

  const aceptarTodoIA = useCallback(() => {
    // El estudio ya tiene todos los drafts mergeados en memoria → flush y limpiar
    onUpdate(estudio, { flush: true });
    setIaDraft({});
    setIaSnapshot(null);
  }, [estudio, onUpdate]);

  const descartarTodoIA = useCallback(() => {
    if (iaSnapshot) {
      onUpdate(iaSnapshot, { suppressSave: true });
    }
    setIaDraft({});
    setIaSnapshot(null);
  }, [iaSnapshot, onUpdate]);

  const [hoveredKpi, setHoveredKpi] = useState<KpiKey | null>(null);
  const [facturacionPeriodo, setFacturacionPeriodo] = useState<Periodo>("mensual");
  const [costesPeriodo, setCostesPeriodo] = useState<Periodo>("mensual");
  const [facturacionTab, setFacturacionTab] = useState<"facturacion" | "ocupacion" | "ticket">("facturacion");
  const [costesTab, setCostesTab] = useState<"pilares" | "equilibrio">("pilares");
  const [mainTab, setMainTab] = useState<"datos" | "concepto" | "facturacion" | "costes" | "escenarios" | "inversion">("datos");
  const [expandEscFact, setExpandEscFact] = useState(false);
  const [expandEscCostes, setExpandEscCostes] = useState(false);
  const factor = PERIODO_FACTOR[periodo];
  const sufijo = PERIODO_SUFIJO[periodo];
  const inversionTotal = estudio.procedencia.reduce((s, l) => s + (l.total || 0), 0);
  const ventas = totalFacturacion(facturacion);
  const clientesMes = totalClientes(facturacion);
  const ticketPond = ticketMedioPonderado(facturacion);

  const setPilar = (key: PilarKey, pilar: CostePilar) => {
    const next = { ...costes, [key]: pilar };
    setCostes(next);
    onUpdate({ ...estudio, costes: next });
  };

  const setPilarFact = (key: FactPilarKey, pilar: FacturacionPilar) => {
    const next: EstructuraFacturacion = { ...facturacion, [key]: pilar };
    setFacturacion(next);
    onUpdate({ ...estudio, facturacion: next });
  };

  const updatePartidaFact = (
    key: FactPilarKey,
    partidaId: string,
    field: keyof Omit<PartidaFacturacion, "id">,
    val: string | number,
  ) => {
    const pilar = facturacion[key];
    const partidas = pilar.partidas.map((p) => (p.id === partidaId ? { ...p, [field]: val } : p));
    setPilarFact(key, { ...pilar, partidas });
  };

  const addPartidaFact = (key: FactPilarKey) => {
    const pilar = facturacion[key];
    setPilarFact(key, { ...pilar, partidas: [...pilar.partidas, nuevaPartidaFacturacion()] });
  };

  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const removePartidaFact = async (key: FactPilarKey, partidaId: string) => {
    const pilar = facturacion[key];
    const partida = pilar.partidas.find((p) => p.id === partidaId);
    const ok = await confirmDelete({
      title: "¿Borrar esta partida de facturación?",
      description: partida?.nombre
        ? `Se eliminará "${partida.nombre}". Esta acción no se puede deshacer.`
        : "Se eliminará la partida. Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    setPilarFact(key, { ...pilar, partidas: pilar.partidas.filter((p) => p.id !== partidaId) });
  };

  const updatePartida = (key: PilarKey, partidaId: string, field: keyof Omit<PartidaCoste, "id">, val: string | number) => {
    const pilar = costes[key];
    const partidas = pilar.partidas.map((p) => (p.id === partidaId ? { ...p, [field]: val } : p));
    setPilar(key, { ...pilar, partidas });
  };

  const addPartida = (key: PilarKey) => {
    const pilar = costes[key];
    setPilar(key, { ...pilar, partidas: [...pilar.partidas, nuevaPartida()] });
  };

  const removePartida = async (key: PilarKey, partidaId: string) => {
    const pilar = costes[key];
    const partida = pilar.partidas.find((p) => p.id === partidaId);
    const ok = await confirmDelete({
      title: "¿Borrar esta partida de costes?",
      description: partida?.nombre
        ? `Se eliminará "${partida.nombre}". Esta acción no se puede deshacer.`
        : "Se eliminará la partida. Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    setPilar(key, { ...pilar, partidas: pilar.partidas.filter((p) => p.id !== partidaId) });
  };

  const escenarios = ESCENARIOS.map(e => {
    const r = calcularEscenario(ventas, e.factor, costes);
    return { ...e, ...r };
  });

  const medio = escenarios[2];
  const fijoTotal = pilarFijo(costes.generales) + pilarFijo(costes.personal) + pilarFijo(costes.producto) + pilarFijo(costes.marketing);
  const variablePctTotal = pilarVariablePct(costes.generales) + pilarVariablePct(costes.personal) + pilarVariablePct(costes.producto) + pilarVariablePct(costes.marketing);

  const pieData = [
    { name: "Generales", value: calcularPilar(ventas, costes.generales) },
    { name: "Personal", value: calcularPilar(ventas, costes.personal) },
    { name: "Producto", value: calcularPilar(ventas, costes.producto) },
    { name: "Marketing", value: calcularPilar(ventas, costes.marketing) },
  ];

  const sensibilidadData = Array.from({ length: 9 }, (_, i) => {
    const f = 0.6 + i * 0.1;
    const r = calcularEscenario(ventas, f, costes);
    return { facturacion: fmt(r.facturacion), beneficio: r.beneficio, margen: parseFloat(r.margen.toFixed(1)) };
  });

  const peMensual = variablePctTotal < 100 ? fijoTotal / (1 - variablePctTotal / 100) : Infinity;
  const peAnual = peMensual * 12;

  const donutBase: { name: string; value: number; group: "costes" | "beneficio"; color: string }[] = [
    { name: "Generales", value: pieData[0].value, group: "costes", color: PILAR_COLORS[0] },
    { name: "Personal", value: pieData[1].value, group: "costes", color: PILAR_COLORS[1] },
    { name: "Producto", value: pieData[2].value, group: "costes", color: PILAR_COLORS[2] },
    { name: "Marketing", value: pieData[3].value, group: "costes", color: PILAR_COLORS[3] },
  ];
  if (medio.beneficio > 0) {
    donutBase.push({ name: "Beneficio", value: medio.beneficio, group: "beneficio", color: "hsl(142 80% 42%)" });
  }
  const donutData = donutBase.map((d) => ({ ...d, value: d.value * factor }));
  const beneficioIndex = donutData.findIndex((d) => d.group === "beneficio");

  const isDonutActive = (group: "costes" | "beneficio") => {
    if (!hoveredKpi) return true;
    if (hoveredKpi === "facturacion") return true;
    if (hoveredKpi === "costeTotal") return group === "costes";
    return group === "beneficio";
  };

  return (
    <div className="p-6 space-y-6">
      {confirmDeleteDialog}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{estudio.datos.nombre}</h1>
          <p className="text-muted-foreground text-sm truncate">{estudio.datos.ciudad} — {estudio.datos.zona}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {/* Toggle Software / Presentación */}
          <div className="inline-flex rounded-md border bg-muted/50 p-0.5">
            <button
              type="button"
              onClick={() => setModoPresentacion(false)}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 h-7 text-xs font-medium transition-colors ${
                !modoPresentacion
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MonitorIcon className="h-3 w-3" />
              Software
            </button>
            <button
              type="button"
              onClick={() => setModoPresentacion(true)}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 h-7 text-xs font-medium transition-colors ${
                modoPresentacion
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PresentationIcon className="h-3 w-3" />
              Presentación
            </button>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setIaDialogState({ tipo: "completa" })}
            className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
            title="Genera todas las pestañas a la vez con un prompt o documentos"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generar apertura completa
          </Button>
          <EstadoBadgeMenu
            value={estudio.viabilidad}
            options={[
              { value: "viable", label: "Viable", className: "bg-green-500 text-white hover:bg-green-600" },
              { value: "no_viable", label: "No viable", className: "bg-red-500 text-white hover:bg-red-600" },
            ]}
            onChange={(v) => onSetViabilidad(v as EstadoViabilidad)}
          />
          <EstadoBadgeMenu
            value={estudio.actividad}
            options={[
              { value: "activo", label: "Activo", className: "bg-blue-500 text-white hover:bg-blue-600" },
              { value: "no_activo", label: "No activo", className: "bg-gray-400 text-white hover:bg-gray-500" },
            ]}
            onChange={(v) => onSetActividad(v as EstadoActividad)}
          />
          <ShareMenu
            slug={estudio.shareSlug ?? null}
            active={Boolean(estudio.shareActive)}
            onEnable={onEnableShare}
            onDisable={onDisableShare}
            onRegenerate={onRegenerateShare}
          />
        </div>
      </div>

      {hayDraftIA && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <Sparkles className="h-4 w-4" />
            <span>
              <strong>{numBloquesDraft}</strong> bloque{numBloquesDraft === 1 ? "" : "s"} con sugerencias IA sin confirmar. Revisa cada pestaña o decide globalmente:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={descartarTodoIA}
              className="gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100"
            >
              Descartar todo
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={aceptarTodoIA}
              className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
            >
              <Check className="h-3.5 w-3.5" />
              Aceptar todo
            </Button>
          </div>
        </div>
      )}

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
        <div className="flex items-center justify-between gap-3">
          <TabsList className="h-11 gap-1 rounded-xl border bg-muted/50 p-1 shadow-sm">
            <TabsTrigger
              value="datos"
              className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <FileText className="h-4 w-4" />Datos
            </TabsTrigger>
            <TabsTrigger
              value="concepto"
              className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Lightbulb className="h-4 w-4" />Concepto
            </TabsTrigger>
            <TabsTrigger
              value="facturacion"
              className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Receipt className="h-4 w-4" />Facturación
            </TabsTrigger>
            <TabsTrigger
              value="costes"
              className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Calculator className="h-4 w-4" />Costes
            </TabsTrigger>
            <TabsTrigger
              value="escenarios"
              className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <TrendingUp className="h-4 w-4" />Escenarios
            </TabsTrigger>
            <TabsTrigger
              value="inversion"
              className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Landmark className="h-4 w-4" />Inversión
            </TabsTrigger>
          </TabsList>
          {mainTab === "escenarios" && (
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* ── ESCENARIOS (Resumen ejecutivo + Tabla + Gráficas) ── */}
        <TabsContent value="escenarios" className="space-y-8">

          {/* ── 1. Resumen ejecutivo ── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Resumen ejecutivo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card
              className={`cursor-default transition-all ${hoveredKpi === "facturacion" ? "ring-2 ring-primary shadow-md" : ""}`}
              onMouseEnter={() => setHoveredKpi("facturacion")}
              onMouseLeave={() => setHoveredKpi(null)}
            >
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{fmt(medio.facturacion * factor)}€</p>
                <p className="text-xs text-muted-foreground">Facturación estimada</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-default transition-all ${hoveredKpi === "costeTotal" ? "ring-2 ring-primary shadow-md" : ""}`}
              onMouseEnter={() => setHoveredKpi("costeTotal")}
              onMouseLeave={() => setHoveredKpi(null)}
            >
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{fmt(medio.costeTotal * factor)}€</p>
                <p className="text-xs text-muted-foreground">Coste total</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-default transition-all ${hoveredKpi === "beneficio" ? "ring-2 ring-primary shadow-md" : ""}`}
              onMouseEnter={() => setHoveredKpi("beneficio")}
              onMouseLeave={() => setHoveredKpi(null)}
            >
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${medio.beneficio >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(medio.beneficio * factor)}€</p>
                <p className="text-xs text-muted-foreground">Beneficio estimado</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-default transition-all ${hoveredKpi === "margen" ? "ring-2 ring-primary shadow-md" : ""}`}
              onMouseEnter={() => setHoveredKpi("margen")}
              onMouseLeave={() => setHoveredKpi(null)}
            >
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${medio.margen >= 0 ? "text-green-600" : "text-red-600"}`}>{medio.margen.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Margen</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className={`transition-all ${hoveredKpi ? "ring-1 ring-primary/40" : ""}`}>
              <CardHeader>
                <CardTitle className="text-base">Estructura {sufijo}</CardTitle>
                <p className="text-xs text-muted-foreground">Pasa el cursor por los KPI de arriba para resaltar segmentos.</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      isAnimationActive={false}
                      activeIndex={beneficioIndex >= 0 ? beneficioIndex : undefined}
                      activeShape={((props: unknown) => {
                        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, fillOpacity } = props as { cx: number; cy: number; innerRadius: number; outerRadius: number; startAngle: number; endAngle: number; fill: string; fillOpacity?: number };
                        return (
                          <g style={{ filter: "drop-shadow(0 0 10px rgba(34,197,94,0.55)) drop-shadow(0 0 4px rgba(34,197,94,0.45))" }}>
                            <Sector
                              cx={cx}
                              cy={cy}
                              innerRadius={innerRadius}
                              outerRadius={outerRadius + 10}
                              startAngle={startAngle}
                              endAngle={endAngle}
                              fill={fill}
                              fillOpacity={fillOpacity ?? 1}
                              stroke="hsl(var(--background))"
                              strokeWidth={2}
                            />
                          </g>
                        );
                      }) as unknown as import("recharts").PieProps["activeShape"]}
                    >
                      {donutData.map((d, i) => {
                        const active = isDonutActive(d.group);
                        return (
                          <Cell
                            key={i}
                            fill={d.color}
                            fillOpacity={active ? 1 : 0.2}
                            stroke={hoveredKpi && active ? "hsl(var(--background))" : "transparent"}
                            strokeWidth={2}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                    <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Lectura de viabilidad</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  {medio.beneficio >= 0 ? <TrendingUp className="h-6 w-6 text-green-600" /> : <TrendingDown className="h-6 w-6 text-red-600" />}
                  <div>
                    <p className="font-semibold">{medio.beneficio >= 0 ? "Proyecto viable en escenario estimado" : "Proyecto no viable en escenario estimado"}</p>
                    <p className="text-sm text-muted-foreground">{escenarios.filter(e => e.beneficio > 0).length} de 5 escenarios son rentables.</p>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Punto de equilibrio</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Mensual</p>
                      <p className="text-lg font-semibold">{Number.isFinite(peMensual) ? `${fmt(peMensual)}€` : "—"}</p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Anual</p>
                      <p className="text-lg font-semibold">{Number.isFinite(peAnual) ? `${fmt(peAnual)}€` : "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 pt-3 border-t">
                  {pieData.map((p) => (
                    <div key={p.name} className="text-center">
                      <p className="text-sm font-bold">{fmt(p.value * factor)}€</p>
                      <p className="text-[10px] text-muted-foreground">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">({medio.facturacion > 0 ? ((p.value / medio.facturacion) * 100).toFixed(0) : 0}%)</p>
                    </div>
                  ))}
                  <div className="text-center">
                    <p className={`text-sm font-bold ${medio.beneficio >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(medio.beneficio * factor)}€</p>
                    <p className="text-[10px] text-muted-foreground">Beneficio</p>
                    <p className="text-[10px] text-muted-foreground">({medio.margen.toFixed(0)}%)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          </section>

          {/* ── 2. Tabla de escenarios ── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Tabla de escenarios</h2>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                {(() => {
                  const tieneInversion = inversionTotal > 0;
                  return (
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium">Escenario</th>
                    {expandEscFact && lineasPlanas(facturacion).map((l) => (
                      <th key={l.id} className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">{l.nombre}</th>
                    ))}
                    <th className="text-right p-3 font-medium whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setExpandEscFact((v) => !v)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        aria-label={expandEscFact ? "Ocultar líneas de facturación" : "Ver líneas de facturación"}
                      >
                        Facturación
                        {expandEscFact ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    </th>
                    {expandEscCostes && (
                      <>
                        <th className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">Costes fijos</th>
                        <th className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">Costes variables</th>
                      </>
                    )}
                    <th className="text-right p-3 font-medium whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setExpandEscCostes((v) => !v)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        aria-label={expandEscCostes ? "Ocultar desglose de costes" : "Ver desglose de costes"}
                      >
                        Coste total
                        {expandEscCostes ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium">Beneficio</th>
                    <th className="text-right p-3 font-medium">Margen</th>
                    <th className="text-right p-3 font-medium whitespace-nowrap">ROI</th>
                    <th className="text-right p-3 font-medium whitespace-nowrap">Recuperación</th>
                  </tr></thead>
                  <tbody>
                    {escenarios.map((e) => {
                      const factPeriodo = e.facturacion * factor;
                      const fijoPeriodo = e.fijoTotal * factor;
                      const varPeriodo = e.varTotal * factor;
                      const costePeriodo = e.costeTotal * factor;
                      const beneficioPeriodo = e.beneficio * factor;
                      const roiPeriodoPct = tieneInversion ? (beneficioPeriodo / inversionTotal) * 100 : 0;
                      const recuperaInversion = tieneInversion && e.beneficio > 0;
                      return (
                        <tr key={e.nombre} className={`border-b ${e.nombre === "Estimado" ? "bg-primary/5" : ""}`}>
                          <td className="p-3 font-medium">{e.nombre}</td>
                          {expandEscFact && lineasPlanas(facturacion).map((l) => {
                            const lineaMensual = (l.clientesEsperados || 0) * (l.ticketMedio || 0);
                            const lineaPeriodo = lineaMensual * e.factor * factor;
                            return (
                              <td key={l.id} className="p-3 text-right text-muted-foreground">{fmt(lineaPeriodo)}€</td>
                            );
                          })}
                          <td className="p-3 text-right">{fmt(factPeriodo)}€</td>
                          {expandEscCostes && (
                            <>
                              <td className="p-3 text-right text-muted-foreground">{fmt(fijoPeriodo)}€</td>
                              <td className="p-3 text-right text-muted-foreground">{fmt(varPeriodo)}€</td>
                            </>
                          )}
                          <td className="p-3 text-right">{fmt(costePeriodo)}€</td>
                          <td className={`p-3 text-right font-semibold ${e.beneficio >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(beneficioPeriodo)}€</td>
                          <td className={`p-3 text-right ${e.margen >= 0 ? "text-green-600" : "text-red-600"}`}>{e.margen.toFixed(1)}%</td>
                          <td className={`p-3 text-right ${tieneInversion ? (roiPeriodoPct >= 0 ? "text-green-600" : "text-red-600") : "text-muted-foreground"}`}>
                            {tieneInversion ? `${roiPeriodoPct.toFixed(1)}%` : "—"}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            {recuperaInversion ? formatRecuperacion(inversionTotal / e.beneficio) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                  );
                })()}
              </CardContent>
            </Card>
          </section>

          {/* ── 3. Gráficas ── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Gráficas</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-sm">Facturación y beneficio por escenario</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={escenarios.map(e => ({ name: e.nombre, Facturación: e.facturacion, Beneficio: e.beneficio }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                      <Legend />
                      <Bar dataKey="Facturación" fill="hsl(210 70% 55%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Beneficio" fill="hsl(150 60% 45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Peso de cada pilar de coste</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={PILAR_COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Margen estimado por escenario</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={escenarios.map(e => ({ name: e.nombre, Margen: parseFloat(e.margen.toFixed(1)) }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="Margen" radius={[4, 4, 0, 0]}>
                        {escenarios.map((e, i) => <Cell key={i} fill={e.margen >= 0 ? "hsl(150 60% 45%)" : "hsl(0 70% 55%)"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Sensibilidad — beneficio vs facturación</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={sensibilidadData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="facturacion" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                      <Line type="monotone" dataKey="beneficio" stroke="hsl(150 60% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </section>
        </TabsContent>

        {/* ── DATOS DEL PROYECTO ── */}
        <TabsContent value="datos" className="space-y-2">
          <div className="flex items-center justify-end">
            <BotonRellenarIA onClick={() => setIaDialogState({ tipo: "bloque", bloque: "datos" })} />
          </div>
          <Card className={iaDraft.datos ? "ring-1 ring-amber-200" : undefined}>
            <CardContent className="p-6">
              <DatosEditor
                datos={estudio.datos}
                onChange={(datos) =>
                  onUpdate(
                    { ...estudio, datos },
                    { suppressSave: !!iaDraft.datos },
                  )
                }
                iaDraft={iaDraft.datos}
                onClearIaField={(campo) => clearIaField("datos", campo)}
              />
            </CardContent>
          </Card>
          <BarraConfirmarIA
            activo={!!iaDraft.datos}
            resumen="Hay propuesta de IA en Datos del proyecto sin confirmar."
            onAceptar={() => aceptarBloqueIA("datos")}
            onDescartar={() => descartarBloqueIA("datos")}
          />
        </TabsContent>

        {/* ── CONCEPTO (Local + Imagen de marca + Gastronomía) ── */}
        <TabsContent value="concepto">
          <Tabs defaultValue="local">
            <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="local"
                className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              >
                <Building2 className="h-4 w-4" />Local
              </TabsTrigger>
              <TabsTrigger
                value="marca"
                className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              >
                <Sparkles className="h-4 w-4" />Imagen de marca
              </TabsTrigger>
              <TabsTrigger
                value="gastronomia"
                className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              >
                <ChefHat className="h-4 w-4" />Gastronomía
              </TabsTrigger>
            </TabsList>
            <TabsContent value="local" className="mt-4 space-y-2">
              <div className="flex items-center justify-end">
                <BotonRellenarIA onClick={() => setIaDialogState({ tipo: "bloque", bloque: "local" })} />
              </div>
              <LocalTab
                estudioId={estudio.id}
                local={estudio.local}
                onChange={(local, opts) =>
                  onUpdate(
                    { ...estudio, local },
                    { ...opts, suppressSave: !!iaDraft.local },
                  )
                }
                portada={{
                  imagen: estudio.imagen,
                  nombre: estudio.datos.nombre,
                  onUpload: onUploadPortada,
                  onRemove: onRemovePortada,
                }}
                iaDraft={iaDraft.local}
                onClearIaField={(_seccion, campo) => clearIaField("local", campo)}
              />
              <BarraConfirmarIA
                activo={!!iaDraft.local}
                resumen="Hay propuesta de IA en Local sin confirmar."
                onAceptar={() => aceptarBloqueIA("local")}
                onDescartar={() => descartarBloqueIA("local")}
              />
            </TabsContent>
            <TabsContent value="marca" className="mt-4 space-y-2">
              <div className="flex items-center justify-end">
                <BotonRellenarIA onClick={() => setIaDialogState({ tipo: "bloque", bloque: "marca" })} />
              </div>
              <MarcaTab
                estudioId={estudio.id}
                marca={estudio.imagenMarca}
                onChange={(imagenMarca, opts) =>
                  onUpdate(
                    { ...estudio, imagenMarca },
                    { ...opts, suppressSave: !!iaDraft.marca },
                  )
                }
                iaDraft={iaDraft.marca}
                onClearIaField={(campo) => clearIaField("marca", campo)}
              />
              <BarraConfirmarIA
                activo={!!iaDraft.marca}
                resumen="Hay propuesta de IA en Imagen de marca sin confirmar."
                onAceptar={() => aceptarBloqueIA("marca")}
                onDescartar={() => descartarBloqueIA("marca")}
              />
            </TabsContent>
            <TabsContent value="gastronomia" className="mt-4 space-y-2">
              <div className="flex items-center justify-end">
                <BotonRellenarIA onClick={() => setIaDialogState({ tipo: "bloque", bloque: "gastronomia" })} />
              </div>
              <GastronomiaTab
                estudioId={estudio.id}
                propuesta={estudio.propuesta}
                onChange={(propuesta, opts) =>
                  onUpdate(
                    { ...estudio, propuesta },
                    { ...opts, suppressSave: !!iaDraft.gastronomia },
                  )
                }
                iaDraft={iaDraft.gastronomia}
                onClearIaField={(campo) => clearIaField("gastronomia", campo)}
              />
              <BarraConfirmarIA
                activo={!!iaDraft.gastronomia}
                resumen="Hay propuesta de IA en Gastronomía sin confirmar."
                onAceptar={() => aceptarBloqueIA("gastronomia")}
                onDescartar={() => descartarBloqueIA("gastronomia")}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── FACTURACIÓN (Facturación + Ocupación + Ticket) ── */}
        <TabsContent value="facturacion">
          <Tabs value={facturacionTab} onValueChange={(v) => setFacturacionTab(v as typeof facturacionTab)}>
            <div className="flex items-end justify-between border-b">
              <TabsList className="h-auto justify-start gap-6 rounded-none bg-transparent p-0">
                <TabsTrigger
                  value="facturacion"
                  className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
                >
                  <Layers className="h-4 w-4" />Pilares
                </TabsTrigger>
                <TabsTrigger
                  value="ocupacion"
                  className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
                >
                  <Activity className="h-4 w-4" />Ocupación
                </TabsTrigger>
                <TabsTrigger
                  value="ticket"
                  className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
                >
                  <Ticket className="h-4 w-4" />Ticket medio
                </TabsTrigger>
              </TabsList>
              {facturacionTab === "facturacion" && (
                <div className="pb-2">
                  <Select value={facturacionPeriodo} onValueChange={(v) => setFacturacionPeriodo(v as Periodo)}>
                    <SelectTrigger className="w-40 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensual">Mensual</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <TabsContent value="facturacion" className="mt-4 space-y-4">
          {(() => {
            const factFactor = PERIODO_FACTOR[facturacionPeriodo];
            return (
          <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estructura de facturación por pilares</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Despliega cada pilar para editar sus partidas. Los totales del pilar se calculan automáticamente y no son editables.
              </p>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium w-[28%]">Pilar / Partida</th>
                  <th className="text-left p-3 font-medium">Clientes esperados</th>
                  <th className="text-left p-3 font-medium">Ticket medio (€)</th>
                  <th className="text-right p-3 font-medium">Total (€)</th>
                  <th className="text-right p-3 font-medium">% del total</th>
                  <th className="w-10"></th>
                </tr></thead>
                <tbody>
                  {FACT_PILAR_KEYS.map((key) => (
                    <PilarFactBloque
                      key={key}
                      pilarKey={key}
                      label={FACT_PILAR_NAMES[key]}
                      pilar={facturacion[key]}
                      ventasTotal={ventas}
                      factor={factFactor}
                      onUpdatePartida={(partidaId, field, val) => updatePartidaFact(key, partidaId, field, val)}
                      onAddPartida={() => addPartidaFact(key)}
                      onRemovePartida={(partidaId) => removePartidaFact(key, partidaId)}
                    />
                  ))}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="p-3">TOTAL</td>
                    <td className="p-3">{fmt(clientesMes * factFactor)}</td>
                    <td className="p-3">{ticketPond.toFixed(2)}€</td>
                    <td className="p-3 text-right">{fmt(ventas * factFactor)}€</td>
                    <td className="p-3 text-right">100%</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribución de ingresos por pilar</CardTitle></CardHeader>
              <CardContent>
                {ventas > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={FACT_PILAR_KEYS
                          .map((k) => ({ name: FACT_PILAR_NAMES[k], value: pilarFactTotal(facturacion[k]), key: k }))
                          .filter((d) => d.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {FACT_PILAR_KEYS
                          .filter((k) => pilarFactTotal(facturacion[k]) > 0)
                          .map((k) => (
                            <Cell key={k} fill={FACT_PILAR_COLORS[k]} />
                          ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                    Añade clientes y ticket medio a las partidas para ver la gráfica
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Clientes vs ticket medio por partida</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={lineasPlanas(facturacion).map((l) => ({
                      name: l.nombre,
                      Clientes: l.clientesEsperados || 0,
                      Ticket: l.ticketMedio || 0,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="€" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="Clientes" fill="hsl(210 70% 55%)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="Ticket" fill="hsl(40 90% 55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          </>
            );
          })()}
            </TabsContent>

            <TabsContent value="ocupacion" className="mt-4 space-y-2">
              <div className="flex items-center justify-end">
                <BotonRellenarIA onClick={() => setIaDialogState({ tipo: "bloque", bloque: "ocupacion" })} />
              </div>
              <OcupacionTab
                ocupacion={estudio.ocupacion}
                plazasTotales={
                  (estudio.local?.caracteristicas?.plazasInterior ?? 0) +
                  (estudio.local?.caracteristicas?.plazasTerraza ?? 0)
                }
                onChange={(ocupacion, opts) =>
                  onUpdate(
                    { ...estudio, ocupacion },
                    { ...opts, suppressSave: !!iaDraft.ocupacion },
                  )
                }
                iaActiva={!!iaDraft.ocupacion}
              />
              <BarraConfirmarIA
                activo={!!iaDraft.ocupacion}
                resumen="Hay propuesta de IA en Ocupación sin confirmar."
                onAceptar={() => aceptarBloqueIA("ocupacion")}
                onDescartar={() => descartarBloqueIA("ocupacion")}
              />
            </TabsContent>

            <TabsContent value="ticket" className="mt-4">
          {/* ── TICKET MEDIO (justificación desde la propuesta gastronómica) ── */}
          {(() => {
            const platos = estudio.propuesta.platos ?? [];
            const platosConPrecio = platos.filter((p) => (p.precio || 0) > 0);
            const precioMedioPlatos = platosConPrecio.length > 0
              ? platosConPrecio.reduce((s, p) => s + p.precio, 0) / platosConPrecio.length
              : 0;
            const precioMin = platosConPrecio.length > 0 ? Math.min(...platosConPrecio.map((p) => p.precio)) : 0;
            const precioMax = platosConPrecio.length > 0 ? Math.max(...platosConPrecio.map((p) => p.precio)) : 0;

            const rangos = [
              { rango: "0-10€", min: 0, max: 10 },
              { rango: "10-20€", min: 10, max: 20 },
              { rango: "20-30€", min: 20, max: 30 },
              { rango: "30-50€", min: 30, max: 50 },
              { rango: "50€+", min: 50, max: Infinity },
            ];
            const distribucionPrecios = rangos.map((r) => ({
              rango: r.rango,
              platos: platosConPrecio.filter((p) => p.precio >= r.min && p.precio < r.max).length,
            }));

            const groupCat = new Map<string, { suma: number; count: number }>();
            platosConPrecio.forEach((p) => {
              const cat = (p.categoria || "").trim() || "Sin categoría";
              const cur = groupCat.get(cat) ?? { suma: 0, count: 0 };
              groupCat.set(cat, { suma: cur.suma + p.precio, count: cur.count + 1 });
            });
            const precioMedioPorCategoria = Array.from(groupCat.entries())
              .map(([categoria, d]) => ({
                categoria,
                precioMedio: parseFloat((d.suma / d.count).toFixed(2)),
                numPlatos: d.count,
              }))
              .sort((a, b) => b.precioMedio - a.precioMedio);

            const ticketPorPilar = FACT_PILAR_KEYS
              .map((k) => ({
                pilar: FACT_PILAR_NAMES[k],
                ticket: parseFloat(pilarFactTicketPonderado(facturacion[k]).toFixed(2)),
                clientes: pilarFactClientes(facturacion[k]),
                key: k,
              }))
              .filter((d) => d.clientes > 0);

            const cats = estudio.propuesta.categoriasVenta ?? [];
            const composicionTicket = cats
              .filter((c) => (c.porcentaje || 0) > 0)
              .map((c) => ({
                categoria: c.nombre || "Sin nombre",
                aporteTicket: parseFloat((ticketPond * (c.porcentaje || 0) / 100).toFixed(2)),
                porcentaje: c.porcentaje || 0,
              }));

            const coherencia = precioMedioPlatos > 0 && ticketPond > 0
              ? Math.abs(ticketPond - precioMedioPlatos) / precioMedioPlatos * 100
              : 0;

            return (
            <section className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Justificación del ticket medio esperado a partir de la propuesta gastronómica:
                  precios de los platos destacados, mix de categorías y comparación entre pilares.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{ticketPond.toFixed(2)}€</p>
                    <p className="text-xs text-muted-foreground">Ticket medio ponderado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{precioMedioPlatos.toFixed(2)}€</p>
                    <p className="text-xs text-muted-foreground">Precio medio platos destacados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">
                      {platosConPrecio.length > 0 ? `${precioMin.toFixed(0)}-${precioMax.toFixed(0)}€` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Rango de precios platos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{estudio.propuesta.rangoPrecioMedio || "—"}</p>
                    <p className="text-xs text-muted-foreground">Rango medio declarado</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Distribución de precios por rangos</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cuántos platos destacados caen en cada rango de precio.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {platosConPrecio.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={distribucionPrecios}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="platos" fill="hsl(210 70% 55%)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                        Añade platos destacados con precio en la propuesta gastronómica
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Precio medio por categoría de plato</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Detecta qué categorías tiran del ticket hacia arriba.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {precioMedioPorCategoria.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={precioMedioPorCategoria} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tick={{ fontSize: 11 }} unit="€" />
                          <YAxis dataKey="categoria" type="category" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => `${v}€`} />
                          <Bar dataKey="precioMedio" fill="hsl(40 90% 55%)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                        Añade platos con categoría para ver el precio medio
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Composición del ticket por categoría</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aporte de cada categoría al ticket medio según el mix de ventas declarado.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {composicionTicket.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={composicionTicket}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="categoria" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 11 }} unit="€" />
                          <Tooltip
                            formatter={(v: number, _n, props) => [
                              `${v}€ (${(props as { payload?: { porcentaje?: number } })?.payload?.porcentaje}%)`,
                              "Aporte al ticket",
                            ]}
                          />
                          <Bar dataKey="aporteTicket" radius={[4, 4, 0, 0]}>
                            {composicionTicket.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                        Define el mix de ventas en la propuesta gastronómica
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Ticket medio por pilar de facturación</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Compara el ticket esperado entre franjas, acuerdos, eventos y tienda.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {ticketPorPilar.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={ticketPorPilar}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="pilar" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 11 }} unit="€" />
                          <Tooltip formatter={(v: number) => `${v}€`} />
                          <Bar dataKey="ticket" radius={[4, 4, 0, 0]}>
                            {ticketPorPilar.map((d) => (
                              <Cell key={d.key} fill={FACT_PILAR_COLORS[d.key]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                        Añade clientes y ticket medio en las partidas de facturación
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">Lectura del ticket medio</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {ticketPond > 0 && precioMedioPlatos > 0 ? (
                    <>
                      <p className="text-muted-foreground">
                        El ticket medio ponderado de la facturación es{" "}
                        <strong className="text-foreground">{ticketPond.toFixed(2)}€</strong>{" "}
                        y el precio medio de los platos destacados es{" "}
                        <strong className="text-foreground">{precioMedioPlatos.toFixed(2)}€</strong>.
                        {coherencia < 25 ? (
                          <span className="text-green-600">
                            {" "}Hay coherencia entre carta y ticket esperado ({coherencia.toFixed(0)}% de desviación).
                          </span>
                        ) : (
                          <span className="text-yellow-600">
                            {" "}Existe una desviación del {coherencia.toFixed(0)}% entre el precio medio de la carta y el ticket esperado: revisa si el mix de ventas o los precios reflejan la realidad.
                          </span>
                        )}
                      </p>
                      {composicionTicket.length > 0 && (
                        <p className="text-muted-foreground">
                          Las categorías que más aportan al ticket son:
                          {composicionTicket
                            .slice()
                            .sort((a, b) => b.aporteTicket - a.aporteTicket)
                            .slice(0, 3)
                            .map((c, i) => (
                              <span key={c.categoria}>
                                {i === 0 ? " " : ", "}
                                <strong className="text-foreground">{c.categoria}</strong>
                                {" "}({c.aporteTicket.toFixed(2)}€)
                              </span>
                            ))}.
                        </p>
                      )}
                      {ticketPorPilar.length > 1 && (() => {
                        const max = ticketPorPilar.reduce((a, b) => (a.ticket > b.ticket ? a : b));
                        const min = ticketPorPilar.reduce((a, b) => (a.ticket < b.ticket ? a : b));
                        return (
                          <p className="text-muted-foreground">
                            Por pilar, el ticket más alto está en{" "}
                            <strong className="text-foreground">{max.pilar}</strong> ({max.ticket.toFixed(2)}€)
                            y el más bajo en{" "}
                            <strong className="text-foreground">{min.pilar}</strong> ({min.ticket.toFixed(2)}€).
                          </p>
                        );
                      })()}
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Para ver la justificación, añade ticket medio y clientes a las partidas de facturación, y precios a los platos destacados de la propuesta gastronómica.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>
            );
          })()}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── COSTES ── */}
        <TabsContent value="costes">
          <Tabs value={costesTab} onValueChange={(v) => setCostesTab(v as typeof costesTab)}>
            <div className="flex items-end justify-between border-b">
              <TabsList className="h-auto justify-start gap-6 rounded-none bg-transparent p-0">
                <TabsTrigger
                  value="pilares"
                  className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
                >
                  <Layers className="h-4 w-4" />Pilares
                </TabsTrigger>
                <TabsTrigger
                  value="equilibrio"
                  className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
                >
                  <Target className="h-4 w-4" />Punto de equilibrio
                </TabsTrigger>
              </TabsList>
              {costesTab === "pilares" && (
                <div className="pb-2">
                  <Select value={costesPeriodo} onValueChange={(v) => setCostesPeriodo(v as Periodo)}>
                    <SelectTrigger className="w-40 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensual">Mensual</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <TabsContent value="pilares" className="mt-4 space-y-4">
          {(() => {
            const cosFactor = PERIODO_FACTOR[costesPeriodo];
            return (
          <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estructura de costes por pilares</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Despliega cada pilar para editar sus partidas. Los totales del pilar se calculan automáticamente y no son editables.
              </p>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium w-[28%]">Pilar / Partida</th>
                  <th className="text-left p-3 font-medium">Coste fijo (€)</th>
                  <th className="text-left p-3 font-medium">Variable (%)</th>
                  <th className="text-left p-3 font-medium">Coste variable (estimado)</th>
                  <th className="text-left p-3 font-medium">Total</th>
                  <th className="w-10"></th>
                </tr></thead>
                <tbody>
                  {(["generales", "personal", "producto", "marketing"] as PilarKey[]).map((key, i) => (
                    <PilarBloque
                      key={key}
                      pilarKey={key}
                      label={PILAR_NAMES[i]}
                      pilar={costes[key]}
                      ventas={ventas}
                      factor={cosFactor}
                      onUpdatePartida={(partidaId, field, val) => updatePartida(key, partidaId, field, val)}
                      onAddPartida={() => addPartida(key)}
                      onRemovePartida={(partidaId) => removePartida(key, partidaId)}
                    />
                  ))}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="p-3">TOTAL</td>
                    <td className="p-3">{fmt(fijoTotal * cosFactor)}€</td>
                    <td className="p-3">{variablePctTotal.toFixed(1)}%</td>
                    <td className="p-3">{fmt(medio.varTotal * cosFactor)}€</td>
                    <td className="p-3">{fmt(medio.costeTotal * cosFactor)}€</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Peso de cada pilar de coste</CardTitle></CardHeader>
              <CardContent>
                {medio.costeTotal > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData.filter((d) => d.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.filter((d) => d.value > 0).map((d, i) => {
                          const idx = PILAR_NAMES.indexOf(d.name);
                          return <Cell key={i} fill={PILAR_COLORS[idx >= 0 ? idx : i]} />;
                        })}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                    Añade partidas a los pilares para ver la gráfica
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Coste fijo vs variable por pilar</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={(["generales", "personal", "producto", "marketing"] as PilarKey[]).map((key, i) => ({
                      name: PILAR_NAMES[i],
                      Fijo: pilarFijo(costes[key]),
                      Variable: ventas * pilarVariablePct(costes[key]) / 100,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                    <Legend />
                    <Bar dataKey="Fijo" stackId="a" fill="hsl(210 70% 55%)" />
                    <Bar dataKey="Variable" stackId="a" fill="hsl(40 90% 55%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          </>
            );
          })()}
            </TabsContent>

            <TabsContent value="equilibrio" className="mt-4 space-y-4">
              {(() => {
                const tieneCostes = fijoTotal > 0 || variablePctTotal > 0;
                const peValido = variablePctTotal < 100 && tieneCostes;
                const clientesEquilibrioMes = peValido && ticketPond > 0 ? peMensual / ticketPond : 0;
                const margenSeguridadPct = peValido && ventas > 0 ? ((ventas - peMensual) / ventas) * 100 : 0;
                const sobreEquilibrio = ventas > peMensual;
                const ventaMax = Math.max(ventas, peMensual, 1) * 1.5;
                const breakEvenData = peValido
                  ? Array.from({ length: 21 }, (_, i) => {
                      const f = (ventaMax / 20) * i;
                      return {
                        facturacion: parseFloat(f.toFixed(0)),
                        Facturación: parseFloat(f.toFixed(0)),
                        "Coste total": parseFloat((fijoTotal + (f * variablePctTotal) / 100).toFixed(0)),
                      };
                    })
                  : [];

                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">{peValido ? `${fmt(peMensual)}€` : "—"}</p>
                          <p className="text-xs text-muted-foreground">Facturación equilibrio /mes</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">{peValido ? `${fmt(peAnual)}€` : "—"}</p>
                          <p className="text-xs text-muted-foreground">Facturación equilibrio /año</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">
                            {clientesEquilibrioMes > 0 ? fmt(clientesEquilibrioMes) : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">Clientes equilibrio /mes</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p
                            className={`text-2xl font-bold ${
                              peValido && ventas > 0
                                ? sobreEquilibrio
                                  ? "text-green-600"
                                  : "text-red-600"
                                : ""
                            }`}
                          >
                            {peValido && ventas > 0 ? `${margenSeguridadPct.toFixed(1)}%` : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">Margen de seguridad</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Facturación vs coste total</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          El punto de equilibrio es el cruce entre la línea de facturación y la de coste total.
                        </p>
                      </CardHeader>
                      <CardContent>
                        {peValido ? (
                          <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={breakEvenData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="facturacion"
                                tick={{ fontSize: 11 }}
                                tickFormatter={(v) => `${fmt(v)}€`}
                              />
                              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${fmt(v)}€`} />
                              <Tooltip
                                formatter={(v: number) => `${fmt(v)}€`}
                                labelFormatter={(v) => `Facturación: ${fmt(v as number)}€`}
                              />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="Facturación"
                                stroke="hsl(210 70% 55%)"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="Coste total"
                                stroke="hsl(0 70% 55%)"
                                strokeWidth={2}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
                            {variablePctTotal >= 100
                              ? "El % variable supera el 100%: no existe punto de equilibrio"
                              : "Añade costes a los pilares para calcular el punto de equilibrio"}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Lectura del punto de equilibrio</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {peValido ? (
                          <>
                            <p className="text-muted-foreground">
                              Para cubrir todos los costes el local necesita facturar al menos{" "}
                              <strong className="text-foreground">{fmt(peMensual)}€/mes</strong>{" "}
                              ({fmt(peAnual)}€/año)
                              {ticketPond > 0 && (
                                <>
                                  , lo que equivale a{" "}
                                  <strong className="text-foreground">
                                    {fmt(clientesEquilibrioMes)} clientes/mes
                                  </strong>{" "}
                                  con el ticket medio actual de {ticketPond.toFixed(2)}€
                                </>
                              )}
                              .
                            </p>
                            {ventas > 0 &&
                              (sobreEquilibrio ? (
                                <p className="text-muted-foreground">
                                  Con la facturación estimada de{" "}
                                  <strong className="text-foreground">{fmt(ventas)}€/mes</strong>, el
                                  local opera{" "}
                                  <span className="text-green-600">
                                    {margenSeguridadPct.toFixed(1)}% por encima
                                  </span>{" "}
                                  del punto de equilibrio.
                                </p>
                              ) : (
                                <p className="text-muted-foreground">
                                  Con la facturación estimada de{" "}
                                  <strong className="text-foreground">{fmt(ventas)}€/mes</strong>, el
                                  local opera{" "}
                                  <span className="text-red-600">
                                    {Math.abs(margenSeguridadPct).toFixed(1)}% por debajo
                                  </span>{" "}
                                  del punto de equilibrio: revisa costes o ventas.
                                </p>
                              ))}
                          </>
                        ) : (
                          <p className="text-muted-foreground">
                            {variablePctTotal >= 100
                              ? "El % de costes variables supera el 100% de la facturación: cada euro vendido genera pérdida. Revisa los pilares variables."
                              : "Añade partidas con coste fijo o variable a los pilares para calcular el punto de equilibrio."}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </TabsContent>
          </Tabs>
        </TabsContent>
        {/* ── INVERSIÓN (Procedencia + Destino + Amortización) ── */}
        <TabsContent value="inversion">
          <Tabs defaultValue="procedencia">
            <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="procedencia"
                className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              >
                <Landmark className="h-4 w-4" />Procedencia
              </TabsTrigger>
              <TabsTrigger
                value="destino"
                className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              >
                <Target className="h-4 w-4" />Destino
              </TabsTrigger>
              <TabsTrigger
                value="amortizacion"
                className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              >
                <Clock className="h-4 w-4" />Amortización
              </TabsTrigger>
            </TabsList>
            <TabsContent value="procedencia" className="mt-4">
              <ProcedenciaTab
                lineas={estudio.procedencia}
                onChange={(p) => onUpdate({ ...estudio, procedencia: p })}
              />
            </TabsContent>
            <TabsContent value="destino" className="mt-4">
              <DestinoTab
                lineas={estudio.destinos}
                onChange={(d) => onUpdate({ ...estudio, destinos: d })}
                totalCapital={estudio.procedencia.reduce((s, l) => s + l.total, 0)}
              />
            </TabsContent>
            <TabsContent value="amortizacion" className="mt-4">
              <AmortizacionTab
                lineas={estudio.amortizacion}
                onChange={(a) => onUpdate({ ...estudio, amortizacion: a })}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <RellenoIADialog
        open={iaDialogOpen}
        onOpenChange={(o) => {
          if (!o) setIaDialogState(null);
        }}
        modo={iaDialogState ?? { tipo: "completa" }}
        onDraft={recibirDraftIA}
      />

      {modoPresentacion && (
        <ModoPresentacion
          estudio={estudio}
          empresaSlug={empresaActual.id}
          onExit={() => setModoPresentacion(false)}
        />
      )}
    </div>
  );
}

/* ── Bloque desplegable de pilar con sus partidas ── */
function PilarBloque({
  label,
  pilar,
  ventas,
  factor = 1,
  onUpdatePartida,
  onAddPartida,
  onRemovePartida,
}: {
  pilarKey: PilarKey;
  label: string;
  pilar: CostePilar;
  ventas: number;
  factor?: number;
  onUpdatePartida: (partidaId: string, field: keyof Omit<PartidaCoste, "id">, val: string | number) => void;
  onAddPartida: () => void;
  onRemovePartida: (partidaId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const fijo = pilarFijo(pilar);
  const variablePct = pilarVariablePct(pilar);
  const total = calcularPilar(ventas, pilar);

  return (
    <>
      <tr
        className="border-b cursor-pointer hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="p-3 font-medium">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span>{label}</span>
            <span className="text-xs text-muted-foreground font-normal">
              ({pilar.partidas.length} {pilar.partidas.length === 1 ? "partida" : "partidas"})
            </span>
          </div>
        </td>
        <td className="p-3 text-muted-foreground">{fmt(fijo * factor)}€</td>
        <td className="p-3 text-muted-foreground">{variablePct.toFixed(1)}%</td>
        <td className="p-3 text-muted-foreground">{fmt((ventas * variablePct / 100) * factor)}€</td>
        <td className="p-3 font-semibold">{fmt(total * factor)}€</td>
        <td className="p-3"></td>
      </tr>
      {open && (
        <>
          {pilar.partidas.map((p) => (
            <tr key={p.id} className="border-b bg-muted/10">
              <td className="p-2 pl-10">
                <Input
                  className="h-8 text-sm"
                  value={p.nombre}
                  onChange={(e) => onUpdatePartida(p.id, "nombre", e.target.value)}
                />
              </td>
              <td className="p-2">
                <Input
                  type="number"
                  className="h-8 w-28 text-sm"
                  value={p.fijo}
                  onChange={(e) => onUpdatePartida(p.id, "fijo", Number(e.target.value))}
                />
              </td>
              <td className="p-2">
                <Input
                  type="number"
                  step={0.5}
                  className="h-8 w-20 text-sm"
                  value={p.variablePct}
                  onChange={(e) => onUpdatePartida(p.id, "variablePct", Number(e.target.value))}
                />
              </td>
              <td className="p-2 text-muted-foreground">{fmt((ventas * p.variablePct / 100) * factor)}€</td>
              <td className="p-2">{fmt((p.fijo + ventas * p.variablePct / 100) * factor)}€</td>
              <td className="p-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-red-600"
                  onClick={() => onRemovePartida(p.id)}
                  title="Eliminar partida"
                  aria-label="Eliminar partida"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
          <tr className="border-b bg-muted/10">
            <td colSpan={6} className="p-2 pl-10">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={onAddPartida}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Añadir partida a {label}
              </Button>
            </td>
          </tr>
        </>
      )}
    </>
  );
}

/* ── Pilar de facturación: cabecera colapsable + partidas ── */
function PilarFactBloque({
  pilarKey: _pilarKey,
  label,
  pilar,
  ventasTotal,
  factor = 1,
  onUpdatePartida,
  onAddPartida,
  onRemovePartida,
}: {
  pilarKey: FactPilarKey;
  label: string;
  pilar: FacturacionPilar;
  ventasTotal: number;
  factor?: number;
  onUpdatePartida: (partidaId: string, field: keyof Omit<PartidaFacturacion, "id">, val: string | number) => void;
  onAddPartida: () => void;
  onRemovePartida: (partidaId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const clientesPilar = pilarFactClientes(pilar);
  const totalPilar = pilarFactTotal(pilar);
  const ticketPilar = pilarFactTicketPonderado(pilar);
  const pctPilar = ventasTotal > 0 ? (totalPilar / ventasTotal) * 100 : 0;

  return (
    <>
      <tr
        className="border-b cursor-pointer hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="p-3 font-medium">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span>{label}</span>
            <span className="text-xs text-muted-foreground font-normal">
              ({pilar.partidas.length} {pilar.partidas.length === 1 ? "partida" : "partidas"})
            </span>
          </div>
        </td>
        <td className="p-3 text-muted-foreground">{fmt(clientesPilar * factor)}</td>
        <td className="p-3 text-muted-foreground">{ticketPilar.toFixed(2)}€</td>
        <td className="p-3 text-right font-semibold">{fmt(totalPilar * factor)}€</td>
        <td className="p-3 text-right text-muted-foreground">{pctPilar.toFixed(1)}%</td>
        <td className="p-3"></td>
      </tr>
      {open && (
        <>
          {pilar.partidas.map((p) => {
            const total = (p.clientesEsperados || 0) * (p.ticketMedio || 0);
            const pct = ventasTotal > 0 ? (total / ventasTotal) * 100 : 0;
            return (
              <tr key={p.id} className="border-b bg-muted/10">
                <td className="p-2 pl-10">
                  <Input
                    className="h-8 text-sm"
                    value={p.nombre}
                    onChange={(e) => onUpdatePartida(p.id, "nombre", e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    className="h-8 w-32 text-sm"
                    value={p.clientesEsperados || ""}
                    onChange={(e) => onUpdatePartida(p.id, "clientesEsperados", Number(e.target.value))}
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    step={0.5}
                    className="h-8 w-28 text-sm"
                    value={p.ticketMedio || ""}
                    onChange={(e) => onUpdatePartida(p.id, "ticketMedio", Number(e.target.value))}
                  />
                </td>
                <td className="p-2 text-right font-medium">{fmt(total * factor)}€</td>
                <td className="p-2 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                <td className="p-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-red-600"
                    onClick={() => onRemovePartida(p.id)}
                    title="Eliminar partida"
                    aria-label="Eliminar partida"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
          <tr className="border-b bg-muted/10">
            <td colSpan={6} className="p-2 pl-10">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={onAddPartida}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Añadir partida a {label}
              </Button>
            </td>
          </tr>
        </>
      )}
    </>
  );
}

/* ── Editor inline de datos del proyecto ── */
function DatosEditor({
  datos,
  onChange,
  iaDraft,
  onClearIaField,
}: {
  datos: DatosProyecto;
  onChange: (d: DatosProyecto) => void;
  iaDraft?: import("@/features/direccion/types/aperturas-ia").DraftDatos;
  onClearIaField?: (campo: keyof DatosProyecto) => void;
}) {
  const ia = (campo: keyof DatosProyecto): boolean => {
    if (!iaDraft) return false;
    return (iaDraft as Record<string, unknown>)[campo as string] !== undefined;
  };
  const set = (key: keyof DatosProyecto, val: string | number) => {
    onChange({ ...datos, [key]: val });
    onClearIaField?.(key);
  };

  const textFields: { key: keyof DatosProyecto; label: string }[] = [
    { key: "nombre", label: "Nombre" },
    { key: "ciudad", label: "Ciudad" },
    { key: "zona", label: "Zona" },
    { key: "afluencia", label: "Afluencia" },
    { key: "tipoLocal", label: "Tipo de local" },
    { key: "estacionalidad", label: "Estacionalidad" },
  ];

  const numberFields: { key: keyof DatosProyecto; label: string; suffix?: string }[] = [
    { key: "poblacion", label: "Población" },
    { key: "metrosCuadrados", label: "m²" },
    { key: "ventasEstimadas", label: "Ventas estimadas", suffix: "€/mes" },
    { key: "ticketMedio", label: "Ticket medio", suffix: "€" },
    { key: "clientesEstimados", label: "Clientes estimados", suffix: "/mes" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        {textFields.map((f) => (
          <div key={f.key}>
            <div className="flex items-center gap-1.5">
              <Label className="text-muted-foreground text-xs">{f.label}</Label>
              {ia(f.key) && <BadgeSugerenciaIA />}
            </div>
            <Input
              value={(datos[f.key] as string) ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </div>
        ))}
        {numberFields.map((f) => (
          <div key={f.key}>
            <div className="flex items-center gap-1.5">
              <Label className="text-muted-foreground text-xs">
                {f.label}{f.suffix ? ` (${f.suffix})` : ""}
              </Label>
              {ia(f.key) && <BadgeSugerenciaIA />}
            </div>
            <Input
              type="number"
              value={(datos[f.key] as number) || ""}
              onChange={(e) => set(f.key, Number(e.target.value))}
            />
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <Label className="text-muted-foreground text-xs">Competencia</Label>
          {ia("competencia") && <BadgeSugerenciaIA />}
        </div>
        <Input value={datos.competencia} onChange={(e) => set("competencia", e.target.value)} />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <Label className="text-muted-foreground text-xs">Observaciones</Label>
          {ia("observaciones") && <BadgeSugerenciaIA />}
        </div>
        <Textarea
          value={datos.observaciones ?? ""}
          onChange={(e) => set("observaciones", e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

/* ── Formulario nuevo estudio ── */
function NuevoEstudioForm({ onSave, onClose }: { onSave: (e: EstudioApertura, fotoFile?: File) => void | Promise<void>; onClose: () => void }) {
  const [datos, setDatos] = useState<DatosProyecto>({
    nombre: "", ciudad: "", zona: "", poblacion: 0, afluencia: "", tipoLocal: "",
    metrosCuadrados: 0, ventasEstimadas: 0, ticketMedio: 0, clientesEstimados: 0,
    estacionalidad: "", competencia: "", observaciones: "",
  });
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const d = (key: keyof DatosProyecto, val: string | number) => setDatos(p => ({ ...p, [key]: val }));

  const handlePickFoto = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setFotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!datos.nombre) return;
    onSave({
      id: `ap-${Date.now()}`,
      datos,
      facturacion: crearFacturacionInicial(),
      costes: crearCostesIniciales(),
      procedencia: [],
      destinos: [],
      amortizacion: [],
      creado: new Date().toISOString().split("T")[0],
      viabilidad: "viable",
      actividad: "no_activo",
      local: bloqueLocalInicial(),
      imagenMarca: imagenMarcaInicial(),
      propuesta: propuestaGastronomicaInicial(),
      ocupacion: bloqueOcupacionInicial(),
    }, fotoFile ?? undefined);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-muted-foreground text-xs">Foto del proyecto</Label>
        {fotoPreview ? (
          <div className="relative group mt-1">
            <img
              src={fotoPreview}
              alt="Vista previa"
              className="w-full h-32 object-cover rounded-md border"
            />
            <button
              type="button"
              onClick={() => { setFotoFile(null); setFotoPreview(null); }}
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/80"
              title="Quitar imagen"
              aria-label="Quitar imagen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <label className="mt-1 flex flex-col items-center justify-center gap-1 h-24 w-full rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer text-xs">
            <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
            <span>Añadir foto del proyecto</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(ev) => {
                const file = ev.target.files?.[0];
                if (file) handlePickFoto(file);
                ev.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nombre del proyecto *</Label><Input value={datos.nombre} onChange={e => d("nombre", e.target.value)} /></div>
        <div><Label>Ciudad</Label><Input value={datos.ciudad} onChange={e => d("ciudad", e.target.value)} /></div>
        <div><Label>Zona</Label><Input value={datos.zona} onChange={e => d("zona", e.target.value)} /></div>
        <div><Label>Población</Label><Input type="number" value={datos.poblacion || ""} onChange={e => d("poblacion", Number(e.target.value))} /></div>
        <div><Label>Tipo de local</Label><Input value={datos.tipoLocal} onChange={e => d("tipoLocal", e.target.value)} /></div>
        <div><Label>m²</Label><Input type="number" value={datos.metrosCuadrados || ""} onChange={e => d("metrosCuadrados", Number(e.target.value))} /></div>
        <div><Label>Afluencia</Label><Input value={datos.afluencia} onChange={e => d("afluencia", e.target.value)} /></div>
        <div><Label>Estacionalidad</Label><Input value={datos.estacionalidad} onChange={e => d("estacionalidad", e.target.value)} /></div>
      </div>
      <div><Label>Competencia</Label><Input value={datos.competencia} onChange={e => d("competencia", e.target.value)} /></div>
      <div><Label>Observaciones</Label><Textarea value={datos.observaciones} onChange={e => d("observaciones", e.target.value)} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave}>Crear estudio</Button>
      </div>
    </div>
  );
}
