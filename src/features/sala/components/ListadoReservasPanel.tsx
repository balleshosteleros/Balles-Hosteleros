"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEur, formatNumero } from "@/shared/lib/numero";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  colVisible,
  ordenarColumnas,
  coincideBusquedaUniversal,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
  type ToolbarFiltroActivo,
  type ToolbarFiltroTipo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { IOActions } from "@/shared/io";
import { listadoReservasIO } from "@/features/sala/io/listado-reservas.io";
import {
  getListadoReservas,
  type ListadoReservaRow,
} from "@/features/sala/actions/listado-reservas-actions";
import {
  ESTADOS_RESERVA,
  ESTADO_RESERVA_LABELS,
  ESTADO_BADGE_CLASS,
  TIPO_RESERVA_CATEGORIA_LABELS,
  origenLabel,
  zonaLabel,
  type EstadoReserva,
} from "@/features/sala/data/reservas";

/** Filas por hoja. Con un año entero de reservas pintarlas todas ahoga al navegador. */
const POR_PAGINA = 100;

/**
 * Cómo se pinta y se filtra cada columna del listado.
 *
 * Se declaran en una tabla en vez de escribir cuarenta bloques de JSX: son
 * muchas columnas y todas se comportan igual (una cabecera con su filtro y una
 * celda con su valor). `valor` es además lo que usan el filtro, el orden y la
 * exportación, así que lo que se ve y lo que se exporta no se pueden separar.
 */
interface ColumnaDef {
  campo: string;
  label: string;
  /** Sin filtro si se omite. */
  filtro?: ToolbarFiltroTipo;
  /** Opciones del filtro de lista. Si es función, se calculan de los datos. */
  opciones?: string[] | ((filas: ListadoReservaRow[]) => string[]);
  ordenable?: boolean;
  align?: "left" | "right" | "center";
  /** Nunca se puede ocultar. */
  bloqueada?: boolean;
  /** Valor crudo con el que se filtra, se ordena y se exporta. */
  valor: (f: ListadoReservaRow) => unknown;
  /** Cómo se pinta en la tabla. Por defecto, el valor tal cual. */
  celda?: (f: ListadoReservaRow) => ReactNode;
}

/** Marca de sí/no. En blanco cuando no aplica, para no ensuciar la tabla. */
function Si({ v }: { v: boolean }) {
  return v ? <span>Sí</span> : <span className="text-muted-foreground">—</span>;
}

/** Fecha ISO (YYYY-MM-DD) a dd/mm/aaaa, sin tocar zonas horarias. */
function fechaCorta(iso: string): string {
  if (!iso || iso.length < 10) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Marca de tiempo a "dd/mm/aaaa hh:mm". */
function marcaTiempo(iso: string): string {
  if (!iso) return "";
  const fecha = fechaCorta(iso);
  const hora = iso.length >= 16 ? iso.slice(11, 16) : "";
  return hora ? `${fecha} ${hora}` : fecha;
}

/** Valores distintos que aparecen en una columna, para el filtro de lista. */
function valoresDe(filas: ListadoReservaRow[], get: (f: ListadoReservaRow) => string): string[] {
  const set = new Set<string>();
  for (const f of filas) {
    const v = get(f).trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

const COLUMNAS: ColumnaDef[] = [
  // ── Quién ──────────────────────────────────────────────────────────
  {
    campo: "cliente",
    label: "Cliente",
    filtro: "texto",
    ordenable: true,
    bloqueada: true,
    valor: (f) => f.cliente,
  },
  { campo: "telefono", label: "Teléfono", filtro: "texto", valor: (f) => f.telefono },
  { campo: "email", label: "Email", filtro: "texto", valor: (f) => f.email },
  {
    campo: "clienteClasificacion",
    label: "Clasificación",
    filtro: "lista",
    opciones: (fs) => valoresDe(fs, (f) => f.clienteClasificacion),
    valor: (f) => f.clienteClasificacion,
  },
  {
    campo: "clienteVisitas",
    label: "Visitas",
    filtro: "numero",
    ordenable: true,
    align: "right",
    valor: (f) => f.clienteVisitas,
    celda: (f) => formatNumero(f.clienteVisitas),
  },
  {
    campo: "clienteUltimaVisita",
    label: "Última visita",
    filtro: "fecha",
    ordenable: true,
    valor: (f) => f.clienteUltimaVisita,
    celda: (f) => fechaCorta(f.clienteUltimaVisita),
  },

  // ── Cuándo ─────────────────────────────────────────────────────────
  {
    campo: "fecha",
    label: "Fecha",
    filtro: "fecha",
    ordenable: true,
    valor: (f) => f.fecha,
    celda: (f) => fechaCorta(f.fecha),
  },
  { campo: "hora", label: "Hora", filtro: "texto", ordenable: true, valor: (f) => f.hora },
  {
    campo: "turno",
    label: "Turno",
    filtro: "lista",
    opciones: ["COMIDA", "CENA"],
    valor: (f) => f.turno,
    celda: (f) => (f.turno === "COMIDA" ? "Comida" : f.turno === "CENA" ? "Cena" : ""),
  },
  {
    campo: "comensales",
    label: "Comensales",
    filtro: "numero",
    ordenable: true,
    align: "right",
    valor: (f) => f.comensales,
    celda: (f) => formatNumero(f.comensales),
  },
  {
    campo: "duracionMinutos",
    label: "Duración",
    filtro: "numero",
    ordenable: true,
    align: "right",
    valor: (f) => f.duracionMinutos,
    celda: (f) => (f.duracionMinutos == null ? "" : `${formatNumero(f.duracionMinutos)} min`),
  },

  // ── Dónde ──────────────────────────────────────────────────────────
  {
    campo: "zona",
    label: "Zona",
    filtro: "lista",
    opciones: (fs) => valoresDe(fs, (f) => f.zona),
    valor: (f) => f.zona,
    celda: (f) => (f.zona ? zonaLabel(f.zona) : ""),
  },
  { campo: "mesa", label: "Mesa", filtro: "texto", valor: (f) => f.mesa },

  // ── Situación ──────────────────────────────────────────────────────
  {
    campo: "estado",
    label: "Estado",
    filtro: "lista",
    opciones: ESTADOS_RESERVA as unknown as string[],
    valor: (f) => f.estado,
    celda: (f) => {
      if (!f.estado) return <span className="text-muted-foreground">—</span>;
      const e = f.estado as EstadoReserva;
      return (
        <Badge variant="outline" className={cn("font-normal", ESTADO_BADGE_CLASS[e])}>
          {ESTADO_RESERVA_LABELS[e] ?? f.estado}
        </Badge>
      );
    },
  },
  {
    campo: "origen",
    label: "Origen",
    filtro: "lista",
    // El catálogo de orígenes es abierto (las campañas crean los suyos), así
    // que las opciones salen de lo que realmente hay en los datos.
    opciones: (fs) => valoresDe(fs, (f) => origenLabel(f.origen)),
    valor: (f) => origenLabel(f.origen),
  },
  {
    campo: "etiquetas",
    label: "Etiquetas",
    filtro: "lista",
    opciones: (fs) => {
      const set = new Set<string>();
      for (const f of fs) for (const e of f.etiquetas) set.add(e);
      return [...set].sort((a, b) => a.localeCompare(b, "es"));
    },
    valor: (f) => f.etiquetas,
    celda: (f) =>
      f.etiquetas.length === 0 ? (
        ""
      ) : (
        <span className="flex flex-wrap gap-1">
          {f.etiquetas.map((e) => (
            <Badge key={e} variant="secondary" className="font-normal">
              {e}
            </Badge>
          ))}
        </span>
      ),
  },
  { campo: "observaciones", label: "Observaciones", filtro: "texto", valor: (f) => f.observaciones },

  // ── Ticket ─────────────────────────────────────────────────────────
  {
    campo: "ticket",
    label: "Ticket",
    filtro: "texto",
    // Columna resumen: qué compró y cuánto pagó, más el aviso de que el código
    // sigue sin canjear. Es la que da sentido al check de arriba.
    valor: (f) =>
      [f.ticketProducto, f.ticketImporte != null ? formatEur(f.ticketImporte) : ""]
        .filter(Boolean)
        .join(" · "),
    celda: (f) => {
      if (!f.ticketProducto && f.ticketImporte == null) return "";
      return (
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{f.ticketProducto || "Ticket"}</span>
          <span className="text-muted-foreground">
            {f.ticketUnidades && f.ticketUnidades > 1 ? `${f.ticketUnidades} × ` : ""}
            {formatEur(f.ticketImporte)}
          </span>
          {f.esCompraTicket && (
            <Badge
              variant="outline"
              className="w-fit border-amber-600/40 bg-amber-600/20 font-normal text-amber-700 dark:text-amber-400"
            >
              Sin canjear
            </Badge>
          )}
        </span>
      );
    },
  },
  { campo: "ticketCodigo", label: "Código ticket", filtro: "texto", valor: (f) => f.ticketCodigo },
  {
    campo: "ticketUnidades",
    label: "Unidades ticket",
    filtro: "numero",
    ordenable: true,
    align: "right",
    valor: (f) => f.ticketUnidades,
    celda: (f) => formatNumero(f.ticketUnidades),
  },
  {
    campo: "ticketImporte",
    label: "Importe ticket",
    filtro: "numero",
    ordenable: true,
    align: "right",
    valor: (f) => f.ticketImporte,
    celda: (f) => formatEur(f.ticketImporte),
  },
  {
    campo: "ticketIva",
    label: "IVA ticket",
    filtro: "numero",
    align: "right",
    valor: (f) => f.ticketIva,
    celda: (f) => (f.ticketIva == null ? "" : `${formatNumero(f.ticketIva)} %`),
  },
  {
    campo: "ticketCanjeHasta",
    label: "Canjear hasta",
    filtro: "fecha",
    ordenable: true,
    valor: (f) => f.ticketCanjeHasta,
    celda: (f) => fechaCorta(f.ticketCanjeHasta),
  },
  {
    campo: "ticketPagadoAt",
    label: "Pagado el",
    filtro: "fecha",
    ordenable: true,
    valor: (f) => f.ticketPagadoAt.slice(0, 10),
    celda: (f) => marcaTiempo(f.ticketPagadoAt),
  },

  // ── Dinero y compromiso ────────────────────────────────────────────
  {
    campo: "tipoCategoria",
    label: "Tipo de reserva",
    filtro: "lista",
    opciones: (fs) => valoresDe(fs, (f) => f.tipoCategoria),
    valor: (f) => f.tipoCategoria,
    celda: (f) =>
      f.tipoCategoria
        ? TIPO_RESERVA_CATEGORIA_LABELS[
            f.tipoCategoria as keyof typeof TIPO_RESERVA_CATEGORIA_LABELS
          ] ?? f.tipoCategoria
        : "",
  },
  {
    campo: "importePagado",
    label: "Importe pagado",
    filtro: "numero",
    ordenable: true,
    align: "right",
    valor: (f) => f.importePagado,
    celda: (f) => formatEur(f.importePagado),
  },
  {
    campo: "tieneGarantia",
    label: "Con garantía",
    filtro: "booleano",
    align: "center",
    valor: (f) => f.tieneGarantia,
    celda: (f) => <Si v={f.tieneGarantia} />,
  },
  {
    campo: "garantiaImporte",
    label: "Importe garantía",
    filtro: "numero",
    ordenable: true,
    align: "right",
    valor: (f) => f.garantiaImporte,
    celda: (f) => formatEur(f.garantiaImporte),
  },
  {
    campo: "tarjetaIntroducida",
    label: "Tarjeta",
    filtro: "booleano",
    align: "center",
    valor: (f) => f.tarjetaIntroducida,
    celda: (f) => <Si v={f.tarjetaIntroducida} />,
  },
  {
    campo: "pagoPendiente",
    label: "Pago pendiente",
    filtro: "booleano",
    align: "center",
    valor: (f) => f.pagoPendiente,
    celda: (f) => <Si v={f.pagoPendiente} />,
  },

  // ── Cupón ──────────────────────────────────────────────────────────
  { campo: "cupon", label: "Cupón", filtro: "texto", valor: (f) => f.cupon },
  {
    campo: "cuponTitulo",
    label: "Nombre del cupón",
    filtro: "lista",
    opciones: (fs) => valoresDe(fs, (f) => f.cuponTitulo),
    valor: (f) => f.cuponTitulo,
  },

  // ── Trazabilidad ───────────────────────────────────────────────────
  {
    campo: "createdAt",
    label: "Creada el",
    filtro: "fecha",
    ordenable: true,
    valor: (f) => f.createdAt.slice(0, 10),
    celda: (f) => marcaTiempo(f.createdAt),
  },
  {
    campo: "reconfirmadaAt",
    label: "Reconfirmada el",
    filtro: "fecha",
    valor: (f) => f.reconfirmadaAt.slice(0, 10),
    celda: (f) => marcaTiempo(f.reconfirmadaAt),
  },
  {
    campo: "bloqueada",
    label: "Bloqueada",
    filtro: "booleano",
    align: "center",
    valor: (f) => f.bloqueada,
    celda: (f) => <Si v={f.bloqueada} />,
  },
  {
    campo: "vinculacionEstado",
    label: "Vinculación",
    filtro: "lista",
    opciones: (fs) => valoresDe(fs, (f) => f.vinculacionEstado),
    valor: (f) => f.vinculacionEstado,
  },
  {
    campo: "externalOrigen",
    label: "Canal externo",
    filtro: "lista",
    opciones: (fs) => valoresDe(fs, (f) => f.externalOrigen),
    valor: (f) => f.externalOrigen,
  },
  { campo: "externalId", label: "ID externo", filtro: "texto", valor: (f) => f.externalId },
  {
    campo: "emailConfirmacionAt",
    label: "Email confirmación",
    filtro: "fecha",
    valor: (f) => f.emailConfirmacionAt.slice(0, 10),
    celda: (f) => marcaTiempo(f.emailConfirmacionAt),
  },
  {
    campo: "emailReconfirmacionAt",
    label: "Email reconfirmación",
    filtro: "fecha",
    valor: (f) => f.emailReconfirmacionAt.slice(0, 10),
    celda: (f) => marcaTiempo(f.emailReconfirmacionAt),
  },
  {
    campo: "emailRecordatorioAt",
    label: "Email recordatorio",
    filtro: "fecha",
    valor: (f) => f.emailRecordatorioAt.slice(0, 10),
    celda: (f) => marcaTiempo(f.emailRecordatorioAt),
  },
  {
    campo: "emailCancelacionAt",
    label: "Email cancelación",
    filtro: "fecha",
    valor: (f) => f.emailCancelacionAt.slice(0, 10),
    celda: (f) => marcaTiempo(f.emailCancelacionAt),
  },
  {
    campo: "emailValoracionAt",
    label: "Email valoración",
    filtro: "fecha",
    valor: (f) => f.emailValoracionAt.slice(0, 10),
    celda: (f) => marcaTiempo(f.emailValoracionAt),
  },
];

/** Columnas que arrancan ocultas: el listado abre legible, no con 40 columnas. */
const OCULTAS_POR_DEFECTO = new Set([
  "clienteUltimaVisita",
  "duracionMinutos",
  "ticketCodigo",
  "ticketUnidades",
  "ticketImporte",
  "ticketIva",
  "ticketCanjeHasta",
  "ticketPagadoAt",
  "garantiaImporte",
  "tarjetaIntroducida",
  "pagoPendiente",
  "cupon",
  "cuponTitulo",
  "reconfirmadaAt",
  "bloqueada",
  "vinculacionEstado",
  "externalOrigen",
  "externalId",
  "emailConfirmacionAt",
  "emailReconfirmacionAt",
  "emailRecordatorioAt",
  "emailCancelacionAt",
  "emailValoracionAt",
]);

/** Acceso genérico a un campo por su nombre de columna. */
const VALOR_POR_CAMPO = new Map(COLUMNAS.map((c) => [c.campo, c.valor]));
function acceso(fila: ListadoReservaRow, campo: string): unknown {
  const get = VALOR_POR_CAMPO.get(campo);
  return get ? get(fila) : undefined;
}

/**
 * Enlace al día de una reserva: abre el calendario de Sala en su fecha y turno,
 * que es donde el usuario puede verla y tocarla.
 */
function enlaceDia(f: ListadoReservaRow): string {
  const params = new URLSearchParams({ fecha: f.fecha });
  if (f.turno === "COMIDA" || f.turno === "CENA") params.set("turno", f.turno);
  return `/sala/reservas?${params.toString()}`;
}

export function ListadoReservasPanel({
  desde,
  hasta,
  campoFecha,
  periodoLabel,
}: {
  desde: string;
  hasta: string;
  campoFecha: "fecha" | "created_at";
  /** Qué periodo se está mirando, para el título y el nombre del informe. */
  periodoLabel: string;
}) {
  const [reservas, setReservas] = useState<ListadoReservaRow[]>([]);
  const [comprasTicket, setComprasTicket] = useState<ListadoReservaRow[]>([]);
  /**
   * Mostrar también las compras de Ticket que nadie ha canjeado todavía. Apagado
   * por defecto: son compras, no reservas, y mezclarlas sin pedirlo falsearía la
   * lectura del listado.
   */
  const [verComprasTicket, setVerComprasTicket] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>(() => {
    const inicial: ToolbarColumnaVisible = {};
    for (const c of COLUMNAS) inicial[c.campo] = !OCULTAS_POR_DEFECTO.has(c.campo);
    return inicial;
  });
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [pagina, setPagina] = useState(1);
  const [pending, startTransition] = useTransition();

  const recargar = () => {
    startTransition(async () => {
      const res = await getListadoReservas({
        desde,
        hasta,
        campoFecha,
        incluirComprasTicket: verComprasTicket,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo cargar el listado de reservas");
        return;
      }
      setReservas(res.reservas);
      setComprasTicket(res.comprasTicket);
    });
  };

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, campoFecha, verComprasTicket]);

  /**
   * Todo lo que se puede llegar a ver, antes de filtrar.
   *
   * Las compras sin canjear van primero: son las que el usuario acaba de pedir
   * al marcar el check, y no tienen día reservado por el que ordenarse entre
   * las reservas, así que al final de la lista se perderían de vista.
   */
  const universo = useMemo(
    () => (verComprasTicket ? [...comprasTicket, ...reservas] : reservas),
    [reservas, comprasTicket, verComprasTicket],
  );

  const filtradas = useMemo(() => {
    let lista = universo;
    if (busqueda.trim()) {
      lista = lista.filter((f) => coincideBusquedaUniversal(f, busqueda));
    }
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [universo, busqueda, filtros, orden]);

  // Al buscar o filtrar se vuelve a la primera hoja: quedarse en la 7 con un
  // filtro que deja 20 resultados enseña una tabla vacía.
  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtros, verComprasTicket]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA,
  );

  /**
   * Reservas y compras contadas por separado.
   *
   * Una compra de ticket sin canjear NO es una reserva: mientras el código no se
   * canjee, no puede sumar en el total de reservas ni en ninguna estadística.
   */
  const totalReservas = filtradas.filter((f) => !f.esCompraTicket).length;
  const totalCompras = filtradas.filter((f) => f.esCompraTicket).length;

  const columnasDef: ToolbarColumna[] = useMemo(
    () =>
      COLUMNAS.map((c) => ({
        campo: c.campo,
        label: c.label,
        bloqueada: c.bloqueada,
      })),
    [],
  );

  const columnasRender = useMemo(
    () =>
      ordenarColumnas(columnasDef, columnasOrden).filter(
        (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
      ),
    [columnasDef, columnasOrden, columnasVisibles],
  );

  const defPorCampo = useMemo(() => new Map(COLUMNAS.map((c) => [c.campo, c])), []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Listado de reservas</h2>
          <p className="text-xs text-muted-foreground">
            {periodoLabel} ·{" "}
            <span className="font-medium text-foreground">
              {formatNumero(totalReservas)}{" "}
              {totalReservas === 1 ? "reserva" : "reservas"}
            </span>
            {verComprasTicket && totalCompras > 0 && (
              <>
                {" "}
                · {formatNumero(totalCompras)}{" "}
                {totalCompras === 1 ? "compra de ticket sin canjear" : "compras de ticket sin canjear"}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="ver-compras-ticket"
              checked={verComprasTicket}
              onCheckedChange={(v) => setVerComprasTicket(v === true)}
            />
            <Label htmlFor="ver-compras-ticket" className="cursor-pointer text-xs font-normal">
              Ver compras de ticket sin canjear
            </Label>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={recargar}
            disabled={pending}
            title="Recargar"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
          </Button>
        </div>
      </div>

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar en el listado"
        ocultarNuevo
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        viewKey="sala/listado-reservas"
        extraDerecha={
          // El informe sale con EXACTAMENTE lo que hay en pantalla: mismas filas
          // tras los filtros y mismas columnas visibles, en su mismo orden.
          <IOActions
            config={listadoReservasIO}
            exportRecords={filtradas}
            context={{
              periodo: periodoLabel,
              columnas: columnasRender.map((c) => c.campo),
            }}
          />
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {columnasRender.map((col) => {
                  const def = defPorCampo.get(col.campo);
                  if (!def) return null;
                  const opciones =
                    typeof def.opciones === "function"
                      ? def.opciones(universo)
                      : def.opciones;
                  return (
                    <TableColumnHeader
                      key={def.campo}
                      label={def.label}
                      campo={def.campo}
                      filtroTipo={def.filtro}
                      opciones={opciones}
                      filtros={filtros}
                      onFiltrosChange={setFiltros}
                      ordenable={def.ordenable}
                      orden={orden}
                      onOrdenChange={setOrden}
                      align={def.align}
                    />
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr
                  key={`${f.tipoFila}-${f.id}`}
                  className={cn(
                    "border-b hover:bg-muted/20",
                    f.esCompraTicket && "bg-amber-500/5",
                  )}
                >
                  {columnasRender.map((col) => {
                    const def = defPorCampo.get(col.campo);
                    if (!def) return null;
                    const contenido = def.celda ? def.celda(f) : String(def.valor(f) ?? "");
                    const vacio =
                      contenido === "" || contenido === null || contenido === undefined;

                    // Pulsar el nombre abre la ficha del cliente; pulsar
                    // cualquier otro dato lleva al día de esa reserva. Una
                    // compra sin canjear no tiene día al que ir, así que sus
                    // otras celdas no navegan.
                    const esCliente = def.campo === "cliente";
                    const destino = esCliente
                      ? f.clienteId
                        ? `/sala/clientes?cliente=${f.clienteId}`
                        : null
                      : f.esCompraTicket || !f.fecha
                        ? null
                        : enlaceDia(f);

                    return (
                      <td
                        key={def.campo}
                        className={cn(
                          "px-3 py-2 align-top",
                          def.align === "right" && "text-right",
                          def.align === "center" && "text-center",
                          esCliente && "font-medium",
                        )}
                      >
                        {vacio ? (
                          <span className="text-muted-foreground">—</span>
                        ) : destino ? (
                          <Link
                            href={destino}
                            className="hover:underline"
                            title={
                              esCliente
                                ? "Abrir la ficha del cliente"
                                : "Ir al día de esta reserva"
                            }
                          >
                            {contenido}
                          </Link>
                        ) : (
                          contenido
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtradas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {pending ? "Cargando reservas…" : "No hay reservas que coincidan."}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-4 border-t px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {(paginaActual - 1) * POR_PAGINA + 1}–
              {Math.min(paginaActual * POR_PAGINA, filtradas.length)} de{" "}
              {formatNumero(filtradas.length)}
            </span>
            {totalPaginas > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={paginaActual === 1}
                  onClick={() => setPagina(paginaActual - 1)}
                >
                  Anterior
                </Button>
                <span className="px-2 text-muted-foreground">
                  Hoja {paginaActual} de {totalPaginas}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={paginaActual === totalPaginas}
                  onClick={() => setPagina(paginaActual + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
