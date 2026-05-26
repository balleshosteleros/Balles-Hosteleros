"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Settings,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserPlus,
  UserMinus,
  FileSignature,
} from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { listContrataciones } from "@/features/gestoria/contrataciones/actions/contrataciones-actions";
import type { ContratacionRow, TipoContratacion } from "@/features/gestoria/contrataciones/types";
import { MOTIVOS_BAJA, TIPOS_MODIFICACION } from "@/features/gestoria/contrataciones/data/constants";
import { ContratacionModal } from "@/features/gestoria/contrataciones/components/ContratacionModal";
import { AjustesContratacionesModal } from "@/features/gestoria/contrataciones/components/AjustesContratacionesModal";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

const COLS_ALTA = [
  { campo: "nombre", label: "Nombre", bloqueada: true as const },
  { campo: "fecha", label: "Tramitado" },
  { campo: "puesto_motivo", label: "Puesto" },
  { campo: "fecha_evento", label: "Día comienzo" },
  { campo: "email_estado", label: "Email" },
];

const COLS_BAJA_MOD = [
  { campo: "fecha", label: "Fecha", bloqueada: true as const },
  { campo: "nombre", label: "Nombre" },
  { campo: "puesto_motivo", label: "Motivo / Cambio" },
  { campo: "fecha_evento", label: "Fecha contrato" },
  { campo: "email_estado", label: "Email" },
];

function fmtFechaES(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function nombreCompleto(r: ContratacionRow): string {
  return `${(r.nombre ?? "").trim()} ${(r.apellidos ?? "").trim()}`.trim() || "—";
}

function puestoMotivoCambio(r: ContratacionRow): string {
  if (r.tipo === "alta") return r.puesto || "—";
  if (r.tipo === "baja") {
    if (r.motivo === "Otro" && r.motivo_otro) return `Otro — ${r.motivo_otro}`;
    return r.motivo || "—";
  }
  // modificacion
  const partes: string[] = [];
  if (r.modificacion_tipo) partes.push(r.modificacion_tipo);
  if (r.modificacion_detalle) partes.push(r.modificacion_detalle);
  return partes.join(" · ") || "—";
}

function fechaEvento(r: ContratacionRow): string | null {
  if (r.tipo === "alta") return r.fecha_comienzo;
  if (r.tipo === "baja") return r.fecha_finalizacion;
  return r.fecha_cambio;
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCSV(rows: ContratacionRow[], tipoActivo: TipoContratacion) {
  const header = ["Fecha registro", "Tipo", "Nombre", "Apellidos", "Puesto/Motivo/Cambio", "Fecha contrato", "Email gestoría", "Email departamento", "Estado email"];
  const lines = [header.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(
      [
        fmtFechaES(r.created_at),
        r.tipo,
        r.nombre ?? "",
        r.apellidos ?? "",
        puestoMotivoCambio(r),
        fmtFechaES(fechaEvento(r)),
        r.email_to_gestoria ?? "",
        r.email_to_departamento ?? "",
        r.email_estado,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  const csv = "﻿" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contrataciones-${tipoActivo}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function EstadoEmailBadge({ estado }: { estado: ContratacionRow["email_estado"] }) {
  if (estado === "enviado") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
        <CheckCircle2 className="h-3 w-3" /> Enviado
      </Badge>
    );
  }
  if (estado === "fallido") {
    return (
      <Badge className="gap-1 bg-red-100 text-red-700 border-red-200 text-[10px]">
        <AlertCircle className="h-3 w-3" /> Fallido
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
      <Clock className="h-3 w-3" /> Pendiente
    </Badge>
  );
}

const TABS: Array<{ tipo: TipoContratacion; label: string; Icon: typeof UserPlus }> = [
  { tipo: "alta", label: "ALTAS", Icon: UserPlus },
  { tipo: "baja", label: "BAJAS", Icon: UserMinus },
  { tipo: "modificacion", label: "MODIFICACIONES", Icon: FileSignature },
];

export function ContratacionesView() {
  const [rows, setRows] = useState<ContratacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);
  const [tipoActivo, setTipoActivo] = useState<TipoContratacion>("alta");
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [ajustesOpen, setAjustesOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listContrataciones();
      if (r.ok) setRows(r.data);
      else toast.error(r.error ?? "Error al cargar contrataciones");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<TipoContratacion, number> = { alta: 0, baja: 0, modificacion: 0 };
    for (const r of rows) c[r.tipo] += 1;
    return c;
  }, [rows]);

  const acceso = (r: ContratacionRow, campo: string): unknown => {
    if (campo === "fecha") return r.created_at;
    if (campo === "nombre") return nombreCompleto(r);
    if (campo === "puesto_motivo") return puestoMotivoCambio(r);
    if (campo === "fecha_evento") return fechaEvento(r) ?? "";
    if (campo === "email_estado") return r.email_estado;
    return (r as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let lista = rows.filter((r) => r.tipo === tipoActivo);
    if (search) {
      const s = search.toLowerCase();
      lista = lista.filter(
        (r) =>
          nombreCompleto(r).toLowerCase().includes(s) ||
          (r.puesto ?? "").toLowerCase().includes(s) ||
          (r.motivo ?? "").toLowerCase().includes(s) ||
          (r.modificacion_tipo ?? "").toLowerCase().includes(s) ||
          (r.modificacion_detalle ?? "").toLowerCase().includes(s) ||
          (r.dni ?? "").toLowerCase().includes(s),
      );
    }
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [rows, tipoActivo, search, filtros, orden]);

  const opcionesPuestoMotivoCambio = useMemo(() => {
    if (tipoActivo === "alta") {
      const set = new Set<string>();
      for (const r of rows) if (r.tipo === "alta" && r.puesto) set.add(r.puesto);
      return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
    }
    if (tipoActivo === "baja") return [...MOTIVOS_BAJA];
    return [...TIPOS_MODIFICACION];
  }, [rows, tipoActivo]);

  const columnasDef: ToolbarColumna[] = tipoActivo === "alta" ? COLS_ALTA : COLS_BAJA_MOD;

  const columnDefs: Record<string, { th: ReactNode; td: (item: ContratacionRow) => ReactNode }> = tipoActivo === "alta"
    ? {
        nombre: {
          th: (
            <TableColumnHeader
              key="nombre"
              label="Nombre"
              campo="nombre"
              ordenable
              orden={orden}
              onOrdenChange={setOrden}
            />
          ),
          td: (r) => (
            <td key="nombre" className="px-3 py-2.5 font-medium">{nombreCompleto(r)}</td>
          ),
        },
        fecha: {
          th: (
            <TableColumnHeader
              key="fecha"
              label="Tramitado"
              campo="fecha"
              filtroTipo="fecha"
              filtros={filtros}
              onFiltrosChange={setFiltros}
              ordenable
              orden={orden}
              onOrdenChange={setOrden}
            />
          ),
          td: (r) => (
            <td key="fecha" className="px-3 py-2.5 whitespace-nowrap text-xs">{fmtFechaES(r.created_at)}</td>
          ),
        },
        puesto_motivo: {
          th: (
            <TableColumnHeader
              key="puesto_motivo"
              label="Puesto"
              campo="puesto_motivo"
              filtroTipo="lista"
              opciones={opcionesPuestoMotivoCambio}
              filtros={filtros}
              onFiltrosChange={setFiltros}
              ordenable
              orden={orden}
              onOrdenChange={setOrden}
            />
          ),
          td: (r) => (
            <td key="puesto_motivo" className="px-3 py-2.5 text-xs">{puestoMotivoCambio(r)}</td>
          ),
        },
        fecha_evento: {
          th: (
            <TableColumnHeader
              key="fecha_evento"
              label="Día comienzo"
              campo="fecha_evento"
              filtroTipo="fecha"
              filtros={filtros}
              onFiltrosChange={setFiltros}
              ordenable
              orden={orden}
              onOrdenChange={setOrden}
            />
          ),
          td: (r) => (
            <td key="fecha_evento" className="px-3 py-2.5 whitespace-nowrap text-xs">{fmtFechaES(fechaEvento(r))}</td>
          ),
        },
        email_estado: {
          th: (
            <TableColumnHeader
              key="email_estado"
              label="Email"
              campo="email_estado"
              filtroTipo="lista"
              opciones={["enviado", "pendiente", "fallido"]}
              filtros={filtros}
              onFiltrosChange={setFiltros}
              ordenable
              orden={orden}
              onOrdenChange={setOrden}
            />
          ),
          td: (r) => (
            <td key="email_estado" className="px-3 py-2.5"><EstadoEmailBadge estado={r.email_estado} /></td>
          ),
        },
      }
    : {
        fecha: {
          th: (
            <TableColumnHeader
              key="fecha"
              label="Fecha"
              campo="fecha"
              filtroTipo="fecha"
              filtros={filtros}
              onFiltrosChange={setFiltros}
              ordenable
              orden={orden}
              onOrdenChange={setOrden}
            />
          ),
          td: (r) => (
            <td key="fecha" className="px-3 py-2.5 whitespace-nowrap text-xs">{fmtFechaES(r.created_at)}</td>
          ),
        },
        nombre: {
          th: (
            <TableColumnHeader
              key="nombre"
              label="Nombre"
              campo="nombre"
              ordenable
              orden={orden}
              onOrdenChange={setOrden}
            />
          ),
          td: (r) => (
            <td key="nombre" className="px-3 py-2.5 font-medium">{nombreCompleto(r)}</td>
          ),
        },
        puesto_motivo: {
          th: (
            <TableColumnHeader
              key="puesto_motivo"
              label={tipoActivo === "baja" ? "Motivo" : "Cambio"}
              campo="puesto_motivo"
              filtroTipo="lista"
              opciones={opcionesPuestoMotivoCambio}
              filtros={filtros}
              onFiltrosChange={setFiltros}
              ordenable
              orden={orden}
              onOrdenChange={setOrden}
            />
          ),
          td: (r) => (
            <td key="puesto_motivo" className="px-3 py-2.5 text-xs">{puestoMotivoCambio(r)}</td>
          ),
        },
        fecha_evento: {
          th: (
            <TableColumnHeader
              key="fecha_evento"
              label={tipoActivo === "baja" ? "Día finalización" : "Fecha cambio"}
              campo="fecha_evento"
              filtroTipo="fecha"
              filtros={filtros}
              onFiltrosChange={setFiltros}
              ordenable
              orden={orden}
              onOrdenChange={setOrden}
            />
          ),
          td: (r) => (
            <td key="fecha_evento" className="px-3 py-2.5 whitespace-nowrap text-xs">{fmtFechaES(fechaEvento(r))}</td>
          ),
        },
        email_estado: {
          th: (
            <TableColumnHeader
              key="email_estado"
              label="Email"
              campo="email_estado"
              filtroTipo="lista"
              opciones={["enviado", "pendiente", "fallido"]}
              filtros={filtros}
              onFiltrosChange={setFiltros}
              ordenable
              orden={orden}
              onOrdenChange={setOrden}
            />
          ),
          td: (r) => (
            <td key="email_estado" className="px-3 py-2.5"><EstadoEmailBadge estado={r.email_estado} /></td>
          ),
        },
      };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(({ tipo, label, Icon }) => (
          <Button
            key={tipo}
            variant={tipoActivo === tipo ? "default" : "outline"}
            className="gap-2"
            onClick={() => setTipoActivo(tipo)}
          >
            <Icon className="h-4 w-4" />
            {label}
            <Badge variant="secondary" className="text-[10px] ml-1">{counts[tipo]}</Badge>
          </Button>
        ))}
      </div>

      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        onNuevo={() => setModalOpen(true)}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => downloadCSV(filtered, tipoActivo)}
              title="Descargar CSV"
              aria-label="Descargar"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <Button
              size="icon"
              variant={ajustesOpen ? "default" : "outline"}
              className="h-9 w-9"
              onClick={() => setAjustesOpen(true)}
              title="Ajustes"
              aria-label="Ajustes"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      />

      <ResizableColumnsProvider storageKey={`gestoria-contrataciones-${tipoActivo}`}>
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columnasRender.map((c) => columnDefs[c.campo]?.th)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Cargando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">
                  {counts[tipoActivo] === 0
                    ? `Sin ${tipoActivo === "alta" ? "altas" : tipoActivo === "baja" ? "bajas" : "modificaciones"} registradas. Pulsa "Nuevo" para crear la primera.`
                    : "No hay resultados con los filtros aplicados."}
                </td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                    {columnasRender.map((c) => columnDefs[c.campo]?.td(r))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>

      <div className="text-xs text-muted-foreground text-right">
        {filtered.length} de {counts[tipoActivo]} {tipoActivo === "alta" ? "altas" : tipoActivo === "baja" ? "bajas" : "modificaciones"}
      </div>

      <ContratacionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        initialTipo={tipoActivo}
      />
      <AjustesContratacionesModal
        open={ajustesOpen}
        onClose={() => setAjustesOpen(false)}
      />
    </div>
  );
}
