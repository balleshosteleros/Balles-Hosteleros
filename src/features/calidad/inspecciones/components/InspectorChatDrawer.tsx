"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface InspectorChatDrawerProps {
  token: string;
  empresaNombre: string;
  accentColor: string;
}

interface Mensaje {
  role: "user" | "assistant";
  content: string;
}

const SUGERENCIAS = [
  "¿Qué significa cada nota de la escala 0–5?",
  "¿Cómo relleno la sección de observaciones?",
  "¿Qué pongo si no estoy seguro de un dato?",
];

export function InspectorChatDrawer({
  token,
  empresaNombre,
  accentColor,
}: InspectorChatDrawerProps) {
  const [open, setOpen] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, enviando]);

  async function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setError(null);
    const nuevos: Mensaje[] = [...mensajes, { role: "user", content: limpio }];
    setMensajes(nuevos);
    setInput("");
    setEnviando(true);
    try {
      const res = await fetch(`/api/inspectores/${token}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: nuevos }),
      });
      const json = (await res.json()) as
        | { ok: true; respuesta: string }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error : "No se pudo enviar");
        return;
      }
      setMensajes((prev) => [...prev, { role: "assistant", content: json.respuesta }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setEnviando(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void enviar(input);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg shadow-black/30 transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: accentColor, color: "#0a0a0a" }}
        aria-label="Abrir chat de ayuda"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm font-semibold hidden sm:inline">¿Tienes dudas?</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex flex-col gap-0 p-0 w-full sm:max-w-md sm:w-[420px]"
        >
          <SheetHeader
            className="border-b px-5 py-4 text-left"
            style={{ backgroundColor: accentColor }}
          >
            <SheetTitle className="flex items-center gap-2 text-base text-[#0a0a0a]">
              <Sparkles className="h-4 w-4" />
              Ayuda con la inspección
            </SheetTitle>
            <SheetDescription className="text-xs text-[#0a0a0a]/80">
              Pregúntame cualquier duda sobre este formulario de {empresaNombre}.
              Solo veo esta inspección — nada interno del restaurante.
            </SheetDescription>
          </SheetHeader>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/20"
          >
            {mensajes.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Algunas preguntas frecuentes:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void enviar(s)}
                      className="text-left text-sm rounded-md border bg-background px-3 py-2 hover:bg-muted/40 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "text-[#0a0a0a] rounded-br-sm"
                      : "bg-background border rounded-bl-sm"
                  }`}
                  style={
                    m.role === "user" ? { backgroundColor: accentColor } : undefined
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {enviando && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-background border px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Pensando…
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-xs">
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t bg-background px-3 py-3 flex items-end gap-2"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar(input);
                }
              }}
              placeholder="Escribe tu duda…"
              rows={1}
              className="resize-none min-h-[40px] max-h-32"
              disabled={enviando}
            />
            <Button
              type="submit"
              size="icon"
              disabled={enviando || !input.trim()}
              style={{ backgroundColor: accentColor, color: "#0a0a0a" }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
