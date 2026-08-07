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
import { Loader2, Send, Sparkles, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "../../../hooks/useEditorStore";
import { obtenerPagina } from "../../../actions/paginas-actions";
import {
  deshacerUltimoCambioChat,
  enviarMensajeChatWeb,
} from "../../../actions/chat-web-actions";

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
        "Dime qué quieres cambiar de la web y lo hago. De momento puedo retocar los textos: títulos, presentaciones y botones.",
    },
  ]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [puedeDeshacer, setPuedeDeshacer] = useState(false);
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
    if (!contenido || enviando) return;

    setMensajes((prev) => [...prev, { rol: "user", texto: contenido }]);
    setTexto("");
    setEnviando(true);

    const historial = mensajes.map((m) => ({ rol: m.rol, texto: m.texto }));
    const res = await enviarMensajeChatWeb({ paginaId, mensaje: contenido, historial });

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
        <div className="flex items-end gap-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe qué quieres cambiar…"
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
            disabled={enviando || !texto.trim()}
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
    </div>
  );
}
