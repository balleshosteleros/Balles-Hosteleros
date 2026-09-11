"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getResumenPagos, costeSSTotal, nominaBruta, calcularTotalPago, type PagoEmpleado, type PagoArea, type DetalleNomina } from "@/features/rrhh/data/pagos";
import { normalizarDniNie } from "@/features/rrhh/lib/documentacion-validacion";
import {
  listEmpleadosParaPagos,
  loadPagos,
  loadPagosRango,
  savePago,
  enviarConfirmacionesPago,
  reabrirConfirmacionPago,
  puedeReabrirPagos,
  marcarPagado,
  type PagoGuardado,
} from "@/features/rrhh/actions/pagos-actions";
import { loadHorasMes, type HorasMesRow } from "@/features/rrhh/actions/horas-actions";
import {
  procesarNominasLeidas,
  getNominaArchivoUrl,
  getNominasMesUrl,
} from "@/features/rrhh/actions/nominas-archivo-actions";
import type { NominaLeida } from "@/features/rrhh/services/nominas/procesar-nominas";
import {
  getNotifLiquidacionesConfig,
  type NotifLiquidacionesConfig,
} from "@/features/notificaciones/actions/notif-config-actions";
import { NominasRevisionDialog } from "@/features/rrhh/components/pagos/NominasRevisionDialog";
import { RechazarNominasDialog } from "@/features/rrhh/components/pagos/RechazarNominasDialog";
import { CuadreEntregaCard, type BloqueCuadre } from "@/features/rrhh/components/pagos/CuadreEntregaCard";
import {
  aprobarSegurosSociales,
  rechazarSegurosSociales,
  reabrirSegurosSociales,
  listarHistoricoMes,
} from "@/features/rrhh/actions/nominas-aprobacion-actions";
import {
  listarNominasRevision,
  getEstadoMesNominas,
  confirmarMesNominas,
  rechazarMesNominas,
  reabrirMesNominas,
  subirTc1Mes,
  getTc1MesUrl,
  borrarTc1Mes,
  getEstadoSubidaMeses,
  type EstadoMesNominas,
  type EstadoSubidaMes,
} from "@/features/rrhh/actions/nominas-revision-actions";
import { mesAnterior } from "@/features/rrhh/lib/nominas-periodos";
import { MAX_NOMINAS_MB, MAX_NOMINAS_BYTES } from "@/shared/lib/documentos";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/shared/components/NumberInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { capitalizeText } from "@/shared/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Banknote, Settings, Send, Lock, Unlock, CheckCircle2, Clock, Upload, ReceiptText, AlertTriangle, FileText, ShieldCheck, X, Undo2, Download, Loader2 } from "lucide-react";
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
  type ToolbarFiltroTipo,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { IOActions } from "@/shared/io";
import { pagosIO } from "@/features/rrhh/io/pagos.io";
import {
  CalendarRangeToggle,
  CalendarRangeNav,
} from "@/shared/components/calendar/CalendarRangeToggle";
import { useCalendarRange, type CalendarRangeMode } from "@/shared/components/calendar/calendar-range";
import { friendlyError } from "@/shared/lib/friendly-errors";

// Los pagos se registran por MES, pero se pueden ver agregados por trimestre o
// año: entonces se suman todos los importes de cada trabajador en el rango.
const MODES_PAGOS: CalendarRangeMode[] = ["MENSUAL", "TRIMESTRAL", "ANUAL"];

/** Meses 'AAAA-MM' que cubre un rango, del primero al último. */
function periodosDeRango(rango: { start: Date; end: Date }): string[] {
  const out: string[] = [];
  const d = new Date(rango.start.getFullYear(), rango.start.getMonth(), 1);
  const fin = new Date(rango.end.getFullYear(), rango.end.getMonth(), 1);
  while (d <= fin) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function rangoKey(rango: { start: Date; end: Date }): string {
  return `${rango.start.toISOString().slice(0, 10)}_${rango.end.toISOString().slice(0, 10)}`;
}

// periodo 'YYYY-MM' en hora local (evita el salto de mes por UTC).
function periodoDeRango(rango: { start: Date }): string {
  const y = rango.start.getFullYear();
  const m = String(rango.start.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** 'AAAA-MM' → "marzo 2026". Cadena vacía si el periodo no es válido. */
function nombreMesLargo(periodo: string): string {
  const [y, m] = (periodo ?? "").split("-");
  if (!m) return "";
  return `${NOMBRES_MES[Number(m) - 1] ?? ""} ${y}`.trim();
}

/**
 * Meses del AÑO EN CURSO hasta el actual, del más reciente al más antiguo. Las
 * nóminas se entregan y se cierran por ejercicio, así que ofrecer meses de años
 * anteriores solo invita a subir una entrega al año equivocado.
 */
function mesesDelAnoEnCurso(): string[] {
  const hoy = new Date();
  const ano = hoy.getFullYear();
  const out: string[] = [];
  for (let m = hoy.getMonth(); m >= 0; m--) {
    out.push(`${ano}-${String(m + 1).padStart(2, "0")}`);
  }
  return out;
}

/** Conceptos que vienen de la nómina y por tanto se pueden desglosar por documento. */
type CampoDesglose = "nominaBruta" | "neto" | "ssEmpleado" | "ssEmpresa" | "irpf" | "ssTotal";

const ETIQUETA_DESGLOSE: Record<CampoDesglose, string> = {
  nominaBruta: "Nómina bruta por documento",
  neto: "Nómina neta por documento",
  ssEmpleado: "SS trabajador por documento",
  ssEmpresa: "SS empresa por documento",
  irpf: "IRPF por documento",
  ssTotal: "Total SS por documento",
};

/** Opción del filtro para las filas sin puesto en la ficha (ex-empleados). */
const SIN_PUESTO = "Sin puesto";

/** Nombre visible del área a la que pertenece el empleado. */
const AREA_LABEL: Record<PagoArea, string> = {
  administrativa: "Administrativa",
  operativa: "Operativa",
};

/** Valor de UNA nómina individual para el concepto pedido. */
function valorDesglose(d: DetalleNomina, campo: CampoDesglose): number {
  switch (campo) {
    // Bruto = neto + lo que se le descuenta al trabajador (SS + IRPF).
    case "nominaBruta": return d.neto + d.ssEmpleado + d.irpf;
    case "neto": return d.neto;
    case "ssEmpleado": return d.ssEmpleado;
    case "ssEmpresa": return d.ssEmpresa;
    case "irpf": return d.irpf;
    case "ssTotal": return d.ssEmpleado + d.ssEmpresa;
  }
}

function fromGuardado(
  empleadoId: string,
  empleadoNombre: string,
  area: PagoArea,
  g: PagoGuardado,
  dniNie: string | null = null,
  puesto: string | null = null,
): PagoEmpleado {
  return {
    id: `${empleadoId}-pago`,
    empleadoId,
    empleadoNombre,
    dniNie,
    puesto,
    area,
    fijo: g.fijo,
    nomina: g.nomina,
    horasReales: g.horasReales,
    horasTrabajadas: g.horasTrabajadas,
    complemento: g.complemento,
    ajuste: g.ajuste,
    horasExtras: g.horasExtras,
    bonus: g.bonus,
    comentario: g.comentario,
    ssEmpleado: g.ssEmpleado,
    ssEmpresa: g.ssEmpresa,
    irpf: g.irpf,
    total: g.total,
    pagado: g.pagado,
    nominaPath: g.nominaPath,
    numNominas: g.numNominas,
    avisoInactivo: g.avisoInactivo,
    confirmacionEnviadaAt: g.confirmacionEnviadaAt,
    confirmacionAceptadaAt: g.confirmacionAceptadaAt,
  };
}

function toGuardado(p: PagoEmpleado): PagoGuardado {
  return {
    empleadoId: p.empleadoId.startsWith("ext-") ? null : p.empleadoId,
    empleadoNombre: p.empleadoNombre,
    fijo: p.fijo,
    nomina: p.nomina,
    horasReales: p.horasReales,
    horasTrabajadas: p.horasTrabajadas,
    complemento: p.complemento,
    ajuste: p.ajuste,
    horasExtras: p.horasExtras,
    bonus: p.bonus,
    comentario: p.comentario,
    ssEmpleado: p.ssEmpleado,
    ssEmpresa: p.ssEmpresa,
    irpf: p.irpf,
    total: p.total,
    pagado: p.pagado,
    nominaPath: p.nominaPath,
    numNominas: p.numNominas,
    avisoInactivo: p.avisoInactivo,
    confirmacionEnviadaAt: p.confirmacionEnviadaAt,
    confirmacionAceptadaAt: p.confirmacionAceptadaAt,
  };
}

function nuevoPagoVacio(
  empleadoId: string,
  empleadoNombre: string,
  area: PagoArea,
  dniNie: string | null = null,
  puesto: string | null = null,
): PagoEmpleado {
  return {
    id: `${empleadoId}-pago`,
    empleadoId,
    empleadoNombre,
    dniNie,
    puesto,
    area,
    fijo: false,
    nomina: 0,
    horasReales: 0,
    horasTrabajadas: 0,
    complemento: 0,
    ajuste: 0,
    horasExtras: 0,
    bonus: 0,
    comentario: null,
    ssEmpleado: 0,
    ssEmpresa: 0,
    irpf: 0,
    total: 0,
    pagado: false,
    nominaPath: null,
    numNominas: 0,
    avisoInactivo: false,
    confirmacionEnviadaAt: null,
    confirmacionAceptadaAt: null,
  };
}

export function PagosView() {
  const { empresaActual } = useEmpresa();
  const calRange = useCalendarRange("MENSUAL");
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [editando, setEditando] = useState<PagoEmpleado | null>(null);
  const [pagosPorRango, setPagosPorRango] = useState<Record<string, PagoEmpleado[]>>({});
  // Horas del mes por empleado (teóricas/normales/extras/balance), por rango.
  const [horasPorRango, setHorasPorRango] = useState<Record<string, Map<string, HorasMesRow>>>({});
  const [loading, setLoading] = useState(false);
  // Motivo por el que la tabla está vacía (sesión caducada, fallo de carga).
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [showRevision, setShowRevision] = useState(false);
  // empleadoId cuya nómina se está abriendo (para el indicador del icono).
  const [abriendoNomina, setAbriendoNomina] = useState<string | null>(null);
  const [descargandoMes, setDescargandoMes] = useState(false);
  const [subiendoTc1, setSubiendoTc1] = useState(false);
  const tc1InputRef = useRef<HTMLInputElement>(null);
  // Mes que se COTIZA en el TC1 que se va a adjuntar. No es el de la entrega: los
  // seguros sociales se liquidan a mes vencido, así que con las nóminas de agosto
  // llega el recibo de julio. Vacío = sigue al mes de la entrega (el anterior).
  const [mesTc1Elegido, setMesTc1Elegido] = useState<string | null>(null);
  // Diálogo único de la entrega del mes: nóminas + TC1.
  const [showDocsMes, setShowDocsMes] = useState(false);
  // Estado del mes: en borrador se puede corregir; confirmado es inmutable.
  const [estadoMes, setEstadoMes] = useState<EstadoMesNominas>({
    confirmado: false,
    confirmadoEn: null,
    puedeGestionar: false,
    tc1: [],
    rechazado: false,
    rechazadoEn: null,
    rechazoMotivo: null,
    ronda: 1,
  });
  // Devolución del mes a la gestoría: diálogo con las anomalías (obligatorias).
  const [showRechazo, setShowRechazo] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  // Qué bloque de la tarjeta de cuadre está en marcha (bloquea sus botones).
  const [cuadreOcupado, setCuadreOcupado] = useState<BloqueCuadre["clave"] | null>(null);
  // A qué documento apunta el diálogo de devolución: las nóminas del mes o los
  // seguros sociales, que se revisan por separado.
  const [rechazoDe, setRechazoDe] = useState<BloqueCuadre["clave"]>("nominas");
  const [nominasEnMes, setNominasEnMes] = useState(0);
  // Suma de SS (trabajador + empresa) de las nóminas del mes: el contraste de los TC1.
  const [ssNominasMes, setSsNominasMes] = useState(0);
  const [incidenciasNominas, setIncidenciasNominas] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [subiendoNominas, setSubiendoNominas] = useState(false);
  const [progresoNominas, setProgresoNominas] = useState({ hechas: 0, total: 0 });
  // MES al que pertenece la entrega que se va a subir. Arranca en el mes que se
  // está viendo, pero se puede cambiar: la gestoría manda a menudo nóminas de un
  // mes anterior y hay que poder colocarlas en el suyo sin navegar el calendario.
  const [mesSubida, setMesSubida] = useState<string>("");
  // Nóminas ya subidas / cierre de cada mes ofrecido en el selector.
  const [estadoSubidaMeses, setEstadoSubidaMeses] = useState<Record<string, EstadoSubidaMes>>({});
  const [esDirector, setEsDirector] = useState(false);
  const [notifCfg, setNotifCfg] = useState<NotifLiquidacionesConfig | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDelete();
  const nominasInputRef = useRef<HTMLInputElement>(null);
  // DNI/NIE de cada empleado (empleadoId -> dni normalizado) para emparejar nóminas
  // de forma inequívoca. Se llena al cargar; los ex-empleados sin ficha no tienen.
  const dniPorEmpleado = useRef<Map<string, string>>(new Map());

  useGlobalLoadingSync(loading);

  useEffect(() => {
    void puedeReabrirPagos().then(setEsDirector);
    void getNotifLiquidacionesConfig().then(setNotifCfg);
  }, [empresaActual.id]);

  // La clave del caché lleva la EMPRESA además del rango. Sin ella, "junio en
  // HABANA" y "junio en BACANAL" compartían entrada: al cambiar de empresa, el
  // efecto de carga veía caché para ese periodo, cortaba (`if (...) return`) y
  // la tabla seguía mostrando la plantilla y las nóminas de la empresa anterior.
  // El remontaje por `key` del layout (main) debería vaciar este estado, pero es
  // la única barrera y si falla no hay red debajo: la empresa va en la clave.
  const claveRango = `${empresaActual.id}|${rangoKey(calRange.range)}`;
  const periodo = periodoDeRango(calRange.range);
  // Estable entre renders: si no, el `?? []` crea un array nuevo cada vez y
  // los useMemo que dependen de `pagos` se recalculan siempre.
  const pagos = useMemo(() => pagosPorRango[claveRango] ?? [], [pagosPorRango, claveRango]);
  const horasMesMap = horasPorRango[claveRango];
  // Trimestre/año: las filas son SUMAS de varios meses. Editar, confirmar o
  // marcar pagado no tienen sentido sobre un agregado (son actos de UN mes).
  const esVistaAgregada = calRange.mode !== "MENSUAL";

  // Contador de nóminas con incidencia del mes en curso (badge del icono).
  const refrescarIncidenciasNominas = useCallback(async () => {
    if (!periodo) return;
    const lista = await listarNominasRevision(periodo);
    setIncidenciasNominas(lista.filter((n) => n.estado === "con_incidencia").length);
    // Cuántas hay en total: es lo que se elimina si el mes se devuelve, y lo que
    // decide si hay algo que devolver.
    setNominasEnMes(lista.length);
    // Cotización total del mes según las nóminas (trabajador + empresa), sin las
    // denegadas: es contra esto contra lo que cuadran los TC1.
    setSsNominasMes(
      Math.round(
        lista
          .filter((n) => n.estado !== "denegada")
          .reduce((a, n) => a + n.ssEmpleado + n.ssEmpresa, 0) * 100,
      ) / 100,
    );
  }, [periodo]);

  useEffect(() => {
    refrescarIncidenciasNominas();
  }, [refrescarIncidenciasNominas]);

  // Estado del mes (borrador / confirmado). Decide si se puede editar y si el
  // empleado ya ve sus nóminas en el portal.
  const refrescarEstadoMes = useCallback(async () => {
    if (!periodo) return;
    setEstadoMes(await getEstadoMesNominas(periodo));
  }, [periodo]);

  useEffect(() => {
    refrescarEstadoMes();
  }, [refrescarEstadoMes]);

  const mesLabelNominas = useMemo(() => nombreMesLargo(periodo), [periodo]);

  // Meses ofrecidos al subir: los 18 anteriores al actual más el actual. Cubre de
  // sobra los retrasos de la gestoría sin convertir el desplegable en un listado
  // interminable.
  const mesesSubida = useMemo(() => mesesDelAnoEnCurso(), []);

  // Qué tiene ya cada mes ofrecido: nóminas, TC1 y si está cerrado. Es lo que
  // decide qué se puede subir y el cuadre que se enseña en el diálogo.
  const refrescarEstadoSubida = useCallback(async () => {
    // El mes que se está viendo entra siempre: de él sale el cuadre de la tarjeta
    // principal, que se pinta aunque no se haya abierto el diálogo de subida.
    const meses = mesesSubida.includes(periodo) ? mesesSubida : [periodo, ...mesesSubida];
    const filas = await getEstadoSubidaMeses(meses);
    const mapa: Record<string, EstadoSubidaMes> = {};
    for (const f of filas) mapa[f.periodo] = f;
    setEstadoSubidaMeses(mapa);
  }, [mesesSubida, periodo]);

  // La tarjeta de cuadre necesita el estado del mes visto desde el principio, no
  // solo al abrir el diálogo de subida.
  useEffect(() => {
    void refrescarEstadoSubida();
  }, [refrescarEstadoSubida]);

  // Al abrir el diálogo se propone el mes que se está viendo y se consulta el
  // estado de todos los meses ofrecidos.
  useEffect(() => {
    if (!showDocsMes) return;
    setMesSubida((prev) => (prev && mesesSubida.includes(prev) ? prev : periodo));
    void refrescarEstadoSubida();
  }, [showDocsMes, periodo, mesesSubida, nominasEnMes, refrescarEstadoSubida]);

  // Al cambiar el mes de la entrega (o cerrar el diálogo), el mes del TC1 vuelve a
  // proponerse solo: el anterior al elegido. Si se dejara fijo, la propuesta se
  // quedaría colgada de una entrega que ya no es la que se está subiendo.
  useEffect(() => {
    setMesTc1Elegido(null);
  }, [mesSubida, showDocsMes]);

  // ── Cuadre de los TC1 del mes ─────────────────────────────────────────────
  // El TC1 y las nóminas son el MISMO dinero de dos formas: el recibo agrupa por
  // concepto de cotización y las nóminas lo reparten por trabajador. Con varias
  // liquidaciones (ordinaria + complementaria de vacaciones) el total del mes es
  // la suma de todas.
  // MES QUE COTIZA el recibo que toca en la pantalla del mes que se ve: siempre
  // el anterior, porque la Seguridad Social se liquida a mes vencido. Es fijo a
  // propósito: así cada mes enseña SU recibo y no el que casualmente llegó en su
  // entrega.
  const mesCotizadoPrincipal = mesAnterior(periodo);

  // El recibo de ese mes cotizado, venga en la entrega que venga. Antes se
  // buscaba solo dentro de la entrega del mes visto, y bastaba con que la
  // gestoría lo adjuntara al mes equivocado para que la tarjeta dijera "sin
  // documento" con el recibo ya subido. Si hay varias liquidaciones del mismo mes
  // repartidas en entregas distintas (ordinaria + complementaria), se suman: son
  // el mismo dinero en varios papeles.
  const cuadreSs = useMemo(() => {
    const trozos = Object.values(estadoSubidaMeses)
      .flatMap((e) => e.cuadrePorMesCotizado)
      .filter((c) => c.periodo === mesCotizadoPrincipal);
    if (trozos.length === 0) return null;
    if (trozos.length === 1) return trozos[0];
    const numTc1 = trozos.reduce((a, c) => a + c.numTc1, 0);
    const numTc1SinImporte = trozos.reduce((a, c) => a + c.numTc1SinImporte, 0);
    // ssNominas y numNominas son del MES cotizado: iguales en todos los trozos.
    const ssNominas = trozos[0].ssNominas;
    const totalTc1 =
      numTc1SinImporte === 0
        ? Math.round(trozos.reduce((a, c) => a + (c.totalTc1 ?? 0), 0) * 100) / 100
        : null;
    const comprobable = trozos.every((c) => c.comprobable);
    return {
      periodo: mesCotizadoPrincipal,
      ssNominas,
      totalTc1,
      numNominas: trozos[0].numNominas,
      numTc1,
      numTc1SinImporte,
      sinNominas: trozos[0].sinNominas,
      comprobable,
      cuadra: !comprobable || Math.abs((totalTc1 ?? 0) - ssNominas) < 0.005,
      aprobadoEn: trozos.find((c) => c.aprobadoEn)?.aprobadoEn ?? null,
      rechazadoEn: trozos.find((c) => c.rechazadoEn)?.rechazadoEn ?? null,
      rechazoMotivo: trozos.find((c) => c.rechazoMotivo)?.rechazoMotivo ?? null,
    };
  }, [estadoSubidaMeses, mesCotizadoPrincipal]);

  // ¿Hay recibo de ESE mes cotizado? Lo que decide si se puede aprobar o si lo
  // que falta es el papel de la gestoría.
  const hayTc1 = (cuadreSs?.numTc1 ?? 0) > 0;

  const mesSubidaLabel = useMemo(() => nombreMesLargo(mesSubida), [mesSubida]);
  const estadoMesSubida = estadoSubidaMeses[mesSubida];

  // Mes cotizado del TC1 que se va a adjuntar. Si no se ha tocado el selector,
  // sigue al mes de la entrega proponiendo el ANTERIOR, que es lo que hace la
  // gestoría siempre. Los meses ofrecidos llegan hasta el de la propia entrega,
  // por si alguna vez el recibo fuera del mismo mes.
  const mesCotizadoTc1 = mesTc1Elegido ?? mesAnterior(mesSubida || periodo);
  // Del mes de la entrega hacia atrás, sin salir de su año. La única excepción es
  // el mes ANTERIOR a la entrega: la de enero trae el TC1 de diciembre del año
  // pasado, y ese recibo hay que poder guardarlo en su mes de verdad.
  const mesesCotizacionTc1 = useMemo(() => {
    const base = mesSubida || periodo;
    const anoBase = base.slice(0, 4);
    const out: string[] = [base];
    let p = mesAnterior(base);
    out.push(p);
    p = mesAnterior(p);
    while (p.slice(0, 4) === anoBase) {
      out.push(p);
      p = mesAnterior(p);
    }
    return [...new Set(out)];
  }, [mesSubida, periodo]);

  // Lo mismo, pero del MES ELEGIDO en el diálogo de subida: ahí la entrega entera
  // (nóminas y TC1) va al mes que se elija, que no tiene por qué ser el que se
  // está viendo en la tabla.
  const tc1Subida = estadoMesSubida?.tc1 ?? [];
  const hayTc1Subida = tc1Subida.length > 0;
  // Cuadre por MES COTIZADO: cada recibo contra las nóminas del mes que cotiza,
  // que con los seguros sociales a mes vencido NO es el de la entrega. Es el
  // desglose que se pinta; no hay un total único que tenga sentido enseñar.
  const cuadrePorMes = estadoMesSubida?.cuadrePorMesCotizado ?? [];
  // El mes elegido YA tiene entrega: con un solo documento subido basta para no
  // admitir más. Se avisa en pantalla y se desactiva el botón de adjuntar.
  const mesSubidaYaTieneNominas = (estadoMesSubida?.nominas ?? 0) > 0;
  const mesSubidaConfirmado = estadoMesSubida?.confirmado === true;

  // Lo que cierra los seguros sociales es SU propio visto bueno, no el de las
  // nóminas: el recibo de julio llega a mediados de agosto, cuando las nóminas de
  // agosto ya están aprobadas, y atarlo a ellas dejaba el recibo fuera para
  // siempre. Se mira el mes que COTIZA el recibo que se va a adjuntar.
  const ssMesElegidoAprobado = useMemo(
    () =>
      Object.values(estadoSubidaMeses).some((e) =>
        e.cuadrePorMesCotizado.some((c) => c.periodo === mesCotizadoTc1 && c.aprobadoEn != null),
      ),
    [estadoSubidaMeses, mesCotizadoTc1],
  );

  // Formatea horas decimales a "8h" o "8h 30m".
  const fmtHoras = (h: number): string => {
    const signo = h < 0 ? "−" : "";
    const abs = Math.abs(h);
    const horas = Math.floor(abs);
    const min = Math.round((abs - horas) * 60);
    if (min === 0) return `${signo}${horas}h`;
    return `${signo}${horas}h ${min}m`;
  };

  const cargarEmpleados = useCallback(async () => {
    setLoading(true);
    // Con un rango de VARIOS meses (trimestral/anual) se piden agregados: la
    // suma de cada trabajador en el periodo, incluidos los que solo cobraron
    // algún mes suelto.
    const meses = periodosDeRango(calRange.range);
    const esAgregado = meses.length > 1;
    const [resEmp, resPagos] = await Promise.all([
      listEmpleadosParaPagos(),
      esAgregado ? loadPagosRango(meses) : loadPagos(periodo),
    ]);
    setLoading(false);
    if (!resEmp.ok) {
      // Antes esto era un `return` mudo: la tabla se quedaba vacía y no había
      // forma de distinguir "no hay datos" de "se te ha caducado la sesión".
      setErrorCarga(
        resEmp.error === "SESION_CADUCADA"
          ? "Tu sesión ha caducado. Vuelve a entrar para ver los pagos."
          : "No se pudieron cargar los empleados. Recarga la página.",
      );
      return;
    }
    setErrorCarga(null);

    // Indexar lo guardado: por empleado (con ficha) y suelto (ex-empleados).
    const guardadosPorEmp = new Map<string, PagoGuardado>();
    const guardadosSinEmp: PagoGuardado[] = [];
    for (const g of resPagos.data) {
      if (g.empleadoId) guardadosPorEmp.set(g.empleadoId, g);
      else guardadosSinEmp.push(g);
    }

    // Índice de DNI/NIE por empleado (normalizado) para emparejar nóminas.
    dniPorEmpleado.current = new Map();
    for (const e of resEmp.data) {
      if (e.dniNie) dniPorEmpleado.current.set(e.empleadoId, normalizarDniNie(e.dniNie));
    }

    // Empleados activos: fila guardada si existe, si no fila vacía. Se lleva el
    // DNI/NIE de la ficha a la fila (se muestra en la tabla y sirve de referencia
    // visual del emparejamiento).
    const filasEmpleados = resEmp.data
      .map((e) => {
        const g = guardadosPorEmp.get(e.empleadoId);
        guardadosPorEmp.delete(e.empleadoId);
        const dni = e.dniNie ?? null;
        return g
          ? fromGuardado(e.empleadoId, e.empleadoNombre, e.area, g, dni, e.puesto)
          : esAgregado
            ? null // en trimestre/año no se listan filas vacías: solo lo cobrado
            : nuevoPagoVacio(e.empleadoId, e.empleadoNombre, e.area, dni, e.puesto);
      })
      .filter((f): f is PagoEmpleado => f !== null);

    // Pagos guardados de gente que ya no está activa (histórico): se muestran igual.
    const filasExtra = [...guardadosPorEmp.values(), ...guardadosSinEmp].map((g) =>
      fromGuardado(g.empleadoId ?? `ext-${g.empleadoNombre}`, g.empleadoNombre, "operativa", g),
    );

    setPagosPorRango((prev) => ({ ...prev, [claveRango]: [...filasEmpleados, ...filasExtra] }));

    // Horas del mes por empleado (teóricas del horario vs fichadas normales/extras).
    // Se cargan aparte porque recorren horario + fichajes; no bloquean la tabla.
    const idsConFicha = resEmp.data.map((e) => e.empleadoId).filter((id) => !id.startsWith("ext-"));
    if (idsConFicha.length > 0) {
      void loadHorasMes(periodo, idsConFicha).then((r) => {
        if (!r.ok) return;
        const mapa = new Map<string, HorasMesRow>();
        for (const h of r.data) mapa.set(h.empleadoId, h);
        setHorasPorRango((prev) => ({ ...prev, [claveRango]: mapa }));
      });
    }
  }, [claveRango, periodo]);

  useEffect(() => {
    if (pagosPorRango[claveRango]) return;
    cargarEmpleados();
  }, [claveRango, pagosPorRango, cargarEmpleados]);

  // Vacía el caché al cambiar de empresa. Ya NO es lo que garantiza el
  // aislamiento (eso lo hace la empresa dentro de `claveRango`): se queda para
  // liberar las filas de la empresa que dejamos atrás.
  //
  // Por sí solo no bastaba: este efecto se declara DESPUÉS del efecto de carga,
  // así que en el commit del cambio de empresa la carga corría primero, veía
  // caché para ese periodo (la clave no llevaba empresa) y cortaba con su
  // `return`. Para cuando esto vaciaba el estado, la recarga ya se había
  // saltado y la tabla se quedaba con los datos de la empresa anterior.
  useEffect(() => {
    setPagosPorRango({});
    setHorasPorRango({});
  }, [empresaActual.id]);

  const setPagos = useCallback(
    (updater: (prev: PagoEmpleado[]) => PagoEmpleado[]) => {
      setPagosPorRango((prev) => ({
        ...prev,
        [claveRango]: updater(prev[claveRango] ?? []),
      }));
    },
    [claveRango],
  );

  const acceso = (p: PagoEmpleado, campo: string): unknown => {
    if (campo === "pagado") return p.pagado;
    if (campo === "fijo") return p.fijo;
    if (campo === "total") return p.total;
    if (campo === "nomina") return p.nomina;
    if (campo === "bonus") return p.bonus;
    if (campo === "horasExtras") return p.horasExtras;
    if (campo === "empleado") return p.empleadoNombre;
    // El área se filtra por su etiqueta visible ("Administrativa"), que es lo
    // que el usuario ve en la columna y en el desplegable del filtro.
    if (campo === "area") return AREA_LABEL[p.area];
    if (campo === "puesto") return p.puesto ?? SIN_PUESTO;
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const pagosFiltrados = useMemo(() => {
    let resultado = pagos.filter((p) => {
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!p.empleadoNombre.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    resultado = aplicarFiltrosToolbar(resultado, filtros, acceso);
    resultado = aplicarOrdenToolbar(resultado, orden, acceso);
    return resultado;
  }, [pagos, busqueda, filtros, orden]);

  const resumen = useMemo(() => getResumenPagos(pagosFiltrados), [pagosFiltrados]);

  // Botón Pagar/Pagado (lo pulsa RRHH). Si la empresa exige aprobación, solo
  // deja pagar cuando el empleado ya aprobó (tick de LIQUIDAR).
  const togglePagar = async (p: PagoEmpleado) => {
    const nuevo = !p.pagado;
    const res = await marcarPagado(periodo, p.empleadoId, nuevo);
    if (!res.ok) {
      if (res.requiereAprobacion) {
        toast.error("El empleado debe aprobar su liquidación (LIQUIDAR) antes de marcarla como pagada.");
      } else {
        toast.error("No se pudo actualizar el pago. Guarda primero la liquidación del empleado.");
      }
      return;
    }
    setPagos((prev) => prev.map((x) => (x.id === p.id ? { ...x, pagado: nuevo } : x)));
  };

  const pagarBloqueado = (p: PagoEmpleado): boolean =>
    !p.pagado && !!notifCfg?.requiereAprobacion && !p.confirmacionAceptadaAt;

  // Subida de nóminas. Admite un archivo por empleado O un único PDF con TODAS
  // las nóminas (una por página): el servidor lo parte en páginas y devuelve una
  // nómina por página. Por cada nómina, la IA lee DNI/NIE, nombre y SS. Se
  // empareja con su fila por DNI/NIE (inequívoco) y, si falta, por nombre. Además
  // de la SS (informativa, no toca el total), se ADJUNTA la nómina original al
  // empleado (Storage) para poder verla desde la columna "Nómina". Los pagos ya
  // enviados (bloqueados) se saltan.
  const subirNominas = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // El mes de la entrega es el ELEGIDO en el diálogo, no el del calendario.
    const periodoDestino = mesSubida || periodo;
    if (!periodoDestino) return;
    const lista = Array.from(files);
    setSubiendoNominas(true);
    setProgresoNominas({ hechas: 0, total: lista.length });

    // Acumular TODAS las nóminas leídas de todos los archivos, y luego emparejar
    // + guardar EN SERVIDOR (contra todos los empleados de la empresa, no la vista).
    const todas: NominaLeida[] = [];
    let fallos = 0;
    for (const file of lista) {
      try {
        const fd = new FormData();
        fd.set("archivo", file);
        const res = await fetch("/api/nominas/extraer", { method: "POST", body: fd });
        const data = await res.json();
        if (data.ok && Array.isArray(data.nominas)) todas.push(...(data.nominas as NominaLeida[]));
        else fallos++;
      } catch (e) {
        console.error("[pagos] subirNominas leer:", e);
        fallos++;
      }
      setProgresoNominas((prev) => ({ ...prev, hechas: prev.hechas + 1 }));
    }

    if (todas.length === 0) {
      setSubiendoNominas(false);
      toast.error("No se pudo leer ninguna nómina.");
      return;
    }

    const nombreArchivo = lista.length === 1 ? lista[0].name : `${lista.length} archivos`;
    const proc = await procesarNominasLeidas(todas, periodoDestino, nombreArchivo);
    setSubiendoNominas(false);
    if (proc.yaSubidas) {
      // Otra pestaña (o la gestoría) subió la entrega mientras tanto.
      void refrescarEstadoSubida();
      toast.error(`Las nóminas de ${nombreMesLargo(periodoDestino)} ya están subidas.`, {
        description: "Para cambiarlas, devuelve el mes a la gestoría o reábrelo.",
      });
      return;
    }
    if (!proc.ok || !proc.resultado) {
      toast.error(proc.error ?? "No se pudieron guardar las nóminas.");
      return;
    }
    const r = proc.resultado;

    // Recargar caché para que se vean las nóminas nuevas al navegar por meses.
    setPagosPorRango({});
    refrescarIncidenciasNominas();
    // El mes de la entrega ya no admite más documentos, y su cuadre ha cambiado:
    // se relee el estado en vez de parchear el contador a mano.
    if (r.guardadas > 0) void refrescarEstadoSubida();

    const nombreMes = nombreMesLargo;

    // Archivo RECHAZADO por completo: tiene errores, NO se guardó nada.
    if (r.rechazadoTodo) {
      const errores: string[] = [];
      if (r.mesIncorrecto.length > 0) errores.push(`De otro mes: ${r.mesIncorrecto.slice(0, 6).map((x) => `${x.etiqueta} (${nombreMes(x.periodoLeido)})`).join(", ")}${r.mesIncorrecto.length > 6 ? "…" : ""}.`);
      if (r.sinEmpleado.length > 0) errores.push(`No dados de alta: ${r.sinEmpleado.slice(0, 6).join(", ")}${r.sinEmpleado.length > 6 ? "…" : ""}.`);
      toast.error("El archivo tiene errores: no se ha guardado nada. Corrige y vuelve a subirlo entero.", {
        description: errores.join(" "),
      });
      return;
    }

    const partes = [`${r.guardadas} nómina${r.guardadas === 1 ? "" : "s"} guardada${r.guardadas === 1 ? "" : "s"}`];
    if (r.yaExistian > 0) partes.push(`${r.yaExistian} ya subida${r.yaExistian === 1 ? "" : "s"}`);
    if (r.conIncidencia > 0) partes.push(`${r.conIncidencia} con incidencia`);
    if (fallos > 0) partes.push(`${fallos} archivo${fallos === 1 ? "" : "s"} con error`);

    const lineas: string[] = [];
    if (r.duplicadas.length > 0) lineas.push(`Ya tenían nómina (no se regrabó): ${r.duplicadas.slice(0, 6).join(", ")}${r.duplicadas.length > 6 ? "…" : ""}.`);
    // Volcadas bien, pero de gente ya de baja: se avisa para que se revise.
    if (r.inactivos.length > 0) {
      const etiquetas = r.inactivos
        .slice(0, 6)
        .map((x) => {
          if (!x.fechaBaja) return `${x.nombre} (sin fecha de baja)`;
          const [y, m, d] = x.fechaBaja.split("-");
          return `${x.nombre} (fin ${d}/${m}/${y})`;
        })
        .join(", ");
      lineas.push(`Revisa (ya estaban de baja): ${etiquetas}${r.inactivos.length > 6 ? "…" : ""}.`);
    }
    const descripcion = lineas.length > 0 ? lineas.join(" ") : undefined;

    if (r.guardadas > 0 || r.yaExistian > 0) toast.success(partes.join(" · "), { description: descripcion });
    else toast.error(partes.join(" · ") || "No se emparejó ninguna nómina.", { description: descripcion });
  };

  // Abre la nómina original de un empleado en una pestaña nueva (URL firmada
  // temporal). Si tiene varias del mes, `getNominaArchivoUrl` las combina en un
  // único PDF, así que el gestor las ve todas de una vez.
  const abrirNominaEmpleado = async (p: PagoEmpleado) => {
    if (p.empleadoId.startsWith("ext-")) return;
    setAbriendoNomina(p.empleadoId);
    try {
      const res = await getNominaArchivoUrl(periodo, p.empleadoId);
      if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
      else toast.error(res.error ?? "No se pudo abrir la nómina.");
    } catch (err) {
      toast.error("No se pudo abrir la nómina.", { description: friendlyError(err, "abrirNominaEmpleado") });
    } finally {
      setAbriendoNomina(null);
    }
  };

  // TODAS las nóminas del mes en un PDF: el archivo que manda la gestoría,
  // reconstruido desde lo guardado. Ordenado por empleado, con su finiquito al
  // lado si lo tiene.
  const descargarNominasDelMes = async () => {
    setDescargandoMes(true);
    try {
      const res = await getNominasMesUrl(periodo);
      if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
      else toast.error(res.error);
    } catch (err) {
      toast.error("No se pudieron descargar las nóminas del mes.", { description: friendlyError(err, "descargarNominasDelMes") });
    } finally {
      setDescargandoMes(false);
    }
  };

  // TC1: documento de EMPRESA (bases y cuotas de toda la plantilla). Se guarda
  // aparte de las nóminas y NO se reparte a ningún empleado. Va al MISMO mes que
  // se haya elegido para la entrega, para poder subirlo todo de una vez.
  const subirTc1 = async (file: File | null) => {
    if (!file) return;
    const periodoDestino = mesSubida || periodo;
    if (!periodoDestino) return;
    if (file.size > MAX_NOMINAS_BYTES) {
      toast.error(`El archivo supera ${MAX_NOMINAS_MB} MB.`);
      return;
    }
    setSubiendoTc1(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
        fr.onerror = () => reject(new Error("No se pudo leer el archivo"));
        fr.readAsDataURL(file);
      });
      const res = await subirTc1Mes({
        periodo: periodoDestino,
        // Mes que se cotiza en el recibo: lo elige quien sube, porque los seguros
        // sociales van a mes vencido (con las nóminas de agosto, el TC1 de julio).
        periodoCotizacion: mesCotizadoTc1,
        nombre: file.name,
        mimeType: file.type || "application/pdf",
        archivoBase64: base64,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo subir el TC1.");
        return;
      }
      // El mes visto y el elegido pueden ser distintos: se refrescan los dos.
      await Promise.all([refrescarEstadoMes(), refrescarEstadoSubida()]);
      // Aviso (no error): se contrasta lo ELEGIDO con lo que la IA lee del papel.
      // Manda lo elegido; esto solo avisa por si hubo un despiste.
      const otroMes =
        res.periodoDocumento && res.periodoDocumento !== res.periodoCotizacion
          ? `Lo has marcado como ${nombreMesLargo(res.periodoCotizacion)}, pero el documento declara ${nombreMesLargo(res.periodoDocumento)}. Compruébalo.`
          : undefined;
      toast.success(
        res.importe != null
          ? `TC1 adjuntado · ${fmt(res.importe)}`
          : "TC1 adjuntado. No se pudo leer el importe: revisa el cuadre a mano.",
        { description: otroMes },
      );
    } catch (err) {
      toast.error("No se pudo subir el TC1.", { description: friendlyError(err, "subirTc1") });
    } finally {
      setSubiendoTc1(false);
    }
  };

  const abrirTc1 = async (tc1Id: string) => {
    const res = await getTc1MesUrl(tc1Id);
    if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
    else toast.error(res.error ?? "No se pudo abrir el TC1.");
  };

  const quitarTc1 = async (tc1Id: string, nombre: string) => {
    const ok = await confirm({
      title: `Quitar ${nombre}`,
      description: "Se borrará este recibo del mes. Podrás volver a adjuntarlo cuando quieras.",
      confirmLabel: "Quitar TC1",
    });
    if (!ok) return;
    const res = await borrarTc1Mes(tc1Id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo quitar el TC1.");
      return;
    }
    await Promise.all([refrescarEstadoMes(), refrescarEstadoSubida()]);
    toast.success("TC1 quitado.");
  };

  // Cierra el mes: las nóminas quedan inmutables para TODOS los roles y se
  // publican en la carpeta de cada empleado.
  // `enviarConfirmaciones` se declara mas abajo (const, sin hoisting) y
  // `confirmarMes` la necesita al encadenar el envio tras confirmar el mes.
  const enviarConfirmacionesRef = useRef<((ids: string[], etiqueta: string) => Promise<void>) | null>(null);

  const confirmarMes = async () => {
    const ok = await confirm({
      title: `Confirmar las nóminas de ${mesLabelNominas}`,
      description:
        "Quedarán bloqueadas: nadie podrá editar sus importes, ni borrarlas, ni subir nuevas de este mes. " +
        "Además cada empleado verá su nómina en su portal. ¿Continuar?",
      confirmLabel: "Confirmar nóminas",
    });
    if (!ok) return;
    const res = await confirmarMesNominas(periodo);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron confirmar las nóminas.");
      return;
    }
    await refrescarEstadoMes();
    toast.success(`Nóminas de ${mesLabelNominas} confirmadas y publicadas a los empleados.`, {
      description:
        res.conIncidencia > 0
          ? `Atención: se han cerrado ${res.conIncidencia} nómina${res.conIncidencia === 1 ? "" : "s"} con incidencia sin revisar.`
          : undefined,
    });

    // Confirmado el mes, el paso siguiente es siempre el mismo: mandar las
    // liquidaciones. Se pregunta aquí para no depender de que alguien se acuerde
    // de pulsar el botón; si dice que ahora no, el botón sigue estando.
    const pendientes = pagos.filter((p) => !p.confirmacionEnviadaAt && !p.empleadoId.startsWith("ext-"));
    if (pendientes.length === 0) return;
    const enviarYa = await confirm({
      title: "Enviar liquidaciones",
      description:
        `¿Quieres enviar ahora la liquidación de ${mesLabelNominas} a ` +
        `${pendientes.length === 1 ? "1 empleado" : `${pendientes.length} empleados`}? ` +
        "Recibirán un correo y su liquidación quedará bloqueada. Si prefieres revisarlas antes, " +
        "puedes enviarlas después con el botón «Enviar liquidaciones».",
      confirmLabel: "Enviar ahora",
      cancelLabel: "Ahora no",
    });
    if (!enviarYa) return;
    await enviarConfirmacionesRef.current?.(pendientes.map((p) => p.empleadoId), "liquidaciones");
  };

  // Devuelve el mes a la gestoría con las anomalías que ha escrito RRHH: borra
  // todo lo subido, les manda el correo y les reabre el enlace para que suban la
  // entrega completa corregida.
  const rechazarMes = async (
    motivo: string,
    que: { nominas: boolean; segurosSociales: boolean },
  ) => {
    setRechazando(true);
    const res = await rechazarMesNominas(periodo, motivo, que);
    setRechazando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron devolver las nóminas.");
      return;
    }
    setShowRechazo(false);
    setPagosPorRango({});
    await refrescarEstadoMes();
    await refrescarIncidenciasNominas();

    // Si el correo no salió, es lo primero que RRHH tiene que saber: el mes está
    // devuelto igualmente, pero la gestoría no se ha enterado.
    if (res.emailEnviado) {
      toast.success(`Nóminas de ${mesLabelNominas} devueltas a la gestoría.`, {
        description: `Se avisó a ${res.emailDestino} con tus anomalías y el enlace para volver a subirlas.`,
      });
    } else {
      toast.warning(`Nóminas de ${mesLabelNominas} devueltas, pero el correo NO salió.`, {
        description: "Avisa a la gestoría por otra vía: el mes ya está vacío esperando su entrega.",
      });
    }
  };

  const reabrirMes = async () => {
    const ok = await confirm({
      title: `Reabrir las nóminas de ${mesLabelNominas}`,
      description:
        "Volverán a ser editables y DEJARÁN de verse en el portal del empleado hasta que se confirmen otra vez. ¿Continuar?",
      confirmLabel: "Reabrir",
    });
    if (!ok) return;
    const res = await reabrirMesNominas(periodo);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo reabrir el mes.");
      return;
    }
    await refrescarEstadoMes();
    toast.success(`Nóminas de ${mesLabelNominas} reabiertas para corregir.`);
  };

  // ── Seguros sociales: su propio visto bueno ────────────────────────────────
  // Se aprueban por MES COTIZADO, no por el de la entrega: el recibo que llega
  // con las nóminas de julio cotiza junio, y es contra las de junio contra las
  // que cuadra. Si hay complementaria (vacaciones) van los dos recibos juntos:
  // son el mismo dinero en dos papeles.

  const aprobarSs = async () => {
    if (!mesCotizadoPrincipal) return;
    const ok = await confirm({
      title: `Aprobar los seguros sociales de ${nombreMesLargo(mesCotizadoPrincipal)}`,
      description: "Quedará registrado quién y cuándo dio el visto bueno al recibo de cotizaciones.",
      confirmLabel: "Aprobar",
    });
    if (!ok) return;
    setCuadreOcupado("seguros");
    const res = await aprobarSegurosSociales(mesCotizadoPrincipal);
    setCuadreOcupado(null);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron aprobar los seguros sociales.");
      return;
    }
    await Promise.all([refrescarEstadoMes(), refrescarEstadoSubida()]);
    toast.success(`Seguros sociales de ${nombreMesLargo(mesCotizadoPrincipal)} aprobados.`);
  };

  const reabrirSs = async () => {
    if (!mesCotizadoPrincipal) return;
    const ok = await confirm({
      title: `Reabrir los seguros sociales de ${nombreMesLargo(mesCotizadoPrincipal)}`,
      description: "Volverán a quedar pendientes de aprobar. ¿Continuar?",
      confirmLabel: "Reabrir",
    });
    if (!ok) return;
    setCuadreOcupado("seguros");
    const res = await reabrirSegurosSociales(mesCotizadoPrincipal);
    setCuadreOcupado(null);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo reabrir.");
      return;
    }
    await Promise.all([refrescarEstadoMes(), refrescarEstadoSubida()]);
    toast.success("Seguros sociales reabiertos.");
  };

  // El diálogo de devolución es el mismo para los dos documentos: cambia a quién
  // apunta. Las nóminas se BORRAN al devolverlas (la gestoría sube la entrega
  // corregida entera); el recibo se conserva, para poder compararlo con el nuevo.
  const rechazarSs = async (motivo: string) => {
    if (!mesCotizadoPrincipal) return;
    setRechazando(true);
    const res = await rechazarSegurosSociales(mesCotizadoPrincipal, motivo);
    setRechazando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron devolver los seguros sociales.");
      return;
    }
    setShowRechazo(false);
    await Promise.all([refrescarEstadoMes(), refrescarEstadoSubida()]);
    toast.success(`Seguros sociales de ${nombreMesLargo(mesCotizadoPrincipal)} marcados como devueltos.`, {
      description: "Avisa a la gestoría: el recibo se conserva para poder compararlo con el corregido.",
    });
  };

  const guardarEdicion = (datos: Partial<PagoEmpleado>) => {
    if (!editando) return;
    let actualizado: PagoEmpleado | undefined;
    setPagos((prev) =>
      prev.map((p) => {
        if (p.id !== editando.id) return p;
        const updated = { ...p, ...datos };
        // El total SIEMPRE se recalcula desde el desglose completo: es la cifra
        // que se persiste, la que viaja en el correo de liquidación y la que
        // cobra el empleado, así que no puede quedar desincronizada del desglose
        // que se le enseña. Antes solo se movía por el delta del ajuste, de modo
        // que corregir la nómina (o complemento, horas extras…) cambiaba el desglose
        // pero dejaba el total anterior.
        updated.total = Math.round(calcularTotalPago(updated) * 100) / 100;
        actualizado = updated;
        return updated;
      }),
    );
    setEditando(null);
    if (actualizado) {
      void savePago(periodo, toGuardado(actualizado)).then((r) => {
        if (!r.ok && r.locked) toast.error("Liquidación ya enviada. Reábrela para modificarla.");
      });
    }
  };

  // Envía la confirmación de liquidación a los empleados indicados (uno o todos).
  // Tras enviar, esos pagos quedan bloqueados y al empleado le salta el pop-up.
  const enviarConfirmaciones = async (ids: string[], etiqueta: string) => {
    const reales = ids.filter((id) => !id.startsWith("ext-"));
    if (reales.length === 0) {
      toast.error("No hay empleados con app a los que enviar.");
      return;
    }
    const ok = await confirm({
      title: `Enviar ${etiqueta}`,
      description:
        `Se enviará la liquidación a ${reales.length === 1 ? "este empleado" : `${reales.length} empleados`} y quedará ` +
        "bloqueada: no se podrá editar hasta que un director la reabra. ¿Continuar?",
      confirmLabel: "Enviar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    setEnviando(true);
    const res = await enviarConfirmacionesPago(periodo, reales);
    setEnviando(false);
    if (!res.ok) {
      toast.error("No se pudieron enviar las confirmaciones.");
      return;
    }
    if (res.enviadosIds.length === 0) {
      toast.info("No había liquidaciones guardadas pendientes de enviar.");
      return;
    }
    const enviadosSet = new Set(res.enviadosIds);
    toast.success(`Liquidación enviada a ${enviadosSet.size} empleado${enviadosSet.size === 1 ? "" : "s"}.`);
    setPagosPorRango((prev) => {
      const lista = prev[claveRango] ?? [];
      const nowIso = new Date().toISOString();
      return {
        ...prev,
        [claveRango]: lista.map((p) =>
          enviadosSet.has(p.empleadoId) ? { ...p, confirmacionEnviadaAt: nowIso } : p,
        ),
      };
    });
  };
  enviarConfirmacionesRef.current = enviarConfirmaciones;

  const reabrir = async (p: PagoEmpleado) => {
    const ok = await confirm({
      title: "Reabrir liquidación",
      description: `Se anulará el envío a ${p.empleadoNombre} para poder corregirla y reenviarla. ¿Continuar?`,
      confirmLabel: "Reabrir",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    const res = await reabrirConfirmacionPago(periodo, p.empleadoId);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo reabrir la liquidación.");
      return;
    }
    toast.success("Liquidación reabierta. Ya puedes editarla.");
    setPagosPorRango((prev) => {
      const lista = prev[claveRango] ?? [];
      return {
        ...prev,
        [claveRango]: lista.map((x) =>
          x.id === p.id ? { ...x, confirmacionEnviadaAt: null, confirmacionAceptadaAt: null } : x,
        ),
      };
    });
  };

  // Espacio de NO separación ( ) entre número y € para que "3.731,61 €" nunca
  // se parta en dos líneas, aunque la columna sea estrecha.
  const fmt = (n: number) =>
    n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";

  // ¿La nómina de este empleado/mes se ha procesado? (tiene documento adjunto o
  // algún importe leído de la nómina). Sirve para distinguir un 0 CALCULADO de un
  // dato SIN calcular: si está procesada, un 0 es real (0 €); si no, se muestra —.
  const nominaProcesada = (p: PagoEmpleado): boolean =>
    !!p.nominaPath || p.ssEmpleado > 0 || p.ssEmpresa > 0 || p.irpf > 0 || p.nomina > 0;

  // Formatea un importe distinguiendo 0-calculado ("0 €") de sin-calcular ("—").
  const fmtDato = (valor: number, calculado: boolean) => (calculado ? fmt(valor) : "—");

  // Círculo con el nº de nóminas cuando hay MÁS de una (2, 3…). Nada si es 1 o 0.
  // Marca que el importe de la celda es una SUMA y, al pulsarlo, abre un recuadro
  // con lo que aporta cada nómina a ESE concepto y su sumatorio.
  const circuloN = (p: PagoEmpleado, campo?: CampoDesglose): ReactNode => {
    if (p.numNominas <= 1) return null;
    const detalle = p.detalleNominas ?? [];
    // Sin campo (o sin detalle cargado): distintivo informativo, no pulsable.
    if (!campo || detalle.length === 0) {
      return (
        <span
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary align-middle"
          title={`Suma de ${p.numNominas} nóminas`}
        >
          {p.numNominas}
        </span>
      );
    }
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary align-middle transition hover:bg-primary/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            title={`Suma de ${p.numNominas} nóminas — pulsa para ver el desglose`}
            aria-label={`Ver el desglose de las ${p.numNominas} nóminas`}
          >
            {p.numNominas}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-semibold">{ETIQUETA_DESGLOSE[campo]}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {p.empleadoNombre} · {p.numNominas} nóminas este mes
          </p>
          <ul className="mt-2 space-y-1">
            {detalle.map((d, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  Nómina {i + 1}
                  {d.incidencia ? <span className="ml-1 text-amber-600">⚠</span> : null}
                </span>
                <span className="tabular-nums">{fmt(valorDesglose(d, campo))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t pt-2 text-xs font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {fmt(detalle.reduce((s, d) => s + valorDesglose(d, campo), 0))}
            </span>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const columnasDef: ToolbarColumna[] = [
    // Puesto (con el area debajo) y las horas van primero: es el contexto del
    // trabajador. Despues el dinero, de lo que cobra a lo que cuesta. Los
    // documentos y las acciones, al final.
    { campo: "puesto", label: "Puesto" },
    { campo: "horasReales", label: "H. horario" },
    { campo: "horasTrabajadas", label: "H. fichadas" },
    { campo: "horasBalance", label: "Diferencia" },
    { campo: "nominaBruta", label: "Nómina bruta" },
    { campo: "ssEmpleado", label: "SS trabajador" },
    { campo: "irpf", label: "IRPF" },
    { campo: "nomina", label: "Nómina neta" },
    { campo: "complemento", label: "Complemento" },
    { campo: "ajuste", label: "Ajuste" },
    { campo: "horasExtras", label: "H.Extras" },
    { campo: "bonus", label: "Bonus" },
    { campo: "total", label: "Total a pagar" },
    { campo: "ssEmpresa", label: "SS empresa" },
    { campo: "ssTotal", label: "Total SS" },
    { campo: "costeTotal", label: "Coste total" },
    { campo: "pagado", label: "Pagado" },
    { campo: "comentario", label: "Comentario" },
    { campo: "nominaDoc", label: "Nómina (documento)" },
  ];

  // Nombres para el filtro de la columna Empleado (todos los del mes, no solo
  // los que ya pasan el filtro: si no, filtrar dejaría la lista sin opciones).
  const opcionesEmpleado = useMemo(
    () => Array.from(new Set(pagos.map((p) => p.empleadoNombre))).sort((a, b) => a.localeCompare(b, "es")),
    [pagos],
  );

  // Puestos presentes en el mes. "Sin puesto" solo aparece si hay alguna fila así.
  const opcionesPuesto = useMemo(
    () => Array.from(new Set(pagos.map((p) => p.puesto ?? SIN_PUESTO))).sort((a, b) => a.localeCompare(b, "es")),
    [pagos],
  );

  // Cabecera con filtro y orden en la propia columna (sin botones aparte).
  const th = (
    campo: string,
    label: string,
    filtroTipo: ToolbarFiltroTipo,
    align: "left" | "right" | "center" = "right",
    opciones?: string[],
    className?: string,
  ): ReactNode => (
    <TableColumnHeader
      key={campo}
      campo={campo}
      label={label}
      filtroTipo={filtroTipo}
      opciones={opciones}
      filtros={filtros}
      onFiltrosChange={setFiltros}
      ordenable
      orden={orden}
      onOrdenChange={setOrden}
      ordenLabelAsc={filtroTipo === "numero" ? "Menor" : "A→Z"}
      ordenLabelDesc={filtroTipo === "numero" ? "Mayor" : "Z→A"}
      align={align}
      className={className}
    />
  );

  // Los cuatro conceptos que se suman a la nomina comparten formato: verde
  // cuando anaden, rojo cuando descuentan (cualquiera puede venir negativo) y
  // un guion cuando no hay importe.
  const celdaConcepto = (key: string, valor: number): ReactNode => (
    <TableCell
      key={key}
      className={`text-right tabular-nums whitespace-nowrap ${
        valor > 0
          ? "text-emerald-600 dark:text-emerald-500"
          : valor < 0
            ? "text-destructive"
            : "text-muted-foreground"
      }`}
    >
      {valor === 0 ? "—" : `${valor < 0 ? "−" : ""}${fmt(Math.abs(valor))}`}
    </TableCell>
  );

  const columnDefs: Record<string, { th: ReactNode; td: (p: PagoEmpleado) => ReactNode }> = {
    // Puesto y area comparten columna: son la misma idea (donde encaja esta
    // persona) y separados gastaban dos columnas para dos palabras. El area va
    // debajo en gris, sin pildora de color: los colores por zona distraian del
    // dinero, que es lo que se viene a leer aqui.
    puesto: {
      th: th("puesto", "Puesto", "lista", "left", opcionesPuesto, "min-w-[110px]"),
      td: (p) => (
        <TableCell key="puesto" className="whitespace-nowrap">
          <span className="block text-[13px] leading-tight">{p.puesto || "—"}</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">{AREA_LABEL[p.area]}</span>
        </TableCell>
      ),
    },
    nominaBruta: {
      th: th("nominaBruta", "Nómina bruta", "numero"),
      td: (p) => (
        <TableCell key="nominaBruta" className="text-right tabular-nums whitespace-nowrap">
          {fmtDato(nominaBruta(p), nominaProcesada(p))}{circuloN(p, "nominaBruta")}
        </TableCell>
      ),
    },
    nomina: {
      th: th("nomina", "Nómina neta", "numero", "right", undefined, "font-semibold"),
      td: (p) => (
        <TableCell key="nomina" className="text-right tabular-nums whitespace-nowrap font-semibold">
          {fmtDato(p.nomina, nominaProcesada(p))}{circuloN(p, "neto")}
        </TableCell>
      ),
    },
    // Las tres columnas de horas salen del horario y de los fichajes reales: la
    // misma fuente que ve el empleado en su portal. Van juntas y en su propia
    // columna cada una para poder compararlas de un vistazo.
    horasReales: {
      th: th("horasReales", "H. horario", "numero"),
      td: (p) => {
        const h = horasMesMap?.get(p.empleadoId);
        return (
          <TableCell key="horasReales" className="text-right tabular-nums" title="Horas que marca su horario">
            {h ? fmtHoras(h.teoricas) : "—"}
          </TableCell>
        );
      },
    },
    horasTrabajadas: {
      th: th("horasTrabajadas", "H. fichadas", "numero"),
      td: (p) => {
        const h = horasMesMap?.get(p.empleadoId);
        return (
          <TableCell key="horasTrabajadas" className="text-right tabular-nums font-medium" title="Horas fichadas este mes">
            {h ? fmtHoras(h.normales + h.extras) : "—"}
          </TableCell>
        );
      },
    },
    horasBalance: {
      th: th("horasBalance", "Diferencia", "numero"),
      td: (p) => {
        const h = horasMesMap?.get(p.empleadoId);
        if (!h) return <TableCell key="horasBalance" className="text-right tabular-nums text-muted-foreground">—</TableCell>;
        // Verde si ha hecho horas de mas, rojo si le faltan, gris si cuadra.
        const cls =
          h.balance > 0.01 ? "text-emerald-600" : h.balance < -0.01 ? "text-destructive" : "text-muted-foreground";
        return (
          <TableCell key="horasBalance" className={`text-right tabular-nums ${cls}`} title="Fichadas − horario">
            {h.balance >= 0 ? "+" : ""}{fmtHoras(h.balance)}
          </TableCell>
        );
      },
    },
    complemento: {
      th: th("complemento", "Complemento", "numero", "right", undefined, "text-emerald-700"),
      td: (p) => celdaConcepto("complemento", p.complemento),
    },
    ajuste: {
      th: th("ajuste", "Ajuste", "numero", "right", undefined, "text-emerald-700"),
      td: (p) => celdaConcepto("ajuste", p.ajuste),
    },
    horasExtras: {
      th: th("horasExtras", "H.Extras", "numero", "right", undefined, "text-emerald-700"),
      td: (p) => celdaConcepto("horasExtras", p.horasExtras),
    },
    bonus: {
      th: th("bonus", "Bonus", "numero", "right", undefined, "text-emerald-700"),
      td: (p) => celdaConcepto("bonus", p.bonus),
    },
    ssEmpleado: {
      th: th("ssEmpleado", "SS trabajador", "numero", "right", undefined, "text-sky-700"),
      td: (p) => (
        <TableCell key="ssEmpleado" className="text-right tabular-nums whitespace-nowrap text-sky-700 dark:text-sky-400">
          {fmtDato(p.ssEmpleado, nominaProcesada(p))}{circuloN(p, "ssEmpleado")}
        </TableCell>
      ),
    },
    ssEmpresa: {
      th: th("ssEmpresa", "SS empresa", "numero", "right", undefined, "text-sky-700"),
      td: (p) => (
        <TableCell key="ssEmpresa" className="text-right tabular-nums whitespace-nowrap text-sky-700 dark:text-sky-400">
          {fmtDato(p.ssEmpresa, nominaProcesada(p))}{circuloN(p, "ssEmpresa")}
        </TableCell>
      ),
    },
    ssTotal: {
      th: th("ssTotal", "Total SS", "numero", "right", undefined, "text-sky-700"),
      td: (p) => (
        <TableCell key="ssTotal" className="text-right tabular-nums font-semibold whitespace-nowrap text-sky-700 dark:text-sky-400">
          {fmtDato(costeSSTotal(p), nominaProcesada(p))}{circuloN(p, "ssTotal")}
        </TableCell>
      ),
    },
    irpf: {
      th: th("irpf", "IRPF", "numero", "right", undefined, "text-amber-600"),
      td: (p) => (
        <TableCell key="irpf" className="text-right tabular-nums whitespace-nowrap text-amber-600 dark:text-amber-500">
          {fmtDato(p.irpf, nominaProcesada(p))}{circuloN(p, "irpf")}
        </TableCell>
      ),
    },
    nominaDoc: {
      th: <TableColumnHeader key="nominaDoc" label="Nómina" className="w-[70px]" align="center" />,
      td: (p) => (
        <TableCell key="nominaDoc" className="text-center">
          {p.numNominas > 0 || p.nominaPath ? (
            <button
              type="button"
              onClick={() => abrirNominaEmpleado(p)}
              disabled={abriendoNomina === p.empleadoId}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
              title={
                p.numNominas > 1
                  ? `Ver las ${p.numNominas} nóminas de ${p.empleadoNombre} (se abren en un único PDF)`
                  : `Ver la nómina de ${p.empleadoNombre}`
              }
              aria-label={`Ver la nómina de ${p.empleadoNombre}`}
            >
              {abriendoNomina === p.empleadoId ? (
                <Clock className="h-4 w-4 animate-pulse" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground" title="Sin nómina adjunta">—</span>
          )}
        </TableCell>
      ),
    },
    // Lo que se lleva el trabajador. Se destaca porque es la cifra que se paga.
    total: {
      th: th("total", "Total a pagar", "numero", "right", undefined, "font-bold"),
      td: (p) => (
        <TableCell key="total" className="text-right whitespace-nowrap">
          <span className="text-[15px] font-bold tabular-nums">{fmt(p.total)}</span>
        </TableCell>
      ),
    },
    // Lo que le cuesta a la empresa: lo que cobra mas toda la Seguridad Social.
    costeTotal: {
      th: th("costeTotal", "Coste total", "numero", "right", undefined, "font-bold"),
      td: (p) => (
        <TableCell key="costeTotal" className="text-right whitespace-nowrap bg-muted/40">
          <span className="text-[15px] font-bold tabular-nums">{fmt(p.total + costeSSTotal(p))}</span>
        </TableCell>
      ),
    },
    pagado: {
      th: th("pagado", "Pagar", "booleano", "center", undefined, "w-[120px]"),
      td: (p) => {
        const ext = p.empleadoId.startsWith("ext-");
        const bloqueado = pagarBloqueado(p);
        return (
          <TableCell key="pagado" className="text-center">
            {ext ? (
              <span className="text-muted-foreground text-xs">—</span>
            ) : p.pagado ? (
              <Button
                size="sm"
                className="h-7 gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => void togglePagar(p)}
                title="Pagado (pulsa para revertir)"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />Pagado
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className={
                  bloqueado
                    ? "h-7 gap-1 border-primary/40 text-primary/60 disabled:opacity-100"
                    : p.confirmacionAceptadaAt
                      ? "h-7 gap-1 animate-pulse border-emerald-600 font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                      : "h-7 gap-1 border-primary text-primary hover:bg-primary/5"
                }
                onClick={() => void togglePagar(p)}
                disabled={bloqueado}
                title={
                  bloqueado
                    ? "Liquidación enviada: esperando a que el trabajador la confirme"
                    : p.confirmacionAceptadaAt
                      ? "El trabajador ha confirmado que la cobra: ya se puede pagar"
                      : "Marcar como pagado"
                }
              >
                <Banknote className="h-3.5 w-3.5" />Pagar
              </Button>
            )}
          </TableCell>
        );
      },
    },
    // Nota libre de RRHH. Ultima columna de datos y sin fila de total: un texto
    // no suma (cae en el fallback de `totalDefs`, como `puesto` o `area`).
    comentario: {
      th: th("comentario", "Comentario", "texto", "left", undefined, "min-w-[120px]"),
      td: (p) => {
        const rechazo = p.confirmacionRechazadaAt ? p.comentarioEmpleado : null;
        if (!p.comentario && !rechazo) {
          return <TableCell key="comentario" className="max-w-[280px]"><span className="text-muted-foreground text-xs">—</span></TableCell>;
        }
        return (
          <TableCell key="comentario" className="max-w-[280px]">
            {rechazo && (
              <span
                className="block truncate text-xs font-medium text-destructive"
                title={`El trabajador rechazó la liquidación: ${rechazo}`}
              >
                Rechazado: {rechazo}
              </span>
            )}
            {p.comentario && (
              <span className="block truncate text-xs" title={p.comentario}>{p.comentario}</span>
            )}
          </TableCell>
        );
      },
    },
  };

  // Los dos bloques de la tarjeta de cuadre. Cada uno mira SU mes: las nóminas,
  // el que se está viendo; los seguros sociales, el que cotiza el recibo, que va
  // a mes vencido. Las cifras se enseñan aunque no cuadren o falte una: la
  // tarjeta informa siempre, y son los botones los que se desactivan.
  const bloquesCuadre: BloqueCuadre[] = [
    {
      clave: "nominas",
      titulo: "Nóminas",
      periodo,
      mesLabel: mesLabelNominas,
      // En las nóminas los dos lados salen del mismo volcado, así que cuadran por
      // construcción: lo que se aprueba es la entrega, no una comparación.
      sistema: nominasEnMes > 0 ? ssNominasMes : null,
      gestoria: nominasEnMes > 0 ? ssNominasMes : null,
      aprobadoEn: estadoMes.confirmado ? estadoMes.confirmadoEn : null,
      rechazadoEn: estadoMes.rechazado ? estadoMes.rechazadoEn : null,
      aprobadoPor: null,
      nota:
        nominasEnMes === 0
          ? `La gestoría todavía no ha entregado las nóminas de ${mesLabelNominas}.`
          : incidenciasNominas > 0
            ? `${incidenciasNominas} nómina${incidenciasNominas === 1 ? "" : "s"} con incidencia por revisar.`
            : null,
      puedeGestionar: estadoMes.puedeGestionar,
    },
    {
      clave: "seguros",
      titulo: "Seguros sociales",
      periodo: mesCotizadoPrincipal,
      mesLabel: nombreMesLargo(mesCotizadoPrincipal),
      // Sistema = la cotización de las nóminas de ESE mes. Gestoría = la suma de
      // los líquidos de sus recibos. Si algún recibo no se pudo leer, el total
      // está incompleto y no se puede afirmar que cuadre: se muestra "—".
      sistema: cuadreSs && !cuadreSs.sinNominas ? cuadreSs.ssNominas : null,
      gestoria: cuadreSs?.comprobable ? cuadreSs.totalTc1 : null,
      aprobadoEn: cuadreSs?.aprobadoEn ?? null,
      rechazadoEn: cuadreSs?.rechazadoEn ?? null,
      aprobadoPor: null,
      nota: !hayTc1
        ? `Sin el recibo de cotizaciones no se puede comprobar la Seguridad Social de ${nombreMesLargo(mesCotizadoPrincipal)}.`
        : cuadreSs?.sinNominas
          ? `Este recibo cotiza ${nombreMesLargo(mesCotizadoPrincipal)} y de ese mes no hay nóminas en el sistema.`
          : !cuadreSs?.comprobable
            ? `${cuadreSs?.numTc1SinImporte ?? 0} de ${cuadreSs?.numTc1 ?? 0} recibos sin importe legible: comprueba el cuadre a mano.`
            : !cuadreSs.cuadra
              ? "Revisa si falta alguna liquidación complementaria (vacaciones) o alguna nómina del mes."
              : cuadreSs.numTc1 > 1
                ? `${cuadreSs.numTc1} recibos sumados.`
                : null,
      puedeGestionar: estadoMes.puedeGestionar,
    },
  ];

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  // ¿Hay al menos una nómina procesada en la vista? Para los totales de SS/IRPF:
  // si nadie la tiene, se muestra "—"; si alguien sí, se muestra el total (0 € si toca).
  const hayNominaProcesada = pagosFiltrados.some((p) => nominaProcesada(p));

  // Celda de TOTALES por columna (respeta el orden y la visibilidad dinámicos, en
  // paralelo a columnDefs). Sin entrada = celda vacía.
  const totalNominaBruta = pagosFiltrados.reduce((s, p) => s + nominaBruta(p), 0);
  const totalIrpf = pagosFiltrados.reduce((s, p) => s + p.irpf, 0);
  const totalDefs: Record<string, ReactNode> = {
    nominaBruta: <TableCell key="t-nominabruta" className="text-right tabular-nums">{fmtDato(totalNominaBruta, hayNominaProcesada)}</TableCell>,
    nomina: <TableCell key="t-nomina" className="text-right tabular-nums font-semibold">{fmtDato(resumen.totalNomina, hayNominaProcesada)}</TableCell>,
    horasReales: <TableCell key="t-hr" className="text-right tabular-nums">{fmtHoras(pagosFiltrados.reduce((a, p) => a + (horasMesMap?.get(p.empleadoId)?.teoricas ?? 0), 0))}</TableCell>,
    horasTrabajadas: <TableCell key="t-ht" className="text-right tabular-nums font-medium">{fmtHoras(pagosFiltrados.reduce((a, p) => { const h = horasMesMap?.get(p.empleadoId); return a + (h ? h.normales + h.extras : 0); }, 0))}</TableCell>,
    horasBalance: (() => {
      const bal = pagosFiltrados.reduce((a, p) => a + (horasMesMap?.get(p.empleadoId)?.balance ?? 0), 0);
      const cls = bal > 0.01 ? "text-emerald-600" : bal < -0.01 ? "text-destructive" : "text-muted-foreground";
      return <TableCell key="t-bal" className={`text-right tabular-nums ${cls}`}>{bal >= 0 ? "+" : ""}{fmtHoras(bal)}</TableCell>;
    })(),
    complemento: <TableCell key="t-complemento" className="text-right tabular-nums">{fmt(resumen.totalComplementos)}</TableCell>,
    ajuste: (
      <TableCell key="t-ajuste" className={`text-right tabular-nums ${resumen.totalAjustes < 0 ? "text-destructive" : resumen.totalAjustes > 0 ? "text-emerald-600" : ""}`}>
        {resumen.totalAjustes === 0 ? "—" : `${resumen.totalAjustes > 0 ? "+" : "−"}${fmt(Math.abs(resumen.totalAjustes))}`}
      </TableCell>
    ),
    horasExtras: <TableCell key="t-extras" className="text-right tabular-nums">{fmt(resumen.totalExtras)}</TableCell>,
    bonus: <TableCell key="t-bonus" className="text-right tabular-nums">{fmt(resumen.totalBonus)}</TableCell>,
    ssEmpleado: <TableCell key="t-ssemp" className="text-right tabular-nums whitespace-nowrap text-sky-700 dark:text-sky-400">{fmtDato(resumen.totalSsEmpleado, hayNominaProcesada)}</TableCell>,
    ssEmpresa: <TableCell key="t-ssempresa" className="text-right tabular-nums whitespace-nowrap text-sky-700 dark:text-sky-400">{fmtDato(resumen.totalSsEmpresa, hayNominaProcesada)}</TableCell>,
    ssTotal: <TableCell key="t-sstotal" className="text-right tabular-nums font-semibold whitespace-nowrap text-sky-700 dark:text-sky-400">{fmtDato(resumen.totalSs, hayNominaProcesada)}</TableCell>,
    irpf: <TableCell key="t-irpf" className="text-right tabular-nums whitespace-nowrap text-amber-600 dark:text-amber-500">{fmtDato(totalIrpf, hayNominaProcesada)}</TableCell>,
    total: <TableCell key="t-total" className="text-right whitespace-nowrap"><span className="text-[15px] font-bold tabular-nums">{fmt(resumen.totalFinal)}</span></TableCell>,
    costeTotal: <TableCell key="t-coste" className="text-right whitespace-nowrap bg-muted/40"><span className="text-[15px] font-bold tabular-nums">{fmt(resumen.totalFinal + resumen.totalSs)}</span></TableCell>,
    pagado: <TableCell key="t-pagado" className="text-center"><Badge variant={pagosFiltrados.every((p) => p.pagado) ? "default" : "secondary"} className="text-[10px]">{pagosFiltrados.filter((p) => p.pagado).length}/{pagosFiltrados.length}</Badge></TableCell>,
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarRangeToggle
          mode={calRange.mode}
          onChange={calRange.setMode}
          modes={MODES_PAGOS}
        />
        <CalendarRangeNav
          label={calRange.label}
          onPrev={calRange.prev}
          onNext={calRange.next}
          onToday={calRange.goToToday}
          isToday={calRange.isToday}
        />
        <input
          ref={nominasInputRef}
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => {
            void subirNominas(e.target.files);
            e.target.value = "";
          }}
        />
        {/* Todas las nóminas del mes en un PDF. Solo con nóminas subidas: si no,
            no hay nada que descargar. */}
        {nominasEnMes > 0 && !esVistaAgregada && (
          <Button
            variant="outline"
            size="icon"
            className="ml-auto"
            onClick={descargarNominasDelMes}
            disabled={descargandoMes}
            title="Descargar todas las nóminas del mes en un PDF"
          >
            {descargandoMes ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          variant="outline"
          className={nominasEnMes > 0 && !esVistaAgregada ? "gap-2" : "ml-auto gap-2"}
          onClick={() => setShowDocsMes(true)}
          // Con el mes confirmado se sigue pudiendo abrir: dentro, las nóminas
          // quedan bloqueadas pero el recibo de cotizaciones no, que llega más
          // tarde y es un documento aparte.
          disabled={subiendoNominas || esVistaAgregada}
          title="Elige el mes y sube sus nóminas y TC1; la IA los lee y vuelca los datos"
        >
          <Upload className="h-4 w-4" />
          {subiendoNominas
            ? `Leyendo nóminas… ${progresoNominas.hechas}/${progresoNominas.total}`
            : "Subir nóminas"}
        </Button>
        <Button
          className="gap-2"
          onClick={() =>
            enviarConfirmaciones(
              pagos.filter((p) => !p.confirmacionEnviadaAt).map((p) => p.empleadoId),
              "liquidaciones",
            )
          }
          disabled={
            enviando ||
            esVistaAgregada ||
            !estadoMes.confirmado ||
            pagos.every((p) => !!p.confirmacionEnviadaAt)
          }
          title={
            !estadoMes.confirmado
              ? "Primero hay que confirmar las nóminas del mes: hasta entonces los importes pueden cambiar"
              : "Envía a cada trabajador su liquidación del mes y avisa a contabilidad de que puede pagar"
          }
        >
          <Send className="h-4 w-4" />
          Enviar liquidaciones
        </Button>
      </div>

      {/* CUADRE DE LA ENTREGA: los dos documentos que manda la gestoría, cada
          uno contra las nóminas de SU mes. Va en una franja a todo el ancho,
          sobre la tabla, y se pinta SIEMPRE —también en meses vacíos—, porque es
          donde se ve de un vistazo si queda algo por aprobar. En trimestre/año
          no: sería mezclar meses. */}
      {!esVistaAgregada && (
        <div>
          <CuadreEntregaCard
            periodo={periodo}
            bloques={bloquesCuadre}
            ocupado={cuadreOcupado}
            onAprobar={(c) => (c === "nominas" ? confirmarMes() : aprobarSs())}
            onRechazar={(c) => {
              setRechazoDe(c);
              setShowRechazo(true);
            }}
            onReabrir={(c) => (c === "nominas" ? reabrirMes() : reabrirSs())}
            onVerDocumentos={() => setShowDocsMes(true)}
            cargarHistorico={() => listarHistoricoMes(periodo)}
          />
        </div>
      )}

      {errorCarga && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          {errorCarga}
        </div>
      )}

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        ocultarNuevo
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
          <>
            <IOActions
              config={pagosIO}
              context={{ empresaId: empresaActual.id }}
              exportRecords={pagosFiltrados}
              onSuccess={() => window.location.reload()}
            />
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 relative"
              onClick={() => setShowRevision(true)}
              title="Nóminas subidas"
              aria-label="Nóminas subidas"
            >
              <ReceiptText className="h-4 w-4" strokeWidth={1.75} />
              {incidenciasNominas > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-amber-500 text-[10px] font-semibold text-white flex items-center justify-center">
                  {incidenciasNominas}
                </span>
              )}
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

      {/* CONFIGURACIÓN del módulo (engranaje): ajustes de uso diario de ESTA
          vista. Hoy vacío — los dos ajustes que había (avisos de liquidación y
          envío a la gestoría) son normas de empresa y viven en Ajustes, que es
          otra barrera de permisos. No se enlaza a Ajustes desde aquí. */}
      {showConfig && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No hay configuración propia de Pagos por ahora.
            </p>
          </CardContent>
        </Card>
      )}

      {esVistaAgregada && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-900/40 dark:bg-sky-950/20">
          <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p className="text-sky-900 dark:text-sky-200">
            Vista <b>acumulada</b>: cada fila suma lo cobrado por ese trabajador en el periodo, e
            incluye a quien solo cobró algún mes suelto. Para editar, confirmar o pagar, cambia a
            vista mensual.
          </p>
        </div>
      )}

      {estadoMes.confirmado && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-emerald-900 dark:text-emerald-200">
            Las nóminas de <b>{mesLabelNominas}</b> están confirmadas: los importes que vienen de la
            nómina no se pueden modificar y cada empleado ya ve la suya en su portal.
          </p>
        </div>
      )}

      {/* Mes DEVUELTO: está vacío a propósito, esperando que la gestoría suba la
          entrega corregida. Se recuerda qué se les dijo, para no repetirlo. */}
      {estadoMes.rechazado && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <Undo2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-amber-900 dark:text-amber-200">
            <p>
              Las nóminas de <b>{mesLabelNominas}</b> se devolvieron a la gestoría
              {estadoMes.rechazadoEn
                ? ` el ${new Date(estadoMes.rechazadoEn).toLocaleDateString("es-ES", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  })}`
                : ""}
              . El mes está vacío hasta que suban la entrega corregida (será la nº {estadoMes.ronda}).
            </p>
            {estadoMes.rechazoMotivo && (
              <p className="mt-1 whitespace-pre-line text-xs opacity-90">
                <b>Se les comunicó:</b> {estadoMes.rechazoMotivo}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Devolución a la gestoría. Es el mismo diálogo para los dos documentos:
          llega marcado el que se pulsó, y desde dentro se puede añadir el otro.
          Marcar las nóminas las BORRA (la gestoría sube la entrega corregida
          entera); marcar solo los seguros sociales conserva el recibo, para
          poder compararlo con el que llegue. */}
      <RechazarNominasDialog
        key={rechazoDe}
        open={showRechazo}
        onOpenChange={setShowRechazo}
        mesLabel={rechazoDe === "seguros" ? nombreMesLargo(mesCotizadoPrincipal) : mesLabelNominas}
        nominasEnMes={nominasEnMes}
        enviando={rechazando}
        inicial={rechazoDe}
        onConfirmar={(motivo, que) => {
          // Solo los seguros sociales: no hay entrega que borrar ni correo de
          // devolución del mes; se marca el recibo y se conserva.
          if (!que.nominas && que.segurosSociales) return rechazarSs(motivo);
          return rechazarMes(motivo, que);
        }}
      />

      <NominasRevisionDialog
        open={showRevision}
        onOpenChange={setShowRevision}
        periodo={periodo}
        mesLabel={mesLabelNominas}
        onCambio={() => {
          setPagosPorRango({});
          refrescarIncidenciasNominas();
        }}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table data-tabla-consulta className="[&_th]:h-9 [&_th]:px-2 [&_td]:px-2 [&_td]:py-1.5 text-[13px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableColumnHeader
                    campo="empleado"
                    label="Empleado"
                    filtroTipo="lista"
                    opciones={opcionesEmpleado}
                    filtros={filtros}
                    onFiltrosChange={setFiltros}
                    ordenable
                    orden={orden}
                    onOrdenChange={setOrden}
                    align="left"
                    className="min-w-[130px]"
                  />
                  {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && pagosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnasRender.length + 2} className="text-center text-muted-foreground py-8">
                      Cargando empleados…
                    </TableCell>
                  </TableRow>
                ) : pagosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnasRender.length + 2} className="text-center text-muted-foreground py-8">
                      No hay empleados en esta empresa.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagosFiltrados.map((p) => {
                    return (
                      <TableRow
                        key={p.id}
                        className={`h-[52px] ${p.pagado ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {p.avisoInactivo ? (
                              <span
                                title="Este empleado ya estaba de baja cuando se subió su nómina. Revisa si realmente debe cobrar."
                                aria-label="Empleado dado de baja: revisar si debe cobrar"
                                className="inline-flex"
                              >
                                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                              </span>
                            ) : null}
                            <span className="block max-w-[150px] truncate" title={p.empleadoNombre}>
                              {p.empleadoNombre}
                            </span>
                          </div>
                          {p.dniNie ? (
                            <div className="text-[11px] font-normal tabular-nums text-muted-foreground">{p.dniNie}</div>
                          ) : !p.empleadoId.startsWith("ext-") ? (
                            <div className="text-[11px] font-normal text-amber-600">Falta DNI</div>
                          ) : null}
                        </TableCell>
                        {columnasRender.map((c) => columnDefs[c.campo]?.td(p))}
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            {p.confirmacionEnviadaAt || p.confirmacionAceptadaAt ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 cursor-not-allowed text-muted-foreground"
                                  disabled
                                  title={p.confirmacionAceptadaAt ? "Liquidación confirmada por el empleado (bloqueada)" : "Liquidación enviada (bloqueada)"}
                                >
                                  <Lock className="h-3.5 w-3.5" />
                                </Button>
                                {esDirector && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => reabrir(p)} title="Reabrir liquidación"><Unlock className="h-3.5 w-3.5" /></Button>
                                )}
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setEditando(p)}
                                  disabled={estadoMes.confirmado || esVistaAgregada}
                                  title={estadoMes.confirmado ? "Nóminas del mes confirmadas: la liquidación no se puede editar" : "Editar"}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                {!p.empleadoId.startsWith("ext-") && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => enviarConfirmaciones([p.empleadoId], "liquidación")} disabled={enviando} title="Enviar liquidación a este empleado"><Send className="h-3.5 w-3.5" /></Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                {pagosFiltrados.length > 0 && (
                  <TableRow className="bg-muted/60 font-semibold border-t-2">
                    <TableCell>TOTALES</TableCell>
                    {columnasRender.map((c) => totalDefs[c.campo] ?? <TableCell key={`t-${c.campo}`} />)}
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* DOCUMENTOS DEL MES: nóminas + TC1 juntos. Son la misma entrega mensual,
          así que se suben desde el mismo sitio. */}
      <Dialog open={showDocsMes} onOpenChange={setShowDocsMes}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Subir nóminas y TC1</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* EL MES manda sobre TODA la entrega: nóminas y TC1 van al mes que
                se elija aquí, no al que muestre el calendario. La gestoría envía a
                menudo el mes atrasado completo, y se sube de una vez. */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <Label className="text-xs text-muted-foreground">Mes de la entrega</Label>
              <Select value={mesSubida} onValueChange={setMesSubida} disabled={subiendoNominas || subiendoTc1}>
                <SelectTrigger className="mt-1.5 h-9">
                  <SelectValue placeholder="Elige el mes" />
                </SelectTrigger>
                <SelectContent>
                  {mesesSubida.map((m) => {
                    const est = estadoSubidaMeses[m];
                    const subido = (est?.nominas ?? 0) > 0;
                    return (
                      <SelectItem key={m} value={m}>
                        {nombreMesLargo(m)}
                        {subido ? " · ya subidas" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Las nóminas y los TC1 que adjuntes se guardarán en {mesSubidaLabel || "el mes elegido"}.
              </p>
            </div>

            {/* 1) Las nóminas */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Nóminas</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Un PDF con todas (una por página) o varios archivos. Se leen y se asignan a
                    cada trabajador.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={subiendoNominas || mesSubidaYaTieneNominas || mesSubidaConfirmado}
                  title={
                    mesSubidaYaTieneNominas
                      ? `Las nóminas de ${mesSubidaLabel} ya están subidas`
                      : undefined
                  }
                  onClick={() => nominasInputRef.current?.click()}
                >
                  {subiendoNominas ? <Clock className="h-4 w-4 animate-pulse" /> : <Upload className="h-4 w-4" />}
                  {subiendoNominas
                    ? `${progresoNominas.hechas}/${progresoNominas.total}`
                    : "Adjuntar"}
                </Button>
              </div>

              {mesSubidaYaTieneNominas ? (
                <p className="mt-2 text-xs text-amber-600">
                  Las nóminas de {mesSubidaLabel} ya están subidas
                  {estadoMesSubida?.nominas ? ` (${estadoMesSubida.nominas})` : ""}.
                  {mesSubidaConfirmado
                    ? " El mes está confirmado: para cambiarlas hay que reabrirlo."
                    : " Para cambiarlas, devuelve el mes a la gestoría."}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Si alguna nómina del archivo no es de {mesSubidaLabel || "ese mes"}, se rechaza
                  el archivo entero y no se guarda nada.
                </p>
              )}

              {!hayTc1Subida && incidenciasNominas > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  {incidenciasNominas} nómina{incidenciasNominas === 1 ? "" : "s"} con incidencia por revisar.
                </p>
              )}
            </div>

            {/* 2) Los TC1: documentos de EMPRESA, no de un empleado. Puede
                haber VARIOS en un mes (la liquidación ordinaria y la
                complementaria de vacaciones): la Seguridad Social las cobra por
                separado, así que el total del mes es la SUMA de sus importes. */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">TC1 · Recibos de cotizaciones</p>
                  {/* Los TC1 entran con la entrega de este mes, pero cotizan otro:
                      la Seguridad Social se liquida a mes vencido. */}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {hayTc1Subida
                      ? `Llegan con la entrega de ${mesSubidaLabel}. Su suma debe cuadrar con la Seguridad Social de las nóminas.`
                      : `Documentos de la empresa con las bases y cuotas. Si hay liquidación complementaria (vacaciones), adjunta las dos.`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={subiendoTc1 || ssMesElegidoAprobado}
                  title={
                    ssMesElegidoAprobado
                      ? `Los seguros sociales de ${nombreMesLargo(mesCotizadoTc1)} ya están aprobados: reábrelos para añadir otro recibo`
                      : undefined
                  }
                  onClick={() => tc1InputRef.current?.click()}
                >
                  {subiendoTc1 ? <Clock className="h-4 w-4 animate-pulse" /> : <Upload className="h-4 w-4" />}
                  {subiendoTc1 ? "Leyendo…" : hayTc1Subida ? "Añadir otro" : "Adjuntar"}
                </Button>
              </div>

              {/* MES COTIZADO: se elige antes de adjuntar. Los seguros sociales
                  van a mes vencido, así que con las nóminas de agosto llega el
                  TC1 de julio: se propone ese, y se cambia si el recibo es otro
                  (por ejemplo, una complementaria de un periodo anterior). */}
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Mes de estos seguros sociales</Label>
                <Select
                  value={mesCotizadoTc1}
                  onValueChange={setMesTc1Elegido}
                  disabled={subiendoTc1 || ssMesElegidoAprobado}
                >
                  <SelectTrigger className="mt-1.5 h-9">
                    <SelectValue placeholder="Elige el mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {mesesCotizacionTc1.map((m) => (
                      <SelectItem key={m} value={m}>
                        {nombreMesLargo(m)}
                        {m === mesAnterior(mesSubida || periodo) ? " · lo habitual" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Elígelo antes de adjuntar. Cada recibo se guarda con el mes que tenga marcado
                  aquí, así que si hay complementaria de otro periodo, adjúntala aparte.
                </p>
              </div>

              {hayTc1Subida && (
                <div className="mt-3 space-y-2">
                  {tc1Subida.map((t) => (
                    <div key={t.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => abrirTc1(t.id)}
                          className="truncate text-xs font-medium underline-offset-2 hover:underline"
                        >
                          {t.nombre}
                        </button>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {t.importe != null ? (
                            <span className="tabular-nums">{fmt(t.importe)}</span>
                          ) : (
                            <span className="text-amber-600">Importe no leído</span>
                          )}
                          {t.trabajadores != null && <span>{t.trabajadores} trabajadores</span>}
                          {/* Mes cotizado que se marcó al subirlo: es el dato que
                              manda, y normalmente es el anterior al de la entrega. */}
                          {t.periodoCotizacion && (
                            <span>Cotiza {nombreMesLargo(t.periodoCotizacion)}</span>
                          )}
                          {/* Aviso solo si el papel dice otra cosa que lo marcado:
                              puede ser un despiste al elegir el mes. */}
                          {t.periodoDocumento &&
                            t.periodoCotizacion &&
                            t.periodoDocumento !== t.periodoCotizacion && (
                            <span className="text-amber-600">
                              El documento declara {nombreMesLargo(t.periodoDocumento)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                        disabled={t.aprobadoEn != null}
                        onClick={() => quitarTc1(t.id, t.nombre)}
                      >
                        <X className="h-4 w-4" />
                        Quitar
                      </Button>
                    </div>
                  ))}

                  {/* Cuadre POR MES COTIZADO: cada recibo frente a la Seguridad
                      Social de las nóminas del mes que cotiza. Con los seguros
                      sociales a mes vencido ese mes NO es el de la entrega, así
                      que compararlo con ella daría un descuadre falso. */}
                  {cuadrePorMes.map((c) => (
                    <div key={c.periodo} className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                      <p className="font-medium">
                        Cotización de {nombreMesLargo(c.periodo)}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          Total TC1{c.numTc1 > 1 ? ` (${c.numTc1} recibos)` : ""}
                        </span>
                        <span className="tabular-nums font-medium">
                          {c.totalTc1 != null ? fmt(c.totalTc1) : "—"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          Seguridad Social de las nóminas de {nombreMesLargo(c.periodo)}
                        </span>
                        <span className="tabular-nums font-medium">
                          {c.sinNominas ? "—" : fmt(c.ssNominas)}
                        </span>
                      </div>
                      {/* Aún no hay nóminas de ese mes: no es un descuadre, es que
                          falta la otra mitad para poder comparar. */}
                      {c.sinNominas ? (
                        <p className="mt-1.5 text-amber-600">
                          No hay nóminas de {nombreMesLargo(c.periodo)} en el sistema, así que no se
                          puede comprobar. Súbelas para cuadrar estos seguros sociales.
                        </p>
                      ) : c.comprobable ? (
                        <p className={`mt-1.5 ${c.cuadra ? "text-muted-foreground" : "text-destructive font-medium"}`}>
                          {c.cuadra
                            ? "Cuadra con las nóminas."
                            : `No cuadra: ${fmt(Math.abs((c.totalTc1 ?? 0) - c.ssNominas))} de diferencia.`}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-amber-600">
                          Falta el importe de algún recibo: revisa el cuadre a mano.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <input
            ref={tc1InputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => {
              void subirTc1(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar pago — {editando?.empleadoNombre}</DialogTitle></DialogHeader>
          {editando && <EditForm pago={editando} onSave={guardarEdicion} />}
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}

function EditForm({ pago, onSave }: { pago: PagoEmpleado; onSave: (d: Partial<PagoEmpleado>) => void }) {
  const [form, setForm] = useState({ ...pago });
  // Editables a mano: conceptos que NO salen de la nómina.
  const campos: { key: keyof PagoEmpleado; label: string }[] = [
    { key: "complemento", label: "Complemento" },
    { key: "ajuste", label: "Ajuste (+/−)" },
    { key: "horasExtras", label: "H. Extras" },
    { key: "bonus", label: "Bonus" },
  ];
  // Vienen de la nómina leída: se muestran, pero NO se editan. Corregirlos a mano
  // desincronizaría la tabla del documento oficial; para cambiarlos hay que borrar
  // la nómina y volver a subirla desde el diálogo de revisión.
  const camposNomina: { key: keyof PagoEmpleado; label: string }[] = [
    { key: "nomina", label: "Nómina neta" },
    { key: "ssEmpleado", label: "SS Empleado" },
    { key: "ssEmpresa", label: "SS Empresa" },
    { key: "irpf", label: "IRPF" },
  ];
  const eur = (n: number) =>
    n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {campos.map((c) => (
          <div key={c.key} className="space-y-1">
            <Label className="text-xs">{c.label}</Label>
            <NumberInput value={form[c.key] as number} onValueChange={(v) => setForm((prev) => ({ ...prev, [c.key]: v }))} />
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Comentario</Label>
        <Textarea
          value={form.comentario ?? ""}
          onChange={(e) => setForm((prev) => ({ ...prev, comentario: e.target.value || null }))}
          onBlur={(e) => {
            const t = e.target.value.trim();
            setForm((prev) => ({ ...prev, comentario: t ? capitalizeText(t) : null }));
          }}
          placeholder="Nota interna sobre este pago (opcional)"
          className="min-h-[60px] text-sm"
        />
      </div>

      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-medium">Datos de la nómina (no editables)</p>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {camposNomina.map((c) => (
            <div key={c.key} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{c.label}</span>
              <span className="tabular-nums font-medium">{eur(form[c.key] as number)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Salen del documento que subió la gestoría. Para corregirlos, borra esa nómina desde
          «Revisar nóminas» y sube la correcta.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Total coste Seguridad Social:{" "}
        <span className="font-medium text-foreground">
          {costeSSTotal(form).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
        </span>{" "}
        (informativo, no afecta al total del pago).
      </p>
      <DialogFooter><Button onClick={() => onSave(form)}>Guardar</Button></DialogFooter>
    </div>
  );
}
