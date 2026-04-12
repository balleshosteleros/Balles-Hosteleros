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
  Paperclip,
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GoogleConnectBanner } from "./GoogleConnectBanner";
import { useGoogleConnection } from "./useGoogleConnection";

type Mensaje = {
  id: string;
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
    remitente: "Hermanos Ruiz",
    email: "pedidos@hruiz.com",
    asunto: "Subida de precio en aceite de oliva",
    preview: "Hola Iván, te confirmamos la subida del aceite de oliva 5L de 28€ a 32€…",
    fecha: "10:23",
    leido: false,
    estrella: true,
    carpeta: "inbox",
    cuerpo: "Hola Iván,\n\nTe confirmamos la subida del aceite de oliva 5L de 28€ a 32€ a partir del próximo lunes 13 de abril.\n\nLa subida se debe al ajuste anual del proveedor.\n\nUn saludo,\nHermanos Ruiz",
  },
  {
    id: "m2",
    remitente: "Frigoríficos Costa",
    email: "averias@frigoscosta.es",
    asunto: "Confirmación visita técnica jueves",
    preview: "Confirmamos visita el jueves a las 10:00 para revisión preventiva…",
    fecha: "09:45",
    leido: false,
    estrella: false,
    carpeta: "inbox",
    cuerpo: "Confirmamos visita el jueves a las 10:00 para revisión preventiva del frigorífico de cocina.",
  },
  {
    id: "m3",
    remitente: "Sesame",
    email: "no-reply@sesametime.com",
    asunto: "Resumen semanal de fichajes",
    preview: "Esta semana se han registrado 312 fichajes en tu organización…",
    fecha: "Ayer",
    leido: true,
    estrella: false,
    carpeta: "inbox",
    cuerpo: "Esta semana se han registrado 312 fichajes en tu organización. 4 incidencias pendientes de revisar.",
  },
  {
    id: "m4",
    remitente: "Google Workspace",
    email: "admin@google.com",
    asunto: "Tu factura de marzo está lista",
    preview: "Adjuntamos la factura del periodo del 1 al 31 de marzo…",
    fecha: "Lun",
    leido: true,
    estrella: false,
    carpeta: "inbox",
    cuerpo: "Adjuntamos la factura del periodo del 1 al 31 de marzo.",
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

export function GmailDrawer({ children }: GmailDrawerProps) {
  const { connected } = useGoogleConnection();
  const [carpeta, setCarpeta] = useState<(typeof CARPETAS)[number]["id"]>("inbox");
  const [seleccionado, setSeleccionado] = useState<Mensaje | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mensajesReales, setMensajesReales] = useState<Mensaje[] | null>(null);
  const [cargando, setCargando] = useState(false);

  // Carga mensajes reales de Gmail cuando hay sesión Google
  useEffect(() => {
    if (!connected) {
      setMensajesReales(null);
      return;
    }
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
  }, [connected, carpeta]);

  // Carga el cuerpo del mensaje seleccionado bajo demanda
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
  }, [connected, seleccionado]);

  const fuente = mensajesReales ?? MOCK_MENSAJES;
  const mensajes = fuente.filter(
    (m) =>
      (mensajesReales !== null || m.carpeta === carpeta) &&
      (busqueda.trim() === "" ||
        m.asunto.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.remitente.toLowerCase().includes(busqueda.toLowerCase())),
  );

  const noLeidos = (mensajesReales ?? MOCK_MENSAJES).filter(
    (m) => !m.leido,
  ).length;

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-full max-w-5xl flex flex-col gap-0 p-0 sm:max-w-5xl"
      >
        <SheetHeader className="border-b px-5 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-red-500" />
            Email · Google Workspace
            {noLeidos > 0 && (
              <Badge className="ml-1 h-5 bg-red-500 text-[10px]">
                {noLeidos} sin leer
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {!connected && (
          <div className="border-b bg-muted/30 px-5 py-3">
            <GoogleConnectBanner servicio="Gmail" />
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          {/* Carpetas */}
          <aside className="w-44 border-r bg-muted/20 p-3">
            <Button className="w-full mb-3 bg-red-500 hover:bg-red-600" size="sm">
              + Redactar
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
                            !m.leido ? "font-bold text-foreground" : "font-medium text-foreground/80",
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
                          !m.leido ? "font-semibold text-foreground/90" : "text-foreground/70",
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
                    <Button variant="ghost" size="icon" className="h-8 w-8">
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
                  {seleccionado.cuerpo}
                </div>
                <div className="border-t p-3 flex gap-2">
                  <Button size="sm" variant="outline">
                    <Reply className="mr-1 h-3.5 w-3.5" /> Responder
                  </Button>
                  <Button size="sm" variant="outline">
                    <Forward className="mr-1 h-3.5 w-3.5" /> Reenviar
                  </Button>
                  <Button size="sm" variant="outline">
                    <Paperclip className="mr-1 h-3.5 w-3.5" /> Adjuntar
                  </Button>
                  <Button size="sm" variant="outline" className="ml-auto">
                    <Archive className="mr-1 h-3.5 w-3.5" /> Archivar
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
      </SheetContent>
    </Sheet>
  );
}
