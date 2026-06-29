"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  TRIMESTRALES_POR_EMPRESA, ANUALES_POR_EMPRESA, ESTADOS_PRESENTACION,
  DOCUMENTOS_TRIMESTRALES_BASE, DOCUMENTOS_ANUALES_BASE, TIPOS_DOCUMENTO_GESTORIA,
  PeriodoTrimestral, PeriodoAnual, DocumentoRequerido, DocumentoComplementario, EstadoPresentacion,
} from "@/features/gestoria/data/gestoria-presentaciones";
import { listPresentaciones } from "@/features/gestoria/actions/presentaciones-actions";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Upload, Download, CheckCircle2, Clock, AlertTriangle, XCircle, ChevronDown,
  ChevronRight, Plus, Eye, Settings, CalendarDays, FolderOpen, File, Paperclip, Info,
} from "lucide-react";

function EstadoBadge({ estado }: { estado: EstadoPresentacion }) {
  const cfg = ESTADOS_PRESENTACION.find((e) => e.value === estado);
  if (!cfg) return null;
  return <Badge className={`${cfg.color} border text-xs font-medium`}>{cfg.label}</Badge>;
}

function progreso(docs: DocumentoRequerido[]): number {
  if (docs.length === 0) return 0;
  return Math.round((docs.filter((d) => !!d.documento).length / docs.length) * 100);
}

function DocumentoRow({ doc, idx }: { doc: DocumentoRequerido; idx: number }) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded-md ${idx % 2 === 0 ? "bg-muted/30" : ""}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <File className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{doc.nombre}</p>
          <p className="text-xs text-muted-foreground truncate">{doc.descripcion}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {doc.documento ? (
          <>
            <span className="text-xs text-muted-foreground hidden md:block">{doc.documento.fechaSubida}</span>
            <span className="text-xs text-muted-foreground hidden lg:block">— {doc.documento.subidoPor}</span>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Subido</Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
          </>
        ) : (
          <>
            <Badge variant="outline" className="text-xs text-muted-foreground">Pendiente</Badge>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Upload className="h-3 w-3" /> Subir</Button>
          </>
        )}
      </div>
    </div>
  );
}

function ComplementarioRow({ doc }: { doc: DocumentoComplementario }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/20">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{doc.nombre}</p>
          {doc.observaciones && <p className="text-xs text-muted-foreground truncate">{doc.observaciones}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span className="text-xs text-muted-foreground hidden md:block">{doc.fechaSubida}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function AddComplementarioDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Plus className="h-3 w-3" /> Añadir documento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Añadir documento complementario</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Nombre del documento</Label>
            <Input placeholder="Ej: Carta complementaria AEAT" />
          </div>
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO_GESTORIA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Observaciones</Label>
            <Textarea placeholder="Notas adicionales..." rows={2} />
          </div>
          <div className="grid gap-2">
            <Label>Archivo</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Arrastra o haz clic para subir</p>
            </div>
          </div>
          <Button className="w-full">Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TrimestreCard({ periodo }: { periodo: PeriodoTrimestral }) {
  const [open, setOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const pct = progreso(periodo.documentosRequeridos);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <CalendarDays className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">{periodo.trimestre} {periodo.anio}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Límite presentación: {periodo.fechaLimitePresentacion} · Límite subida: {periodo.fechaLimiteSubida}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{periodo.documentosRequeridos.filter((d) => !!d.documento).length}/{periodo.documentosRequeridos.length}</span>
                  <Progress value={pct} className="w-20 h-2" />
                </div>
                <EstadoBadge estado={periodo.estado} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documentos requeridos
              </h4>
              {periodo.documentosRequeridos.map((d, i) => <DocumentoRow key={d.id} doc={d} idx={i} />)}
            </div>
            <Collapsible open={compOpen} onOpenChange={setCompOpen}>
              <div className="flex items-center justify-between pt-2">
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  {compOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <FolderOpen className="h-4 w-4" />
                  Documentación complementaria ({periodo.documentosComplementarios.length})
                </CollapsibleTrigger>
                <AddComplementarioDialog />
              </div>
              <CollapsibleContent className="mt-2 space-y-1">
                {periodo.documentosComplementarios.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">Sin documentos complementarios</p>
                ) : (
                  periodo.documentosComplementarios.map((d) => <ComplementarioRow key={d.id} doc={d} />)
                )}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function AnualidadCard({ periodo }: { periodo: PeriodoAnual }) {
  const [open, setOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const pct = progreso(periodo.documentosRequeridos);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <CalendarDays className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Ejercicio {periodo.anio}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Límite subida: {periodo.fechaLimiteSubida}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{periodo.documentosRequeridos.filter((d) => !!d.documento).length}/{periodo.documentosRequeridos.length}</span>
                  <Progress value={pct} className="w-20 h-2" />
                </div>
                <EstadoBadge estado={periodo.estado} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documentos requeridos
              </h4>
              {periodo.documentosRequeridos.map((d, i) => <DocumentoRow key={d.id} doc={d} idx={i} />)}
            </div>
            <Collapsible open={compOpen} onOpenChange={setCompOpen}>
              <div className="flex items-center justify-between pt-2">
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  {compOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <FolderOpen className="h-4 w-4" />
                  Documentación complementaria ({periodo.documentosComplementarios.length})
                </CollapsibleTrigger>
                <AddComplementarioDialog />
              </div>
              <CollapsibleContent className="mt-2 space-y-1">
                {periodo.documentosComplementarios.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">Sin documentos complementarios</p>
                ) : (
                  periodo.documentosComplementarios.map((d) => <ComplementarioRow key={d.id} doc={d} />)
                )}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ConfigTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Documentos trimestrales base</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {DOCUMENTOS_TRIMESTRALES_BASE.map((d, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded bg-muted/30">
              <div>
                <p className="text-sm font-medium">{d.nombre}</p>
                <p className="text-xs text-muted-foreground">{d.descripcion}</p>
              </div>
              <Badge variant="outline" className="text-xs">Activo</Badge>
            </div>
          ))}
          <Button variant="outline" size="sm" className="mt-2 gap-1.5"><Plus className="h-3 w-3" /> Añadir documento base</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Documentos anuales base</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {DOCUMENTOS_ANUALES_BASE.map((d, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded bg-muted/30">
              <div>
                <p className="text-sm font-medium">{d.nombre}</p>
                <p className="text-xs text-muted-foreground">{d.descripcion}</p>
              </div>
              <Badge variant="outline" className="text-xs">Activo</Badge>
            </div>
          ))}
          <Button variant="outline" size="sm" className="mt-2 gap-1.5"><Plus className="h-3 w-3" /> Añadir documento base</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Plazo de subida</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Días hábiles tras la fecha oficial de presentación para considerar la documentación dentro de plazo.
          </p>
          <div className="flex items-center gap-3">
            <Input type="number" defaultValue={10} className="w-24" />
            <span className="text-sm text-muted-foreground">días hábiles</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PresentacionesView() {
  const pathname = usePathname();
  useEffect(() => { sessionStorage.setItem("gestoria_last", pathname); }, [pathname]);
  const { empresaActual } = useEmpresa();
  const [anioFilter, setAnioFilter] = useState<string>("2026");
  const [, setLoading] = useState(true);
  const [, setDbPresentaciones] = useState<Record<string, unknown>[]>([]);

  const loadPresentaciones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPresentaciones();
      if (res.ok) {
        setDbPresentaciones(res.data);
      } else {
        toast.error("Error al cargar presentaciones");
      }
    } catch {
      toast.error("Error de conexion al cargar presentaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPresentaciones();
  }, [loadPresentaciones]);

  const trimestrales = useMemo(() => {
    const all = TRIMESTRALES_POR_EMPRESA[empresaActual.id] || [];
    return anioFilter === "todos" ? all : all.filter((t) => t.anio === Number(anioFilter));
  }, [empresaActual, anioFilter]);

  const anuales = useMemo(() => {
    const all = ANUALES_POR_EMPRESA[empresaActual.id] || [];
    return anioFilter === "todos" ? all : all.filter((a) => a.anio === Number(anioFilter));
  }, [empresaActual, anioFilter]);

  const allTrim = TRIMESTRALES_POR_EMPRESA[empresaActual.id] || [];
  const allAnual = ANUALES_POR_EMPRESA[empresaActual.id] || [];
  const allPeriodos = [...allTrim, ...allAnual];
  const stats = {
    completo: allPeriodos.filter((p) => p.estado === "completo").length,
    pendiente: allPeriodos.filter((p) => p.estado === "pendiente").length,
    fuera: allPeriodos.filter((p) => p.estado === "fuera_de_plazo").length,
    revision: allPeriodos.filter((p) => p.estado === "en_revision").length,
    incompleto: allPeriodos.filter((p) => p.estado === "incompleto").length,
  };

  const aniosDisponibles = useMemo(() => {
    const s = new Set<number>();
    allTrim.forEach((t) => s.add(t.anio));
    allAnual.forEach((a) => s.add(a.anio));
    return Array.from(s).sort((a, b) => b - a);
  }, [empresaActual]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Completos", count: stats.completo, icon: CheckCircle2, iconCls: "text-emerald-600", bgCls: "bg-emerald-50", barCls: "bg-emerald-500" },
          { label: "Pendientes", count: stats.pendiente, icon: Clock, iconCls: "text-amber-600", bgCls: "bg-amber-50", barCls: "bg-amber-500" },
          { label: "Fuera de plazo", count: stats.fuera, icon: XCircle, iconCls: "text-red-600", bgCls: "bg-red-50", barCls: "bg-red-500" },
          { label: "En revisión", count: stats.revision, icon: Info, iconCls: "text-blue-600", bgCls: "bg-blue-50", barCls: "bg-blue-500" },
          { label: "Incompletos", count: stats.incompleto, icon: AlertTriangle, iconCls: "text-orange-600", bgCls: "bg-orange-50", barCls: "bg-orange-500" },
        ].map((s) => (
          <div key={s.label} className="relative overflow-hidden rounded-lg border bg-card px-3 py-2.5 hover:shadow-sm transition-shadow">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.barCls}`} />
            <div className="flex items-center gap-2.5 pl-1">
              <div className={`flex items-center justify-center h-7 w-7 rounded-md ${s.bgCls} shrink-0`}>
                <s.icon className={`h-3.5 w-3.5 ${s.iconCls}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none tracking-tight">{s.count}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="trimestrales" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg border p-3">
          <TabsList>
            <TabsTrigger value="trimestrales" className="gap-1.5">
              <CalendarDays className="h-4 w-4" /> Trimestrales
            </TabsTrigger>
            <TabsTrigger value="anuales" className="gap-1.5">
              <FolderOpen className="h-4 w-4" /> Anuales
            </TabsTrigger>
            <TabsTrigger value="config" aria-label="Configuración">
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </TabsTrigger>
          </TabsList>
          <div className="flex-1" />
          <Select value={anioFilter} onValueChange={setAnioFilter}>
            <SelectTrigger className="w-28 h-9 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {aniosDisponibles.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="trimestrales" className="space-y-3">
          {trimestrales.length === 0 ? (
            <Card className="p-8 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No hay presentaciones trimestrales para este periodo</p>
            </Card>
          ) : (
            trimestrales.map((p) => <TrimestreCard key={p.id} periodo={p} />)
          )}
        </TabsContent>

        <TabsContent value="anuales" className="space-y-3">
          {anuales.length === 0 ? (
            <Card className="p-8 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No hay presentaciones anuales para este periodo</p>
            </Card>
          ) : (
            anuales.map((p) => <AnualidadCard key={p.id} periodo={p} />)
          )}
        </TabsContent>

        <TabsContent value="config">
          <ConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
