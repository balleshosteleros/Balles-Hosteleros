import { useState, useMemo, useEffect, useTransition, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Pencil, Mail, Eye, Search, ChevronRight, Clock,
  Variable, CheckCircle2, XCircle, Loader2, RotateCcw,
  Workflow, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlantillasEstadoTab } from "./PlantillasEstadoTab";
import { CuestionariosVacanteManager } from "./CuestionariosVacanteManager";
import {
  FASES_PRINCIPALES_ORDER,
  FASES_PRINCIPALES,
  ESTADOS_CONFIG,
  type EstadoReclutamiento,
} from "@/features/rrhh/data/reclutamiento";
import {
  VARIABLES_RECLUTAMIENTO,
  GRUPOS_VARIABLES_RECLUTAMIENTO,
  VARIABLES_RECLUTAMIENTO_EJEMPLO,
  sustituirVariablesReclutamiento,
} from "@/features/rrhh/lib/reclutamiento-email";
import {
  listReclutamientoEmailPlantillas,
  updateReclutamientoEmailPlantilla,
  toggleReclutamientoEmailPlantillaActiva,
  resetReclutamientoEmailPlantilla,
  type ReclutamientoEmailPlantilla,
} from "@/features/rrhh/actions/reclutamiento-email-plantillas-actions";
import { toast } from "sonner";

// ─── Editor modal ───────────────────────────────────────────────
function PlantillaEditorDialog({
  plantilla,
  open,
  onOpenChange,
  onSaved,
  empresaNombre,
  initialTab = "editar",
}: {
  plantilla: ReclutamientoEmailPlantilla | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  empresaNombre: string;
  initialTab?: "editar" | "preview";
}) {
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [activa, setActiva] = useState(true);
  const [tab, setTab] = useState<"editar" | "preview">(initialTab);
  const [pending, startTransition] = useTransition();

  // Sincroniza el formulario cuando cambia la plantilla o se abre el diálogo.
  const estado = plantilla?.estado;
  useEffect(() => {
    if (plantilla) {
      setAsunto(plantilla.asunto);
      setCuerpo(plantilla.cuerpo);
      setActiva(plantilla.activa);
      setTab(initialTab);
    }
  }, [estado, plantilla, initialTab]);

  if (!plantilla || !estado) return null;

  const faseCfg = FASES_PRINCIPALES[plantilla.fase];
  const estadoCfg = ESTADOS_CONFIG[estado];

  const insertVariable = (variable: string) => {
    setCuerpo((prev) => (prev.endsWith(" ") || prev === "" ? prev : prev + " ") + variable);
  };

  const previewVars = { ...VARIABLES_RECLUTAMIENTO_EJEMPLO, empresa_nombre: empresaNombre };

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateReclutamientoEmailPlantilla(estado, { asunto, cuerpo, activa });
      if (res.ok) {
        toast.success("Plantilla guardada correctamente");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      const res = await resetReclutamientoEmailPlantilla(estado);
      if (res.ok) {
        toast.success("Plantilla restaurada al texto por defecto");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-primary" />
            Editar plantilla
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px]" style={{ borderColor: faseCfg.color, color: faseCfg.color }}>
              {faseCfg.label}
            </Badge>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="secondary" className="text-[10px]">{estadoCfg.label}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="flex border-b border-border">
          <button
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === "editar" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("editar")}
          >
            <Pencil className="h-3.5 w-3.5 inline mr-1.5" />Editar
          </button>
          <button
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === "preview" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("preview")}
          >
            <Eye className="h-3.5 w-3.5 inline mr-1.5" />Vista previa
          </button>
        </div>

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          {tab === "editar" ? (
            <div className="px-6 py-5 space-y-5">
              <div className="flex items-center gap-2">
                <Switch checked={activa} onCheckedChange={setActiva} />
                <Label className="text-xs">
                  {activa ? "Activa — se envía al pasar a este estado" : "Inactiva — no se envía correo"}
                </Label>
              </div>

              <div>
                <Label className="text-xs">Asunto del email</Label>
                <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} className="mt-1" placeholder="Asunto del email..." />
              </div>

              <div>
                <Label className="text-xs">Cuerpo del email</Label>
                <Textarea
                  value={cuerpo}
                  onChange={(e) => setCuerpo(e.target.value)}
                  className="mt-1 min-h-[220px] text-sm"
                  placeholder="Escribe el contenido del email..."
                />
              </div>

              <Separator />

              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-1">
                  <Variable className="h-3.5 w-3.5 text-primary" /> Códigos disponibles
                </Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Haz clic en un código para insertarlo. Al enviar el email se sustituye automáticamente por el dato real.
                </p>
                <div className="space-y-3">
                  {GRUPOS_VARIABLES_RECLUTAMIENTO.map((grupo) => {
                    const vars = VARIABLES_RECLUTAMIENTO.filter((v) => v.grupo === grupo);
                    if (vars.length === 0) return null;
                    return (
                      <div key={grupo}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{grupo}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {vars.map((v) => (
                            <button
                              key={v.variable}
                              onClick={() => insertVariable(v.variable)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-muted/50 text-[11px] font-mono text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors"
                              title={v.descripcion}
                            >
                              {v.variable}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Para:</span> {VARIABLES_RECLUTAMIENTO_EJEMPLO.candidato_email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium">Asunto:</span> {sustituirVariablesReclutamiento(asunto, previewVars)}
                  </p>
                </div>
                <div className="p-5 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {sustituirVariablesReclutamiento(cuerpo, previewVars)}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                Vista previa con datos de ejemplo. Los códigos se sustituirán con los datos reales del candidato al enviar.
              </p>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border sm:justify-between">
          <Button variant="ghost" onClick={handleReset} disabled={pending} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar por defecto
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
            <Button onClick={handleSave} disabled={pending} className="gap-1.5">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Guardar plantilla
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pestaña de Emails ──────────────────────────────────────────
function PlantillasEmailTab() {
  const { empresaActual } = useEmpresa();
  const [plantillas, setPlantillas] = useState<ReclutamientoEmailPlantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ReclutamientoEmailPlantilla | null>(null);
  const [editingTab, setEditingTab] = useState<"editar" | "preview">("editar");
  const [search, setSearch] = useState("");
  const [filtroFase, setFiltroFase] = useState<string>("todas");
  const [filtroActivo, setFiltroActivo] = useState<string>("todos");

  const reload = useCallback(async () => {
    const data = await listReclutamientoEmailPlantillas();
    setPlantillas(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    let list = plantillas;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p) => p.nombre.toLowerCase().includes(s) || p.asunto.toLowerCase().includes(s));
    }
    if (filtroFase !== "todas") list = list.filter((p) => p.fase === filtroFase);
    if (filtroActivo === "activas") list = list.filter((p) => p.activa);
    if (filtroActivo === "inactivas") list = list.filter((p) => !p.activa);
    return list;
  }, [plantillas, search, filtroFase, filtroActivo]);

  const handleToggle = (estado: EstadoReclutamiento, current: boolean) => {
    // Optimista
    setPlantillas((prev) => prev.map((p) => (p.estado === estado ? { ...p, activa: !current } : p)));
    void (async () => {
      const res = await toggleReclutamientoEmailPlantillaActiva(estado, !current);
      if (res.ok) {
        toast.success("Estado de la plantilla actualizado");
      } else {
        toast.error(res.error);
        setPlantillas((prev) => prev.map((p) => (p.estado === estado ? { ...p, activa: current } : p)));
      }
    })();
  };

  const activasCount = plantillas.filter((p) => p.activa).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">Plantillas de email</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Una plantilla por cada estado del proceso de selección. Cuando un candidato pasa a ese estado dentro de una vacante, se le envía este correo.
          {!loading && <> {" "}{activasCount} de {plantillas.length} activas.</>}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar plantilla..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filtroFase} onValueChange={setFiltroFase}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las fases</SelectItem>
            {FASES_PRINCIPALES_ORDER.map((fp) => (
              <SelectItem key={fp} value={fp}>{FASES_PRINCIPALES[fp].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroActivo} onValueChange={setFiltroActivo}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="activas">Activas</SelectItem>
            <SelectItem value="inactivas">Inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando plantillas…
        </div>
      ) : (
        FASES_PRINCIPALES_ORDER.map((fp) => {
          const cfg = FASES_PRINCIPALES[fp];
          const fasePlantillas = filtered.filter((p) => p.fase === fp);
          if (filtroFase !== "todas" && filtroFase !== fp) return null;
          if (fasePlantillas.length === 0) return null;

          return (
            <Card key={fp} className="overflow-hidden">
              <div
                className="px-5 py-3 border-b border-border flex items-center justify-between"
                style={{ background: `linear-gradient(90deg, ${cfg.colorFrom}15, ${cfg.colorTo}08)` }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <h3 className="font-semibold text-foreground text-sm">Fase: {cfg.label}</h3>
                  <Badge variant="outline" className="text-[10px]">{fasePlantillas.length} plantillas</Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {fasePlantillas.filter((p) => p.activa).length} activas
                </span>
              </div>
              <CardContent className="p-0">
                {fasePlantillas.map((p) => {
                  const estadoCfg = ESTADOS_CONFIG[p.estado];
                  return (
                    <div key={p.estado} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-foreground">Email al pasar a {estadoCfg.label}</span>
                            <Badge variant="secondary" className="text-[10px]">{estadoCfg.label}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            <span className="font-medium">Asunto:</span> {p.asunto}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={p.activa ? "secondary" : "outline"}
                          className={`text-[10px] gap-1 ${p.activa ? "bg-emerald-100 text-emerald-700" : ""}`}
                        >
                          {p.activa ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {p.activa ? "Activa" : "Inactiva"}
                        </Badge>
                        <Switch checked={p.activa} onCheckedChange={() => handleToggle(p.estado, p.activa)} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setEditingTab("editar"); setEditing(p); }}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setEditingTab("preview"); setEditing(p); }}
                          title="Vista previa"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Editor Dialog */}
      <PlantillaEditorDialog
        plantilla={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={reload}
        empresaNombre={empresaActual.nombre}
        initialTab={editingTab}
      />
    </div>
  );
}

// ─── Selector de tipo de plantilla (3 botones azules) ───────────
type TipoPlantilla = "emails" | "estados" | "cuestionarios";

const BOTONES_PLANTILLA: { id: TipoPlantilla; label: string; icon: React.ReactNode }[] = [
  { id: "emails", label: "Emails", icon: <Mail className="h-4 w-4" /> },
  { id: "estados", label: "Estados", icon: <Workflow className="h-4 w-4" /> },
  { id: "cuestionarios", label: "Cuestionarios", icon: <ClipboardList className="h-4 w-4" /> },
];

export function PlantillasConfig() {
  const [tipo, setTipo] = useState<TipoPlantilla>("emails");

  return (
    <div className="space-y-6">
      {/* 3 botones azules — los 3 tipos de plantilla */}
      <div className="flex flex-wrap items-center gap-2">
        {BOTONES_PLANTILLA.map((b) => {
          const activo = tipo === b.id;
          return (
            <Button
              key={b.id}
              onClick={() => setTipo(b.id)}
              variant={activo ? "default" : "outline"}
              className={cn(
                "gap-2",
                activo
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-700",
              )}
            >
              {b.icon}
              {b.label}
            </Button>
          );
        })}
      </div>

      {tipo === "emails" && <PlantillasEmailTab />}
      {tipo === "estados" && <PlantillasEstadoTab />}
      {tipo === "cuestionarios" && <CuestionariosVacanteManager />}
    </div>
  );
}
