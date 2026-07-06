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
  guardarNominaArchivo,
  getNominaArchivoUrl,
} from "@/features/rrhh/actions/nominas-archivo-actions";
import {
  getNotifLiquidacionesConfig,
  type NotifLiquidacionesConfig,
} from "@/features/notificaciones/actions/notif-config-actions";
import { NotifLiquidacionesConfigPanel } from "@/features/notificaciones/components/NotifLiquidacionesConfigPanel";
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
import { Edit2, Banknote, TrendingUp, TrendingDown, PiggyBank, HandCoins, Wallet, Settings, Send, Lock, Unlock, CheckCircle2, Clock, Upload, FileText } from "lucide-react";
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
): PagoEmpleado {
  return {
    id: `${empleadoId}-pago`,
    empleadoId,
    empleadoNombre,
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
    total: g.total,
    pagado: g.pagado,
    nominaPath: g.nominaPath,
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
    total: p.total,
    pagado: p.pagado,
    nominaPath: p.nominaPath,
    confirmacionEnviadaAt: p.confirmacionEnviadaAt,
    confirmacionAceptadaAt: p.confirmacionAceptadaAt,
  };
}

function nuevoPagoVacio(empleadoId: string, empleadoNombre: string, area: PagoArea): PagoEmpleado {
  return {
    id: `${empleadoId}-pago`,
    empleadoId,
    empleadoNombre,
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
    total: 0,
    pagado: false,
    nominaPath: null,
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

    // Empleados activos: fila guardada si existe, si no fila vacía.
    const filasEmpleados = resEmp.data.map((e) => {
      const g = guardadosPorEmp.get(e.empleadoId);
      guardadosPorEmp.delete(e.empleadoId);
      return g
        ? fromGuardado(e.empleadoId, e.empleadoNombre, e.area, g)
        : nuevoPagoVacio(e.empleadoId, e.empleadoNombre, e.area);
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

    const norm = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const filasActuales = pagosPorRango[claveRango] ?? [];

    // Índice principal por DNI/NIE (empleadoId -> dni normalizado guardado en el ref).
    const porDni = new Map<string, PagoEmpleado>();
    // Índice de respaldo por nombre normalizado.
    const porNombre = new Map<string, PagoEmpleado>();
    for (const p of filasActuales) {
      const dni = dniPorEmpleado.current.get(p.empleadoId);
      if (dni) porDni.set(dni, p);
      porNombre.set(norm(p.empleadoNombre), p);
    }

    // Empareja una nómina leída con la fila de su empleado (DNI primero, nombre
    // como respaldo). Devuelve undefined si no encuentra a nadie.
    const emparejar = (n: { dniNie?: string; nombre?: string }): PagoEmpleado | undefined => {
      const dniIa = n.dniNie ? normalizarDniNie(String(n.dniNie)) : "";
      let fila = dniIa ? porDni.get(dniIa) : undefined;
      if (fila) return fila;
      const nombreIa = norm(String(n.nombre ?? ""));
      fila = porNombre.get(nombreIa);
      if (!fila && nombreIa) {
        for (const [k, v] of porNombre) {
          if (k.includes(nombreIa) || nombreIa.includes(k)) { fila = v; break; }
        }
      }
      return fila;
    };

    let emparejadas = 0;
    let sinEmparejar = 0;
    let fallos = 0;

    for (const file of lista) {
      try {
        const fd = new FormData();
        fd.set("archivo", file);
        const res = await fetch("/api/nominas/extraer", { method: "POST", body: fd });
        const data = await res.json();
        if (!data.ok || !Array.isArray(data.nominas)) {
          fallos++;
          setProgresoNominas((prev) => ({ ...prev, hechas: prev.hechas + 1 }));
          continue;
        }

        for (const n of data.nominas) {
          const fila = emparejar(n);
          if (!fila) {
            sinEmparejar++;
            continue;
          }
          if (fila.confirmacionEnviadaAt) continue; // liquidación enviada = inmutable
          if (fila.empleadoId.startsWith("ext-")) continue; // ex-empleado sin ficha

          // 1) Guardar la nómina original en Storage (empareja archivo↔empleado).
          let nominaPath = fila.nominaPath;
          if (n.archivoBase64 && n.mimeType) {
            const gu = await guardarNominaArchivo(periodo, fila.empleadoId, n.archivoBase64, n.mimeType);
            if (gu.ok && gu.path) nominaPath = gu.path;
          }

          // 2) Actualizar SS (informativa) y el path de la nómina.
          const actualizado: PagoEmpleado = {
            ...fila,
            ssEmpleado: Number(n.ssEmpleado) || 0,
            ssEmpresa: Number(n.ssEmpresa) || 0,
            nominaPath,
          };
          setPagos((prev) => prev.map((x) => (x.id === actualizado.id ? actualizado : x)));
          await savePago(periodo, toGuardado(actualizado));
          // Mantener el índice al día por si la misma persona sale dos veces.
          porNombre.set(norm(actualizado.empleadoNombre), actualizado);
          const dni = dniPorEmpleado.current.get(actualizado.empleadoId);
          if (dni) porDni.set(dni, actualizado);
          emparejadas++;
        }
      } catch (e) {
        console.error("[pagos] subirNominas:", e);
        fallos++;
      }
      setProgresoNominas((prev) => ({ ...prev, hechas: prev.hechas + 1 }));
    }

    setSubiendoNominas(false);
    const partes = [`${emparejadas} nómina${emparejadas === 1 ? "" : "s"} leída${emparejadas === 1 ? "" : "s"}`];
    if (sinEmparejar > 0) partes.push(`${sinEmparejar} sin empleado`);
    if (fallos > 0) partes.push(`${fallos} con error`);
    if (emparejadas > 0) toast.success(partes.join(" · "));
    else toast.error(partes.join(" · ") || "No se pudo leer ninguna nómina.");
  };

  // Abre la nómina original de un empleado en una pestaña nueva (URL firmada).
  const verNomina = async (p: PagoEmpleado) => {
    const res = await getNominaArchivoUrl(periodo, p.empleadoId);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo abrir la nómina.");
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
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

  const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";

  const kpis = [
    { label: "Total pagos", value: fmt(resumen.totalFinal), icon: Banknote, color: "text-primary" },
    { label: "Positivo", value: fmt(resumen.positivo), icon: TrendingUp, color: "text-emerald-600" },
    { label: "Negativo", value: fmt(resumen.negativo), icon: TrendingDown, color: "text-destructive" },
    { label: "Efectivo ahorro", value: fmt(resumen.efectivoAhorro), icon: PiggyBank, color: "text-amber-600" },
    { label: "Préstamos", value: fmt(resumen.prestamos), icon: HandCoins, color: "text-orange-600" },
    { label: "Propinas acum.", value: fmt(resumen.propinasAcumuladas), icon: Wallet, color: "text-sky-600" },
  ];

  const columnasDef: ToolbarColumna[] = [
    { campo: "fijo", label: "Fijo" },
    { campo: "pago", label: "Pago" },
    { campo: "nomina", label: "Nómina" },
    { campo: "horasReales", label: "H.R" },
    { campo: "horasTrabajadas", label: "H.T" },
    { campo: "propina", label: "Propina" },
    { campo: "ajuste", label: "Ajuste" },
    { campo: "horasExtras", label: "H.Extras" },
    { campo: "bonus", label: "Bonus" },
    { campo: "propinaMantenimiento", label: "Prop. Mant." },
    { campo: "ssEmpleado", label: "SS Empleado" },
    { campo: "ssEmpresa", label: "SS Empresa" },
    { campo: "ssTotal", label: "Total SS" },
    { campo: "total", label: "Total" },
    { campo: "nominaArchivo", label: "Nómina (doc)" },
    { campo: "pagado", label: "Pagado" },
    { campo: "confirmacion", label: "Confirmación" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (p: PagoEmpleado) => ReactNode }> = {
    fijo: {
      th: <TableHead key="fijo" className="text-center w-[60px]">Fijo</TableHead>,
      td: (p) => (
        <TableCell key="fijo" className="text-center">{p.fijo ? <Badge variant="secondary" className="text-[10px]">FIJO</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
      ),
    },
    pago: {
      th: <TableHead key="pago" className="text-right">Pago</TableHead>,
      td: (p) => <TableCell key="pago" className="text-right tabular-nums">{fmt(p.pago)}</TableCell>,
    },
    nomina: {
      th: <TableHead key="nomina" className="text-right">Nómina</TableHead>,
      td: (p) => <TableCell key="nomina" className="text-right tabular-nums">{fmt(p.nomina)}</TableCell>,
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
      th: <TableHead key="propina" className="text-right">Propina</TableHead>,
      td: (p) => <TableCell key="propina" className="text-right tabular-nums">{fmt(p.propina)}</TableCell>,
    },
    ajuste: {
      th: <TableHead key="ajuste" className="text-right">Ajuste</TableHead>,
      td: (p) => (
        <TableCell
          key="ajuste"
          className={`text-right tabular-nums ${p.ajuste < 0 ? "text-destructive" : p.ajuste > 0 ? "text-emerald-600" : ""}`}
        >
          {p.ajuste === 0 ? "—" : `${p.ajuste > 0 ? "+" : "−"}${fmt(Math.abs(p.ajuste))}`}
        </TableCell>
      ),
    },
    horasExtras: {
      th: <TableHead key="horasExtras" className="text-right">H.Extras</TableHead>,
      td: (p) => <TableCell key="horasExtras" className="text-right tabular-nums">{p.horasExtras > 0 ? fmt(p.horasExtras) : "—"}</TableCell>,
    },
    bonus: {
      th: <TableHead key="bonus" className="text-right">Bonus</TableHead>,
      td: (p) => <TableCell key="bonus" className="text-right tabular-nums">{p.bonus > 0 ? fmt(p.bonus) : "—"}</TableCell>,
    },
    propinaMantenimiento: {
      th: <TableHead key="propinaMantenimiento" className="text-right">Prop. Mant.</TableHead>,
      td: (p) => <TableCell key="propinaMantenimiento" className="text-right tabular-nums">{p.propinaMantenimiento > 0 ? fmt(p.propinaMantenimiento) : "—"}</TableCell>,
    },
    ssEmpleado: {
      th: <TableHead key="ssEmpleado" className="text-right">SS Empleado</TableHead>,
      td: (p) => <TableCell key="ssEmpleado" className="text-right tabular-nums">{p.ssEmpleado > 0 ? fmt(p.ssEmpleado) : "—"}</TableCell>,
    },
    ssEmpresa: {
      th: <TableHead key="ssEmpresa" className="text-right">SS Empresa</TableHead>,
      td: (p) => <TableCell key="ssEmpresa" className="text-right tabular-nums">{p.ssEmpresa > 0 ? fmt(p.ssEmpresa) : "—"}</TableCell>,
    },
    ssTotal: {
      th: <TableHead key="ssTotal" className="text-right">Total SS</TableHead>,
      td: (p) => {
        const t = costeSSTotal(p);
        return <TableCell key="ssTotal" className="text-right tabular-nums font-medium">{t > 0 ? fmt(t) : "—"}</TableCell>;
      },
    },
    total: {
      th: <TableHead key="total" className="text-right font-bold">Total</TableHead>,
      td: (p) => <TableCell key="total" className="text-right font-bold tabular-nums">{fmt(p.total)}</TableCell>,
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

  // Celda de TOTALES por columna (respeta el orden y la visibilidad dinámicos, en
  // paralelo a columnDefs). Sin entrada = celda vacía.
  const totalDefs: Record<string, ReactNode> = {
    fijo: <TableCell key="t-fijo" />,
    pago: <TableCell key="t-pago" className="text-right tabular-nums">{fmt(resumen.totalPagos)}</TableCell>,
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
    propinaMantenimiento: <TableCell key="t-mant" className="text-right tabular-nums">{fmt(pagosFiltrados.reduce((s, p) => s + p.propinaMantenimiento, 0))}</TableCell>,
    ssEmpleado: <TableCell key="t-ssemp" className="text-right tabular-nums">{resumen.totalSsEmpleado > 0 ? fmt(resumen.totalSsEmpleado) : "—"}</TableCell>,
    ssEmpresa: <TableCell key="t-ssempresa" className="text-right tabular-nums">{resumen.totalSsEmpresa > 0 ? fmt(resumen.totalSsEmpresa) : "—"}</TableCell>,
    ssTotal: <TableCell key="t-sstotal" className="text-right tabular-nums font-medium">{resumen.totalSs > 0 ? fmt(resumen.totalSs) : "—"}</TableCell>,
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <k.icon className={`h-5 w-5 ${k.color}`} />
              <span className="text-xs text-muted-foreground">{k.label}</span>
              <span className="text-lg font-bold">{k.value}</span>
            </CardContent>
          </Card>
        ))}
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
        <Card>
          <CardContent className="p-4">
            <NotifLiquidacionesConfigPanel />
          </CardContent>
        </Card>
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
                        <TableCell className="font-medium" style={{ color: palette.label }}>{p.empleadoNombre}</TableCell>
                        {columnasRender.map((c) => columnDefs[c.campo]?.td(p))}
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            {p.confirmacionEnviadaAt ? (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 cursor-not-allowed text-muted-foreground" disabled title="Liquidación enviada (bloqueada)"><Lock className="h-3.5 w-3.5" /></Button>
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
    { key: "pago", label: "Pago" }, { key: "nomina", label: "Nómina" }, { key: "propina", label: "Propina" },
    { key: "ajuste", label: "Ajuste (+/−)" }, { key: "horasExtras", label: "H. Extras" },
    { key: "bonus", label: "Bonus" }, { key: "propinaMantenimiento", label: "Propina Mant." },
    { key: "ssEmpleado", label: "SS Empleado" }, { key: "ssEmpresa", label: "SS Empresa" },
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
