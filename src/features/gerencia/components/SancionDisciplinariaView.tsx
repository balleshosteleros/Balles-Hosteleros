"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ShieldAlert, Send, FileWarning, CheckCircle2, Clock, XCircle } from "lucide-react";
import { listEmpleadosParaComunicado, type EmpleadoSelector } from "@/features/gerencia/actions/comunicados-actions";
import {
  crearSancionDisciplinaria,
  listSancionesDisciplinarias,
  type SancionResumen,
} from "@/features/gerencia/actions/sancion-disciplinaria-actions";
import type { GravedadSancion } from "@/features/gerencia/services/sancion-disciplinaria-pdf";

const GRAVEDAD_OPCIONES: { value: GravedadSancion; label: string; className: string }[] = [
  { value: "leve", label: "Falta leve", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "grave", label: "Falta grave", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "muy_grave", label: "Falta muy grave", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const GRAVEDAD_BARRA: Record<GravedadSancion, string> = {
  leve: "#d98c0d",
  grave: "#dc4d15",
  muy_grave: "#c71c1c",
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtFechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    pendiente: { label: "Pendiente de firma", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Clock },
    firmado: { label: "Firmada (leído)", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: CheckCircle2 },
    rechazado: { label: "Rechazada", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
    expirado: { label: "Expirada", className: "bg-muted text-muted-foreground", icon: XCircle },
  };
  const cfg = map[estado] ?? { label: estado, className: "bg-muted text-muted-foreground", icon: Clock };
  const Icon = cfg.icon;
  return <Badge className={`${cfg.className} border-0 font-medium gap-1`}><Icon className="h-3 w-3" />{cfg.label}</Badge>;
}

interface SancionForm {
  empleadoId: string;
  gravedad: GravedadSancion;
  fechaHechos: string;
  hechos: string;
  normaInfringida: string;
  medida: string;
  fechaEmision: string;
  plazoDias: number;
}

const emptyForm: SancionForm = {
  empleadoId: "",
  gravedad: "grave",
  fechaHechos: "",
  hechos: "",
  normaInfringida: "",
  medida: "",
  fechaEmision: hoyISO(),
  plazoDias: 15,
};

/** Prototipo visual de la sanción — refleja el PDF que firmará el trabajador. */
function PrototipoSancion({ form, empleado, empresaNombre }: {
  form: SancionForm;
  empleado: EmpleadoSelector | null;
  empresaNombre: string;
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
        <p className="text-xs text-muted-foreground mt-1">{empresaNombre || "La empresa"}</p>
      </div>
      <Separator />
      <div className="px-6 py-4 space-y-3 text-sm">
        <Campo label="Trabajador/a" value={`${nombre}${empleado?.rolLabel ? ` · ${empleado.rolLabel}` : ""}`} />
        <Campo label="Departamento" value={empleado?.departamento || "—"} />
        <Campo label="Calificación de la falta" value={gravLabel} />
        <Campo label="Fecha de los hechos" value={fmtFechaCorta(form.fechaHechos || null)} />
        <CampoParrafo label="Hechos que motivan la sanción" value={form.hechos} />
        {form.normaInfringida.trim() && <CampoParrafo label="Norma / convenio infringido" value={form.normaInfringida} />}
        <CampoParrafo label="Medida disciplinaria adoptada" value={form.medida} />
        <Separator />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Mediante la firma de este documento, el trabajador/a declara haber sido <strong>informado/a</strong> y
          haber recibido la presente comunicación. La firma constituye únicamente <strong>acuse de recibo y de
          lectura</strong>; NO implica conformidad ni aceptación de los hechos ni de la medida adoptada. El
          trabajador/a conserva su derecho a impugnar la sanción por los cauces legales previstos.
        </p>
        <Campo label="Emitido por" value={`${empresaNombre || "La dirección"} · ${fmtFechaCorta(form.fechaEmision)}`} />
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

export function SancionDisciplinariaView() {
  const { empresaActual } = useEmpresa();
  const empresaNombre = empresaActual?.nombre || "";
  const [empleados, setEmpleados] = useState<EmpleadoSelector[]>([]);
  const [sanciones, setSanciones] = useState<SancionResumen[]>([]);
  const [form, setForm] = useState<SancionForm>(emptyForm);
  const [enviando, setEnviando] = useState(false);

  const u = (patch: Partial<SancionForm>) => setForm(f => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    const [emps, sancs] = await Promise.all([
      listEmpleadosParaComunicado(),
      listSancionesDisciplinarias(),
    ]);
    if (emps.ok) setEmpleados(emps.data);
    if (sancs.ok) setSanciones(sancs.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const empleadoSel = useMemo(
    () => empleados.find(e => e.userId === form.empleadoId) ?? null,
    [empleados, form.empleadoId],
  );

  const puedeEnviar = !!form.empleadoId && !!form.hechos.trim() && !!form.medida.trim() && !!form.fechaEmision && !enviando;

  const enviar = async () => {
    if (!puedeEnviar) {
      toast.error("Completa trabajador, hechos y medida disciplinaria");
      return;
    }
    setEnviando(true);
    try {
      const res = await crearSancionDisciplinaria({
        empleadoId: form.empleadoId,
        gravedad: form.gravedad,
        fechaHechos: form.fechaHechos || null,
        hechos: form.hechos,
        normaInfringida: form.normaInfringida || null,
        medida: form.medida,
        fechaEmision: form.fechaEmision,
        plazoDias: form.plazoDias,
      });
      if (res.ok) {
        toast.success(res.emailEnviado ? "Sanción enviada al trabajador para firma" : "Sanción creada (revisa el email del trabajador)");
        setForm({ ...emptyForm, fechaEmision: hoyISO() });
        await load();
      } else {
        toast.error(res.error || "No se pudo emitir la sanción");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
          La sanción se envía al trabajador para que la firme como <strong>acuse de recibo (leído/informado)</strong>.
          No requiere su conformidad. Una vez firmada, queda guardada de forma permanente en sus documentos personales.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Trabajador sancionado</Label>
              <Select value={form.empleadoId} onValueChange={v => u({ empleadoId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona al trabajador…" /></SelectTrigger>
                <SelectContent>
                  {empleados.map(e => (
                    <SelectItem key={e.userId} value={e.userId}>
                      {e.nombre} {e.apellidos}{e.departamento ? ` · ${e.departamento}` : ""}
                    </SelectItem>
                  ))}
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

            <div>
              <Label className="text-xs text-muted-foreground">Norma / convenio infringido (opcional)</Label>
              <Input
                value={form.normaInfringida}
                onChange={e => u({ normaInfringida: e.target.value })}
                placeholder="Art. X del Convenio de Hostelería / Estatuto de los Trabajadores…"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Medida disciplinaria adoptada</Label>
              <Textarea
                value={form.medida}
                onChange={e => u({ medida: e.target.value })}
                rows={3}
                placeholder="Amonestación por escrito / Suspensión de empleo y sueldo de N días…"
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
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={form.plazoDias}
                  onChange={e => u({ plazoDias: Math.max(1, Math.min(60, Number(e.target.value) || 15)) })}
                  className="mt-1"
                />
              </div>
            </div>

            <Button onClick={enviar} disabled={!puedeEnviar} className="w-full">
              <Send className="h-4 w-4 mr-1" />
              {enviando ? "Enviando…" : "Enviar al trabajador para firma"}
            </Button>
          </CardContent>
        </Card>

        {/* Prototipo visual */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><FileWarning className="h-3.5 w-3.5" />Así verá y firmará el trabajador la sanción</p>
          <PrototipoSancion form={form} empleado={empleadoSel} empresaNombre={empresaNombre} />
        </div>
      </div>

      {/* Sanciones emitidas */}
      <Card>
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />Sanciones emitidas</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trabajador</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Enviada</TableHead>
              <TableHead>Firmada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sanciones.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.empleadoNombre}</TableCell>
                <TableCell className="text-muted-foreground">{s.departamento}</TableCell>
                <TableCell><EstadoBadge estado={s.estado} /></TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{fmtFechaCorta(s.enviadoEn)}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{s.firmadoEn ? fmtFechaCorta(s.firmadoEn) : "—"}</TableCell>
              </TableRow>
            ))}
            {sanciones.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aún no se ha emitido ninguna sanción disciplinaria</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
