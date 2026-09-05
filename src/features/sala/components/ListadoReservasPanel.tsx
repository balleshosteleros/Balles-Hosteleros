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
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona, formatHoraEnZona } from "@/features/empresa/lib/zona-horaria";
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
  /**
   * Cómo se pinta en la tabla. Por defecto, el valor tal cual.
   *
   * `ahora` es la marca de tiempo con la que se pintó la tabla, para las celdas
   * que comparan contra el presente (un plazo vencido). Se pasa en lugar de
   * preguntar la hora dentro de la celda: así toda la tabla juzga los plazos
   * con el mismo instante y no cambia de aspecto entre renders.
   */
  celda?: (f: ListadoReservaRow, ctx: { ahora: number; tz: string }) => ReactNode;
}

/** Marca de sí/no. En blanco cuando no aplica, para no ensuciar la tabla. */
function Si({ v }: { v: boolean }) {
  return v ? <span>Sí</span> : <span className="text-muted-foreground">—</span>;
}

/**
 * Cómo se lee cada estado de cobro y de qué color se pinta.
 *
 * El color no decora: dice si hay algo que hacer. Verde es dinero cobrado o
 * asunto cerrado; ámbar es "está esperando a alguien"; rojo es que algo falló y
 * hay que mirarlo; gris es que ya no aplica.
 */
const ESTADO_COBRO: Record<string, { label: string; clase: string }> = {
  pendiente: {
    label: "Pendiente",
    clase: "border-amber-600/40 bg-amber-600/15 text-amber-700 dark:text-amber-400",
  },
  solicitada: {
    label: "Solicitada",
    clase: "border-amber-600/40 bg-amber-600/15 text-amber-700 dark:text-amber-400",
  },
  retenida: {
    label: "Retenida",
    clase: "border-sky-600/40 bg-sky-600/15 text-sky-700 dark:text-sky-400",
  },
  guardada: {
    label: "Tarjeta guardada",
    clase: "border-sky-600/40 bg-sky-600/15 text-sky-700 dark:text-sky-400",
  },
  cobrada: {
    label: "Cobrada",
    clase: "border-emerald-600/40 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  },
  liberada: {
    label: "Liberada",
    clase: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
  caducada: {
    label: "Caducada",
    clase: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
  perdonada: {
    label: "Perdonada",
    clase: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
  fallida: {
    label: "Fallida",
    clase: "border-red-600/40 bg-red-600/15 text-red-700 dark:text-red-400",
  },
  error: {
    label: "Error",
    clase: "border-red-600/40 bg-red-600/15 text-red-700 dark:text-red-400",
  },
};

/** Etiqueta de un estado de cobro. Un estado desconocido se enseña tal cual. */
function estadoCobroLabel(estado: string): string {
  if (!estado) return "";
  return ESTADO_COBRO[estado]?.label ?? estado;
}

function EstadoCobro({ estado }: { estado: string }) {
  if (!estado) return <span className="text-muted-foreground">—</span>;
  const def = ESTADO_COBRO[estado];
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", def?.clase ?? "border-muted-foreground/30 bg-muted")}
    >
      {def?.label ?? estado}
    </Badge>
  );
}

/** Fecha ISO (YYYY-MM-DD) a dd/mm/aaaa, sin tocar zonas horarias. */
function fechaCorta(iso: string): string {
  if (!iso || iso.length < 10) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Marca de tiempo a "dd/mm/aaaa hh:mm" en la zona horaria de la empresa.
 *
 * La base de datos guarda estos instantes en UTC. Cortar el texto ISO a pelo
 * enseñaría la hora de Greenwich: una garantía retenida a las 00:30 de Madrid
 * aparecería como del día anterior, y con eso se decide si un plazo de cobro
 * está vencido. Se convierte de verdad, con la zona de la empresa.
 */
function marcaTiempo(iso: string, tz: string): string {
  if (!iso) return "";
  const fecha = formatFechaEnZona(iso, tz);
  if (!fecha) return "";
  const hora = formatHoraEnZona(iso, tz);
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
  {
    // Las etiquetas (las de la reserva y las del cliente, ya unidas en el
    // servidor) van pegadas al teléfono: ocupan mucho menos que en una columna
    // propia, que salía casi siempre vacía.
    campo: "telefono",
    label: "Teléfono",
    filtro: "texto",
    valor: (f) => f.telefono,
    celda: (f) => {
      if (!f.telefono && f.etiquetas.length === 0) return "";
      return (
        <span className="flex flex-wrap items-center gap-1">
          {f.telefono ? <span>{f.telefono}</span> : null}
          {f.etiquetas.map((e) => (
            <Badge key={e} variant="secondary" className="font-normal">
              {e}
            </Badge>
          ))}
        </span>
      );
    },
  },
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
    celda: (f, { tz }) => marcaTiempo(f.ticketPagadoAt, tz),
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

  // ── Garantía ───────────────────────────────────────────────────────
  {
    campo: "tieneGarantia",
    label: "Con garantía",
    filtro: "booleano",
    align: "center",
    valor: (f) => f.tieneGarantia,
    celda: (f) => <Si v={f.tieneGarantia} />,
  },
  {
    campo: "garantiaEstado",
    label: "Estado garantía",
    filtro: "lista",
    // Solo se ofrecen los estados que de verdad hay en pantalla: una lista con
    // los diez posibles obligaría a buscar el que existe entre los que no.
    opciones: (fs) => valoresDe(fs, (f) => estadoCobroLabel(f.garantiaEstado)),
    valor: (f) => estadoCobroLabel(f.garantiaEstado),
    celda: (f) => <EstadoCobro estado={f.garantiaEstado} />,
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
    campo: "garantiaTarjeta",
    label: "Tarjeta garantía",
    filtro: "texto",
    valor: (f) => f.garantiaTarjeta,
  },
  {
    campo: "garantiaSolicitadaAt",
    label: "Garantía solicitada",
    filtro: "fecha",
    ordenable: true,
    valor: (f) => f.garantiaSolicitadaAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.garantiaSolicitadaAt, tz),
  },
  {
    campo: "garantiaRetenidaAt",
    label: "Garantía retenida",
    filtro: "fecha",
    ordenable: true,
    valor: (f) => f.garantiaRetenidaAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.garantiaRetenidaAt, tz),
  },
  {
    campo: "garantiaCobradaAt",
    label: "Garantía cobrada",
    filtro: "fecha",
    ordenable: true,
    valor: (f) => f.garantiaCobradaAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.garantiaCobradaAt, tz),
  },
  {
    campo: "garantiaCaptureDeadline",
    label: "Cobrar antes de",
    filtro: "fecha",
    ordenable: true,
    // Fecha con dientes: pasado ese día el banco suelta el dinero y la garantía
    // ya no se puede cobrar, así que se avisa en rojo mientras siga retenida.
    // El "ahora" llega desde fuera (`AHORA`) y no de un `Date.now()` aquí: si
    // cada render preguntara la hora, la misma fila podría cambiar de color sin
    // que nada haya cambiado en los datos.
    valor: (f) => f.garantiaCaptureDeadline.slice(0, 10),
    celda: (f, { ahora, tz }) => {
      if (!f.garantiaCaptureDeadline) return "";
      const urgente =
        f.garantiaEstado === "retenida" && Date.parse(f.garantiaCaptureDeadline) < ahora;
      return (
        <span className={cn(urgente && "font-medium text-red-600 dark:text-red-400")}>
          {marcaTiempo(f.garantiaCaptureDeadline, tz)}
        </span>
      );
    },
  },
  {
    campo: "garantiaLimiteAt",
    label: "Límite garantía",
    filtro: "fecha",
    valor: (f) => f.garantiaLimiteAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.garantiaLimiteAt, tz),
  },

  // ── Política de cancelación ────────────────────────────────────────
  {
    campo: "tieneCancelacion",
    label: "Con cancelación",
    filtro: "booleano",
    align: "center",
    valor: (f) => f.tieneCancelacion,
    celda: (f) => <Si v={f.tieneCancelacion} />,
  },
  {
    campo: "cancelacionEstado",
    label: "Estado cancelación",
    filtro: "lista",
    opciones: (fs) => valoresDe(fs, (f) => estadoCobroLabel(f.cancelacionEstado)),
    valor: (f) => estadoCobroLabel(f.cancelacionEstado),
    celda: (f) => <EstadoCobro estado={f.cancelacionEstado} />,
  },
  {
    campo: "cancelacionImporte",
    label: "Importe cancelación",
    filtro: "numero",
    ordenable: true,
    align: "right",
    valor: (f) => f.cancelacionImporte,
    celda: (f) => formatEur(f.cancelacionImporte),
  },
  {
    campo: "cancelacionTarjeta",
    label: "Tarjeta cancelación",
    filtro: "texto",
    valor: (f) => f.cancelacionTarjeta,
  },
  {
    campo: "cancelacionGuardadaAt",
    label: "Tarjeta guardada el",
    filtro: "fecha",
    valor: (f) => f.cancelacionGuardadaAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.cancelacionGuardadaAt, tz),
  },
  {
    campo: "cancelacionCobradaAt",
    label: "Cancelación cobrada",
    filtro: "fecha",
    ordenable: true,
    valor: (f) => f.cancelacionCobradaAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.cancelacionCobradaAt, tz),
  },
  {
    campo: "cancelacionIntentos",
    label: "Intentos de cobro",
    filtro: "numero",
    ordenable: true,
    align: "right",
    valor: (f) => f.cancelacionIntentos,
    celda: (f) => formatNumero(f.cancelacionIntentos),
  },
  {
    campo: "cancelacionUltimoIntentoAt",
    label: "Último intento",
    filtro: "fecha",
    valor: (f) => f.cancelacionUltimoIntentoAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.cancelacionUltimoIntentoAt, tz),
  },
  {
    campo: "cancelacionProximoIntentoAt",
    label: "Próximo intento",
    filtro: "fecha",
    ordenable: true,
    valor: (f) => f.cancelacionProximoIntentoAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.cancelacionProximoIntentoAt, tz),
  },
  {
    campo: "cancelacionError",
    label: "Motivo del fallo",
    filtro: "texto",
    valor: (f) => f.cancelacionError,
    celda: (f) =>
      f.cancelacionError ? (
        <span className="text-red-600 dark:text-red-400">{f.cancelacionError}</span>
      ) : (
        ""
      ),
  },

  // ── Decisión sobre el cobro ────────────────────────────────────────
  {
    campo: "cobroSinDecidir",
    label: "Sin decidir",
    filtro: "booleano",
    align: "center",
    // La columna que de verdad importa: dinero que se puede cobrar y que nadie
    // ha cobrado ni perdonado. Va en rojo porque es lo único de esta tabla que
    // reclama que alguien haga algo.
    valor: (f) => f.cobroSinDecidir,
    celda: (f) =>
      f.cobroSinDecidir ? (
        <Badge
          variant="outline"
          className="border-red-600/40 bg-red-600/15 font-normal text-red-700 dark:text-red-400"
        >
          Sin decidir
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    campo: "politicaIncumplidaAt",
    label: "Incumplió el",
    filtro: "fecha",
    ordenable: true,
    valor: (f) => f.politicaIncumplidaAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.politicaIncumplidaAt, tz),
  },
  {
    campo: "cobroMotivo",
    label: "Motivo del cobro",
    filtro: "lista",
    opciones: (fs) => valoresDe(fs, (f) => f.cobroMotivo),
    valor: (f) => f.cobroMotivo,
  },
  {
    campo: "cobroPerdonadoAt",
    label: "Perdonado el",
    filtro: "fecha",
    valor: (f) => f.cobroPerdonadoAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.cobroPerdonadoAt, tz),
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
    celda: (f, { tz }) => marcaTiempo(f.createdAt, tz),
  },
  {
    campo: "reconfirmadaAt",
    label: "Reconfirmada el",
    filtro: "fecha",
    valor: (f) => f.reconfirmadaAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.reconfirmadaAt, tz),
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
    celda: (f, { tz }) => marcaTiempo(f.emailConfirmacionAt, tz),
  },
  {
    campo: "emailReconfirmacionAt",
    label: "Email reconfirmación",
    filtro: "fecha",
    valor: (f) => f.emailReconfirmacionAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.emailReconfirmacionAt, tz),
  },
  {
    campo: "emailRecordatorioAt",
    label: "Email recordatorio",
    filtro: "fecha",
    valor: (f) => f.emailRecordatorioAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.emailRecordatorioAt, tz),
  },
  {
    campo: "emailCancelacionAt",
    label: "Email cancelación",
    filtro: "fecha",
    valor: (f) => f.emailCancelacionAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.emailCancelacionAt, tz),
  },
  {
    campo: "emailValoracionAt",
    label: "Email valoración",
    filtro: "fecha",
    valor: (f) => f.emailValoracionAt.slice(0, 10),
    celda: (f, { tz }) => marcaTiempo(f.emailValoracionAt, tz),
  },
];

/**
 * Desde dónde se abre el listado. No cambia los datos: cambia con qué columnas
 * arranca, porque quien viene de Analítica quiere leer reservas y quien viene
 * del botón de cobros quiere leer dinero.
 */
export type ListadoEnfoque = "general" | "cobros";

/** Columnas que arrancan ocultas: el listado abre legible, no con 50 columnas. */
const OCULTAS_POR_DEFECTO = new Set([
  "clienteUltimaVisita",
  "duracionMinutos",
  "ticketCodigo",
  "ticketUnidades",
  "ticketImporte",
  "ticketIva",
  "ticketCanjeHasta",
  "ticketPagadoAt",
  "garantiaEstado",
  "garantiaImporte",
  "garantiaTarjeta",
  "garantiaSolicitadaAt",
  "garantiaRetenidaAt",
  "garantiaCobradaAt",
  "garantiaCaptureDeadline",
  "garantiaLimiteAt",
  "tieneCancelacion",
  "cancelacionEstado",
  "cancelacionImporte",
  "cancelacionTarjeta",
  "cancelacionGuardadaAt",
  "cancelacionCobradaAt",
  "cancelacionIntentos",
  "cancelacionUltimoIntentoAt",
  "cancelacionProximoIntentoAt",
  "cancelacionError",
  "cobroSinDecidir",
  "politicaIncumplidaAt",
  "cobroSinDecidir",
  "politicaIncumplidaAt",
  "cobroMotivo",
  "cobroPerdonadoAt",
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

/**
 * Con qué se abre la vista de cobros: quién es, cuándo viene y todo el dinero.
 *
 * Se declara en positivo (lo que SE VE) y no como excepciones a la lista de
 * arriba, porque aquí lo importante es que no falte ninguna columna de dinero
 * y eso se comprueba leyendo, no restando.
 */
/**
 * Con qué columnas arranca la vista de cobros.
 *
 * ⚠️ El ORDEN importa y es el de la tabla: lo que reclama una decisión va
 * DELANTE. Antes se encendían las 34 columnas de cobro, así que "sin decidir"
 * y el estado de la cancelación caían fuera de la pantalla, a la derecha del
 * todo, y una reserva con 4 € pendientes se leía como si no tuviera nada
 * (Iván, 4-sep). Lo demás sigue estando: se enciende desde el selector de
 * columnas cuando hace falta.
 */
const VISIBLES_COBROS = [
  "cliente",
  "fecha",
  "hora",
  "comensales",
  "estado",
  // Lo que hay que decidir, pegado al estado de la reserva.
  "cobroSinDecidir",
  "tipoCategoria",
  "cancelacionEstado",
  "cancelacionImporte",
  "garantiaEstado",
  "garantiaImporte",
  "cancelacionCobradaAt",
  "garantiaCobradaAt",
  "ticket",
  "importePagado",
  "origen",
];

/** Columnas con las que arranca el listado según de dónde se abra. */
function visiblesIniciales(enfoque: ListadoEnfoque): ToolbarColumnaVisible {
  const visibles: ToolbarColumnaVisible = {};
  if (enfoque === "cobros") {
    const set = new Set(VISIBLES_COBROS);
    for (const c of COLUMNAS) visibles[c.campo] = set.has(c.campo);
    return visibles;
  }
  for (const c of COLUMNAS) visibles[c.campo] = !OCULTAS_POR_DEFECTO.has(c.campo);
  return visibles;
}

/**
 * Una cifra del resumen de dinero.
 *
 * El importe manda (es lo que se viene a mirar) y debajo va en pequeño a cuántas
 * reservas corresponde, para que un número grande nunca quede sin contexto.
 */
function TarjetaImporte({
  titulo,
  importe,
  detalle,
  tono = "neutro",
}: {
  titulo: string;
  importe: number;
  detalle?: string;
  tono?: "neutro" | "bien" | "espera" | "mal";
}) {
  const tonos = {
    neutro: "text-foreground",
    bien: "text-emerald-600 dark:text-emerald-400",
    espera: "text-sky-600 dark:text-sky-400",
    mal: "text-red-600 dark:text-red-400",
  } as const;
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", tonos[tono])}>
        {formatEur(importe)}
      </p>
      {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
    </Card>
  );
}

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
  enfoque = "general",
  comprasTicketPorDefecto = false,
}: {
  desde: string;
  hasta: string;
  campoFecha: "fecha" | "created_at";
  /** Qué periodo se está mirando, para el título y el nombre del informe. */
  periodoLabel: string;
  /** Con qué columnas arranca la tabla. */
  enfoque?: ListadoEnfoque;
  /**
   * Arrancar con las compras de ticket sin canjear ya incluidas. En la vista de
   * cobros sí interesan de entrada: son dinero cobrado que todavía no se ha
   * consumido, justo lo que se viene a controlar aquí.
   */
  comprasTicketPorDefecto?: boolean;
}) {
  const [reservas, setReservas] = useState<ListadoReservaRow[]>([]);
  const [comprasTicket, setComprasTicket] = useState<ListadoReservaRow[]>([]);
  /**
   * Mostrar también las compras de Ticket que nadie ha canjeado todavía. Apagado
   * por defecto: son compras, no reservas, y mezclarlas sin pedirlo falsearía la
   * lectura del listado.
   */
  const [verComprasTicket, setVerComprasTicket] = useState(comprasTicketPorDefecto);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>(() =>
    visiblesIniciales(enfoque),
  );
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [pagina, setPagina] = useState(1);
  const [pending, startTransition] = useTransition();
  /**
   * Instante con el que se juzgan los plazos de la tabla.
   *
   * Se fija al cargar los datos y no en cada render: así todas las filas miden
   * su plazo contra el mismo momento, y una fila no puede cambiar de color por
   * un repintado cualquiera. Al recargar se vuelve a poner al día.
   */
  const [ahora, setAhora] = useState(() => Date.now());
  // Las horas de cobro se pintan en la zona de la empresa, no en la del
  // navegador: quien mira los cobros desde fuera de España vería otro día.
  const { empresaActual } = useEmpresa();
  const tz = empresaActual.zonaHoraria;

  const recargar = () => {
    startTransition(async () => {
      const res = await getListadoReservas({
        desde,
        hasta,
        campoFecha,
        incluirComprasTicket: verComprasTicket,
        // La vista de cobros solo enseña reservas con dinero aparejado. Una
        // reserva gratis no tiene nada que cobrar y solo ensucia el listado.
        soloConDinero: enfoque === "cobros",
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo cargar el listado de reservas");
        return;
      }
      setReservas(res.reservas);
      setComprasTicket(res.comprasTicket);
      setAhora(Date.now());
    });
  };

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, campoFecha, verComprasTicket, enfoque]);

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

  /**
   * Resumen de dinero de lo que hay AHORA en pantalla (después de filtrar).
   *
   * Se calcula sobre `filtradas` y no sobre todo el periodo a propósito: si el
   * usuario filtra por "garantía retenida", los totales tienen que hablar de esa
   * selección, que es justo la pregunta que estaba haciendo.
   *
   * Cada bloque separa lo COBRADO (dinero que ya está en la cuenta) de lo que
   * sigue EN EL AIRE (retenido o esperando), porque son dos realidades distintas
   * y sumarlas daría una cifra que no existe en ningún sitio.
   */
  const resumen = useMemo(() => {
    let garantiaRetenida = 0;
    let garantiaRetenidaN = 0;
    let garantiaCobrada = 0;
    let garantiaCobradaN = 0;
    let garantiaPendienteN = 0;
    let cancelacionCobrada = 0;
    let cancelacionCobradaN = 0;
    let cancelacionFallidaN = 0;
    let cancelacionPendienteN = 0;
    let ticketCobrado = 0;
    let ticketSinCanjearN = 0;
    let pagado = 0;
    // Dinero que se PUEDE cobrar y que nadie ha cobrado ni perdonado.
    let sinDecidir = 0;
    let sinDecidirN = 0;

    for (const f of filtradas) {
      if (f.garantiaEstado === "retenida") {
        garantiaRetenida += f.garantiaImporte ?? 0;
        garantiaRetenidaN += 1;
      }
      if (f.garantiaEstado === "cobrada") {
        garantiaCobrada += f.garantiaImporte ?? 0;
        garantiaCobradaN += 1;
      }
      if (f.garantiaEstado === "pendiente" || f.garantiaEstado === "solicitada") {
        garantiaPendienteN += 1;
      }

      if (f.cancelacionEstado === "cobrada") {
        cancelacionCobrada += f.cancelacionImporte ?? 0;
        cancelacionCobradaN += 1;
      }
      if (f.cancelacionEstado === "fallida" || f.cancelacionEstado === "error") {
        cancelacionFallidaN += 1;
      }
      if (f.cancelacionEstado === "pendiente" || f.cancelacionEstado === "guardada") {
        cancelacionPendienteN += 1;
      }

      if (f.esTicket) {
        ticketCobrado += f.ticketImporte ?? 0;
        if (f.esCompraTicket) ticketSinCanjearN += 1;
      }

      if (f.cobroSinDecidir) {
        // Se cobra lo que haya apartado: la garantía retenida o, si no, el
        // importe de la política de cancelación.
        sinDecidir +=
          f.garantiaEstado === "retenida"
            ? f.garantiaImporte ?? 0
            : f.cancelacionImporte ?? 0;
        sinDecidirN += 1;
      }

      // El importe pagado de una compra sin canjear ya se cuenta como ticket:
      // volver a sumarlo aquí lo contaría dos veces.
      if (!f.esCompraTicket) pagado += f.importePagado ?? 0;
    }

    return {
      garantiaRetenida,
      garantiaRetenidaN,
      garantiaCobrada,
      garantiaCobradaN,
      garantiaPendienteN,
      cancelacionCobrada,
      cancelacionCobradaN,
      cancelacionFallidaN,
      cancelacionPendienteN,
      ticketCobrado,
      ticketSinCanjearN,
      pagado,
      sinDecidir,
      sinDecidirN,
    };
  }, [filtradas]);

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
          <h2 className="text-lg font-semibold">
            {enfoque === "cobros" ? "Cobros, garantías y tickets" : "Listado de reservas"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {periodoLabel} ·{" "}
            <span className="font-medium text-foreground">
              {formatNumero(totalReservas)}{" "}
              {totalReservas === 1 ? "reserva" : "reservas"}
              {/* En cobros el listado ya viene recortado: se dice, para que
                  nadie lea el número como el total de reservas del periodo. */}
              {enfoque === "cobros" && " con dinero"}
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

      {/* Resumen de dinero: solo en la vista de cobros. En Analítica sobraría,
          porque allí la pregunta es de dónde vienen las reservas, no cuánto
          dinero hay retenido. */}
      {enfoque === "cobros" && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {/* Lo primero, porque es lo único que reclama que alguien decida. */}
          <TarjetaImporte
            titulo="Pendiente de decidir"
            importe={resumen.sinDecidir}
            detalle={
              resumen.sinDecidirN > 0
                ? `${formatNumero(resumen.sinDecidirN)} ${resumen.sinDecidirN === 1 ? "reserva" : "reservas"} sin cobrar ni perdonar`
                : "Nada pendiente"
            }
            tono={resumen.sinDecidirN > 0 ? "mal" : "neutro"}
          />
          <TarjetaImporte
            titulo="Garantías retenidas"
            importe={resumen.garantiaRetenida}
            detalle={`${formatNumero(resumen.garantiaRetenidaN)} ${resumen.garantiaRetenidaN === 1 ? "reserva" : "reservas"}${resumen.garantiaPendienteN > 0 ? ` · ${formatNumero(resumen.garantiaPendienteN)} sin tarjeta` : ""}`}
            tono="espera"
          />
          <TarjetaImporte
            titulo="Garantías cobradas"
            importe={resumen.garantiaCobrada}
            detalle={`${formatNumero(resumen.garantiaCobradaN)} ${resumen.garantiaCobradaN === 1 ? "reserva" : "reservas"}`}
            tono="bien"
          />
          <TarjetaImporte
            titulo="Cancelaciones cobradas"
            importe={resumen.cancelacionCobrada}
            detalle={`${formatNumero(resumen.cancelacionCobradaN)} cobradas${resumen.cancelacionFallidaN > 0 ? ` · ${formatNumero(resumen.cancelacionFallidaN)} fallidas` : ""}`}
            tono={resumen.cancelacionFallidaN > 0 ? "mal" : "bien"}
          />
          <TarjetaImporte
            titulo="Tickets vendidos"
            importe={resumen.ticketCobrado}
            detalle={
              resumen.ticketSinCanjearN > 0
                ? `${formatNumero(resumen.ticketSinCanjearN)} sin canjear`
                : "Todos canjeados"
            }
            tono="bien"
          />
          <TarjetaImporte
            titulo="Pagado en reservas"
            importe={resumen.pagado}
            detalle={`${formatNumero(totalReservas)} ${totalReservas === 1 ? "reserva" : "reservas"}`}
          />
        </div>
      )}

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
        // Cada enfoque guarda SUS columnas: quien deja la vista de cobros con
        // el dinero desplegado no debe encontrárselo al abrir Analítica.
        viewKey={enfoque === "cobros" ? "sala/listado-cobros" : "sala/listado-reservas"}
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
                    const contenido = def.celda
                      ? def.celda(f, { ahora, tz })
                      : String(def.valor(f) ?? "");
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
                        {vacio ? null : destino ? (
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
            {pending
              ? "Cargando reservas…"
              : enfoque === "cobros"
                ? "No hay reservas con dinero en este periodo."
                : "No hay reservas que coincidan."}
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
