"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  CalendarDays, List, Plus, ChevronLeft, ChevronRight, Wallet, FileText,
  Settings, Trash2, Download, CheckCircle2, AlertTriangle, ArrowDownToLine,
  ArrowUpFromLine, Clock,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths,
  subMonths, isSameDay, parseISO, addDays, addWeeks, startOfDay,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listCierres, createCierre, deleteCierre, getCierresConfig, updateCierresConfig,
  type CierreRow, type CierresConfig, type CierreModo,
} from "@/features/gerencia/actions/cierres-actions";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

const DIAS_SEMANA = [
  { value: 0, label: "Lunes" },
  { value: 1, label: "Martes" },
  { value: 2, label: "Miércoles" },
  { value: 3, label: "Jueves" },
  { value: 4, label: "Viernes" },
  { value: 5, label: "Sábado" },
  { value: 6, label: "Domingo" },
];

function fmtEuro(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
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

export function CierresView() {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const [cierres, setCierres] = useState<CierreRow[]>([]);
  const [config, setConfig] = useState<CierresConfig>({ modo: "libre", dia_semana: null });
  const [loading, setLoading] = useState(true);

  const [vista, setVista] = useState<"resumen" | "calendario" | "ajustes">("resumen");
  const [mesActual, setMesActual] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [selected, setSelected] = useState<CierreRow | null>(null);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const emptyForm = () => ({
    fecha: today,
    efectivo_retirado: "",
    total_contado: "",
    cuadra: true,
    descuadre: "",
    descuadre_signo: "negativo" as "positivo" | "negativo",
    notas: "",
    registrado_por: "",
    file: null as File | null,
  });
  const [form, setForm] = useState(emptyForm());

  const [cfgForm, setCfgForm] = useState<CierresConfig>({ modo: "libre", dia_semana: null });
  const [cfgSaving, setCfgSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([listCierres(), getCierresConfig()]);
      if (a.ok) setCierres(a.data);
      if (b.ok) {
        setConfig(b.data);
        setCfgForm(b.data);
      }
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

  const ultimosCierres = useMemo(() => cierres.slice(0, 5), [cierres]);

  // Próximos cierres: solo si modo='fijo'
  const proximosCierres = useMemo(() => {
    if (config.modo !== "fijo" || config.dia_semana === null) return [];
    const out: { fecha: Date; key: string; yaRegistrado: boolean }[] = [];
    let cursor = startOfDay(new Date());
    let safety = 0;
    while (out.length < 5 && safety < 50) {
      safety++;
      if (jsDayToLunFirst(cursor) === config.dia_semana) {
        const key = format(cursor, "yyyy-MM-dd");
        const yaRegistrado = !!cierresPorFecha[key];
        out.push({ fecha: cursor, key, yaRegistrado });
        cursor = addWeeks(cursor, 1);
      } else {
        cursor = addDays(cursor, 1);
      }
    }
    return out;
  }, [config, cierresPorFecha]);

  const resumen = useMemo(() => {
    const total = cierres.length;
    let cuadran = 0;
    let descuadrados = 0;
    let saldoNeto = 0;
    cierres.forEach((c) => {
      if (c.cuadra) cuadran++;
      else descuadrados++;
      saldoNeto += c.descuadre;
    });
    return { total, cuadran, descuadrados, saldoNeto };
  }, [cierres]);

  // ── Handlers ──────────────────────────────────────────
  const abrirNuevo = (fecha?: string) => {
    const f = emptyForm();
    if (fecha) f.fecha = fecha;
    setForm(f);
    setModalOpen(true);
  };

  const handleGuardar = async () => {
    if (!form.fecha) {
      toast.error("La fecha es obligatoria");
      return;
    }
    const fd = new FormData();
    fd.append("fecha", form.fecha);
    fd.append("efectivo_retirado", form.efectivo_retirado || "0");
    fd.append("total_contado", form.total_contado || "0");
    fd.append("cuadra", form.cuadra ? "true" : "false");
    if (!form.cuadra) {
      const raw = Number((form.descuadre || "0").replace(",", ".")) || 0;
      const abs = Math.abs(raw);
      const signed = form.descuadre_signo === "positivo" ? abs : -abs;
      fd.append("descuadre", String(signed));
    } else {
      fd.append("descuadre", "0");
    }
    fd.append("notas", form.notas);
    fd.append("registrado_por", form.registrado_por);
    if (form.file) fd.append("file", form.file);

    const res = await createCierre(fd);
    if (res.ok) {
      toast.success("Cierre registrado");
      setModalOpen(false);
      setForm(emptyForm());
      cargar();
    } else {
      toast.error(res.error ?? "Error al registrar el cierre");
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

  // ── Calendario ─────────────────────────────────────────
  const inicioMes = startOfMonth(mesActual);
  const finMes = endOfMonth(mesActual);
  const diasMes = eachDayOfInterval({ start: inicioMes, end: finMes });
  const offsetInicio = jsDayToLunFirst(inicioMes);

  return (
    <div className="p-6 space-y-6">
      {confirmDeleteDialog}
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cierres semanales</h1>
          <p className="text-sm text-muted-foreground">
            Registro semanal del cierre de caja con documento adjunto y control de descuadres.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config.modo === "fijo" && config.dia_semana !== null && (
            <Badge variant="outline" className="gap-1 px-2 py-1">
              <Clock className="h-3 w-3" />
              Día prefijado: {DIAS_SEMANA[config.dia_semana].label}
            </Badge>
          )}
          {config.modo === "libre" && (
            <Badge variant="outline" className="gap-1 px-2 py-1">
              Día libre
            </Badge>
          )}
          <Button variant="primary" size="lg" onClick={() => abrirNuevo()}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo cierre
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>

      {/* Tabs principales */}
      <Tabs value={vista} onValueChange={(v) => setVista(v as typeof vista)}>
        <TabsList>
          <TabsTrigger value="resumen" className="gap-1.5"><List className="h-4 w-4" /> Resumen</TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Calendario</TabsTrigger>
          <TabsTrigger value="ajustes" className="gap-1.5"><Settings className="h-4 w-4" /> Ajustes</TabsTrigger>
        </TabsList>

        {/* ── RESUMEN ── */}
        <TabsContent value="resumen" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Próximos cierres */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Próximos cierres</h3>
                  {config.modo === "fijo" && config.dia_semana !== null ? (
                    <Badge variant="secondary" className="text-xs">
                      Cada {DIAS_SEMANA[config.dia_semana].label.toLowerCase()}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Sin día prefijado</Badge>
                  )}
                </div>
                {proximosCierres.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {config.modo === "libre"
                      ? "No hay día prefijado. Configúralo en Ajustes para ver los próximos."
                      : "No hay próximos cierres programados."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {proximosCierres.map((p) => (
                      <div
                        key={p.key}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 ${p.yaRegistrado ? "bg-emerald-50/50 border-emerald-200" : "bg-background"}`}
                      >
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {format(p.fecha, "EEEE d 'de' MMMM", { locale: es })}
                          </p>
                          <p className="text-xs text-muted-foreground">{format(p.fecha, "yyyy-MM-dd")}</p>
                        </div>
                        {p.yaRegistrado ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Registrado
                          </Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => abrirNuevo(p.key)}>
                            <Plus className="h-3 w-3 mr-1" /> Registrar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Últimos cierres */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold">Últimos cierres</h3>
                {ultimosCierres.length === 0 ? (
                  loading ? (
                    <LoadingSpinner className="py-6" />
                  ) : (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Aún no hay cierres registrados.
                    </p>
                  )
                ) : (
                  <div className="space-y-2">
                    {ultimosCierres.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 cursor-pointer"
                        onClick={() => { setSelected(c); setDetalleOpen(true); }}
                      >
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {format(parseISO(c.fecha), "EEEE d MMM yyyy", { locale: es })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Efectivo retirado: {fmtEuro(c.efectivo_retirado)}
                          </p>
                        </div>
                        {c.cuadra ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Cuadra
                          </Badge>
                        ) : (
                          <Badge className={`gap-1 ${c.descuadre >= 0 ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-red-100 text-red-800 border-red-300"}`}>
                            {c.descuadre >= 0 ? <ArrowUpFromLine className="h-3 w-3" /> : <ArrowDownToLine className="h-3 w-3" />}
                            {fmtEuro(c.descuadre)}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabla completa */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Semana</TableHead>
                  <TableHead className="text-right">Efectivo retirado</TableHead>
                  <TableHead className="text-right">Total contado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Descuadre</TableHead>
                  <TableHead>Doc.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cierres.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      {loading ? <LoadingSpinner /> : "No hay cierres registrados aún"}
                    </TableCell>
                  </TableRow>
                )}
                {cierres.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setSelected(c); setDetalleOpen(true); }}
                  >
                    <TableCell className="font-medium">
                      {format(parseISO(c.fecha), "dd MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.semana_iso ?? "—"}</TableCell>
                    <TableCell className="text-right">{fmtEuro(c.efectivo_retirado)}</TableCell>
                    <TableCell className="text-right">{fmtEuro(c.total_contado)}</TableCell>
                    <TableCell>
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
                    <TableCell className={`text-right font-medium ${c.descuadre === 0 ? "text-muted-foreground" : c.descuadre > 0 ? "text-amber-700" : "text-red-700"}`}>
                      {c.cuadra ? "—" : fmtEuro(c.descuadre)}
                    </TableCell>
                    <TableCell>
                      {c.url ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          <FileText className="h-3 w-3" /> Sí
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
                {config.modo === "fijo" && config.dia_semana !== null && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-blue-100 border border-blue-300 ring-1 ring-blue-300" />
                    Día prefijado de cierre
                  </div>
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
                  const esDiaPrefijado = config.modo === "fijo"
                    && config.dia_semana !== null
                    && jsDayToLunFirst(dia) === config.dia_semana;

                  let bg = "bg-background";
                  if (tieneCierre && cuadra) bg = "bg-emerald-100";
                  else if (tieneCierre && !cuadra) bg = "bg-amber-100";
                  else if (esDiaPrefijado) bg = "bg-blue-50";

                  return (
                    <div
                      key={key}
                      className={`relative ${bg} p-2 min-h-[90px] cursor-pointer transition hover:brightness-95 ${esHoy ? "ring-2 ring-primary/40 ring-inset" : ""} ${esDiaPrefijado && !tieneCierre ? "ring-1 ring-blue-300 ring-inset" : ""}`}
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
                        {items.slice(0, 2).map((c) => (
                          <div key={c.id} className="text-[10px] leading-tight">
                            <span className="font-medium">{fmtEuro(c.efectivo_retirado)}</span>
                            {!c.cuadra && (
                              <span className={`ml-1 ${c.descuadre >= 0 ? "text-amber-700" : "text-red-700"}`}>
                                ({c.descuadre >= 0 ? "+" : ""}{fmtEuro(c.descuadre)})
                              </span>
                            )}
                          </div>
                        ))}
                        {items.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{items.length - 2} más</span>
                        )}
                        {!tieneCierre && esDiaPrefijado && (
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
        <TabsContent value="ajustes" className="mt-4">
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
            <DialogTitle>Registrar cierre semanal</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <Label>Fecha del cierre *</Label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <Label>Registrado por</Label>
              <Input
                value={form.registrado_por}
                onChange={(e) => setForm({ ...form, registrado_por: e.target.value })}
                placeholder="Opcional"
              />
            </div>

            <div>
              <Label>Efectivo retirado del cajón (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.efectivo_retirado}
                onChange={(e) => setForm({ ...form, efectivo_retirado: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Total contado en caja (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.total_contado}
                onChange={(e) => setForm({ ...form, total_contado: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="col-span-2">
              <Label className="mb-2 block">¿Coincide el cierre con lo contado?</Label>
              <RadioGroup
                value={form.cuadra ? "si" : "no"}
                onValueChange={(v) => setForm({ ...form, cuadra: v === "si" })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="si" id="cuadra-si" />
                  <Label htmlFor="cuadra-si" className="cursor-pointer">Sí, cuadra</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="cuadra-no" />
                  <Label htmlFor="cuadra-no" className="cursor-pointer">No, hay descuadre</Label>
                </div>
              </RadioGroup>
            </div>

            {!form.cuadra && (
              <>
                <div>
                  <Label>Cantidad del descuadre (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.descuadre}
                    onChange={(e) => setForm({ ...form, descuadre: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Signo del descuadre</Label>
                  <RadioGroup
                    value={form.descuadre_signo}
                    onValueChange={(v) => setForm({ ...form, descuadre_signo: v as "positivo" | "negativo" })}
                    className="flex gap-4 pt-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="positivo" id="desc-pos" />
                      <Label htmlFor="desc-pos" className="cursor-pointer flex items-center gap-1">
                        <ArrowUpFromLine className="h-3 w-3 text-amber-600" />
                        Positivo (sobra)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="negativo" id="desc-neg" />
                      <Label htmlFor="desc-neg" className="cursor-pointer flex items-center gap-1">
                        <ArrowDownToLine className="h-3 w-3 text-red-600" />
                        Negativo (falta)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}

            <div className="col-span-2">
              <Label>Documento del cierre (PDF, imagen, etc.)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              />
              {form.file && (
                <p className="text-xs text-muted-foreground mt-1">
                  {form.file.name} · {fmtSize(form.file.size)}
                </p>
              )}
            </div>

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
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={!form.fecha}>Guardar cierre</Button>
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
