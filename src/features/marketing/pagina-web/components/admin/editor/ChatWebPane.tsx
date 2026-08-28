"use client";

/**
 * PRP-076 · Fase 1 — Panel de chat para retocar la web hablando.
 *
 * Deliberadamente parecido a un chat de IA al uso: el usuario escribe lo que
 * quiere en español llano y ve el resultado en el lienzo al instante.
 * Los cambios son sobre el BORRADOR; publicar sigue siendo aparte.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, ImagePlus, Loader2, Send, Sparkles, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "../../../hooks/useEditorStore";
import { obtenerPagina } from "../../../actions/paginas-actions";
import {
  deshacerUltimoCambioChat,
  enviarMensajeChatWeb,
} from "../../../actions/chat-web-actions";
import { ImportarDeUrlDialog } from "./ImportarDeUrlDialog";
import { useSubidaImagenes, type ImagenItem } from "./forms/imagenes";

interface Props {
  paginaId: string;
  onCerrar: () => void;
}

interface Mensaje {
  rol: "user" | "assistant";
  texto: string;
  detalle?: string[];
}

const SUGERENCIAS = [
  "Haz el título principal más corto y directo",
  "Reescribe la presentación en un tono más cercano",
  "Cambia el texto del botón de reservar",
];

export function ChatWebPane({ paginaId, onCerrar }: Props) {
  const hydrate = useEditorStore((s) => s.hydrate);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      rol: "assistant",
      texto:
        "Dime qué quieres cambiar de la web y lo hago. Puedo retocar los textos (títulos, presentaciones y botones) y colocar las fotos que me adjuntes: dime a qué parte de la web va cada una.",
    },
  ]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [puedeDeshacer, setPuedeDeshacer] = useState(false);
  const [showImportar, setShowImportar] = useState(false);
  // Fotos ya subidas al bucket, esperando a que el usuario diga dónde van.
  const [adjuntas, setAdjuntas] = useState<ImagenItem[]>([]);
  const { subir, subiendo } = useSubidaImagenes();
  const fotoRef = useRef<HTMLInputElement>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, enviando]);

  /** Recarga los bloques desde BD para que el lienzo refleje el cambio. */
  const refrescarLienzo = async () => {
    const res = await obtenerPagina(paginaId);
    if (res.ok) hydrate(res.data);
  };

  const enviar = async (mensajeTexto?: string) => {
    const contenido = (mensajeTexto ?? texto).trim();
    // Con fotos adjuntas se puede enviar sin escribir nada.
    if ((!contenido && adjuntas.length === 0) || enviando) return;

    const fotos = adjuntas.map((f) => ({ url: f.url, nombre: f.alt }));
    const etiquetaFotos =
      fotos.length > 0
        ? `${fotos.length} foto${fotos.length > 1 ? "s" : ""} adjunta${fotos.length > 1 ? "s" : ""}`
        : "";
    setMensajes((prev) => [
      ...prev,
      { rol: "user", texto: contenido || `(${etiquetaFotos})`, detalle: contenido && etiquetaFotos ? [etiquetaFotos] : undefined },
    ]);
    setTexto("");
    setAdjuntas([]);
    setEnviando(true);

    const historial = mensajes.map((m) => ({ rol: m.rol, texto: m.texto }));
    const res = await enviarMensajeChatWeb({ paginaId, mensaje: contenido, historial, fotos });

    if (!res.ok) {
      setMensajes((prev) => [...prev, { rol: "assistant", texto: res.error }]);
      setEnviando(false);
      return;
    }

    setMensajes((prev) => [
      ...prev,
      { rol: "assistant", texto: res.data.respuesta, detalle: res.data.detalle },
    ]);
    if (res.data.aplicados > 0) {
      setPuedeDeshacer(true);
      await refrescarLienzo();
    }
    setEnviando(false);
  };

  const deshacer = async () => {
    const res = await deshacerUltimoCambioChat(paginaId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await refrescarLienzo();
    setPuedeDeshacer(false);
    setMensajes((prev) => [
      ...prev,
      { rol: "assistant", texto: "Deshecho. La web ha vuelto a como estaba." },
    ]);
  };

  return (
    <div className="w-[min(420px,40vw)] border-l bg-muted/20 flex flex-col">
      <header className="flex items-center gap-2 border-b bg-background px-3 py-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Asistente</span>
        {puedeDeshacer && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={deshacer}
            title="Deshacer el último cambio"
          >
            <Undo2 className="h-3.5 w-3.5 mr-1" /> Deshacer
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${puedeDeshacer ? "" : "ml-auto"}`}
          onClick={onCerrar}
          title="Cerrar asistente"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {mensajes.map((m, i) => (
          <div
            key={i}
            className={`text-sm rounded-lg px-3 py-2 max-w-[92%] ${
              m.rol === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-background border"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.texto}</p>
            {m.detalle && m.detalle.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {m.detalle.map((d, j) => (
                  <li key={j} className="text-xs text-muted-foreground">
                    · {d}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {mensajes.length === 1 && (
          <div className="space-y-1.5 pt-1">
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => enviar(s)}
                className="block w-full text-left text-xs rounded-md border bg-background px-3 py-2 hover:bg-muted/60 text-muted-foreground"
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowImportar(true)}
              className="flex w-full items-center gap-2 text-left text-xs rounded-md border bg-background px-3 py-2 hover:bg-muted/60 text-muted-foreground"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              Copiar el contenido de una web que ya tengo
            </button>
          </div>
        )}

        {enviando && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
          </div>
        )}
        <div ref={finRef} />
      </div>

      <div className="border-t bg-background p-2">
        {/* Fotos ya subidas, a la espera de destino. Se ven antes de enviar
            para que nadie mande la foto equivocada. */}
        {adjuntas.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {adjuntas.map((f, i) => (
              <div key={f.url} className="relative group">
                <div
                  className="h-14 w-14 rounded border bg-muted bg-cover bg-center"
                  style={{ backgroundImage: `url(${f.url})` }}
                  title={f.alt}
                />
                <button
                  type="button"
                  onClick={() => setAdjuntas((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-background border p-0.5 text-red-600 opacity-0 group-hover:opacity-100 transition"
                  title="Quitar esta foto"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <p className="w-full text-[11px] text-muted-foreground">
              Dime a qué parte de la web va cada foto.
            </p>
          </div>
        )}

        <input
          ref={fotoRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            if (!e.target.files?.length) return;
            const nuevas = await subir(e.target.files, 10 - adjuntas.length);
            if (nuevas.length) setAdjuntas((prev) => [...prev, ...nuevas]);
            if (fotoRef.current) fotoRef.current.value = "";
          }}
        />

        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => fotoRef.current?.click()}
            disabled={enviando || subiendo || adjuntas.length >= 10}
            title="Adjuntar fotos"
          >
            {subiendo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </Button>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe qué quieres cambiar, o adjunta fotos…"
            rows={2}
            className="resize-none text-sm"
            disabled={enviando}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
          />
          <Button
            variant="primary"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => enviar()}
            disabled={enviando || (!texto.trim() && adjuntas.length === 0)}
            title="Enviar"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 px-0.5">
          Los cambios quedan en borrador. La web publicada no cambia hasta que
          pulses Publicar.
        </p>
      </div>

      <ImportarDeUrlDialog
        open={showImportar}
        onOpenChange={setShowImportar}
        paginaId={paginaId}
        onImported={async () => {
          await refrescarLienzo();
          setMensajes((prev) => [
            ...prev,
            {
              rol: "assistant",
              texto:
                "He traído el contenido de esa web. Revísalo y dime qué quieres cambiar.",
            },
          ]);
        }}
      />
    </div>
  );
}
