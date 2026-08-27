"use client";

/**
 * Gestoría → CONTRATACIONES. Visor de consulta.
 *
 * Histórico de todo lo que se ha comunicado a la gestoría desde RRHH: altas,
 * bajas y modificaciones. La fuente es RRHH. La gestoría entra como una usuaria
 * más con acceso al departamento y consulta lo que se le ha enviado, con los
 * MISMOS datos que recibió por correo.
 *
 * ÚNICA acción: «Reenviar alta», visible solo para quien puede editar RRHH y
 * solo en altas cuyo contrato sigue sin llegar (ver `ReenviarAltaButton`).
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSincronizacionEnVivo } from "@/shared/hooks/useSincronizacionEnVivo";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserPlus,
  UserMinus,
  FileSignature,
  Send,
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
import {
  listContrataciones,
  reenviarAltaGestoria,
} from "@/features/gestoria/contrataciones/actions/contrataciones-actions";
import type { ContratacionRow, TipoContratacion } from "@/features/gestoria/contrataciones/types";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";

/** Etiqueta de la fecha clave según el tipo de trámite. */
const LABEL_FECHA_EVENTO: Record<TipoContratacion, string> = {
  alta: "Día de comienzo",
  baja: "Último día",
  modificacion: "Fecha del cambio",
};

/** Texto de lo que falta cuando el trámite está pendiente. */
const TEXTO_PENDIENTE: Record<string, string> = {
  contrato_gestoria: "Falta el contrato de la gestoría",
  firma_trabajador: "Falta la firma del trabajador",
  enlace_caducado: "El enlace de subida caducó sin contrato",
  email_fallido: "El aviso a la gestoría no salió",
  justificante_baja: "Falta el justificante de la Seguridad Social",
};

function columnasDe(tipo: TipoContratacion): ToolbarColumna[] {
  return [
    { campo: "nombre", label: "Trabajador", bloqueada: true as const },
    { campo: "dni_nie", label: "DNI / NIE" },
    { campo: "puesto", label: tipo === "modificacion" ? "Puesto nuevo" : "Puesto" },
    { campo: "enviado_en", label: "Aviso enviado" },
    { campo: "fecha_evento", label: LABEL_FECHA_EVENTO[tipo] },
    { campo: "estado", label: "Estado" },
  ];
}

/** Fecha de calendario (sin hora): se muestra tal cual, sin convertir de zona. */
function fmtFechaES(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** `enviado_en` es un INSTANTE: fecha Y hora en la zona de la empresa. */
function fmtInstante(iso: string | null | undefined, tz: string): string {
  return formatFechaHoraEnZona(iso, tz) || "—";
}

function EstadoBadge({ row }: { row: ContratacionRow }) {
  if (row.estado === "correcto") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
        <CheckCircle2 className="h-3 w-3" /> Correcto
      </Badge>
    );
  }
  const detalle = row.pendiente_de ? TEXTO_PENDIENTE[row.pendiente_de] : null;
  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
        <Clock className="h-3 w-3" /> Pendiente
      </Badge>
      {detalle && <span className="text-[11px] text-muted-foreground leading-tight">{detalle}</span>}
    </div>
  );
}

/**
 * Reenvío del alta a la gestoría. Solo aparece en ALTAS que siguen esperando el
 * contrato (pendientes o con el enlace caducado) y solo para quien puede editar
 * RRHH: la gestoría consulta esta pantalla, no se auto-envía las altas.
 *
 * Es el único reintento posible cuando el correo del alta no llegó a salir —
 * recontratar está cerrado una vez el candidato tiene ficha de empleado.
 */
function ReenviarAltaButton({ row, onHecho }: { row: ContratacionRow; onHecho: () => void }) {
  const { puedeEditar, permisosLoaded } = useAuth();
  const [enviando, setEnviando] = useState(false);

  const aplica =
    row.tipo === "alta" &&
    row.empleado_id != null &&
    (row.pendiente_de === "contrato_gestoria" ||
      row.pendiente_de === "enlace_caducado" ||
      row.pendiente_de === "email_fallido");
  // `permisosLoaded` evita que el botón parpadee antes de saber si hay permiso.
  if (!aplica || !permisosLoaded || !puedeEditar("RECURSOS HUMANOS")) return null;

  const reenviar = async () => {
    setEnviando(true);
    const res = await reenviarAltaGestoria(row.empleado_id as string);
    setEnviando(false);
    if (res.ok) {
      toast.success(`Alta reenviada a la gestoría: ${row.nombre}`);
      onHecho();
    } else {
      toast.error("No se pudo reenviar el alta", { description: res.error });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 px-2 text-[11px]"
      disabled={enviando}
      onClick={reenviar}
    >
      <Send className="h-3 w-3 mr-1" />
      {enviando ? "Enviando…" : "Reenviar alta"}
    </Button>
  );
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCSV(rows: ContratacionRow[], tipo: TipoContratacion, tz: string) {
  const header = [
    "Trabajador",
    "DNI/NIE",
    "Puesto",
    "Aviso enviado",
    LABEL_FECHA_EVENTO[tipo],
    "Estado",
    "Pendiente de",
    "Aviso",
  ];
  const lines = [header.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.nombre,
        r.dni_nie ?? "",
        r.puesto ?? "",
        fmtInstante(r.enviado_en, tz),
        fmtFechaES(r.fecha_evento),
        r.estado === "correcto" ? "Correcto" : "Pendiente",
        r.pendiente_de ? TEXTO_PENDIENTE[r.pendiente_de] ?? "" : "",
        r.aviso_texto ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  const csv = "﻿" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gestoria-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const TABS: Array<{ tipo: TipoContratacion; label: string; Icon: typeof UserPlus }> = [
  { tipo: "alta", label: "Altas", Icon: UserPlus },
  { tipo: "baja", label: "Bajas", Icon: UserMinus },
  { tipo: "modificacion", label: "Modificaciones", Icon: FileSignature },
];

export function ContratacionesView() {
  const { empresaActual } = useEmpresa();
  const tz = empresaActual?.zonaHoraria ?? "";
  const [rows, setRows] = useState<ContratacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);
  const [tipoActivo, setTipoActivo] = useState<TipoContratacion>("alta");
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listContrataciones();
      if (r.ok) setRows(r.data);
      else toast.error(r.error ?? "Error al cargar el histórico");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Sincronizacion en vivo: el panel de contrataciones refleja las altas y bajas
  // segun se envian a la gestoria y segun ella sube los contratos firmados. Es
  // de lectura, asi que refrescar no puede pisar nada.
  useSincronizacionEnVivo({
    tablas: ["gestoria_contrato_tokens", "gestoria_bajas", "empleado_condiciones"],
    onCambio: () => void load(),
  });

  const counts = useMemo(() => {
    const c: Record<TipoContratacion, number> = { alta: 0, baja: 0, modificacion: 0 };
    for (const r of rows) c[r.tipo] += 1;
    return c;
  }, [rows]);

  /** Trámites en peligro del tipo activo (pendientes cuya fecha ya llegó). */
  const enPeligro = useMemo(
    () => rows.filter((r) => r.tipo === tipoActivo && r.aviso === "peligro"),
    [rows, tipoActivo],
  );

  const acceso = (r: ContratacionRow, campo: string): unknown => {
    if (campo === "estado") return r.estado;
    if (campo === "fecha_evento") return r.fecha_evento ?? "";
    return (r as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let lista = rows.filter((r) => r.tipo === tipoActivo);
    if (search) {
      const s = search.toLowerCase();
      lista = lista.filter(
        (r) =>
          r.nombre.toLowerCase().includes(s) ||
          (r.dni_nie ?? "").toLowerCase().includes(s) ||
          (r.puesto ?? "").toLowerCase().includes(s) ||
          (r.tipo_baja_label ?? "").toLowerCase().includes(s) ||
          (r.motivo ?? "").toLowerCase().includes(s),
      );
    }
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [rows, tipoActivo, search, filtros, orden]);

  const columnasDef = columnasDe(tipoActivo);

  const columnDefs: Record<string, { th: ReactNode; td: (r: ContratacionRow) => ReactNode }> = {
    nombre: {
      th: <TableColumnHeader key="nombre" label="Trabajador" campo="nombre" ordenable orden={orden} onOrdenChange={setOrden} />,
      td: (r) => (
        <td key="nombre" className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            {r.aviso === "peligro" && (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" aria-label="Requiere atención" />
            )}
            <span className="font-medium">{r.nombre}</span>
          </div>
          {r.aviso_texto && <div className="text-[11px] text-red-600 mt-0.5">{r.aviso_texto}</div>}
        </td>
      ),
    },
    dni_nie: {
      th: <TableColumnHeader key="dni_nie" label="DNI / NIE" campo="dni_nie" ordenable orden={orden} onOrdenChange={setOrden} />,
      td: (r) => <td key="dni_nie" className="px-3 py-2.5 text-xs">{r.dni_nie || "—"}</td>,
    },
    puesto: {
      th: (
        <TableColumnHeader
          key="puesto"
          label={tipoActivo === "modificacion" ? "Puesto nuevo" : "Puesto"}
          campo="puesto"
          filtroTipo="lista"
          opciones={Array.from(new Set(rows.filter((r) => r.tipo === tipoActivo).map((r) => r.puesto).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "es"))}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (r) => (
        <td key="puesto" className="px-3 py-2.5 text-xs">
          {r.tipo === "modificacion" && r.puesto_anterior ? (
            <span>
              <span className="text-muted-foreground">{r.puesto_anterior}</span>
              {" → "}
              <span className="font-medium">{r.puesto_nuevo || "—"}</span>
            </span>
          ) : (
            r.puesto || "—"
          )}
        </td>
      ),
    },
    enviado_en: {
      th: (
        <TableColumnHeader
          key="enviado_en"
          label="Aviso enviado"
          campo="enviado_en"
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (r) => <td key="enviado_en" className="px-3 py-2.5 whitespace-nowrap text-xs">{fmtInstante(r.enviado_en, tz)}</td>,
    },
    fecha_evento: {
      th: (
        <TableColumnHeader
          key="fecha_evento"
          label={LABEL_FECHA_EVENTO[tipoActivo]}
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
        <td key="fecha_evento" className={`px-3 py-2.5 whitespace-nowrap text-xs ${r.aviso === "peligro" ? "text-red-600 font-medium" : ""}`}>
          {fmtFechaES(r.fecha_evento)}
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
          opciones={["correcto", "pendiente"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (r) => (
        <td key="estado" className="px-3 py-2.5">
          <div className="flex flex-col gap-1.5 items-start">
            <EstadoBadge row={r} />
            <ReenviarAltaButton row={r} onHecho={load} />
          </div>
        </td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  const etiquetaTipo = tipoActivo === "alta" ? "altas" : tipoActivo === "baja" ? "bajas" : "modificaciones";

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

      {/* Aviso de cabecera: lo que requiere atención YA. */}
      {enPeligro.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm text-red-800">
            <span className="font-semibold">
              {enPeligro.length === 1
                ? "1 trámite requiere atención"
                : `${enPeligro.length} trámites requieren atención`}
            </span>
            <span className="text-red-700">
              {" — "}
              {tipoActivo === "alta"
                ? "hay trabajadores que ya han empezado (o empiezan hoy) con el contrato sin cerrar."
                : "faltan documentos oficiales de bajas que ya son efectivas."}
            </span>
          </div>
        </div>
      )}

      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9"
            onClick={() => downloadCSV(filtered, tipoActivo, tz)}
            title="Descargar CSV"
            aria-label="Descargar"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        }
      />

      <ResizableColumnsProvider storageKey={`gestoria-contrataciones-${tipoActivo}`}>
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">{columnasRender.map((c) => columnDefs[c.campo]?.th)}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columnasRender.length} className="text-center py-12 text-muted-foreground">
                    Cargando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={columnasRender.length} className="text-center py-12 text-muted-foreground">
                    {counts[tipoActivo] === 0
                      ? `Todavía no se han enviado ${etiquetaTipo} a la gestoría.`
                      : "No hay resultados con los filtros aplicados."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b transition-colors ${r.aviso === "peligro" ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-muted/30"}`}
                  >
                    {columnasRender.map((c) => columnDefs[c.campo]?.td(r))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>

      <div className="text-xs text-muted-foreground text-right">
        {filtered.length} de {counts[tipoActivo]} {etiquetaTipo}
      </div>
    </div>
  );
}
