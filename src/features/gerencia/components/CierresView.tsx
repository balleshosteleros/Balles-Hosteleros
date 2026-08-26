"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { useSincronizacionEnVivo } from "@/shared/hooks/useSincronizacionEnVivo";
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, Wallet, FileText,
  Settings, Trash2, Download, CheckCircle2, AlertTriangle, ArrowDownToLine,
  ArrowUpFromLine, TrendingUp, Receipt, X, Repeat, Pencil, CalendarClock, ListFilter,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths,
  subMonths, isSameDay, parseISO, differenceInCalendarWeeks, startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/shared/components/NumberInput";
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
  listCierres, createCierre, crearUrlsSubidaCierre, deleteCierre, getCierresConfig, updateCierresConfig,
  listCierresProgramaciones, upsertCierreProgramacion, deleteCierreProgramacion,
  type CierreRow, type CierresConfig, type CierreModo, type CierreGasto, type CierreTipo,
  type CierreProgramacion,
} from "@/features/gerencia/actions/cierres-actions";
import { MAX_DOCUMENTOS_CIERRE, MAX_TAMANO_DOCUMENTO_MB, MAX_TAMANO_DOCUMENTO_BYTES, DIAS_BLOQUEO_DEFAULT } from "@/features/gerencia/types/cierres";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { createClient as createSupabaseBrowser } from "@/lib/supabase/client";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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

// Nombre reconocible de la programación que se sincroniza automáticamente
// desde "Día de cierre → Día prefijado". Así "Día prefijado" y "Cierres
// programados" quedan conectados: elegir un día fijo pinta el calendario.
const PROG_AUTO_NOMBRE = "Cierre semanal";

// Tipos de gasto: LISTA CERRADA. No se puede escribir a mano ni inventar
// categorías nuevas, para que los gastos siempre se agrupen igual.
const TIPOS_GASTO = [
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

// Conjunto vacío compartido: evita crear un Set nuevo en cada render para las
// columnas que todavía no tienen ningún filtro puesto.
const EMPTY_SET: Set<string> = new Set();

function fmtEuro(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

// Descuadre SIEMPRE con su signo delante: "+" cuando sobra dinero y "−" cuando falta.
// Se antepone a mano porque Intl coloca el menos pegado al número y aquí interesa que
// el signo se lea antes que la cifra. El color (verde/rojo) lo pone cada vista.
function fmtDescuadre(n: number): string {
  if (n === 0) return fmtEuro(0);
  return `${n > 0 ? "+" : "−"}${fmtEuro(Math.abs(n))}`;
}

// Un gasto SIEMPRE resta dinero de la caja, así que se enseña con el signo negativo
// delante aunque en la base de datos se guarde como cantidad positiva.
function fmtGasto(n: number): string {
  if (n === 0) return fmtEuro(0);
  return `−${fmtEuro(Math.abs(n))}`;
}

// Efecto de cada movimiento sobre el efectivo acumulado.
// El cierre SIEMPRE suma efectivo a caja. El ingreso SIEMPRE lo saca (va al banco).
//
// La retirada puede ir en los dos sentidos, y lo decide la marca `retirada_entrada`:
//   false (por defecto) = sale dinero de caja · true = entra dinero en caja.
// Las retiradas ANTIGUAS quedan en false, que es justo lo que siempre significaron,
// así que se siguen viendo en negativo exactamente igual que antes.
function importeEfectivo(c: { tipo: CierreTipo; efectivo_retirado: number; retirada_entrada?: boolean }): number {
  const magnitud = Math.abs(c.efectivo_retirado);
  if (c.tipo === "retirada") return c.retirada_entrada ? magnitud : -magnitud;
  return c.tipo === "cierre" ? magnitud : -magnitud;
}

// Valor NUMÉRICO real de una columna de dinero: se usa solo para ordenar las
// opciones del filtro de esa columna de menor a mayor (el texto en euros se
// ordenaría mal como cadena: "1.000 €" iría antes que "9 €").
function numeroColumna(
  c: CierreRow,
  campo: string,
  acumulados: Record<string, number>,
): number {
  switch (campo) {
    case "efectivo": return importeEfectivo(c);
    case "total": return c.total_contado;
    case "descuadre": return c.cuadra ? 0 : c.descuadre;
    case "gastos": return c.total_gastos;
    case "acumulado": return acumulados[c.id] ?? 0;
    default: return 0;
  }
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Enlace al adjunto de un cierre. Se apunta a la ruta que firma el documento EN
// EL MOMENTO del clic: las URLs firmadas al cargar la lista caducan a la hora y
// abrirlas después devolvía `InvalidJWT: "exp" claim timestamp check failed`.
function urlDocumentoCierre(path: string): string {
  return `/api/cierres/doc?path=${encodeURIComponent(path)}`;
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
  const [config, setConfig] = useState<CierresConfig>({ modo: "libre", dia_semana: null, dias_bloqueo: DIAS_BLOQUEO_DEFAULT, rol_excepcion_id: null });
  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  const [loading, setLoading] = useState(true);

  const [vista, setVista] = useState<"resumen" | "calendario" | "ajustes">("resumen");
  const [busqueda, setBusqueda] = useState("");
  // Filtros POR COLUMNA: cada cabecera de la tabla tiene su propio icono de
  // filtro con las opciones reales de esa columna. No hay botón de filtros
  // arriba: se filtra desde la columna que se quiere acotar.
  const [filtrosCol, setFiltrosCol] = useState<Record<string, Set<string>>>({});
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [mesActual, setMesActual] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [selected, setSelected] = useState<CierreRow | null>(null);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  // Dirección puede apuntar fuera de plazo; el resto no (salvo el rol
  // autorizado, que valida el servidor).
  const { esAdminPlataforma } = useAuth();

  const gastoKeyRef = useRef(0);
  const nuevaGastoFila = useCallback((): GastoFila => {
    gastoKeyRef.current += 1;
    return { key: `g-${gastoKeyRef.current}`, tipo: "", descripcion: "", importe: "" };
  }, []);

  const emptyForm = () => ({
    tipo: "cierre" as CierreTipo,
    // Sentido de la retirada: "salida" saca dinero de caja, "entrada" lo mete.
    // Por defecto sale (es el caso habitual: pagos, gastos...).
    retirada_sentido: "salida" as "salida" | "entrada",
    fecha: today,
    efectivo_retirado: "",
    total_contado: "",
    notas: "",
    registrado_por: "",
    files: [] as File[],
    gastos: [] as GastoFila[],
    // Qué se hace con la diferencia entre lo retirado y el total del cierre.
    // Solo se elige cuando hay descuadre; si cuadra no existe decisión que tomar.
    //   "descuadre" → se cierra con descuadre y la nota de motivos es obligatoria.
    //   "gastos"    → la diferencia se justifica declarando gastos.
    resolucion_descuadre: "" as "" | "descuadre" | "gastos",
  });
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Total de gastos apuntados en el formulario (en vivo).
  const totalGastosPreview = useMemo(
    () => form.gastos.reduce((s, g) => s + (Number((g.importe || "0").replace(",", ".")) || 0), 0),
    [form.gastos],
  );

  // Importe absoluto tecleado en el formulario (para la ayuda de la retirada).
  const importeRetiradaPreview = useMemo(
    () => Math.abs(Number((form.efectivo_retirado || "0").replace(",", ".")) || 0),
    [form.efectivo_retirado],
  );

  // Descuadre en vivo. Referencia = total cierre; descuadre = retirado − cierre.
  // Retirado > cierre → sobra (>0). Retirado < cierre → falta (<0). Igual → cuadra.
  const descuadrePreview = useMemo(() => {
    const efectivo = Number((form.efectivo_retirado || "0").replace(",", ".")) || 0;
    const contado = Number((form.total_contado || "0").replace(",", ".")) || 0;
    return Math.round((efectivo - contado) * 100) / 100;
  }, [form.efectivo_retirado, form.total_contado]);

  // ── Descuadre: cerrar con descuadre (nota obligatoria) o declarar gastos ──
  // Solo el cierre semanal tiene descuadre; retiradas e ingresos nunca lo tienen.
  const hayDescuadre = form.tipo === "cierre" && descuadrePreview !== 0;

  // SOBRA dinero (descuadre > 0): no se ha pagado nada, así que no hay gasto que
  // declarar. La única salida es cerrar con descuadre dejando por escrito el
  // justificante de por qué sobra. FALTA dinero (< 0): ahí sí puede deberse a
  // gastos pagados del efectivo, y se ofrecen las dos opciones.
  const sobraDinero = hayDescuadre && descuadrePreview > 0;

  // Los gastos SOLO se pueden declarar cuando FALTA dinero y se ha elegido
  // justificarlo con gastos. Si el cierre cuadra no hay nada que declarar.
  const puedeDeclararGastos = hayDescuadre && !sobraDinero && form.resolucion_descuadre === "gastos";

  // Cerrar con descuadre exige explicar por escrito los motivos que se creen.
  // Cuando sobra dinero es SIEMPRE obligatorio: es el justificante del sobrante.
  const notaMotivosObligatoria = hayDescuadre && (sobraDinero || form.resolucion_descuadre === "descuadre");

  // Los gastos declarados justifican la diferencia: tienen que sumar EXACTAMENTE
  // el descuadre, ni de más ni de menos. Se compara en valor absoluto porque los
  // importes se apuntan siempre en positivo.
  const objetivoGastos = Math.abs(descuadrePreview);

  // Diferencia entre lo declarado y lo que hay que justificar.
  // >0 sobran gastos · <0 faltan · 0 encaja.
  const diferenciaGastos = useMemo(
    () => Math.round((totalGastosPreview - objetivoGastos) * 100) / 100,
    [totalGastosPreview, objetivoGastos],
  );

  const gastosCuadran = puedeDeclararGastos && totalGastosPreview > 0 && diferenciaGastos === 0;

  // Al desaparecer el descuadre (o al cambiar de tipo) se limpian la decisión y
  // los gastos: quedarían huérfanos y el backend los rechazaría igualmente.
  useEffect(() => {
    if (hayDescuadre) return;
    setForm((f) =>
      f.resolucion_descuadre === "" && f.gastos.length === 0
        ? f
        : { ...f, resolucion_descuadre: "", gastos: [] },
    );
  }, [hayDescuadre]);

  // Si SOBRA dinero no hay elección posible: solo cabe cerrar con descuadre
  // dejando el justificante por escrito. Se fija la decisión y se tiran los gastos.
  useEffect(() => {
    if (!sobraDinero) return;
    setForm((f) =>
      f.resolucion_descuadre === "descuadre" && f.gastos.length === 0
        ? f
        : { ...f, resolucion_descuadre: "descuadre", gastos: [] },
    );
  }, [sobraDinero]);

  // Al pasar de "declarar gastos" a "cerrar con descuadre" se descartan los gastos.
  useEffect(() => {
    if (form.resolucion_descuadre === "gastos") return;
    setForm((f) => (f.gastos.length === 0 ? f : { ...f, gastos: [] }));
  }, [form.resolucion_descuadre]);

  // ── Guardia de caja: el efectivo acumulado NUNCA puede quedar por debajo de cero ──
  // No se puede sacar (retirada de salida / ingreso al banco) dinero que no hay en caja.

  // Efectivo disponible en la caja fuerte justo ANTES del movimiento que se está
  // tecleando (suma de todo lo registrado hasta su fecha, incluida).
  const saldoDisponible = useMemo(() => {
    if (!form.fecha) return 0;
    const suma = cierres
      .filter((c) => c.fecha <= form.fecha)
      .reduce((s, c) => s + importeEfectivo(c), 0);
    return Math.round(suma * 100) / 100;
  }, [cierres, form.fecha]);

  // Signo del movimiento en curso: ¿saca dinero de la caja?
  const movimientoSacaEfectivo = useMemo(() => {
    if (form.tipo === "ingreso") return true;
    if (form.tipo === "retirada") return form.retirada_sentido === "salida";
    return false; // el cierre siempre suma
  }, [form.tipo, form.retirada_sentido]);

  // Acumulado que quedaría si se guardase este movimiento.
  const acumuladoResultante = useMemo(
    () => Math.round((saldoDisponible + (movimientoSacaEfectivo ? -importeRetiradaPreview : importeRetiradaPreview)) * 100) / 100,
    [saldoDisponible, movimientoSacaEfectivo, importeRetiradaPreview],
  );

  // Mensaje de bloqueo (null = el movimiento es válido). Capa la UI y explica el porqué.
  const errorSaldo = useMemo(() => {
    if (!movimientoSacaEfectivo || importeRetiradaPreview <= 0) return null;
    const accion = form.tipo === "ingreso" ? "ingresar" : "retirar";
    if (saldoDisponible <= 0) {
      return `No hay efectivo acumulado en caja a esta fecha (${fmtEuro(saldoDisponible)}). `
        + `No puedes ${accion} ${fmtEuro(importeRetiradaPreview)} de un dinero que no tienes.`;
    }
    if (importeRetiradaPreview > saldoDisponible) {
      return `Solo hay ${fmtEuro(saldoDisponible)} de efectivo acumulado en caja. `
        + `No puedes ${accion} ${fmtEuro(importeRetiradaPreview)} porque dejaría el acumulado en ${fmtEuro(acumuladoResultante)}, y eso es imposible. `
        + `Como máximo puedes ${accion} ${fmtEuro(saldoDisponible)}.`;
    }
    // El movimiento cabe hoy, pero si va con fecha atrasada puede hundir días posteriores.
    let run = acumuladoResultante;
    const posteriores = [...cierres].filter((c) => c.fecha > form.fecha).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    for (const c of posteriores) {
      run = Math.round((run + importeEfectivo(c)) * 100) / 100;
      if (run < 0) {
        return `Este movimiento cuadra en su fecha, pero dejaría el acumulado en ${fmtEuro(run)} el ${c.fecha}, `
          + `y el efectivo acumulado nunca puede quedar por debajo de cero. Revisa la fecha o el importe.`;
      }
    }
    return null;
  }, [movimientoSacaEfectivo, importeRetiradaPreview, saldoDisponible, acumuladoResultante, form.tipo, form.fecha, cierres]);

  const [cfgForm, setCfgForm] = useState<CierresConfig>({ modo: "libre", dia_semana: null, dias_bloqueo: DIAS_BLOQUEO_DEFAULT, rol_excepcion_id: null });
  const [cfgSaving, setCfgSaving] = useState(false);

  // ¿La fecha elegida ya está fuera del plazo para apuntar?
  // (0 = sin bloqueo). El servidor manda; esto solo avisa en pantalla.
  const diasDeRetraso = useMemo(() => {
    if (!form.fecha) return 0;
    const msDia = 24 * 60 * 60 * 1000;
    const tHoy = Date.parse(`${today}T00:00:00Z`);
    const tApunte = Date.parse(`${form.fecha}T00:00:00Z`);
    if (!Number.isFinite(tHoy) || !Number.isFinite(tApunte)) return 0;
    return Math.round((tHoy - tApunte) / msDia);
  }, [form.fecha, today]);

  const fueraDePlazo = config.dias_bloqueo > 0 && diasDeRetraso > config.dias_bloqueo;

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

  // Sincronización en vivo: los cierres los graba cada local al terminar su
  // turno, así que la vista de gerencia los ve entrar solos. Se pausa con
  // cualquier formulario abierto para no pisar lo que se esté rellenando.
  useSincronizacionEnVivo({
    tablas: ["cierres_semanales", "cierres_gastos"],
    onCambio: () => void cargar(),
    pausado: modalOpen || detalleOpen || progModalOpen || !!selected,
  });

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
      acumuladoEfectivo += importeEfectivo(c);
      acumuladoGastos += c.total_gastos;
    });
    return { total, cuadran, descuadrados, saldoNeto, acumuladoEfectivo, acumuladoGastos };
  }, [cierres]);

  // Acumulado corriente por movimiento: running total cronológico del efectivo.
  // Cierre suma; ingreso resta; la retirada suma o resta según su signo guardado.
  // (cierres viene descendente; recorremos en orden ascendente para el running total.)
  const acumuladoPorId = useMemo(() => {
    const m: Record<string, number> = {};
    let run = 0;
    [...cierres].reverse().forEach((c) => {
      run += importeEfectivo(c);
      m[c.id] = run;
    });
    return m;
  }, [cierres]);

  // Valor con el que se filtra CADA columna: es exactamente el texto que se ve
  // en pantalla en esa celda, para que las opciones del filtro coincidan con la
  // tabla (importes formateados en euros, fechas escritas, badges de estado...).
  const valorColumna = useCallback(
    (c: CierreRow, campo: string): string => {
      switch (campo) {
        case "fecha":
          return format(parseISO(c.fecha), "dd MMM yyyy", { locale: es });
        case "tipo":
          return TIPO_LABEL[c.tipo];
        case "efectivo":
          return fmtEuro(importeEfectivo(c));
        case "total":
          return fmtEuro(c.total_contado);
        case "estado":
          return c.cuadra ? "Cuadra" : c.descuadre >= 0 ? "Sobra" : "Falta";
        case "descuadre":
          return c.cuadra ? "—" : fmtDescuadre(c.descuadre);
        case "gastos":
          return c.total_gastos > 0 ? fmtGasto(c.total_gastos) : "—";
        case "acumulado":
          return fmtEuro(acumuladoPorId[c.id] ?? 0);
        case "doc": {
          const n = (c.documentos?.length ?? 0) || (c.storage_path ? 1 : 0);
          return n > 0 ? "Con documento" : "Sin documento";
        }
        case "registrado_por":
          return (c.registrado_por ?? "").trim();
        default:
          return "";
      }
    },
    [acumuladoPorId],
  );

  // Cierres que pasan la búsqueda: base sobre la que se calculan las opciones
  // de cada filtro de columna (así solo se ofrecen valores que existen).
  const cierresBuscados = useMemo(
    () => cierres.filter((c) => coincideBusquedaUniversal(c, busqueda)),
    [cierres, busqueda],
  );

  // Filas finales: se aplican TODOS los filtros de columna a la vez (una fila
  // pasa si cumple cada columna filtrada; dentro de una columna vale cualquiera
  // de los valores marcados).
  const cierresFiltrados = useMemo(() => {
    const activos = Object.entries(filtrosCol).filter(([, v]) => v.size > 0);
    if (activos.length === 0) return cierresBuscados;
    return cierresBuscados.filter((c) =>
      activos.every(([campo, valores]) => valores.has(valorColumna(c, campo))),
    );
  }, [cierresBuscados, filtrosCol, valorColumna]);

  // Opciones de cada columna, sacadas de los datos reales y sin repetir.
  const opcionesColumna = useCallback(
    (campo: string): string[] => {
      const set = new Set<string>();
      cierresBuscados.forEach((c) => {
        const v = valorColumna(c, campo);
        if (v) set.add(v);
      });
      const lista = [...set];
      // Las columnas de dinero y fecha se ordenan por su valor real, no como texto.
      if (campo === "fecha") {
        const fechaDe = new Map<string, string>();
        cierresBuscados.forEach((c) => fechaDe.set(valorColumna(c, "fecha"), c.fecha));
        return lista.sort((a, b) => (fechaDe.get(b) ?? "").localeCompare(fechaDe.get(a) ?? ""));
      }
      if (["efectivo", "total", "descuadre", "gastos", "acumulado"].includes(campo)) {
        const numDe = new Map<string, number>();
        cierresBuscados.forEach((c) => numDe.set(valorColumna(c, campo), numeroColumna(c, campo, acumuladoPorId)));
        return lista.sort((a, b) => (numDe.get(a) ?? 0) - (numDe.get(b) ?? 0));
      }
      return lista.sort((a, b) => a.localeCompare(b, "es"));
    },
    [cierresBuscados, valorColumna, acumuladoPorId],
  );

  const setFiltroColumna = useCallback((campo: string, valores: Set<string>) => {
    setFiltrosCol((prev) => {
      const next = { ...prev };
      if (valores.size === 0) delete next[campo];
      else next[campo] = valores;
      return next;
    });
  }, []);

  const columnasDef: ToolbarColumna[] = [
    { campo: "fecha", label: "Fecha", bloqueada: true },
    { campo: "tipo", label: "Tipo" },
    { campo: "efectivo", label: "Efectivo retirado" },
    { campo: "total", label: "Total cierre" },
    { campo: "estado", label: "Estado" },
    { campo: "descuadre", label: "Descuadre" },
    { campo: "gastos", label: "Gastos" },
    { campo: "acumulado", label: "Acumulado" },
    { campo: "doc", label: "Doc." },
  ];
  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  // Cabecera de columna: el título más su propio icono de filtro. TODAS las
  // columnas de la tabla se pueden filtrar desde aquí, cada una con sus valores.
  const cabecera = (campo: string, label: string, derecha = false) => (
    <TableHead key={campo} className={derecha ? "text-right" : undefined}>
      <div className={`inline-flex items-center gap-1.5 ${derecha ? "justify-end" : ""}`}>
        <span>{label}</span>
        <ColumnFilter
          label={label}
          options={opcionesColumna(campo)}
          selected={filtrosCol[campo] ?? EMPTY_SET}
          onChange={(next) => setFiltroColumna(campo, next)}
        />
      </div>
    </TableHead>
  );

  const headDe: Record<string, ReactNode> = {
    fecha: cabecera("fecha", "Fecha"),
    tipo: cabecera("tipo", "Tipo"),
    efectivo: cabecera("efectivo", "Efectivo retirado", true),
    total: cabecera("total", "Total cierre", true),
    estado: cabecera("estado", "Estado"),
    descuadre: cabecera("descuadre", "Descuadre", true),
    gastos: cabecera("gastos", "Gastos", true),
    acumulado: cabecera("acumulado", "Acumulado", true),
    doc: cabecera("doc", "Doc."),
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
    efectivo: (
      <TableCell key="efectivo" className={`text-right ${importeEfectivo(c) < 0 ? "text-red-700" : ""}`}>
        {fmtEuro(importeEfectivo(c))}
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
          <Badge className={`gap-1 ${c.descuadre >= 0 ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-red-100 text-red-800 border-red-300"}`}>
            <AlertTriangle className="h-3 w-3" />
            {c.descuadre >= 0 ? "Sobra" : "Falta"}
          </Badge>
        )}
      </TableCell>
    ),
    descuadre: (
      <TableCell key="descuadre" className={`text-right font-medium ${c.descuadre === 0 ? "text-muted-foreground" : c.descuadre > 0 ? "text-emerald-700" : "text-red-700"}`}>
        {c.cuadra ? "—" : fmtDescuadre(c.descuadre)}
      </TableCell>
    ),
    gastos: (
      <TableCell key="gastos" className={`text-right ${c.total_gastos > 0 ? "text-red-700 font-medium" : "text-muted-foreground"}`}>
        {c.total_gastos > 0 ? fmtGasto(c.total_gastos) : "—"}
      </TableCell>
    ),
    acumulado: (
      <TableCell key="acumulado" className={`text-right font-semibold ${(acumuladoPorId[c.id] ?? 0) < 0 ? "text-red-700" : "text-emerald-700"}`}>
        {fmtEuro(acumuladoPorId[c.id] ?? 0)}
      </TableCell>
    ),
    doc: (() => {
      const numDocs = c.documentos?.length ?? 0;
      // Se enlaza el path (no la URL firmada al cargar la lista): la firma se
      // genera en el clic, así nunca llega caducada (InvalidJWT).
      const pathDirecto = numDocs === 1 ? c.documentos[0].path : numDocs === 0 ? c.storage_path : null;
      const urlDirecta = pathDirecto ? urlDocumentoCierre(pathDirecto) : null;
      return (
        <TableCell key="doc">
          {numDocs > 1 ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelected(c); setDetalleOpen(true); }}
              className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
            >
              <FileText className="h-3 w-3" /> Ver {numDocs}
            </button>
          ) : urlDirecta ? (
            <a
              href={urlDirecta}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
            >
              <FileText className="h-3 w-3" /> Ver
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      );
    })(),
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
    // Aviso temprano de fuera de plazo. El candado de verdad está en el
    // servidor (que además conoce el rol autorizado); esto solo evita el
    // viaje inútil y explica el motivo al momento.
    if (fueraDePlazo && !esAdminPlataforma) {
      toast.error(
        `Fuera de plazo: no se pueden apuntar movimientos con más de ${config.dias_bloqueo} ${config.dias_bloqueo === 1 ? "día" : "días"} de retraso. Solo dirección puede.`,
      );
      return;
    }
    // Quién apunta el movimiento es obligatorio: todo cierre queda con responsable.
    if (!form.registrado_por.trim()) {
      toast.error("Indica quién apunta el cierre: es obligatorio");
      return;
    }
    // Cierres e ingresos exigen al menos un justificante adjunto (la retirada no).
    if (form.tipo !== "retirada" && form.files.length === 0) {
      toast.error(`Debes adjuntar un documento para registrar ${form.tipo === "ingreso" ? "un ingreso" : "un cierre"}`);
      return;
    }
    // Con descuadre hay que decidir qué se hace con la diferencia.
    if (hayDescuadre) {
      // Si SOBRA dinero no hay gastos que declarar: solo el justificante escrito.
      if (sobraDinero) {
        if (!form.notas.trim()) {
          toast.error(`Escribe el justificante de por qué sobran ${fmtEuro(descuadrePreview)}: es obligatorio`);
          return;
        }
      } else if (!form.resolucion_descuadre) {
        toast.error("Hay descuadre: elige si cierras con descuadre o si declaras gastos");
        return;
      }
      if (!sobraDinero && form.resolucion_descuadre === "descuadre" && !form.notas.trim()) {
        toast.error("Explica en las notas los motivos del descuadre: es obligatorio");
        return;
      }
      if (form.resolucion_descuadre === "gastos") {
        const totalGastos = Math.round(totalGastosPreview * 100) / 100;
        if (totalGastos <= 0) {
          toast.error("Has elegido declarar gastos: añade al menos un gasto con importe");
          return;
        }
        // Todo gasto con importe tiene que llevar tipo elegido de la lista.
        const sinTipo = form.gastos.some(
          (g) => (Number((g.importe || "0").replace(",", ".")) || 0) !== 0 && !g.tipo,
        );
        if (sinTipo) {
          toast.error("Elige el tipo de gasto en todas las líneas que tengan importe");
          return;
        }
        // Los gastos declarados tienen que cubrir la diferencia EXACTAMENTE.
        if (diferenciaGastos !== 0) {
          toast.error(
            `Los gastos suman ${fmtEuro(totalGastos)} y la diferencia del cierre es ${fmtEuro(objetivoGastos)}. `
            + `Tienen que coincidir exactamente: ${diferenciaGastos > 0 ? `sobran ${fmtEuro(diferenciaGastos)}` : `faltan ${fmtEuro(-diferenciaGastos)}`}.`,
          );
          return;
        }
      }
    }
    // El efectivo acumulado nunca puede quedar por debajo de cero.
    if (errorSaldo) {
      toast.error(errorSaldo);
      return;
    }
    setSaving(true);
    try {
      // 1) Subida DIRECTA de los adjuntos al bucket con URL firmada.
      //    Salta el límite de 4.5 MB de las Server Actions (fotos de móvil, PDF grandes).
      const documentosSubidos: Array<{ path: string; name: string; size: number; mime: string | null }> = [];
      if (form.files.length > 0) {
        const urls = await crearUrlsSubidaCierre(
          form.files.map((f) => ({ name: f.name, type: f.type })),
        );
        if (!urls.ok) {
          toast.error(urls.error ?? "No se pudo preparar la subida de documentos");
          setSaving(false);
          return;
        }
        const supabase = createSupabaseBrowser();
        for (let i = 0; i < form.files.length; i++) {
          const file = form.files[i];
          const dest = urls.data[i];
          const { error: upErr } = await supabase.storage
            .from("cierres-documentos")
            .uploadToSignedUrl(dest.path, dest.token, file, {
              contentType: file.type || "application/octet-stream",
            });
          if (upErr) {
            console.error("[cierres] subida directa:", upErr.message);
            toast.error(`No se pudo subir "${file.name}". Inténtalo de nuevo.`);
            setSaving(false);
            return;
          }
          documentosSubidos.push({
            path: dest.path,
            name: file.name,
            size: file.size,
            mime: file.type || null,
          });
        }
      }

      // 2) Crear el cierre con los metadatos de los documentos ya subidos.
      const fd = new FormData();
      fd.append("tipo", form.tipo);
      fd.append("fecha", form.fecha);
      fd.append("efectivo_retirado", form.efectivo_retirado || "0");
      // En la retirada el sentido decide el signo con el que se guarda el importe.
      if (form.tipo === "retirada") fd.append("retirada_sentido", form.retirada_sentido);
      // Total contado y gastos solo aplican al cierre semanal.
      if (form.tipo === "cierre") {
        fd.append("total_contado", form.total_contado || "0");
        // Qué se hace con la diferencia (solo tiene efecto si hay descuadre).
        if (hayDescuadre) fd.append("resolucion_descuadre", form.resolucion_descuadre);
      }
      // El descuadre lo calcula el backend (retirado − cierre); no se envía a mano.
      fd.append("notas", form.notas);
      fd.append("registrado_por", form.registrado_por);
      // Los gastos solo viajan si hay descuadre y se eligió justificarlo con gastos.
      if (puedeDeclararGastos) {
        // Gastos declarados: se descartan filas totalmente vacías.
        const gastosPayload: CierreGasto[] = form.gastos
          .map((g) => ({
            tipo: g.tipo.trim(),
            descripcion: g.descripcion.trim(),
            importe: Number((g.importe || "0").replace(",", ".")) || 0,
          }))
          .filter((g) => g.tipo || g.descripcion || g.importe !== 0);
        if (gastosPayload.length > 0) fd.append("gastos", JSON.stringify(gastosPayload));
      }
      if (documentosSubidos.length > 0) fd.append("documentos", JSON.stringify(documentosSubidos));

      const res = await createCierre(fd);
      if (res.ok) {
        toast.success(
          form.tipo === "retirada"
            ? (form.retirada_sentido === "entrada"
                ? "Retirada registrada: entra dinero en caja"
                : "Retirada registrada: sale dinero de caja")
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
      if (!res.ok) {
        toast.error(res.error ?? "Error al guardar ajustes");
        return;
      }

      // Sincroniza la programación automática para que el "Día prefijado"
      // se refleje en el calendario (crea/actualiza/desactiva la regla semanal).
      const progAuto = programaciones.find((p) => p.nombre === PROG_AUTO_NOMBRE);
      if (payload.modo === "fijo") {
        const progRes = await upsertCierreProgramacion({
          id: progAuto?.id,
          nombre: PROG_AUTO_NOMBRE,
          intervalo_semanas: 1,
          dias_semana: [payload.dia_semana as number],
          fecha_inicio: progAuto?.fecha_inicio ?? today,
          fecha_fin: null,
          activo: true,
        });
        if (!progRes.ok) {
          toast.error(progRes.error ?? "Error al programar el día en el calendario");
          return;
        }
      } else if (progAuto?.activo) {
        // Modo libre: la regla automática deja de pintar el calendario.
        await upsertCierreProgramacion({
          id: progAuto.id,
          nombre: progAuto.nombre,
          intervalo_semanas: progAuto.intervalo_semanas,
          dias_semana: progAuto.dias_semana,
          fecha_inicio: progAuto.fecha_inicio,
          fecha_fin: progAuto.fecha_fin,
          activo: false,
        });
      }

      toast.success("Ajustes guardados");
      // El plazo para apuntar no se toca aquí (vive en Ajustes → Deptos →
      // Gerencia → Cierres): se conserva tal cual estaba.
      setConfig((c) => ({ ...c, ...payload }));
      cargar();
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
              <p className={`text-2xl font-bold ${resumen.acumuladoEfectivo < 0 ? "text-red-700" : "text-emerald-700"}`}>
                {fmtEuro(resumen.acumuladoEfectivo)}
              </p>
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
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${resumen.saldoNeto >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
              <Wallet className={`h-5 w-5 ${resumen.saldoNeto >= 0 ? "text-emerald-600" : "text-red-600"}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${resumen.saldoNeto >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {fmtDescuadre(resumen.saldoNeto)}
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
              <p className="text-2xl font-bold text-red-700">{fmtGasto(resumen.acumuladoGastos)}</p>
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
                          // El importe con signo real sobre la caja: cierre suma, ingreso resta,
                          // y la retirada suma o resta según cómo se registró.
                          const importeConSigno = importeEfectivo(c);
                          const esNegativo = importeConSigno < 0;
                          return (
                          <div key={c.id} className="text-[10px] leading-tight">
                            <span className={`font-medium ${esNegativo ? "text-red-700" : ""}`}>{fmtEuro(importeConSigno)}</span>
                            {!c.cuadra && (
                              <span className={`ml-1 ${c.descuadre >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                ({fmtDescuadre(c.descuadre)})
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
              {fueraDePlazo && (
                <p className={`text-xs mt-1.5 ${esAdminPlataforma ? "text-amber-700" : "text-red-600"}`}>
                  {esAdminPlataforma
                    ? `Fecha atrasada ${diasDeRetraso} días (el plazo es ${config.dias_bloqueo}). Puedes apuntarla porque eres dirección.`
                    : `Fuera de plazo: ${diasDeRetraso} días de retraso y el máximo son ${config.dias_bloqueo}. Solo dirección puede apuntar aquí.`}
                </p>
              )}
            </div>
            <div>
              <Label>
                Apuntado por
                <span className="text-red-600"> *</span>
              </Label>
              <Select
                value={form.registrado_por || undefined}
                onValueChange={(v) => setForm({ ...form, registrado_por: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un empleado" />
                </SelectTrigger>
                <SelectContent>
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
              {!form.registrado_por && (
                <p className="text-xs text-red-600 mt-1">
                  Obligatorio: indica quién apunta el cierre.
                </p>
              )}
            </div>

            <div className={form.tipo === "retirada" ? "col-span-2" : undefined}>
              <Label>
                {form.tipo === "retirada"
                  ? "Importe del movimiento (€)"
                  : form.tipo === "ingreso"
                    ? "Ingreso en banco (€)"
                    : "Efectivo retirado del cajón (€)"}
              </Label>

              {/* En la retirada el dinero puede salir o entrar: se elige con estos
                  dos botones. El importe se teclea siempre en positivo. */}
              {form.tipo === "retirada" && (
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1 mb-2">
                  {([
                    { value: "salida" as const, label: "Sale dinero (−)", icon: ArrowUpFromLine, activeClass: "bg-background text-red-700 shadow-sm" },
                    { value: "entrada" as const, label: "Entra dinero (+)", icon: ArrowDownToLine, activeClass: "bg-background text-emerald-700 shadow-sm" },
                  ]).map((s) => {
                    const activo = form.retirada_sentido === s.value;
                    const Icono = s.icon;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, retirada_sentido: s.value }))}
                        className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                          activo ? s.activeClass : "text-muted-foreground hover:text-foreground"
                        }`}
                        aria-pressed={activo}
                      >
                        <Icono className="h-4 w-4" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}

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
                  {form.retirada_sentido === "salida"
                    ? `Dinero que sale de la caja fuerte (pagos, gastos...). Se restará del acumulado: ${fmtEuro(-importeRetiradaPreview)}.`
                    : `Dinero que entra en la caja fuerte (devoluciones, reintegros...). Se sumará al acumulado: ${fmtEuro(importeRetiradaPreview)}.`}
                </p>
              )}
              {form.tipo === "ingreso" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Efectivo que sale de la caja fuerte y se ingresa en el banco.
                </p>
              )}

              {/* Guardia de caja: disponible en vivo y bloqueo si el acumulado quedaría negativo. */}
              {movimientoSacaEfectivo && (
                <p className="text-xs text-muted-foreground mt-1">
                  Efectivo acumulado disponible a esta fecha: <strong>{fmtEuro(saldoDisponible)}</strong>.
                </p>
              )}
              {errorSaldo && (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorSaldo}</span>
                </div>
              )}
            </div>
            {form.tipo === "cierre" && (
              <div>
                <Label>Total cierre (€)</Label>
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

            {/* Descuadre calculado automáticamente = retirado − cierre */}
            {form.tipo === "cierre" && (
            <div className="col-span-2">
              <Label className="mb-2 block">Descuadre (calculado automáticamente)</Label>
              <div
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  descuadrePreview === 0
                    ? "bg-emerald-50 border-emerald-200"
                    : descuadrePreview > 0
                      ? "bg-emerald-50 border-emerald-200"
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
                      <ArrowUpFromLine className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-800">Sobra dinero</span>
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
                        ? "text-emerald-700"
                        : "text-red-700"
                  }`}
                >
                  {fmtDescuadre(descuadrePreview)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Se calcula solo: efectivo retirado − total cierre. Si retiras más de lo que marca el cierre, sobra.
              </p>
            </div>
            )}

            {/* Cuando SOBRA dinero no hay elección: no se ha pagado nada, así que no
                hay gasto que declarar. Solo cabe dejar el justificante por escrito. */}
            {sobraDinero && (
            <div className="col-span-2">
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <ArrowUpFromLine className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Sobran {fmtEuro(descuadrePreview)}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Cuando sobra dinero no se declaran gastos: no se ha pagado nada. El cierre se
                    guarda con descuadre y hay que dejar por escrito el justificante de por qué sobra.
                  </p>
                </div>
              </div>
            </div>
            )}

            {/* Qué se hace con la diferencia: cerrar con descuadre o declarar gastos.
                Solo cuando FALTA dinero; si sobra o cuadra no hay nada que elegir. */}
            {hayDescuadre && !sobraDinero && (
            <div className="col-span-2">
              <Label className="mb-2 block">¿Qué hacemos con la diferencia? *</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  {
                    value: "descuadre" as const,
                    titulo: "Cerrar con descuadre",
                    ayuda: "La diferencia queda como descuadre. Hay que explicar los motivos en las notas.",
                    icon: AlertTriangle,
                  },
                  {
                    value: "gastos" as const,
                    titulo: "Declarar gastos",
                    ayuda: "La diferencia se justifica con gastos pagados del efectivo.",
                    icon: Receipt,
                  },
                ]).map((op) => {
                  const activo = form.resolucion_descuadre === op.value;
                  const Icono = op.icon;
                  return (
                    <button
                      key={op.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, resolucion_descuadre: op.value }))}
                      className={`rounded-lg border p-3 text-left transition ${
                        activo
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:border-muted-foreground/40"
                      }`}
                      aria-pressed={activo}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Icono className="h-4 w-4 text-muted-foreground" />
                        {op.titulo}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{op.ayuda}</span>
                    </button>
                  );
                })}
              </div>
              {!form.resolucion_descuadre && (
                <p className="text-xs text-red-600 mt-1">
                  Obligatorio: el cierre no cuadra, elige una de las dos opciones.
                </p>
              )}
            </div>
            )}

            {/* Gastos declarados: solo cuando hay descuadre y se eligió justificarlo con gastos. */}
            {puedeDeclararGastos && (
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  Gastos declarados
                </Label>
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addGasto}>
                  <Plus className="h-3.5 w-3.5" /> Añadir gasto
                </Button>
              </div>

              {form.gastos.length === 0 ? (
                <p className="text-xs text-red-600 rounded-lg border border-dashed border-red-200 px-4 py-4 text-center">
                  Obligatorio: añade gastos que sumen exactamente {fmtEuro(objetivoGastos)}, la diferencia del cierre.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.gastos.map((g) => (
                    <div key={g.key} className="flex items-start gap-2">
                      <Select
                        value={g.tipo}
                        onValueChange={(v) => updateGasto(g.key, "tipo", v)}
                      >
                        <SelectTrigger className="w-[28%]">
                          <SelectValue placeholder="Tipo de gasto" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_GASTO.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                  {/* Los gastos tienen que sumar EXACTAMENTE la diferencia del cierre. */}
                  <div
                    className={`rounded-lg border px-4 py-2 ${
                      gastosCuadran ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total gastos</span>
                      <span className={`text-sm font-bold ${gastosCuadran ? "text-emerald-700" : "text-red-700"}`}>
                        {fmtEuro(totalGastosPreview)} de {fmtEuro(objetivoGastos)}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 ${gastosCuadran ? "text-emerald-700" : "text-red-600"}`}>
                      {gastosCuadran
                        ? "Los gastos cubren exactamente la diferencia del cierre."
                        : diferenciaGastos > 0
                          ? `Sobran ${fmtEuro(diferenciaGastos)}: los gastos tienen que sumar exactamente ${fmtEuro(objetivoGastos)}.`
                          : `Faltan ${fmtEuro(-diferenciaGastos)}: los gastos tienen que sumar exactamente ${fmtEuro(objetivoGastos)}.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
            )}

            {form.tipo !== "retirada" && (
            <div className="col-span-2">
              <Label>
                {form.tipo === "ingreso"
                  ? "Documentos del ingreso (PDF, imagen, etc.)"
                  : "Documentos del cierre (PDF, imagen, etc.)"}
                <span className="text-red-600"> *</span>
              </Label>
              <Input
                type="file"
                multiple
                disabled={form.files.length >= MAX_DOCUMENTOS_CIERRE}
                onChange={(e) => {
                  const nuevos = Array.from(e.target.files ?? []);
                  if (nuevos.length === 0) return;
                  // Bloquea archivos que superen el tope: se avisa y NO se adjuntan.
                  const grandes = nuevos.filter((n) => n.size > MAX_TAMANO_DOCUMENTO_BYTES);
                  const validos = nuevos.filter((n) => n.size <= MAX_TAMANO_DOCUMENTO_BYTES);
                  if (grandes.length > 0) {
                    const nombres = grandes.map((g) => `"${g.name}" (${fmtSize(g.size)})`).join(", ");
                    toast.error(
                      `${grandes.length === 1 ? "El archivo" : "Los archivos"} ${nombres} ${grandes.length === 1 ? "supera" : "superan"} el máximo de ${MAX_TAMANO_DOCUMENTO_MB} MB y no se ${grandes.length === 1 ? "ha" : "han"} adjuntado`,
                    );
                  }
                  if (validos.length > 0) {
                    setForm((f) => {
                      // Evita duplicados por nombre+tamaño y respeta el tope de documentos.
                      const combinados = [...f.files];
                      let excedido = false;
                      for (const n of validos) {
                        if (combinados.some((x) => x.name === n.name && x.size === n.size)) continue;
                        if (combinados.length >= MAX_DOCUMENTOS_CIERRE) { excedido = true; break; }
                        combinados.push(n);
                      }
                      if (excedido) {
                        toast.error(`Puedes adjuntar como máximo ${MAX_DOCUMENTOS_CIERRE} documentos`);
                      }
                      return { ...f, files: combinados };
                    });
                  }
                  // Limpia el input para permitir volver a seleccionar el mismo archivo.
                  e.target.value = "";
                }}
              />
              {form.files.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {form.files.map((f, i) => (
                    <div key={`${f.name}-${f.size}-${i}`} className="flex items-center justify-between rounded-md border px-2 py-1">
                      <span className="flex items-center gap-2 text-xs truncate">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{f.name}</span>
                        <span className="text-muted-foreground shrink-0">· {fmtSize(f.size)}</span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => setForm((prev) => ({ ...prev, files: prev.files.filter((_, idx) => idx !== i) }))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    {form.files.length} de {MAX_DOCUMENTOS_CIERRE} documentos
                  </p>
                </div>
              ) : (
                <p className="text-xs text-red-600 mt-1">
                  Obligatorio: adjunta al menos un justificante (hasta {MAX_DOCUMENTOS_CIERRE}) para poder guardar.
                </p>
              )}
            </div>
            )}

            <div className="col-span-2">
              <Label>
                {sobraDinero
                  ? "Justificante del sobrante"
                  : notaMotivosObligatoria
                    ? "Motivos del descuadre"
                    : "Notas / Observaciones"}
                {notaMotivosObligatoria && <span className="text-red-600"> *</span>}
              </Label>
              <Textarea
                rows={3}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder={
                  sobraDinero
                    ? "Escribe por qué sobra el dinero..."
                    : notaMotivosObligatoria
                      ? "Explica a qué se cree que se debe la diferencia..."
                      : "Cualquier comentario sobre el cierre..."
                }
              />
              {notaMotivosObligatoria && !form.notas.trim() && (
                <p className="text-xs text-red-600 mt-1">
                  {sobraDinero
                    ? `Obligatorio: escribe el justificante de por qué sobran ${fmtEuro(descuadrePreview)}.`
                    : "Obligatorio: explica los motivos que se creen del descuadre."}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              onClick={handleGuardar}
              disabled={
                !form.fecha
                || saving
                || !!errorSaldo
                || !form.registrado_por.trim()
                || (hayDescuadre && !sobraDinero && !form.resolucion_descuadre)
                || (notaMotivosObligatoria && !form.notas.trim())
                || (puedeDeclararGastos && (totalGastosPreview <= 0 || diferenciaGastos !== 0))
              }
            >
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
                <NumberInput
                  min={1}
                  max={52}
                  decimales={false}
                  emptyValue={1}
                  className="w-20"
                  value={progForm.intervalo_semanas}
                  onValueChange={(v) =>
                    setProgForm({ ...progForm, intervalo_semanas: Math.round(v) })
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
                  {TIPO_LABEL[selected.tipo]} del {format(parseISO(selected.fecha), "EEEE d 'de' MMMM yyyy", { locale: es })}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${TIPO_BADGE_CLASS[selected.tipo]}`}>
                    {TIPO_LABEL[selected.tipo]}
                  </Badge>
                  {selected.tipo === "cierre" && (
                    selected.cuadra ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Cuadra
                      </Badge>
                    ) : (
                      <Badge className={`gap-1 ${selected.descuadre >= 0 ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-red-100 text-red-800 border-red-300"}`}>
                        <AlertTriangle className="h-3 w-3" />
                        {selected.descuadre >= 0 ? "Sobra" : "Falta"}: {fmtDescuadre(selected.descuadre)}
                      </Badge>
                    )
                  )}
                  {selected.semana_iso && (
                    <Badge variant="outline" className="text-xs">{selected.semana_iso}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {selected.tipo === "retirada" ? "Importe del movimiento" : "Efectivo retirado"}
                    </Label>
                    <p className={`text-base font-semibold ${importeEfectivo(selected) < 0 ? "text-red-700" : ""}`}>
                      {fmtEuro(importeEfectivo(selected))}
                    </p>
                    {selected.tipo === "retirada" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {importeEfectivo(selected) < 0 ? "Sale dinero de caja" : "Entra dinero en caja"}
                      </p>
                    )}
                  </div>
                  {selected.tipo === "cierre" && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Total cierre</Label>
                      <p className="text-base font-semibold">{fmtEuro(selected.total_contado)}</p>
                    </div>
                  )}
                  {selected.tipo === "cierre" && !selected.cuadra && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Descuadre</Label>
                      <p className={`text-base font-semibold ${selected.descuadre >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {fmtDescuadre(selected.descuadre)}
                      </p>
                    </div>
                  )}
                  {selected.registrado_por && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Registrado por</Label>
                      <p className="text-sm">{selected.registrado_por}</p>
                    </div>
                  )}
                  {selected.created_at && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Fecha de registro</Label>
                      <p className="text-sm">{format(parseISO(selected.created_at), "dd MMM yyyy, HH:mm", { locale: es })}</p>
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
                          <span className="text-sm font-medium shrink-0 text-red-700">{fmtGasto(g.importe)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
                        <span className="text-sm font-medium">Total gastos</span>
                        <span className="text-sm font-bold text-red-700">{fmtGasto(selected.total_gastos)}</span>
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

                {(selected.documentos.length > 0 || selected.storage_path) && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {selected.documentos.length > 1 ? "Documentos" : "Documento"}
                    </Label>
                    {(selected.documentos.length > 0
                      ? selected.documentos
                      : [{ name: selected.file_name ?? "Documento del cierre", size: selected.size_bytes ?? 0, path: selected.storage_path ?? "" }]
                    ).map((doc, i) => (
                      <div key={i} className="rounded-lg border p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name || "Documento del cierre"}</p>
                            <p className="text-xs text-muted-foreground">{fmtSize(doc.size)}</p>
                          </div>
                        </div>
                        {doc.path && (
                          <Button asChild size="sm" variant="outline" className="shrink-0">
                            <a href={urlDocumentoCierre(doc.path)} target="_blank" rel="noreferrer">
                              <Download className="h-3.5 w-3.5 mr-1" /> Abrir
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
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

/* ─── FILTRO DE COLUMNA ─── */
// Icono de filtro que vive en la cabecera de CADA columna de la tabla. Abre un
// desplegable con los valores reales de esa columna y checkboxes para marcar
// los que se quieren ver. Sin nada marcado, la columna no filtra; en cuanto se
// marca algo, el icono se enciende para que se vea que hay un filtro puesto.
function ColumnFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const active = selected.size > 0;
  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex h-5 w-5 items-center justify-center rounded transition ${
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground/60 hover:bg-muted hover:text-foreground"
          }`}
          title={`Filtrar ${label.toLowerCase()}`}
        >
          <ListFilter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-[10px] font-bold tracking-wider text-muted-foreground">{label}</p>
          {active && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="text-[10px] font-semibold text-primary hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>
        <ul className="max-h-64 overflow-y-auto py-1">
          {options.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">Sin opciones</li>
          ) : (
            options.map((opt) => (
              <li key={opt}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-muted/50">
                  <Checkbox checked={selected.has(opt)} onCheckedChange={() => toggle(opt)} />
                  <span className="text-sm">{opt}</span>
                </label>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
