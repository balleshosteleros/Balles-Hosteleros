"use client";

import { ReactNode, useState, useEffect } from "react";
import {
  ArrowLeft,
  MessageCircle,
  Send,
  Sparkles,
  UserRound,
  Video,
  Loader2,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  ChevronDown,
  ChevronRight,
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
import { useAuth } from "@/features/auth/contexts/auth-context";
import { FormacionRolViewer } from "@/features/formacion/components/FormacionRolViewer";

interface SoporteDrawerProps {
  children: ReactNode;
}

type Vista = "menu" | "rapida" | "chat" | "formacion" | "faq";

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
  const { roles } = useAuth();
  const [vista, setVista] = useState<Vista>("menu");

  // Ayuda rápida
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [respuesta, setRespuesta] = useState<RespuestaRapida | null>(null);

  // Chat
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

  // FAQ expandida
  const [faqAbierta, setFaqAbierta] = useState<string | null>(null);

  function reset() {
    setVista("menu");
    setPregunta("");
    setRespuesta(null);
    setFaqAbierta(null);
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
    const user: Mensaje = { id: `u-${Date.now()}`, rol: "user", texto: chatInput.trim() };
    setMensajes((prev) => [...prev, user]);
    setChatInput("");
    setChatCargando(true);
    try {
      const res = await fetch("/api/soporte/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensajes: [...mensajes, user].map((m) => ({ rol: m.rol, texto: m.texto })),
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
        { id: `e-${Date.now()}`, rol: "ai", texto: "Lo siento, no puedo responderte ahora. Voy a avisar a tu jefe directo." },
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
        texto: "He avisado a tu jefe directo. Te contestará en cuanto pueda. Mientras tanto puedes seguir escribiendo aquí.",
      },
    ]);
  }

  const PREGUNTAS_FRECUENTES = [
    {
      id: "f1",
      pregunta: "¿Cómo ficho mi entrada y mi salida?",
      respuesta: "Ve a RRHH → Fichajes en el menú lateral. Pulsa el botón verde 'Fichar entrada' al llegar y 'Fichar salida' cuando termines. Asegúrate de tener la ubicación activada si el sistema lo requiere.",
    },
    {
      id: "f2",
      pregunta: "¿Cómo solicito un día de vacaciones o permiso?",
      respuesta: "Dirígete a RRHH → Calendarios. Allí puedes ver los días disponibles y hacer la solicitud. Tu responsable recibirá una notificación y te confirmará la aprobación.",
    },
    {
      id: "f3",
      pregunta: "¿Dónde veo mi horario de trabajo?",
      respuesta: "En RRHH → Horarios encontrarás tu planificación semanal actualizada. Si hay algún error, comunícalo a tu responsable directamente desde esa pantalla.",
    },
    {
      id: "f4",
      pregunta: "¿Cómo consulto mi nómina o mis pagos?",
      respuesta: "Accede a RRHH → Pagos o RRHH → Salarios según tu perfil de acceso. Ahí encontrarás el historial de nóminas y el desglose de cada período.",
    },
    {
      id: "f5",
      pregunta: "¿Qué hago si tengo un problema técnico con la app?",
      respuesta: "Pulsa el botón 'Pedir ayuda rapida' en este mismo panel y describe el problema. Si no se resuelve, usa 'Hablar con tu jefe' para que lo gestione directamente.",
    },
    {
      id: "f6",
      pregunta: "¿Cómo accedo a las fichas técnicas de los platos?",
      respuesta: "En el menú lateral, ve a Cocina → Fichas Técnicas. Puedes buscar por nombre de plato, alérgenos o partida. Solo tienes acceso a las fichas de tu departamento.",
    },
    {
      id: "f7",
      pregunta: "¿Dónde reporto una incidencia de logística o mantenimiento?",
      respuesta: "Para logística ve a Logística → Incidencias. Para mantenimiento ve a Gerencia → Mantenimiento. Rellena el formulario con una descripción y foto si es posible.",
    },
    {
      id: "f8",
      pregunta: "¿Puedo ver los comunicados de la empresa?",
      respuesta: "Sí. En Gerencia → Comunicados o RRHH → Comunicados (según quién los publique) encontrarás todos los avisos del equipo directivo y de RRHH.",
    },
  ];

  const VISTA_TITLE: Record<Vista, string> = {
    menu: "¿Cómo te podemos ayudar?",
    rapida: "Ayuda rápida",
    chat: "Chat de soporte",
    formacion: "Formación inicial",
    faq: "Preguntas frecuentes",
  };

  return (
    <Sheet onOpenChange={(open) => !open && reset()}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">

        {/* HEADER */}
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            {vista !== "menu" && (
              <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={reset}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <SheetTitle className="flex items-center gap-2 text-base">
              {vista === "formacion" ? (
                <GraduationCap className="h-5 w-5 text-orange-500" />
              ) : vista === "faq" ? (
                <HelpCircle className="h-5 w-5 text-amber-500" />
              ) : (
                <UserRound className="h-5 w-5 text-emerald-600" />
              )}
              {VISTA_TITLE[vista]}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {vista === "menu" && "Elige cómo prefieres que te ayudemos."}
            {vista === "rapida" && "Describe lo que necesitas en una frase. Te buscamos la respuesta al momento."}
            {vista === "chat" && (escalado ? "Hablando con tu jefe directo" : "Empezarás hablando con la IA. Si no resuelve, te paso con una persona.")}
            {vista === "formacion" && "Repasa el contenido de tu incorporación cuando quieras."}
            {vista === "faq" && "Las dudas más habituales resueltas en un clic."}
          </SheetDescription>
        </SheetHeader>

        {/* ── MENU ── */}
        {vista === "menu" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">

            {/* Ayuda rápida */}
            <button
              onClick={() => setVista("rapida")}
              className="w-full rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-5 text-left transition-all hover:border-blue-400 hover:shadow-md dark:border-blue-900/50 dark:bg-blue-950/30"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-blue-600 p-2.5 text-white shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-foreground">Pedir ayuda rápida</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cuenta en una frase qué necesitas. La IA busca en nuestra base de información y te responde.
                  </p>
                  <Badge className="mt-2 bg-blue-100 text-[10px] text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    Respuesta inmediata
                  </Badge>
                </div>
              </div>
            </button>

            {/* Chat con jefe */}
            <button
              onClick={() => setVista("chat")}
              className="w-full rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-5 text-left transition-all hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/50 dark:bg-emerald-950/30"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-600 p-2.5 text-white shrink-0">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-foreground">Hablar con tu jefe o un agente</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Empiezas hablando con la IA. Si no te resuelve la duda, te pasa directamente con tu responsable.
                  </p>
                  <Badge className="mt-2 bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    Persona disponible
                  </Badge>
                </div>
              </div>
            </button>

            {/* Ver Formación Inicial */}
            <button
              onClick={() => setVista("formacion")}
              className="w-full rounded-2xl border-2 border-orange-200 bg-orange-50/60 p-5 text-left transition-all hover:border-orange-400 hover:shadow-md dark:border-orange-900/50 dark:bg-orange-950/30"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-orange-500 p-2.5 text-white shrink-0">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-foreground">Ver Formación Inicial de nuevo</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Repasa los módulos, la filosofía y el material de tu incorporación. Filtrado por tu rol.
                  </p>
                  <Badge className="mt-2 bg-orange-100 text-[10px] text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                    Tu contenido
                  </Badge>
                </div>
              </div>
            </button>

            {/* Preguntas frecuentes */}
            <button
              onClick={() => setVista("faq")}
              className="w-full rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-5 text-left transition-all hover:border-amber-400 hover:shadow-md dark:border-amber-900/50 dark:bg-amber-950/30"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-500 p-2.5 text-white shrink-0">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-foreground">Preguntas frecuentes</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Las dudas más habituales del equipo, con respuesta directa. Rápido y sin esperas.
                  </p>
                  <Badge className="mt-2 bg-amber-100 text-[10px] text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                    Respuesta inmediata
                  </Badge>
                </div>
              </div>
            </button>

            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              Tu jefe directo se asigna automáticamente cuando te dan de alta como empleado.
            </p>
          </div>
        )}

        {/* ── AYUDA RÁPIDA ── */}
        {vista === "rapida" && (
          <div className="flex flex-1 flex-col min-h-0">
            <div className="border-b p-4 shrink-0">
              <div className="flex gap-2">
                <Input
                  value={pregunta}
                  onChange={(e) => setPregunta(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && preguntarRapida()}
                  placeholder="Ej: cómo fichar la entrada"
                  className="flex-1"
                  autoFocus
                />
                <Button onClick={preguntarRapida} disabled={cargando || !pregunta.trim()}>
                  {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                </div>
              )}
              {respuesta && (
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                      <Sparkles className="h-3.5 w-3.5" /> Respuesta
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {respuesta.texto}
                    </p>
                    {respuesta.fuente && (
                      <p className="mt-3 text-[10px] text-muted-foreground">Fuente: {respuesta.fuente}</p>
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
                          <p className="text-sm font-semibold">Vídeo explicativo</p>
                          <p className="text-[11px] text-muted-foreground">Pulsa para verlo</p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ) : (
                    <p className="text-center text-[11px] text-muted-foreground">
                      Todavía no hay vídeo para esta respuesta.
                    </p>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => setVista("chat")}>
                    <MessageCircle className="mr-2 h-4 w-4" /> No me sirve, hablar con mi jefe
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CHAT ── */}
        {vista === "chat" && (
          <div className="flex flex-1 flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mensajes.map((m) => (
                <div key={m.id} className={m.rol === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      m.rol === "user"
                        ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground"
                        : m.rol === "humano"
                          ? "max-w-[85%] rounded-2xl rounded-bl-sm border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/40"
                          : "max-w-[85%] rounded-2xl rounded-bl-sm border bg-muted/40 px-4 py-2 text-sm"
                    }
                  >
                    {m.rol !== "user" && (
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {m.rol === "humano" ? <><UserRound className="h-3 w-3" /> Tu jefe</> : <><Sparkles className="h-3 w-3" /> Asistente</>}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{m.texto}</p>
                  </div>
                </div>
              ))}
              {chatCargando && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Pensando…
                </div>
              )}
            </div>
            {!escalado && (
              <div className="border-t bg-muted/20 px-4 py-2 shrink-0">
                <button onClick={escalarAhora} className="text-xs text-emerald-700 hover:underline dark:text-emerald-400">
                  ¿Prefieres hablar directamente con tu jefe? Pulsa aquí
                </button>
              </div>
            )}
            <div className="border-t p-3 shrink-0">
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && enviarChat()}
                  placeholder="Escribe tu mensaje…"
                  className="flex-1"
                />
                <Button onClick={enviarChat} disabled={chatCargando || !chatInput.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── FORMACIÓN INICIAL ── */}
        {vista === "formacion" && (
          <div className="flex-1 overflow-y-auto p-5">
            <FormacionRolViewer userRoles={roles} />
          </div>
        )}

        {/* ── PREGUNTAS FRECUENTES ── */}
        {vista === "faq" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {PREGUNTAS_FRECUENTES.map((faq) => {
              const abierta = faqAbierta === faq.id;
              return (
                <div
                  key={faq.id}
                  className="rounded-xl border bg-card overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setFaqAbierta(abierta ? null : faq.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-sm font-semibold text-foreground leading-snug">
                      {faq.pregunta}
                    </span>
                    {abierta
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                  </button>
                  {abierta && (
                    <div className="px-4 pb-4 border-t bg-muted/20">
                      <p className="pt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {faq.respuesta}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="pt-3 pb-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setVista("chat")}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                No encuentro lo que busco, hablar con mi jefe
              </Button>
            </div>
          </div>
        )}

      </SheetContent>
    </Sheet>
  );
}
