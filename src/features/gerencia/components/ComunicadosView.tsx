"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getComunicadosByEmpresa, type Comunicado, ESTADO_COMUNICADO_LABELS, RECURRENCIA_LABELS, type EstadoComunicado, type Recurrencia } from "@/features/rrhh/data/comunicados";
import {
  listComunicados,
  createComunicado,
  updateComunicado,
  listEmpleadosParaComunicado,
  type EmpleadoSelector,
} from "@/features/gerencia/actions/comunicados-actions";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarDays, MoreHorizontal, Eye, Copy, Clock, Archive,
  Trash2, FileText, Users, Building2, ArrowLeft, Save, Upload, X, AlertTriangle, ImageIcon, Bell,
  ChevronLeft, ChevronRight, Settings,
} from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  ordenarColumnas,
  colVisible,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { comunicadosIO } from "@/features/gerencia/io/comunicados.io";
import { useReglasSubmodulo } from "@/features/ajustes/hooks/use-reglas-submodulo";
import { ValidacionFaltantesDialog } from "@/features/ajustes/components/ValidacionFaltantesDialog";

function EstadoBadge({ estado }: { estado: EstadoComunicado }) {
  const colors: Record<EstadoComunicado, string> = {
    borrador: "bg-muted text-muted-foreground",
    programado: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    publicado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    archivado: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };
  return <Badge className={`${colors[estado]} border-0 font-medium`}>{ESTADO_COMUNICADO_LABELS[estado]}</Badge>;
}

function AlcanceCircle({ pct }: { pct: number }) {
  const r = 16, c = 2 * Math.PI * r;
  const color = pct >= 80 ? "text-emerald-500" : pct >= 40 ? "text-amber-500" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2">
      <svg width="40" height="40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="3" className={color}
          strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="text-sm font-medium">{pct}%</span>
    </div>
  );
}

const ROLES_DISPONIBLES = [
  "Director", "Gerencia", "Contabilidad", "Gestoría", "Jurídico",
  "Recursos Humanos", "Logística", "Marketing", "Solo lectura",
  "Cocina", "Jefe de Sala", "Camareros", "Mantenimiento", "RRPP",
];

interface EditorForm {
  titulo: string;
  asunto: string;
  cuerpo: string;
  creadorId: string;
  estado: EstadoComunicado;
  recurrencia: Recurrencia;
  prioridad: string;
  todaEmpresa: boolean;
  rolesDestinatarios: string[];
  empleadosDestinatarios: string[];
  programado: boolean;
  envioFecha: string;
  envioHora: string;
  textoNotificacion: string;
  adjuntos: string[];
  portadaColor: string;
  portadaTitulo: string;
  observaciones: string;
}

const emptyForm: EditorForm = {
  titulo: "", asunto: "", cuerpo: "", creadorId: "", estado: "borrador",
  recurrencia: "sin_repeticion", prioridad: "normal", todaEmpresa: true,
  rolesDestinatarios: [], empleadosDestinatarios: [], programado: false,
  envioFecha: "", envioHora: "", textoNotificacion: "", adjuntos: [],
  portadaColor: "hsl(var(--primary))", portadaTitulo: "", observaciones: "",
};

function formFromComunicado(c: Comunicado): EditorForm {
  const [fecha, hora] = (c.envio || " ").split(" ");
  return {
    titulo: c.titulo, asunto: c.asunto, cuerpo: c.cuerpo, creadorId: c.creadorId,
    estado: c.estado, recurrencia: c.recurrencia, prioridad: c.prioridad,
    todaEmpresa: c.todaEmpresa, rolesDestinatarios: [...c.rolesDestinatarios],
    empleadosDestinatarios: [],
    programado: !!c.envio, envioFecha: fecha || "", envioHora: hora || "",
    textoNotificacion: `Nuevo comunicado: ${c.titulo}`, adjuntos: [],
    portadaColor: "hsl(var(--primary))", portadaTitulo: c.titulo, observaciones: c.observaciones,
  };
}

function ComunicadoEditor({ comunicado, onBack, onSave, empleadosReales, empresaNombre }: {
  comunicado: Comunicado | null;
  onBack: () => void;
  onSave: (form: EditorForm) => void | Promise<void>;
  empleadosReales: EmpleadoSelector[];
  empresaNombre: string;
}) {
  const isEdit = !!comunicado;
  const [form, setForm] = useState<EditorForm>(comunicado ? formFromComunicado(comunicado) : emptyForm);
  const [preview, setPreview] = useState(false);
  const [empleadoFilter, setEmpleadoFilter] = useState("");
  const u = (patch: Partial<EditorForm>) => setForm(f => ({ ...f, ...patch }));

  const toggleRole = (role: string) => {
    u({ rolesDestinatarios: form.rolesDestinatarios.includes(role) ? form.rolesDestinatarios.filter(r => r !== role) : [...form.rolesDestinatarios, role] });
  };

  const toggleEmpleado = (userId: string) => {
    u({
      empleadosDestinatarios: form.empleadosDestinatarios.includes(userId)
        ? form.empleadosDestinatarios.filter(x => x !== userId)
        : [...form.empleadosDestinatarios, userId],
    });
  };

  const empleadosFiltrados = empleadosReales.filter(e => {
    const q = empleadoFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      `${e.nombre} ${e.apellidos}`.toLowerCase().includes(q) ||
      (e.rolLabel ?? "").toLowerCase().includes(q) ||
      (e.departamento ?? "").toLowerCase().includes(q)
    );
  });

  if (preview) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Vista previa del comunicado</h2>
          <Button variant="outline" size="sm" onClick={() => setPreview(false)}><ArrowLeft className="h-4 w-4 mr-1" />Volver al editor</Button>
        </div>
        <Card className="overflow-hidden">
          <div className="h-32 flex items-end p-6" style={{ background: form.portadaColor }}>
            <h1 className="text-2xl font-bold text-white drop-shadow-sm">{form.portadaTitulo || form.titulo || "Sin título"}</h1>
          </div>
          <CardContent className="p-6 space-y-4">
            {form.asunto && <p className="text-sm text-muted-foreground">Asunto: {form.asunto}</p>}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{form.cuerpo || "Sin contenido"}</div>
            {form.adjuntos.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Adjuntos:</p>
                {form.adjuntos.map((a, i) => <Badge key={i} variant="outline" className="mr-1">{a}</Badge>)}
              </div>
            )}
          </CardContent>
          <div className="px-6 pb-4 text-xs text-muted-foreground border-t pt-3">
            <span>{empresaNombre}</span> · <span>{form.todaEmpresa ? "Toda la empresa" : form.rolesDestinatarios.join(", ")}</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Volver</Button>
          <Separator orientation="vertical" className="h-5" />
          <h2 className="text-sm font-bold">{isEdit ? "Editar comunicado" : "Crear comunicado"}</h2>
          <EstadoBadge estado={form.estado} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview(true)}><Eye className="h-4 w-4 mr-1" />Previsualizar</Button>
          <Button size="sm" onClick={() => onSave(form)}><Save className="h-4 w-4 mr-1" />Guardar</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-3xl space-y-6">
            <Card className="overflow-hidden">
              <div className="relative h-36 flex items-end p-5 group" style={{ background: form.portadaColor }}>
                <Input
                  value={form.portadaTitulo}
                  onChange={e => u({ portadaTitulo: e.target.value })}
                  placeholder="Título de portada..."
                  className="bg-transparent border-0 text-white placeholder:text-white/60 text-xl font-bold focus-visible:ring-0 p-0 h-auto shadow-none"
                />
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => {
                    const colors = ["hsl(var(--primary))", "#1e3a5f", "#2d5016", "#6b2142", "#4a2c6b", "#b85c38"];
                    const i = colors.indexOf(form.portadaColor);
                    u({ portadaColor: colors[(i + 1) % colors.length] });
                  }}><ImageIcon className="h-3 w-3 mr-1" />Cambiar</Button>
                  <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => u({ portadaColor: "hsl(var(--muted))", portadaTitulo: "" })}><X className="h-3 w-3" /></Button>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Título del comunicado</Label>
                <Input value={form.titulo} onChange={e => u({ titulo: e.target.value })} placeholder="Título interno del comunicado..." className="text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 shadow-none" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Asunto</Label>
                <Input value={form.asunto} onChange={e => u({ asunto: e.target.value })} placeholder="Asunto del comunicado..." className="border-0 border-b rounded-none px-0 focus-visible:ring-0 shadow-none" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Contenido del comunicado</Label>
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center gap-1 px-3 py-1.5 bg-muted/40 border-b text-xs text-muted-foreground">
                  <button className="px-2 py-0.5 rounded hover:bg-muted font-bold">N</button>
                  <button className="px-2 py-0.5 rounded hover:bg-muted italic">I</button>
                  <button className="px-2 py-0.5 rounded hover:bg-muted underline">S</button>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                  <button className="px-2 py-0.5 rounded hover:bg-muted">• Lista</button>
                  <button className="px-2 py-0.5 rounded hover:bg-muted">1. Lista</button>
                </div>
                <Textarea
                  value={form.cuerpo}
                  onChange={e => u({ cuerpo: e.target.value })}
                  placeholder="Escribe aquí el contenido del comunicado..."
                  className="border-0 focus-visible:ring-0 rounded-none shadow-none min-h-[260px] resize-y"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Observaciones internas</Label>
              <Textarea value={form.observaciones} onChange={e => u({ observaciones: e.target.value })} rows={2} placeholder="Notas internas no visibles en el comunicado..." />
            </div>
          </div>
        </ScrollArea>

        <ScrollArea className="w-80 xl:w-96 border-l bg-muted/20 shrink-0">
          <div className="p-4 space-y-5">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</Label>
              <Select value={form.estado} onValueChange={v => u({ estado: v as EstadoComunicado })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="programado">Programado</SelectItem>
                  <SelectItem value="publicado">Publicado</SelectItem>
                  <SelectItem value="archivado">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" />Destinatarios</Label>
              <div className="mt-2 space-y-3">
                <div className="flex items-center gap-2">
                  <Switch checked={form.todaEmpresa} onCheckedChange={v => u({ todaEmpresa: v })} id="sw-toda" />
                  <Label htmlFor="sw-toda" className="text-sm">Toda la empresa</Label>
                </div>
                {!form.todaEmpresa && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Por rol:</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ROLES_DISPONIBLES.map(role => (
                          <label key={role} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <Checkbox checked={form.rolesDestinatarios.includes(role)} onCheckedChange={() => toggleRole(role)} />
                            {role}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Por empleado:</p>
                        {form.empleadosDestinatarios.length > 0 && (
                          <button
                            type="button"
                            className="text-[10px] text-muted-foreground hover:text-foreground underline"
                            onClick={() => u({ empleadosDestinatarios: [] })}
                          >
                            Limpiar ({form.empleadosDestinatarios.length})
                          </button>
                        )}
                      </div>
                      <Input
                        value={empleadoFilter}
                        onChange={e => setEmpleadoFilter(e.target.value)}
                        placeholder="Buscar empleado…"
                        className="h-8 text-xs"
                      />
                      <div className="border rounded-md max-h-56 overflow-y-auto bg-card">
                        {empleadosFiltrados.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground p-2 text-center">
                            {empleadosReales.length === 0 ? "Sin empleados en BD" : "Sin resultados"}
                          </p>
                        ) : (
                          empleadosFiltrados.map(emp => {
                            const checked = form.empleadosDestinatarios.includes(emp.userId);
                            return (
                              <label
                                key={emp.userId}
                                className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/40 border-b last:border-b-0"
                              >
                                <Checkbox checked={checked} onCheckedChange={() => toggleEmpleado(emp.userId)} />
                                <div className="flex-1 min-w-0">
                                  <p className="truncate font-medium">{emp.nombre} {emp.apellidos}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {[emp.rolLabel, emp.departamento].filter(Boolean).join(" · ") || "Sin rol"}
                                  </p>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Programación</Label>
              <div className="mt-2 space-y-3">
                <div className="flex items-center gap-2">
                  <Switch checked={form.programado} onCheckedChange={v => u({ programado: v })} id="sw-prog" />
                  <Label htmlFor="sw-prog" className="text-sm">{form.programado ? "Programar envío" : "Enviar ahora"}</Label>
                </div>
                {form.programado && (
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Fecha</Label><Input type="date" value={form.envioFecha} onChange={e => u({ envioFecha: e.target.value })} /></div>
                    <div><Label className="text-xs">Hora</Label><Input type="time" value={form.envioHora} onChange={e => u({ envioHora: e.target.value })} /></div>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Recurrencia</Label>
                  <Select value={form.recurrencia} onValueChange={v => u({ recurrencia: v as Recurrencia })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sin_repeticion">Sin repetición</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensual">Mensual</SelectItem>
                      <SelectItem value="personalizado">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Bell className="h-3.5 w-3.5" />Texto de notificación</Label>
              <Textarea value={form.textoNotificacion} onChange={e => u({ textoNotificacion: e.target.value })} rows={2} className="mt-2 text-sm" placeholder="Texto corto que recibirá el usuario como aviso..." />
              <p className="text-[11px] text-muted-foreground mt-1">Este texto se mostrará como notificación en la app.</p>
            </div>

            <Separator />

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Upload className="h-3.5 w-3.5" />Documentos adjuntos</Label>
              <div className="mt-2 space-y-2">
                {form.adjuntos.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm bg-card">
                    <span className="truncate">{a}</span>
                    <button onClick={() => u({ adjuntos: form.adjuntos.filter((_, idx) => idx !== i) })} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" onClick={() => u({ adjuntos: [...form.adjuntos, `documento_${form.adjuntos.length + 1}.pdf`] })}>
                  <Upload className="h-4 w-4 mr-1" />Adjuntar documento
                </Button>
                <p className="text-[11px] text-muted-foreground">Máx. 10 MB por archivo</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Prioridad</Label>
                <Select value={form.prioridad} onValueChange={v => u({ prioridad: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Creador</Label>
                <Select value={form.creadorId} onValueChange={v => u({ creadorId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar empleado..." /></SelectTrigger>
                  <SelectContent>{empleadosReales.map(e => <SelectItem key={e.userId} value={e.userId}>{e.nombre} {e.apellidos}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                Una vez publicado, los destinatarios y el contenido principal del comunicado no podrán modificarse. Solo podrá archivarse.
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ComunicadoCalendario({ comunicados, vista, setVista, mesOffset, setMesOffset, onSelect }: {
  comunicados: Comunicado[];
  vista: "mensual" | "anual";
  setVista: (v: "mensual" | "anual") => void;
  mesOffset: number;
  setMesOffset: (fn: (p: number) => number) => void;
  onSelect: (c: Comunicado) => void;
}) {
  const hoy = new Date();
  const mesBase = new Date(hoy.getFullYear(), hoy.getMonth() + mesOffset, 1);
  const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const conFecha = comunicados.filter(c => c.envio);
  const getForDate = (dateStr: string) => conFecha.filter(c => c.envio?.startsWith(dateStr));

  const estadoColor = (e: EstadoComunicado) => {
    const m: Record<EstadoComunicado, string> = {
      borrador: "border-l-muted-foreground/50 bg-muted/40",
      programado: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/30",
      publicado: "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
      archivado: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30",
    };
    return m[e] || "";
  };

  const renderMiniItem = (c: Comunicado) => (
    <button key={c.id} onClick={() => onSelect(c)}
      className={`w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate border-l-2 hover:opacity-80 transition-opacity ${estadoColor(c.estado)}`}>
      {c.titulo}
    </button>
  );

  const renderMensual = () => {
    const diasMes = new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 0).getDate();
    const primerDia = new Date(mesBase.getFullYear(), mesBase.getMonth(), 1).getDay();
    const offset = primerDia === 0 ? 6 : primerDia - 1;
    const mesLabel = mesBase.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMesOffset(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <h3 className="text-sm font-semibold capitalize">{mesLabel}</h3>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMesOffset(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
            <div key={d} className="bg-muted/50 p-2 text-center text-[10px] font-bold text-muted-foreground uppercase">{d}</div>
          ))}
          {Array.from({ length: offset }).map((_, i) => <div key={`e-${i}`} className="bg-card min-h-[90px] p-1" />)}
          {Array.from({ length: diasMes }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatDate(new Date(mesBase.getFullYear(), mesBase.getMonth(), day));
            const items = getForDate(dateStr);
            const isToday = dateStr === formatDate(hoy);
            return (
              <div key={day} className={`bg-card min-h-[90px] p-1 ${isToday ? "ring-2 ring-primary/30 ring-inset" : ""}`}>
                <span className={`text-[11px] font-medium ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{day}</span>
                <div className="space-y-0.5 mt-0.5">
                  {items.slice(0, 3).map(c => renderMiniItem(c))}
                  {items.length > 3 && <span className="text-[9px] text-muted-foreground">+{items.length - 3} más</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAnual = () => {
    const year = mesBase.getFullYear();
    const meses = Array.from({ length: 12 }, (_, i) => i);
    const nombresMes = meses.map(m => new Date(year, m, 1).toLocaleDateString("es-ES", { month: "short" }));
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMesOffset(p => p - 12)}><ChevronLeft className="h-4 w-4" /></Button>
          <h3 className="text-sm font-semibold">{year}</h3>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMesOffset(p => p + 12)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {meses.map(m => {
            const diasEnMes = new Date(year, m + 1, 0).getDate();
            const primerDiaSemana = new Date(year, m, 1).getDay();
            const off = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;
            const monthStr = `${year}-${String(m + 1).padStart(2, "0")}`;
            const itemsMes = conFecha.filter(c => c.envio?.startsWith(monthStr));
            const isCurrentMonth = m === hoy.getMonth() && year === hoy.getFullYear();
            return (
              <Card key={m} className={`overflow-hidden ${isCurrentMonth ? "ring-2 ring-primary/30" : ""}`}>
                <CardHeader className="p-2 pb-1"><CardTitle className="text-xs capitalize text-center">{nombresMes[m]}</CardTitle></CardHeader>
                <CardContent className="p-1.5 pt-0">
                  <div className="grid grid-cols-7 gap-px mb-1">
                    {["L", "M", "X", "J", "V", "S", "D"].map(d => <div key={d} className="text-[7px] text-center text-muted-foreground font-medium">{d}</div>)}
                    {Array.from({ length: off }).map((_, i) => <div key={`eo-${i}`} className="h-3" />)}
                    {Array.from({ length: diasEnMes }).map((_, i) => {
                      const day = i + 1;
                      const ds = `${monthStr}-${String(day).padStart(2, "0")}`;
                      const has = conFecha.some(c => c.envio?.startsWith(ds));
                      const isT = ds === formatDate(hoy);
                      return (
                        <div key={day} className={`h-3 flex items-center justify-center text-[7px] rounded-sm ${isT ? "bg-primary text-primary-foreground font-bold" : has ? "bg-primary/20 font-semibold" : "text-muted-foreground"}`}>{day}</div>
                      );
                    })}
                  </div>
                  {itemsMes.length > 0 ? (
                    <div className="space-y-0.5 border-t pt-1">
                      {itemsMes.slice(0, 4).map(c => (
                        <button key={c.id} onClick={() => onSelect(c)} className={`w-full text-left text-[9px] truncate rounded px-1 py-0.5 border-l-2 hover:opacity-80 ${estadoColor(c.estado)}`}>{c.titulo}</button>
                      ))}
                      {itemsMes.length > 4 && <p className="text-[8px] text-muted-foreground text-center">+{itemsMes.length - 4} más</p>}
                    </div>
                  ) : <p className="text-[8px] text-muted-foreground text-center pt-1 border-t">Sin comunicados</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <Badge variant={vista === "mensual" ? "default" : "outline"} className="cursor-pointer" onClick={() => setVista("mensual")}>Mensual</Badge>
          <Badge variant={vista === "anual" ? "default" : "outline"} className="cursor-pointer" onClick={() => setVista("anual")}>Anual</Badge>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Publicado</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Programado</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Archivado</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/50" />Borrador</span>
        </div>
      </div>
      {vista === "mensual" ? renderMensual() : renderAnual()}
    </div>
  );
}

export function ComunicadosView() {
  const { empresaActual } = useEmpresa();
  const empresaId = empresaActual?.id || "habana";
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [empleadosReales, setEmpleadosReales] = useState<EmpleadoSelector[]>([]);
  const [, setLoading] = useState(true);

  const loadComunicados = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listComunicados();
      if (res.ok && res.data.length > 0) {
        // DB has data but shape is flat; use mock for rich nested data
        setComunicados(getComunicadosByEmpresa(empresaId));
      } else {
        setComunicados(getComunicadosByEmpresa(empresaId));
      }
    } catch {
      setComunicados(getComunicadosByEmpresa(empresaId));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  const loadEmpleadosReales = useCallback(async () => {
    const res = await listEmpleadosParaComunicado();
    if (res.ok) setEmpleadosReales(res.data);
  }, []);

  useEffect(() => {
    loadComunicados();
    loadEmpleadosReales();
  }, [loadComunicados, loadEmpleadosReales]);

  const [mainTab, setMainTab] = useState<"listado" | "calendario">("listado");
  const [calVista, setCalVista] = useState<"mensual" | "anual">("mensual");
  const [mesOffset, setMesOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorMode, setEditorMode] = useState<"list" | "create" | "edit">("list");
  const [editingComunicado, setEditingComunicado] = useState<Comunicado | null>(null);
  const [faltantesComunicado, setFaltantesComunicado] = useState<string[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const { validar: validarComunicado } = useReglasSubmodulo("gerencia", "comunicados");

  const accesoComunicado = (c: Comunicado, campo: string): unknown => {
    if (campo === "estado") return c.estado;
    if (campo === "recurrencia") return c.recurrencia;
    if (campo === "prioridad") return c.prioridad;
    if (campo === "titulo") return c.titulo;
    if (campo === "creadoEl") return c.creadoEl;
    if (campo === "envio") return c.envio ?? "";
    if (campo === "alcancePct") return c.alcancePct;
    return (c as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let lista = comunicados.filter(c => {
      const q = search.toLowerCase();
      return !q || c.titulo.toLowerCase().includes(q) || c.asunto.toLowerCase().includes(q);
    });
    const accesoGenerico = accesoComunicado as unknown as (
      c: Record<string, unknown>,
      campo: string,
    ) => unknown;
    lista = aplicarFiltrosToolbar(
      lista as unknown as Record<string, unknown>[],
      filtros,
      accesoGenerico,
    ) as unknown as Comunicado[];
    lista = aplicarOrdenToolbar(
      lista as unknown as Record<string, unknown>[],
      orden,
      accesoGenerico,
    ) as unknown as Comunicado[];
    return lista;
  }, [comunicados, search, filtros, orden]);

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)));

  const openEdit = (c: Comunicado) => { setEditingComunicado(c); setEditorMode("edit"); };
  const openCreate = () => { setEditingComunicado(null); setEditorMode("create"); };
  const closeEditor = () => { setEditorMode("list"); setEditingComunicado(null); };

  const saveEditor = async (form: EditorForm) => {
    // Solo validamos al CREAR (al editar dejamos pasar).
    if (editorMode === "create") {
      const { labelsFaltantes } = validarComunicado({
        titulo: form.titulo,
        asunto: form.asunto,
        cuerpo: form.cuerpo,
        prioridad: form.prioridad,
        estado: form.estado,
        envioFecha: form.envioFecha,
      });
      if (labelsFaltantes.length > 0) {
        setFaltantesComunicado(labelsFaltantes);
        return;
      }
    }
    const envio = form.programado && form.envioFecha
      ? `${form.envioFecha}${form.envioHora ? `T${form.envioHora}:00` : "T00:00:00"}`
      : null;
    const payload = {
      titulo: form.titulo,
      asunto: form.asunto,
      cuerpo: form.cuerpo,
      estado: form.estado,
      prioridad: form.prioridad,
      recurrencia: form.recurrencia,
      todaEmpresa: form.todaEmpresa,
      rolesDestinatarios: form.todaEmpresa ? [] : form.rolesDestinatarios,
      empleadosDestinatarios: form.todaEmpresa ? [] : form.empleadosDestinatarios,
      departamentosDestinatarios: [] as string[],
      envio,
      observaciones: form.observaciones,
    };
    const res = editorMode === "create"
      ? await createComunicado(payload)
      : editingComunicado
        ? await updateComunicado(editingComunicado.id, payload)
        : { ok: false, error: "Sin contexto" };
    if (res.ok) toast.success("Comunicado guardado");
    else toast.error(("error" in res && res.error) || "Error al guardar comunicado");
    await loadComunicados();
    closeEditor();
  };

  if (editorMode !== "list") {
    return (
      <>
        <ComunicadoEditor
          comunicado={editingComunicado}
          onBack={closeEditor}
          onSave={saveEditor}
          empleadosReales={empleadosReales}
          empresaNombre={empresaActual?.nombre || ""}
        />
        <ValidacionFaltantesDialog
          open={faltantesComunicado.length > 0}
          onClose={() => setFaltantesComunicado([])}
          campos={faltantesComunicado}
          submoduloLabel="Comunicados"
        />
      </>
    );
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "titulo", label: "Título" },
    { campo: "estado", label: "Estado" },
    { campo: "creadoEl", label: "Creado el" },
    { campo: "envio", label: "Envío" },
    { campo: "recurrencia", label: "Recurrencia" },
    { campo: "alcance", label: "Alcance" },
    { campo: "destinatarios", label: "Destinatarios" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (c: Comunicado) => ReactNode }> = {
    titulo: {
      th: <TableHead key="titulo">Título</TableHead>,
      td: (c) => (
        <TableCell key="titulo">
          <div>
            <p className="font-semibold text-sm">{c.titulo}</p>
            <p className="text-xs text-muted-foreground">Empresa: {empresaActual?.nombre}</p>
          </div>
        </TableCell>
      ),
    },
    estado: {
      th: <TableHead key="estado">Estado</TableHead>,
      td: (c) => (
        <TableCell key="estado"><EstadoBadge estado={c.estado} /></TableCell>
      ),
    },
    creadoEl: {
      th: <TableHead key="creadoEl">Creado el</TableHead>,
      td: (c) => (
        <TableCell key="creadoEl" className="text-sm text-muted-foreground whitespace-nowrap">{c.creadoEl}</TableCell>
      ),
    },
    envio: {
      th: <TableHead key="envio">Envío</TableHead>,
      td: (c) => (
        <TableCell key="envio" className="text-sm text-muted-foreground whitespace-nowrap">{c.envio || "—"}</TableCell>
      ),
    },
    recurrencia: {
      th: <TableHead key="recurrencia">Recurrencia</TableHead>,
      td: (c) => (
        <TableCell key="recurrencia"><Badge variant="outline" className="text-xs">{RECURRENCIA_LABELS[c.recurrencia]}</Badge></TableCell>
      ),
    },
    alcance: {
      th: <TableHead key="alcance">Alcance</TableHead>,
      td: (c) => (
        <TableCell key="alcance"><AlcanceCircle pct={c.alcancePct} /></TableCell>
      ),
    },
    destinatarios: {
      th: <TableHead key="destinatarios">Destinatarios</TableHead>,
      td: (c) => (
        <TableCell key="destinatarios">
          <div className="flex flex-wrap gap-1">
            {c.todaEmpresa ? (
              <Badge variant="secondary" className="text-[11px] gap-1"><Building2 className="h-3 w-3" />{c.destinatarios.empresas} empresa</Badge>
            ) : (
              <>
                <Badge variant="secondary" className="text-[11px] gap-1"><Users className="h-3 w-3" />{c.destinatarios.departamentos} dptos</Badge>
                <Badge variant="outline" className="text-[11px] gap-1">{c.destinatarios.empleados} empleados</Badge>
              </>
            )}
          </div>
        </TableCell>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{comunicados.length}</p><p className="text-xs text-muted-foreground">Total comunicados</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{comunicados.filter(c => c.estado === "publicado").length}</p><p className="text-xs text-muted-foreground">Publicados</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{comunicados.filter(c => c.estado === "programado").length}</p><p className="text-xs text-muted-foreground">Programados</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{Math.round(comunicados.filter(c => c.alcancePct > 0).reduce((s, c) => s + c.alcancePct, 0) / Math.max(comunicados.filter(c => c.alcancePct > 0).length, 1))}%</p><p className="text-xs text-muted-foreground">Alcance medio</p></CardContent></Card>
      </div>

      <Tabs value={mainTab} onValueChange={v => setMainTab(v as "listado" | "calendario")}>
        <TabsList>
          <TabsTrigger value="listado"><FileText className="h-4 w-4 mr-1" />Comunicados</TabsTrigger>
          <TabsTrigger value="calendario"><CalendarDays className="h-4 w-4 mr-1" />Calendario</TabsTrigger>
        </TabsList>

        <TabsContent value="listado">
          <div className="mb-4">
            <SubmoduleToolbar
              busqueda={search}
              onBusquedaChange={setSearch}
              placeholderBusqueda="Buscar"
              onNuevo={openCreate}
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
                  <IOActions config={comunicadosIO} onSuccess={() => window.location.reload()} />
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
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>
                  {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} /></TableCell>
                    {columnasRender.map((col) => columnDefs[col.campo]?.td(c))}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}><Eye className="h-4 w-4 mr-2" />Ver / Editar</DropdownMenuItem>
                          <DropdownMenuItem><Copy className="h-4 w-4 mr-2" />Duplicar</DropdownMenuItem>
                          <DropdownMenuItem><Clock className="h-4 w-4 mr-2" />Programar</DropdownMenuItem>
                          <DropdownMenuItem><Archive className="h-4 w-4 mr-2" />Archivar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No se encontraron comunicados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="calendario">
          <ComunicadoCalendario
            comunicados={comunicados}
            vista={calVista}
            setVista={setCalVista}
            mesOffset={mesOffset}
            setMesOffset={setMesOffset}
            onSelect={openEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
