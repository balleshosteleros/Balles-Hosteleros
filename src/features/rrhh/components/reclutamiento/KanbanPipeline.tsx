import { useState, useCallback, useRef, useEffect } from "react";
import {
  FASES_PRINCIPALES,
  FASES_PRINCIPALES_ORDER,
  ESTADOS_CONFIG,
  ORIGEN_LABELS,
  EMAIL_PLANTILLAS_FASE,
  getFasePrincipal,
  puedeMoverA,
  siguienteEstado,
  type Candidato,
  type EstadoReclutamiento,
  type FasePrincipal,
  type HistorialCambioFase,
  type Vacante,
} from "@/features/rrhh/data/reclutamiento";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Phone, Mail, CalendarDays, MapPin, User,
  GripVertical, Clock, History, Send, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  enviarReclutamientoFaseEmail,
  listReclutamientoEmailPlantillas,
} from "@/features/rrhh/actions/reclutamiento-email-plantillas-actions";
import {
  sustituirVariablesReclutamiento,
  VARIABLES_RECLUTAMIENTO_EJEMPLO,
} from "@/features/rrhh/lib/reclutamiento-email";

interface KanbanPipelineProps {
  vacante: Vacante;
  onBack: () => void;
  onUpdateCandidatos: (candidatos: Candidato[]) => void;
}

const CURRENT_USER = "Admin RRHH";

// ─── Candidate Card ─────────────────────────────────────────────
function CandidatoCard({
  candidato,
  onDragStart,
  onClick,
}: {
  candidato: Candidato;
  onDragStart: (e: React.DragEvent, c: Candidato) => void;
  onClick: (c: Candidato) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, candidato)}
      onClick={() => onClick(candidato)}
      className="bg-card border border-border rounded-lg p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-[10px] shrink-0">
              {candidato.nombre[0]}{candidato.apellidos[0]}
            </div>
            <span className="font-medium text-xs text-foreground truncate">
              {candidato.nombre} {candidato.apellidos}
            </span>
          </div>
          <div className="space-y-0.5 text-[11px] text-muted-foreground pl-8">
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{candidato.email}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>{candidato.canal ? `${ORIGEN_LABELS[candidato.origen]} · ${candidato.canal}` : ORIGEN_LABELS[candidato.origen]}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Estado Column (inside a phase) ─────────────────────────────
function EstadoColumn({
  estado,
  candidatos,
  onDragStart,
  onDrop,
  onCardClick,
}: {
  estado: EstadoReclutamiento;
  candidatos: Candidato[];
  onDragStart: (e: React.DragEvent, c: Candidato) => void;
  onDrop: (estado: EstadoReclutamiento) => void;
  onCardClick: (c: Candidato) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const cfg = ESTADOS_CONFIG[estado];

  return (
    <div
      className={`flex flex-col min-w-[140px] flex-1 transition-colors rounded-lg ${
        dragOver ? "bg-primary/5 ring-1 ring-primary/30" : ""
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(estado); }}
    >
      {/* Estado header */}
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="text-[11px] font-medium text-muted-foreground">{cfg.label}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold">{candidatos.length}</Badge>
        <Mail className="h-3 w-3 text-muted-foreground/40 ml-auto" />
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 px-1 pb-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
        <div className="space-y-1.5">
          {candidatos.map((c) => (
            <CandidatoCard key={c.id} candidato={c} onDragStart={onDragStart} onClick={onCardClick} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Phase Group (main column with gradient header) ─────────────
function FaseGroup({
  fasePrincipal,
  candidatos,
  onDragStart,
  onDrop,
  onCardClick,
}: {
  fasePrincipal: FasePrincipal;
  candidatos: Candidato[];
  onDragStart: (e: React.DragEvent, c: Candidato) => void;
  onDrop: (estado: EstadoReclutamiento) => void;
  onCardClick: (c: Candidato) => void;
}) {
  const cfg = FASES_PRINCIPALES[fasePrincipal];
  const totalCount = candidatos.length;

  // Group candidates by estado within this phase
  const candidatosPorEstado = {} as Record<EstadoReclutamiento, Candidato[]>;
  for (const est of cfg.estados) {
    candidatosPorEstado[est] = candidatos.filter((c) => c.fase === est);
  }

  return (
    <div className="flex flex-col shrink-0" style={{ minWidth: cfg.estados.length === 1 ? "160px" : `${cfg.estados.length * 150}px` }}>
      {/* Phase header bar with gradient */}
      <div
        className="h-2 rounded-t-lg"
        style={{ background: `linear-gradient(90deg, ${cfg.colorFrom}, ${cfg.colorTo})` }}
      />

      {/* Phase label row */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-x border-border">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{cfg.label}</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-bold">{totalCount}</Badge>
      </div>

      {/* Estado columns inside */}
      <div className="flex gap-0.5 flex-1 border-x border-b border-border rounded-b-lg bg-muted/20 p-1">
        {cfg.estados.map((est) => (
          <EstadoColumn
            key={est}
            estado={est}
            candidatos={candidatosPorEstado[est]}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Candidate Detail with History ──────────────────────────────
function CandidatoDetailDialog({
  candidato, open, onOpenChange,
}: {
  candidato: Candidato | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  if (!candidato) return null;
  const fasePrincipal = getFasePrincipal(candidato.fase);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              {candidato.nombre[0]}{candidato.apellidos[0]}
            </div>
            <div>
              <div>{candidato.nombre} {candidato.apellidos}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="outline" className="text-[10px]" style={{ borderColor: FASES_PRINCIPALES[fasePrincipal].color, color: FASES_PRINCIPALES[fasePrincipal].color }}>
                  {FASES_PRINCIPALES[fasePrincipal].label}
                </Badge>
                <span className="text-muted-foreground text-[10px]">→</span>
                <Badge variant="secondary" className="text-[10px]">
                  {ESTADOS_CONFIG[candidato.fase].label}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid gap-2 text-sm">
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Teléfono" value={candidato.telefono} />
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={candidato.email} />
            <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Inscripción" value={candidato.fechaInscripcion} />
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Origen" value={candidato.canal ? `${ORIGEN_LABELS[candidato.origen]} · ${candidato.canal}` : ORIGEN_LABELS[candidato.origen]} />
            <InfoRow icon={<User className="h-4 w-4" />} label="Reclutador" value={candidato.reclutadorAsignado} />
          </div>
          {candidato.historial.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <History className="h-4 w-4" /> Historial de cambios
              </h4>
              <div className="space-y-2">
                {candidato.historial.map((h) => (
                  <div key={h.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50 text-xs">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="text-foreground">
                        <span className="font-medium">{FASES_PRINCIPALES[h.faseAnterior].label}</span>
                        <span className="text-muted-foreground mx-0.5">/</span>
                        <span>{ESTADOS_CONFIG[h.estadoAnterior].label}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span className="font-medium">{FASES_PRINCIPALES[h.faseNueva].label}</span>
                        <span className="text-muted-foreground mx-0.5">/</span>
                        <span>{ESTADOS_CONFIG[h.estadoNuevo].label}</span>
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {h.usuario} · {h.fecha}
                        {h.emailEnviado && (
                          <span className="ml-2 inline-flex items-center gap-1 text-primary">
                            <Send className="h-3 w-3" /> Email enviado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium text-muted-foreground w-24">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

// ─── Variable replacement for email preview ────────────────────
// Usa el MISMO motor de sustitución que el envío real, para que la previa
// coincida con lo que recibe el candidato. Los datos del candidato/vacante son
// reales; los de la empresa se muestran de ejemplo (en el envío salen los de la
// empresa activa, resueltos en servidor).
function reemplazarVariablesEmail(texto: string, candidato: Candidato, vacante: Vacante): string {
  const nombreCompleto = [candidato.nombre, candidato.apellidos]
    .filter(Boolean)
    .join(" ")
    .trim();
  const vars: Record<string, string> = {
    ...VARIABLES_RECLUTAMIENTO_EJEMPLO,
    candidato_nombre: candidato.nombre,
    candidato_apellidos: candidato.apellidos,
    candidato_nombre_completo: nombreCompleto || candidato.nombre,
    candidato_email: candidato.email,
    candidato_telefono: candidato.telefono,
    vacante_nombre: vacante.puesto,
    vacante_ubicacion: vacante.ubicacion,
    departamento_nombre: vacante.categoria || "",
  };
  return sustituirVariablesReclutamiento(texto, vars);
}

// ─── Email Confirmation Dialog ──────────────────────────────────
function EmailConfirmDialog({
  open, onOpenChange, candidato, estadoNuevo, vacante, onConfirm,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  candidato: Candidato | null; estadoNuevo: EstadoReclutamiento | null;
  vacante: Vacante;
  onConfirm: (enviarEmail: boolean) => void;
}) {
  // Plantilla real de BD para el estado destino (refleja ediciones y el flag
  // `activa`). Mientras carga, usa el texto de fábrica como respaldo.
  const [tpl, setTpl] = useState<{ asunto: string; cuerpo: string; activo: boolean } | null>(null);
  useEffect(() => {
    if (!open || !estadoNuevo) return;
    let cancel = false;
    setTpl(null);
    listReclutamientoEmailPlantillas()
      .then((list) => {
        if (cancel) return;
        const found = list.find((p) => p.estado === estadoNuevo);
        setTpl(
          found
            ? { asunto: found.asunto, cuerpo: found.cuerpo, activo: found.activa }
            : { ...EMAIL_PLANTILLAS_FASE[estadoNuevo] },
        );
      })
      .catch(() => {
        if (!cancel) setTpl({ ...EMAIL_PLANTILLAS_FASE[estadoNuevo] });
      });
    return () => {
      cancel = true;
    };
  }, [open, estadoNuevo]);

  if (!candidato || !estadoNuevo) return null;
  const plantilla = tpl ?? EMAIL_PLANTILLAS_FASE[estadoNuevo];
  const faseAnterior = getFasePrincipal(candidato.fase);
  const faseNueva = getFasePrincipal(estadoNuevo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Cambio de estado</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm space-y-2">
              <p>
                <span className="font-medium text-foreground">{candidato.nombre} {candidato.apellidos}</span>
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[11px]" style={{ borderColor: FASES_PRINCIPALES[faseAnterior].color, color: FASES_PRINCIPALES[faseAnterior].color }}>
                  {FASES_PRINCIPALES[faseAnterior].label}
                </Badge>
                <span className="text-muted-foreground">/</span>
                <Badge variant="secondary" className="text-[11px]">{ESTADOS_CONFIG[candidato.fase].label}</Badge>
                <span className="text-muted-foreground">→</span>
                <Badge variant="outline" className="text-[11px]" style={{ borderColor: FASES_PRINCIPALES[faseNueva].color, color: FASES_PRINCIPALES[faseNueva].color }}>
                  {FASES_PRINCIPALES[faseNueva].label}
                </Badge>
                <span className="text-muted-foreground">/</span>
                <Badge variant="secondary" className="text-[11px]">{ESTADOS_CONFIG[estadoNuevo].label}</Badge>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {plantilla.activo && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 mt-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Previsualización del email
            </p>
            <p className="text-xs text-muted-foreground"><span className="font-medium">Para:</span> {candidato.email}</p>
            <p className="text-xs text-muted-foreground"><span className="font-medium">Asunto:</span> {reemplazarVariablesEmail(plantilla.asunto, candidato, vacante)}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">{reemplazarVariablesEmail(plantilla.cuerpo, candidato, vacante)}</p>
          </div>
        )}

        {!plantilla.activo && (
          <div className="rounded-lg border border-border bg-amber-50 p-3 mt-2">
            <p className="text-xs text-amber-700">La plantilla para este estado está desactivada. No se enviará email automático.</p>
          </div>
        )}

        <p className="text-sm text-foreground mt-2">
          ¿Quieres enviar un email automático al candidato informándole del cambio?
        </p>

        <DialogFooter className="gap-2 sm:gap-2 mt-2">
          <Button variant="outline" onClick={() => onConfirm(false)} className="gap-1.5">
            <X className="h-4 w-4" /> No, no enviar email
          </Button>
          <Button onClick={() => onConfirm(true)} disabled={!plantilla.activo} className="gap-1.5">
            <Send className="h-4 w-4" /> Sí, enviar email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Kanban Pipeline ───────────────────────────────────────
export function KanbanPipeline({ vacante, onBack, onUpdateCandidatos }: KanbanPipelineProps) {
  const [candidatos, setCandidatos] = useState<Candidato[]>(vacante.candidatos);
  const [selectedCandidato, setSelectedCandidato] = useState<Candidato | null>(null);
  const draggedCandidato = useRef<Candidato | null>(null);

  const [emailConfirm, setEmailConfirm] = useState<{
    candidato: Candidato;
    estadoNuevo: EstadoReclutamiento;
  } | null>(null);

  const handleDragStart = useCallback((_e: React.DragEvent, c: Candidato) => {
    draggedCandidato.current = c;
  }, []);

  const handleDrop = useCallback((estadoDestino: EstadoReclutamiento) => {
    const c = draggedCandidato.current;
    if (!c || c.fase === estadoDestino) {
      draggedCandidato.current = null;
      return;
    }
    if (!puedeMoverA(c.fase, estadoDestino)) {
      const siguiente = siguienteEstado(c.fase);
      const sugerencia = siguiente
        ? ` Debe pasar primero por ${ESTADOS_CONFIG[siguiente].label}.`
        : "";
      toast.error("No se pueden saltar fases." + sugerencia);
      draggedCandidato.current = null;
      return;
    }
    setEmailConfirm({ candidato: c, estadoNuevo: estadoDestino });
    draggedCandidato.current = null;
  }, []);

  const handleConfirmMove = useCallback(async (enviarEmail: boolean) => {
    if (!emailConfirm) return;
    const { candidato: c, estadoNuevo } = emailConfirm;
    const faseAnterior = getFasePrincipal(c.fase);
    const faseNueva = getFasePrincipal(estadoNuevo);

    const historialEntry: HistorialCambioFase = {
      id: `h-${Date.now()}`,
      faseAnterior,
      estadoAnterior: c.fase,
      faseNueva,
      estadoNuevo,
      usuario: CURRENT_USER,
      fecha: new Date().toLocaleString("es-ES"),
      emailEnviado: enviarEmail,
    };

    const updated = candidatos.map((cand) =>
      cand.id === c.id
        ? { ...cand, fase: estadoNuevo, historial: [...cand.historial, historialEntry] }
        : cand
    );

    setCandidatos(updated);
    onUpdateCandidatos(updated);
    setEmailConfirm(null);

    const label = `${FASES_PRINCIPALES[faseNueva].label} / ${ESTADOS_CONFIG[estadoNuevo].label}`;
    if (enviarEmail) {
      const res = await enviarReclutamientoFaseEmail(c.id, estadoNuevo);
      if (res.sent) {
        toast.success(`Email enviado a ${c.nombre} ${c.apellidos}`, { description: label });
      } else {
        toast.warning(`${c.nombre} ${c.apellidos} movido a ${label}`, {
          description: `El email no se envió: ${res.reason ?? "motivo desconocido"}`,
        });
      }
    } else {
      toast.info(`${c.nombre} ${c.apellidos} movido a ${label}`, { description: "Sin envío de email" });
    }
  }, [emailConfirm, candidatos, onUpdateCandidatos]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground">{vacante.puesto}</h2>
            <p className="text-sm text-muted-foreground">
              {candidatos.length} candidatos · {vacante.ubicacion} · Pipeline de selección
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          Arrastra candidatos entre estados para cambiar su fase
        </Badge>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-2 min-w-max">
          {FASES_PRINCIPALES_ORDER.map((fase) => (
            <FaseGroup
              key={fase}
              fasePrincipal={fase}
              candidatos={candidatos.filter((c) => getFasePrincipal(c.fase) === fase)}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onCardClick={setSelectedCandidato}
            />
          ))}
        </div>
      </div>

      <CandidatoDetailDialog
        candidato={selectedCandidato}
        open={!!selectedCandidato}
        onOpenChange={(o) => !o && setSelectedCandidato(null)}
      />

      <EmailConfirmDialog
        open={!!emailConfirm}
        onOpenChange={(o) => !o && setEmailConfirm(null)}
        candidato={emailConfirm?.candidato ?? null}
        estadoNuevo={emailConfirm?.estadoNuevo ?? null}
        vacante={vacante}
        onConfirm={handleConfirmMove}
      />
    </div>
  );
}
