"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSincronizacionEnVivo } from "@/shared/hooks/useSincronizacionEnVivo";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/shared/components/NumberInput";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SubmoduleToolbar,
  ordenarColumnas,
  colVisible,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import {
  ArrowLeft,
  ShieldAlert,
  Send,
  FileWarning,
  CheckCircle2,
  Clock,
  XCircle,
  ListFilter,
  MoreHorizontal,
  Eye,
  Download,
  RefreshCw,
  Ban,
} from "lucide-react";
import { listEmpleadosParaComunicado, type EmpleadoSelector } from "@/features/gerencia/actions/comunicados-actions";
import {
  crearSancionDisciplinaria,
  listSancionesDisciplinarias,
  getEmpresaDeLaSancion,
  type SancionResumen,
} from "@/features/gerencia/actions/sancion-disciplinaria-actions";
import {
  getVisorOriginalUrl,
  getVisorFirmadoUrl,
  getDescargaFirmadoUrl,
  reenviarFirma,
  cancelarFirma,
} from "@/features/rrhh/actions/firmas-actions";
import type { GravedadSancion } from "@/features/gerencia/services/sancion-disciplinaria-pdf";

/** Letra y trazo del menú de acciones: el mismo que en el resto del software. */
const ITEM_MENU = "cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold tracking-tight";

/**
 * Las tres calificaciones que admite la ley, cada una con su plazo de
 * prescripción (art. 60.2 del Estatuto de los Trabajadores): la falta prescribe
 * a esos días DESDE QUE LA EMPRESA TUVO CONOCIMIENTO de ella y, en todo caso, a
 * los seis meses de haberse cometido.
 */
const GRAVEDAD_OPCIONES: { value: GravedadSancion; label: string; className: string; prescribeDias: number }[] = [
  { value: "leve", label: "Falta leve", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", prescribeDias: 10 },
  { value: "grave", label: "Falta grave", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", prescribeDias: 20 },
  { value: "muy_grave", label: "Falta muy grave", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", prescribeDias: 60 },
];

const GRAVEDAD_BARRA: Record<GravedadSancion, string> = {
  leve: "#d98c0d",
  grave: "#dc4d15",
  muy_grave: "#c71c1c",
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fecha siempre en día/mes/año, la regla del software. */
function fmtFechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const ESTADO_CFG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pendiente: { label: "Pendiente de firma", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Clock },
  firmado: { label: "Firmada", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: CheckCircle2 },
  // Se negó a firmarla: queda informado, con día y hora, y el documento se
  // archiva marcado NO FIRMADO. Se lee en rojo, no como un «leído» cualquiera.
  leido: { label: "No firmada", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
  rechazado: { label: "Rechazada", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
  expirado: { label: "Expirada", className: "bg-muted text-muted-foreground", icon: XCircle },
};

function estadoLabel(estado: string): string {
  return ESTADO_CFG[estado]?.label ?? estado;
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado] ?? { label: estado, className: "bg-muted text-muted-foreground", icon: Clock };
  const Icon = cfg.icon;
  return <Badge className={`${cfg.className} border-0 font-medium gap-1`}><Icon className="h-3 w-3" />{cfg.label}</Badge>;
}

function gravedadLabel(g: GravedadSancion | null): string {
  return GRAVEDAD_OPCIONES.find(o => o.value === g)?.label ?? "—";
}

/** Filtro dentro de la cabecera de la columna, con los valores reales que hay. */
function ColumnFilter({ label, options, selected, onChange }: {
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
            active ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:bg-muted hover:text-foreground"
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
            <button type="button" onClick={() => onChange(new Set())} className="text-[10px] font-semibold text-primary hover:underline">
              Limpiar
            </button>
          )}
        </div>
        <ul className="max-h-64 overflow-y-auto py-1">
          {options.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">Sin opciones</li>
          ) : (
            options.map(opt => (
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

/** La empresa tal y como se imprime en la sanción (Ajustes → Empresa). */
interface EmpresaSancion {
  nombre: string;
  razonSocial: string;
  cif: string | null;
  domicilio: string | null;
}

interface SancionForm {
  empleadoId: string;
  gravedad: GravedadSancion;
  fechaHechos: string;
  hechos: string;
  fechaEmision: string;
  plazoDias: number;
}

const emptyForm: SancionForm = {
  empleadoId: "",
  gravedad: "grave",
  fechaHechos: "",
  hechos: "",
  fechaEmision: hoyISO(),
  plazoDias: 15,
};

/** Aviso de qué es esto: el mismo texto en el listado y al redactarla. */
function AvisoAcuseRecibo() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex gap-2">
      <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
        La sanción se envía al trabajador para que la firme como <strong>acuse de recibo (leído/informado)</strong>.
        No requiere su conformidad. No sale en sus comunicados: le llega por correo y aviso, aparece en RRHH → Firmas y,
        una vez firmada, queda guardada para siempre en su carpeta «Sanciones» de documentos.
      </p>
    </div>
  );
}

/** Prototipo visual de la sanción — refleja el PDF que firmará el trabajador. */
function PrototipoSancion({ form, empleado, empresa }: {
  form: SancionForm;
  empleado: EmpleadoSelector | null;
  empresa: EmpresaSancion | null;
}) {
  const gravLabel = GRAVEDAD_OPCIONES.find(g => g.value === form.gravedad)?.label ?? "";
  const barra = GRAVEDAD_BARRA[form.gravedad];
  const nombre = empleado ? `${empleado.nombre} ${empleado.apellidos}`.trim() : "—";
  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden text-zinc-900 dark:text-zinc-100">
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block h-4 w-11 rounded-sm" style={{ background: barra }} />
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: barra }}>{gravLabel}</span>
        </div>
        <h1 className="text-lg font-bold leading-tight">COMUNICACIÓN DE SANCIÓN DISCIPLINARIA</h1>
        {/* Quien sanciona es la SOCIEDAD, no el rótulo del local: es lo que sale
            impreso, tal cual está en Ajustes → Empresa. */}
        <p className="text-xs text-muted-foreground mt-1">
          {empresa ? `${empresa.razonSocial}${empresa.cif ? ` · NIF ${empresa.cif}` : ""}` : "—"}
        </p>
        {empresa?.domicilio && <p className="text-[11px] text-muted-foreground">{empresa.domicilio}</p>}
      </div>
      <Separator />
      <div className="px-6 py-4 space-y-3 text-sm">
        <Campo label="Trabajador/a" value={`${nombre}${(empleado?.puesto ?? empleado?.rolLabel) ? ` · ${empleado?.puesto ?? empleado?.rolLabel}` : ""}`} />
        <Campo label="Departamento" value={empleado?.departamento || "—"} />
        <Campo label="Calificación de la falta" value={gravLabel} />
        <Campo label="Fecha de los hechos" value={fmtFechaCorta(form.fechaHechos || null)} />
        <CampoParrafo label="Hechos que motivan la sanción" value={form.hechos} />
        <Separator />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Mediante la firma de este documento, el trabajador/a declara haber sido <strong>informado/a</strong> y
          haber recibido la presente comunicación. La firma constituye únicamente <strong>acuse de recibo y de
          lectura</strong>; NO implica conformidad ni aceptación de los hechos. El
          trabajador/a puede impugnar esta sanción ante el Juzgado de lo Social en el plazo de veinte días
          hábiles desde su notificación (art. 114 de la Ley Reguladora de la Jurisdicción Social), previa
          presentación de la papeleta de conciliación cuando proceda.
        </p>
        <Campo
          label="Emitido por"
          value={`La dirección de ${empresa?.razonSocial ?? "la empresa"} · ${fmtFechaCorta(form.fechaEmision)}`}
        />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Firma del trabajador/a (leído y recibido)</p>
          <div className="h-16 rounded-md border border-dashed flex items-center justify-center text-[11px] text-muted-foreground">
            Firma manuscrita en el momento de la lectura
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

function CampoParrafo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{value || <span className="text-muted-foreground italic">Pendiente de redactar…</span>}</p>
    </div>
  );
}

/**
 * Redacción de una sanción nueva. Se abre desde «Nuevo» del listado, igual que
 * un comunicado: a la izquierda la ficha y a la derecha, en vivo, el documento
 * tal y como le llegará al trabajador.
 */
function SancionEditor({ empleados, empresa, onVolver, onEnviada }: {
  empleados: EmpleadoSelector[];
  empresa: EmpresaSancion | null;
  onVolver: () => void;
  onEnviada: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<SancionForm>(emptyForm);
  const [enviando, setEnviando] = useState(false);
  const u = (patch: Partial<SancionForm>) => setForm(f => ({ ...f, ...patch }));

  const empleadoSel = useMemo(
    () => empleados.find(e => e.userId === form.empleadoId) ?? null,
    [empleados, form.empleadoId],
  );

  const puedeEnviar =
    !!form.empleadoId && !!form.hechos.trim() && !!form.fechaHechos && !!form.fechaEmision && !enviando;

  /**
   * Aviso de PRESCRIPCIÓN (art. 60.2 ET). No bloquea: el plazo corre desde que
   * la empresa tuvo conocimiento de los hechos, y eso solo lo sabe quien la
   * emite. Pero si la fecha que ha puesto ya se pasa de plazo, tiene que verlo
   * antes de mandarla.
   */
  const prescripcion = useMemo(() => {
    if (!form.fechaHechos) return null;
    const opcion = GRAVEDAD_OPCIONES.find(g => g.value === form.gravedad);
    if (!opcion) return null;
    const hechos = new Date(`${form.fechaHechos}T00:00:00`);
    const dias = Math.floor((Date.now() - hechos.getTime()) / 86_400_000);
    if (Number.isNaN(dias) || dias < 0) return null;
    if (dias > 180) {
      return `Han pasado ${dias} días desde los hechos. Pasados seis meses la falta prescribe en todo caso (art. 60.2 del Estatuto de los Trabajadores).`;
    }
    if (dias > opcion.prescribeDias) {
      return `Han pasado ${dias} días desde los hechos. Una ${opcion.label.toLowerCase()} prescribe a los ${opcion.prescribeDias} días desde que la empresa tuvo conocimiento de ella (art. 60.2 del Estatuto de los Trabajadores).`;
    }
    return null;
  }, [form.fechaHechos, form.gravedad]);

  const enviar = async () => {
    if (!puedeEnviar) {
      toast.error("Completa trabajador, fecha de los hechos y los hechos");
      return;
    }
    setEnviando(true);
    try {
      const res = await crearSancionDisciplinaria({
        empleadoId: form.empleadoId,
        gravedad: form.gravedad,
        fechaHechos: form.fechaHechos,
        hechos: form.hechos,
        fechaEmision: form.fechaEmision,
        plazoDias: form.plazoDias,
      });
      if (res.ok) {
        toast.success(res.emailEnviado ? "Sanción enviada al trabajador para firma" : "Sanción creada (revisa el email del trabajador)");
        await onEnviada();
        onVolver();
      } else {
        toast.error(res.error || "No se pudo emitir la sanción");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onVolver}><ArrowLeft className="h-4 w-4 mr-1" />Volver</Button>
        <Separator orientation="vertical" className="h-5" />
        <h2 className="text-sm font-bold">Nueva sanción disciplinaria</h2>
      </div>

      <AvisoAcuseRecibo />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ficha */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Trabajador sancionado</Label>
              <Select value={form.empleadoId} onValueChange={v => u({ empleadoId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona al trabajador…" /></SelectTrigger>
                <SelectContent>
                  {empleados.map(e => {
                    const extra = [e.puesto ?? e.rolLabel, e.departamento].filter(Boolean).join(" · ");
                    return (
                      <SelectItem key={e.userId} value={e.userId}>
                        {e.nombre} {e.apellidos}
                        {extra && <span className="text-muted-foreground">{" — "}{extra}</span>}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Calificación de la falta</Label>
                <Select value={form.gravedad} onValueChange={v => u({ gravedad: v as GravedadSancion })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRAVEDAD_OPCIONES.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fecha de los hechos</Label>
                <Input type="date" value={form.fechaHechos} onChange={e => u({ fechaHechos: e.target.value })} className="mt-1" />
              </div>
            </div>

            {prescripcion && (
              <p className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                {prescripcion}
              </p>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Hechos que motivan la sanción</Label>
              <Textarea
                value={form.hechos}
                onChange={e => u({ hechos: e.target.value })}
                rows={5}
                placeholder="Describe con detalle los hechos, fechas y circunstancias que motivan la sanción…"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Fecha de emisión</Label>
                <Input type="date" value={form.fechaEmision} onChange={e => u({ fechaEmision: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Plazo de firma (días)</Label>
                <NumberInput
                  min={1}
                  max={60}
                  decimales={false}
                  emptyValue={15}
                  value={form.plazoDias}
                  onValueChange={v => u({ plazoDias: v })}
                  className="mt-1"
                />
              </div>
            </div>

            <Button onClick={enviar} disabled={!puedeEnviar} className="w-full">
              <Send className="h-4 w-4 mr-1" />
              {enviando ? "Enviando…" : "Enviar"}
            </Button>
          </CardContent>
        </Card>

        {/* Así le llega */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><FileWarning className="h-3.5 w-3.5" />Así verá y firmará el trabajador la sanción</p>
          <PrototipoSancion form={form} empleado={empleadoSel} empresa={empresa} />
        </div>
      </div>
    </div>
  );
}

export function SancionDisciplinariaView() {
  const { confirm, dialog: dialogoConfirmar } = useConfirmDelete();
  const [modo, setModo] = useState<"list" | "nueva">("list");
  const [empleados, setEmpleados] = useState<EmpleadoSelector[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaSancion | null>(null);
  const [sanciones, setSanciones] = useState<SancionResumen[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [fTrabajador, setFTrabajador] = useState<Set<string>>(new Set());
  const [fDepartamento, setFDepartamento] = useState<Set<string>>(new Set());
  const [fFalta, setFFalta] = useState<Set<string>>(new Set());
  const [fEstado, setFEstado] = useState<Set<string>>(new Set());
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);

  const load = useCallback(async () => {
    const [emps, sancs, empr] = await Promise.all([
      listEmpleadosParaComunicado(),
      listSancionesDisciplinarias(),
      getEmpresaDeLaSancion(),
    ]);
    if (emps.ok) setEmpleados(emps.data);
    if (sancs.ok) setSanciones(sancs.data);
    if (empr.ok) setEmpresa(empr.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Sincronizacion en vivo: una sancion registrada o firmada por otro
  // responsable aparece sin recargar.
  useSincronizacionEnVivo({
    tablas: ["firmas_documentos"],
    onCambio: () => void load(),
  });

  // La búsqueda acota primero; los filtros de columna se alimentan de lo que
  // queda, para no ofrecer valores que no están en la tabla.
  const buscadas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return sanciones;
    return sanciones.filter(s =>
      s.empleadoNombre.toLowerCase().includes(q) ||
      s.departamento.toLowerCase().includes(q) ||
      s.resumen.toLowerCase().includes(q) ||
      estadoLabel(s.estado).toLowerCase().includes(q),
    );
  }, [sanciones, busqueda]);

  const filtradas = useMemo(() => buscadas.filter(s =>
    (fTrabajador.size === 0 || fTrabajador.has(s.empleadoNombre)) &&
    (fDepartamento.size === 0 || fDepartamento.has(s.departamento)) &&
    (fFalta.size === 0 || fFalta.has(gravedadLabel(s.gravedad))) &&
    (fEstado.size === 0 || fEstado.has(estadoLabel(s.estado))),
  ), [buscadas, fTrabajador, fDepartamento, fFalta, fEstado]);

  const opciones = (valores: string[]) => Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b, "es"));

  const abrir = async (accion: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>) => {
    const res = await accion();
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  };

  const reenviar = async (s: SancionResumen) => {
    const ok = await confirm({
      title: "Reenviar la sanción",
      description: `Se vuelve a mandar a ${s.empleadoNombre} el correo con el enlace para firmarla.`,
      confirmLabel: "Aceptar",
      tono: "normal",
    });
    if (!ok) return;
    const res = await reenviarFirma(s.id);
    if (res.ok) {
      toast.success(res.emailEnviado ? "Sanción reenviada" : "Reenviada (revisa el email del trabajador)");
      await load();
    } else {
      toast.error(res.error);
    }
  };

  const cancelar = async (s: SancionResumen) => {
    const ok = await confirm({
      title: "Cancelar la sanción",
      description: `La sanción de ${s.empleadoNombre} quedará anulada y el enlace de firma dejará de funcionar.`,
      confirmLabel: "Cancelar sanción",
    });
    if (!ok) return;
    const res = await cancelarFirma(s.id);
    if (res.ok) {
      toast.success("Sanción cancelada");
      await load();
    } else {
      toast.error(res.error);
    }
  };

  if (modo === "nueva") {
    return (
      <SancionEditor
        empleados={empleados}
        empresa={empresa}
        onVolver={() => setModo("list")}
        onEnviada={load}
      />
    );
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "trabajador", label: "Trabajador", bloqueada: true },
    { campo: "departamento", label: "Departamento" },
    { campo: "falta", label: "Falta" },
    { campo: "resumen", label: "Sanción" },
    { campo: "estado", label: "Estado" },
    { campo: "enviada", label: "Enviada" },
    { campo: "firmada", label: "Cerrada" },
  ];

  const columnDefs: Record<string, { th: React.ReactNode; td: (s: SancionResumen) => React.ReactNode }> = {
    trabajador: {
      th: (
        <TableHead key="trabajador">
          <span className="inline-flex items-center gap-1">
            Trabajador
            <ColumnFilter label="Trabajador" options={opciones(buscadas.map(s => s.empleadoNombre))} selected={fTrabajador} onChange={setFTrabajador} />
          </span>
        </TableHead>
      ),
      td: s => <TableCell key="trabajador" className="font-medium">{s.empleadoNombre}</TableCell>,
    },
    departamento: {
      th: (
        <TableHead key="departamento">
          <span className="inline-flex items-center gap-1">
            Departamento
            <ColumnFilter label="Departamento" options={opciones(buscadas.map(s => s.departamento))} selected={fDepartamento} onChange={setFDepartamento} />
          </span>
        </TableHead>
      ),
      td: s => <TableCell key="departamento" className="text-muted-foreground">{s.departamento}</TableCell>,
    },
    falta: {
      th: (
        <TableHead key="falta">
          <span className="inline-flex items-center gap-1">
            Falta
            <ColumnFilter label="Falta" options={opciones(buscadas.map(s => gravedadLabel(s.gravedad)))} selected={fFalta} onChange={setFFalta} />
          </span>
        </TableHead>
      ),
      td: s => (
        <TableCell key="falta">
          {s.gravedad ? (
            <Badge className={`${GRAVEDAD_OPCIONES.find(g => g.value === s.gravedad)?.className} border-0 font-medium`}>
              {gravedadLabel(s.gravedad)}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      ),
    },
    resumen: {
      th: <TableHead key="resumen">Sanción</TableHead>,
      td: s => (
        <TableCell key="resumen" className="max-w-[22rem] truncate text-sm text-muted-foreground" title={s.resumen}>
          {s.resumen || "—"}
        </TableCell>
      ),
    },
    estado: {
      th: (
        <TableHead key="estado">
          <span className="inline-flex items-center gap-1">
            Estado
            <ColumnFilter label="Estado" options={opciones(buscadas.map(s => estadoLabel(s.estado)))} selected={fEstado} onChange={setFEstado} />
          </span>
        </TableHead>
      ),
      td: s => <TableCell key="estado"><EstadoBadge estado={s.estado} /></TableCell>,
    },
    enviada: {
      th: <TableHead key="enviada">Enviada</TableHead>,
      td: s => <TableCell key="enviada" className="text-muted-foreground whitespace-nowrap">{fmtFechaCorta(s.enviadoEn)}</TableCell>,
    },
    firmada: {
      th: <TableHead key="firmada">Cerrada</TableHead>,
      td: s => <TableCell key="firmada" className="text-muted-foreground whitespace-nowrap">{s.firmadoEn ? fmtFechaCorta(s.firmadoEn) : "—"}</TableCell>,
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    c => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="space-y-4">
      <AvisoAcuseRecibo />

      <SubmoduleToolbar
        viewKey="gerencia-comunicados-sanciones"
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={() => setModo("nueva")}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {columnasRender.map(c => columnDefs[c.campo]?.th)}
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map(s => (
              <TableRow key={s.id}>
                {columnasRender.map(c => columnDefs[c.campo]?.td(s))}
                <TableCell>
                  <div className="flex items-center justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-lg">
                        <DropdownMenuItem className={ITEM_MENU} onClick={() => void abrir(() => getVisorOriginalUrl(s.id))}>
                          <Eye className="h-4 w-4" strokeWidth={1.75} />Ver la sanción
                        </DropdownMenuItem>
                        {/* «leido» = la cerró sin firmarla: ese PDF también existe,
                            con el NO FIRMADO en rojo y su acta detrás. */}
                        {(s.estado === "firmado" || s.estado === "leido") && (
                          <>
                            <DropdownMenuItem className={ITEM_MENU} onClick={() => void abrir(() => getVisorFirmadoUrl(s.id))}>
                              <Eye className="h-4 w-4" strokeWidth={1.75} />
                              {s.estado === "firmado" ? "Ver la firmada" : "Ver la no firmada"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className={ITEM_MENU} onClick={() => void abrir(() => getDescargaFirmadoUrl(s.id))}>
                              <Download className="h-4 w-4" strokeWidth={1.75} />Descargar con el acta
                            </DropdownMenuItem>
                          </>
                        )}
                        {s.estado === "pendiente" && (
                          <>
                            <DropdownMenuItem className={ITEM_MENU} onClick={() => void reenviar(s)}>
                              <RefreshCw className="h-4 w-4" strokeWidth={1.75} />Reenviar
                            </DropdownMenuItem>
                            <DropdownMenuItem className={`${ITEM_MENU} text-red-600 focus:text-red-600`} onClick={() => void cancelar(s)}>
                              <Ban className="h-4 w-4" strokeWidth={1.75} />Cancelar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnasRender.length + 1} className="text-center text-muted-foreground py-8">
                  {sanciones.length === 0 ? "Aún no se ha emitido ninguna sanción disciplinaria" : "Ninguna sanción coincide con la búsqueda"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {dialogoConfirmar}
    </div>
  );
}
