"use client";

import { ReactNode, useState } from "react";
import {
  ArrowLeft,
  MessageCircle,
  Send,
  Sparkles,
  UserRound,
  Video,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface SoporteDrawerProps {
  children: ReactNode;
}

type Vista = "menu" | "rapida" | "chat";

type RespuestaRapida = {
  texto: string;
  videoUrl?: string;
  fuente?: string;
};

type Mensaje = {
  id: string;
  rol: "user" | "ai" | "humano";
  texto: string;
};

export function SoporteDrawer({ children }: SoporteDrawerProps) {
  const [vista, setVista] = useState<Vista>("menu");

  // Estado: ayuda rápida
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [respuesta, setRespuesta] = useState<RespuestaRapida | null>(null);

  // Estado: chat
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: "0",
      rol: "ai",
      texto:
        "Hola 👋 Soy el asistente de Balles. Cuéntame qué necesitas y te ayudo. Si no puedo, te paso con tu jefe directo.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatCargando, setChatCargando] = useState(false);
  const [escalado, setEscalado] = useState(false);

  function reset() {
    setVista("menu");
    setPregunta("");
    setRespuesta(null);
  }

  async function preguntarRapida() {
    if (!pregunta.trim()) return;
    setCargando(true);
    setRespuesta(null);
    try {
      const res = await fetch("/api/soporte/ayuda-rapida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: pregunta.trim() }),
      });
      const data = await res.json();
      setRespuesta(data);
    } catch {
      setRespuesta({
        texto:
          "No he podido conectarme ahora mismo. Intenta de nuevo en unos segundos o pulsa abajo para hablar con tu jefe.",
      });
    } finally {
      setCargando(false);
    }
  }

  async function enviarChat() {
    if (!chatInput.trim()) return;
    const user: Mensaje = {
      id: `u-${Date.now()}`,
      rol: "user",
      texto: chatInput.trim(),
    };
    setMensajes((prev) => [...prev, user]);
    setChatInput("");
    setChatCargando(true);

    try {
      const res = await fetch("/api/soporte/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensajes: [...mensajes, user].map((m) => ({
            rol: m.rol,
            texto: m.texto,
          })),
        }),
      });
      const data = await res.json();
      const ai: Mensaje = {
        id: `a-${Date.now()}`,
        rol: data.escalar ? "humano" : "ai",
        texto: data.respuesta,
      };
      setMensajes((prev) => [...prev, ai]);
      if (data.escalar) setEscalado(true);
    } catch {
      setMensajes((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          rol: "ai",
          texto:
            "Lo siento, no puedo responderte ahora. Voy a avisar a tu jefe directo.",
        },
      ]);
      setEscalado(true);
    } finally {
      setChatCargando(false);
    }
  }

  function escalarAhora() {
    setEscalado(true);
    setMensajes((prev) => [
      ...prev,
      {
        id: `esc-${Date.now()}`,
        rol: "humano",
        texto:
          "He avisado a tu jefe directo. Te contestará en cuanto pueda. Mientras tanto puedes seguir escribiendo aquí.",
      },
    ]);
  }

  return (
    <Sheet onOpenChange={(open) => !open && reset()}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            {vista !== "menu" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2"
                onClick={reset}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <SheetTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-5 w-5 text-emerald-600" />
              {vista === "menu" && "¿Cómo te podemos ayudar?"}
              {vista === "rapida" && "Ayuda rápida"}
              {vista === "chat" && "Chat de soporte"}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {vista === "menu" &&
              "Elige cómo prefieres que te ayudemos."}
            {vista === "rapida" &&
              "Describe lo que necesitas en una frase. Te buscamos la respuesta al momento."}
            {vista === "chat" &&
              (escalado
                ? "Hablando con tu jefe directo"
                : "Empezarás hablando con la IA. Si no resuelve, te paso con una persona.")}
          </SheetDescription>
        </SheetHeader>

        {/* MENU */}
        {vista === "menu" && (
          <div className="flex-1 p-5 space-y-3">
            <button
              onClick={() => setVista("rapida")}
              className="w-full rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-5 text-left transition-all hover:border-blue-400 hover:shadow-md dark:border-blue-900/50 dark:bg-blue-950/30"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-blue-600 p-2.5 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-foreground">
                    Pedir ayuda rápida
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cuenta en una frase qué necesitas. La IA busca en
                    nuestra base de información y te responde —
                    normalmente con un vídeo explicativo.
                  </p>
                  <Badge className="mt-2 bg-blue-100 text-[10px] text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    Respuesta inmediata
                  </Badge>
                </div>
              </div>
            </button>

            <button
              onClick={() => setVista("chat")}
              className="w-full rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-5 text-left transition-all hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/50 dark:bg-emerald-950/30"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-600 p-2.5 text-white">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-foreground">
                    Hablar con tu jefe o un agente
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Empiezas hablando con la IA. Si no te resuelve la
                    duda, te pasa directamente con tu responsable.
                  </p>
                  <Badge className="mt-2 bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    Persona disponible
                  </Badge>
                </div>
              </div>
            </button>

            <p className="pt-2 text-center text-[11px] text-muted-foreground">
              Tu jefe directo se asigna automáticamente cuando te dan
              de alta como empleado.
            </p>
          </div>
        )}

        {/* AYUDA RÁPIDA */}
        {vista === "rapida" && (
          <div className="flex flex-1 flex-col">
            <div className="border-b p-4">
              <div className="flex gap-2">
                <Input
                  value={pregunta}
                  onChange={(e) => setPregunta(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && preguntarRapida()}
                  placeholder="Ej: cómo fichar la entrada"
                  className="flex-1"
                  autoFocus
                />
                <Button
                  onClick={preguntarRapida}
                  disabled={cargando || !pregunta.trim()}
                >
                  {cargando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Buscar"
                  )}
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {!respuesta && !cargando && (
                <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-xs text-muted-foreground">
                  Escribe tu pregunta arriba y pulsa Buscar.
                </div>
              )}
              {cargando && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando en la base de información…
                </div>
              )}
              {respuesta && (
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                      <Sparkles className="h-3.5 w-3.5" />
                      Respuesta
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {respuesta.texto}
                    </p>
                    {respuesta.fuente && (
                      <p className="mt-3 text-[10px] text-muted-foreground">
                        Fuente: {respuesta.fuente}
                      </p>
                    )}
                  </div>

                  {respuesta.videoUrl ? (
                    <a
                      href={respuesta.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-2xl border-2 border-red-200 bg-red-50/60 p-4 transition-all hover:border-red-400 dark:border-red-900/50 dark:bg-red-950/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-red-600 p-2 text-white">
                          <Video className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Vídeo explicativo
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Pulsa para verlo
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ) : (
                    <p className="text-center text-[11px] text-muted-foreground">
                      Todavía no hay vídeo para esta respuesta.
                    </p>
                  )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setVista("chat")}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    No me sirve, hablar con mi jefe
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHAT */}
        {vista === "chat" && (
          <div className="flex flex-1 flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mensajes.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.rol === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <div
                    className={
                      m.rol === "user"
                        ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground"
                        : m.rol === "humano"
                          ? "max-w-[85%] rounded-2xl rounded-bl-sm border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-foreground dark:border-emerald-900/50 dark:bg-emerald-950/40"
                          : "max-w-[85%] rounded-2xl rounded-bl-sm border bg-muted/40 px-4 py-2 text-sm text-foreground"
                    }
                  >
                    {m.rol !== "user" && (
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {m.rol === "humano" ? (
                          <>
                            <UserRound className="h-3 w-3" /> Tu jefe
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" /> Asistente
                          </>
                        )}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{m.texto}</p>
                  </div>
                </div>
              ))}
              {chatCargando && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Pensando…
                </div>
              )}
            </div>

            {!escalado && (
              <div className="border-t bg-muted/20 px-4 py-2">
                <button
                  onClick={escalarAhora}
                  className="text-xs text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  ¿Prefieres hablar directamente con tu jefe? Pulsa aquí
                </button>
              </div>
            )}

            <div className="border-t p-3">
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && enviarChat()}
                  placeholder="Escribe tu mensaje…"
                  className="flex-1"
                />
                <Button
                  onClick={enviarChat}
                  disabled={chatCargando || !chatInput.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
