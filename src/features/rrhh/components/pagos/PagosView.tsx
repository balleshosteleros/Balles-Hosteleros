"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { getResumenPagos, costeSSTotal, type PagoEmpleado, type PagoArea } from "@/features/rrhh/data/pagos";
import { normalizarDniNie } from "@/features/rrhh/lib/documentacion-validacion";
import {
  listEmpleadosParaPagos,
  loadPagos,
  savePago,
  enviarConfirmacionesPago,
  reabrirConfirmacionPago,
  puedeReabrirPagos,
  marcarPagado,
  type PagoGuardado,
} from "@/features/rrhh/actions/pagos-actions";
import {
  procesarNominasLeidas,
  getNominaArchivoUrl,
} from "@/features/rrhh/actions/nominas-archivo-actions";
import type { NominaLeida } from "@/features/rrhh/services/nominas/procesar-nominas";
import {
  getNotifLiquidacionesConfig,
  type NotifLiquidacionesConfig,
} from "@/features/notificaciones/actions/notif-config-actions";
import { NotifLiquidacionesConfigPanel } from "@/features/notificaciones/components/NotifLiquidacionesConfigPanel";
import { NominasGestoriaConfigPanel } from "@/features/rrhh/components/pagos/NominasGestoriaConfigPanel";
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
import { Edit2, Banknote, Settings, Send, Lock, Unlock, CheckCircle2, Clock, Upload, FileText } from "lucide-react";
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
import { IOActions } from "@/shared/io";
import { pagosIO } from "@/features/rrhh/io/pagos.io";
import {
  CalendarRangeToggle,
  CalendarRangeNav,
} from "@/shared/components/calendar/CalendarRangeToggle";
import { useCalendarRange, type CalendarRangeMode } from "@/shared/components/calendar/calendar-range";

// Los pagos se registran por mes (igual que la hoja de nóminas), así que el
// módulo trabaja en modo MENSUAL: cada periodo = un mes 'YYYY-MM'.
const MODES_PAGOS: CalendarRangeMode[] = ["MENSUAL"];

function rangoKey(rango: { start: Date; end: Date }): string {
  return `${rango.start.toISOString().slice(0, 10)}_${rango.end.toISOString().slice(0, 10)}`;
}

// periodo 'YYYY-MM' en hora local (evita el salto de mes por UTC).
function periodoDeRango(rango: { start: Date }): string {
  const y = rango.start.getFullYear();
  const m = String(rango.start.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function fromGuardado(
  empleadoId: string,
  empleadoNombre: string,
  area: PagoArea,
  g: PagoGuardado,
  dniNie: string | null = null,
): PagoEmpleado {
  return {
    id: `${empleadoId}-pago`,
    empleadoId,
    empleadoNombre,
    dniNie,
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
    confirmacionEnviadaAt: p.confirmacionEnviadaAt,
    confirmacionAceptadaAt: p.confirmacionAceptadaAt,
  };
}

function nuevoPagoVacio(
  empleadoId: string,
  empleadoNombre: string,
  area: PagoArea,
  dniNie: string | null = null,
): PagoEmpleado {
  return {
    id: `${empleadoId}-pago`,
    empleadoId,
    empleadoNombre,
    dniNie,
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
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [filtroArea, setFiltroArea] = useState<"todos" | PagoArea>("todos");
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
  const pagos = pagosPorRango[claveRango] ?? [];

  const cargarEmpleados = useCallback(async () => {
    setLoading(true);
    const [resEmp, resPagos] = await Promise.all([
      listEmpleadosParaPagos(),
      loadPagos(periodo),
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
    const filasEmpleados = resEmp.data.map((e) => {
      const g = guardadosPorEmp.get(e.empleadoId);
      guardadosPorEmp.delete(e.empleadoId);
      const dni = e.dniNie ?? null;
      return g
        ? fromGuardado(e.empleadoId, e.empleadoNombre, e.area, g, dni)
        : nuevoPagoVacio(e.empleadoId, e.empleadoNombre, e.area, dni);
    });

    // Pagos guardados de gente que ya no está activa (histórico): se muestran igual.
    const filasExtra = [...guardadosPorEmp.values(), ...guardadosSinEmp].map((g) =>
      fromGuardado(g.empleadoId ?? `ext-${g.empleadoNombre}`, g.empleadoNombre, "operativa", g),
    );

    setPagosPorRango((prev) => ({ ...prev, [claveRango]: [...filasEmpleados, ...filasExtra] }));
  }, [claveRango, periodo]);

  useEffect(() => {
    if (pagosPorRango[claveRango]) return;
    cargarEmpleados();
  }, [claveRango, pagosPorRango, cargarEmpleados]);

  // Re-cargar al cambiar empresa (limpia cache)
  useEffect(() => {
    setPagosPorRango({});
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
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const pagosFiltrados = useMemo(() => {
    let resultado = pagos.filter((p) => {
      if (filtroArea !== "todos" && p.area !== filtroArea) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!p.empleadoNombre.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    resultado = aplicarFiltrosToolbar(resultado, filtros, acceso);
    resultado = aplicarOrdenToolbar(resultado, orden, acceso);
    return resultado;
  }, [pagos, busqueda, filtros, orden, filtroArea]);

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

    const proc = await procesarNominasLeidas(todas, periodo);
    setSubiendoNominas(false);
    if (!proc.ok || !proc.resultado) {
      toast.error(proc.error ?? "No se pudieron guardar las nóminas.");
      return;
    }
    const r = proc.resultado;

    // Recargar caché para que se vean las nóminas nuevas al navegar por meses.
    setPagosPorRango({});

    const partes = [`${r.guardadas} nómina${r.guardadas === 1 ? "" : "s"} guardada${r.guardadas === 1 ? "" : "s"}`];
    if (r.yaExistian > 0) partes.push(`${r.yaExistian} ya subida${r.yaExistian === 1 ? "" : "s"}`);
    if (r.sinEmpleado.length > 0) partes.push(`${r.sinEmpleado.length} sin empleado`);
    if (fallos > 0) partes.push(`${fallos} archivo${fallos === 1 ? "" : "s"} con error`);

    const nombreMes = (p: string) => {
      const [y, m] = p.split("-");
      const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
      return `${MESES[Number(m) - 1] ?? ""} ${y}`.trim();
    };
    const lineas: string[] = [];
    if (r.meses.length > 0) lineas.push(`Guardadas en: ${r.meses.map(nombreMes).join(", ")}.`);
    if (r.duplicadas.length > 0) lineas.push(`Ya tenían nómina (no se regrabó): ${r.duplicadas.slice(0, 6).join(", ")}${r.duplicadas.length > 6 ? "…" : ""}.`);
    if (r.sinEmpleado.length > 0) lineas.push(`Sin empleado: ${r.sinEmpleado.slice(0, 6).join(", ")}${r.sinEmpleado.length > 6 ? "…" : ""}. Revisa su DNI en la ficha.`);
    const descripcion = lineas.length > 0 ? lineas.join(" ") : undefined;

    if (r.guardadas > 0 || r.yaExistian > 0) toast.success(partes.join(" · "), { description: descripcion });
    else toast.error(partes.join(" · ") || "No se emparejó ninguna nómina.", { description: descripcion });
  };

  // Abre la nómina original de un empleado en una pestaña nueva (URL firmada).
  const verNomina = async (p: PagoEmpleado) => {
    // Abrir la pestaña YA, dentro del gesto de clic (si se abre tras el await, el
    // navegador la bloquea como popup). SIN noopener: si no, window.open("") no
    // devuelve referencia y no se le puede asignar la URL luego.
    const win = window.open("about:blank", "_blank");
    const res = await getNominaArchivoUrl(periodo, p.empleadoId);
    if (!res.ok) {
      win?.close();
      toast.error(res.error ?? "No se pudo abrir la nómina.");
      return;
    }
    if (win && !win.closed) win.location.href = res.url;
    else window.open(res.url, "_blank"); // fallback si el navegador cerró la pestaña
  };

  const guardarEdicion = (datos: Partial<PagoEmpleado>) => {
    if (!editando) return;
    let actualizado: PagoEmpleado | undefined;
    setPagos((prev) =>
      prev.map((p) => {
        if (p.id !== editando.id) return p;
        const updated = { ...p, ...datos };
        // El ajuste (con signo) mueve el total de ese empleado por su diferencia;
        // el resto de columnas son el desglose y no recalculan el total importado.
        const deltaAjuste = updated.ajuste - p.ajuste;
        updated.total = Math.round((p.total + deltaAjuste) * 100) / 100;
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
  // Se muestra junto a los importes de sumatorio para indicar que están sumados.
  const circuloN = (p: PagoEmpleado): ReactNode =>
    p.numNominas > 1 ? (
      <span
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary align-middle"
        title={`Suma de ${p.numNominas} nóminas`}
      >
        {p.numNominas}
      </span>
    ) : null;

  const columnasDef: ToolbarColumna[] = [
    { campo: "nomina", label: "Nómina" },
    { campo: "horasReales", label: "H.R" },
    { campo: "horasTrabajadas", label: "H.T" },
    { campo: "propina", label: "Propina" },
    { campo: "ajuste", label: "Ajuste" },
    { campo: "horasExtras", label: "H.Extras" },
    { campo: "bonus", label: "Bonus" },
    { campo: "ssEmpleado", label: "SS Empleado" },
    { campo: "ssEmpresa", label: "SS Empresa" },
    { campo: "ssTotal", label: "Total SS" },
    { campo: "irpf", label: "IRPF" },
    { campo: "total", label: "Total" },
    { campo: "nominaArchivo", label: "Nómina (doc)" },
    { campo: "pagado", label: "Pagado" },
    { campo: "confirmacion", label: "Confirmación" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (p: PagoEmpleado) => ReactNode }> = {
    nomina: {
      th: <TableHead key="nomina" className="text-right whitespace-nowrap">Nómina</TableHead>,
      td: (p) => <TableCell key="nomina" className="text-right tabular-nums whitespace-nowrap">{fmt(p.nomina)}{circuloN(p)}</TableCell>,
    },
    horasReales: {
      th: <TableHead key="horasReales" className="text-right">H.R</TableHead>,
      td: (p) => <TableCell key="horasReales" className="text-right tabular-nums">{p.horasReales}h</TableCell>,
    },
    horasTrabajadas: {
      th: <TableHead key="horasTrabajadas" className="text-right">H.T</TableHead>,
      td: (p) => <TableCell key="horasTrabajadas" className="text-right tabular-nums">{p.horasTrabajadas}h</TableCell>,
    },
    propina: {
      th: <TableHead key="propina" className="text-right whitespace-nowrap">Propina</TableHead>,
      td: (p) => <TableCell key="propina" className="text-right tabular-nums whitespace-nowrap">{fmt(p.propina)}</TableCell>,
    },
    ajuste: {
      th: <TableHead key="ajuste" className="text-right whitespace-nowrap">Ajuste</TableHead>,
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
      th: <TableHead key="horasExtras" className="text-right whitespace-nowrap">H.Extras</TableHead>,
      td: (p) => <TableCell key="horasExtras" className="text-right tabular-nums whitespace-nowrap">{p.horasExtras > 0 ? fmt(p.horasExtras) : "—"}</TableCell>,
    },
    bonus: {
      th: <TableHead key="bonus" className="text-right whitespace-nowrap">Bonus</TableHead>,
      td: (p) => <TableCell key="bonus" className="text-right tabular-nums whitespace-nowrap">{p.bonus > 0 ? fmt(p.bonus) : "—"}</TableCell>,
    },
    ssEmpleado: {
      th: <TableHead key="ssEmpleado" className="text-right whitespace-nowrap">SS Empleado</TableHead>,
      td: (p) => <TableCell key="ssEmpleado" className="text-right tabular-nums whitespace-nowrap">{fmtDato(p.ssEmpleado, nominaProcesada(p))}</TableCell>,
    },
    ssEmpresa: {
      th: <TableHead key="ssEmpresa" className="text-right whitespace-nowrap">SS Empresa</TableHead>,
      td: (p) => <TableCell key="ssEmpresa" className="text-right tabular-nums whitespace-nowrap">{fmtDato(p.ssEmpresa, nominaProcesada(p))}</TableCell>,
    },
    ssTotal: {
      th: <TableHead key="ssTotal" className="text-right whitespace-nowrap">Total SS</TableHead>,
      td: (p) => (
        <TableCell key="ssTotal" className="text-right tabular-nums font-medium whitespace-nowrap">
          {fmtDato(costeSSTotal(p), nominaProcesada(p))}
        </TableCell>
      ),
    },
    irpf: {
      th: <TableHead key="irpf" className="text-right whitespace-nowrap">IRPF</TableHead>,
      td: (p) => <TableCell key="irpf" className="text-right tabular-nums whitespace-nowrap">{fmtDato(p.irpf, nominaProcesada(p))}</TableCell>,
    },
    total: {
      th: <TableHead key="total" className="text-right font-bold whitespace-nowrap">Total</TableHead>,
      td: (p) => <TableCell key="total" className="text-right font-bold tabular-nums whitespace-nowrap">{fmt(p.total)}</TableCell>,
    },
    nominaArchivo: {
      th: <TableHead key="nominaArchivo" className="text-center w-[90px]">Nómina</TableHead>,
      td: (p) => (
        <TableCell key="nominaArchivo" className="text-center">
          {p.nominaPath ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-primary hover:bg-primary/5"
              onClick={() => void verNomina(p)}
              title="Ver la nómina original"
            >
              <FileText className="h-3.5 w-3.5" />
              Ver
            </Button>
          ) : (
            <span className="text-muted-foreground text-xs" title="Sin nómina adjunta">—</span>
          )}
        </TableCell>
      ),
    },
    pagado: {
      th: <TableHead key="pagado" className="text-center w-[120px]">Pagar</TableHead>,
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
      th: <TableHead key="confirmacion" className="text-center w-[110px]">Aprobación</TableHead>,
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
  const totalDefs: Record<string, ReactNode> = {
    nomina: <TableCell key="t-nomina" className="text-right tabular-nums">{fmt(resumen.totalNomina)}</TableCell>,
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
    ssEmpleado: <TableCell key="t-ssemp" className="text-right tabular-nums whitespace-nowrap">{fmtDato(resumen.totalSsEmpleado, hayNominaProcesada)}</TableCell>,
    ssEmpresa: <TableCell key="t-ssempresa" className="text-right tabular-nums whitespace-nowrap">{fmtDato(resumen.totalSsEmpresa, hayNominaProcesada)}</TableCell>,
    ssTotal: <TableCell key="t-sstotal" className="text-right tabular-nums font-medium whitespace-nowrap">{fmtDato(resumen.totalSs, hayNominaProcesada)}</TableCell>,
    irpf: <TableCell key="t-irpf" className="text-right tabular-nums whitespace-nowrap">{fmtDato(pagosFiltrados.reduce((s, p) => s + p.irpf, 0), hayNominaProcesada)}</TableCell>,
    total: <TableCell key="t-total" className="text-right tabular-nums font-bold">{fmt(resumen.totalFinal)}</TableCell>,
    nominaArchivo: <TableCell key="t-nomdoc" className="text-center"><Badge variant="secondary" className="text-[10px]">{pagosFiltrados.filter((p) => p.nominaPath).length}/{pagosFiltrados.length}</Badge></TableCell>,
    pagado: <TableCell key="t-pagado" className="text-center"><Badge variant={pagosFiltrados.every((p) => p.pagado) ? "default" : "secondary"} className="text-[10px]">{pagosFiltrados.filter((p) => p.pagado).length}/{pagosFiltrados.length}</Badge></TableCell>,
    confirmacion: <TableCell key="t-conf" className="text-center"><Badge variant="secondary" className="text-[10px]">{pagosFiltrados.filter((p) => p.confirmacionEnviadaAt).length}/{pagosFiltrados.length}</Badge></TableCell>,
  };

  const areaOpciones: { value: "todos" | PagoArea; label: string; palette?: { bg: string; border: string; label: string } }[] = [
    { value: "todos", label: "Todos" },
    { value: "administrativa", label: "Administrativa", palette: ZONE_COLORS.administrativa },
    { value: "operativa", label: "Operativa", palette: ZONE_COLORS.operativa },
  ];

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
          onClick={() => nominasInputRef.current?.click()}
          disabled={subiendoNominas}
          title="Sube las nóminas del mes; la IA lee el coste de Seguridad Social de cada una"
        >
          <Upload className="h-4 w-4" />
          {subiendoNominas
            ? `Leyendo nóminas… ${progresoNominas.hechas}/${progresoNominas.total}`
            : "Subir nóminas (SS)"}
        </Button>
        <Button
          className="gap-2"
          onClick={() =>
            enviarConfirmaciones(
              pagos.filter((p) => !p.confirmacionEnviadaAt).map((p) => p.empleadoId),
              "liquidaciones",
            )
          }
          disabled={enviando || pagos.every((p) => !!p.confirmacionEnviadaAt)}
        >
          <Send className="h-4 w-4" />
          Enviar liquidaciones
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {areaOpciones.map((op) => {
          const activo = filtroArea === op.value;
          const style = activo && op.palette
            ? { backgroundColor: op.palette.bg, borderColor: op.palette.border, color: op.palette.label }
            : undefined;
          return (
            <Button
              key={op.value}
              type="button"
              variant={activo ? "default" : "outline"}
              size="sm"
              className="h-8"
              style={style}
              onClick={() => setFiltroArea(op.value)}
            >
              {op.palette && (
                <span
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-full border"
                  style={{ backgroundColor: op.palette.bg, borderColor: op.palette.border }}
                />
              )}
              {op.label}
            </Button>
          );
        })}
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

      {showConfig && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <NotifLiquidacionesConfigPanel />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <NominasGestoriaConfigPanel />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="min-w-[180px]">Empleado</TableHead>
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
                          <div>{p.empleadoNombre}</div>
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
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditando(p)} title="Editar"><Edit2 className="h-3.5 w-3.5" /></Button>
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
  const campos: { key: keyof PagoEmpleado; label: string }[] = [
    { key: "nomina", label: "Nómina" }, { key: "propina", label: "Propina" },
    { key: "ajuste", label: "Ajuste (+/−)" }, { key: "horasExtras", label: "H. Extras" },
    { key: "bonus", label: "Bonus" },
    { key: "ssEmpleado", label: "SS Empleado" }, { key: "ssEmpresa", label: "SS Empresa" },
    { key: "irpf", label: "IRPF" },
  ];
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
