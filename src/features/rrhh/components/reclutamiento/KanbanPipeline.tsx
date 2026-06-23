import { useState, useCallback, useRef, useEffect } from "react";
import {
  FASES_PRINCIPALES,
  FASES_PRINCIPALES_ORDER,
  ESTADOS_CONFIG,
  ORIGEN_LABELS,
  getFasePrincipal,
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
  ArrowLeft, Mail, MailCheck, MapPin,
  GripVertical, Send, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  enviarReclutamientoFaseEmail,
  previewReclutamientoFaseEmail,
  estadosConEmailDeVacante,
} from "@/features/rrhh/actions/reclutamiento-email-plantillas-actions";
import {
  sustituirVariablesReclutamiento,
  VARIABLES_RECLUTAMIENTO_EJEMPLO,
  parsearEnlacesCuerpo,
} from "@/features/rrhh/lib/reclutamiento-email";
import { CandidatoDetailModal } from "@/features/rrhh/components/reclutamiento/CandidatoDetailModal";
import { moverCandidatoAVacante } from "@/features/rrhh/actions/candidatos-actions";

interface KanbanPipelineProps {
  vacante: Vacante;
  /** Todas las vacantes (para reasignar un candidato a otra). */
  vacantes?: Vacante[];
  onBack: () => void;
  onUpdateCandidatos: (candidatos: Candidato[]) => void;
  /** Se llama tras reasignar un candidato a otra vacante (para refrescar). */
  onMoved?: () => void;
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
          <span className="block font-semibold text-xs text-foreground truncate mb-1">
            {candidato.nombre} {candidato.apellidos}
          </span>
          <div className="space-y-0.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1 min-w-0">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{candidato.email}</span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{candidato.canal ? `${ORIGEN_LABELS[candidato.origen]} · ${candidato.canal}` : ORIGEN_LABELS[candidato.origen]}</span>
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
  tieneEmail,
  onDragStart,
  onDrop,
  onCardClick,
}: {
  estado: EstadoReclutamiento;
  candidatos: Candidato[];
  tieneEmail: boolean;
  onDragStart: (e: React.DragEvent, c: Candidato) => void;
  onDrop: (estado: EstadoReclutamiento) => void;
  onCardClick: (c: Candidato) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const cfg = ESTADOS_CONFIG[estado];

  return (
    <div
      className={`flex flex-col min-w-0 flex-1 transition-colors rounded-lg ${
        dragOver ? "bg-primary/5 ring-1 ring-primary/30" : ""
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(estado); }}
    >
      {/* Estado header */}
      <div className="flex items-center gap-1.5 px-2 py-2">
        <span className="text-[11px] font-medium text-muted-foreground truncate">{cfg.label}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold shrink-0">{candidatos.length}</Badge>
        {tieneEmail ? (
          <MailCheck
            className="h-3 w-3 text-emerald-600 ml-auto shrink-0"
            aria-label="Esta fase tiene email configurado"
          />
        ) : (
          <Mail
            className="h-3 w-3 text-muted-foreground/40 ml-auto shrink-0"
            aria-label="Esta fase no tiene email configurado"
          />
        )}
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 px-1 pb-1 [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!min-w-0" style={{ maxHeight: "calc(100vh - 280px)" }}>
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
  estadosConEmail,
  onDragStart,
  onDrop,
  onCardClick,
}: {
  fasePrincipal: FasePrincipal;
  candidatos: Candidato[];
  estadosConEmail: Set<string>;
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
    <div className="flex flex-col min-w-0" style={{ flex: cfg.estados.length }}>
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
            tieneEmail={estadosConEmail.has(est)}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onCardClick={onCardClick}
          />
        ))}
      </div>
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
  // Plantilla asociada al estado destino de ESTE candidato (resuelta en servidor
  // vía su vacante → plantilla de estados / override por vacante).
  // undefined = cargando · null = sin email asociado a este estado.
  const [tpl, setTpl] = useState<{ asunto: string; cuerpo: string; activa: boolean } | null | undefined>(undefined);
  useEffect(() => {
    if (!open || !estadoNuevo || !candidato) return;
    let cancel = false;
    setTpl(undefined);
    previewReclutamientoFaseEmail(candidato.id, estadoNuevo)
      .then((res) => { if (!cancel) setTpl(res); })
      .catch(() => { if (!cancel) setTpl(null); });
    return () => {
      cancel = true;
    };
  }, [open, estadoNuevo, candidato]);

  if (!candidato || !estadoNuevo) return null;
  const cargando = tpl === undefined;
  const tieneEmail = !!tpl;
  const emailActiva = !!tpl?.activa;
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

        {cargando && (
          <p className="text-xs text-muted-foreground mt-2">Comprobando la plantilla asociada…</p>
        )}

        {!cargando && tieneEmail && emailActiva && tpl && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 mt-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Previsualización del email
            </p>
            <p className="text-xs text-muted-foreground"><span className="font-medium">Para:</span> {candidato.email}</p>
            <p className="text-xs text-muted-foreground"><span className="font-medium">Asunto:</span> {reemplazarVariablesEmail(tpl.asunto, candidato, vacante)}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1 whitespace-pre-wrap">
              {parsearEnlacesCuerpo(reemplazarVariablesEmail(tpl.cuerpo, candidato, vacante)).map((seg, i) =>
                seg.type === "link" ? (
                  <a key={i} href={seg.href} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    {seg.text}
                  </a>
                ) : (
                  <span key={i}>{seg.value}</span>
                ),
              )}
            </p>
          </div>
        )}

        {!cargando && tieneEmail && !emailActiva && (
          <div className="rounded-lg border border-border bg-amber-50 p-3 mt-2">
            <p className="text-xs text-amber-700">La plantilla asociada a este estado está desactivada. No se enviará email automático.</p>
          </div>
        )}

        {!cargando && !tieneEmail && (
          <div className="rounded-lg border border-border bg-amber-50 p-3 mt-2">
            <p className="text-xs text-amber-700">No hay ninguna plantilla de email asociada a este estado. Se moverá sin enviar correo.</p>
          </div>
        )}

        <p className="text-sm text-foreground mt-2">
          ¿Quieres enviar un email automático al candidato informándole del cambio?
        </p>

        <DialogFooter className="gap-2 sm:gap-2 mt-2">
          <Button variant="outline" onClick={() => onConfirm(false)} className="gap-1.5">
            <X className="h-4 w-4" /> No, no enviar email
          </Button>
          <Button onClick={() => onConfirm(true)} disabled={!emailActiva} className="gap-1.5">
            <Send className="h-4 w-4" /> Sí, enviar email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Kanban Pipeline ───────────────────────────────────────
export function KanbanPipeline({ vacante, vacantes = [], onBack, onUpdateCandidatos, onMoved }: KanbanPipelineProps) {
  const [candidatos, setCandidatos] = useState<Candidato[]>(vacante.candidatos);
  const [selectedCandidato, setSelectedCandidato] = useState<Candidato | null>(null);
  const draggedCandidato = useRef<Candidato | null>(null);

  const handleMoverVacante = useCallback(
    async (c: Candidato, vacanteId: string, estado: EstadoReclutamiento) => {
      const fase = getFasePrincipal(estado);
      const res = await moverCandidatoAVacante(c.id, vacanteId, fase, estado);
      if (!res.ok) {
        toast.error(("error" in res && res.error) || "No se pudo mover de vacante");
        return;
      }
      setCandidatos((prev) => prev.filter((x) => x.id !== c.id));
      setSelectedCandidato(null);
      toast.success("Candidato movido de vacante");
      onMoved?.();
    },
    [onMoved],
  );

  // Estados (columnas) de esta vacante que tienen un email activo configurado:
  // se marca con un check verde en la cabecera de cada columna.
  const [estadosConEmail, setEstadosConEmail] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancel = false;
    estadosConEmailDeVacante(vacante.id)
      .then((ests) => { if (!cancel) setEstadosConEmail(new Set(ests)); })
      .catch(() => { if (!cancel) setEstadosConEmail(new Set()); });
    return () => { cancel = true; };
  }, [vacante.id]);

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
    // Movimiento libre: cualquier estado/fase, hacia delante o hacia atrás.
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
              {candidatos.length} candidatos · {vacante.ubicacion}
            </p>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-2 w-full">
          {FASES_PRINCIPALES_ORDER.map((fase) => (
            <FaseGroup
              key={fase}
              fasePrincipal={fase}
              candidatos={candidatos.filter((c) => getFasePrincipal(c.fase) === fase)}
              estadosConEmail={estadosConEmail}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onCardClick={setSelectedCandidato}
            />
          ))}
        </div>
      </div>

      <CandidatoDetailModal
        open={!!selectedCandidato}
        onOpenChange={(o) => !o && setSelectedCandidato(null)}
        candidato={selectedCandidato}
        candidatos={candidatos}
        vacante={vacante}
        vacantes={vacantes}
        onSelectCandidato={setSelectedCandidato}
        onUpdateCandidato={(updated) => {
          setCandidatos((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setSelectedCandidato(updated);
        }}
        onMoverVacante={handleMoverVacante}
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
