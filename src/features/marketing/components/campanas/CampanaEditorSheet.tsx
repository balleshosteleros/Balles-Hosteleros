"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Plus, Send, Link2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { guardarCampanaAction } from "@/features/marketing/actions/campanas-actions";
import { listReservaLinks, createReservaLink } from "@/features/sala/actions/reserva-links-actions";
import { validarPalabraClave, type ReservaLink } from "@/features/sala/data/reserva-links";
import type { Campana, RecurrenciaCampana } from "@/features/marketing/data/campanas";
import { EditorSegmento } from "./editor/EditorSegmento";
import { enviarCampanaDemoAction } from "@/features/marketing/actions/envios-actions";
import { previewSegmentoAction } from "@/features/marketing/actions/segmento-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campana: Campana;
  onGuardada: () => void;
}

const RECURRENCIAS: { value: RecurrenciaCampana; label: string; cron: string | null }[] = [
  { value: "una_vez", label: "Una vez", cron: null },
  { value: "diaria", label: "Diaria (cada día 9:00)", cron: "0 9 * * *" },
  { value: "semanal", label: "Semanal (lunes 9:00)", cron: "0 9 * * 1" },
  { value: "mensual", label: "Mensual (día 1 a las 9:00)", cron: "0 9 1 * *" },
];

function cronARecurrencia(cron: string | null): RecurrenciaCampana {
  const r = RECURRENCIAS.find((x) => x.cron === cron);
  return r?.value ?? "una_vez";
}

export function CampanaEditorSheet({ open, onOpenChange, campana, onGuardada }: Props) {
  const [draft, setDraft] = useState<Campana>(campana);
  const [guardando, startSave] = useTransition();
  const [enviando, startSend] = useTransition();
  const [links, setLinks] = useState<ReservaLink[]>([]);
  const [nuevoLink, setNuevoLink] = useState("");
  const [creandoLink, setCreandoLink] = useState(false);
  const [coincidencias, setCoincidencias] = useState<number | null>(null);

  useEffect(() => { setDraft(campana); }, [campana]);

  useEffect(() => {
    listReservaLinks().then((r) => { if (r.ok) setLinks(r.data); });
  }, [open]);

  // Preview segmento debounced
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      const r = await previewSegmentoAction(draft.segmentoJson);
      setCoincidencias(r.ok ? r.count : 0);
    }, 400);
    return () => clearTimeout(handle);
  }, [draft.segmentoJson, open]);

  const recurrencia = useMemo(() => cronARecurrencia(draft.recurrenciaCron), [draft.recurrenciaCron]);

  const mensaje = useMemo(() => {
    if (draft.canal === "email") return draft.cuerpoHtml;
    if (draft.canal === "whatsapp" || draft.canal === "sms") return draft.cuerpo;
    return "";
  }, [draft]);

  const asunto = draft.canal === "email" ? draft.asunto : "";

  const validacion = useMemo(() => {
    if (!draft.nombre.trim()) return { ok: false as const, msg: "Falta el nombre" };
    if (!mensaje.trim()) return { ok: false as const, msg: "Falta el mensaje" };
    if (!draft.reservaLinkId) return { ok: false as const, msg: "Selecciona un link de reserva" };
    if (coincidencias === null || coincidencias === 0) return { ok: false as const, msg: "El segmento no tiene clientes" };
    return { ok: true as const, msg: null };
  }, [draft, mensaje, coincidencias]);

  const recomendacion = useMemo(() => {
    if (draft.canal === "email") {
      const longAsunto = asunto.length;
      const supera = longAsunto > 50;
      return {
        tono: supera ? "warn" as const : "ok" as const,
        texto: `Asunto: ${longAsunto}/50 caracteres ${supera ? "(demasiado largo)" : "✓"}`,
      };
    }
    if (draft.canal === "sms") {
      const long = mensaje.length;
      const supera = long > 160;
      const tieneEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(mensaje);
      const partes = [`${long}/160 caracteres ${supera ? "(superado)" : "✓"}`];
      if (tieneEmoji) partes.push("evita emojis (encarecen el SMS)");
      return { tono: supera || tieneEmoji ? "warn" as const : "ok" as const, texto: partes.join(" · ") };
    }
    if (draft.canal === "whatsapp") {
      const long = mensaje.length;
      return {
        tono: long > 1024 ? "warn" as const : "ok" as const,
        texto: `Mensaje ${long}/1024. Recuerda: para envíos masivos necesitas plantilla aprobada.`,
      };
    }
    return null;
  }, [draft.canal, asunto, mensaje]);

  function updateDraft(patch: Partial<Campana>) {
    setDraft((d) => ({ ...d, ...patch } as Campana));
  }
  function updateMensaje(v: string) {
    if (draft.canal === "email") updateDraft({ cuerpoHtml: v } as Partial<Campana>);
    else if (draft.canal === "whatsapp" || draft.canal === "sms") updateDraft({ cuerpo: v } as Partial<Campana>);
  }

  async function crearLinkInline() {
    const v = validarPalabraClave(nuevoLink);
    if (!v.ok) { toast.error(v.error); return; }
    setCreandoLink(true);
    const r = await createReservaLink(nuevoLink);
    setCreandoLink(false);
    if (!r.ok) { toast.error(r.error ?? "Error al crear link"); return; }
    setLinks((prev) => [r.data!, ...prev]);
    updateDraft({ reservaLinkId: r.data!.id });
    setNuevoLink("");
    toast.success(`Link "${r.data!.palabraClave}" creado`);
  }

  function onGuardar() {
    startSave(async () => {
      const r = await guardarCampanaAction(draft);
      if (!r.ok) { toast.error(r.error ?? "Error al guardar"); return; }
      toast.success("Campaña guardada");
      onGuardada();
    });
  }

  function onEnviarDemo() {
    if (!validacion.ok) return;
    if (!confirm(`Modo demo: se registrarán ${coincidencias} envíos sin llamar a ningún proveedor. ¿Continuar?`)) return;
    startSend(async () => {
      // Primero guardar para tener UUID válido si es nueva
      const saved = await guardarCampanaAction(draft);
      if (!saved.ok || !saved.data) { toast.error(saved.error ?? "Error al guardar"); return; }
      const r = await enviarCampanaDemoAction(saved.data.id);
      if (!r.ok) { toast.error(r.error ?? "Error al enviar"); return; }
      toast.success(`${r.enviados} envíos registrados (modo demo)`);
      onGuardada();
    });
  }

  const linkActivo = links.find((l) => l.id === draft.reservaLinkId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Nueva campaña — {draft.canal.toUpperCase()}
          </SheetTitle>
          <SheetDescription>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 mt-2">
              <AlertTriangle className="h-3 w-3 mr-1" /> Modo demo — sin envío real
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Nombre */}
          <div>
            <Label htmlFor="nombre">Nombre de la campaña *</Label>
            <Input id="nombre" value={draft.nombre} onChange={(e) => updateDraft({ nombre: e.target.value })} placeholder="Reactivación clientes inactivos" />
          </div>

          {/* Asunto (solo email) */}
          {draft.canal === "email" && (
            <div>
              <Label htmlFor="asunto">Asunto *</Label>
              <Input id="asunto" value={draft.asunto} onChange={(e) => updateDraft({ asunto: e.target.value } as Partial<Campana>)} maxLength={120} />
            </div>
          )}

          {/* Remitente (sms) */}
          {draft.canal === "sms" && (
            <div>
              <Label htmlFor="remitente">Remitente (sender ID, máx 11 car.)</Label>
              <Input id="remitente" value={draft.remitente} onChange={(e) => updateDraft({ remitente: e.target.value.slice(0, 11) } as Partial<Campana>)} placeholder="BACANAL" />
            </div>
          )}

          {/* Plantilla (whatsapp) */}
          {draft.canal === "whatsapp" && (
            <div>
              <Label htmlFor="plantilla">Plantilla WhatsApp (nombre aprobado)</Label>
              <Input id="plantilla" value={draft.plantilla} onChange={(e) => updateDraft({ plantilla: e.target.value } as Partial<Campana>)} placeholder="reactivacion_es" />
            </div>
          )}

          {/* Mensaje */}
          <div>
            <Label htmlFor="mensaje">Mensaje *</Label>
            <Textarea id="mensaje" value={mensaje} onChange={(e) => updateMensaje(e.target.value)} rows={5} />
            {recomendacion && (
              <p className={`text-xs mt-1 ${recomendacion.tono === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                {recomendacion.texto}
              </p>
            )}
          </div>

          {/* Link de reserva */}
          <div>
            <Label className="flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Link de reserva *</Label>
            <div className="flex gap-2 mt-1">
              <select
                className="flex-1 h-9 rounded border bg-background px-2 text-sm"
                value={draft.reservaLinkId ?? ""}
                onChange={(e) => updateDraft({ reservaLinkId: e.target.value || null })}
              >
                <option value="">— Selecciona un link —</option>
                {links.filter((l) => l.activo).map((l) => (
                  <option key={l.id} value={l.id}>{l.palabraClave}</option>
                ))}
              </select>
            </div>
            {linkActivo && (
              <p className="text-xs text-muted-foreground mt-1 break-all">{linkActivo.urlGenerada}</p>
            )}
            <div className="flex gap-2 mt-2">
              <Input
                value={nuevoLink}
                onChange={(e) => setNuevoLink(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                placeholder="Crear link rápido (ej. EMAIL_JUNIO)"
                className="h-8 text-xs"
              />
              <Button type="button" size="sm" variant="outline" disabled={!nuevoLink || creandoLink} onClick={crearLinkInline}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Crear
              </Button>
            </div>
          </div>

          {/* Recurrencia */}
          <div>
            <Label>Recurrencia</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {RECURRENCIAS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => updateDraft({ recurrenciaCron: r.cron })}
                  className={`text-xs px-3 h-8 rounded border ${recurrencia === r.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              v1 sin scheduler — la recurrencia queda guardada pero el envío se dispara manualmente.
            </p>
          </div>

          {/* Segmento */}
          <div>
            <Label>Segmento *</Label>
            <EditorSegmento
              segmento={draft.segmentoJson}
              onChange={(s) => updateDraft({ segmentoJson: s })}
              coincidencias={coincidencias}
            />
          </div>
        </div>

        <SheetFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={onGuardar} disabled={guardando || !draft.nombre.trim()}>
            {guardando ? "Guardando..." : "Guardar borrador"}
          </Button>
          <Button
            onClick={onEnviarDemo}
            disabled={!validacion.ok || enviando}
            title={validacion.ok ? "Registrar envío demo" : validacion.msg ?? ""}
          >
            <Send className="h-4 w-4 mr-1" />
            {enviando ? "Enviando..." : `Enviar (demo) — ${coincidencias ?? 0}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
