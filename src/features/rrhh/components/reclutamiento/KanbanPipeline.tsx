import { useState, useCallback, useRef, useEffect } from "react";
import {
  FASES_PRINCIPALES,
  FASES_PRINCIPALES_ORDER,
  ESTADOS_CONFIG,
  getFasePrincipal,
  estadoRequiereResenas,
  estadoRequiereDocumentacion,
  type Candidato,
  type EstadoReclutamiento,
  type FasePrincipal,
  type HistorialCambioFase,
  type Vacante,
} from "@/features/rrhh/data/reclutamiento";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Mail, MailCheck,
  Send, X, UsersRound, CheckCircle2,
  MinusCircle, XCircle, Star, CalendarDays, Eye, FileText,
  Building2, UserCog,
} from "lucide-react";
import { toast } from "sonner";
import {
  enviarReclutamientoFaseEmail,
  previewReclutamientoFaseEmail,
  plantillasPorEstadoDeVacante,
  type PlantillaFaseInfo,
} from "@/features/rrhh/actions/reclutamiento-email-plantillas-actions";
import { parsearEnlacesCuerpo } from "@/features/rrhh/lib/reclutamiento-email";
import { CandidatoDetailModal } from "@/features/rrhh/components/reclutamiento/CandidatoDetailModal";
import { ContratarDialog } from "@/features/rrhh/components/reclutamiento/ContratarDialog";
import { moverCandidatoAVacante } from "@/features/rrhh/actions/candidatos-actions";
import {
  getReclutamientoConfigGeneral,
  type ReclutamientoConfigGeneral,
} from "@/features/rrhh/actions/gestoria-actions";

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

// ─── Distintivo del cuestionario ────────────────────────────────
// Solo se muestra si el candidato respondió el cuestionario de la vacante.
//  · 5/5 aciertos  → aprobado: tick verde
//  · 3–4 aciertos  → naranja con una línea en medio (parcial)
//  · 0–2 aciertos  → suspenso: X roja
function CuestionarioBadge({ aciertos, total }: { aciertos: number; total: number }) {
  // 5 de 5 = aprobado pleno. El umbral "aprobado" es acertar TODAS.
  const aprobado = total > 0 && aciertos === total;
  const titulo = `Cuestionario · ${aciertos}/${total} correctas`;
  if (aprobado) {
    return (
      <span className="shrink-0 text-emerald-600" title={titulo} aria-label={titulo}>
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (aciertos >= 3) {
    return (
      <span className="shrink-0 text-orange-500" title={titulo} aria-label={titulo}>
        <MinusCircle className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="shrink-0 text-red-600" title={titulo} aria-label={titulo}>
      <XCircle className="h-3.5 w-3.5" />
    </span>
  );
}

// ─── Distintivo de documentación ────────────────────────────────
// Documento ROJO = el candidato aún no ha completado su documentación (paso
// obligatorio antes de Formación); documento VERDE = ya la entregó. Ocupa una
// posición fija en la zona de distintivos de la tarjeta (junto al cuestionario).
function DocumentacionBadge({ completa }: { completa: boolean }) {
  const titulo = completa
    ? "Documentación · recibida"
    : "Documentación · pendiente";
  return (
    <span
      className={`shrink-0 ${completa ? "text-emerald-600" : "text-red-600"}`}
      title={titulo}
      aria-label={titulo}
    >
      <FileText className="h-3.5 w-3.5" />
    </span>
  );
}

/** Días completos en la fase actual (se reinicia a 0 al cambiar de fase). */
function diasEnFaseDe(candidato: Candidato): number | null {
  const desde = candidato.faseActualizadaAt;
  if (!desde) return null;
  const t = new Date(desde).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

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
  const dias = diasEnFaseDe(candidato);
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, candidato)}
      onClick={() => onClick(candidato)}
      className="relative bg-card border border-border rounded-lg p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
    >
      {/* Esquina superior derecha: días en la fase actual (se reinicia al cambiar de fase). */}
      {dias !== null && (
        <span
          className="absolute top-1 right-1 inline-flex items-center gap-0.5 rounded bg-muted/70 px-1 py-0.5 text-[9px] font-semibold text-muted-foreground tabular-nums"
          title="Días en la fase actual"
        >
          <CalendarDays className="h-2.5 w-2.5" />
          {dias === 0 ? "hoy" : `${dias}d`}
        </span>
      )}
      {/* Sin manejador de arrastre lateral: la tarjeta entera es draggable, así
          que el texto aprovecha todo el ancho. */}
      <div className="flex items-start">
        <div className="flex-1 min-w-0">
          <div className="mb-1 pr-10">
            {/* Nombre y apellidos SIEMPRE visibles (sin truncar: hace wrap).
                Ningún icono comparte línea con el nombre: todos van abajo. */}
            <span className="font-semibold text-xs text-foreground break-words leading-snug">
              {candidato.nombre} {candidato.apellidos}
            </span>
          </div>
          <div className="space-y-0.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1 min-w-0">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{candidato.email}</span>
            </div>
          </div>
          {/* Fila inferior de indicadores: todos los iconos/badges juntos,
              en horizontal, como la estrella de reseñas. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {/* Nota media de las reseñas de la entrevista (1–5 estrellas). */}
            {candidato.resenaMedia != null && (
              <span
                className="inline-flex items-center gap-0.5"
                title={`Reseñas · ${candidato.resenaMedia.toFixed(1)} / 5`}
              >
                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                <span className="font-medium text-foreground/80 text-[11px]">
                  {candidato.resenaMedia.toFixed(1).replace(".", ",")}
                </span>
              </span>
            )}
            {/* Resultado del cuestionario de la vacante (verde/naranja/rojo). */}
            {candidato.cuestionarioTotal != null && candidato.cuestionarioTotal > 0 && (
              <CuestionarioBadge
                aciertos={candidato.cuestionarioAciertos ?? 0}
                total={candidato.cuestionarioTotal}
              />
            )}
            {/* Documentación: documento rojo (pendiente) / verde (recibida). */}
            <DocumentacionBadge completa={!!candidato.documentacionCompletadaAt} />
            {/* «Visto»: ojo verde cuando la ficha ya se revisó (se abrió). */}
            {candidato.vistoAt && (
              <span className="shrink-0 text-emerald-600" title="Candidato visto" aria-label="Candidato visto">
                <Eye className="h-3 w-3" />
              </span>
            )}
            {/* Candidato ya contratado: distintivo de empleado (icono RRHH + tick, en verde). */}
            {candidato.promovidoAt && (
              <span
                className="inline-flex items-center gap-0.5 shrink-0 text-emerald-600"
                title="Contratado · empleado"
                aria-label="Contratado · empleado"
              >
                <UsersRound className="h-3 w-3" />
                <CheckCircle2 className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Icono informativo del destino de un correo ─────────────────
// Gestoría = edificio · RRHH = persona con engranaje. El candidato no lleva
// icono (es el destinatario por defecto).
function DestinoIcon({ destino }: { destino: PlantillaFaseInfo["destino"] }) {
  if (destino === "gestoria") {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700"
        title="Este correo se envía a la gestoría, no al candidato"
      >
        <Building2 className="h-2.5 w-2.5" /> Gestoría
      </span>
    );
  }
  if (destino === "rrhh") {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1 py-0.5 text-[9px] font-medium text-sky-700"
        title="Este correo es un aviso interno a RRHH, no al candidato"
      >
        <UserCog className="h-2.5 w-2.5" /> RRHH
      </span>
    );
  }
  return null;
}

// ─── Icono de email de una columna (con popover de plantillas) ──
// Verde si la fase tiene algún correo activo; gris si no hay ninguno. Al pulsar
// muestra el nombre de la(s) plantilla(s) asociada(s) y a quién se envía cada una.
function EmailFaseIcon({
  estadoLabel,
  plantillas,
}: {
  estadoLabel: string;
  plantillas: PlantillaFaseInfo[];
}) {
  const tieneAlgunaActiva = plantillas.some((p) => p.activa);
  const sinPlantillas = plantillas.length === 0;

  const boton = sinPlantillas ? (
    <Mail
      className="h-3 w-3 text-muted-foreground/40 ml-auto shrink-0"
      aria-label="Esta fase no tiene correo asignado"
    />
  ) : tieneAlgunaActiva ? (
    <MailCheck className="h-3 w-3 text-emerald-600" aria-hidden />
  ) : (
    <Mail className="h-3 w-3 text-muted-foreground/60" aria-hidden />
  );

  if (sinPlantillas) {
    // Sin plantillas: solo el icono gris, sin popover (no hay nada que mostrar).
    return boton;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ml-auto shrink-0 rounded p-0.5 hover:bg-muted transition-colors"
          aria-label={`Ver correos de la fase ${estadoLabel}`}
          title={`Correos de ${estadoLabel}`}
          onClick={(e) => e.stopPropagation()}
        >
          {boton}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          {plantillas.map((p, i) => (
            <div
              key={`${p.nombre}-${i}`}
              className="flex items-center gap-2 px-1 py-0.5"
            >
              <span className="min-w-0 flex-1 truncate text-xs text-foreground" title={p.nombre}>
                {p.nombre}
              </span>
              <DestinoIcon destino={p.destino} />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Estado Column (inside a phase) ─────────────────────────────
function EstadoColumn({
  estado,
  candidatos,
  plantillas,
  mostrarContador,
  compact = false,
  onDragStart,
  onDrop,
  onCardClick,
}: {
  estado: EstadoReclutamiento;
  candidatos: Candidato[];
  plantillas: PlantillaFaseInfo[];
  mostrarContador: boolean;
  /** Banda inferior (Descartado): tira de baja altura para no robar espacio. */
  compact?: boolean;
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
        {mostrarContador && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold shrink-0">{candidatos.length}</Badge>
        )}
        <EmailFaseIcon estadoLabel={cfg.label} plantillas={plantillas} />
      </div>

      {/* Cards */}
      <ScrollArea
        className="flex-1 px-1 pb-1 [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!min-w-0"
        style={{ maxHeight: compact ? "240px" : "calc(100vh - 280px)" }}
      >
        <div className="space-y-1.5 min-h-[36px]">
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
  plantillasPorEstado,
  mostrarContador,
  compact = false,
  onDragStart,
  onDrop,
  onCardClick,
}: {
  fasePrincipal: FasePrincipal;
  candidatos: Candidato[];
  plantillasPorEstado: Record<string, PlantillaFaseInfo[]>;
  mostrarContador: boolean;
  /** Banda inferior horizontal (Descartado) en vez de columna alta. */
  compact?: boolean;
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
    <div className="flex flex-col min-w-0" style={compact ? undefined : { flex: cfg.estados.length }}>
      {/* Phase header bar with gradient */}
      <div
        className="h-2 rounded-t-lg"
        style={{ background: `linear-gradient(90deg, ${cfg.colorFrom}, ${cfg.colorTo})` }}
      />

      {/* Phase label row */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-x border-border">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{cfg.label}</span>
        {mostrarContador && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-bold">{totalCount}</Badge>
        )}
      </div>

      {/* Estado columns inside */}
      <div className="flex gap-0.5 flex-1 border-x border-b border-border rounded-b-lg bg-muted/20 p-1">
        {cfg.estados.map((est) => (
          <EstadoColumn
            key={est}
            estado={est}
            candidatos={candidatosPorEstado[est]}
            plantillas={plantillasPorEstado[est] ?? []}
            mostrarContador={mostrarContador}
            compact={compact}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Email Confirmation Dialog ──────────────────────────────────
function EmailConfirmDialog({
  open, onOpenChange, candidato, estadoNuevo, onConfirm,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  candidato: Candidato | null; estadoNuevo: EstadoReclutamiento | null;
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
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
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

        <div className="mt-2 space-y-2">
        {cargando && (
          <p className="text-xs text-muted-foreground">Comprobando la plantilla asociada…</p>
        )}

        {!cargando && tieneEmail && emailActiva && tpl && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Previsualización del email
            </p>
            <p className="text-xs text-muted-foreground"><span className="font-medium">Para:</span> {candidato.email}</p>
            <p className="text-xs text-muted-foreground"><span className="font-medium">Asunto:</span> {tpl.asunto}</p>
            {/* Asunto/cuerpo llegan YA sustituidos con los datos reales desde el
                servidor (previewReclutamientoFaseEmail), así que la previa coincide
                con el correo que recibirá el candidato. El cuerpo hace scroll por
                dentro si es largo: así la caja siempre mide lo mismo. */}
            <p className="text-xs text-muted-foreground leading-relaxed mt-1 whitespace-pre-wrap max-h-[40vh] overflow-y-auto pr-1">
              {parsearEnlacesCuerpo(tpl.cuerpo).map((seg, i) =>
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
          <div className="rounded-lg border border-border bg-amber-50 p-3">
            <p className="text-xs text-amber-700">La plantilla asociada a este estado está desactivada. No se enviará email automático.</p>
          </div>
        )}

        {!cargando && !tieneEmail && (
          <div className="rounded-lg border border-border bg-amber-50 p-3">
            <p className="text-xs text-amber-700">No hay ninguna plantilla de email asociada a este estado. Se moverá sin enviar correo.</p>
          </div>
        )}

        <p className="text-sm text-foreground">
          ¿Quieres enviar un email automático al candidato informándole del cambio?
        </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 mt-2 shrink-0">
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
  const [contratarCand, setContratarCand] = useState<Candidato | null>(null);
  // Candidato arrastrado a la fase «Contratación»: abre el diálogo en modo
  // «iniciar» (PRP-070) en vez de mover directamente.
  const [iniciarContratacionCand, setIniciarContratacionCand] = useState<Candidato | null>(null);
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

  // Plantillas de email asociadas a cada estado de esta vacante. Pinta el icono
  // de cada columna (verde si hay correo activo) y, al pulsarlo, lista las
  // plantillas y a quién se envían (candidato · gestoría · RRHH).
  const [plantillasPorEstado, setPlantillasPorEstado] = useState<Record<string, PlantillaFaseInfo[]>>({});
  useEffect(() => {
    let cancel = false;
    plantillasPorEstadoDeVacante(vacante.id)
      .then((map) => { if (!cancel) setPlantillasPorEstado(map); })
      .catch(() => { if (!cancel) setPlantillasPorEstado({}); });
    return () => { cancel = true; };
  }, [vacante.id]);

  // Configuración general de reclutamiento (Ajustes → RRHH → Reclutamiento).
  // Gobierna el envío de emails al cambiar de fase y el contador de candidatos.
  const [config, setConfig] = useState<ReclutamientoConfigGeneral | null>(null);
  useEffect(() => {
    let cancel = false;
    getReclutamientoConfigGeneral()
      .then((r) => { if (!cancel) setConfig(r.data); })
      .catch(() => { /* defaults se aplican abajo */ });
    return () => { cancel = true; };
  }, []);
  const mostrarContador = config?.mostrar_contador_candidatos ?? true;

  // Candidatos inactivos: se conservan, pero NO aparecen en el pipeline.
  const candidatosVisibles = candidatos.filter((c) => c.activo !== false);

  const [emailConfirm, setEmailConfirm] = useState<{
    candidato: Candidato;
    estadoNuevo: EstadoReclutamiento;
  } | null>(null);

  const handleDragStart = useCallback((_e: React.DragEvent, c: Candidato) => {
    draggedCandidato.current = c;
  }, []);

  // Aplica el movimiento (estado local + persistencia vía onUpdateCandidatos) y,
  // si procede, envía el email de fase. Se usa tanto desde el diálogo de
  // confirmación como en el envío directo (sin confirmación).
  const performMove = useCallback(async (c: Candidato, estadoNuevo: EstadoReclutamiento, enviarEmail: boolean) => {
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
  }, [candidatos, onUpdateCandidatos]);

  const handleDrop = useCallback((estadoDestino: EstadoReclutamiento) => {
    const c = draggedCandidato.current;
    draggedCandidato.current = null;
    if (!c || c.fase === estadoDestino) return;
    // Requisito de reseñas: para entrar en «Documentación» o cualquier fase por
    // delante (Formación), o para descartarlo (ya tuvo la entrevista), el
    // candidato debe tener la valoración de la entrevista COMPLETA (todas las
    // reseñas con todos los criterios puntuados). Única excepción: «Papelera».
    if (estadoRequiereResenas(estadoDestino) && !c.resenasCompletas) {
      toast.error(
        `${c.nombre} ${c.apellidos} no tiene la entrevista valorada`,
        {
          description:
            "Antes de avanzar a esta fase debes completar TODAS las reseñas de la entrevista (todos los criterios). Solo «Papelera» no lo requiere.",
        },
      );
      return;
    }
    // Requisito de documentación: para entrar en Formación (Teórica en adelante)
    // el candidato debe haber COMPLETADO su documentación. No se puede avanzar
    // hasta que esté todo; el documento de la tarjeta está en rojo hasta entonces.
    if (estadoRequiereDocumentacion(estadoDestino) && !c.documentacionCompletadaAt) {
      toast.error(
        `${c.nombre} ${c.apellidos} no ha entregado la documentación`,
        {
          description:
            "Para pasar a Formación el candidato debe completar su documentación desde el enlace que recibe en la fase «Documentación». No se puede avanzar hasta que esté todo.",
        },
      );
      return;
    }
    // Entrada en la columna «Contratación» (PRP-070): no es un simple move. Abre
    // el diálogo en modo «iniciar» para recoger puesto/primer día/local y disparar
    // el orquestador (crea empleado + alta gestoría + contrato interno). Se
    // compara por ESTADO (columna), no por fase principal: Formación, Contratación,
    // Prueba y Empleado comparten la misma fase «onboarding».
    if (estadoDestino === "contratacion" && c.fase !== "contratacion") {
      setIniciarContratacionCand(c);
      return;
    }
    // Movimiento libre: cualquier estado/fase, hacia delante o hacia atrás.
    // Emails automáticos al cambiar de fase. Comportamiento SEGURO por defecto:
    // si la config aún no ha cargado (config === null) o no está definida, se
    // PREGUNTA (no se salta el email en silencio). Solo si el usuario desactivó
    // explícitamente los emails automáticos se mueve sin correo.
    if (config && config.emails_auto_cambio_fase === false) {
      void performMove(c, estadoDestino, false);
      return;
    }
    // Emails activos (o config no cargada aún): pedir confirmación salvo que el
    // usuario haya desactivado explícitamente "pedir confirmación".
    if (config && config.emails_pedir_confirmacion === false) {
      void performMove(c, estadoDestino, true);
      return;
    }
    setEmailConfirm({ candidato: c, estadoNuevo: estadoDestino });
  }, [config, performMove]);

  const handleConfirmMove = useCallback((enviarEmail: boolean) => {
    if (!emailConfirm) return;
    const { candidato, estadoNuevo } = emailConfirm;
    setEmailConfirm(null);
    void performMove(candidato, estadoNuevo, enviarEmail);
  }, [emailConfirm, performMove]);

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
              {mostrarContador ? `${candidatosVisibles.length} candidatos · ` : ""}{vacante.ubicacion}
            </p>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      {/* Layout: las 4 fases apiladas una debajo de otra (Selección · Onboarding ·
          Offboarding · Descartado). Cada fase es una banda horizontal a todo el
          ancho con sus 4 estados en fila. Arrastrar una tarjeta a cualquier estado
          la mueve a esa columna, respetando las reglas de reseñas/documentación. */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {FASES_PRINCIPALES_ORDER.map((fase) => (
          <div key={fase} className="w-full">
            <FaseGroup
              fasePrincipal={fase}
              candidatos={candidatosVisibles.filter((c) => getFasePrincipal(c.fase) === fase)}
              plantillasPorEstado={plantillasPorEstado}
              mostrarContador={mostrarContador}
              compact
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onCardClick={setSelectedCandidato}
            />
          </div>
        ))}
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
        onContratar={(c) => {
          setSelectedCandidato(null);
          setContratarCand(c);
        }}
      />

      <ContratarDialog
        open={!!contratarCand}
        onOpenChange={(o) => !o && setContratarCand(null)}
        candidato={contratarCand ? {
          id: contratarCand.id,
          nombre: contratarCand.nombre,
          apellidos: contratarCand.apellidos,
          email: contratarCand.email,
          vacantePuestoId: vacante.puestoId ?? null,
        } : null}
        onDone={() => {
          // Tras contratar (paso 1) el candidato queda promovido: refresca desde
          // BD. NO cerramos el diálogo: sigue en el paso 2 (alta a gestoría)
          // hasta que el usuario lo cierre.
          onMoved?.();
        }}
      />

      {/* Diálogo de ENTRADA en la fase Contratación (PRP-070): se abre al
          arrastrar un candidato a esa fase. */}
      <ContratarDialog
        variante="iniciar"
        open={!!iniciarContratacionCand}
        onOpenChange={(o) => !o && setIniciarContratacionCand(null)}
        candidato={iniciarContratacionCand ? {
          id: iniciarContratacionCand.id,
          nombre: iniciarContratacionCand.nombre,
          apellidos: iniciarContratacionCand.apellidos,
          email: iniciarContratacionCand.email,
          vacantePuestoId: vacante.puestoId ?? null,
        } : null}
        onDone={() => onMoved?.()}
      />

      <EmailConfirmDialog
        open={!!emailConfirm}
        onOpenChange={(o) => !o && setEmailConfirm(null)}
        candidato={emailConfirm?.candidato ?? null}
        estadoNuevo={emailConfirm?.estadoNuevo ?? null}
        onConfirm={handleConfirmMove}
      />
    </div>
  );
}
