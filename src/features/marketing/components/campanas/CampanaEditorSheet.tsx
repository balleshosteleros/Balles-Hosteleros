"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Plus, Send, Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { guardarCampanaAction } from "@/features/marketing/actions/campanas-actions";
import { listReservaLinks, createReservaLink } from "@/features/sala/actions/reserva-links-actions";
import { validarPalabraClave, type ReservaLink } from "@/features/sala/data/reserva-links";
import type { Campana } from "@/features/marketing/data/campanas";
import {
  FRECUENCIAS,
  camposAProgramacion,
  describirProgramacion,
  programacionACampos,
  type Frecuencia,
} from "@/features/marketing/lib/programacion";
import { EditorSegmento } from "./editor/EditorSegmento";
import { contarDestinatariosAction } from "@/features/marketing/actions/envios-actions";
import { enviarEmailAction } from "@/features/marketing/actions/campanas-actions";
import { previewSegmentoAction } from "@/features/marketing/actions/segmento-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campana: Campana;
  onGuardada: () => void;
}

export function CampanaEditorSheet({ open, onOpenChange, campana, onGuardada }: Props) {
  const [draft, setDraft] = useState<Campana>(campana);
  const [guardando, startSave] = useTransition();
  const [links, setLinks] = useState<ReservaLink[]>([]);
  const [nuevoLink, setNuevoLink] = useState("");
  const [creandoLink, setCreandoLink] = useState(false);
  const [coincidencias, setCoincidencias] = useState<number | null>(null);
  // Cuántos lo recibirían de verdad: los del segmento que ADEMÁS dieron
  // permiso. Es siempre menor que las coincidencias, y es el número real.
  const [destinatarios, setDestinatarios] = useState<number | null>(null);
  const [enviandoReal, startEnviarReal] = useTransition();
  const { confirm: confirmEnvio, dialog: confirmEnvioDialog } = useConfirmDelete();

  /**
   * La de cumpleaños no se envía desde aquí: sale sola, una por persona, el día
   * que le toca a cada una. Se le quitan los botones de envío —el texto lleva
   * dentro el nombre y el código de cada cliente, mandarlo en bloque sería
   * mandar huecos sin rellenar— y se explica en su lugar cómo se enciende.
   */
  const esCumpleanos = draft.claveSeed === "CUMPLEANOS";

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

  useEffect(() => {
    if (!open || draft.canal !== "email" || draft.id.length !== 36) {
      setDestinatarios(null);
      return;
    }
    contarDestinatariosAction(draft.id).then((r) => setDestinatarios(r.ok ? r.total : null));
  }, [open, draft.id, draft.canal]);

  /**
   * Cuándo sale la campaña, leído de lo guardado. El usuario no ve un cron:
   * elige "cada año" y una fecha, y de ahí se compone.
   */
  const fechaEnvioDraft = draft.fechaEnvio;
  const programacion = useMemo(
    () => camposAProgramacion(draft.recurrenciaCron, fechaEnvioDraft ?? null),
    [draft.recurrenciaCron, fechaEnvioDraft],
  );

  /**
   * Tocar la hora NO pone la campaña en marcha.
   *
   * El estado se cambia en un paso aparte y a propósito: si elegir "cada mes"
   * dejara la campaña activa sin más, un ajuste de la hora en una campaña vieja
   * mandaría un correo a nueve mil personas sin que nadie lo haya pedido, y eso
   * no se puede deshacer.
   */
  function cambiarProgramacion(patch: Partial<typeof programacion>) {
    const campos = programacionACampos({ ...programacion, ...patch });
    updateDraft({
      recurrenciaCron: campos.recurrenciaCron,
      fechaEnvio: campos.fechaEnvioIso,
      // Una campaña ya en marcha sí sigue el estado que le toca a la nueva
      // programación: pasar de "un día" a "cada mes" es activa, no programada.
      ...(draft.estado === "borrador" ? {} : { estado: campos.estado }),
    } as Partial<Campana>);
  }

  const enMarcha = draft.estado === "programada" || draft.estado === "activa";

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

  /**
   * Envío DE VERDAD. Pide confirmación con el número de personas delante: es
   * irreversible y, en el calendario anual, además abre el concurso del mes.
   */
  async function onEnviarReal() {
    if (draft.canal !== "email") return;
    const total = destinatarios ?? 0;
    if (!total) {
      toast.error("No hay nadie a quien enviar: ningún cliente del segmento ha dado permiso");
      return;
    }
    const ok = await confirmEnvio({
      title: `Enviar a ${total.toLocaleString("es-ES")} clientes`,
      description: draft.claveSeed
        ? "Los correos salen ahora y el concurso del mes queda abierto en ese momento. No se puede deshacer."
        : "Los correos salen ahora. No se puede deshacer.",
      confirmLabel: "Enviar",
    });
    if (!ok) return;

    startEnviarReal(async () => {
      const guardada = await guardarCampanaAction(draft);
      if (!guardada.ok || !guardada.data) {
        toast.error(guardada.error ?? "Error al guardar");
        return;
      }
      const r = await enviarEmailAction(guardada.data as typeof draft & { canal: "email" });
      if (!r.success) {
        toast.error(r.error ?? "No se pudo enviar");
        return;
      }
      toast.success(
        `${(r.enviados ?? 0).toLocaleString("es-ES")} correos enviados` +
          (r.fallidos ? ` · ${r.fallidos} fallaron` : ""),
      );
      onGuardada();
    });
  }

  const linkActivo = links.find((l) => l.id === draft.reservaLinkId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {confirmEnvioDialog}
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Nueva campaña — {draft.canal.toUpperCase()}
          </SheetTitle>
          <SheetDescription>
            Al enviar, los correos salen de verdad a los clientes del segmento.
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

          {/* Vista previa: los correos del calendario anual son un documento
              HTML entero, y en un cuadro de texto solo se ve código. Aquí se ve
              tal cual le llega al cliente. */}
          {draft.canal === "email" && mensaje.trim().startsWith("<!doctype") && (
            <div>
              <Label>Así le llega al cliente</Label>
              <div className="mt-1 rounded-lg border overflow-hidden bg-white">
                <iframe
                  title="Vista previa del correo"
                  srcDoc={mensaje}
                  sandbox=""
                  className="w-full h-[520px] border-0"
                />
              </div>
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

          {/* ── Cuándo sale ────────────────────────────────────────────
              Tres formas y solo tres: a mano, un día concreto, o cada
              día/semana/mes/año. La hora es siempre la del restaurante. */}
          {!esCumpleanos && (
            <div>
              <Label className="flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> Cuándo se envía
              </Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {FRECUENCIAS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => cambiarProgramacion({ frecuencia: f.value as Frecuencia })}
                    title={f.ayuda}
                    className={`h-8 rounded border px-3 text-xs ${
                      programacion.frecuencia === f.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {programacion.frecuencia !== "manual" && (
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  {programacion.frecuencia !== "diaria" && (
                    <div className="space-y-1">
                      <Label htmlFor="prog-fecha" className="text-xs text-muted-foreground">
                        {programacion.frecuencia === "un_dia"
                          ? "Día"
                          : programacion.frecuencia === "semanal"
                            ? "Un día de esa semana"
                            : programacion.frecuencia === "mensual"
                              ? "Un día de ese mes"
                              : "El día del año"}
                      </Label>
                      <Input
                        id="prog-fecha"
                        type="date"
                        className="h-8 w-40"
                        value={programacion.fecha}
                        onChange={(e) => cambiarProgramacion({ fecha: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="prog-hora" className="text-xs text-muted-foreground">
                      Hora
                    </Label>
                    <Input
                      id="prog-hora"
                      type="time"
                      className="h-8 w-28"
                      value={programacion.hora}
                      onChange={(e) => cambiarProgramacion({ hora: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {describirProgramacion(programacion)}
                {programacion.frecuencia !== "manual" && " · en la hora del restaurante"}
              </p>

              {/* Poner en marcha es un acto aparte, con su botón: es lo que
                  separa "he dejado esto preparado" de "esto sale solo". */}
              {programacion.frecuencia !== "manual" && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-2">
                  {enMarcha ? (
                    <>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                        En marcha: saldrá sola cuando le toque.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto h-7"
                        onClick={() => updateDraft({ estado: "borrador" } as Partial<Campana>)}
                      >
                        Detener
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground">
                        Está en borrador: no saldrá sola hasta que la pongas en marcha.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        className="ml-auto h-7"
                        disabled={!validacion.ok}
                        title={validacion.ok ? "" : (validacion.msg ?? "")}
                        onClick={() =>
                          updateDraft({
                            estado: programacionACampos(programacion).estado,
                          } as Partial<Campana>)
                        }
                      >
                        Poner en marcha
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

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
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
          {esCumpleanos && (
            <p className="text-xs text-muted-foreground sm:mr-auto sm:max-w-sm">
              Esta campaña se envía sola: cada cliente recibe la suya siete días antes de su
              cumpleaños, con su código. Para ponerla en marcha, cambia su estado a Activa.
            </p>
          )}
          {!esCumpleanos && draft.canal === "email" && (
            <Button
              onClick={onEnviarReal}
              disabled={!validacion.ok || enviandoReal || !destinatarios}
              title={
                destinatarios
                  ? `Enviar de verdad a ${destinatarios} clientes con permiso`
                  : "Guarda la campaña para saber a cuántos se enviaría"
              }
            >
              <Send className="h-4 w-4 mr-1" />
              {enviandoReal
                ? "Enviando..."
                : `Enviar — ${(destinatarios ?? 0).toLocaleString("es-ES")}`}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
