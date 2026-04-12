"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  Mail,
  Search,
  Inbox,
  Send,
  FileText,
  Star,
  Trash2,
  Archive,
  Reply,
  Forward,
  Loader2,
  Pencil,
  X,
  Check,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GoogleConnectBanner } from "./GoogleConnectBanner";
import { GoogleAccountButton } from "./GoogleAccountButton";
import { useGoogleConnection } from "./useGoogleConnection";

type Mensaje = {
  id: string;
  threadId?: string;
  remitente: string;
  email: string;
  asunto: string;
  preview: string;
  fecha: string;
  leido: boolean;
  estrella: boolean;
  carpeta: "inbox" | "enviados" | "borradores" | "papelera";
  cuerpo: string;
};

const MOCK_MENSAJES: Mensaje[] = [
  {
    id: "m1",
    remitente: "Demo · Hermanos Ruiz",
    email: "pedidos@hruiz.com",
    asunto: "Subida de precio en aceite de oliva",
    preview: "Hola Iván, te confirmamos la subida del aceite de oliva 5L…",
    fecha: "10:23",
    leido: false,
    estrella: true,
    carpeta: "inbox",
    cuerpo:
      "Hola Iván,\n\nEsto es una vista previa de demostración. Conecta tu Google para ver tus correos reales.",
  },
];

const CARPETAS = [
  { id: "inbox", label: "Recibidos", icon: Inbox },
  { id: "enviados", label: "Enviados", icon: Send },
  { id: "borradores", label: "Borradores", icon: FileText },
  { id: "papelera", label: "Papelera", icon: Trash2 },
] as const;

interface GmailDrawerProps {
  children: ReactNode;
}

type ComposeState = {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  threadId?: string;
};

export function GmailDrawer({ children }: GmailDrawerProps) {
  const { connected } = useGoogleConnection();
  const [carpeta, setCarpeta] = useState<(typeof CARPETAS)[number]["id"]>("inbox");
  const [seleccionado, setSeleccionado] = useState<Mensaje | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mensajesReales, setMensajesReales] = useState<Mensaje[] | null>(null);
  const [cargando, setCargando] = useState(false);

  // Compose
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [enviando, setEnviando] = useState(false);

  function recargar() {
    if (!connected) return;
    setCargando(true);
    fetch(`/api/google/gmail/messages?carpeta=${carpeta}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.connected && Array.isArray(data.mensajes)) {
          setMensajesReales(
            data.mensajes.map((m: Omit<Mensaje, "cuerpo">) => ({
              ...m,
              cuerpo: "",
            })),
          );
        }
      })
      .catch(() => setMensajesReales([]))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    if (!connected) {
      setMensajesReales(null);
      return;
    }
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, carpeta]);

  useEffect(() => {
    if (!connected || !seleccionado || seleccionado.cuerpo) return;
    fetch(`/api/google/gmail/message?id=${seleccionado.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.cuerpo) {
          setSeleccionado((prev) =>
            prev ? { ...prev, cuerpo: data.cuerpo } : prev,
          );
        }
      })
      .catch(() => {});
    // Marcar como leído al abrirlo
    if (!seleccionado.leido && connected) {
      fetch("/api/google/gmail/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: seleccionado.id, action: "read" }),
      });
      setMensajesReales((prev) =>
        prev
          ? prev.map((m) => (m.id === seleccionado.id ? { ...m, leido: true } : m))
          : prev,
      );
    }
  }, [connected, seleccionado]);

  // Acciones
  async function actuar(action: string, id: string) {
    if (!connected) {
      toast.error("Conecta Google primero");
      return;
    }
    const res = await fetch("/api/google/gmail/modify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      const labels: Record<string, string> = {
        star: "Marcado",
        unstar: "Sin marcar",
        archive: "Archivado",
        trash: "Movido a la papelera",
        read: "Marcado como leído",
        unread: "Marcado como no leído",
      };
      toast.success(labels[action] ?? "Hecho");
      // Si es archivar/papelera, lo quitamos del listado y cerramos el panel
      if (action === "archive" || action === "trash") {
        setMensajesReales((prev) =>
          prev ? prev.filter((m) => m.id !== id) : prev,
        );
        setSeleccionado(null);
      } else {
        recargar();
      }
    } else {
      toast.error("No se pudo aplicar");
    }
  }

  function abrirRedactar() {
    setCompose({ to: "", subject: "", body: "" });
  }

  function abrirResponder() {
    if (!seleccionado) return;
    setCompose({
      to: seleccionado.email,
      subject: seleccionado.asunto.startsWith("Re:")
        ? seleccionado.asunto
        : `Re: ${seleccionado.asunto}`,
      body: `\n\n--- En respuesta a ${seleccionado.remitente} ---\n${seleccionado.cuerpo}`,
      inReplyTo: seleccionado.id,
      threadId: seleccionado.threadId,
    });
  }

  function abrirReenviar() {
    if (!seleccionado) return;
    setCompose({
      to: "",
      subject: seleccionado.asunto.startsWith("Fwd:")
        ? seleccionado.asunto
        : `Fwd: ${seleccionado.asunto}`,
      body: `\n\n---------- Mensaje reenviado ----------\nDe: ${seleccionado.remitente} <${seleccionado.email}>\nAsunto: ${seleccionado.asunto}\n\n${seleccionado.cuerpo}`,
    });
  }

  async function enviarEmail() {
    if (!compose || !compose.to || !compose.subject) {
      toast.error("Falta destinatario o asunto");
      return;
    }
    setEnviando(true);
    const res = await fetch("/api/google/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(compose),
    });
    setEnviando(false);
    if (res.ok) {
      toast.success("Email enviado");
      setCompose(null);
      recargar();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message || "No se pudo enviar el email");
    }
  }

  const fuente = mensajesReales ?? MOCK_MENSAJES;
  const mensajes = fuente.filter(
    (m) =>
      (mensajesReales !== null || m.carpeta === carpeta) &&
      (busqueda.trim() === "" ||
        m.asunto.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.remitente.toLowerCase().includes(busqueda.toLowerCase())),
  );

  const noLeidos = (mensajesReales ?? MOCK_MENSAJES).filter((m) => !m.leido).length;

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-full max-w-5xl flex flex-col gap-0 p-0 sm:max-w-5xl"
      >
        <SheetHeader className="border-b px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5 text-red-500" />
              Email · Google Workspace
              {noLeidos > 0 && (
                <Badge className="ml-1 h-5 bg-red-500 text-[10px]">
                  {noLeidos} sin leer
                </Badge>
              )}
              {cargando && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </SheetTitle>
            <GoogleAccountButton />
          </div>
        </SheetHeader>

        {!connected && (
          <div className="border-b bg-muted/30 px-5 py-3">
            <GoogleConnectBanner servicio="Gmail" />
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          {/* Carpetas */}
          <aside className="w-44 border-r bg-muted/20 p-3">
            <Button
              className="w-full mb-3 bg-red-500 hover:bg-red-600"
              size="sm"
              onClick={abrirRedactar}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Redactar
            </Button>
            <ul className="space-y-0.5">
              {CARPETAS.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    onClick={() => {
                      setCarpeta(id);
                      setSeleccionado(null);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      carpeta === id
                        ? "bg-red-50 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        : "text-muted-foreground hover:bg-muted/70",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* Lista de mensajes */}
          <div className="flex w-80 flex-col border-r">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar en el correo…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>
            </div>
            <ul className="flex-1 overflow-y-auto">
              {cargando ? (
                <li className="p-6 text-center text-xs text-muted-foreground">
                  Cargando mensajes…
                </li>
              ) : mensajes.length === 0 ? (
                <li className="p-6 text-center text-xs text-muted-foreground">
                  No hay mensajes en esta carpeta.
                </li>
              ) : (
                mensajes.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => setSeleccionado(m)}
                      className={cn(
                        "w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/40",
                        seleccionado?.id === m.id && "bg-red-50/80 dark:bg-red-950/20",
                        !m.leido && "bg-blue-50/30 dark:bg-blue-950/10",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm",
                            !m.leido
                              ? "font-bold text-foreground"
                              : "font-medium text-foreground/80",
                          )}
                        >
                          {m.remitente}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {m.fecha}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 truncate text-xs",
                          !m.leido
                            ? "font-semibold text-foreground/90"
                            : "text-foreground/70",
                        )}
                      >
                        {m.asunto}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {m.preview}
                      </p>
                      {m.estrella && (
                        <Star className="mt-1 h-3 w-3 fill-amber-400 text-amber-400" />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Vista del mensaje */}
          <div className="flex flex-1 flex-col">
            {seleccionado ? (
              <>
                <div className="border-b p-5">
                  <h2 className="text-lg font-bold text-foreground">
                    {seleccionado.asunto}
                  </h2>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white">
                      {seleccionado.remitente.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {seleccionado.remitente}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        &lt;{seleccionado.email}&gt; · {seleccionado.fecha}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        actuar(seleccionado.estrella ? "unstar" : "star", seleccionado.id)
                      }
                      title={seleccionado.estrella ? "Quitar estrella" : "Marcar"}
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          seleccionado.estrella && "fill-amber-400 text-amber-400",
                        )}
                      />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {seleccionado.cuerpo || "(sin contenido)"}
                </div>
                <div className="border-t p-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={abrirResponder}>
                    <Reply className="mr-1 h-3.5 w-3.5" /> Responder
                  </Button>
                  <Button size="sm" variant="outline" onClick={abrirReenviar}>
                    <Forward className="mr-1 h-3.5 w-3.5" /> Reenviar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => actuar("archive", seleccionado.id)}
                    className="ml-auto"
                  >
                    <Archive className="mr-1 h-3.5 w-3.5" /> Archivar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => actuar("trash", seleccionado.id)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Papelera
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Selecciona un mensaje para verlo aquí
              </div>
            )}
          </div>
        </div>

        {/* Compose dialog (modal interno del Sheet) */}
        {compose && (
          <div className="absolute inset-0 z-50 flex items-end justify-end bg-black/30 p-4">
            <div className="flex h-[80%] w-full max-w-lg flex-col rounded-t-lg border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
                <p className="text-sm font-semibold">
                  {compose.inReplyTo
                    ? "Responder"
                    : compose.subject?.startsWith("Fwd:")
                      ? "Reenviar"
                      : "Nuevo mensaje"}
                </p>
                <button
                  type="button"
                  onClick={() => setCompose(null)}
                  className="rounded p-1 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div>
                  <Label className="text-[11px]">Para</Label>
                  <Input
                    type="email"
                    value={compose.to}
                    onChange={(e) =>
                      setCompose({ ...compose, to: e.target.value })
                    }
                    placeholder="destinatario@correo.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Asunto</Label>
                  <Input
                    value={compose.subject}
                    onChange={(e) =>
                      setCompose({ ...compose, subject: e.target.value })
                    }
                    placeholder="Asunto"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Mensaje</Label>
                  <textarea
                    value={compose.body}
                    onChange={(e) =>
                      setCompose({ ...compose, body: e.target.value })
                    }
                    placeholder="Escribe aquí…"
                    className="mt-1 min-h-[200px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCompose(null)}
                >
                  Descartar
                </Button>
                <Button
                  size="sm"
                  className="bg-red-500 hover:bg-red-600"
                  onClick={enviarEmail}
                  disabled={enviando}
                >
                  {enviando ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-3.5 w-3.5" />
                  )}
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
