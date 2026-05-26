"use client";

import { useState, useEffect, useCallback, useMemo, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  SubmoduleToolbar,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  coincideBusquedaUniversal,
  ordenarColumnas,
  colVisible,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { Settings, ClipboardCheck, CheckCircle2, Loader2, Users, ArrowLeft, Check, X, Share2 } from "lucide-react";
import { listEnvios, getEnvio, revisarEnvio } from "../actions";
import type { EnvioResumen, EnvioCompleto } from "../types";
import { InspectoresTab } from "@/features/calidad/inspecciones/inspectores/components/InspectoresTab";
import { InspectoresConfigView } from "@/features/calidad/inspecciones/inspectores/components/config/InspectoresConfigView";
import { DialogCompartirInspectores } from "@/features/calidad/inspecciones/inspectores/components/DialogCompartirInspectores";
import { PlantillasNavButton } from "./PlantillasListView";
import type { InspeccionesTab } from "@/features/calidad/components/CalidadInspeccionesView";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

const columnasDef: ToolbarColumna[] = [
  { campo: "numero_secuencial", label: "Nº", bloqueada: true },
  { campo: "mes_reserva", label: "Mes" },
  { campo: "ano_reserva", label: "Año" },
  { campo: "cumplimiento", label: "Cumplimiento" },
  { campo: "nombre_inspector", label: "Inspector" },
  { campo: "nombre_jefe_sala", label: "Inspeccionado" },
  { campo: "local_nombre", label: "Local" },
  { campo: "plantilla_nombre", label: "Plantilla" },
  { campo: "nota_final", label: "Nota" },
  { campo: "estado", label: "Estado" },
  { campo: "firmado", label: "Firmado" },
  { campo: "created_at", label: "Publicada" },
  { campo: "fecha_inspeccion", label: "Fecha reserva" },
];

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function partesMadrid(iso: string | null): { year: number; month: number } | null {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  if (!year || !month) return null;
  return { year, month };
}

function mesReserva(iso: string | null): string {
  const p = partesMadrid(iso);
  return p ? MESES_ES[p.month - 1] : "—";
}

function anoReserva(iso: string | null): string {
  const p = partesMadrid(iso);
  return p ? String(p.year) : "—";
}

function formatFechaHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

// Día YYYY-MM-DD en zona Madrid, para comparar publicación vs reserva.
function diaMadrid(iso: string | null): string | null {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return parts; // "YYYY-MM-DD"
}

function CumplimientoBadge({
  createdAt,
  fechaInspeccion,
}: {
  createdAt: string;
  fechaInspeccion: string | null;
}) {
  if (!fechaInspeccion) return <span className="text-muted-foreground">—</span>;
  const diaPub = diaMadrid(createdAt);
  const diaRes = diaMadrid(fechaInspeccion);
  if (!diaPub || !diaRes) return <span className="text-muted-foreground">—</span>;
  if (diaRes > diaPub) {
    return <Badge className="text-[10px] bg-slate-100 text-slate-600 hover:bg-slate-100">Pendiente</Badge>;
  }
  if (diaPub === diaRes) {
    return <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">En fecha</Badge>;
  }
  return <Badge className="text-[10px] bg-red-100 text-red-700 hover:bg-red-100">Pasado de fecha</Badge>;
}

function NotaBadge({ nota }: { nota: number | null }) {
  if (nota === null) return <span className="text-muted-foreground">—</span>;
  const color =
    nota >= 9 ? "bg-emerald-100 text-emerald-700" :
    nota >= 7 ? "bg-blue-100 text-blue-700" :
    nota >= 5 ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700";
  return <Badge className={`tabular-nums font-mono ${color} hover:${color}`}>{nota.toFixed(2).replace(".", ",")}</Badge>;
}

// Quita el prefijo "TEMA N:" para mostrar etiquetas cortas en la tabla.
function nombreCortoSeccion(titulo: string): string {
  return titulo.replace(/^TEMA\s*\d+:\s*/i, "").trim();
}

function NotasPorSeccionCell({
  notas,
  orden,
}: {
  notas: Record<string, number> | null;
  orden?: Map<string, number>;
}) {
  if (!notas || Object.keys(notas).length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const entradas = Object.entries(notas);
  if (orden) {
    entradas.sort(
      (a, b) => (orden.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (orden.get(b[0]) ?? Number.MAX_SAFE_INTEGER),
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {entradas.map(([seccion, valor]) => {
        const color =
          valor >= 9 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
          valor >= 7 ? "bg-blue-50 text-blue-700 border-blue-200" :
          valor >= 5 ? "bg-amber-50 text-amber-700 border-amber-200" :
          "bg-red-50 text-red-700 border-red-200";
        return (
          <span
            key={seccion}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${color}`}
            title={`${seccion}: ${valor.toFixed(2)}`}
          >
            <span className="font-medium">{nombreCortoSeccion(seccion)}</span>
            <span className="font-mono tabular-nums">{Number(valor).toFixed(1)}</span>
          </span>
        );
      })}
    </div>
  );
}

function EscalaBadge({ valor, max }: { valor: number; max: number }) {
  const pct = max > 0 ? valor / max : 0;
  const color =
    pct >= 0.9 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    pct >= 0.7 ? "bg-blue-50 text-blue-700 border-blue-200" :
    pct >= 0.5 ? "bg-amber-50 text-amber-700 border-amber-200" :
    "bg-red-50 text-red-700 border-red-200";
  return (
    <Badge variant="outline" className={`font-mono tabular-nums ${color}`}>
      {valor} / {max}
    </Badge>
  );
}

function PlantillaBadge({ nombre, version }: { nombre: string | null; version?: number | null }) {
  if (!nombre) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-mono tabular-nums font-normal text-muted-foreground border-muted-foreground/30"
      title={nombre}
    >
      V{version ?? 1}
    </Badge>
  );
}

function EstadoBadge({ estado }: { estado: EnvioResumen["estado"] }) {
  const map: Record<EnvioResumen["estado"], { label: string; cn: string }> = {
    pendiente_revision: { label: "Completa", cn: "bg-amber-100 text-amber-700" },
    revisado: { label: "Revisado", cn: "bg-emerald-100 text-emerald-700" },
    archivado: { label: "Archivado", cn: "bg-muted text-muted-foreground" },
  };
  const { label, cn } = map[estado];
  return <Badge className={`text-[10px] ${cn} hover:${cn}`}>{label}</Badge>;
}

function FirmadoIcon({ envio }: { envio: EnvioResumen }) {
  if (envio.verificado_at) {
    const por = envio.verificado_por_nombre ?? envio.nombre_jefe_sala ?? "Jefe de sala";
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
        title={`Firmada por ${por} el ${new Date(envio.verificado_at).toLocaleString()}`}
      >
        <Check className="h-3 w-3" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-red-700 border border-red-200"
      title="El inspeccionado no firmó la inspección"
    >
      <X className="h-3 w-3" strokeWidth={2.5} />
    </span>
  );
}

const ESTADO_LABEL: Record<EnvioResumen["estado"], string> = {
  pendiente_revision: "Completa",
  revisado: "Revisado",
  archivado: "Archivado",
};

function cumplimientoTexto(e: EnvioResumen): string {
  if (!e.fecha_inspeccion) return "—";
  const diaPub = diaMadrid(e.created_at);
  const diaRes = diaMadrid(e.fecha_inspeccion);
  if (!diaPub || !diaRes) return "—";
  if (diaRes > diaPub) return "Pendiente";
  if (diaPub === diaRes) return "En fecha";
  return "Pasado de fecha";
}

function fechaIsoDia(iso: string | null): string {
  return diaMadrid(iso) ?? "";
}

interface RealizadasViewProps {
  tab: InspeccionesTab;
  onTabChange: (t: InspeccionesTab) => void;
}

export function RealizadasView({ onTabChange }: RealizadasViewProps) {
  const [envios, setEnvios] = useState<EnvioResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[]>(columnasDef.map((c) => c.campo));
  const [showConfig, setShowConfig] = useState(false);
  const [showInspectores, setShowInspectores] = useState(false);
  const [compartirOpen, setCompartirOpen] = useState(false);
  const [selectedEnvioId, setSelectedEnvioId] = useState<string | null>(null);
  const { empresaActual } = useEmpresa();

  const reload = useCallback(() => {
    setLoading(true);
    listEnvios().then((d) => {
      setEnvios(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => { reload(); }, [reload, empresaActual.id]);

  const mesesUsados = useMemo(
    () => [...new Set(envios.map((e) => mesReserva(e.fecha_inspeccion)).filter((m) => m !== "—"))]
      .sort((a, b) => MESES_ES.indexOf(a) - MESES_ES.indexOf(b)),
    [envios],
  );
  const anosUsados = useMemo(
    () => [...new Set(envios.map((e) => anoReserva(e.fecha_inspeccion)).filter((a) => a !== "—"))].sort(),
    [envios],
  );
  const inspectoresUsados = useMemo(
    () => [...new Set(envios.map((e) => e.nombre_inspector).filter(Boolean))].sort(),
    [envios],
  );
  const jefesSalaUsados = useMemo(
    () => [...new Set(envios.map((e) => e.nombre_jefe_sala ?? "").filter(Boolean))].sort(),
    [envios],
  );
  const localesUsados = useMemo(
    () => [...new Set(envios.map((e) => e.local_nombre ?? "").filter(Boolean))].sort(),
    [envios],
  );
  const plantillasUsadas = useMemo(
    () => [...new Set(envios.map((e) => e.plantilla_nombre ?? "").filter(Boolean))].sort(),
    [envios],
  );

  const acceso = useCallback((e: EnvioResumen, campo: string): unknown => {
    switch (campo) {
      case "numero_secuencial": return e.numero_secuencial;
      case "mes_reserva": return mesReserva(e.fecha_inspeccion);
      case "ano_reserva": return anoReserva(e.fecha_inspeccion);
      case "cumplimiento": return cumplimientoTexto(e);
      case "nombre_inspector": return e.nombre_inspector;
      case "nombre_jefe_sala": return e.nombre_jefe_sala ?? "";
      case "local_nombre": return e.local_nombre ?? "";
      case "plantilla_nombre": return e.plantilla_nombre ?? "";
      case "nota_final": return e.nota_final;
      case "estado": return ESTADO_LABEL[e.estado];
      case "firmado": return e.verificado_at ? "Firmado" : "Sin firmar";
      case "created_at": return fechaIsoDia(e.created_at);
      case "fecha_inspeccion": return fechaIsoDia(e.fecha_inspeccion);
      default: return undefined;
    }
  }, []);

  const filtrados = useMemo(() => {
    let lista = envios.filter((e) => coincideBusquedaUniversal(e, busqueda));
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [envios, busqueda, filtros, orden, acceso]);

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  const columnDefs: Record<string, { th: ReactNode; td: (e: EnvioResumen) => ReactNode }> = {
    numero_secuencial: {
      th: (
        <TableColumnHeader
          key="numero_secuencial"
          label="Nº"
          campo="numero_secuencial"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (e) => (
        <td key="numero_secuencial" className="px-3 py-1.5 text-xs tabular-nums text-muted-foreground">
          {e.numero_secuencial ?? "—"}
        </td>
      ),
    },
    mes_reserva: {
      th: (
        <TableColumnHeader
          key="mes_reserva"
          label="Mes"
          campo="mes_reserva"
          filtroTipo="lista"
          opciones={mesesUsados}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (e) => (
        <td key="mes_reserva" className="px-3 py-1.5 font-medium">
          {mesReserva(e.fecha_inspeccion)}
        </td>
      ),
    },
    ano_reserva: {
      th: (
        <TableColumnHeader
          key="ano_reserva"
          label="Año"
          campo="ano_reserva"
          filtroTipo="lista"
          opciones={anosUsados}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (e) => (
        <td key="ano_reserva" className="px-3 py-1.5 tabular-nums text-xs text-muted-foreground">
          {anoReserva(e.fecha_inspeccion)}
        </td>
      ),
    },
    cumplimiento: {
      th: (
        <TableColumnHeader
          key="cumplimiento"
          label="Cumplimiento"
          campo="cumplimiento"
          filtroTipo="lista"
          opciones={["Pendiente", "En fecha", "Pasado de fecha"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (e) => (
        <td key="cumplimiento" className="px-3 py-1.5">
          <CumplimientoBadge createdAt={e.created_at} fechaInspeccion={e.fecha_inspeccion} />
        </td>
      ),
    },
    nombre_inspector: {
      th: (
        <TableColumnHeader
          key="nombre_inspector"
          label="Inspector"
          campo="nombre_inspector"
          filtroTipo="lista"
          opciones={inspectoresUsados}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (e) => (
        <td key="nombre_inspector" className="px-3 py-1.5 font-medium">
          {e.nombre_inspector}
        </td>
      ),
    },
    nombre_jefe_sala: {
      th: (
        <TableColumnHeader
          key="nombre_jefe_sala"
          label="Inspeccionado"
          campo="nombre_jefe_sala"
          filtroTipo="lista"
          opciones={jefesSalaUsados}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (e) => (
        <td key="nombre_jefe_sala" className="px-3 py-1.5 text-muted-foreground">
          {e.nombre_jefe_sala ?? "—"}
        </td>
      ),
    },
    local_nombre: {
      th: (
        <TableColumnHeader
          key="local_nombre"
          label="Local"
          campo="local_nombre"
          filtroTipo="lista"
          opciones={localesUsados}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (e) => (
        <td key="local_nombre" className="px-3 py-1.5 text-muted-foreground">
          {e.local_nombre ?? "—"}
        </td>
      ),
    },
    plantilla_nombre: {
      th: (
        <TableColumnHeader
          key="plantilla_nombre"
          label="Plantilla"
          campo="plantilla_nombre"
          filtroTipo="lista"
          opciones={plantillasUsadas}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (e) => (
        <td key="plantilla_nombre" className="px-3 py-1.5">
          <PlantillaBadge nombre={e.plantilla_nombre} version={e.plantilla_version} />
        </td>
      ),
    },
    nota_final: {
      th: (
        <TableColumnHeader
          key="nota_final"
          label="Nota"
          campo="nota_final"
          filtroTipo="numero"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (e) => (
        <td key="nota_final" className="px-3 py-1.5">
          <NotaBadge nota={e.nota_final} />
        </td>
      ),
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
          label="Estado"
          campo="estado"
          filtroTipo="lista"
          opciones={["Completa", "Revisado", "Archivado"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (e) => (
        <td key="estado" className="px-3 py-1.5">
          <EstadoBadge estado={e.estado} />
        </td>
      ),
    },
    firmado: {
      th: (
        <TableColumnHeader
          key="firmado"
          label="Firmado"
          campo="firmado"
          filtroTipo="lista"
          opciones={["Firmado", "Sin firmar"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (e) => (
        <td key="firmado" className="px-3 py-1.5">
          <FirmadoIcon envio={e} />
        </td>
      ),
    },
    created_at: {
      th: (
        <TableColumnHeader
          key="created_at"
          label="Publicada"
          campo="created_at"
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (e) => (
        <td key="created_at" className="px-3 py-1.5 text-xs text-muted-foreground tabular-nums">
          {formatFechaHora(e.created_at)}
        </td>
      ),
    },
    fecha_inspeccion: {
      th: (
        <TableColumnHeader
          key="fecha_inspeccion"
          label="Fecha reserva"
          campo="fecha_inspeccion"
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (e) => (
        <td key="fecha_inspeccion" className="px-3 py-1.5 text-xs tabular-nums">
          {formatFechaHora(e.fecha_inspeccion)}
        </td>
      ),
    },
  };

  if (showInspectores) {
    return (
      <InspectoresTab
        onBack={() => setShowInspectores(false)}
        backLabel="Volver a inspecciones"
      />
    );
  }

  if (showConfig) {
    return (
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowConfig(false)}
          className="gap-1.5 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a inspecciones
        </Button>
        <InspectoresConfigView />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={() => toast.info("Crear inspección manual: próximamente")}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraIzquierda={
          <>
            <PlantillasNavButton onTabChange={onTabChange} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInspectores(true)}
              className="gap-1.5"
            >
              <Users className="h-3.5 w-3.5" /> Inspectores
            </Button>
          </>
        }
        extraDerecha={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setCompartirOpen(true)}
            >
              <Share2 className="h-3.5 w-3.5" /> Compartir
            </Button>
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
          </>
        }
      />

      <DialogCompartirInspectores
        open={compartirOpen}
        onOpenChange={setCompartirOpen}
      />

      <ResizableColumnsProvider storageKey="calidad-inspecciones-realizadas">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columnasRender.map((c) => columnDefs[c.campo]?.th)}
              </tr>
            </thead>
            <tbody>
              {loading && envios.length === 0 ? (
                <tr><td colSpan={columnasRender.length} className="text-center py-10"><LoadingSpinner /></td></tr>
              ) : !loading && envios.length === 0 ? (
                <tr>
                  <td colSpan={columnasRender.length} className="text-center py-16">
                    <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                    <div className="text-sm text-muted-foreground">Aún no hay inspecciones recibidas.</div>
                    <div className="text-xs text-muted-foreground mt-1">Comparte el enlace con un inspector para empezar.</div>
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={columnasRender.length} className="text-center py-10 text-muted-foreground">Ningún envío coincide con los filtros.</td></tr>
              ) : (
                filtrados.map((e) => (
                  <tr key={e.id} className="border-b hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedEnvioId(e.id)}>
                    {columnasRender.map((c) => columnDefs[c.campo]?.td(e))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>
      <div className="text-xs text-muted-foreground text-right">
        {filtrados.length} de {envios.length} inspecciones
      </div>

      <EnvioDetailDialog
        envioId={selectedEnvioId}
        onClose={() => setSelectedEnvioId(null)}
        onSaved={() => { setSelectedEnvioId(null); reload(); }}
      />
    </div>
  );
}

function EnvioDetailDialog({
  envioId,
  onClose,
  onSaved,
}: {
  envioId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [envio, setEnvio] = useState<EnvioCompleto | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    if (!envioId) {
      setEnvio(null);
      return;
    }
    setLoading(true);
    getEnvio(envioId).then((e) => {
      setEnvio(e);
      setLoading(false);
    });
  }, [envioId]);

  function handleMark(estado: EnvioCompleto["estado"]) {
    if (!envio) return;
    startSave(async () => {
      const res = await revisarEnvio(envio.id, { estado, notas_calidad: null });
      if (res.ok) {
        toast.success(estado === "revisado" ? "Marcado como revisado" : "Estado actualizado");
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  }

  const respuestasPorSeccion = new Map<string, typeof envio extends null ? never : NonNullable<typeof envio>["respuestas"]>();
  const seccionOrden = new Map<string, number>();
  if (envio) {
    for (const r of envio.respuestas) {
      const k = r.pregunta_snapshot.seccion_titulo;
      const arr = respuestasPorSeccion.get(k) ?? [];
      arr.push(r);
      respuestasPorSeccion.set(k, arr);
      if (!seccionOrden.has(k)) {
        seccionOrden.set(k, r.pregunta_snapshot.seccion_orden);
      }
    }
  }

  return (
    <Dialog open={!!envioId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Inspección #{envio?.numero_secuencial ?? "—"}
            {envio && <EstadoBadge estado={envio.estado} />}
            {envio?.nota_final !== undefined && <NotaBadge nota={envio?.nota_final ?? null} />}
          </DialogTitle>
        </DialogHeader>

        {loading || !envio ? (
          <div className="py-10 flex justify-center"><LoadingSpinner /></div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground text-xs">Inspector:</span> <span className="font-medium">{envio.nombre_inspector}</span></div>
              <div><span className="text-muted-foreground text-xs">Teléfono:</span> {envio.telefono_inspector ?? "—"}</div>
              <div><span className="text-muted-foreground text-xs">Fecha reserva:</span> {formatFechaHora(envio.fecha_inspeccion)}</div>
              <div><span className="text-muted-foreground text-xs">Publicada:</span> {formatFechaHora(envio.created_at)}</div>
              <div><span className="text-muted-foreground text-xs">Local:</span> {envio.local_nombre ?? "—"}</div>
              <div><span className="text-muted-foreground text-xs">Cumplimiento:</span> <CumplimientoBadge createdAt={envio.created_at} fechaInspeccion={envio.fecha_inspeccion} /></div>
              <div className="col-span-2"><span className="text-muted-foreground text-xs">Plantilla:</span> <PlantillaBadge nombre={envio.plantilla_nombre} version={envio.plantilla_version} /></div>
              <div className="col-span-2"><span className="text-muted-foreground text-xs">Jefe de sala:</span> {envio.nombre_jefe_sala ?? "—"}</div>
              {envio.notas_por_seccion && Object.keys(envio.notas_por_seccion).length > 0 && (
                <div className="col-span-2">
                  <div className="text-muted-foreground text-xs mb-1.5">Notas por sección</div>
                  <NotasPorSeccionCell notas={envio.notas_por_seccion} orden={seccionOrden} />
                </div>
              )}
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">Firma in-situ:</span>{" "}
                {envio.verificado_at ? (
                  <span className="text-emerald-700">
                    ✓ Firmada el {formatFechaHora(envio.verificado_at)}
                    {envio.verificado_por_nombre
                      ? ` por ${envio.verificado_por_nombre}`
                      : ""}
                  </span>
                ) : (
                  <span className="text-red-700">✗ No firmada por el inspeccionado</span>
                )}
              </div>
            </div>

            {Array.from(respuestasPorSeccion.entries())
              .sort((a, b) => (a[1][0]?.pregunta_snapshot.seccion_orden ?? 0) - (b[1][0]?.pregunta_snapshot.seccion_orden ?? 0))
              .map(([sec, respuestas]) => (
              <div key={sec} className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sec}</div>
                <div className="space-y-2">
                  {respuestas
                    .slice()
                    .sort((a, b) => a.pregunta_snapshot.orden - b.pregunta_snapshot.orden)
                    .map((r) => {
                      // El empleado inspeccionado ya se muestra arriba como
                      // "Jefe de sala"; no lo repetimos dentro de la inspección.
                      if (r.pregunta_snapshot.tipo === "empleado_select") return null;

                      const enun = r.pregunta_snapshot.enunciado;
                      const esObs =
                        r.pregunta_snapshot.tipo === "texto_largo" &&
                        enun.toLowerCase().startsWith("observaciones");

                      // Observaciones: siempre se muestra el bloque para mantener
                      // consistencia entre apartados; si está vacío indicamos "Sin observaciones".
                      if (esObs) {
                        return (
                          <div key={r.id} className="rounded-md border bg-muted/20 p-3">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                              Observaciones
                            </div>
                            {r.valor_texto ? (
                              <div className="text-xs whitespace-pre-wrap">{r.valor_texto}</div>
                            ) : (
                              <div className="text-xs text-muted-foreground italic">Sin observaciones</div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div key={r.id} className="text-sm">
                          <div className="text-foreground/90">{enun}</div>
                          <div className="mt-0.5">
                            {r.pregunta_snapshot.tipo === "escala" && r.valor_numero !== null ? (
                              <EscalaBadge valor={r.valor_numero} max={r.pregunta_snapshot.escala_max ?? 5} />
                            ) : r.valor_texto ? (
                              <div className="rounded bg-muted/30 px-2 py-1.5 text-xs whitespace-pre-wrap">{r.valor_texto}</div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Sin respuesta</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}

        {envio && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            {envio.estado !== "archivado" && (
              <Button variant="outline" onClick={() => handleMark("archivado")} disabled={isSaving}>Archivar</Button>
            )}
            {envio.estado !== "revisado" && (
              <Button onClick={() => handleMark("revisado")} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Marcar revisado
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
