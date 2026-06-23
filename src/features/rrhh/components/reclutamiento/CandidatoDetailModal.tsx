import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  Copy,
  FileText,
  Plus,
  Star,
  Mail,
  History,
  Tag,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19.077 4.928A9.94 9.94 0 0 0 12.05 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.748.46 3.45 1.33 4.95L2 22l5.25-1.38a9.91 9.91 0 0 0 4.8 1.22h.004c5.46 0 9.91-4.45 9.91-9.91a9.86 9.86 0 0 0-2.887-6.99zM12.05 20.15h-.003a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 1 1 15.3-4.38c0 4.54-3.7 8.24-8.31 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.7-.8-.23-.08-.4-.13-.56.13-.17.25-.65.8-.8.97-.15.17-.3.19-.55.06-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.39-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.3.37-.45.13-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.13-.55-1.34-.76-1.83-.2-.48-.4-.41-.55-.42l-.47-.01a.9.9 0 0 0-.66.31c-.23.25-.86.85-.86 2.06s.88 2.39 1 2.55c.13.17 1.74 2.65 4.21 3.71.59.25 1.05.4 1.41.51.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28z" />
    </svg>
  );
}

function getWhatsAppLink(telefono: string): string {
  const trimmed = telefono.trim();
  if (trimmed.startsWith("+")) return `https://wa.me/${trimmed.replace(/\D/g, "")}`;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) return `https://wa.me/${digits.slice(2)}`;
  if (digits.startsWith("34")) return `https://wa.me/${digits}`;
  return `https://wa.me/34${digits}`;
}
import {
  ESTADOS_CONFIG,
  FASES_PRINCIPALES,
  FASES_PRINCIPALES_ORDER,
  GENERO_LABELS,
  ORIGEN_LABELS,
  getFasePrincipal,
  type Candidato,
  type EstadoReclutamiento,
  type Genero,
  type HistorialCambioFase,
  type NotaCandidato,
  type ResenaCandidato,
  type ResenaCriterio,
  type Vacante,
} from "@/features/rrhh/data/reclutamiento";
import { useCriteriosResena } from "@/features/rrhh/data/criteriosResenaStore";
import {
  getRespuestaCuestionarioCandidato,
  type RespuestaCuestionarioCandidato,
} from "@/features/rrhh/actions/cuestionarios-vacante-actions";
import {
  getActividadCandidato,
  listNotasCandidato,
  addNotaCandidato,
  listResenasCandidato,
  addResenaCandidato,
} from "@/features/rrhh/actions/candidato-ficha-actions";
import { llamarDesdeApp } from "@/features/google-workspace/components/TelefonoDrawer";
import { toast } from "sonner";

interface CandidatoDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidato: Candidato | null;
  candidatos: Candidato[];
  vacante: Vacante;
  onSelectCandidato: (c: Candidato | null) => void;
  onUpdateCandidato: (updated: Candidato) => void;
  onMoverEstado: (c: Candidato, estado: EstadoReclutamiento) => void;
  onEliminar?: (c: Candidato) => void;
}

type TabKey = "informacion" | "cuestionarios" | "actividad" | "resenas" | "notas";

export function CandidatoDetailModal({
  open,
  onOpenChange,
  candidato,
  candidatos,
  vacante,
  onSelectCandidato,
  onUpdateCandidato,
  onMoverEstado,
  onEliminar,
}: CandidatoDetailModalProps) {
  const [tab, setTab] = useState<TabKey>("informacion");
  const [respuestaCuest, setRespuestaCuest] = useState<RespuestaCuestionarioCandidato | null>(null);
  // Datos de la ficha persistidos en BD (no en memoria del cliente).
  const [historial, setHistorial] = useState<HistorialCambioFase[]>([]);
  const [notas, setNotas] = useState<NotaCandidato[]>([]);
  const [resenas, setResenas] = useState<ResenaCandidato[]>([]);

  const candidatoId = candidato?.id ?? null;
  const candidatoFase = candidato?.fase ?? null;

  useEffect(() => {
    if (!candidatoId) { setRespuestaCuest(null); return; }
    let cancel = false;
    void getRespuestaCuestionarioCandidato(candidatoId).then((res) => {
      if (!cancel) setRespuestaCuest(res.data ?? null);
    });
    return () => { cancel = true; };
  }, [candidatoId]);

  // Notas y reseñas: se cargan al abrir/cambiar de candidato.
  useEffect(() => {
    if (!candidatoId) { setNotas([]); setResenas([]); return; }
    let cancel = false;
    void listNotasCandidato(candidatoId).then((n) => { if (!cancel) setNotas(n); });
    void listResenasCandidato(candidatoId).then((r) => { if (!cancel) setResenas(r); });
    return () => { cancel = true; };
  }, [candidatoId]);

  // Actividad: se recarga también cuando cambia el estado (tras un movimiento).
  useEffect(() => {
    if (!candidatoId) { setHistorial([]); return; }
    let cancel = false;
    void getActividadCandidato(candidatoId).then((h) => { if (!cancel) setHistorial(h); });
    return () => { cancel = true; };
  }, [candidatoId, candidatoFase]);

  const index = useMemo(() => {
    if (!candidato) return -1;
    return candidatos.findIndex((c) => c.id === candidato.id);
  }, [candidato, candidatos]);

  if (!candidato) return null;

  const cfgEstado = ESTADOS_CONFIG[candidato.fase];

  const total = candidatos.length;
  const goPrev = () => index > 0 && onSelectCandidato(candidatos[index - 1]);
  const goNext = () => index >= 0 && index < total - 1 && onSelectCandidato(candidatos[index + 1]);

  const handleEstadoChange = (estado: EstadoReclutamiento) => {
    if (estado === candidato.fase) return;
    onMoverEstado(candidato, estado);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-[1280px] h-[92vh] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-xl overflow-hidden flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">
            {candidato.nombre} {candidato.apellidos}
          </DialogPrimitive.Title>

          {/* ─── Top bar ─── */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 text-xs">
                <span className="font-medium text-muted-foreground">Vacante:</span>
                <span className="font-semibold text-foreground uppercase tracking-wide">
                  {vacante.puesto}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 text-xs">
                <span className="font-medium text-muted-foreground">Estado:</span>
                <span
                  className="font-semibold"
                  style={{ color: cfgEstado.color }}
                >
                  {cfgEstado.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <button
                onClick={goPrev}
                disabled={index <= 0}
                className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <span className="px-1 font-medium text-foreground">
                {index + 1} de {total}
              </span>
              <button
                onClick={goNext}
                disabled={index >= total - 1}
                className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="ml-3 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/60"
              >
                Ver todos los candidatos
              </button>
              {onEliminar && (
                <button
                  onClick={() => onEliminar(candidato)}
                  className="ml-1 p-1.5 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Borrar candidato"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <DialogPrimitive.Close className="ml-1 p-1.5 rounded hover:bg-muted/60">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* ─── Body ─── */}
          <div className="flex-1 grid grid-cols-[360px_1fr] min-h-0">
            {/* Left column: candidate profile */}
            <ScrollArea className="border-r border-border">
              <CandidatoSidebar
                candidato={candidato}
                onUpdate={onUpdateCandidato}
                respuestaCuest={respuestaCuest}
                resenas={resenas}
              />
            </ScrollArea>

            {/* Right column: tabs */}
            <div className="flex flex-col min-h-0">
              <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex flex-col flex-1 min-h-0">
                <div className="px-5 pt-4 border-b border-border shrink-0">
                  <TabsList className="bg-transparent p-0 h-auto gap-2">
                    <TabTriggerWithCount label="Información" value="informacion" />
                    <TabTriggerWithCount
                      label="Cuestionarios"
                      value="cuestionarios"
                      count={respuestaCuest ? `${respuestaCuest.nota}/10` : undefined}
                      tone={
                        respuestaCuest
                          ? respuestaCuest.nota >= 7
                            ? "good"
                            : respuestaCuest.nota >= 5
                              ? "warn"
                              : "bad"
                          : "auto"
                      }
                    />
                    <TabTriggerWithCount
                      label="Actividad"
                      value="actividad"
                      count={historial.length || undefined}
                    />
                    <TabTriggerWithCount
                      label="Reseñas"
                      value="resenas"
                      count={resenas.length || undefined}
                    />
                    <TabTriggerWithCount
                      label="Notas"
                      value="notas"
                      count={notas.length || undefined}
                    />
                  </TabsList>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-5">
                    <TabsContent value="informacion" className="m-0 outline-none">
                      <InformacionTab candidato={candidato} />
                    </TabsContent>
                    <TabsContent value="cuestionarios" className="m-0 outline-none">
                      <CuestionariosTab vacante={vacante} respuesta={respuestaCuest} />
                    </TabsContent>
                    <TabsContent value="actividad" className="m-0 outline-none">
                      <ActividadTab historial={historial} />
                    </TabsContent>
                    <TabsContent value="resenas" className="m-0 outline-none">
                      <ResenasTab
                        candidatoId={candidato.id}
                        resenas={resenas}
                        onSaved={(r) => setResenas((prev) => [...prev, r])}
                      />
                    </TabsContent>
                    <TabsContent value="notas" className="m-0 outline-none">
                      <NotasTab
                        candidatoId={candidato.id}
                        notas={notas}
                        onSaved={(n) => setNotas((prev) => [...prev, n])}
                      />
                    </TabsContent>
                  </div>
                </ScrollArea>
              </Tabs>
            </div>
          </div>

          {/* ─── Footer ─── */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-card shrink-0">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Switch
                checked={candidato.marcadoComoNoVisto ?? false}
                onCheckedChange={(v) =>
                  onUpdateCandidato({ ...candidato, marcadoComoNoVisto: v })
                }
              />
              Marcar como no visto
            </label>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">
                Mover de estado al candidato
              </span>
              <Select value={candidato.fase} onValueChange={(v) => handleEstadoChange(v as EstadoReclutamiento)}>
                <SelectTrigger className="h-9 w-[170px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FASES_PRINCIPALES_ORDER.flatMap((fp) =>
                    FASES_PRINCIPALES[fp].estados.map((est) => (
                      <SelectItem key={est} value={est} className="text-xs">
                        {FASES_PRINCIPALES[fp].label} · {ESTADOS_CONFIG[est].label}
                      </SelectItem>
                    )),
                  )}
                </SelectContent>
              </Select>

              <Select disabled>
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="Mover a vacante" />
                </SelectTrigger>
                <SelectContent />
              </Select>

              <Button
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() =>
                  toast.info("Crear empleado disponible al mover a la columna 'Prueba'.")
                }
              >
                Añadir como empleado
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

// ─── Sidebar (left column) ────────────────────────────────────
function CandidatoSidebar({
  candidato,
  onUpdate,
  respuestaCuest,
  resenas,
}: {
  candidato: Candidato;
  onUpdate: (c: Candidato) => void;
  respuestaCuest: RespuestaCuestionarioCandidato | null;
  resenas: ResenaCandidato[];
}) {
  // Cuestionario: tick verde solo si TODAS las respuestas son correctas; en
  // cuanto falla una, X roja. null = aún sin responder.
  const cuestionarioOk = respuestaCuest
    ? respuestaCuest.aciertos === respuestaCuest.totalPreguntas
    : null;
  // Reviews: nota final = media de todas las estrellas de todas las reseñas.
  const reviewMedia = promedioEstrellas(resenas.flatMap((r) => r.puntuaciones));
  const copyEmail = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(candidato.email).catch(() => {});
      toast.success("Email copiado al portapapeles");
    }
  };

  const whatsappLink = getWhatsAppLink(candidato.telefono);

  return (
    <div className="p-5 space-y-4">
      {/* Nombre del candidato (sin icono delante) */}
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-foreground leading-tight">
          {candidato.nombre} {candidato.apellidos}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Inscrito el {candidato.fechaInscripcion}
        </p>
      </div>

      {/* Resumen: resultado del cuestionario y nota final de reviews. */}
      <div className="rounded-lg border border-border divide-y divide-border">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold text-foreground">Cuestionario</span>
          {cuestionarioOk === null ? (
            <span className="text-xs text-muted-foreground">Sin responder</span>
          ) : cuestionarioOk ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> Correcto
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
              <XCircle className="h-5 w-5" /> Suspenso
            </span>
          )}
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold text-foreground">Reviews</span>
          {reviewMedia === null ? (
            <span className="text-xs text-muted-foreground">Sin valorar</span>
          ) : (
            <span className="flex items-center gap-2">
              <StarRatingFraccion value={reviewMedia} />
              <span className="text-sm font-bold text-amber-600 tabular-nums">
                {reviewMedia.toFixed(1)}
                <span className="text-xs font-medium text-muted-foreground"> / 5</span>
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Acciones de contacto: llamar (desde el software), email y WhatsApp. */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => candidato.telefono && llamarDesdeApp(candidato.telefono)}
          disabled={!candidato.telefono}
          title="Llamar desde el software"
          className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border py-2.5 text-xs font-medium text-foreground hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Phone className="h-4 w-4" />
          Llamar
        </button>
        <a
          href={`mailto:${candidato.email}`}
          title="Enviar email"
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-border py-2.5 text-xs font-medium text-foreground hover:bg-muted/60 hover:border-primary/30 hover:text-primary transition-colors ${candidato.email ? "" : "pointer-events-none opacity-40"}`}
        >
          <Mail className="h-4 w-4" />
          Email
        </a>
        <a
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
          title="Abrir la conversación de WhatsApp con el candidato"
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-border py-2.5 text-xs font-medium text-foreground hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors ${candidato.telefono ? "" : "pointer-events-none opacity-40"}`}
        >
          <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
          WhatsApp
        </a>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">+34</span>
          <span className="text-foreground font-medium">{candidato.telefono}</span>
          <button
            type="button"
            onClick={() => candidato.telefono && llamarDesdeApp(candidato.telefono)}
            className="ml-auto inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/60 text-muted-foreground"
            title="Llamar desde el software"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-emerald-50 text-[#25D366]"
            title="Abrir conversación en WhatsApp"
          >
            <WhatsAppIcon className="h-4 w-4" />
          </a>
        </div>

        {/* Email */}
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <a
            href={`mailto:${candidato.email}`}
            className="text-primary hover:underline truncate"
          >
            {candidato.email}
          </a>
          <button
            onClick={copyEmail}
            className="ml-auto inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/60 text-muted-foreground"
            title="Copiar email"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Tag */}
        <button
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-100 text-violet-700 text-xs hover:bg-violet-200 transition-colors"
          title="Añadir etiqueta"
        >
          <Tag className="h-3 w-3" />
        </button>
      </div>

      <Field label="Ubicación">
        <Input
          defaultValue={candidato.ubicacion ?? ""}
          onBlur={(e) => onUpdate({ ...candidato, ubicacion: e.target.value || undefined })}
          placeholder="Añadir ubicación"
          className="h-9 text-sm"
        />
      </Field>

      <Field label="Género">
        <Select
          value={candidato.genero ?? ""}
          onValueChange={(v) => onUpdate({ ...candidato, genero: v as Genero })}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Seleccionar" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(GENERO_LABELS) as Genero[]).map((g) => (
              <SelectItem key={g} value={g} className="text-sm">
                {GENERO_LABELS[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Expectativas salariales">
        <Input
          defaultValue={candidato.expectativasSalariales ?? ""}
          onBlur={(e) =>
            onUpdate({ ...candidato, expectativasSalariales: e.target.value || undefined })
          }
          placeholder="Añadir expectativas"
          className="h-9 text-sm"
        />
      </Field>

      <Field label="Disponible desde">
        <Input
          type="date"
          defaultValue={candidato.disponibleDesde ?? ""}
          onBlur={(e) =>
            onUpdate({ ...candidato, disponibleDesde: e.target.value || undefined })
          }
          className="h-9 text-sm"
        />
      </Field>

      <Field label="¿Cómo nos has conocido?">
        <Select
          value={candidato.origen}
          onValueChange={(v) =>
            onUpdate({ ...candidato, origen: v as Candidato["origen"] })
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ORIGEN_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key} className="text-sm">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Sobre ti">
        <Textarea
          defaultValue={candidato.sobreTi ?? ""}
          onBlur={(e) => onUpdate({ ...candidato, sobreTi: e.target.value || undefined })}
          placeholder="Añadir descripción"
          rows={5}
          className="text-sm resize-none"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// ─── Tab trigger with count badge ─────────────────────────────
function TabTriggerWithCount({
  label,
  value,
  count,
  tone = "auto",
}: {
  label: string;
  value: string;
  count?: number | string;
  /** "auto" = string→rosa, número→neutro; o forzar good/warn/bad/neutral. */
  tone?: "auto" | "good" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "warn"
        ? "bg-amber-100 text-amber-700"
        : tone === "bad"
          ? "bg-rose-100 text-rose-700"
          : tone === "neutral"
            ? "bg-muted text-muted-foreground"
            : typeof count === "string"
              ? "bg-rose-100 text-rose-700"
              : "bg-muted text-muted-foreground";
  return (
    <TabsTrigger
      value={value}
      className="rounded-none border-b-2 border-transparent bg-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-1 pb-2 text-sm font-medium"
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded text-[10px] font-semibold ${toneClass}`}
        >
          {count}
        </span>
      )}
    </TabsTrigger>
  );
}

// ─── Información Tab ──────────────────────────────────────────
function InformacionTab({ candidato }: { candidato: Candidato }) {
  return (
    <div className="space-y-4">
      <Section title={`Adjuntos (${candidato.cvAdjunto ? 1 : 0})`} action={<Plus className="h-4 w-4 text-muted-foreground" />}>
        {candidato.cvAdjunto ? (
          <a
            href={`/api/empleo/cv?path=${encodeURIComponent(candidato.cvAdjunto)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 transition-colors group"
          >
            <div className="h-8 w-8 rounded bg-rose-100 text-rose-600 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">Currículum (PDF)</p>
              <p className="text-xs text-muted-foreground">Abrir en una pestaña nueva</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <FileText className="h-3.5 w-3.5" /> Ver CV
            </span>
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">Sin adjuntos</p>
        )}
      </Section>

      <Section title="Enlaces (0)">
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">LinkedIn</label>
            <p className="text-sm text-muted-foreground/80">Añadir url de LinkedIn</p>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Sitio web</label>
            <p className="text-sm text-muted-foreground/80">Añadir url del candidato</p>
          </div>
        </div>
      </Section>

      <Section title="Otras vacantes (0)">
        <p className="text-xs text-muted-foreground">
          Este candidato no aparece en otras vacantes.
        </p>
      </Section>
    </div>
  );
}

// ─── Cuestionarios Tab ────────────────────────────────────────
function notaColor(nota: number): string {
  if (nota >= 7) return "hsl(145, 63%, 42%)";
  if (nota >= 5) return "hsl(45, 90%, 45%)";
  return "hsl(0, 72%, 51%)";
}

function CuestionariosTab({
  vacante,
  respuesta,
}: {
  vacante: Vacante;
  respuesta: RespuestaCuestionarioCandidato | null;
}) {
  if (!respuesta) {
    return (
      <p className="text-sm text-muted-foreground">
        {vacante.cuestionario
          ? "El candidato aún no ha respondido al cuestionario."
          : "Esta vacante no tiene cuestionario asociado."}
      </p>
    );
  }

  const color = notaColor(respuesta.nota);

  return (
    <div className="space-y-5">
      {/* Nota destacada */}
      <div className="flex items-center gap-4 rounded-xl border border-border p-4">
        <div
          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full font-bold"
          style={{ backgroundColor: `${color}22`, color }}
        >
          <span className="text-xl leading-none">{respuesta.nota}</span>
          <span className="text-[10px] font-medium opacity-80">/ 10</span>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            {respuesta.cuestionarioNombre ?? "Cuestionario"}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {respuesta.aciertos} de {respuesta.totalPreguntas} respuestas correctas
          </p>
        </div>
      </div>

      {/* Detalle pregunta a pregunta */}
      <div className="space-y-3">
        {respuesta.preguntas.map((p, idx) => {
          const elegidaId = respuesta.respuestas[p.id];
          const correctaId = p.opciones.find((o) => o.correcta)?.id;
          const acerto = !!elegidaId && elegidaId === correctaId;
          return (
            <div key={p.id} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground mb-2">
                {idx + 1}. {p.titulo}
              </p>
              <div className="space-y-1.5">
                {p.opciones.map((o) => {
                  const esElegida = o.id === elegidaId;
                  const esCorrecta = o.correcta;
                  return (
                    <div
                      key={o.id}
                      className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 text-xs ${
                        esCorrecta
                          ? "bg-emerald-50 text-emerald-800"
                          : esElegida
                            ? "bg-rose-50 text-rose-800"
                            : "text-muted-foreground"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {esCorrecta ? "✓" : esElegida ? "✗" : "·"}
                      </span>
                      <span>
                        {o.texto}
                        {esElegida && <span className="ml-1.5 font-medium">(respuesta del candidato)</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              {!elegidaId && (
                <p className="mt-1.5 text-[11px] text-muted-foreground italic">Sin responder</p>
              )}
              {elegidaId && !acerto && (
                <p className="mt-1.5 text-[11px] text-rose-600">Respuesta incorrecta</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Actividad Tab (historial) ────────────────────────────────
function ActividadTab({ historial }: { historial: HistorialCambioFase[] }) {
  if (historial.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay actividad registrada para este candidato.
      </p>
    );
  }

  return (
    <Section title="Historial de cambios" icon={<History className="h-4 w-4" />}>
      <div className="space-y-2">
        {[...historial].reverse().map((h) => (
          <div
            key={h.id}
            className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40 text-xs"
          >
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
    </Section>
  );
}

// ─── Reseñas Tab ──────────────────────────────────────────────
function ResenasTab({
  candidatoId,
  resenas,
  onSaved,
}: {
  candidatoId: string;
  resenas: ResenaCandidato[];
  onSaved: (r: ResenaCandidato) => void;
}) {
  const criterios = useCriteriosResena();
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Borrador en blanco para cada nueva reseña (cada entrevista se valora aparte).
  const puntuacionesIniciales: ResenaCriterio[] = useMemo(
    () => criterios.map((c) => ({ criterioId: c.id, estrellas: 0 })),
    [criterios],
  );

  const [draft, setDraft] = useState<ResenaCriterio[]>(puntuacionesIniciales);

  // Si cambian los criterios o cargas un candidato distinto, resincroniza el borrador.
  useEffect(() => {
    setDraft(puntuacionesIniciales);
  }, [puntuacionesIniciales, candidatoId]);

  const setEstrellas = (criterioId: string, estrellas: number) => {
    setDraft((prev) => {
      const exists = prev.some((p) => p.criterioId === criterioId);
      if (!exists) return [...prev, { criterioId, estrellas }];
      return prev.map((p) => (p.criterioId === criterioId ? { ...p, estrellas } : p));
    });
  };

  const guardar = async () => {
    // Para guardar hay que valorar TODOS los criterios: no se permite dejar
    // unos puntuados y otros sin puntuar.
    const sinPuntuar = criterios.filter(
      (c) => (draft.find((p) => p.criterioId === c.id)?.estrellas ?? 0) === 0,
    );
    if (sinPuntuar.length > 0) {
      toast.error("Completa la valoración de todos los criterios para poder guardar la reseña");
      return;
    }
    const puntuaciones = draft.filter((p) => p.estrellas > 0);
    setGuardando(true);
    const res = await addResenaCandidato(candidatoId, {
      puntuaciones,
      comentario: comentario.trim() || undefined,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onSaved(res.resena);
    setComentario("");
    setDraft(puntuacionesIniciales);
    toast.success("Reseña guardada");
  };

  if (criterios.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No hay criterios de reseña configurados.
        </p>
        <p className="text-xs text-muted-foreground/80 mt-1">
          Crea criterios en <span className="font-medium">Configuración → Candidatos</span>.
        </p>
      </div>
    );
  }

  const mediaDraft = promedioEstrellas(draft);

  return (
    <div className="space-y-5">
      <Section title="Puntúa al candidato">
        <div className="space-y-3">
          {criterios.map((c) => {
            const val = draft.find((p) => p.criterioId === c.id)?.estrellas ?? 0;
            return (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">{c.nombre}</span>
                <StarRating value={val} onChange={(v) => setEstrellas(c.id, v)} />
              </div>
            );
          })}
        </div>

        {/* Valoración final = media de los criterios puntuados (en vivo). */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <span className="text-sm font-semibold text-foreground">Valoración final</span>
          {mediaDraft === null ? (
            <span className="text-xs text-muted-foreground">Puntúa los criterios</span>
          ) : (
            <div className="flex items-center gap-2">
              <StarRatingFraccion value={mediaDraft} />
              <span className="text-sm font-bold text-amber-600 tabular-nums">
                {mediaDraft.toFixed(1)}
                <span className="text-xs font-medium text-muted-foreground"> / 5</span>
              </span>
            </div>
          )}
        </div>
      </Section>

      <Section title="Comentario">
        <Textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Añadir un comentario (opcional)"
          rows={3}
          className="text-sm resize-none"
        />
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={guardar} disabled={guardando} className="h-8 text-xs">
            {guardando ? "Guardando…" : "Guardar reseña"}
          </Button>
        </div>
      </Section>

      {resenas.length > 0 && (
        <Section title={`Reseñas previas (${resenas.length})`}>
          <div className="space-y-3">
            {[...resenas].reverse().map((r) => {
              const media = promedioEstrellas(r.puntuaciones);
              return (
              <div key={r.id} className="rounded-lg border border-border p-3 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">{r.autor}</span>
                  <span className="text-muted-foreground">{r.fecha}</span>
                </div>
                {media !== null && (
                  <div className="mb-2 flex items-center gap-2 rounded-md bg-amber-50 px-2 py-1.5">
                    <StarRatingFraccion value={media} />
                    <span className="text-sm font-bold text-amber-600 tabular-nums">
                      {media.toFixed(1)}
                      <span className="text-[11px] font-medium text-muted-foreground"> / 5</span>
                    </span>
                  </div>
                )}
                <div className="space-y-1">
                  {r.puntuaciones.map((p) => {
                    const nombre =
                      criterios.find((c) => c.id === p.criterioId)?.nombre ?? p.criterioId;
                    return (
                      <div
                        key={p.criterioId}
                        className="flex items-center justify-between"
                      >
                        <span className="text-foreground">{nombre}</span>
                        <StarRating value={p.estrellas} readOnly />
                      </div>
                    );
                  })}
                </div>
                {r.comentario && (
                  <p className="mt-2 text-muted-foreground italic">
                    &ldquo;{r.comentario}&rdquo;
                  </p>
                )}
              </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

/** Media (1 decimal) de los criterios puntuados; null si no hay ninguno. */
function promedioEstrellas(puntuaciones: { estrellas: number }[]): number | null {
  const vals = puntuaciones.map((p) => p.estrellas).filter((n) => n > 0);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Fila de 5 estrellas con relleno fraccionado (admite decimales: 4.2 → 4 llenas + 20%). */
function StarRatingFraccion({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <div key={n} className="relative h-4 w-4">
            <Star className="absolute inset-0 h-4 w-4 text-amber-400/30" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StarRating({
  value,
  onChange,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n === value ? 0 : n)}
            className={`p-0.5 ${readOnly ? "cursor-default" : "hover:scale-110"} transition-transform`}
            aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
          >
            <Star
              className={`h-4 w-4 ${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

// ─── Notas Tab ────────────────────────────────────────────────
function NotasTab({
  candidatoId,
  notas,
  onSaved,
}: {
  candidatoId: string;
  notas: NotaCandidato[];
  onSaved: (n: NotaCandidato) => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    const trimmed = texto.trim();
    if (!trimmed) return;
    setEnviando(true);
    const res = await addNotaCandidato(candidatoId, trimmed);
    setEnviando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onSaved(res.nota);
    setTexto("");
  };

  return (
    <div className="space-y-4">
      {notas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Este candidato no tiene ningún comentario
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...notas].reverse().map((n) => (
            <div key={n.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-foreground text-xs">{n.autor}</span>
                <span className="text-muted-foreground text-xs">{n.fecha}</span>
              </div>
              <p className="text-foreground whitespace-pre-wrap">{n.texto}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border p-3 space-y-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Añadir nota..."
          rows={3}
          className="text-sm resize-none border-0 focus-visible:ring-0 p-0"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={enviar} disabled={!texto.trim() || enviando} className="h-8 text-xs">
            {enviando ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Section ─────────────────────────────────────────
function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {icon}
          {title}
        </h4>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

