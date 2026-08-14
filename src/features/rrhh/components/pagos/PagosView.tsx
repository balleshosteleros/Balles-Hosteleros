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
import { procesarNominasLeidas, getNominaArchivoUrl } from "@/features/rrhh/actions/nominas-archivo-actions";
import type { NominaLeida } from "@/features/rrhh/services/nominas/procesar-nominas";
import {
  getNotifLiquidacionesConfig,
  type NotifLiquidacionesConfig,
} from "@/features/notificaciones/actions/notif-config-actions";
import { NominasRevisionDialog } from "@/features/rrhh/components/pagos/NominasRevisionDialog";
import {
  listarNominasRevision,
  getEstadoMesNominas,
  confirmarMesNominas,
  reabrirMesNominas,
  subirTc1Mes,
  getTc1MesUrl,
  borrarTc1Mes,
  type EstadoMesNominas,
} from "@/features/rrhh/actions/nominas-revision-actions";
import { MAX_NOMINAS_MB, MAX_NOMINAS_BYTES } from "@/shared/lib/documentos";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import { ZONE_COLORS } from "@/features/direccion/data/direccion";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Edit2, Banknote, Send, Lock, Unlock, CheckCircle2, Clock, Upload, ReceiptText, AlertTriangle, FileText, ShieldCheck, X } from "lucide-react";
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
    pago: g.pago,
    nomina: g.nomina,
    horasReales: g.horasReales,
    horasTrabajadas: g.horasTrabajadas,
    propina: g.propina,
    ajuste: g.ajuste,
    horasExtras: g.horasExtras,
    bonus: g.bonus,
    propinaMantenimiento: g.propinaMantenimiento,
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
    pago: p.pago,
    nomina: p.nomina,
    horasReales: p.horasReales,
    horasTrabajadas: p.horasTrabajadas,
    propina: p.propina,
    ajuste: p.ajuste,
    horasExtras: p.horasExtras,
    bonus: p.bonus,
    propinaMantenimiento: p.propinaMantenimiento,
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
    pago: 0,
    nomina: 0,
    horasReales: 0,
    horasTrabajadas: 0,
    propina: 0,
    ajuste: 0,
    horasExtras: 0,
    bonus: 0,
    propinaMantenimiento: 0,
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
  const [showRevision, setShowRevision] = useState(false);
  // empleadoId cuya nómina se está abriendo (para el indicador del icono).
  const [abriendoNomina, setAbriendoNomina] = useState<string | null>(null);
  const [confirmandoMes, setConfirmandoMes] = useState(false);
  const [subiendoTc1, setSubiendoTc1] = useState(false);
  const tc1InputRef = useRef<HTMLInputElement>(null);
  // Diálogo único de la entrega del mes: nóminas + TC1.
  const [showDocsMes, setShowDocsMes] = useState(false);
  // Estado del mes: en borrador se puede corregir; confirmado es inmutable.
  const [estadoMes, setEstadoMes] = useState<EstadoMesNominas>({
    confirmado: false,
    confirmadoEn: null,
    puedeGestionar: false,
    tc1: null,
  });
  const [incidenciasNominas, setIncidenciasNominas] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [subiendoNominas, setSubiendoNominas] = useState(false);
  const [progresoNominas, setProgresoNominas] = useState({ hechas: 0, total: 0 });
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

  const claveRango = rangoKey(calRange.range);
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

  const mesLabelNominas = useMemo(() => {
    const [y, m] = (periodo ?? "").split("-");
    const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return m ? `${MESES[Number(m) - 1] ?? ""} ${y}`.trim() : "";
  }, [periodo]);

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
    if (!resEmp.ok) return;

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

  // Re-cargar al cambiar empresa (limpia cache)
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
    const proc = await procesarNominasLeidas(todas, periodo, nombreArchivo);
    setSubiendoNominas(false);
    if (!proc.ok || !proc.resultado) {
      toast.error(proc.error ?? "No se pudieron guardar las nóminas.");
      return;
    }
    const r = proc.resultado;

    // Recargar caché para que se vean las nóminas nuevas al navegar por meses.
    setPagosPorRango({});
    refrescarIncidenciasNominas();

    const nombreMes = (p: string) => {
      const [y, m] = p.split("-");
      const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
      return `${MESES[Number(m) - 1] ?? ""} ${y}`.trim();
    };

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
    } catch {
      toast.error("No se pudo abrir la nómina.");
    } finally {
      setAbriendoNomina(null);
    }
  };

  // TC1 del mes: documento de EMPRESA (bases y cuotas de toda la plantilla). Se
  // guarda aparte de las nóminas y NO se reparte a ningún empleado.
  const subirTc1 = async (file: File | null) => {
    if (!file) return;
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
        periodo,
        nombre: file.name,
        mimeType: file.type || "application/pdf",
        archivoBase64: base64,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo subir el TC1.");
        return;
      }
      await refrescarEstadoMes();
      toast.success(`TC1 de ${mesLabelNominas} adjuntado.`);
    } catch {
      toast.error("No se pudo subir el TC1.");
    } finally {
      setSubiendoTc1(false);
    }
  };

  const abrirTc1 = async () => {
    const res = await getTc1MesUrl(periodo);
    if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
    else toast.error(res.error ?? "No se pudo abrir el TC1.");
  };

  const quitarTc1 = async () => {
    const ok = await confirm({
      title: `Quitar el TC1 de ${mesLabelNominas}`,
      description: "Se borrará el documento del mes. Podrás volver a adjuntarlo cuando quieras.",
      confirmLabel: "Quitar TC1",
    });
    if (!ok) return;
    const res = await borrarTc1Mes(periodo);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo quitar el TC1.");
      return;
    }
    await refrescarEstadoMes();
    toast.success("TC1 quitado.");
  };

  // Cierra el mes: las nóminas quedan inmutables para TODOS los roles y se
  // publican en la carpeta de cada empleado.
  const confirmarMes = async () => {
    const ok = await confirm({
      title: `Confirmar las nóminas de ${mesLabelNominas}`,
      description:
        "Quedarán bloqueadas: nadie podrá editar sus importes, ni borrarlas, ni subir nuevas de este mes. " +
        "Además cada empleado verá su nómina en su portal. ¿Continuar?",
      confirmLabel: "Confirmar nóminas",
    });
    if (!ok) return;
    setConfirmandoMes(true);
    const res = await confirmarMesNominas(periodo);
    setConfirmandoMes(false);
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
  };

  const reabrirMes = async () => {
    const ok = await confirm({
      title: `Reabrir las nóminas de ${mesLabelNominas}`,
      description:
        "Volverán a ser editables y DEJARÁN de verse en el portal del empleado hasta que se confirmen otra vez. ¿Continuar?",
      confirmLabel: "Reabrir",
    });
    if (!ok) return;
    setConfirmandoMes(true);
    const res = await reabrirMesNominas(periodo);
    setConfirmandoMes(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo reabrir el mes.");
      return;
    }
    await refrescarEstadoMes();
    toast.success(`Nóminas de ${mesLabelNominas} reabiertas para corregir.`);
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
        // que corregir la nómina (o propina, horas extras…) cambiaba el desglose
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
    { campo: "puesto", label: "Puesto" },
    { campo: "area", label: "Área" },
    { campo: "nominaBruta", label: "Nómina bruta" },
    { campo: "ssEmpleado", label: "− SS trabajador" },
    { campo: "irpf", label: "− IRPF" },
    { campo: "nomina", label: "Nómina neta" },
    { campo: "horasReales", label: "H.R" },
    { campo: "horasTrabajadas", label: "H.T" },
    { campo: "propina", label: "Complemento" },
    { campo: "ajuste", label: "Ajuste" },
    { campo: "horasExtras", label: "H.Extras" },
    { campo: "bonus", label: "Bonus" },
    { campo: "ssEmpresa", label: "SS Empresa" },
    { campo: "ssTotal", label: "Total SS" },
    { campo: "nominaDoc", label: "Nómina (documento)" },
    { campo: "total", label: "Total" },
    { campo: "pagado", label: "Pagado" },
    { campo: "confirmacion", label: "Confirmación" },
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

  const columnDefs: Record<string, { th: ReactNode; td: (p: PagoEmpleado) => ReactNode }> = {
    puesto: {
      th: th("puesto", "Puesto", "lista", "left", opcionesPuesto, "min-w-[150px]"),
      td: (p) => (
        <TableCell key="puesto" className="whitespace-nowrap">
          {p.puesto ? (
            <span className="text-sm">{p.puesto}</span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>
      ),
    },
    area: {
      th: th("area", "Área", "lista", "left", Object.values(AREA_LABEL), "min-w-[130px]"),
      td: (p) => {
        const pal = ZONE_COLORS[p.area];
        return (
          <TableCell key="area">
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
              style={{ backgroundColor: pal.bg, borderColor: pal.border, color: pal.label }}
            >
              {AREA_LABEL[p.area]}
            </span>
          </TableCell>
        );
      },
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
    horasReales: {
      th: th("horasReales", "H.R", "numero"),
      td: (p) => <TableCell key="horasReales" className="text-right tabular-nums">{p.horasReales}h</TableCell>,
    },
    horasTrabajadas: {
      th: th("horasTrabajadas", "H.T", "numero"),
      td: (p) => <TableCell key="horasTrabajadas" className="text-right tabular-nums">{p.horasTrabajadas}h</TableCell>,
    },
    propina: {
      th: th("propina", "Complemento", "numero"),
      td: (p) => <TableCell key="propina" className="text-right tabular-nums whitespace-nowrap">{fmt(p.propina)}</TableCell>,
    },
    ajuste: {
      th: th("ajuste", "Ajuste", "numero"),
      td: (p) => (
        <TableCell
          key="ajuste"
          className={`text-right tabular-nums whitespace-nowrap ${p.ajuste < 0 ? "text-destructive" : p.ajuste > 0 ? "text-emerald-600" : ""}`}
        >
          {p.ajuste === 0 ? "—" : `${p.ajuste > 0 ? "+" : "−"}${fmt(Math.abs(p.ajuste))}`}
        </TableCell>
      ),
    },
    horasExtras: {
      th: th("horasExtras", "H.Extras", "numero"),
      td: (p) => <TableCell key="horasExtras" className="text-right tabular-nums whitespace-nowrap">{p.horasExtras > 0 ? fmt(p.horasExtras) : "—"}</TableCell>,
    },
    bonus: {
      th: th("bonus", "Bonus", "numero"),
      td: (p) => <TableCell key="bonus" className="text-right tabular-nums whitespace-nowrap">{p.bonus > 0 ? fmt(p.bonus) : "—"}</TableCell>,
    },
    ssEmpleado: {
      th: th("ssEmpleado", "− SS trabajador", "numero"),
      td: (p) => (
        <TableCell key="ssEmpleado" className="text-right tabular-nums whitespace-nowrap text-destructive">
          {p.ssEmpleado > 0 ? `−${fmt(p.ssEmpleado)}` : fmtDato(p.ssEmpleado, nominaProcesada(p))}
          {circuloN(p, "ssEmpleado")}
        </TableCell>
      ),
    },
    ssEmpresa: {
      th: th("ssEmpresa", "SS Empresa", "numero"),
      td: (p) => (
        <TableCell key="ssEmpresa" className="text-right tabular-nums whitespace-nowrap">
          {fmtDato(p.ssEmpresa, nominaProcesada(p))}{circuloN(p, "ssEmpresa")}
        </TableCell>
      ),
    },
    ssTotal: {
      th: th("ssTotal", "Total SS", "numero"),
      td: (p) => (
        <TableCell key="ssTotal" className="text-right tabular-nums font-medium whitespace-nowrap">
          {fmtDato(costeSSTotal(p), nominaProcesada(p))}{circuloN(p, "ssTotal")}
        </TableCell>
      ),
    },
    irpf: {
      th: th("irpf", "− IRPF", "numero"),
      td: (p) => (
        <TableCell key="irpf" className="text-right tabular-nums whitespace-nowrap text-destructive">
          {p.irpf > 0 ? `−${fmt(p.irpf)}` : fmtDato(p.irpf, nominaProcesada(p))}
          {circuloN(p, "irpf")}
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
    total: {
      th: th("total", "Total", "numero", "right", undefined, "font-bold"),
      td: (p) => <TableCell key="total" className="text-right font-bold tabular-nums whitespace-nowrap">{fmt(p.total)}</TableCell>,
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
                className="h-7 gap-1 border-primary text-primary hover:bg-primary/5 disabled:opacity-40"
                onClick={() => void togglePagar(p)}
                disabled={bloqueado}
                title={bloqueado ? "El empleado debe aprobar (LIQUIDAR) antes de pagar" : "Marcar como pagado"}
              >
                <Banknote className="h-3.5 w-3.5" />Pagar
              </Button>
            )}
          </TableCell>
        );
      },
    },
    confirmacion: {
      th: <TableColumnHeader key="confirmacion" label="Aprobación" className="w-[110px]" align="center" />,
      td: (p) => (
        <TableCell key="confirmacion" className="text-center">
          {p.confirmacionAceptadaAt ? (
            <span className="inline-flex items-center gap-1 text-emerald-600" title="Aprobada por el empleado (LIQUIDAR)">
              <CheckCircle2 className="h-4 w-4" /><span className="text-xs font-medium">Liquidada</span>
            </span>
          ) : p.confirmacionEnviadaAt ? (
            <Badge variant="secondary" className="gap-1 border-amber-300 bg-amber-50 text-[10px] text-amber-700"><Clock className="h-3 w-3" />Enviada</Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
      ),
    },
  };

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
    horasReales: <TableCell key="t-hr" className="text-right tabular-nums">{pagosFiltrados.reduce((s, p) => s + p.horasReales, 0)}h</TableCell>,
    horasTrabajadas: <TableCell key="t-ht" className="text-right tabular-nums">{pagosFiltrados.reduce((s, p) => s + p.horasTrabajadas, 0)}h</TableCell>,
    propina: <TableCell key="t-propina" className="text-right tabular-nums">{fmt(resumen.totalPropinas)}</TableCell>,
    ajuste: (
      <TableCell key="t-ajuste" className={`text-right tabular-nums ${resumen.totalAjustes < 0 ? "text-destructive" : resumen.totalAjustes > 0 ? "text-emerald-600" : ""}`}>
        {resumen.totalAjustes === 0 ? "—" : `${resumen.totalAjustes > 0 ? "+" : "−"}${fmt(Math.abs(resumen.totalAjustes))}`}
      </TableCell>
    ),
    horasExtras: <TableCell key="t-extras" className="text-right tabular-nums">{fmt(resumen.totalExtras)}</TableCell>,
    bonus: <TableCell key="t-bonus" className="text-right tabular-nums">{fmt(resumen.totalBonus)}</TableCell>,
    ssEmpleado: <TableCell key="t-ssemp" className="text-right tabular-nums whitespace-nowrap text-destructive">{hayNominaProcesada && resumen.totalSsEmpleado > 0 ? `−${fmt(resumen.totalSsEmpleado)}` : fmtDato(resumen.totalSsEmpleado, hayNominaProcesada)}</TableCell>,
    ssEmpresa: <TableCell key="t-ssempresa" className="text-right tabular-nums whitespace-nowrap">{fmtDato(resumen.totalSsEmpresa, hayNominaProcesada)}</TableCell>,
    ssTotal: <TableCell key="t-sstotal" className="text-right tabular-nums font-medium whitespace-nowrap">{fmtDato(resumen.totalSs, hayNominaProcesada)}</TableCell>,
    irpf: <TableCell key="t-irpf" className="text-right tabular-nums whitespace-nowrap text-destructive">{hayNominaProcesada && totalIrpf > 0 ? `−${fmt(totalIrpf)}` : fmtDato(totalIrpf, hayNominaProcesada)}</TableCell>,
    total: <TableCell key="t-total" className="text-right tabular-nums font-bold">{fmt(resumen.totalFinal)}</TableCell>,
    pagado: <TableCell key="t-pagado" className="text-center"><Badge variant={pagosFiltrados.every((p) => p.pagado) ? "default" : "secondary"} className="text-[10px]">{pagosFiltrados.filter((p) => p.pagado).length}/{pagosFiltrados.length}</Badge></TableCell>,
    confirmacion: <TableCell key="t-conf" className="text-center"><Badge variant="secondary" className="text-[10px]">{pagosFiltrados.filter((p) => p.confirmacionEnviadaAt).length}/{pagosFiltrados.length}</Badge></TableCell>,
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
        <Button
          variant="outline"
          className="ml-auto gap-2"
          onClick={() => setShowDocsMes(true)}
          disabled={subiendoNominas || estadoMes.confirmado || esVistaAgregada}
          title={
            estadoMes.confirmado
              ? "Las nóminas de este mes ya están confirmadas: para subir otras hay que reabrir el mes"
              : "Sube las nóminas del mes y el TC1; la IA los lee y vuelca los datos"
          }
        >
          <Upload className="h-4 w-4" />
          {subiendoNominas
            ? `Leyendo nóminas… ${progresoNominas.hechas}/${progresoNominas.total}`
            : "Subir documentos del mes"}
        </Button>
        {estadoMes.puedeGestionar && (
          <Button
            variant={estadoMes.confirmado ? "outline" : "default"}
            className="gap-2"
            onClick={() => (estadoMes.confirmado ? reabrirMes() : confirmarMes())}
            disabled={confirmandoMes || esVistaAgregada}
            title={
              estadoMes.confirmado
                ? "Las nóminas están confirmadas y publicadas al empleado. Reabrir permite corregirlas."
                : "Cierra las nóminas del mes: quedan inmutables y se publican en la carpeta de cada empleado"
            }
          >
            {estadoMes.confirmado ? <Unlock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            {estadoMes.confirmado ? "Reabrir nóminas" : "Confirmar nóminas"}
          </Button>
        )}
        <Button
          className="gap-2"
          onClick={() =>
            enviarConfirmaciones(
              pagos.filter((p) => !p.confirmacionEnviadaAt).map((p) => p.empleadoId),
              "liquidaciones",
            )
          }
          disabled={enviando || esVistaAgregada || pagos.every((p) => !!p.confirmacionEnviadaAt)}
        >
          <Send className="h-4 w-4" />
          Enviar liquidaciones
        </Button>
      </div>

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
          </>
        }
      />

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
            <Table>
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
                    className="min-w-[180px]"
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
                    const palette = ZONE_COLORS[p.area];
                    return (
                      <TableRow
                        key={p.id}
                        className={p.pagado ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}
                        style={{
                          backgroundColor: p.pagado ? undefined : palette.bg,
                          boxShadow: `inset 4px 0 0 0 ${palette.border}`,
                        }}
                      >
                        <TableCell className="font-medium" style={{ color: palette.label }}>
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
                            <span>{p.empleadoNombre}</span>
                          </div>
                          {p.dniNie ? (
                            <div className="text-[11px] font-normal tabular-nums text-muted-foreground">{p.dniNie}</div>
                          ) : !p.empleadoId.startsWith("ext-") ? (
                            <div className="text-[11px] font-normal text-amber-600">Falta DNI</div>
                          ) : null}
                          {(() => {
                            const h = horasMesMap?.get(p.empleadoId);
                            if (!h) return null;
                            // Balance: verde si ha hecho horas de más, rojo si menos, gris si cuadra.
                            const balCls =
                              h.balance > 0.01 ? "text-emerald-600" : h.balance < -0.01 ? "text-destructive" : "text-muted-foreground";
                            return (
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-normal">
                                <span className="text-muted-foreground" title="Horas previstas según su horario">
                                  Previstas {fmtHoras(h.teoricas)}
                                </span>
                                <span className="text-muted-foreground" title="Horas fichadas normales">
                                  · Fichadas {fmtHoras(h.normales)}
                                </span>
                                {h.extras > 0.01 && (
                                  <span className="text-amber-600" title="Horas extras fichadas">
                                    · Extras {fmtHoras(h.extras)}
                                  </span>
                                )}
                                <span className={`font-semibold ${balCls}`} title="Balance: fichadas − previstas + extras">
                                  · {h.balance >= 0 ? "+" : ""}{fmtHoras(h.balance)}
                                </span>
                              </div>
                            );
                          })()}
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
            <DialogTitle>Documentos de {mesLabelNominas}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* 1) Las nóminas */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Nóminas del mes</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Un PDF con todas (una por página) o varios archivos. Se leen y se asignan a
                    cada trabajador.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={subiendoNominas}
                  onClick={() => nominasInputRef.current?.click()}
                >
                  {subiendoNominas ? <Clock className="h-4 w-4 animate-pulse" /> : <Upload className="h-4 w-4" />}
                  {subiendoNominas
                    ? `${progresoNominas.hechas}/${progresoNominas.total}`
                    : "Adjuntar"}
                </Button>
              </div>
              {estadoMes.tc1 == null && incidenciasNominas > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  {incidenciasNominas} nómina{incidenciasNominas === 1 ? "" : "s"} con incidencia por revisar.
                </p>
              )}
            </div>

            {/* 2) El TC1: documento de EMPRESA, no de un empleado */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">TC1 · Recibo de cotizaciones</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {estadoMes.tc1
                      ? "Ya adjuntado. Debe cuadrar con la suma de las nóminas."
                      : "Documento de la empresa con las bases y cuotas del mes."}
                  </p>
                  {estadoMes.tc1 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <button
                        type="button"
                        onClick={abrirTc1}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        Ver documento
                      </button>
                      {estadoMes.tc1.importe != null && (
                        <span className="tabular-nums text-muted-foreground">
                          {estadoMes.tc1.importe.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                      )}
                      {estadoMes.tc1.trabajadores != null && (
                        <span className="text-muted-foreground">{estadoMes.tc1.trabajadores} trabajadores</span>
                      )}
                    </div>
                  )}
                </div>
                {estadoMes.tc1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={quitarTc1}
                  >
                    <X className="h-4 w-4" />
                    Quitar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    disabled={subiendoTc1}
                    onClick={() => tc1InputRef.current?.click()}
                  >
                    {subiendoTc1 ? <Clock className="h-4 w-4 animate-pulse" /> : <Upload className="h-4 w-4" />}
                    {subiendoTc1 ? "Subiendo…" : "Adjuntar"}
                  </Button>
                )}
              </div>
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
    { key: "propina", label: "Complemento" },
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
            <Input type="number" value={form[c.key] as number} onChange={(e) => setForm((prev) => ({ ...prev, [c.key]: Number(e.target.value) }))} />
          </div>
        ))}
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
