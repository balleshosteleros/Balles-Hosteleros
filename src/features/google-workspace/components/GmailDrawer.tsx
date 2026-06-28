"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
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
  Folder,
  FolderOpen,
  FolderInput,
  ChevronRight,
  ChevronDown,
  Menu as MenuIcon,
  RefreshCw,
  MoreVertical,
  ChevronLeft,
  Plus,
  SlidersHorizontal,
  ArrowLeft,
  Sparkles,
  Wand2,
  RotateCcw,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GoogleConnectBanner } from "./GoogleConnectBanner";
import { GoogleReauthBanner } from "./GoogleReauthBanner";
import { GoogleAccountButton } from "./GoogleAccountButton";
import { useGoogleConnection } from "./useGoogleConnection";
import { sanitizeEmailHtml } from "@/shared/lib/sanitize-email-html";
import { refreshDailyCounts } from "./useDailyCounts";

type MensajeHilo = {
  id: string;
  remitente: string;
  email: string;
  fecha: string;
  cuerpo: string;
  cuerpoHtml?: string;
  leido: boolean;
};

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
  carpeta: string;
  cuerpo: string;
  cuerpoHtml?: string;
  labelIds?: string[];
  mensajesHilo?: MensajeHilo[];
};

type CarpetaUsuario = { id: string; nombre: string };

type CarpetaNodo = {
  id: string | null;
  label: string;
  ruta: string;
  hijos: CarpetaNodo[];
};

function construirArbolCarpetas(carpetas: CarpetaUsuario[]): CarpetaNodo[] {
  const raiz: CarpetaNodo = { id: null, label: "", ruta: "", hijos: [] };
  const mapa = new Map<string, CarpetaNodo>();
  mapa.set("", raiz);

  const ordenadas = [...carpetas].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es"),
  );

  for (const c of ordenadas) {
    const segmentos = c.nombre.split("/").map((s) => s.trim()).filter(Boolean);
    let rutaAcum = "";
    let padre = raiz;
    for (let i = 0; i < segmentos.length; i++) {
      const seg = segmentos[i];
      rutaAcum = rutaAcum ? `${rutaAcum}/${seg}` : seg;
      let nodo = mapa.get(rutaAcum);
      if (!nodo) {
        nodo = { id: null, label: seg, ruta: rutaAcum, hijos: [] };
        mapa.set(rutaAcum, nodo);
        padre.hijos.push(nodo);
      }
      if (i === segmentos.length - 1) {
        nodo.id = c.id;
      }
      padre = nodo;
    }
  }

  return raiz.hijos;
}

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
    labelIds: [],
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
  emailOriginal?: {
    remitente: string;
    asunto: string;
    cuerpo: string;
  };
};

type AISugerencia = { asunto: string; cuerpo: string };

type AITono = "profesional" | "cercano" | "directo" | "formal" | "amistoso";
type AILongitud = "corto" | "medio" | "largo";

type Filtro =
  | { tipo: "sistema"; id: "inbox" | "enviados" | "borradores" | "papelera" }
  | { tipo: "label"; id: string; nombre: string };

export function GmailDrawer({ children }: GmailDrawerProps) {
  const { connected, email: userEmail, picture: userPicture } = useGoogleConnection();
  const [filtro, setFiltro] = useState<Filtro>({ tipo: "sistema", id: "inbox" });
  const [seleccionado, setSeleccionado] = useState<Mensaje | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mensajesReales, setMensajesReales] = useState<Mensaje[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [carpetasUsuario, setCarpetasUsuario] = useState<CarpetaUsuario[]>([]);
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({});
  const [sidebarAbierto, setSidebarAbierto] = useState(true);
  const [fotosContactos, setFotosContactos] = useState<Record<string, string>>({});
  const [needsReauth, setNeedsReauth] = useState(false);
  useGlobalLoadingSync(cargando);

  const arbolCarpetas = useMemo(
    () => construirArbolCarpetas(carpetasUsuario),
    [carpetasUsuario],
  );

  const labelIdToNombre = useMemo(() => {
    const m = new Map<string, string>();
    carpetasUsuario.forEach((c) => m.set(c.id, c.nombre));
    return m;
  }, [carpetasUsuario]);

  function alternarGrupo(ruta: string) {
    setGruposAbiertos((prev) => ({ ...prev, [ruta]: !prev[ruta] }));
  }

  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [enviando, setEnviando] = useState(false);
  useGlobalLoadingSync(enviando);
  const [firmaHtml, setFirmaHtml] = useState<string>("");
  const [incluirFirma, setIncluirFirma] = useState(true);

  const [aiCargando, setAiCargando] = useState(false);
  const [aiSugerencia, setAiSugerencia] = useState<AISugerencia | null>(null);
  const [aiInstruccion, setAiInstruccion] = useState("");
  const [aiAbierto, setAiAbierto] = useState(false);
  const [aiTono, setAiTono] = useState<AITono>("profesional");
  const [aiLongitud, setAiLongitud] = useState<AILongitud>("medio");

  const carpeta =
    filtro.tipo === "sistema" ? filtro.id : (`label:${filtro.id}` as string);

  function recargar() {
    if (!connected) return;
    setCargando(true);
    const url =
      filtro.tipo === "sistema"
        ? `/api/google/gmail/messages?carpeta=${filtro.id}`
        : `/api/google/gmail/messages?labelId=${encodeURIComponent(filtro.id)}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.needsReauth || data.connected === false) {
          setNeedsReauth(true);
          setMensajesReales([]);
          return;
        }
        if (data.connected && Array.isArray(data.mensajes)) {
          setNeedsReauth(false);
          const lista: Mensaje[] = data.mensajes.map(
            (m: Omit<Mensaje, "cuerpo">) => ({ ...m, cuerpo: "" }),
          );
          setMensajesReales(lista);
          // Pedir fotos de perfil de los remitentes que aún no tenemos cacheadas
          const emailsPendientes = Array.from(
            new Set(
              lista
                .map((m) => m.email?.toLowerCase())
                .filter((e): e is string => !!e && !(e in fotosContactos)),
            ),
          );
          if (emailsPendientes.length > 0) {
            fetch("/api/google/people/photos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ emails: emailsPendientes }),
            })
              .then((r) => r.json())
              .then((res) => {
                if (res.connected && res.photos) {
                  setFotosContactos((prev) => ({ ...prev, ...res.photos }));
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => setMensajesReales([]))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    if (!connected) {
      setCarpetasUsuario([]);
      setFirmaHtml("");
      setNeedsReauth(false);
      return;
    }
    fetch("/api/google/gmail/labels")
      .then((r) => r.json())
      .then((data) => {
        if (data.needsReauth) {
          setNeedsReauth(true);
          setCarpetasUsuario([]);
          return;
        }
        if (Array.isArray(data.carpetas)) setCarpetasUsuario(data.carpetas);
      })
      .catch(() => setCarpetasUsuario([]));
    fetch("/api/google/gmail/signature")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.signature === "string") setFirmaHtml(data.signature);
      })
      .catch(() => setFirmaHtml(""));
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      setMensajesReales(null);
      return;
    }
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, filtro]);

  useEffect(() => {
    if (!connected || !seleccionado) return;
    // Si ya tenemos el hilo cargado, no recargar
    if (seleccionado.mensajesHilo && seleccionado.mensajesHilo.length > 0) return;

    // Si tenemos threadId pedimos el hilo entero (todos los mensajes), como Gmail.
    // Si no, fallback a mensaje único.
    const url = seleccionado.threadId
      ? `/api/google/gmail/message?threadId=${encodeURIComponent(seleccionado.threadId)}`
      : `/api/google/gmail/message?id=${seleccionado.id}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.mensajes) && data.mensajes.length > 0) {
          // Hilo completo
          const mensajesHilo: MensajeHilo[] = data.mensajes.map(
            (m: MensajeHilo & { asunto?: string }) => ({
              id: m.id,
              remitente: m.remitente,
              email: m.email,
              fecha: m.fecha,
              cuerpo: m.cuerpo,
              cuerpoHtml: m.cuerpoHtml,
              leido: m.leido,
            }),
          );
          const ultimo = mensajesHilo[mensajesHilo.length - 1];
          setSeleccionado((prev) =>
            prev
              ? {
                  ...prev,
                  cuerpo: ultimo.cuerpo,
                  cuerpoHtml: ultimo.cuerpoHtml,
                  mensajesHilo,
                }
              : prev,
          );
        } else if (data.cuerpo || data.cuerpoHtml) {
          // Mensaje único (fallback)
          setSeleccionado((prev) =>
            prev
              ? {
                  ...prev,
                  cuerpo: data.cuerpo ?? prev.cuerpo,
                  cuerpoHtml: data.cuerpoHtml ?? prev.cuerpoHtml,
                }
              : prev,
          );
        }
      })
      .catch(() => {});
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
      // Actualiza el badge de "sin leer" de la barra al instante.
      refreshDailyCounts();
    }
  }, [connected, seleccionado]);

  async function actuar(action: string, id: string, labelId?: string) {
    if (!connected) {
      toast.error("Conecta Google primero");
      return;
    }
    const res = await fetch("/api/google/gmail/modify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, labelId }),
    });
    if (res.ok) {
      const labels: Record<string, string> = {
        star: "Marcado",
        unstar: "Sin marcar",
        archive: "Archivado",
        trash: "Movido a la papelera",
        delete: "Eliminado definitivamente",
        read: "Marcado como leído",
        unread: "Marcado como no leído",
        moveToLabel: "Movido a la carpeta",
        addLabel: "Etiqueta añadida",
        removeLabel: "Etiqueta quitada",
      };
      toast.success(labels[action] ?? "Hecho");
      const sacaDelListado =
        action === "archive" ||
        action === "trash" ||
        action === "moveToLabel";
      if (sacaDelListado) {
        setMensajesReales((prev) =>
          prev ? prev.filter((m) => m.id !== id) : prev,
        );
        setSeleccionado(null);
      } else {
        recargar();
      }
      // Refresca el badge de "sin leer" (leer / no leer / archivar / borrar
      // pueden cambiar el número de correos pendientes).
      refreshDailyCounts();
    } else {
      toast.error("No se pudo aplicar");
    }
  }

  function resetIA() {
    setAiSugerencia(null);
    setAiInstruccion("");
    setAiAbierto(false);
    setAiCargando(false);
  }

  function cerrarCompose() {
    setCompose(null);
    resetIA();
  }

  function abrirRedactar() {
    resetIA();
    setCompose({ to: "", subject: "", body: "" });
  }

  function abrirResponder() {
    if (!seleccionado) return;
    resetIA();
    setCompose({
      to: seleccionado.email,
      subject: seleccionado.asunto.startsWith("Re:")
        ? seleccionado.asunto
        : `Re: ${seleccionado.asunto}`,
      body: `\n\n--- En respuesta a ${seleccionado.remitente} ---\n${seleccionado.cuerpo}`,
      inReplyTo: seleccionado.id,
      threadId: seleccionado.threadId,
      emailOriginal: {
        remitente: `${seleccionado.remitente} <${seleccionado.email}>`,
        asunto: seleccionado.asunto,
        cuerpo: seleccionado.cuerpo,
      },
    });
  }

  function abrirReenviar() {
    if (!seleccionado) return;
    resetIA();
    setCompose({
      to: "",
      subject: seleccionado.asunto.startsWith("Fwd:")
        ? seleccionado.asunto
        : `Fwd: ${seleccionado.asunto}`,
      body: `\n\n---------- Mensaje reenviado ----------\nDe: ${seleccionado.remitente} <${seleccionado.email}>\nAsunto: ${seleccionado.asunto}\n\n${seleccionado.cuerpo}`,
      emailOriginal: {
        remitente: `${seleccionado.remitente} <${seleccionado.email}>`,
        asunto: seleccionado.asunto,
        cuerpo: seleccionado.cuerpo,
      },
    });
  }

  async function pedirIA() {
    if (!compose) return;
    const tieneCuerpo = compose.body.trim().length > 0;
    const modo: "mejorar" | "responder" | "reenviar" | "redactar" = compose.inReplyTo
      ? "responder"
      : compose.subject?.startsWith("Fwd:")
        ? "reenviar"
        : tieneCuerpo
          ? "mejorar"
          : "redactar";

    if (!tieneCuerpo && !aiInstruccion.trim() && !compose.emailOriginal?.cuerpo) {
      toast.error("Escribe un borrador o una instrucción para la IA");
      return;
    }

    setAiCargando(true);
    try {
      const res = await fetch("/api/google/gmail/ai-redactar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrador: compose.body,
          asunto: compose.subject,
          destinatario: compose.to,
          modo,
          tono: aiTono,
          longitud: aiLongitud,
          idioma: "es",
          instruccion: aiInstruccion,
          emailOriginal: compose.emailOriginal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo generar la respuesta");
        return;
      }
      setAiSugerencia({ asunto: data.asunto ?? compose.subject, cuerpo: data.cuerpo ?? "" });
      setAiAbierto(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      toast.error(msg);
    } finally {
      setAiCargando(false);
    }
  }

  function aceptarIA() {
    if (!compose || !aiSugerencia) return;
    setCompose({
      ...compose,
      subject: aiSugerencia.asunto || compose.subject,
      body: aiSugerencia.cuerpo,
    });
    setAiSugerencia(null);
    setAiInstruccion("");
    setAiAbierto(false);
    toast.success("Texto sustituido por la versión de la IA");
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
      body: JSON.stringify({ ...compose, sinFirma: !incluirFirma }),
    });
    setEnviando(false);
    if (res.ok) {
      toast.success("Email enviado");
      cerrarCompose();
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

  const tituloFiltro =
    filtro.tipo === "sistema"
      ? CARPETAS.find((c) => c.id === filtro.id)?.label ?? "Recibidos"
      : filtro.nombre;

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 bg-[#f6f8fc] [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Email · Google Workspace</SheetTitle>

        {/* Header estilo Gmail */}
        <SheetHeader className="bg-[#f6f8fc] px-2 py-2 border-b border-transparent">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarAbierto((v) => !v)}
              className="rounded-full p-3 hover:bg-black/5 transition-colors"
              title="Menú principal"
            >
              <MenuIcon className="h-5 w-5 text-[#5f6368]" />
            </button>
            <div className="flex items-center gap-1 pl-1 pr-3">
              <GmailLogo className="h-9 w-auto" />
            </div>

            {/* Search bar tipo Gmail */}
            <div className="flex-1 max-w-[720px] mx-auto">
              <div className="group flex items-center gap-2 rounded-full bg-[#eaf1fb] px-4 py-2 focus-within:bg-white focus-within:shadow-md transition-all">
                <Search className="h-5 w-5 text-[#5f6368]" />
                <input
                  type="text"
                  placeholder="Buscar correo"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="flex-1 bg-transparent text-[15px] text-[#202124] outline-none placeholder:text-[#5f6368]"
                />
                <button
                  type="button"
                  className="rounded-full p-1 text-[#5f6368] hover:bg-black/5"
                  title="Mostrar opciones de búsqueda"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="pl-1">
              <GoogleAccountButton />
            </div>
            <SheetClose asChild>
              <button
                type="button"
                className="ml-1 rounded-full p-3 hover:bg-black/5 transition-colors"
                title="Cerrar"
              >
                <X className="h-5 w-5 text-[#5f6368]" />
              </button>
            </SheetClose>
          </div>
        </SheetHeader>

        {!connected && (
          <div className="border-b bg-white px-5 py-3">
            <GoogleConnectBanner servicio="Gmail" />
          </div>
        )}

        {connected && needsReauth && (
          <GoogleReauthBanner servicio="el correo" />
        )}

        <div className="flex flex-1 min-h-0 bg-[#f6f8fc]">
          {/* Sidebar Gmail */}
          {sidebarAbierto && (
            <aside className="w-64 shrink-0 px-2 py-2 overflow-y-auto">
              <Button
                onClick={abrirRedactar}
                className="mb-4 h-14 rounded-2xl bg-[#c2e7ff] px-6 text-[#001d35] hover:bg-[#b5dfff] hover:shadow-md font-medium text-sm shadow-sm"
              >
                <Pencil className="mr-3 h-5 w-5" />
                Redactar
              </Button>

              <ul className="space-y-0.5">
                {CARPETAS.map(({ id, label, icon: Icon }) => {
                  const activo = filtro.tipo === "sistema" && filtro.id === id;
                  return (
                    <li key={id}>
                      <button
                        onClick={() => {
                          setFiltro({ tipo: "sistema", id });
                          setSeleccionado(null);
                        }}
                        className={cn(
                          "flex w-full items-center gap-4 rounded-r-full pl-6 pr-4 py-1 text-left text-sm transition-colors",
                          activo
                            ? "bg-[#fce8e6] font-bold text-[#202124]"
                            : "text-[#202124] hover:bg-black/5",
                        )}
                        style={{ height: 32 }}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1 truncate">{label}</span>
                        {id === "inbox" && noLeidos > 0 && (
                          <span className={cn("text-xs", activo ? "font-bold" : "font-medium")}>
                            {noLeidos}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {arbolCarpetas.length > 0 && (
                <>
                  <div className="mt-3 mb-1 flex items-center justify-between pl-6 pr-2">
                    <p className="text-sm font-medium text-[#202124]">Etiquetas</p>
                    <button
                      type="button"
                      className="rounded-full p-1.5 text-[#5f6368] hover:bg-black/5"
                      title="Crear etiqueta"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="space-y-0.5">
                    {arbolCarpetas.map((nodo) => (
                      <CarpetaArbolItem
                        key={nodo.ruta}
                        nodo={nodo}
                        nivel={0}
                        filtro={filtro}
                        gruposAbiertos={gruposAbiertos}
                        onAlternarGrupo={alternarGrupo}
                        onSeleccionar={(c) => {
                          setFiltro({ tipo: "label", id: c.id, nombre: c.nombre });
                          setSeleccionado(null);
                        }}
                      />
                    ))}
                  </ul>
                </>
              )}
            </aside>
          )}

          {/* Panel principal Gmail */}
          <div className="flex flex-1 flex-col rounded-tl-2xl bg-white overflow-hidden border-t border-l border-[#e8eaed]">
            {seleccionado ? (
              <VistaMensaje
                mensaje={seleccionado}
                onVolver={() => setSeleccionado(null)}
                onResponder={abrirResponder}
                onReenviar={abrirReenviar}
                onEstrella={() =>
                  actuar(seleccionado.estrella ? "unstar" : "star", seleccionado.id)
                }
                onArchivar={() => actuar("archive", seleccionado.id)}
                onPapelera={() => actuar("trash", seleccionado.id)}
                onMover={(labelId) =>
                  actuar("moveToLabel", seleccionado.id, labelId)
                }
                carpetasUsuario={carpetasUsuario}
                fotoRemitente={
                  userEmail &&
                  seleccionado.email &&
                  seleccionado.email.toLowerCase() === userEmail.toLowerCase()
                    ? userPicture ?? null
                    : fotosContactos[seleccionado.email?.toLowerCase() ?? ""] ?? null
                }
              />
            ) : (
              <ListaMensajes
                titulo={tituloFiltro}
                mensajes={mensajes}
                cargando={cargando}
                labelIdToNombre={labelIdToNombre}
                filtroActivoId={filtro.tipo === "label" ? filtro.id : null}
                onSeleccionar={setSeleccionado}
                onRefrescar={recargar}
                onArchivar={(id) => actuar("archive", id)}
                onPapelera={(id) => actuar("trash", id)}
                onEstrella={(m) =>
                  actuar(m.estrella ? "unstar" : "star", m.id)
                }
              />
            )}
          </div>
        </div>

        {compose && (
          <div className="absolute inset-0 z-50 flex items-end justify-end bg-black/30 p-4">
            <div className="flex h-[80%] w-full max-w-lg flex-col rounded-t-lg border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b bg-[#404040] px-4 py-2 text-white rounded-t-lg">
                <p className="text-sm font-semibold">
                  {compose.inReplyTo
                    ? "Responder"
                    : compose.subject?.startsWith("Fwd:")
                      ? "Reenviar"
                      : "Mensaje nuevo"}
                </p>
                <button
                  type="button"
                  onClick={cerrarCompose}
                  className="rounded p-1 hover:bg-white/20"
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

                {aiSugerencia && aiAbierto && (
                  <div className="rounded-lg border border-violet-300 bg-gradient-to-br from-violet-50 to-blue-50 p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-[12px] font-semibold text-violet-800">
                        <Sparkles className="h-3.5 w-3.5" />
                        Sugerencia de la IA
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiSugerencia(null)}
                        className="rounded p-1 text-violet-700 hover:bg-violet-100"
                        title="Descartar sugerencia"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {aiSugerencia.asunto &&
                      aiSugerencia.asunto !== compose.subject && (
                        <p className="text-[11px] text-violet-900 mb-2">
                          <span className="font-semibold">Nuevo asunto:</span>{" "}
                          {aiSugerencia.asunto}
                        </p>
                      )}

                    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-violet-200 bg-white p-2 text-[12px] leading-snug text-[#202124] font-sans">
                      {aiSugerencia.cuerpo}
                    </pre>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={aceptarIA}
                        className="inline-flex items-center gap-1.5 rounded-full bg-violet-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-800"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Usar este texto
                      </button>
                      <button
                        type="button"
                        onClick={pedirIA}
                        disabled={aiCargando}
                        className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-white px-4 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50"
                      >
                        {aiCargando ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Otra versión
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiSugerencia(null)}
                        className="text-xs text-violet-700 hover:underline"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                )}

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

                <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-800">
                      <Sparkles className="h-3.5 w-3.5" />
                      Asistente IA
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiAbierto((v) => !v)}
                      className="text-[11px] text-violet-700 hover:underline"
                    >
                      {aiAbierto ? "Ocultar opciones" : "Mostrar opciones"}
                    </button>
                  </div>

                  {aiAbierto && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-medium text-violet-900">
                        Tono
                        <select
                          value={aiTono}
                          onChange={(e) => setAiTono(e.target.value as AITono)}
                          className="mt-0.5 w-full rounded border border-violet-200 bg-white px-2 py-1 text-[12px]"
                        >
                          <option value="profesional">Profesional</option>
                          <option value="cercano">Cercano</option>
                          <option value="directo">Directo</option>
                          <option value="formal">Formal</option>
                          <option value="amistoso">Amistoso</option>
                        </select>
                      </label>
                      <label className="text-[10px] font-medium text-violet-900">
                        Longitud
                        <select
                          value={aiLongitud}
                          onChange={(e) =>
                            setAiLongitud(e.target.value as AILongitud)
                          }
                          className="mt-0.5 w-full rounded border border-violet-200 bg-white px-2 py-1 text-[12px]"
                        >
                          <option value="corto">Corto</option>
                          <option value="medio">Medio</option>
                          <option value="largo">Largo</option>
                        </select>
                      </label>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={aiInstruccion}
                      onChange={(e) => setAiInstruccion(e.target.value)}
                      placeholder="Indícale qué cambiar (opcional): 'más corto', 'más formal'..."
                      className="flex-1 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[12px] outline-none focus:border-violet-400"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !aiCargando) {
                          e.preventDefault();
                          pedirIA();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={pedirIA}
                      disabled={aiCargando}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:from-violet-700 hover:to-blue-700 disabled:opacity-60"
                      title="Mejorar con IA"
                    >
                      {aiCargando ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                      {compose.body.trim() ? "Mejorar con IA" : "Redactar con IA"}
                    </button>
                  </div>
                </div>

                {firmaHtml ? (
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium">
                      <input
                        type="checkbox"
                        checked={incluirFirma}
                        onChange={(e) => setIncluirFirma(e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer"
                      />
                      Incluir firma corporativa de Gmail
                    </label>
                    {incluirFirma && (
                      <div
                        className="mt-2 max-h-32 overflow-y-auto border-t pt-2 text-xs text-muted-foreground [&_a]:text-blue-600 [&_a]:underline [&_img]:inline [&_img]:max-h-16"
                        dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(firmaHtml) }}
                      />
                    )}
                  </div>
                ) : connected ? (
                  <p className="text-[11px] text-muted-foreground italic">
                    No tienes firma configurada en Gmail. Para añadirla:
                    Gmail → Configuración → Firma.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2">
                <Button
                  size="sm"
                  className="bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-full px-6"
                  onClick={enviarEmail}
                  disabled={enviando}
                >
                  {enviando ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Enviar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cerrarCompose}
                >
                  Descartar
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface ListaMensajesProps {
  titulo: string;
  mensajes: Mensaje[];
  cargando: boolean;
  labelIdToNombre: Map<string, string>;
  filtroActivoId: string | null;
  onSeleccionar: (m: Mensaje) => void;
  onRefrescar: () => void;
  onArchivar: (id: string) => void;
  onPapelera: (id: string) => void;
  onEstrella: (m: Mensaje) => void;
}

function ListaMensajes({
  mensajes,
  cargando,
  labelIdToNombre,
  filtroActivoId,
  onSeleccionar,
  onRefrescar,
  onArchivar,
  onPapelera,
  onEstrella,
}: ListaMensajesProps) {
  return (
    <>
      {/* Toolbar superior estilo Gmail */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#e8eaed]">
        <button
          type="button"
          className="rounded-full p-2 hover:bg-black/5"
          title="Seleccionar"
        >
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-[#5f6368]"
          />
        </button>
        <button
          type="button"
          className="rounded-full p-2 hover:bg-black/5 text-[#5f6368]"
          title="Más opciones de selección"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRefrescar}
          className="rounded-full p-2 hover:bg-black/5 text-[#5f6368]"
          title="Recibir correo nuevo"
        >
          <RefreshCw className={cn("h-4 w-4", cargando && "animate-spin")} />
        </button>
        <button
          type="button"
          className="rounded-full p-2 hover:bg-black/5 text-[#5f6368]"
          title="Más"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        <div className="ml-auto flex items-center gap-1 text-xs text-[#5f6368]">
          <span>
            {mensajes.length === 0 ? "0" : `1–${mensajes.length}`} de {mensajes.length}
          </span>
          <button
            type="button"
            className="rounded-full p-2 hover:bg-black/5 disabled:opacity-30"
            title="Anterior"
            disabled
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-full p-2 hover:bg-black/5 disabled:opacity-30"
            title="Siguiente"
            disabled
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Lista compacta */}
      <ul className="flex-1 overflow-y-auto">
        {cargando && mensajes.length === 0 ? (
          <li className="p-12 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#5f6368]" />
          </li>
        ) : mensajes.length === 0 ? (
          <li className="p-12 text-center text-sm text-[#5f6368]">
            No hay mensajes en esta carpeta.
          </li>
        ) : (
          mensajes.map((m) => {
            const labelsVisibles = (m.labelIds ?? [])
              .filter(
                (id) =>
                  labelIdToNombre.has(id) && id !== filtroActivoId,
              )
              .map((id) => ({ id, nombre: labelIdToNombre.get(id)! }));

            return (
              <li
                key={m.id}
                className={cn(
                  "group flex items-center gap-3 border-b border-[#f1f3f4] px-4 py-[6px] cursor-pointer transition-shadow hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_0_rgba(60,64,67,0.30),0_1px_3px_1px_rgba(60,64,67,0.15)] hover:z-10",
                  !m.leido ? "bg-white" : "bg-[#f2f6fc]",
                )}
                onClick={() => onSeleccionar(m)}
              >
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full p-1 hover:bg-black/5 shrink-0"
                  title="Seleccionar"
                >
                  <input
                    type="checkbox"
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 cursor-pointer accent-[#5f6368]"
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEstrella(m);
                  }}
                  className="rounded-full p-1 hover:bg-black/5 shrink-0"
                  title={m.estrella ? "Quitar estrella" : "Destacar"}
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      m.estrella
                        ? "fill-[#f9ab00] text-[#f9ab00]"
                        : "text-[#5f6368]",
                    )}
                  />
                </button>

                <span
                  className={cn(
                    "w-44 shrink-0 truncate text-sm",
                    !m.leido
                      ? "font-bold text-[#202124]"
                      : "text-[#5f6368]",
                  )}
                >
                  {m.remitente}
                </span>

                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {labelsVisibles.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      {labelsVisibles.slice(0, 3).map((l) => (
                        <span
                          key={l.id}
                          className="inline-flex items-center rounded border border-[#dadce0] bg-white px-1.5 py-px text-[11px] uppercase tracking-wide text-[#5f6368] max-w-[180px] truncate"
                          title={l.nombre}
                        >
                          {acortarLabel(l.nombre)}
                        </span>
                      ))}
                    </div>
                  )}
                  <p
                    className={cn(
                      "truncate text-sm",
                      !m.leido
                        ? "font-bold text-[#202124]"
                        : "text-[#5f6368]",
                    )}
                  >
                    <span>{m.asunto}</span>
                    <span className="text-[#5f6368] font-normal">
                      {" "}
                      - {m.preview}
                    </span>
                  </p>
                </div>

                {/* Acciones hover (a la derecha, sustituyen a la fecha) */}
                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchivar(m.id);
                    }}
                    className="rounded-full p-1.5 hover:bg-black/10 text-[#5f6368]"
                    title="Archivar"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPapelera(m.id);
                    }}
                    className="rounded-full p-1.5 hover:bg-black/10 text-[#5f6368]"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <span
                  className={cn(
                    "group-hover:hidden shrink-0 text-xs w-16 text-right",
                    !m.leido
                      ? "font-bold text-[#202124]"
                      : "text-[#5f6368]",
                  )}
                >
                  {m.fecha}
                </span>
              </li>
            );
          })
        )}
      </ul>

      {/* Footer info */}
      <div className="border-t border-[#e8eaed] px-6 py-2 text-xs text-[#5f6368] flex items-center justify-between">
        <div className="flex gap-4">
          <span>Términos</span>
          <span>·</span>
          <span>Privacidad</span>
          <span>·</span>
          <span>Política del programa</span>
        </div>
      </div>
    </>
  );
}

interface VistaMensajeProps {
  mensaje: Mensaje;
  onVolver: () => void;
  onResponder: () => void;
  onReenviar: () => void;
  onEstrella: () => void;
  onArchivar: () => void;
  onPapelera: () => void;
  onMover: (labelId: string) => void;
  carpetasUsuario: CarpetaUsuario[];
  fotoRemitente: string | null;
}

function VistaMensaje({
  mensaje,
  onVolver,
  onResponder,
  onReenviar,
  onEstrella,
  onArchivar,
  onPapelera,
  onMover,
  carpetasUsuario,
  fotoRemitente,
}: VistaMensajeProps) {
  return (
    <>
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#e8eaed]">
        <button
          type="button"
          onClick={onVolver}
          className="rounded-full p-2 hover:bg-black/5 text-[#5f6368]"
          title="Volver a Recibidos"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="w-px h-6 bg-[#e8eaed] mx-1" />
        <button
          type="button"
          onClick={onArchivar}
          className="rounded-full p-2 hover:bg-black/5 text-[#5f6368]"
          title="Archivar"
        >
          <Archive className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onPapelera}
          className="rounded-full p-2 hover:bg-black/5 text-[#5f6368]"
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {carpetasUsuario.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-black/5 text-[#5f6368]"
                title="Mover a"
              >
                <FolderInput className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-72 w-56 overflow-y-auto"
            >
              <DropdownMenuLabel>Mover a</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {carpetasUsuario.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => onMover(c.id)}
                >
                  <Folder className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{c.nombre}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-16 py-6">
        <h1 className="text-[22px] font-normal text-[#202124] mb-4">
          {mensaje.asunto}
          {mensaje.mensajesHilo && mensaje.mensajesHilo.length > 1 && (
            <span className="ml-2 text-[#5f6368] font-normal">
              ({mensaje.mensajesHilo.length})
            </span>
          )}
        </h1>

        {mensaje.mensajesHilo && mensaje.mensajesHilo.length > 0 ? (
          <ListaHilo
            mensajes={mensaje.mensajesHilo}
            estrella={mensaje.estrella}
            onEstrella={onEstrella}
            fotoRemitentePrincipal={fotoRemitente}
          />
        ) : (
          <BloqueMensajeUnico
            mensaje={mensaje}
            estrella={mensaje.estrella}
            onEstrella={onEstrella}
            fotoRemitente={fotoRemitente}
          />
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onResponder}
            className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-6 py-2 text-sm font-medium text-[#202124] hover:bg-[#f8f9fa] hover:shadow-sm transition-all"
          >
            <Reply className="h-4 w-4" />
            Responder
          </button>
          <button
            type="button"
            onClick={onReenviar}
            className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-6 py-2 text-sm font-medium text-[#202124] hover:bg-[#f8f9fa] hover:shadow-sm transition-all"
          >
            <Forward className="h-4 w-4" />
            Reenviar
          </button>
        </div>
      </div>
    </>
  );
}

interface ListaHiloProps {
  mensajes: MensajeHilo[];
  estrella: boolean;
  onEstrella: () => void;
  fotoRemitentePrincipal: string | null;
}

function ListaHilo({
  mensajes,
  estrella,
  onEstrella,
  fotoRemitentePrincipal,
}: ListaHiloProps) {
  // Gmail: el último expandido, los anteriores colapsados
  const ultimoIdx = mensajes.length - 1;

  return (
    <div className="space-y-3">
      {mensajes.map((m, idx) => (
        <MensajeHiloItem
          key={m.id}
          mensaje={m}
          expandidoInicial={idx === ultimoIdx}
          mostrarEstrella={idx === ultimoIdx}
          estrellaActiva={estrella}
          onEstrella={onEstrella}
          fotoRemitente={idx === ultimoIdx ? fotoRemitentePrincipal : null}
        />
      ))}
    </div>
  );
}

interface MensajeHiloItemProps {
  mensaje: MensajeHilo;
  expandidoInicial: boolean;
  mostrarEstrella: boolean;
  estrellaActiva: boolean;
  onEstrella: () => void;
  fotoRemitente: string | null;
}

function MensajeHiloItem({
  mensaje,
  expandidoInicial,
  mostrarEstrella,
  estrellaActiva,
  onEstrella,
  fotoRemitente,
}: MensajeHiloItemProps) {
  const [expandido, setExpandido] = useState(expandidoInicial);

  if (!expandido) {
    return (
      <button
        type="button"
        onClick={() => setExpandido(true)}
        className="w-full flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-[#f8f9fa] text-left transition-colors"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-xs font-medium text-white">
          {mensaje.remitente.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-[#202124] truncate">
              {mensaje.remitente}
            </span>
            <span className="text-xs text-[#5f6368] truncate flex-1">
              {mensaje.cuerpo
                ? mensaje.cuerpo.replace(/\s+/g, " ").slice(0, 120)
                : ""}
            </span>
          </div>
        </div>
        <span className="text-xs text-[#5f6368] shrink-0 whitespace-nowrap">
          {mensaje.fecha}
        </span>
      </button>
    );
  }

  return (
    <div className="border-b border-[#e8eaed] pb-4 last:border-b-0">
      <div className="flex items-start gap-3 mb-3">
        {fotoRemitente ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoRemitente}
            alt={mensaje.remitente}
            referrerPolicy="no-referrer"
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-sm font-medium text-white">
            {mensaje.remitente.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#202124]">
              {mensaje.remitente}
            </span>
            <span className="text-xs text-[#5f6368]">
              &lt;{mensaje.email}&gt;
            </span>
            {mostrarEstrella && (
              <button
                type="button"
                onClick={onEstrella}
                className="ml-auto rounded-full p-1 hover:bg-black/5"
                title={estrellaActiva ? "Quitar estrella" : "Destacar"}
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    estrellaActiva
                      ? "fill-[#f9ab00] text-[#f9ab00]"
                      : "text-[#5f6368]",
                  )}
                />
              </button>
            )}
          </div>
          <p className="text-xs text-[#5f6368] mt-0.5">
            para mí · {mensaje.fecha}
          </p>
        </div>
      </div>

      {mensaje.cuerpoHtml ? (
        <div
          className={cn(
            "text-sm leading-relaxed text-[#202124]",
            "[&_a]:text-[#1a73e8] [&_a]:underline",
            "[&_img]:inline-block [&_img]:max-w-full [&_img]:h-auto",
            "[&_blockquote]:border-l-2 [&_blockquote]:border-[#dadce0] [&_blockquote]:pl-3 [&_blockquote]:text-[#5f6368]",
            "[&_table]:border-collapse [&_td]:align-top",
            "[&_p]:my-2 [&_br]:my-0",
          )}
          dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(mensaje.cuerpoHtml) }}
        />
      ) : mensaje.cuerpo ? (
        <div className="text-sm leading-relaxed text-[#202124] whitespace-pre-wrap">
          {mensaje.cuerpo}
        </div>
      ) : (
        <span className="text-sm text-[#5f6368] italic">
          (sin contenido)
        </span>
      )}
    </div>
  );
}

interface BloqueMensajeUnicoProps {
  mensaje: Mensaje;
  estrella: boolean;
  onEstrella: () => void;
  fotoRemitente: string | null;
}

function BloqueMensajeUnico({
  mensaje,
  estrella,
  onEstrella,
  fotoRemitente,
}: BloqueMensajeUnicoProps) {
  return (
    <>
      <div className="flex items-start gap-3 mb-4">
        {fotoRemitente ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoRemitente}
            alt={mensaje.remitente}
            referrerPolicy="no-referrer"
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-sm font-medium text-white">
            {mensaje.remitente.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#202124]">
              {mensaje.remitente}
            </span>
            <span className="text-xs text-[#5f6368]">
              &lt;{mensaje.email}&gt;
            </span>
            <button
              type="button"
              onClick={onEstrella}
              className="ml-auto rounded-full p-1 hover:bg-black/5"
              title={estrella ? "Quitar estrella" : "Destacar"}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  estrella
                    ? "fill-[#f9ab00] text-[#f9ab00]"
                    : "text-[#5f6368]",
                )}
              />
            </button>
          </div>
          <p className="text-xs text-[#5f6368] mt-0.5">
            para mí · {mensaje.fecha}
          </p>
        </div>
      </div>

      {mensaje.cuerpoHtml ? (
        <div
          className={cn(
            "text-sm leading-relaxed text-[#202124]",
            "[&_a]:text-[#1a73e8] [&_a]:underline",
            "[&_img]:inline-block [&_img]:max-w-full [&_img]:h-auto",
            "[&_blockquote]:border-l-2 [&_blockquote]:border-[#dadce0] [&_blockquote]:pl-3 [&_blockquote]:text-[#5f6368]",
            "[&_table]:border-collapse [&_td]:align-top",
            "[&_p]:my-2 [&_br]:my-0",
          )}
          dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(mensaje.cuerpoHtml) }}
        />
      ) : mensaje.cuerpo ? (
        <div className="text-sm leading-relaxed text-[#202124] whitespace-pre-wrap">
          {mensaje.cuerpo}
        </div>
      ) : (
        <Loader2 className="h-4 w-4 animate-spin text-[#5f6368]" />
      )}
    </>
  );
}

function acortarLabel(nombre: string): string {
  if (nombre.length <= 22) return nombre;
  // Caso DEPARTAMENTOS/MARKETING -> DEPARTAMEN.../MARKETING
  const ultimaBarra = nombre.lastIndexOf("/");
  if (ultimaBarra > 0) {
    const cola = nombre.slice(ultimaBarra);
    const cabeza = nombre.slice(0, ultimaBarra);
    if (cabeza.length > 11) {
      return cabeza.slice(0, 9) + "..." + cola;
    }
  }
  return nombre.slice(0, 19) + "...";
}

function GmailLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="52 42 230 66" className={className} aria-hidden="true">
      <path
        fill="#4285f4"
        d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"
      />
      <path
        fill="#34a853"
        d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"
      />
      <path
        fill="#fbbc04"
        d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"
      />
      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
      <path
        fill="#c5221f"
        d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"
      />
      <text
        x="150"
        y="93"
        fontFamily="'Product Sans', 'Google Sans', Arial, sans-serif"
        fontSize="40"
        fill="#5f6368"
      >
        Gmail
      </text>
    </svg>
  );
}

interface CarpetaArbolItemProps {
  nodo: CarpetaNodo;
  nivel: number;
  filtro: Filtro;
  gruposAbiertos: Record<string, boolean>;
  onAlternarGrupo: (ruta: string) => void;
  onSeleccionar: (c: { id: string; nombre: string }) => void;
}

function CarpetaArbolItem({
  nodo,
  nivel,
  filtro,
  gruposAbiertos,
  onAlternarGrupo,
  onSeleccionar,
}: CarpetaArbolItemProps) {
  const tieneHijos = nodo.hijos.length > 0;
  const abierto = gruposAbiertos[nodo.ruta] ?? false;
  const seleccionado =
    filtro.tipo === "label" && nodo.id !== null && filtro.id === nodo.id;

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-r-full transition-colors",
          seleccionado
            ? "bg-[#fce8e6] text-[#202124] font-bold"
            : "text-[#202124] hover:bg-black/5",
        )}
        style={{ paddingLeft: `${12 + nivel * 12}px`, height: 32 }}
      >
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => onAlternarGrupo(nodo.ruta)}
            className="flex h-7 w-5 shrink-0 items-center justify-center rounded hover:bg-black/10"
            aria-label={abierto ? "Cerrar grupo" : "Abrir grupo"}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                abierto && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => {
            if (nodo.id) {
              onSeleccionar({ id: nodo.id, nombre: nodo.ruta });
            } else if (tieneHijos) {
              onAlternarGrupo(nodo.ruta);
            }
          }}
          className={cn(
            "flex flex-1 items-center gap-3 py-1 pr-3 text-left text-sm",
            !nodo.id && "italic",
          )}
        >
          {tieneHijos && abierto ? (
            <FolderOpen className="h-[18px] w-[18px] shrink-0" />
          ) : (
            <Folder className="h-[18px] w-[18px] shrink-0" />
          )}
          <span className="truncate" title={nodo.ruta}>
            {nodo.label}
          </span>
        </button>
      </div>
      {tieneHijos && abierto && (
        <ul className="space-y-0.5">
          {nodo.hijos.map((hijo) => (
            <CarpetaArbolItem
              key={hijo.ruta}
              nodo={hijo}
              nivel={nivel + 1}
              filtro={filtro}
              gruposAbiertos={gruposAbiertos}
              onAlternarGrupo={onAlternarGrupo}
              onSeleccionar={onSeleccionar}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
