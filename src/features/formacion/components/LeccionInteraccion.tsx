"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, MessageCircleQuestion, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getLikeLeccion, toggleLikeLeccion,
  listPreguntasLeccion, enviarPregunta,
  listCuestionario, enviarIntentoCuestionario,
  type LikeInfo, type PreguntaFormacion, type PreguntaCuestionario,
} from "@/features/formacion/actions/formacion-interaccion-actions";
import { getDocumentoLeccionUrl } from "@/features/formacion/actions/formacion-actions";

interface Props {
  cursoId: string;
  leccionId: string;
  /** Texto libre de la lección (contenido extra). */
  contenido?: string;
  /** Documento incrustado: path en storage + tipo. */
  documentoPath?: string;
  documentoTipo?: string | null;
  documentoNombre?: string;
  cuestionarioAprobadoPct?: number;
}

/**
 * Panel bajo el vídeo de una lección (vista alumno): texto libre, documento
 * incrustado (PDF/imagen), botón me gusta, recuadro de preguntas privadas a
 * RRHH y cuestionario tipo test.
 */
export function LeccionInteraccion({
  cursoId, leccionId, contenido, documentoPath, documentoTipo, documentoNombre,
  cuestionarioAprobadoPct = 80,
}: Props) {
  // URL firmada del documento adjunto (para incrustarlo).
  const [documentoUrl, setDocumentoUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setDocumentoUrl(undefined);
    if (!documentoPath) return;
    getDocumentoLeccionUrl(documentoPath).then((r) => {
      if (alive && r.ok && r.url) setDocumentoUrl(r.url);
    });
    return () => { alive = false; };
  }, [documentoPath]);
  // ── Me gusta ──
  const [like, setLike] = useState<LikeInfo>({ total: 0, yoLeDi: false });
  const [likeBusy, setLikeBusy] = useState(false);

  // ── Preguntas ──
  const [preguntas, setPreguntas] = useState<PreguntaFormacion[]>([]);
  const [nuevaPregunta, setNuevaPregunta] = useState("");
  const [enviandoPregunta, setEnviandoPregunta] = useState(false);

  // ── Cuestionario ──
  const [cuestionario, setCuestionario] = useState<PreguntaCuestionario[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [resultado, setResultado] = useState<{ notaPct: number; aprobado: boolean } | null>(null);
  const [enviandoTest, setEnviandoTest] = useState(false);

  useEffect(() => {
    let alive = true;
    setResultado(null);
    setRespuestas({});
    setNuevaPregunta("");
    (async () => {
      const [l, p, c] = await Promise.all([
        getLikeLeccion(leccionId),
        listPreguntasLeccion(leccionId),
        listCuestionario(leccionId),
      ]);
      if (!alive) return;
      setLike(l);
      setPreguntas(p);
      setCuestionario(c);
    })();
    return () => { alive = false; };
  }, [leccionId]);

  async function handleLike() {
    setLikeBusy(true);
    const r = await toggleLikeLeccion(leccionId);
    if (r.ok && r.info) setLike(r.info);
    setLikeBusy(false);
  }

  async function handleEnviarPregunta() {
    if (!nuevaPregunta.trim()) return;
    setEnviandoPregunta(true);
    const r = await enviarPregunta(cursoId, leccionId, nuevaPregunta);
    if (r.ok) {
      toast.success("Pregunta enviada a RRHH. Te responderán en cuanto puedan.");
      setNuevaPregunta("");
      setPreguntas(await listPreguntasLeccion(leccionId));
    } else {
      toast.error(r.error ?? "No se pudo enviar");
    }
    setEnviandoPregunta(false);
  }

  async function handleEnviarTest() {
    if (Object.keys(respuestas).length < cuestionario.length) {
      toast.error("Responde todas las preguntas");
      return;
    }
    setEnviandoTest(true);
    const r = await enviarIntentoCuestionario(leccionId, respuestas, cuestionarioAprobadoPct);
    setEnviandoTest(false);
    if (r.ok) {
      setResultado({ notaPct: r.notaPct, aprobado: r.aprobado });
      if (r.aprobado) toast.success(`¡Aprobado! Nota: ${r.notaPct}%`);
      else toast.error(`Nota: ${r.notaPct}%. Necesitas ${cuestionarioAprobadoPct}% para aprobar.`);
    }
  }

  return (
    <div className="space-y-4">
      {/* Texto libre + me gusta */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {contenido && (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-foreground/90">
              {contenido}
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant={like.yoLeDi ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={handleLike}
              disabled={likeBusy}
            >
              <ThumbsUp className={cn("h-4 w-4", like.yoLeDi && "fill-current")} />
              Me gusta {like.total > 0 && `· ${like.total}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documento incrustado */}
      {documentoUrl && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" />
              {documentoNombre ?? "Documento"}
            </div>
            {documentoTipo === "imagen" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={documentoUrl} alt={documentoNombre ?? "documento"} className="w-full rounded-lg border" />
            ) : (
              <iframe
                src={documentoUrl}
                title={documentoNombre ?? "documento"}
                className="w-full h-[600px] rounded-lg border"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Cuestionario tipo test */}
      {cuestionario.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Cuestionario — comprueba que lo has entendido
            </h4>
            {cuestionario.map((q, qi) => (
              <div key={q.id} className="space-y-1.5">
                <p className="text-sm font-medium">{qi + 1}. {q.enunciado}</p>
                <div className="space-y-1">
                  {q.opciones.map((op, oi) => {
                    const elegida = respuestas[q.id] === oi;
                    const mostrarCorreccion = !!resultado;
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={!!resultado}
                        onClick={() => setRespuestas((r) => ({ ...r, [q.id]: oi }))}
                        className={cn(
                          "w-full text-left text-sm px-3 py-2 rounded-md border transition-colors",
                          elegida && !mostrarCorreccion && "border-primary bg-primary/5",
                          !elegida && !mostrarCorreccion && "hover:bg-muted",
                          mostrarCorreccion && op.correcta && "border-emerald-400 bg-emerald-50 text-emerald-800",
                          mostrarCorreccion && elegida && !op.correcta && "border-red-400 bg-red-50 text-red-800",
                        )}
                      >
                        {op.texto}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {resultado ? (
              <div className={cn(
                "text-sm font-medium rounded-md px-3 py-2",
                resultado.aprobado ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800",
              )}>
                {resultado.aprobado ? "✓ Aprobado" : "✗ No aprobado"} — Nota: {resultado.notaPct}%
                {!resultado.aprobado && (
                  <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={() => { setResultado(null); setRespuestas({}); }}>
                    Reintentar
                  </Button>
                )}
              </div>
            ) : (
              <Button size="sm" onClick={handleEnviarTest} disabled={enviandoTest}>
                {enviandoTest ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Enviar respuestas
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recuadro de preguntas privadas */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <MessageCircleQuestion className="h-4 w-4 text-primary" />
            ¿Tienes dudas sobre esta lección?
          </h4>
          <Textarea
            value={nuevaPregunta}
            onChange={(e) => setNuevaPregunta(e.target.value)}
            placeholder="Escribe tu pregunta. La recibirá RRHH y te responderá."
            rows={2}
          />
          <Button size="sm" onClick={handleEnviarPregunta} disabled={enviandoPregunta || !nuevaPregunta.trim()}>
            {enviandoPregunta ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Enviar pregunta
          </Button>

          {preguntas.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">Tus preguntas</p>
              {preguntas.map((p) => (
                <div key={p.id} className="text-sm rounded-md bg-muted/50 px-3 py-2">
                  <p className="font-medium">{p.pregunta}</p>
                  {p.respuesta ? (
                    <p className="mt-1 text-emerald-700"><span className="font-medium">RRHH:</span> {p.respuesta}</p>
                  ) : (
                    <p className="mt-1 text-xs italic text-muted-foreground">Pendiente de respuesta</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
