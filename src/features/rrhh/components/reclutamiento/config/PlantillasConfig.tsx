import { useState, useMemo } from "react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pencil, Mail, Eye, Copy, Search, ChevronRight, Clock,
  Variable, CheckCircle2, XCircle, Sparkles, RefreshCw, Loader2, Trash2,
} from "lucide-react";
import {
  FASES_PRINCIPALES_ORDER,
  FASES_PRINCIPALES,
  ESTADOS_CONFIG,
  EMAIL_PLANTILLAS_FASE,
  type EstadoReclutamiento,
  type FasePrincipal,
  getFasePrincipal,
} from "@/features/rrhh/data/reclutamiento";
import { toast } from "sonner";

// ─── Variables disponibles (internas, no visibles como sección) ──
export const VARIABLES_DISPONIBLES = [
  { variable: "{{empresa_nombre}}", descripcion: "Nombre de la empresa" },
  { variable: "{{candidato_nombre}}", descripcion: "Nombre del candidato" },
  { variable: "{{candidato_apellidos}}", descripcion: "Apellidos del candidato" },
  { variable: "{{vacante_nombre}}", descripcion: "Nombre de la vacante" },
  { variable: "{{rol_nombre}}", descripcion: "Nombre del rol asociado" },
  { variable: "{{departamento_nombre}}", descripcion: "Departamento del puesto" },
  { variable: "{{fecha_entrevista}}", descripcion: "Fecha de la entrevista" },
  { variable: "{{hora_entrevista}}", descripcion: "Hora de la entrevista" },
  { variable: "{{ubicacion}}", descripcion: "Ubicación del puesto" },
  { variable: "{{reclutador_nombre}}", descripcion: "Nombre del reclutador asignado" },
  { variable: "{{email_contacto}}", descripcion: "Email de contacto de la empresa" },
  { variable: "{{telefono_empresa}}", descripcion: "Teléfono de la empresa" },
];

// ─── Plantilla state model ──────────────────────────────────────
export interface PlantillaEmail {
  id: string;
  nombreInterno: string;
  fase: FasePrincipal;
  estado: EstadoReclutamiento;
  asunto: string;
  cuerpo: string;
  activo: boolean;
  ultimaModificacion: string;
}

function buildPlantillasIniciales(): PlantillaEmail[] {
  return Object.entries(EMAIL_PLANTILLAS_FASE).map(([estado, tpl]) => {
    const est = estado as EstadoReclutamiento;
    const fase = getFasePrincipal(est);
    return {
      id: `tpl-${estado}`,
      nombreInterno: `Email cambio a ${ESTADOS_CONFIG[est].label}`,
      fase,
      estado: est,
      asunto: tpl.asunto,
      cuerpo: tpl.cuerpo,
      activo: tpl.activo,
      ultimaModificacion: "2026-04-01 10:00",
    };
  });
}

// ─── Preview with variable replacement ──────────────────────────
export function reemplazarVariables(texto: string, empresaNombre: string): string {
  return texto
    .replace(/\{\{empresa_nombre\}\}/g, empresaNombre)
    .replace(/\{\{candidato_nombre\}\}/g, "María")
    .replace(/\{\{candidato_apellidos\}\}/g, "García López")
    .replace(/\{\{vacante_nombre\}\}/g, "Camarero/a")
    .replace(/\{\{rol_nombre\}\}/g, "CAMARERO")
    .replace(/\{\{departamento_nombre\}\}/g, "Sala")
    .replace(/\{\{fecha_entrevista\}\}/g, "15/04/2026")
    .replace(/\{\{hora_entrevista\}\}/g, "10:00")
    .replace(/\{\{ubicacion\}\}/g, "Sala principal")
    .replace(/\{\{reclutador_nombre\}\}/g, "Antonio Ballesteros")
    .replace(/\{\{email_contacto\}\}/g, "rrhh@empresa.com")
    .replace(/\{\{telefono_empresa\}\}/g, "912 345 678");
}

// ─── AI generation mock (simulates generating email content) ────
const AI_TEMPLATES: Record<string, { asunto: string; cuerpo: string }> = {
  nuevo: {
    asunto: "Hemos recibido tu candidatura para {{vacante_nombre}} — {{empresa_nombre}}",
    cuerpo: `Estimado/a {{candidato_nombre}} {{candidato_apellidos}},

Gracias por inscribirte en nuestra oferta de {{vacante_nombre}} en {{empresa_nombre}}.

Hemos recibido correctamente tu candidatura y nuestro equipo la revisará con atención. Te mantendremos informado/a sobre el avance del proceso de selección.

Si tienes alguna pregunta, no dudes en contactarnos en {{email_contacto}} o llamando al {{telefono_empresa}}.

Un cordial saludo,
{{reclutador_nombre}}
{{empresa_nombre}}`,
  },
  elegido: {
    asunto: "Has sido preseleccionado/a — {{vacante_nombre}} en {{empresa_nombre}}",
    cuerpo: `Estimado/a {{candidato_nombre}} {{candidato_apellidos}},

Nos complace informarte de que, tras revisar tu perfil, has sido preseleccionado/a para avanzar en el proceso de selección de {{vacante_nombre}} en {{empresa_nombre}}.

Próximamente nos pondremos en contacto contigo para los siguientes pasos. Por favor, mantente atento/a a tu email y teléfono.

Para cualquier consulta: {{email_contacto}}

¡Enhorabuena y gracias por tu interés!
{{reclutador_nombre}}
{{empresa_nombre}}`,
  },
  papelera: {
    asunto: "Actualización sobre tu candidatura — {{empresa_nombre}}",
    cuerpo: `Estimado/a {{candidato_nombre}} {{candidato_apellidos}},

Gracias por haber participado en nuestro proceso de selección para {{vacante_nombre}}.

Tras evaluar todas las candidaturas, lamentamos comunicarte que en esta ocasión no continuarás en el proceso. Te animamos a seguir pendiente de futuras oportunidades en {{empresa_nombre}}.

Te deseamos mucho éxito profesional.

Un cordial saludo,
{{reclutador_nombre}}
{{empresa_nombre}}`,
  },
  entrevista: {
    asunto: "Convocatoria a entrevista — {{vacante_nombre}} en {{empresa_nombre}}",
    cuerpo: `Estimado/a {{candidato_nombre}} {{candidato_apellidos}},

Nos gustaría invitarte a una entrevista para el puesto de {{vacante_nombre}} en {{empresa_nombre}}.

📅 Fecha: {{fecha_entrevista}}
🕐 Hora: {{hora_entrevista}}
📍 Lugar: {{ubicacion}}

Por favor, confirma tu asistencia respondiendo a este email o contactando con {{reclutador_nombre}} en {{email_contacto}}.

¡Te esperamos!
{{reclutador_nombre}}
{{empresa_nombre}}`,
  },
  teorica: {
    asunto: "Prueba teórica programada — {{vacante_nombre}}",
    cuerpo: `Estimado/a {{candidato_nombre}} {{candidato_apellidos}},

Te informamos de que avanzas a la fase de prueba teórica para el puesto de {{vacante_nombre}} en {{empresa_nombre}}.

📅 Fecha: {{fecha_entrevista}}
🕐 Hora: {{hora_entrevista}}
📍 Lugar: {{ubicacion}}

Te enviaremos más detalles próximamente. Si tienes alguna duda, contacta con nosotros en {{email_contacto}}.

Mucho ánimo,
{{reclutador_nombre}}
{{empresa_nombre}}`,
  },
  practica: {
    asunto: "Prueba práctica — {{vacante_nombre}} en {{empresa_nombre}}",
    cuerpo: `Estimado/a {{candidato_nombre}} {{candidato_apellidos}},

¡Enhorabuena! Avanzas a la fase de prueba práctica para {{vacante_nombre}} en {{empresa_nombre}}.

📅 Fecha: {{fecha_entrevista}}
🕐 Hora: {{hora_entrevista}}
📍 Lugar: {{ubicacion}}

Te recomendamos venir preparado/a. Si necesitas más información, escríbenos a {{email_contacto}} o llama al {{telefono_empresa}}.

¡Te esperamos!
{{reclutador_nombre}}
{{empresa_nombre}}`,
  },
  prueba: {
    asunto: "Periodo de prueba — {{vacante_nombre}} en {{empresa_nombre}}",
    cuerpo: `Estimado/a {{candidato_nombre}} {{candidato_apellidos}},

Nos complace comunicarte que has sido seleccionado/a para iniciar el periodo de prueba en el puesto de {{vacante_nombre}} en {{empresa_nombre}}.

Ubicación: {{ubicacion}}
Departamento: {{departamento_nombre}}

Nuestro equipo te facilitará toda la información necesaria para tu incorporación. Para cualquier consulta previa, contacta con {{reclutador_nombre}} en {{email_contacto}}.

¡Bienvenido/a!
{{empresa_nombre}}`,
  },
  empleado: {
    asunto: "¡Bienvenido/a al equipo de {{empresa_nombre}}!",
    cuerpo: `Estimado/a {{candidato_nombre}} {{candidato_apellidos}},

¡Enhorabuena! Nos complace comunicarte que has completado con éxito el proceso de selección y te incorporas oficialmente al equipo de {{empresa_nombre}} como {{vacante_nombre}}.

📍 Ubicación: {{ubicacion}}
🏢 Departamento: {{departamento_nombre}}

Estamos encantados de contar contigo. {{reclutador_nombre}} te facilitará toda la información sobre tu incorporación.

¡Bienvenido/a a bordo!
{{empresa_nombre}}`,
  },
  no_se_presenta: {
    asunto: "Estado de tu candidatura — {{empresa_nombre}}",
    cuerpo: `Estimado/a {{candidato_nombre}} {{candidato_apellidos}},

Lamentamos informarte de que tu candidatura para {{vacante_nombre}} en {{empresa_nombre}} ha sido marcada como no presentada al no asistir a la convocatoria.

Si crees que se trata de un error o deseas retomar el proceso, por favor contacta con {{reclutador_nombre}} en {{email_contacto}} o llama al {{telefono_empresa}}.

Un cordial saludo,
{{empresa_nombre}}`,
  },
  suspenso_formacion: {
    asunto: "Resultado de tu formación — {{empresa_nombre}}",
    cuerpo: `Estimado/a {{candidato_nombre}} {{candidato_apellidos}},

Te informamos del resultado de tu fase de formación para el puesto de {{vacante_nombre}} en {{empresa_nombre}}.

Lamentablemente, la evaluación no ha sido superada en esta ocasión. Te animamos a seguir desarrollándote profesionalmente y a estar pendiente de futuras oportunidades.

Para más información, contacta con {{reclutador_nombre}} en {{email_contacto}}.

Te deseamos lo mejor,
{{empresa_nombre}}`,
  },
};

function generarConIA(estado: EstadoReclutamiento, contexto: string): Promise<{ asunto: string; cuerpo: string }> {
  // Simulates AI generation with a delay — in production this would call an AI endpoint
  return new Promise((resolve) => {
    setTimeout(() => {
      const base = AI_TEMPLATES[estado] || AI_TEMPLATES.nuevo;
      // If user provided custom context, adjust the tone indicator
      const customNote = contexto.trim()
        ? `\n\n[Generado según contexto: "${contexto.slice(0, 80)}"]`
        : "";
      resolve({
        asunto: base.asunto,
        cuerpo: base.cuerpo + customNote,
      });
    }, 1500);
  });
}

// ─── AI Generation Dialog ───────────────────────────────────────
function GenerarConIADialog({
  open,
  onOpenChange,
  estado,
  onGenerar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  estado: EstadoReclutamiento;
  onGenerar: (asunto: string, cuerpo: string) => void;
}) {
  const [contexto, setContexto] = useState("");
  const [generando, setGenerando] = useState(false);
  const estadoCfg = ESTADOS_CONFIG[estado];

  const handleGenerar = async () => {
    setGenerando(true);
    try {
      const resultado = await generarConIA(estado, contexto);
      onGenerar(resultado.asunto, resultado.cuerpo);
      onOpenChange(false);
      setContexto("");
      toast.success("Plantilla generada con IA correctamente");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            Generar plantilla con IA
          </DialogTitle>
          <DialogDescription>
            Estado: <Badge variant="secondary" className="text-[10px] ml-1">{estadoCfg.label}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-medium">Describe el email que necesitas</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
              Indica el tono, contexto o mensaje principal. La IA generará el asunto y cuerpo con las variables dinámicas incluidas automáticamente.
            </p>
            <Textarea
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              placeholder='Ej: "Quiero un email amable y cercano para citar al candidato a una entrevista presencial"'
              className="min-h-[100px] text-sm"
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              La IA incluirá automáticamente variables como <code className="text-[10px] font-mono bg-background px-1 rounded">{"{{candidato_nombre}}"}</code>, <code className="text-[10px] font-mono bg-background px-1 rounded">{"{{empresa_nombre}}"}</code>, etc.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generando}>
            Cancelar
          </Button>
          <Button onClick={handleGenerar} disabled={generando} className="gap-1.5">
            {generando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generar con IA
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Editor modal ───────────────────────────────────────────────
function PlantillaEditorDialog({
  plantilla,
  open,
  onOpenChange,
  onSave,
  empresaNombre,
  initialTab = "editar",
}: {
  plantilla: PlantillaEmail | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (p: PlantillaEmail) => void;
  empresaNombre: string;
  initialTab?: "editar" | "preview";
}) {
  const [form, setForm] = useState<PlantillaEmail | null>(null);
  const [tab, setTab] = useState<"editar" | "preview">(initialTab);
  const [showIA, setShowIA] = useState(false);

  // Sync form when plantilla changes or dialog opens
  const plantillaId = plantilla?.id;
  if (plantilla && (!form || form.id !== plantillaId)) {
    setForm({ ...plantilla });
    setTab(initialTab);
  }

  if (!plantilla || !form) return null;

  const handleSave = () => {
    if (!form) return;
    onSave({ ...form, ultimaModificacion: new Date().toLocaleString("es-ES") });
    onOpenChange(false);
    toast.success("Plantilla guardada correctamente");
  };

  const insertVariable = (variable: string) => {
    setForm((prev) => prev ? { ...prev, cuerpo: prev.cuerpo + " " + variable } : prev);
  };

  const handleIAGenerar = (asunto: string, cuerpo: string) => {
    setForm((prev) => prev ? { ...prev, asunto, cuerpo } : prev);
  };

  const faseCfg = FASES_PRINCIPALES[form.fase];
  const estadoCfg = ESTADOS_CONFIG[form.estado];

  return (
    <>
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
                {/* AI generation button */}
                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Generar con IA</p>
                      <p className="text-[11px] text-muted-foreground">Crea el contenido automáticamente con inteligencia artificial</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowIA(true)}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Crear con IA
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Nombre interno</Label>
                    <Input value={form.nombreInterno} onChange={(e) => setForm({ ...form, nombreInterno: e.target.value })} className="mt-1" />
                  </div>
                  <div className="flex items-end gap-3 pb-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
                      <Label className="text-xs">{form.activo ? "Activa" : "Inactiva"}</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Asunto del email</Label>
                  <Input value={form.asunto} onChange={(e) => setForm({ ...form, asunto: e.target.value })} className="mt-1" placeholder="Asunto del email..." />
                </div>

                <div>
                  <Label className="text-xs">Cuerpo del email</Label>
                  <Textarea
                    value={form.cuerpo}
                    onChange={(e) => setForm({ ...form, cuerpo: e.target.value })}
                    className="mt-1 min-h-[180px] font-mono text-sm"
                    placeholder="Escribe el contenido del email..."
                  />
                </div>

                <Separator />

                <div>
                  <Label className="text-xs flex items-center gap-1.5 mb-3">
                    <Variable className="h-3.5 w-3.5 text-primary" /> Variables disponibles
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Haz clic en una variable para insertarla en el cuerpo del email.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES_DISPONIBLES.map((v) => (
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
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 bg-muted/30 border-b border-border">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Para:</span> maria.garcia@email.com
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium">Asunto:</span> {reemplazarVariables(form.asunto, empresaNombre)}
                    </p>
                  </div>
                  <div className="p-5 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {reemplazarVariables(form.cuerpo, empresaNombre)}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground italic">
                  Esta vista previa muestra datos de ejemplo. Las variables se sustituirán con datos reales al enviar el email.
                </p>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Guardar plantilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GenerarConIADialog
        open={showIA}
        onOpenChange={setShowIA}
        estado={form.estado}
        onGenerar={handleIAGenerar}
      />
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export function PlantillasConfig() {
  const { empresaActual } = useEmpresa();
  const [plantillas, setPlantillas] = useState<PlantillaEmail[]>(buildPlantillasIniciales);
  const [editingPlantilla, setEditingPlantilla] = useState<PlantillaEmail | null>(null);
  const [editingTab, setEditingTab] = useState<"editar" | "preview">("editar");
  const [confirmDelete, setConfirmDelete] = useState<PlantillaEmail | null>(null);
  const [search, setSearch] = useState("");
  const [filtroFase, setFiltroFase] = useState<string>("todas");
  const [filtroActivo, setFiltroActivo] = useState<string>("todos");

  const filtered = useMemo(() => {
    let list = plantillas;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p) => p.nombreInterno.toLowerCase().includes(s) || p.asunto.toLowerCase().includes(s));
    }
    if (filtroFase !== "todas") list = list.filter((p) => p.fase === filtroFase);
    if (filtroActivo === "activas") list = list.filter((p) => p.activo);
    if (filtroActivo === "inactivas") list = list.filter((p) => !p.activo);
    return list;
  }, [plantillas, search, filtroFase, filtroActivo]);

  const handleSave = (updated: PlantillaEmail) => {
    setPlantillas((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setEditingPlantilla(null);
  };

  const handleToggle = (id: string) => {
    setPlantillas((prev) => prev.map((p) => p.id === id ? { ...p, activo: !p.activo, ultimaModificacion: new Date().toLocaleString("es-ES") } : p));
    toast.success("Estado de la plantilla actualizado");
  };

  const handleDuplicate = (p: PlantillaEmail) => {
    const dup: PlantillaEmail = {
      ...p,
      id: `tpl-dup-${Date.now()}`,
      nombreInterno: `${p.nombreInterno} (copia)`,
      activo: false,
      ultimaModificacion: new Date().toLocaleString("es-ES"),
    };
    setPlantillas((prev) => [...prev, dup]);
    toast.success("Plantilla duplicada");
  };

  const activasCount = plantillas.filter((p) => p.activo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">Plantillas de Email</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestiona las plantillas de email automático para cada fase y estado del proceso de selección.
          {" "}{activasCount} de {plantillas.length} plantillas activas.
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

      {/* Plantillas grouped by phase */}
      {FASES_PRINCIPALES_ORDER.map((fp) => {
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
                {fasePlantillas.filter((p) => p.activo).length} activas
              </span>
            </div>
            <CardContent className="p-0">
              {fasePlantillas.map((p) => {
                const estadoCfg = ESTADOS_CONFIG[p.estado];
                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-foreground">{p.nombreInterno}</span>
                          <Badge variant="secondary" className="text-[10px]">{estadoCfg.label}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          <span className="font-medium">Asunto:</span> {p.asunto}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {p.ultimaModificacion}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={p.activo ? "secondary" : "outline"}
                        className={`text-[10px] gap-1 ${p.activo ? "bg-emerald-100 text-emerald-700" : ""}`}
                      >
                        {p.activo ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {p.activo ? "Activa" : "Inactiva"}
                      </Badge>
                      <Switch checked={p.activo} onCheckedChange={() => handleToggle(p.id)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(p)} title="Duplicar">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setEditingTab("editar"); setEditingPlantilla(p); }}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setEditingTab("preview"); setEditingPlantilla(p); }}
                        title="Vista previa"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDelete(p)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* Editor Dialog */}
      <PlantillaEditorDialog
        plantilla={editingPlantilla}
        open={!!editingPlantilla}
        onOpenChange={(o) => !o && setEditingPlantilla(null)}
        onSave={handleSave}
        empresaNombre={empresaActual.nombre}
        initialTab={editingTab}
      />

      {/* Confirmar borrado */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar la plantilla <b>{confirmDelete?.nombreInterno}</b>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirmDelete) return;
                setPlantillas((prev) => prev.filter((p) => p.id !== confirmDelete.id));
                toast.success("Plantilla eliminada");
                setConfirmDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
