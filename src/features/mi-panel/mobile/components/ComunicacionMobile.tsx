"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle, Search, Plus, Send, Mic, Paperclip, X, ChevronLeft, ChevronDown,
  Building2, Briefcase, Loader2, Lock, FileText, Download, Check, Users, Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  listCanales, listMensajes, sendMensaje, createCanal,
  sendMensajeAdjunto, getAdjuntoSignedUrl, listEmpleadosEmpresa,
  type EmpleadoCanal,
} from "@/features/comunicacion/actions/comunicacion-actions";

type Canal = {
  id: string;
  nombre: string;
  tipo: "departamento" | "asunto" | "grupo" | "directo";
  departamentos: string[];
  miembrosUserIds: string[];
};

type Mensaje = {
  id: string;
  canalId: string;
  autor: string;
  avatar: string;
  texto: string;
  hora: string;
  propio: boolean;
  adjuntoPath?: string | null;
  adjuntoTipo?: "imagen" | "audio" | "archivo" | null;
  adjuntoNombre?: string | null;
  adjuntoTamano?: number | null;
};

function mapCanal(r: Record<string, unknown>): Canal {
  const tipoRaw = (r.tipo as string) ?? "asunto";
  const tipo: Canal["tipo"] =
    tipoRaw === "departamento" || tipoRaw === "asunto" || tipoRaw === "directo"
      ? (tipoRaw as Canal["tipo"]) : "asunto";
  return {
    id: r.id as string,
    nombre: (r.nombre as string) ?? "",
    tipo,
    departamentos: Array.isArray(r.departamentos) ? (r.departamentos as string[]) : [],
    miembrosUserIds: Array.isArray(r.miembros_user_ids) ? (r.miembros_user_ids as string[]) : [],
  };
}

function mapMensaje(r: Record<string, unknown>, miUserId: string | null): Mensaje {
  const createdAt = r.created_at ? new Date(r.created_at as string) : new Date();
  const nombre = ((r.autor_nombre as string) ?? "").trim() || "Anónimo";
  const iniciales = nombre.split(" ").map((w) => w[0]).filter(Boolean).join("").toUpperCase().slice(0, 2) || "?";
  return {
    id: r.id as string,
    canalId: (r.canal_id as string) ?? "",
    autor: nombre,
    avatar: iniciales,
    texto: (r.texto as string) ?? "",
    hora: createdAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    propio: !!miUserId && r.autor_id === miUserId,
    adjuntoPath: (r.adjunto_url as string) ?? null,
    adjuntoTipo: (r.adjunto_tipo as Mensaje["adjuntoTipo"]) ?? null,
    adjuntoNombre: (r.adjunto_nombre as string) ?? null,
    adjuntoTamano: (r.adjunto_tamano as number) ?? null,
  };
}

// Elige un formato de grabación soportado. mp4 primero (iOS y reproducible en
// todos lados); si no, webm (Chrome/Firefox/Android).
function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "";
}
function audioExt(type: string): string {
  if (type.includes("mp4") || type.includes("aac") || type.includes("mpeg")) return "m4a";
  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  return "dat";
}

export function ComunicacionMobile() {
  const { empresaActual, getIsotipoUrl } = useEmpresa();
  const logoUrl = getIsotipoUrl(empresaActual.id);
  const [miUserId, setMiUserId] = useState<string | null>(null);

  const [canales, setCanales] = useState<Canal[]>([]);
  const [canalActivo, setCanalActivo] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cargandoMsgs, setCargandoMsgs] = useState(false);

  const [openDeptos, setOpenDeptos] = useState(true);
  const [openAsuntos, setOpenAsuntos] = useState(true);
  const [verInfo, setVerInfo] = useState(false);

  const [dlgNuevo, setDlgNuevo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [deptosNuevo, setDeptosNuevo] = useState<Set<string>>(new Set());
  const [miembrosNuevo, setMiembrosNuevo] = useState<Set<string>>(new Set());
  const [empleados, setEmpleados] = useState<EmpleadoCanal[]>([]);
  const [buscaEmp, setBuscaEmp] = useState("");

  const [subiendo, setSubiendo] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [grabSeg, setGrabSeg] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const grabTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canal = canales.find((c) => c.id === canalActivo) ?? null;
  const msgDelCanal = useMemo(
    () => (canalActivo ? mensajes.filter((m) => m.canalId === canalActivo) : []),
    [mensajes, canalActivo],
  );

  const canalesFiltrados = busqueda.trim()
    ? canales.filter((c) => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : canales;
  const deptos = canalesFiltrados.filter((c) => c.tipo === "departamento");
  const asuntos = canalesFiltrados.filter((c) => c.tipo !== "departamento");
  const departamentosDisponibles = useMemo(
    () => Array.from(new Set(canales.filter((c) => c.tipo === "departamento").map((c) => c.nombre)))
      .sort((a, b) => a.localeCompare(b)),
    [canales],
  );

  const empleadosFiltrados = useMemo(() => {
    const q = buscaEmp.trim().toLowerCase();
    if (!q) return empleados;
    return empleados.filter((e) => {
      const full = `${e.nombre} ${e.apellidos}`.toLowerCase();
      return full.includes(q) || (e.rolLabel ?? "").toLowerCase().includes(q) || (e.departamento ?? "").toLowerCase().includes(q);
    });
  }, [empleados, buscaEmp]);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => setMiUserId(data.user?.id ?? null));
    listEmpleadosEmpresa().then((res) => { if (res.ok) setEmpleados(res.data); });
  }, []);

  const cargarCanales = useCallback(async () => {
    setCargando(true);
    const res = await listCanales(empresaActual.id);
    if (res.ok) setCanales((res.data as Record<string, unknown>[]).map(mapCanal));
    setCargando(false);
  }, [empresaActual.id]);

  useEffect(() => { cargarCanales(); }, [cargarCanales]);

  useEffect(() => {
    if (!canalActivo) return;
    setCargandoMsgs(true);
    listMensajes(canalActivo).then((res) => {
      if (res.ok) {
        setMensajes((prev) => [
          ...prev.filter((m) => m.canalId !== canalActivo),
          ...(res.data as Record<string, unknown>[]).map((r) => mapMensaje(r, miUserId)),
        ]);
      } else {
        toast.error("No tienes acceso a este canal");
        setCanalActivo(null);
      }
      setCargandoMsgs(false);
    });
  }, [canalActivo, miUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgDelCanal.length]);

  async function enviar() {
    if (!input.trim() || !canalActivo) return;
    const texto = input.trim();
    setInput("");
    const res = await sendMensaje(canalActivo, texto);
    if (!res.ok) { toast.error(res.error ?? "No se pudo enviar"); return; }
    if (res.data) setMensajes((prev) => [...prev, mapMensaje(res.data as Record<string, unknown>, miUserId)]);
  }

  async function subirYEnviar(file: File, tipo: "imagen" | "audio" | "archivo") {
    if (!canalActivo) return;
    try {
      setSubiendo(true);
      const supabase = createBrowserClient();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${empresaActual.id}/${canalActivo}/${Date.now()}_${safeName}`;
      const up = await supabase.storage.from("chat-archivos").upload(path, file, {
        upsert: false, contentType: file.type || undefined,
      });
      if (up.error) throw up.error;
      const res = await sendMensajeAdjunto({
        canalId: canalActivo, texto: null, adjuntoUrl: up.data.path, adjuntoTipo: tipo,
        adjuntoNombre: file.name, adjuntoMime: file.type || "application/octet-stream", adjuntoTamano: file.size,
      });
      if (!res.ok) { toast.error(res.error ?? "No se pudo enviar el adjunto"); return; }
      if (res.data) setMensajes((prev) => [...prev, mapMensaje(res.data as Record<string, unknown>, miUserId)]);
    } catch {
      toast.error("No se pudo subir el archivo");
    } finally {
      setSubiendo(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const tipo = f.type.startsWith("image/") ? "imagen" : f.type.startsWith("audio/") ? "audio" : "archivo";
    subirYEnviar(f, tipo);
    e.target.value = "";
  }

  async function iniciarGrabacion() {
    if (!canalActivo) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Grabamos en el formato que el propio dispositivo soporta: iOS/Safari usa
      // mp4 (reproducible en todas partes), Chrome/Firefox usan webm. Etiquetar
      // mal el archivo (p. ej. webm en iOS) hace que el reproductor muestre "Error".
      const preferido = pickAudioMime();
      const mr = preferido ? new MediaRecorder(stream, { mimeType: preferido }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mr.mimeType || preferido || "audio/mp4";
        const ext = audioExt(type);
        const blob = new Blob(audioChunksRef.current, { type });
        await subirYEnviar(new File([blob], `audio_${Date.now()}.${ext}`, { type }), "audio");
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setGrabando(true);
      setGrabSeg(0);
      grabTimerRef.current = setInterval(() => setGrabSeg((t) => t + 1), 1000);
    } catch {
      toast.error("Sin acceso al micrófono");
    }
  }

  function detenerGrabacion(cancelar = false) {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      if (cancelar) { mr.ondataavailable = null; mr.onstop = () => mr.stream.getTracks().forEach((t) => t.stop()); }
      mr.stop();
    }
    if (grabTimerRef.current) { clearInterval(grabTimerRef.current); grabTimerRef.current = null; }
    setGrabando(false);
    setGrabSeg(0);
  }

  async function crearAsunto() {
    const limpio = nombreNuevo.trim();
    if (!limpio || (deptosNuevo.size === 0 && miembrosNuevo.size === 0)) return;
    const res = await createCanal(
      limpio, "asunto", Array.from(miembrosNuevo), empresaActual.id, Array.from(deptosNuevo),
    );
    if (!res.ok) { toast.error(res.error ?? "No se pudo crear"); return; }
    const nuevo = mapCanal(res.data as Record<string, unknown>);
    setCanales((prev) => [...prev, nuevo]);
    setDlgNuevo(false);
    setNombreNuevo("");
    setDeptosNuevo(new Set());
    setMiembrosNuevo(new Set());
    setBuscaEmp("");
    setCanalActivo(nuevo.id);
    toast.success("Asunto creado");
  }

  // ───────── Vista lista ─────────
  return (
    <>
      <div className="px-4 pb-4">
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar grupo…"
            className="h-10 w-full rounded-full border-0 bg-muted/60 pl-9 pr-4 text-sm outline-none"
          />
        </div>

        {cargando ? (
          <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="mt-3 space-y-2">
            <Seccion
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Departamentos"
              count={deptos.length}
              open={openDeptos}
              onToggle={() => setOpenDeptos((v) => !v)}
            />
            {openDeptos && (
              <div className="space-y-2">
                {deptos.map((c) => (
                  <FilaCanal key={c.id} canal={c} color={empresaActual.color} logoUrl={logoUrl} onClick={() => setCanalActivo(c.id)} />
                ))}
                {deptos.length === 0 && <Vacio texto="Sin departamentos disponibles." />}
              </div>
            )}

            <Seccion
              icon={<Briefcase className="h-3.5 w-3.5" />}
              label="Asuntos"
              count={asuntos.length}
              open={openAsuntos}
              onToggle={() => setOpenAsuntos((v) => !v)}
            />
            {openAsuntos && (
              <div className="space-y-2">
                {asuntos.map((c) => (
                  <FilaCanal key={c.id} canal={c} color={empresaActual.color} logoUrl={logoUrl} onClick={() => setCanalActivo(c.id)} />
                ))}
                {asuntos.length === 0 && <Vacio texto="Sin asuntos. Crea uno con el botón +." />}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botón flotante crear asunto */}
      <button
        type="button"
        onClick={() => { setNombreNuevo(""); setDeptosNuevo(new Set()); setMiembrosNuevo(new Set()); setBuscaEmp(""); setDlgNuevo(true); }}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg active:scale-95"
        aria-label="Crear asunto"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Overlay conversación */}
      {canal && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#f0f2f5] dark:bg-background">
          <header className="flex items-center gap-2 border-b bg-background px-2 pt-[max(env(safe-area-inset-top),10px)] pb-2.5">
            <button onClick={() => setCanalActivo(null)} className="flex h-9 w-9 items-center justify-center rounded-full active:bg-muted" aria-label="Volver">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => setVerInfo(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <CanalAvatar logoUrl={logoUrl} iniciales={empresaActual.iniciales} color={empresaActual.color} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                  {canal.nombre}
                  {canal.tipo === "departamento" && <Lock className="h-3 w-3 text-muted-foreground" />}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {canal.tipo === "departamento" ? "Departamento · ver info" : "Asunto · ver info"}
                </p>
              </div>
            </button>
            <button onClick={() => setVerInfo(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground active:bg-muted" aria-label="Información del grupo">
              <Info className="h-5 w-5" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-4">
            {cargandoMsgs && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            {!cargandoMsgs && msgDelCanal.length === 0 && (
              <p className="py-10 text-center text-xs text-muted-foreground">No hay mensajes todavía. Sé el primero en escribir.</p>
            )}
            {msgDelCanal.map((m) => (
              <div key={m.id} className={cn("flex", m.propio ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                  m.propio ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-white text-foreground dark:bg-card",
                )}>
                  {!m.propio && <p className="mb-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400">{m.autor}</p>}
                  {m.adjuntoPath && m.adjuntoTipo && (
                    <MobileAdjunto path={m.adjuntoPath} tipo={m.adjuntoTipo} nombre={m.adjuntoNombre ?? "archivo"} propio={m.propio} />
                  )}
                  {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                  <p className={cn("mt-1 text-right text-[10px]", m.propio ? "text-blue-100" : "text-muted-foreground")}>{m.hora}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t bg-background px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
            <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFile} />
            {grabando ? (
              <div className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 dark:border-red-900 dark:bg-red-950/30">
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" /></span>
                <span className="flex-1 text-sm font-medium text-red-700 dark:text-red-300">Grabando… {Math.floor(grabSeg / 60)}:{(grabSeg % 60).toString().padStart(2, "0")}</span>
                <button onClick={() => detenerGrabacion(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-red-600 active:bg-red-100" aria-label="Cancelar"><X className="h-4 w-4" /></button>
                <button onClick={() => detenerGrabacion(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white active:bg-red-700" aria-label="Enviar"><Send className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={() => fileInputRef.current?.click()} disabled={subiendo} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted" aria-label="Adjuntar">
                  {subiendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && enviar()}
                  placeholder={`Mensaje a ${canal.nombre}…`}
                  className="h-11 flex-1 rounded-full border-0 bg-muted/60 px-4 text-sm outline-none"
                />
                {input.trim() ? (
                  <button onClick={enviar} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95" aria-label="Enviar"><Send className="h-4 w-4" /></button>
                ) : (
                  <button onClick={iniciarGrabacion} disabled={subiendo} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted" aria-label="Grabar audio"><Mic className="h-5 w-5" /></button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay info del grupo */}
      {verInfo && canal && (
        <div className="fixed inset-0 z-[65] flex flex-col justify-end bg-black/40" onClick={() => setVerInfo(false)}>
          <div className="max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(env(safe-area-inset-bottom),20px)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
            <div className="flex flex-col items-center gap-2">
              <CanalAvatar logoUrl={logoUrl} iniciales={empresaActual.iniciales} color={empresaActual.color} />
              <p className="flex items-center gap-1.5 text-base font-bold">
                {canal.nombre}
                {canal.tipo === "departamento" && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              </p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {canal.tipo === "departamento" ? "Departamento" : "Asunto"}
              </span>
            </div>

            {canal.tipo === "departamento" ? (
              <div className="mt-5 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                Pueden ver este grupo todos los empleados que tengan el departamento <strong className="text-foreground">{canal.nombre}</strong> activo en su rol.
              </div>
            ) : (
              <>
                <p className="mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> Departamentos con acceso
                </p>
                {canal.departamentos.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">Ninguno.</p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {canal.departamentos.map((d) => (
                      <span key={d} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{d}</span>
                    ))}
                  </div>
                )}

                <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Empleados en el grupo
                </p>
                {(() => {
                  const dentro = empleados.filter((e) => canal.miembrosUserIds.includes(e.userId));
                  if (canal.miembrosUserIds.length === 0) {
                    return <p className="mt-1 text-xs text-muted-foreground">Solo por departamento (sin usuarios sueltos añadidos).</p>;
                  }
                  if (dentro.length === 0) {
                    return <p className="mt-1 text-xs text-muted-foreground">{canal.miembrosUserIds.length} usuario(s) añadidos.</p>;
                  }
                  return (
                    <div className="mt-1.5 space-y-1.5">
                      {dentro.map((e) => {
                        const ini = `${e.nombre[0] ?? ""}${e.apellidos[0] ?? ""}`.toUpperCase();
                        return (
                          <div key={e.userId} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{ini || "—"}</div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{e.nombre} {e.apellidos}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{[e.rolLabel, e.departamento].filter(Boolean).join(" · ") || "Sin rol"}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}

            <button onClick={() => setVerInfo(false)} className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">Cerrar</button>
          </div>
        </div>
      )}

      {/* Overlay crear asunto */}
      {dlgNuevo && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/40" onClick={() => setDlgNuevo(false)}>
          <div className="max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(env(safe-area-inset-bottom),20px)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
            <h2 className="flex items-center gap-2 text-base font-bold"><Briefcase className="h-4 w-4 text-primary" /> Nuevo asunto</h2>
            <p className="mt-1 text-xs text-muted-foreground">Liga el asunto a departamentos enteros y/o añade usuarios concretos. Solo verán el grupo los empleados con ese departamento en su rol y las personas añadidas.</p>

            <label className="mt-4 block text-xs font-semibold">Título del asunto</label>
            <input
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="Ej. Apertura sucursal, Evento navidad…"
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              autoFocus
            />

            <label className="mt-4 flex items-center gap-1.5 text-xs font-semibold">
              <Building2 className="h-3.5 w-3.5 text-primary" /> Departamentos con acceso ({deptosNuevo.size})
            </label>
            <div className="mt-1.5 max-h-[34dvh] overflow-y-auto rounded-xl border">
              {departamentosDisponibles.length === 0 && <p className="px-4 py-6 text-center text-xs text-muted-foreground">Sin departamentos disponibles.</p>}
              {departamentosDisponibles.map((nombre) => {
                const checked = deptosNuevo.has(nombre);
                return (
                  <button
                    key={nombre}
                    type="button"
                    onClick={() => {
                      const next = new Set(deptosNuevo);
                      if (next.has(nombre)) next.delete(nombre); else next.add(nombre);
                      setDeptosNuevo(next);
                    }}
                    className={cn("flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0", checked ? "bg-primary/5" : "active:bg-muted/50")}
                  >
                    <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", checked ? "border-primary bg-primary" : "border-input bg-background")}>
                      {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                    </div>
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{nombre}</span>
                  </button>
                );
              })}
            </div>

            <label className="mt-4 flex items-center gap-1.5 text-xs font-semibold">
              <Users className="h-3.5 w-3.5 text-primary" /> Usuarios concretos ({miembrosNuevo.size}) <span className="text-[10px] font-normal text-muted-foreground">· opcional</span>
            </label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={buscaEmp}
                onChange={(e) => setBuscaEmp(e.target.value)}
                placeholder="Buscar persona…"
                className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="mt-1.5 max-h-[28dvh] overflow-y-auto rounded-xl border">
              {empleadosFiltrados.length === 0 && <p className="px-4 py-6 text-center text-xs text-muted-foreground">Sin personas que coincidan.</p>}
              {empleadosFiltrados.map((e) => {
                const checked = miembrosNuevo.has(e.userId);
                const ini = `${e.nombre[0] ?? ""}${e.apellidos[0] ?? ""}`.toUpperCase();
                return (
                  <button
                    key={e.userId}
                    type="button"
                    onClick={() => {
                      const next = new Set(miembrosNuevo);
                      if (next.has(e.userId)) next.delete(e.userId); else next.add(e.userId);
                      setMiembrosNuevo(next);
                    }}
                    className={cn("flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-b-0", checked ? "bg-primary/5" : "active:bg-muted/50")}
                  >
                    <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", checked ? "border-primary bg-primary" : "border-input bg-background")}>
                      {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{ini || "—"}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.nombre} {e.apellidos}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{[e.rolLabel, e.departamento].filter(Boolean).join(" · ") || "Sin rol"}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => setDlgNuevo(false)} className="flex-1 rounded-xl border py-3 text-sm font-semibold active:bg-muted">Cancelar</button>
              <button onClick={crearAsunto} disabled={!nombreNuevo.trim() || (deptosNuevo.size === 0 && miembrosNuevo.size === 0)} className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white disabled:opacity-50">Crear asunto</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Seccion({ icon, label, count, open, onToggle }: { icon: React.ReactNode; label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 px-1 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground active:opacity-70"
    >
      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
      {icon}{label}
      <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px]">{count}</span>
    </button>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">{texto}</p>;
}

function CanalAvatar({ logoUrl, iniciales, color }: { logoUrl?: string; iniciales: string; color: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full bg-background object-cover ring-1 ring-border" />;
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: color }}>
      {iniciales}
    </div>
  );
}

function FilaCanal({ canal, color, logoUrl, onClick }: { canal: Canal; color: string; logoUrl?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card px-3 py-3 text-left active:bg-muted/40">
      <CanalAvatar logoUrl={logoUrl} iniciales={canal.nombre.slice(0, 2).toUpperCase()} color={color} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-bold">
          {canal.nombre}
          {canal.tipo === "departamento" && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {canal.tipo === "departamento"
            ? "Departamento"
            : canal.departamentos.length > 0 ? canal.departamentos.join(" · ") : "Asunto"}
        </p>
      </div>
      <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

function MobileAdjunto({ path, tipo, nombre, propio }: { path: string; tipo: "imagen" | "audio" | "archivo"; nombre: string; propio: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let mounted = true;
    getAdjuntoSignedUrl(path).then((res) => { if (mounted) { setUrl(res.url); setCargando(false); } });
    return () => { mounted = false; };
  }, [path]);

  if (cargando) return <div className="flex justify-center py-2 opacity-70"><Loader2 className="h-3 w-3 animate-spin" /></div>;
  if (!url) return <p className="text-[11px] italic opacity-70">Adjunto no disponible</p>;

  if (tipo === "imagen") {
    return <a href={url} target="_blank" rel="noreferrer" className="mb-1 block"><img src={url} alt={nombre} className="max-h-64 rounded-lg object-cover" /></a>;
  }
  if (tipo === "audio") {
    return <audio src={url} controls preload="metadata" className="my-1 block h-10 w-[210px] max-w-full" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" download={nombre}
      className={cn("mb-1 flex items-center gap-2 rounded-lg px-3 py-2", propio ? "bg-blue-700/40 text-white" : "bg-muted text-foreground")}>
      <FileText className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{nombre}</span>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}
