"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, Wallet, FileText,
  Settings, Trash2, Download, CheckCircle2, AlertTriangle, ArrowDownToLine,
  ArrowUpFromLine, TrendingUp, Receipt, X, Repeat, Pencil, CalendarClock,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths,
  subMonths, isSameDay, parseISO, differenceInCalendarWeeks, startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listCierres, createCierre, deleteCierre, getCierresConfig, updateCierresConfig,
  listCierresProgramaciones, upsertCierreProgramacion, deleteCierreProgramacion,
  type CierreRow, type CierresConfig, type CierreModo, type CierreGasto, type CierreTipo,
  type CierreProgramacion,
} from "@/features/gerencia/actions/cierres-actions";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import {
  SubmoduleToolbar,
  colVisible,
  ordenarColumnas,
  coincideBusquedaUniversal,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { cierresIO } from "@/features/gerencia/io/cierres.io";
import { getEmpleadosActivos, type EmpleadoActivo } from "@/features/rrhh/actions/empleados-actions";

// Tipos de movimiento del submódulo (el selector de arriba del modal).
const TIPOS_MOVIMIENTO: { value: CierreTipo; label: string }[] = [
  { value: "cierre", label: "Cierre" },
  { value: "retirada", label: "Retirada" },
  { value: "ingreso", label: "Ingreso" },
];

const TIPO_LABEL: Record<CierreTipo, string> = {
  cierre: "Cierre",
  retirada: "Retirada",
  ingreso: "Ingreso",
};

// Color del badge por tipo (cierre entra efectivo; retirada/ingreso lo sacan).
const TIPO_BADGE_CLASS: Record<CierreTipo, string> = {
  cierre: "bg-emerald-50 text-emerald-800 border-emerald-300",
  retirada: "bg-amber-50 text-amber-800 border-amber-300",
  ingreso: "bg-sky-50 text-sky-800 border-sky-300",
};

const DIAS_SEMANA = [
  { value: 0, label: "Lunes" },
  { value: 1, label: "Martes" },
  { value: 2, label: "Miércoles" },
  { value: 3, label: "Jueves" },
  { value: 4, label: "Viernes" },
  { value: 5, label: "Sábado" },
  { value: 6, label: "Domingo" },
];

// Sugerencias de tipo de gasto (texto libre: solo autocompletado, no lista cerrada).
const TIPOS_GASTO_SUGERIDOS = [
  "Proveedores", "Personal", "Suministros", "Mantenimiento",
  "Impuestos", "Alquiler", "Limpieza", "Marketing", "Otros",
];

// Fila de gasto en el formulario (con clave local estable para React).
interface GastoFila {
  key: string;
  tipo: string;
  descripcion: string;
  importe: string;
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

// Efecto de cada movimiento sobre el efectivo acumulado:
// solo el cierre SUMA efectivo a caja. Retirada e ingreso lo SACAN (restan):
// una retirada saca dinero del cajón; un ingreso lo mete en el banco.
function signoEfectivo(tipo: CierreTipo): 1 | -1 {
  return tipo === "cierre" ? 1 : -1;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Convierte el getDay() de JS (0=Dom..6=Sab) a nuestro orden (0=Lun..6=Dom)
function jsDayToLunFirst(d: Date): number {
  return (getDay(d) + 6) % 7;
}

// ¿Este día concreto cae dentro de una programación periódica?
// Regla: día de la semana coincide, dentro del rango de fechas, y la semana
// respeta el intervalo (cada N semanas contando desde fecha_inicio).
function diaEnProgramacion(dia: Date, p: CierreProgramacion): boolean {
  if (!p.activo) return false;
  if (!p.dias_semana.includes(jsDayToLunFirst(dia))) return false;
  const inicio = parseISO(p.fecha_inicio);
  const key = format(dia, "yyyy-MM-dd");
  if (key < p.fecha_inicio) return false;
  if (p.fecha_fin && key > p.fecha_fin) return false;
  if (p.intervalo_semanas <= 1) return true;
  // Semanas transcurridas desde el inicio (semana empieza en lunes).
  const semanas = differenceInCalendarWeeks(
    startOfWeek(dia, { weekStartsOn: 1 }),
    startOfWeek(inicio, { weekStartsOn: 1 }),
    { weekStartsOn: 1 },
  );
  return semanas % p.intervalo_semanas === 0;
}

// Descripción legible de la periodicidad (para la lista de reglas).
function describirProgramacion(p: CierreProgramacion): string {
  const nombres = p.dias_semana
    .map((d) => DIAS_SEMANA.find((x) => x.value === d)?.label ?? "")
    .filter(Boolean);
  const dias = nombres.length === 0
    ? "sin días"
    : nombres.length === 1
      ? nombres[0]
      : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  const cada = p.intervalo_semanas <= 1
    ? "Cada semana"
    : p.intervalo_semanas === 2
      ? "Cada 2 semanas"
      : `Cada ${p.intervalo_semanas} semanas`;
  return `${cada} · ${dias}`;
}

export function CierresView() {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const [cierres, setCierres] = useState<CierreRow[]>([]);
  const [config, setConfig] = useState<CierresConfig>({ modo: "libre", dia_semana: null });
  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  const [loading, setLoading] = useState(true);

  const [vista, setVista] = useState<"resumen" | "calendario" | "ajustes">("resumen");
  const [busqueda, setBusqueda] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [mesActual, setMesActual] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [selected, setSelected] = useState<CierreRow | null>(null);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const gastoKeyRef = useRef(0);
  const nuevaGastoFila = useCallback((): GastoFila => {
    gastoKeyRef.current += 1;
    return { key: `g-${gastoKeyRef.current}`, tipo: "", descripcion: "", importe: "" };
  }, []);

  const emptyForm = () => ({
    tipo: "cierre" as CierreTipo,
    fecha: today,
    efectivo_retirado: "",
    total_contado: "",
    notas: "",
    registrado_por: "",
    file: null as File | null,
    gastos: [] as GastoFila[],
  });
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Total de gastos apuntados en el formulario (en vivo).
  const totalGastosPreview = useMemo(
    () => form.gastos.reduce((s, g) => s + (Number((g.importe || "0").replace(",", ".")) || 0), 0),
    [form.gastos],
  );

  // Descuadre calculado en vivo: contado − efectivo. >0 sobra · <0 falta · 0 cuadra.
  const descuadrePreview = useMemo(() => {
    const efectivo = Number((form.efectivo_retirado || "0").replace(",", ".")) || 0;
    const contado = Number((form.total_contado || "0").replace(",", ".")) || 0;
    return Math.round((contado - efectivo) * 100) / 100;
  }, [form.efectivo_retirado, form.total_contado]);

  const [cfgForm, setCfgForm] = useState<CierresConfig>({ modo: "libre", dia_semana: null });
  const [cfgSaving, setCfgSaving] = useState(false);

  // Programaciones periódicas (reglas de cierre estilo Google Calendar).
  const [programaciones, setProgramaciones] = useState<CierreProgramacion[]>([]);
  const [progModalOpen, setProgModalOpen] = useState(false);
  const [progEditId, setProgEditId] = useState<string | null>(null);
  const [progSaving, setProgSaving] = useState(false);
  const emptyProgForm = () => ({
    nombre: "Cierre",
    intervalo_semanas: 1,
    dias_semana: [] as number[],
    fecha_inicio: today,
    fecha_fin: "" as string,
    activo: true,
  });
  const [progForm, setProgForm] = useState(emptyProgForm());

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c, d] = await Promise.all([
        listCierres(), getCierresConfig(), listCierresProgramaciones(), getEmpleadosActivos(),
      ]);
      if (a.ok) setCierres(a.data);
      if (b.ok) {
        setConfig(b.data);
        setCfgForm(b.data);
      }
      if (c.ok) setProgramaciones(c.data);
      if (d.ok) setEmpleados(d.data);
    } catch (e) {
      console.error("[CierresView] cargar:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Derivados ─────────────────────────────────────────
  const cierresPorFecha = useMemo(() => {
    const m: Record<string, CierreRow[]> = {};
    cierres.forEach((c) => {
      if (!m[c.fecha]) m[c.fecha] = [];
      m[c.fecha].push(c);
    });
    return m;
  }, [cierres]);


  const resumen = useMemo(() => {
    const total = cierres.length;
    let cuadran = 0;
    let descuadrados = 0;
    let saldoNeto = 0;
    let acumuladoEfectivo = 0;
    let acumuladoGastos = 0;
    cierres.forEach((c) => {
      if (c.cuadra) cuadran++;
      else descuadrados++;
      saldoNeto += c.descuadre;
      acumuladoEfectivo += signoEfectivo(c.tipo) * c.efectivo_retirado;
      acumuladoGastos += c.total_gastos;
    });
    return { total, cuadran, descuadrados, saldoNeto, acumuladoEfectivo, acumuladoGastos };
  }, [cierres]);

  // Acumulado corriente por movimiento: running total cronológico del efectivo.
  // Cierre suma; retirada e ingreso restan (sacan efectivo de caja).
  // (cierres viene descendente; recorremos en orden ascendente para el running total.)
  const acumuladoPorId = useMemo(() => {
    const m: Record<string, number> = {};
    let run = 0;
    [...cierres].reverse().forEach((c) => {
      run += signoEfectivo(c.tipo) * c.efectivo_retirado;
      m[c.id] = run;
    });
    return m;
  }, [cierres]);

  const cierresFiltrados = useMemo(
    () => cierres.filter((c) => coincideBusquedaUniversal(c, busqueda)),
    [cierres, busqueda],
  );

  const columnasDef: ToolbarColumna[] = [
    { campo: "fecha", label: "Fecha", bloqueada: true },
    { campo: "tipo", label: "Tipo" },
    { campo: "semana", label: "Semana" },
    { campo: "efectivo", label: "Efectivo retirado" },
    { campo: "total", label: "Total contado" },
    { campo: "estado", label: "Estado" },
    { campo: "descuadre", label: "Descuadre" },
    { campo: "gastos", label: "Gastos" },
    { campo: "acumulado", label: "Acumulado" },
    { campo: "doc", label: "Doc." },
  ];
  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  const headDe: Record<string, ReactNode> = {
    fecha: <TableHead key="fecha">Fecha</TableHead>,
    tipo: <TableHead key="tipo">Tipo</TableHead>,
    semana: <TableHead key="semana">Semana</TableHead>,
    efectivo: <TableHead key="efectivo" className="text-right">Efectivo retirado</TableHead>,
    total: <TableHead key="total" className="text-right">Total contado</TableHead>,
    estado: <TableHead key="estado">Estado</TableHead>,
    descuadre: <TableHead key="descuadre" className="text-right">Descuadre</TableHead>,
    gastos: <TableHead key="gastos" className="text-right">Gastos</TableHead>,
    acumulado: <TableHead key="acumulado" className="text-right">Acumulado</TableHead>,
    doc: <TableHead key="doc">Doc.</TableHead>,
  };
  const cellDe = (c: CierreRow): Record<string, ReactNode> => ({
    fecha: (
      <TableCell key="fecha" className="font-medium">
        {format(parseISO(c.fecha), "dd MMM yyyy", { locale: es })}
      </TableCell>
    ),
    tipo: (
      <TableCell key="tipo">
        <Badge variant="outline" className={`text-xs ${TIPO_BADGE_CLASS[c.tipo]}`}>
          {TIPO_LABEL[c.tipo]}
        </Badge>
      </TableCell>
    ),
    semana: (
      <TableCell key="semana" className="text-xs text-muted-foreground">{c.semana_iso ?? "—"}</TableCell>
    ),
    efectivo: (
      <TableCell key="efectivo" className={`text-right ${signoEfectivo(c.tipo) < 0 ? "text-red-700" : ""}`}>
        {signoEfectivo(c.tipo) < 0 && c.efectivo_retirado > 0 ? "−" : ""}{fmtEuro(c.efectivo_retirado)}
      </TableCell>
    ),
    total: <TableCell key="total" className="text-right">{fmtEuro(c.total_contado)}</TableCell>,
    estado: (
      <TableCell key="estado">
        {c.cuadra ? (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Cuadra
          </Badge>
        ) : (
          <Badge className={`gap-1 ${c.descuadre >= 0 ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-red-100 text-red-800 border-red-300"}`}>
            <AlertTriangle className="h-3 w-3" />
            {c.descuadre >= 0 ? "Sobra" : "Falta"}
          </Badge>
        )}
      </TableCell>
    ),
    descuadre: (
      <TableCell key="descuadre" className={`text-right font-medium ${c.descuadre === 0 ? "text-muted-foreground" : c.descuadre > 0 ? "text-amber-700" : "text-red-700"}`}>
        {c.cuadra ? "—" : fmtEuro(c.descuadre)}
      </TableCell>
    ),
    gastos: (
      <TableCell key="gastos" className={`text-right ${c.total_gastos > 0 ? "text-orange-700 font-medium" : "text-muted-foreground"}`}>
        {c.total_gastos > 0 ? fmtEuro(c.total_gastos) : "—"}
      </TableCell>
    ),
    acumulado: (
      <TableCell key="acumulado" className={`text-right font-semibold ${(acumuladoPorId[c.id] ?? 0) < 0 ? "text-red-700" : "text-emerald-700"}`}>
        {fmtEuro(acumuladoPorId[c.id] ?? 0)}
      </TableCell>
    ),
    doc: (
      <TableCell key="doc">
        {c.url ? (
          <Badge variant="outline" className="text-xs gap-1">
            <FileText className="h-3 w-3" /> Sí
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    ),
  });

  // ── Handlers ──────────────────────────────────────────
  const abrirNuevo = (fecha?: string) => {
    const f = emptyForm();
    if (fecha) f.fecha = fecha;
    setForm(f);
    setModalOpen(true);
  };

  // ── Gastos del formulario ─────────────────────────────
  const addGasto = () =>
    setForm((f) => ({ ...f, gastos: [...f.gastos, nuevaGastoFila()] }));

  const removeGasto = (key: string) =>
    setForm((f) => ({ ...f, gastos: f.gastos.filter((g) => g.key !== key) }));

  const updateGasto = (key: string, campo: "tipo" | "descripcion" | "importe", valor: string) =>
    setForm((f) => ({
      ...f,
      gastos: f.gastos.map((g) => (g.key === key ? { ...g, [campo]: valor } : g)),
    }));

  const handleGuardar = async () => {
    if (saving) return; // evita doble envío
    if (!form.fecha) {
      toast.error("La fecha es obligatoria");
      return;
    }
    // Cierres e ingresos exigen justificante adjunto (la retirada no).
    if (form.tipo !== "retirada" && !form.file) {
      toast.error(`Debes adjuntar un documento para registrar ${form.tipo === "ingreso" ? "un ingreso" : "un cierre"}`);
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("tipo", form.tipo);
      fd.append("fecha", form.fecha);
      fd.append("efectivo_retirado", form.efectivo_retirado || "0");
      // Total contado y gastos solo aplican al cierre semanal.
      if (form.tipo === "cierre") {
        fd.append("total_contado", form.total_contado || "0");
      }
      // El descuadre lo calcula el backend (contado − efectivo); no se envía a mano.
      fd.append("notas", form.notas);
      fd.append("registrado_por", form.registrado_por);
      if (form.tipo === "cierre") {
        // Gastos de la semana: se descartan filas totalmente vacías.
        const gastosPayload: CierreGasto[] = form.gastos
          .map((g) => ({
            tipo: g.tipo.trim(),
            descripcion: g.descripcion.trim(),
            importe: Number((g.importe || "0").replace(",", ".")) || 0,
          }))
          .filter((g) => g.tipo || g.descripcion || g.importe !== 0);
        if (gastosPayload.length > 0) fd.append("gastos", JSON.stringify(gastosPayload));
      }
      if (form.file) fd.append("file", form.file);

      const res = await createCierre(fd);
      if (res.ok) {
        toast.success(
          form.tipo === "retirada" ? "Retirada registrada"
            : form.tipo === "ingreso" ? "Ingreso registrado"
            : "Cierre registrado",
        );
        setModalOpen(false);
        setForm(emptyForm());
        cargar();
      } else {
        toast.error(res.error ?? "Error al registrar el cierre");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (id: string) => {
    const ok = await confirmDelete({
      title: "¿Eliminar este cierre?",
      description: "Se borrará también el documento adjunto.",
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const res = await deleteCierre(id);
    if (res.ok) {
      toast.success("Cierre eliminado");
      setDetalleOpen(false);
      setSelected(null);
      cargar();
    } else {
      toast.error(res.error ?? "Error al eliminar");
    }
  };

  const handleGuardarConfig = async () => {
    setCfgSaving(true);
    try {
      const payload = {
        modo: cfgForm.modo,
        dia_semana: cfgForm.modo === "fijo" ? (cfgForm.dia_semana ?? 0) : null,
      };
      const res = await updateCierresConfig(payload);
      if (res.ok) {
        toast.success("Ajustes guardados");
        setConfig(payload);
      } else {
        toast.error(res.error ?? "Error al guardar ajustes");
      }
    } finally {
      setCfgSaving(false);
    }
  };

  // ── Programaciones periódicas ─────────────────────────
  const abrirNuevaProg = () => {
    setProgEditId(null);
    setProgForm(emptyProgForm());
    setProgModalOpen(true);
  };

  const abrirEditarProg = (p: CierreProgramacion) => {
    setProgEditId(p.id);
    setProgForm({
      nombre: p.nombre,
      intervalo_semanas: p.intervalo_semanas,
      dias_semana: [...p.dias_semana],
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin ?? "",
      activo: p.activo,
    });
    setProgModalOpen(true);
  };

  const toggleProgDia = (d: number) =>
    setProgForm((f) => ({
      ...f,
      dias_semana: f.dias_semana.includes(d)
        ? f.dias_semana.filter((x) => x !== d)
        : [...f.dias_semana, d].sort((a, b) => a - b),
    }));

  const handleGuardarProg = async () => {
    if (progSaving) return;
    if (progForm.dias_semana.length === 0) {
      toast.error("Elige al menos un día de la semana");
      return;
    }
    if (!progForm.fecha_inicio) {
      toast.error("La fecha de inicio es obligatoria");
      return;
    }
    setProgSaving(true);
    try {
      const res = await upsertCierreProgramacion({
        id: progEditId ?? undefined,
        nombre: progForm.nombre,
        intervalo_semanas: progForm.intervalo_semanas,
        dias_semana: progForm.dias_semana,
        fecha_inicio: progForm.fecha_inicio,
        fecha_fin: progForm.fecha_fin || null,
        activo: progForm.activo,
      });
      if (res.ok) {
        toast.success(progEditId ? "Programación actualizada" : "Programación creada");
        setProgModalOpen(false);
        cargar();
      } else {
        toast.error(res.error ?? "Error al guardar la programación");
      }
    } finally {
      setProgSaving(false);
    }
  };

  const handleEliminarProg = async (p: CierreProgramacion) => {
    const ok = await confirmDelete({
      title: "¿Eliminar esta programación?",
      description: `Se dejarán de marcar los días de "${p.nombre}" en el calendario.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const res = await deleteCierreProgramacion(p.id);
    if (res.ok) {
      toast.success("Programación eliminada");
      cargar();
    } else {
      toast.error(res.error ?? "Error al eliminar");
    }
  };

  // ── Calendario ─────────────────────────────────────────
  const inicioMes = startOfMonth(mesActual);
  const finMes = endOfMonth(mesActual);
  const diasMes = eachDayOfInterval({ start: inicioMes, end: finMes });
  const offsetInicio = jsDayToLunFirst(inicioMes);

  return (
    <div className="p-6 space-y-6">
      {confirmDeleteDialog}
      {/* Toolbar BARRA HORIZONTAL 1 */}
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={() => abrirNuevo()}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraIzquierda={
          <Button
            size="sm"
            variant="outline"
            className={`gap-1.5 ${vista === "calendario" ? "bg-white border-primary text-primary hover:bg-white" : ""}`}
            onClick={() => setVista((v) => (v === "calendario" ? "resumen" : "calendario"))}
            title="Ver calendario"
          >
            <CalendarDays className="h-4 w-4" />
            Calendario
          </Button>
        }
        extraDerecha={
          <>
            <IOActions config={cierresIO} onSuccess={cargar} />
            <Button
              size="icon"
              variant={vista === "ajustes" ? "default" : "outline"}
              className="h-9 w-9"
              onClick={() => setVista((v) => (v === "ajustes" ? "resumen" : "ajustes"))}
              title="Configuración"
              aria-label="Configuración"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{fmtEuro(resumen.acumuladoEfectivo)}</p>
              <p className="text-xs text-muted-foreground">Efectivo acumulado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{resumen.total}</p>
              <p className="text-xs text-muted-foreground">Cierres registrados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{resumen.cuadran}</p>
              <p className="text-xs text-muted-foreground">Cuadran</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{resumen.descuadrados}</p>
              <p className="text-xs text-muted-foreground">Con descuadre</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${resumen.saldoNeto >= 0 ? "bg-emerald-50" : "bg-amber-50"}`}>
              <Wallet className={`h-5 w-5 ${resumen.saldoNeto >= 0 ? "text-emerald-600" : "text-amber-600"}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${resumen.saldoNeto >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {fmtEuro(resumen.saldoNeto)}
              </p>
              <p className="text-xs text-muted-foreground">Saldo neto descuadres</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-700">{fmtEuro(resumen.acumuladoGastos)}</p>
              <p className="text-xs text-muted-foreground">Gastos acumulados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vistas: resumen (principal) · calendario · ajustes — se conmutan desde la toolbar */}
      <Tabs value={vista} onValueChange={(v) => setVista(v as typeof vista)}>
        {/* ── RESUMEN ── */}
        <TabsContent value="resumen" className="mt-4 space-y-6">
          {/* Tabla completa */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  {columnasRender.map((c) => headDe[c.campo])}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cierresFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columnasRender.length} className="text-center py-12 text-muted-foreground">
                      {loading ? <LoadingSpinner /> : "No hay cierres registrados aún"}
                    </TableCell>
                  </TableRow>
                )}
                {cierresFiltrados.map((c) => {
                  const celdas = cellDe(c);
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelected(c); setDetalleOpen(true); }}
                    >
                      {columnasRender.map((col) => celdas[col.campo])}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── CALENDARIO ── */}
        <TabsContent value="calendario" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => setMesActual((m) => subMonths(m, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-lg font-semibold capitalize">
                  {format(mesActual, "MMMM yyyy", { locale: es })}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setMesActual((m) => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Leyenda */}
              <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-emerald-200 border border-emerald-400" />
                  Cierre registrado y cuadra
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-amber-200 border border-amber-400" />
                  Cierre con descuadre
                </div>
                {programaciones.some((p) => p.activo) && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded bg-blue-100 border border-blue-300 ring-1 ring-blue-300" />
                      Cierre programado
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded bg-red-100 border border-red-400 ring-1 ring-red-400" />
                      Pendiente (sin registrar)
                    </div>
                  </>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded ring-2 ring-primary/40" />
                  Hoy
                </div>
              </div>

              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                  <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                ))}
                {Array.from({ length: offsetInicio }).map((_, i) => (
                  <div key={`e-${i}`} className="bg-background p-2 min-h-[90px]" />
                ))}
                {diasMes.map((dia) => {
                  const key = format(dia, "yyyy-MM-dd");
                  const items = cierresPorFecha[key] ?? [];
                  const tieneCierre = items.length > 0;
                  const cuadra = tieneCierre && items.every((x) => x.cuadra);
                  const esHoy = isSameDay(dia, new Date());
                  // ¿Este día está programado por alguna regla periódica?
                  const esProgramado = programaciones.some((p) => diaEnProgramacion(dia, p));
                  // Programado, ya pasó (o es hoy) y no se registró → pendiente.
                  const esPendiente = esProgramado && !tieneCierre && key <= today;
                  const esProgramadoFuturo = esProgramado && !tieneCierre && key > today;

                  let bg = "bg-background";
                  if (tieneCierre && cuadra) bg = "bg-emerald-100";
                  else if (tieneCierre && !cuadra) bg = "bg-amber-100";
                  else if (esPendiente) bg = "bg-red-100";
                  else if (esProgramadoFuturo) bg = "bg-blue-50";

                  return (
                    <div
                      key={key}
                      className={`relative ${bg} p-2 min-h-[90px] cursor-pointer transition hover:brightness-95 ${esHoy ? "ring-2 ring-primary/40 ring-inset" : ""} ${esPendiente ? "ring-1 ring-red-400 ring-inset" : esProgramadoFuturo ? "ring-1 ring-blue-300 ring-inset" : ""}`}
                      onClick={() => {
                        if (tieneCierre) {
                          setSelected(items[0]);
                          setDetalleOpen(true);
                        } else {
                          abrirNuevo(key);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${esHoy ? "text-primary font-bold" : "text-muted-foreground"}`}>
                          {format(dia, "d")}
                        </span>
                        {tieneCierre && (
                          cuadra ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                 : <AlertTriangle className="h-3 w-3 text-amber-600" />
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {items.slice(0, 2).map((c) => {
                          // El importe con signo real sobre la caja: cierre suma, retirada/ingreso restan.
                          const importeConSigno = signoEfectivo(c.tipo) * c.efectivo_retirado;
                          const esNegativo = importeConSigno < 0;
                          return (
                          <div key={c.id} className="text-[10px] leading-tight">
                            <span className={`font-medium ${esNegativo ? "text-red-700" : ""}`}>{fmtEuro(importeConSigno)}</span>
                            {!c.cuadra && (
                              <span className={`ml-1 ${c.descuadre >= 0 ? "text-amber-700" : "text-red-700"}`}>
                                ({c.descuadre >= 0 ? "+" : ""}{fmtEuro(c.descuadre)})
                              </span>
                            )}
                          </div>
                          );
                        })}
                        {items.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{items.length - 2} más</span>
                        )}
                        {esPendiente && (
                          <span className="text-[10px] text-red-700 font-semibold flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> Falta registrar
                          </span>
                        )}
                        {esProgramadoFuturo && (
                          <span className="text-[10px] text-blue-700 font-medium">Cierre programado</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AJUSTES ── */}
        <TabsContent value="ajustes" className="mt-4 space-y-6">
          {/* Programaciones periódicas de cierre (estilo Google Calendar) */}
          <Card>
            <CardContent className="p-6 space-y-4 max-w-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-primary" />
                    Cierres programados
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Define en qué días toca hacer cierre. Se marcarán en el calendario y, si pasa el día sin registrarlo, aparecerá en rojo como pendiente.
                  </p>
                </div>
                <Button size="sm" className="gap-1.5 shrink-0" onClick={abrirNuevaProg}>
                  <Plus className="h-4 w-4" /> Añadir
                </Button>
              </div>

              {programaciones.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center">
                  <Repeat className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No hay cierres programados. Pulsa <strong>Añadir</strong> para crear una regla que se repita (ej: cada semana los martes).
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {programaciones.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${p.activo ? "" : "opacity-60"}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{p.nombre}</span>
                          {!p.activo && (
                            <Badge variant="outline" className="text-xs">Inactivo</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{describirProgramacion(p)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Desde {format(parseISO(p.fecha_inicio), "d MMM yyyy", { locale: es })}
                          {p.fecha_fin ? ` · hasta ${format(parseISO(p.fecha_fin), "d MMM yyyy", { locale: es })}` : " · sin fecha de fin"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEditarProg(p)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          onClick={() => handleEliminarProg(p)}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-6 max-w-2xl">
              <div>
                <h3 className="font-semibold text-lg">Día de cierre</h3>
                <p className="text-sm text-muted-foreground">
                  Configura cuándo se hace el cierre semanal. Si eliges <strong>libre</strong>, se mostrará en el calendario el día en que registres cada cierre.
                </p>
              </div>

              <RadioGroup
                value={cfgForm.modo}
                onValueChange={(v) => setCfgForm((s) => ({ ...s, modo: v as CierreModo }))}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 rounded-lg border p-4">
                  <RadioGroupItem value="fijo" id="modo-fijo" className="mt-1" />
                  <Label htmlFor="modo-fijo" className="flex-1 cursor-pointer">
                    <div className="font-medium">Día prefijado</div>
                    <div className="text-sm text-muted-foreground">
                      El cierre se hace siempre el mismo día de la semana. Aparecerá marcado en el calendario y en la lista de próximos cierres.
                    </div>
                    {cfgForm.modo === "fijo" && (
                      <div className="mt-3">
                        <Select
                          value={String(cfgForm.dia_semana ?? 0)}
                          onValueChange={(v) => setCfgForm((s) => ({ ...s, dia_semana: Number(v) }))}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Selecciona el día" />
                          </SelectTrigger>
                          <SelectContent>
                            {DIAS_SEMANA.map((d) => (
                              <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </Label>
                </div>

                <div className="flex items-start space-x-3 rounded-lg border p-4">
                  <RadioGroupItem value="libre" id="modo-libre" className="mt-1" />
                  <Label htmlFor="modo-libre" className="flex-1 cursor-pointer">
                    <div className="font-medium">Libre / aleatorio</div>
                    <div className="text-sm text-muted-foreground">
                      Sin día prefijado. El cierre se marca en el calendario el día en que se registre.
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCfgForm(config)}
                  disabled={cfgSaving}
                >
                  Restablecer
                </Button>
                <Button onClick={handleGuardarConfig} disabled={cfgSaving}>
                  {cfgSaving ? "Guardando..." : "Guardar ajustes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Modal Nuevo cierre ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.tipo === "retirada" ? "Registrar retirada"
                : form.tipo === "ingreso" ? "Registrar ingreso"
                : "Registrar cierre semanal"}
            </DialogTitle>
          </DialogHeader>

          {/* Selector de tipo de movimiento: Cierre · Retirada · Ingreso */}
          <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-muted p-1">
            {TIPOS_MOVIMIENTO.map((t) => {
              const activo = form.tipo === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tipo: t.value }))}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    activo
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={activo}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <Label>
                {form.tipo === "retirada"
                  ? "Fecha de la retirada *"
                  : form.tipo === "ingreso"
                    ? "Fecha del ingreso *"
                    : "Fecha del cierre *"}
              </Label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <Label>Registrado por</Label>
              <Select
                value={form.registrado_por || "__none__"}
                onValueChange={(v) => setForm({ ...form, registrado_por: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un empleado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin especificar</SelectItem>
                  {empleados.map((e) => (
                    <SelectItem key={e.empleadoId} value={e.nombreCompleto}>
                      {e.nombreCompleto}
                      {(e.puesto || e.departamento) && (
                        <span className="text-muted-foreground">
                          {" — "}{[e.puesto, e.departamento].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>
                {form.tipo === "retirada"
                  ? "Efectivo retirado a caja fuerte (€)"
                  : form.tipo === "ingreso"
                    ? "Ingreso en banco (€)"
                    : "Efectivo retirado del cajón (€)"}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.efectivo_retirado}
                onChange={(e) => setForm({ ...form, efectivo_retirado: e.target.value })}
                placeholder="0.00"
              />
              {form.tipo === "retirada" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Dinero que sale de la caja fuerte para diferentes cuestiones como pagos.
                </p>
              )}
              {form.tipo === "ingreso" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Efectivo que sale de la caja fuerte y se ingresa en el banco.
                </p>
              )}
            </div>
            {form.tipo === "cierre" && (
              <div>
                <Label>Total cierre semana (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.total_contado}
                  onChange={(e) => setForm({ ...form, total_contado: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            )}

            {/* Descuadre calculado automáticamente = contado − efectivo */}
            {form.tipo === "cierre" && (
            <div className="col-span-2">
              <Label className="mb-2 block">Descuadre (calculado automáticamente)</Label>
              <div
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  descuadrePreview === 0
                    ? "bg-emerald-50 border-emerald-200"
                    : descuadrePreview > 0
                      ? "bg-amber-50 border-amber-200"
                      : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {descuadrePreview === 0 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-800">Cuadra</span>
                    </>
                  ) : descuadrePreview > 0 ? (
                    <>
                      <ArrowUpFromLine className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">Sobra dinero</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-800">Falta dinero</span>
                    </>
                  )}
                </div>
                <span
                  className={`text-base font-bold ${
                    descuadrePreview === 0
                      ? "text-emerald-700"
                      : descuadrePreview > 0
                        ? "text-amber-700"
                        : "text-red-700"
                  }`}
                >
                  {descuadrePreview > 0 ? "+" : ""}{fmtEuro(descuadrePreview)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Se calcula solo: total contado en caja − efectivo retirado.
              </p>
            </div>
            )}

            {/* Gastos de la semana (registro informativo, no afecta al descuadre) */}
            {form.tipo === "cierre" && (
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  Gastos de la semana
                </Label>
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addGasto}>
                  <Plus className="h-3.5 w-3.5" /> Añadir gasto
                </Button>
              </div>

              {form.gastos.length === 0 ? (
                <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-4 py-4 text-center">
                  Sin gastos apuntados. Añade los gastos que haya habido durante la semana.
                </p>
              ) : (
                <div className="space-y-2">
                  <datalist id="tipos-gasto-sugeridos">
                    {TIPOS_GASTO_SUGERIDOS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  {form.gastos.map((g) => (
                    <div key={g.key} className="flex items-start gap-2">
                      <Input
                        className="w-[28%]"
                        list="tipos-gasto-sugeridos"
                        placeholder="Tipo de gasto"
                        value={g.tipo}
                        onChange={(e) => updateGasto(g.key, "tipo", e.target.value)}
                      />
                      <Input
                        className="flex-1"
                        placeholder="Descripción"
                        value={g.descripcion}
                        onChange={(e) => updateGasto(g.key, "descripcion", e.target.value)}
                      />
                      <Input
                        className="w-[22%]"
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        placeholder="Importe €"
                        value={g.importe}
                        onChange={(e) => updateGasto(g.key, "importe", e.target.value)}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-red-600"
                        onClick={() => removeGasto(g.key)}
                        aria-label="Quitar gasto"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2">
                    <span className="text-sm font-medium">Total gastos</span>
                    <span className="text-sm font-bold">{fmtEuro(totalGastosPreview)}</span>
                  </div>
                </div>
              )}
            </div>
            )}

            {form.tipo !== "retirada" && (
            <div className="col-span-2">
              <Label>
                {form.tipo === "ingreso"
                  ? "Documento del ingreso (PDF, imagen, etc.)"
                  : "Documento del cierre (PDF, imagen, etc.)"}
                <span className="text-red-600"> *</span>
              </Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              />
              {form.file ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {form.file.name} · {fmtSize(form.file.size)}
                </p>
              ) : (
                <p className="text-xs text-red-600 mt-1">
                  Obligatorio: adjunta el justificante para poder guardar.
                </p>
              )}
            </div>
            )}

            <div className="col-span-2">
              <Label>Notas / Observaciones</Label>
              <Textarea
                rows={3}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Cualquier comentario sobre el cierre..."
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={!form.fecha || saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Programación periódica ── */}
      <Dialog open={progModalOpen} onOpenChange={setProgModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              {progEditId ? "Editar cierre programado" : "Nuevo cierre programado"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label>Nombre</Label>
              <Input
                value={progForm.nombre}
                onChange={(e) => setProgForm({ ...progForm, nombre: e.target.value })}
                placeholder="Ej: Cierre semanal"
              />
            </div>

            <div>
              <Label className="mb-2 block">Se repite</Label>
              <div className="flex items-center gap-2 text-sm">
                <span>Cada</span>
                <Input
                  type="number"
                  min={1}
                  max={52}
                  className="w-20"
                  value={progForm.intervalo_semanas}
                  onChange={(e) =>
                    setProgForm({
                      ...progForm,
                      intervalo_semanas: Math.min(52, Math.max(1, Math.round(Number(e.target.value) || 1))),
                    })
                  }
                />
                <span>{progForm.intervalo_semanas === 1 ? "semana" : "semanas"}</span>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Días de la semana *</Label>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((d) => {
                  const activo = progForm.dias_semana.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleProgDia(d.value)}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                        activo
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                      aria-pressed={activo}
                    >
                      {d.label.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Empieza el *</Label>
                <Input
                  type="date"
                  value={progForm.fecha_inicio}
                  onChange={(e) => setProgForm({ ...progForm, fecha_inicio: e.target.value })}
                />
              </div>
              <div>
                <Label>Termina el</Label>
                <Input
                  type="date"
                  value={progForm.fecha_fin}
                  min={progForm.fecha_inicio || undefined}
                  onChange={(e) => setProgForm({ ...progForm, fecha_fin: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Déjalo vacío para que no termine.</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Activo</p>
                <p className="text-xs text-muted-foreground">Si lo desactivas, deja de marcar días en el calendario.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={progForm.activo}
                onClick={() => setProgForm((f) => ({ ...f, activo: !f.activo }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${progForm.activo ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${progForm.activo ? "translate-x-5" : "translate-x-1"}`} />
              </button>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setProgModalOpen(false)} disabled={progSaving}>Cancelar</Button>
            <Button onClick={handleGuardarProg} disabled={progSaving || progForm.dias_semana.length === 0 || !progForm.fecha_inicio}>
              {progSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Detalle ── */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 capitalize">
                  Cierre del {format(parseISO(selected.fecha), "EEEE d 'de' MMMM yyyy", { locale: es })}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-2">
                  {selected.cuadra ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Cuadra
                    </Badge>
                  ) : (
                    <Badge className={`gap-1 ${selected.descuadre >= 0 ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-red-100 text-red-800 border-red-300"}`}>
                      <AlertTriangle className="h-3 w-3" />
                      Descuadre {selected.descuadre >= 0 ? "positivo (sobra)" : "negativo (falta)"}: {fmtEuro(selected.descuadre)}
                    </Badge>
                  )}
                  {selected.semana_iso && (
                    <Badge variant="outline" className="text-xs">{selected.semana_iso}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Efectivo retirado</Label>
                    <p className="text-base font-semibold">{fmtEuro(selected.efectivo_retirado)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total contado</Label>
                    <p className="text-base font-semibold">{fmtEuro(selected.total_contado)}</p>
                  </div>
                  {selected.registrado_por && (
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Registrado por</Label>
                      <p className="text-sm">{selected.registrado_por}</p>
                    </div>
                  )}
                </div>

                {selected.gastos.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5" /> Gastos de la semana
                    </Label>
                    <div className="mt-1 rounded-lg border divide-y">
                      {selected.gastos.map((g, i) => (
                        <div key={g.id ?? i} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            {g.tipo && (
                              <Badge variant="secondary" className="text-xs mr-2">{g.tipo}</Badge>
                            )}
                            <span className="text-sm text-muted-foreground">{g.descripcion || "—"}</span>
                          </div>
                          <span className="text-sm font-medium shrink-0">{fmtEuro(g.importe)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
                        <span className="text-sm font-medium">Total gastos</span>
                        <span className="text-sm font-bold">{fmtEuro(selected.total_gastos)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {selected.notas && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Notas</Label>
                    <p className="text-sm whitespace-pre-wrap mt-1">{selected.notas}</p>
                  </div>
                )}

                {selected.url && (
                  <div className="rounded-lg border p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{selected.file_name ?? "Documento del cierre"}</p>
                        <p className="text-xs text-muted-foreground">{fmtSize(selected.size_bytes)}</p>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={selected.url} target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5 mr-1" /> Abrir
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleEliminar(selected.id)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                </Button>
                <Button variant="outline" onClick={() => setDetalleOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
