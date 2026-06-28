"use client";

import { ReactNode, useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  MessageCircle, Send, Users, Plus, Search, Pin, Smile, MoreVertical,
  BellOff, Bell, Pencil, Trash2, LogOut, Lock, ChevronLeft, ChevronDown,
  ShieldCheck, Eraser, Hourglass, X, Paperclip, Mic, Building2, Briefcase, Check,
  FileText, Download, Loader2,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetTitle, SheetTrigger, SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listCanales,
  listMensajes,
  sendMensaje,
  createCanal,
  updateCanalNombre,
  deleteCanal,
  vaciarCanal,
  updateCanalConfig,
  listCanalPreferencias,
  upsertCanalPreferencia,
  updateCanalMiembros,
  updateCanalDepartamentos,
  listEmpleadosEmpresa,
  purgeCanalesObsoletos,
  sendMensajeAdjunto,
  getAdjuntoSignedUrl,
  type EmpleadoCanal,
} from "@/features/comunicacion/actions/comunicacion-actions";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getOrganigrama } from "@/features/direccion/actions/organigrama-actions";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { orgChartsPorEmpresa } from "@/features/direccion/data/direccion";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

type Canal = {
  id: string;
  nombre: string;
  tipo: "departamento" | "asunto" | "grupo" | "directo";
  miembros: number;
  miembrosUserIds: string[];
  departamentos: string[];
  ultimoMensaje?: string;
  sinLeer: number;
  descripcion?: string;
  soloAdminsEnvian: boolean;
  bloquearAjustes: boolean;
  mensajesEfimerosDias: number | null;
};

type Mensaje = {
  id: string;
  canalId: string;
  autor: string;
  avatar: string;
  texto: string;
  fecha: string;
  hora: string;
  fijado: boolean;
  adjuntoPath?: string | null;
  adjuntoTipo?: "imagen" | "audio" | "archivo" | null;
  adjuntoNombre?: string | null;
  adjuntoMime?: string | null;
  adjuntoTamano?: number | null;
};

type PrefCanal = { silenciado: boolean; fijado: boolean };
const PREF_DEFAULT: PrefCanal = { silenciado: false, fijado: false };

// Departamentos operativos siempre presentes (no aparecen como nodos
// administrativos en el organigrama, pero son departamentos reales del negocio).
const DEPARTAMENTOS_OPERATIVOS_BASE = ["SALA", "COCINA"];

// Nodos del organigrama que son externos al organigrama interno y no deben
// generar grupo (p. ej. socios/inversores).
const NODOS_EXCLUIDOS = new Set(["SOCIOS"]);

// Departamentos garantizados (fallback si el organigrama no existe ni en BD ni local).
// Debe coincidir con las secciones de la sidebar (app-sidebar.tsx).
const DEPARTAMENTOS_FALLBACK = [
  "DIRECCIÓN",
  "SALA",
  "COCINA",
  "GERENCIA",
  "CALIDAD",
  "RECURSOS HUMANOS",
  "MARKETING",
  "LOGÍSTICA",
  "CONTABILIDAD",
  "GESTORÍA",
  "JURÍDICO",
];

// Los grupos por defecto se derivan de los nodos administrativos del organigrama
// + los departamentos operativos base (SALA, COCINA), que en el organigrama no
// son nodos sino áreas que contienen puestos (camareros, cocineros, hostess…).
// Los nodos externos (SOCIOS) se excluyen explícitamente.
async function getDepartamentosDelOrganigrama(empresaId: string): Promise<string[]> {
  let chart = await getOrganigrama(empresaId);
  if (!chart || chart.nodes.length === 0) {
    chart = orgChartsPorEmpresa[empresaId] ?? orgChartsPorEmpresa.habana ?? null;
  }
  const adminLabels = chart
    ? chart.nodes
        .filter((n) => n.area === "administrativa")
        .map((n) => n.label.trim().toUpperCase())
        .filter((l) => l.length > 0 && !NODOS_EXCLUIDOS.has(l))
    : [];
  const todos = [...DEPARTAMENTOS_OPERATIVOS_BASE, ...adminLabels];
  const dedup = Array.from(new Set(todos));
  return dedup.length > 0 ? dedup : DEPARTAMENTOS_FALLBACK;
}

function mapDbCanal(r: Record<string, unknown>): Canal {
  const miembrosArr = Array.isArray(r.miembros_user_ids)
    ? (r.miembros_user_ids as string[])
    : [];
  const deptosArr = Array.isArray(r.departamentos)
    ? (r.departamentos as string[])
    : [];
  // Normalizamos: lo que se creó antes como "grupo" se trata como asunto manual.
  const tipoRaw = (r.tipo as string) ?? "asunto";
  const tipo: Canal["tipo"] =
    tipoRaw === "departamento" || tipoRaw === "asunto" || tipoRaw === "directo"
      ? (tipoRaw as Canal["tipo"])
      : "asunto";
  return {
    id: r.id as string,
    nombre: (r.nombre as string) ?? "",
    tipo,
    miembros: (r.miembros as number) ?? miembrosArr.length,
    miembrosUserIds: miembrosArr,
    departamentos: deptosArr,
    ultimoMensaje: (r.ultimo_mensaje as string) || undefined,
    sinLeer: (r.sin_leer as number) ?? 0,
    descripcion: (r.descripcion as string) || undefined,
    soloAdminsEnvian: (r.solo_admins_envian as boolean) ?? false,
    bloquearAjustes: (r.bloquear_ajustes as boolean) ?? false,
    mensajesEfimerosDias: (r.mensajes_efimeros_dias as number | null) ?? null,
  };
}

function limpiarNombre(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s.toLowerCase() === "null null" || s.toLowerCase() === "null") return "Sin nombre";
  return s;
}

function mapDbMensaje(r: Record<string, unknown>): Mensaje {
  const createdAt = r.created_at ? new Date(r.created_at as string) : new Date();
  const hoy = new Date();
  const esHoy = createdAt.toDateString() === hoy.toDateString();
  const nombre = limpiarNombre(r.autor_nombre);
  const iniciales =
    nombre
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";
  return {
    id: r.id as string,
    canalId: (r.canal_id as string) ?? "",
    autor: nombre,
    avatar: iniciales,
    texto: (r.texto as string) ?? "",
    fecha: esHoy ? "Hoy" : createdAt.toLocaleDateString("es-ES"),
    hora: createdAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    fijado: (r.fijado as boolean) ?? false,
    adjuntoPath: (r.adjunto_url as string) ?? null,
    adjuntoTipo: (r.adjunto_tipo as Mensaje["adjuntoTipo"]) ?? null,
    adjuntoNombre: (r.adjunto_nombre as string) ?? null,
    adjuntoMime: (r.adjunto_mime as string) ?? null,
    adjuntoTamano: (r.adjunto_tamano as number) ?? null,
  };
}

function mapDbPref(r: Record<string, unknown>): { canalId: string; pref: PrefCanal } {
  return {
    canalId: r.canal_id as string,
    pref: {
      silenciado: (r.silenciado as boolean) ?? false,
      fijado: (r.fijado as boolean) ?? false,
    },
  };
}

// Elige un formato de grabación de audio soportado: mp4 primero (iOS y
// reproducible en todos lados); si no, webm (Chrome/Firefox/Android).
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

function GrupoAvatar({
  logoUrl, iniciales, color, size = "md",
}: {
  logoUrl?: string;
  iniciales: string;
  color: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const cls =
    size === "sm" ? "h-9 w-9 text-[10px]" :
    size === "lg" ? "h-16 w-16 text-base" :
    size === "xl" ? "h-24 w-24 text-xl" :
    "h-12 w-12 text-xs";
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={cn(cls, "rounded-full object-cover shrink-0 ring-1 ring-border bg-background")}
      />
    );
  }
  return (
    <div
      className={cn(cls, "rounded-full flex items-center justify-center font-bold text-white shrink-0")}
      style={{ backgroundColor: color }}
    >
      {iniciales}
    </div>
  );
}

export function ChatDrawer({ children }: { children: ReactNode }) {
  // Avatares de chat (md, xl) = ISOTIPO (icono sin texto). Fallback al logotipo si no hay isotipo.
  const { empresaActual, getIsotipoUrl } = useEmpresa();
  const logoUrl = getIsotipoUrl(empresaActual.id);

  const [open, setOpen] = useState(false);
  const [canales, setCanales] = useState<Canal[]>([]);
  const [canalActivo, setCanalActivo] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargandoMsgs, setCargandoMsgs] = useState(false);
  useGlobalLoadingSync(cargando || cargandoMsgs);
  const [prefsMap, setPrefsMap] = useState<Record<string, PrefCanal>>({});

  const [dlgNuevo, setDlgNuevo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [miembrosNuevo, setMiembrosNuevo] = useState<Set<string>>(new Set());
  const [deptosNuevo, setDeptosNuevo] = useState<Set<string>>(new Set());
  const [dlgDeptos, setDlgDeptos] = useState(false);
  const [deptosEdit, setDeptosEdit] = useState<Set<string>>(new Set());
  const [dlgAjustes, setDlgAjustes] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreEdit, setNombreEdit] = useState("");
  const [confirmVaciar, setConfirmVaciar] = useState(false);
  const [confirmSalir, setConfirmSalir] = useState(false);
  const [empleados, setEmpleados] = useState<EmpleadoCanal[]>([]);
  const [busquedaEmpleados, setBusquedaEmpleados] = useState("");
  const [dlgMiembros, setDlgMiembros] = useState(false);
  const [miembrosEdit, setMiembrosEdit] = useState<Set<string>>(new Set());

  // Colapsables del sidebar
  const [openDeptos, setOpenDeptos] = useState(true);
  const [openAsuntos, setOpenAsuntos] = useState(true);

  // Subida y grabación
  const [subiendo, setSubiendo] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [grabadoraTiempo, setGrabadoraTiempo] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const grabadoraTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const canal = canales.find((c) => c.id === canalActivo) ?? null;
  const prefActivo = canalActivo ? (prefsMap[canalActivo] ?? PREF_DEFAULT) : PREF_DEFAULT;

  const msgDelCanal = useMemo(
    () => (canalActivo ? mensajes.filter((m) => m.canalId === canalActivo) : []),
    [mensajes, canalActivo]
  );

  // Lista ordenada: fijados primero, luego por nombre
  const canalesOrdenados = useMemo(() => {
    const arr = [...canales];
    arr.sort((a, b) => {
      const fa = (prefsMap[a.id] ?? PREF_DEFAULT).fijado;
      const fb = (prefsMap[b.id] ?? PREF_DEFAULT).fijado;
      if (fa !== fb) return fa ? -1 : 1;
      return a.nombre.localeCompare(b.nombre);
    });
    return arr;
  }, [canales, prefsMap]);

  const canalesFiltrados = busqueda.trim()
    ? canalesOrdenados.filter((c) => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : canalesOrdenados;

  const canalesDepartamento = canalesFiltrados.filter((c) => c.tipo === "departamento");
  const canalesAsunto = canalesFiltrados.filter((c) => c.tipo !== "departamento");

  // Departamentos disponibles para ligar a un asunto (todos los del organigrama,
  // independientes del buscador).
  const departamentosDisponibles = useMemo(
    () =>
      Array.from(
        new Set(canales.filter((c) => c.tipo === "departamento").map((c) => c.nombre)),
      ).sort((a, b) => a.localeCompare(b)),
    [canales],
  );

  const isDepartamento = canal?.tipo === "departamento";

  const empleadosFiltrados = useMemo(() => {
    const q = busquedaEmpleados.trim().toLowerCase();
    if (!q) return empleados;
    return empleados.filter((e) => {
      const full = `${e.nombre} ${e.apellidos}`.toLowerCase();
      return (
        full.includes(q) ||
        (e.rolLabel ?? "").toLowerCase().includes(q) ||
        (e.departamento ?? "").toLowerCase().includes(q)
      );
    });
  }, [empleados, busquedaEmpleados]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgDelCanal.length]);

  const cargarCanales = useCallback(async () => {
    const empresaSlug = empresaActual.id;
    try {
      setCargando(true);

      // 1. Leer canales visibles para el usuario.
      const res = await listCanales(empresaSlug);
      if (!res.ok) {
        toast.error("No se pudo leer los canales (revisa migraciones / sesión).");
        return;
      }
      let data = res.data as Record<string, unknown>[];

      // 2. Solo admins/directores mantienen el catálogo de departamentos
      //    (purgan obsoletos y crean los que falten). Un usuario normal ve la
      //    lista ya filtrada y no debe recrear departamentos que no ve.
      if (res.esAdmin) {
        const departamentos = await getDepartamentosDelOrganigrama(empresaSlug);
        await purgeCanalesObsoletos(departamentos, empresaSlug);

        const existentes = new Set(
          data.map((d) => String(d.nombre ?? "").trim().toUpperCase()),
        );
        const faltantes = departamentos.filter((nombre) => !existentes.has(nombre));
        if (faltantes.length > 0) {
          const resultados = await Promise.all(
            faltantes.map((nombre) => createCanal(nombre, "departamento", [], empresaSlug)),
          );
          const fallos = resultados.filter((r) => !r.ok);
          if (fallos.length > 0) {
            console.warn("[chat] fallos al crear canales:", fallos);
          }
        }
        const retry = await listCanales(empresaSlug);
        if (retry.ok) data = retry.data as Record<string, unknown>[];
      }

      const mapped = data.map(mapDbCanal);
      setCanales(mapped);
    } catch (err) {
      console.error("[chat] cargarCanales error:", err);
      toast.error("Error al cargar canales");
    } finally {
      setCargando(false);
    }
  }, [empresaActual.id]);

  const cargarMensajes = useCallback(async (cId: string) => {
    try {
      setCargandoMsgs(true);
      const res = await listMensajes(cId);
      if (res.ok) {
        setMensajes((prev) => {
          const otros = prev.filter((m) => m.canalId !== cId);
          const nuevos = (res.data as Record<string, unknown>[]).map(mapDbMensaje);
          return [...otros, ...nuevos];
        });
      }
    } finally {
      setCargandoMsgs(false);
    }
  }, []);

  const cargarPrefs = useCallback(async () => {
    const res = await listCanalPreferencias();
    if (!res.ok) return;
    const map: Record<string, PrefCanal> = {};
    for (const r of res.data as Record<string, unknown>[]) {
      const { canalId, pref } = mapDbPref(r);
      map[canalId] = pref;
    }
    setPrefsMap(map);
  }, []);

  const cargarEmpleados = useCallback(async () => {
    const res = await listEmpleadosEmpresa();
    if (res.ok) setEmpleados(res.data);
  }, []);

  useEffect(() => {
    if (open) {
      cargarCanales();
      cargarPrefs();
      cargarEmpleados();
    }
  }, [open, cargarCanales, cargarPrefs, cargarEmpleados]);

  // Al cambiar de empresa, limpiar selección y mensajes; cargarCanales se re-ejecuta
  // porque su useCallback depende de empresaActual.id.
  useEffect(() => {
    setCanalActivo(null);
    setCanales([]);
    setMensajes([]);
    setBusqueda("");
  }, [empresaActual.id]);

  useEffect(() => {
    if (canalActivo) cargarMensajes(canalActivo);
  }, [canalActivo, cargarMensajes]);

  async function enviar() {
    if (!input.trim() || !canalActivo) return;
    const texto = input.trim();
    setInput("");
    const optimistic: Mensaje = {
      id: `m-${Date.now()}`,
      canalId: canalActivo,
      autor: "Tu",
      avatar: "TU",
      texto,
      fecha: "Hoy",
      hora: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      fijado: false,
    };
    setMensajes((prev) => [...prev, optimistic]);
    try {
      const res = await sendMensaje(canalActivo, texto);
      if (!res.ok) {
        toast.error(res.error ?? "Error al enviar");
        setMensajes((prev) => prev.filter((m) => m.id !== optimistic.id));
        return;
      }
      if (res.data) {
        const real = mapDbMensaje(res.data as Record<string, unknown>);
        setMensajes((prev) => prev.map((m) => (m.id === optimistic.id ? real : m)));
      }
    } catch {
      toast.error("Error al enviar");
      setMensajes((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  }

  async function crearAsunto() {
    const limpio = nombreNuevo.trim();
    if (!limpio) return;
    if (deptosNuevo.size === 0) {
      toast.error("Liga el asunto a al menos un departamento");
      return;
    }
    try {
      const res = await createCanal(
        limpio,
        "asunto",
        Array.from(miembrosNuevo),
        empresaActual.id,
        Array.from(deptosNuevo),
      );
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo crear el asunto");
        return;
      }
      const nuevo = mapDbCanal(res.data as Record<string, unknown>);
      setCanales((prev) => [...prev, nuevo]);
      setCanalActivo(nuevo.id);
      setDlgNuevo(false);
      setNombreNuevo("");
      setMiembrosNuevo(new Set());
      setDeptosNuevo(new Set());
      setBusquedaEmpleados("");
      toast.success("Asunto creado");
    } catch {
      toast.error("No se pudo crear el asunto");
    }
  }

  async function guardarDeptos() {
    if (!canal) return;
    if (canal.tipo === "departamento") {
      toast.error("Un departamento no se liga a otros departamentos");
      return;
    }
    const lista = Array.from(deptosEdit);
    if (lista.length === 0) {
      toast.error("Liga el asunto a al menos un departamento");
      return;
    }
    const res = await updateCanalDepartamentos(canal.id, lista);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron guardar los departamentos");
      return;
    }
    setCanales((prev) =>
      prev.map((c) => (c.id === canal.id ? { ...c, departamentos: lista } : c)),
    );
    setDlgDeptos(false);
    toast.success("Departamentos actualizados");
  }

  async function guardarMiembros() {
    if (!canal) return;
    if (canal.tipo === "departamento") {
      toast.error("Los miembros de un departamento no se editan");
      return;
    }
    const lista = Array.from(miembrosEdit);
    const res = await updateCanalMiembros(canal.id, lista);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo actualizar miembros");
      return;
    }
    setCanales((prev) =>
      prev.map((c) =>
        c.id === canal.id ? { ...c, miembrosUserIds: lista, miembros: lista.length } : c,
      ),
    );
    setDlgMiembros(false);
    toast.success("Miembros actualizados");
  }

  async function guardarNombre() {
    if (!canal) return;
    if (canal.tipo === "departamento") {
      toast.error("Los departamentos no se pueden renombrar");
      setEditandoNombre(false);
      return;
    }
    const limpio = nombreEdit.trim();
    if (!limpio || limpio === canal.nombre) {
      setEditandoNombre(false);
      return;
    }
    const res = await updateCanalNombre(canal.id, limpio);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo renombrar");
      return;
    }
    setCanales((prev) => prev.map((c) => (c.id === canal.id ? { ...c, nombre: limpio } : c)));
    setEditandoNombre(false);
    toast.success("Nombre actualizado");
  }

  async function vaciar() {
    if (!canal) return;
    if (canal.tipo === "departamento") {
      toast.error("Los mensajes de un departamento no se vacían");
      return;
    }
    const res = await vaciarCanal(canal.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo vaciar");
      return;
    }
    setMensajes((prev) => prev.filter((m) => m.canalId !== canal.id));
    setConfirmVaciar(false);
    toast.success("Mensajes eliminados");
  }

  async function salir() {
    if (!canal) return;
    if (canal.tipo === "departamento") {
      toast.error("Los departamentos no se pueden eliminar");
      return;
    }
    const res = await deleteCanal(canal.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo eliminar el grupo");
      return;
    }
    setCanales((prev) => prev.filter((c) => c.id !== canal.id));
    setMensajes((prev) => prev.filter((m) => m.canalId !== canal.id));
    setCanalActivo(null);
    setConfirmSalir(false);
    setDlgAjustes(false);
    toast.success("Has salido del grupo");
  }

  async function setPref(key: keyof PrefCanal, value: boolean) {
    if (!canalActivo) return;
    const previo = prefsMap[canalActivo] ?? PREF_DEFAULT;
    setPrefsMap((prev) => ({ ...prev, [canalActivo]: { ...previo, [key]: value } }));
    const res = await upsertCanalPreferencia(canalActivo, { [key]: value });
    if (!res.ok) {
      setPrefsMap((prev) => ({ ...prev, [canalActivo]: previo }));
      toast.error(res.error ?? "No se pudo guardar la preferencia");
    }
  }

  async function setCanalFlag(
    key: "solo_admins_envian" | "bloquear_ajustes",
    value: boolean,
  ) {
    if (!canal) return;
    const camelKey = key === "solo_admins_envian" ? "soloAdminsEnvian" : "bloquearAjustes";
    const previo = canal[camelKey];
    setCanales((prev) => prev.map((c) => (c.id === canal.id ? { ...c, [camelKey]: value } : c)));
    const res = await updateCanalConfig(canal.id, { [key]: value });
    if (!res.ok) {
      setCanales((prev) => prev.map((c) => (c.id === canal.id ? { ...c, [camelKey]: previo } : c)));
      toast.error(res.error ?? "No se pudo guardar el ajuste");
    }
  }

  async function setEfimeros(activado: boolean) {
    if (!canal) return;
    const previo = canal.mensajesEfimerosDias;
    const nuevo = activado ? 7 : null;
    setCanales((prev) => prev.map((c) => (c.id === canal.id ? { ...c, mensajesEfimerosDias: nuevo } : c)));
    const res = await updateCanalConfig(canal.id, { mensajes_efimeros_dias: nuevo });
    if (!res.ok) {
      setCanales((prev) => prev.map((c) => (c.id === canal.id ? { ...c, mensajesEfimerosDias: previo } : c)));
      toast.error(res.error ?? "No se pudo guardar el ajuste");
    }
  }

  // ───────── Adjuntos: subida directa al bucket "chat-archivos" ─────────
  async function subirYEnviarAdjunto(file: File, tipo: "imagen" | "audio" | "archivo") {
    if (!canalActivo) return;
    try {
      setSubiendo(true);
      const supabase = createBrowserClient();
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${empresaActual.id}/${canalActivo}/${Date.now()}_${safeName}${
        ext && !safeName.endsWith(ext) ? `.${ext}` : ""
      }`;
      const up = await supabase.storage.from("chat-archivos").upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (up.error) throw up.error;
      const res = await sendMensajeAdjunto({
        canalId: canalActivo,
        texto: null,
        adjuntoUrl: up.data.path,
        adjuntoTipo: tipo,
        adjuntoNombre: file.name,
        adjuntoMime: file.type || "application/octet-stream",
        adjuntoTamano: file.size,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo enviar el adjunto");
        return;
      }
      if (res.data) {
        const real = mapDbMensaje(res.data as Record<string, unknown>);
        setMensajes((prev) => [...prev, real]);
      }
    } catch (err) {
      console.error("[chat] subirYEnviarAdjunto:", err);
      toast.error("No se pudo subir el archivo");
    } finally {
      setSubiendo(false);
    }
  }

  function detectarTipo(file: File): "imagen" | "audio" | "archivo" {
    if (file.type.startsWith("image/")) return "imagen";
    if (file.type.startsWith("audio/")) return "audio";
    return "archivo";
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    subirYEnviarAdjunto(f, detectarTipo(f));
    e.target.value = "";
  }

  // ───────── Grabación de audio ─────────
  async function iniciarGrabacion() {
    if (!canalActivo) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Formato soportado por el dispositivo: mp4 (iOS, reproducible en todos
      // lados) o webm (Chrome/Firefox). Etiquetar mal el archivo hace que el
      // reproductor muestre "Error" (p. ej. webm en iOS/Safari).
      const preferido = pickAudioMime();
      const mr = preferido ? new MediaRecorder(stream, { mimeType: preferido }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mr.mimeType || preferido || "audio/mp4";
        const ext = audioExt(type);
        const blob = new Blob(audioChunksRef.current, { type });
        const file = new File([blob], `audio_${Date.now()}.${ext}`, { type });
        await subirYEnviarAdjunto(file, "audio");
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setGrabando(true);
      setGrabadoraTiempo(0);
      grabadoraTimerRef.current = setInterval(() => setGrabadoraTiempo((t) => t + 1), 1000);
    } catch (err) {
      console.error("[chat] iniciarGrabacion:", err);
      toast.error("Sin acceso al micrófono");
    }
  }

  function detenerGrabacion(cancelar = false) {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      if (cancelar) {
        mr.ondataavailable = null;
        mr.onstop = () => mr.stream.getTracks().forEach((t) => t.stop());
      }
      mr.stop();
    }
    if (grabadoraTimerRef.current) {
      clearInterval(grabadoraTimerRef.current);
      grabadoraTimerRef.current = null;
    }
    setGrabando(false);
    setGrabadoraTiempo(0);
  }

  const iniciales = empresaActual.iniciales;
  const colorEmpresa = empresaActual.color;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>

      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Comunicación interna</SheetTitle>

        {/* Top bar global */}
        <header className="flex items-center justify-between border-b px-4 py-2 shrink-0 bg-background">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-green-500 fill-green-500/15" />
            <div>
              <h1 className="text-sm font-bold leading-tight">Comunicación</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">{empresaActual.nombre} · Departamentos</p>
            </div>
          </div>
          <SheetClose asChild>
            <button
              type="button"
              className="rounded-full p-2 hover:bg-black/5 transition-colors"
              title="Cerrar"
            >
              <X className="h-5 w-5 text-[#5f6368]" />
            </button>
          </SheetClose>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar estilo WhatsApp */}
          <aside className="w-[380px] shrink-0 border-r bg-background flex flex-col">
            {/* Header de comunidad */}
            <div className="border-b px-4 py-3 flex items-center gap-3">
              <GrupoAvatar logoUrl={logoUrl} iniciales={iniciales} color={colorEmpresa} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-extrabold truncate">{empresaActual.nombre}</p>
                <p className="text-[11px] text-muted-foreground">Departamentos</p>
              </div>
            </div>

            {/* Buscador */}
            <div className="px-3 py-2 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 pl-9 text-sm rounded-full bg-muted/50 border-0"
                  placeholder="Buscar grupo…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>

            {/* Lista de canales separada en dos secciones */}
            <div className="flex-1 overflow-y-auto">
              {cargando && <LoadingSpinner size="sm" className="px-4 py-6" />}

              {!cargando && (
                <>
                  <SidebarSeccion
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    label="Departamentos"
                    hint="De serie · no editables"
                    count={canalesDepartamento.length}
                    open={openDeptos}
                    onToggle={() => setOpenDeptos((v) => !v)}
                  />
                  {openDeptos && (
                    <>
                      {canalesDepartamento.length === 0 && (
                        <p className="px-4 py-3 text-[11px] text-muted-foreground text-center">
                          Aún no hay departamentos en el organigrama.
                        </p>
                      )}
                      {canalesDepartamento.map((c) => (
                        <CanalRow
                          key={c.id}
                          canal={c}
                          activo={canalActivo === c.id}
                          pref={prefsMap[c.id] ?? PREF_DEFAULT}
                          onClick={() => setCanalActivo(c.id)}
                          logoUrl={logoUrl}
                          iniciales={iniciales}
                          colorEmpresa={colorEmpresa}
                        />
                      ))}
                    </>
                  )}

                  <SidebarSeccion
                    icon={<Briefcase className="h-3.5 w-3.5" />}
                    label="Asuntos"
                    hint="Manuales · tú eliges miembros"
                    count={canalesAsunto.length}
                    open={openAsuntos}
                    onToggle={() => setOpenAsuntos((v) => !v)}
                  />
                  {openAsuntos && (
                    <>
                      {canalesAsunto.length === 0 && (
                        <p className="px-4 py-3 text-[11px] text-muted-foreground text-center">
                          Sin asuntos. Pulsa &quot;Crear asunto&quot;.
                        </p>
                      )}
                      {canalesAsunto.map((c) => (
                        <CanalRow
                          key={c.id}
                          canal={c}
                          activo={canalActivo === c.id}
                          pref={prefsMap[c.id] ?? PREF_DEFAULT}
                          onClick={() => setCanalActivo(c.id)}
                          logoUrl={logoUrl}
                          iniciales={iniciales}
                          colorEmpresa={colorEmpresa}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Botón crear asunto */}
            <div className="p-3 border-t shrink-0">
              <Button
                onClick={() => { setNombreNuevo(""); setMiembrosNuevo(new Set()); setDeptosNuevo(new Set()); setBusquedaEmpleados(""); setDlgNuevo(true); }}
                className="w-full gap-2 rounded-full h-12 text-sm font-semibold shadow-sm bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <Plus className="h-5 w-5" /> Crear asunto
              </Button>
            </div>
          </aside>

          {/* Panel chat */}
          <section className="flex-1 flex flex-col min-w-0 bg-[#f0f2f5] dark:bg-muted/10">
            {!canal ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
                <GrupoAvatar logoUrl={logoUrl} iniciales={iniciales} color={colorEmpresa} size="xl" />
                <h3 className="text-xl font-bold">{empresaActual.nombre}</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Selecciona un departamento para empezar a chatear. Todos los grupos comparten el icono de la empresa, solo el nombre es editable.
                </p>
              </div>
            ) : (
              <>
                {/* Header del chat */}
                <div className="flex items-center justify-between border-b bg-background px-5 py-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setCanalActivo(null)}
                      className="lg:hidden rounded-full p-1 hover:bg-muted"
                      title="Volver"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <GrupoAvatar logoUrl={logoUrl} iniciales={iniciales} color={colorEmpresa} size="md" />
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-foreground truncate flex items-center gap-1.5">
                        {canal.nombre}
                        {isDepartamento && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </h2>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          {isDepartamento ? <Building2 className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                          {isDepartamento ? "Departamento" : "Asunto"}
                        </span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {canal.miembros}</span>
                        {prefActivo.silenciado && (
                          <span className="inline-flex items-center gap-1"><BellOff className="h-3 w-3" /> silenciado</span>
                        )}
                        {canal.mensajesEfimerosDias != null && (
                          <span className="inline-flex items-center gap-1"><Hourglass className="h-3 w-3" /> {canal.mensajesEfimerosDias}d</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" title="Buscar">
                      <Search className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          {isDepartamento && <Lock className="h-3 w-3" />}
                          {isDepartamento ? "Departamento (de serie)" : "Asunto"}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setDlgAjustes(true)}>
                          <ShieldCheck className="mr-2 h-4 w-4" /> Datos del grupo
                        </DropdownMenuItem>
                        {!isDepartamento && (
                          <>
                            <DropdownMenuItem onSelect={() => { setNombreEdit(canal.nombre); setEditandoNombre(true); setDlgAjustes(true); }}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar nombre
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setDeptosEdit(new Set(canal.departamentos)); setDlgDeptos(true); }}>
                              <Building2 className="mr-2 h-4 w-4" /> Editar departamentos
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setMiembrosEdit(new Set(canal.miembrosUserIds)); setBusquedaEmpleados(""); setDlgMiembros(true); }}>
                              <Users className="mr-2 h-4 w-4" /> Editar miembros
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem onSelect={() => setPref("silenciado", !prefActivo.silenciado)}>
                          {prefActivo.silenciado ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
                          {prefActivo.silenciado ? "Activar notificaciones" : "Silenciar notificaciones"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setPref("fijado", !prefActivo.fijado)}>
                          <Pin className="mr-2 h-4 w-4" /> {prefActivo.fijado ? "Desfijar grupo" : "Fijar grupo"}
                        </DropdownMenuItem>
                        {!isDepartamento && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setConfirmVaciar(true)}>
                              <Eraser className="mr-2 h-4 w-4" /> Vaciar mensajes
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setConfirmSalir(true)} className="text-destructive">
                              <LogOut className="mr-2 h-4 w-4" /> Eliminar asunto
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Mensajes */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
                  {cargandoMsgs && <LoadingSpinner className="py-12" />}
                  {!cargandoMsgs && msgDelCanal.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-16 text-center">
                      <GrupoAvatar logoUrl={logoUrl} iniciales={iniciales} color={colorEmpresa} size="lg" />
                      <p className="text-sm font-semibold">{canal.nombre}</p>
                      <p className="text-xs text-muted-foreground">No hay mensajes todavía. Sé el primero en escribir.</p>
                    </div>
                  )}
                  {msgDelCanal.map((m) => {
                    const propio = m.autor === "Tu";
                    return (
                      <div key={m.id} className={cn("flex gap-2", propio ? "justify-end" : "justify-start")}>
                        {!propio && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {m.avatar}
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-3.5 py-2 shadow-sm",
                            propio
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-white dark:bg-card text-foreground rounded-bl-md",
                            m.fijado && "ring-2 ring-amber-400"
                          )}
                        >
                          {!propio && (
                            <p className="text-[11px] font-semibold mb-0.5 text-blue-700 dark:text-blue-400">
                              {m.autor}
                            </p>
                          )}
                          {m.adjuntoPath && m.adjuntoTipo && (
                            <Adjunto
                              path={m.adjuntoPath}
                              tipo={m.adjuntoTipo}
                              nombre={m.adjuntoNombre ?? "archivo"}
                              tamano={m.adjuntoTamano ?? 0}
                              propio={propio}
                            />
                          )}
                          {m.texto && (
                            <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
                          )}
                          <p className={cn("text-[10px] mt-1 text-right", propio ? "text-blue-100" : "text-muted-foreground")}>
                            {m.hora}
                            {m.fijado && <Pin className="inline ml-1 h-2.5 w-2.5" />}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Input */}
                <div className="border-t bg-background p-3 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={onPickFile}
                  />
                  {grabando ? (
                    <div className="flex items-center gap-3 px-2 py-1.5 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                      </span>
                      <span className="text-sm font-medium text-red-700 dark:text-red-300 flex-1">
                        Grabando audio… {Math.floor(grabadoraTiempo / 60)}:{(grabadoraTiempo % 60).toString().padStart(2, "0")}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-red-600 hover:text-red-700"
                        onClick={() => detenerGrabacion(true)}
                        title="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-full bg-red-600 hover:bg-red-700"
                        onClick={() => detenerGrabacion(false)}
                        title="Enviar audio"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                        <Smile className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={subiendo || canal.soloAdminsEnvian}
                        title="Adjuntar archivo"
                      >
                        {subiendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                      </Button>
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && enviar()}
                        placeholder={canal.soloAdminsEnvian ? "Solo administradores pueden enviar" : `Mensaje a ${canal.nombre}…`}
                        className="flex-1 h-11 rounded-full bg-muted/50 border-0 px-4"
                        disabled={canal.soloAdminsEnvian}
                      />
                      {input.trim() ? (
                        <Button onClick={enviar} size="icon" className="h-10 w-10 shrink-0 rounded-full">
                          <Send className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={iniciarGrabacion}
                          disabled={subiendo || canal.soloAdminsEnvian}
                          title="Grabar audio"
                        >
                          <Mic className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        {/* Diálogo: nuevo asunto */}
        <Dialog open={dlgNuevo} onOpenChange={setDlgNuevo}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" /> Nuevo asunto
              </DialogTitle>
              <DialogDescription>
                Liga el asunto a uno o varios departamentos: solo verán el grupo los empleados con ese departamento activo en su rol. El icono se fija al de la empresa.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Título del asunto</label>
                <Input
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  placeholder="Ej. APERTURA SUCURSAL, EVENTO NAVIDAD…"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Departamentos con acceso ({deptosNuevo.size})
                  <span className="text-[10px] font-normal text-muted-foreground">· obligatorio</span>
                </label>
                <DepartamentosCheckList
                  departamentos={departamentosDisponibles}
                  seleccion={deptosNuevo}
                  onToggle={(nombre) => {
                    const next = new Set(deptosNuevo);
                    if (next.has(nombre)) next.delete(nombre); else next.add(nombre);
                    setDeptosNuevo(next);
                  }}
                />
              </div>
              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Miembros sueltos ({miembrosNuevo.size}) <span className="text-[10px] font-normal text-muted-foreground">· opcional</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (miembrosNuevo.size === empleadosFiltrados.length) {
                        setMiembrosNuevo(new Set());
                      } else {
                        setMiembrosNuevo(new Set(empleadosFiltrados.map((e) => e.userId)));
                      }
                    }}
                    className="text-[11px] text-primary font-semibold hover:underline"
                  >
                    {miembrosNuevo.size === empleadosFiltrados.length && empleadosFiltrados.length > 0
                      ? "Quitar todos"
                      : "Seleccionar todos"}
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={busquedaEmpleados}
                    onChange={(e) => setBusquedaEmpleados(e.target.value)}
                    placeholder="Buscar por nombre, rol o departamento…"
                    className="h-9 pl-9 text-sm"
                  />
                </div>
                <EmpleadosCheckList
                  empleados={empleadosFiltrados}
                  seleccion={miembrosNuevo}
                  onToggle={(id) => {
                    const next = new Set(miembrosNuevo);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    setMiembrosNuevo(next);
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDlgNuevo(false)}>Cancelar</Button>
              <Button onClick={crearAsunto} disabled={!nombreNuevo.trim() || deptosNuevo.size === 0}>
                Crear asunto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo: editar miembros (sólo asuntos) */}
        <Dialog open={dlgMiembros} onOpenChange={setDlgMiembros}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Miembros del asunto
              </DialogTitle>
              <DialogDescription>
                Elige quién forma parte de <strong>{canal?.nombre}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Seleccionados: {miembrosEdit.size}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (miembrosEdit.size === empleadosFiltrados.length) {
                      setMiembrosEdit(new Set());
                    } else {
                      setMiembrosEdit(new Set(empleadosFiltrados.map((e) => e.userId)));
                    }
                  }}
                  className="text-[11px] text-primary font-semibold hover:underline"
                >
                  {miembrosEdit.size === empleadosFiltrados.length && empleadosFiltrados.length > 0
                    ? "Quitar todos"
                    : "Seleccionar todos"}
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={busquedaEmpleados}
                  onChange={(e) => setBusquedaEmpleados(e.target.value)}
                  placeholder="Buscar por nombre, rol o departamento…"
                  className="h-9 pl-9 text-sm"
                />
              </div>
              <EmpleadosCheckList
                empleados={empleadosFiltrados}
                seleccion={miembrosEdit}
                onToggle={(id) => {
                  const next = new Set(miembrosEdit);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  setMiembrosEdit(next);
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDlgMiembros(false)}>Cancelar</Button>
              <Button onClick={guardarMiembros} disabled={miembrosEdit.size === 0}>
                Guardar miembros
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo: editar departamentos ligados (sólo asuntos) */}
        <Dialog open={dlgDeptos} onOpenChange={setDlgDeptos}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Departamentos del asunto
              </DialogTitle>
              <DialogDescription>
                Solo los empleados con acceso a estos departamentos en su rol verán <strong>{canal?.nombre}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <span className="text-xs text-muted-foreground">
                Seleccionados: {deptosEdit.size}
              </span>
              <DepartamentosCheckList
                departamentos={departamentosDisponibles}
                seleccion={deptosEdit}
                onToggle={(nombre) => {
                  const next = new Set(deptosEdit);
                  if (next.has(nombre)) next.delete(nombre); else next.add(nombre);
                  setDeptosEdit(next);
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDlgDeptos(false)}>Cancelar</Button>
              <Button onClick={guardarDeptos} disabled={deptosEdit.size === 0}>
                Guardar departamentos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo: ajustes de grupo (estilo WhatsApp Business) */}
        <Dialog open={dlgAjustes} onOpenChange={(o) => { setDlgAjustes(o); if (!o) setEditandoNombre(false); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Datos del grupo</DialogTitle>
            </DialogHeader>
            {canal && (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-2 pt-2">
                  <GrupoAvatar logoUrl={logoUrl} iniciales={iniciales} color={colorEmpresa} size="lg" />
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Icono bloqueado a la imagen de empresa
                  </p>
                  {isDepartamento ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-base font-bold">
                        {canal.nombre}
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        Departamento · de serie
                      </span>
                    </div>
                  ) : editandoNombre ? (
                    <div className="flex w-full items-center gap-2">
                      <Input
                        value={nombreEdit}
                        onChange={(e) => setNombreEdit(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && guardarNombre()}
                        autoFocus
                      />
                      <Button size="sm" onClick={guardarNombre}>Guardar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditandoNombre(false)}>Cancelar</Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setNombreEdit(canal.nombre); setEditandoNombre(true); }}
                      className="flex items-center gap-2 text-base font-bold hover:text-primary"
                    >
                      {canal.nombre}
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> {canal.miembros} miembros
                  </p>
                </div>

                {isDepartamento && (
                  <div className="rounded-md border bg-muted/40 p-3 text-[12px] text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Grupo bloqueado
                    </p>
                    <p>
                      Este grupo se crea automáticamente desde el organigrama. No se puede
                      cambiar el título ni los miembros: pertenecen al grupo todos los
                      empleados con rol con acceso a este departamento.
                    </p>
                  </div>
                )}

                {!isDepartamento && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Miembros</p>
                    <div className="rounded-md border p-3 flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <p className="font-semibold text-foreground">{canal.miembros} miembros</p>
                        <p className="text-[11px] text-muted-foreground">Tú eliges quién forma parte de este asunto.</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setMiembrosEdit(new Set(canal.miembrosUserIds)); setBusquedaEmpleados(""); setDlgMiembros(true); setDlgAjustes(false); }}
                      >
                        <Users className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notificaciones</p>
                  <SettingRow
                    icon={<BellOff className="h-4 w-4 text-muted-foreground" />}
                    label="Silenciar notificaciones"
                    description="No recibirás avisos de este grupo"
                    checked={prefActivo.silenciado}
                    onChange={(v) => setPref("silenciado", v)}
                  />
                  <SettingRow
                    icon={<Pin className="h-4 w-4 text-muted-foreground" />}
                    label="Fijar grupo"
                    description="Aparecerá arriba en la lista"
                    checked={prefActivo.fijado}
                    onChange={(v) => setPref("fijado", v)}
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Permisos</p>
                  <SettingRow
                    icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
                    label="Solo administradores envían mensajes"
                    description="Los miembros podrán leer pero no escribir"
                    checked={canal.soloAdminsEnvian}
                    onChange={(v) => setCanalFlag("solo_admins_envian", v)}
                  />
                  <SettingRow
                    icon={<Lock className="h-4 w-4 text-muted-foreground" />}
                    label="Bloquear cambios de ajustes"
                    description="Solo administradores podrán editar el grupo"
                    checked={canal.bloquearAjustes}
                    onChange={(v) => setCanalFlag("bloquear_ajustes", v)}
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Privacidad</p>
                  <SettingRow
                    icon={<Hourglass className="h-4 w-4 text-muted-foreground" />}
                    label="Mensajes temporales"
                    description="Los mensajes se autoeliminan a los 7 días"
                    checked={canal.mensajesEfimerosDias != null}
                    onChange={(v) => setEfimeros(v)}
                  />
                </div>

                {!isDepartamento && (
                  <div className="border-t pt-3 grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setConfirmVaciar(true)} className="gap-2">
                      <Eraser className="h-4 w-4" /> Vaciar mensajes
                    </Button>
                    <Button variant="outline" onClick={() => setConfirmSalir(true)} className="gap-2 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" /> Eliminar asunto
                    </Button>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setDlgAjustes(false)}>Hecho</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmación: vaciar */}
        <AlertDialog open={confirmVaciar} onOpenChange={setConfirmVaciar}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Vaciar todos los mensajes?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminarán definitivamente todos los mensajes de <strong>{canal?.nombre}</strong>. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={vaciar} className="bg-destructive text-destructive-foreground">
                Vaciar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirmación: salir */}
        <AlertDialog open={confirmSalir} onOpenChange={setConfirmSalir}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Salir y eliminar el grupo?</AlertDialogTitle>
              <AlertDialogDescription>
                Saldrás del grupo <strong>{canal?.nombre}</strong> y se eliminará para todos sus miembros.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={salir} className="bg-destructive text-destructive-foreground">
                Salir del grupo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function EmpleadosCheckList({
  empleados, seleccion, onToggle,
}: {
  empleados: EmpleadoCanal[];
  seleccion: Set<string>;
  onToggle: (userId: string) => void;
}) {
  if (empleados.length === 0) {
    return (
      <div className="flex-1 rounded-md border bg-muted/20 flex items-center justify-center min-h-[180px]">
        <p className="text-xs text-muted-foreground">Sin empleados que coincidan.</p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto rounded-md border min-h-[180px]">
      {empleados.map((e) => {
        const checked = seleccion.has(e.userId);
        const inicialesEmp = `${e.nombre[0] ?? ""}${e.apellidos[0] ?? ""}`.toUpperCase();
        return (
          <button
            key={e.userId}
            type="button"
            onClick={() => onToggle(e.userId)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors border-b last:border-b-0",
              checked ? "bg-primary/5" : "hover:bg-muted/40",
            )}
          >
            <div
              className={cn(
                "h-5 w-5 shrink-0 rounded border flex items-center justify-center transition-colors",
                checked ? "bg-primary border-primary" : "bg-background border-input",
              )}
            >
              {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
            </div>
            <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground">
              {inicialesEmp || "—"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">
                {e.nombre} {e.apellidos}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {[e.rolLabel, e.departamento].filter(Boolean).join(" · ") || "Sin rol"}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DepartamentosCheckList({
  departamentos, seleccion, onToggle,
}: {
  departamentos: string[];
  seleccion: Set<string>;
  onToggle: (nombre: string) => void;
}) {
  if (departamentos.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 flex items-center justify-center min-h-[120px]">
        <p className="text-xs text-muted-foreground px-4 text-center">
          Aún no hay departamentos en el organigrama.
        </p>
      </div>
    );
  }
  return (
    <div className="max-h-[200px] overflow-y-auto rounded-md border">
      {departamentos.map((nombre) => {
        const checked = seleccion.has(nombre);
        return (
          <button
            key={nombre}
            type="button"
            onClick={() => onToggle(nombre)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors border-b last:border-b-0",
              checked ? "bg-primary/5" : "hover:bg-muted/40",
            )}
          >
            <div
              className={cn(
                "h-5 w-5 shrink-0 rounded border flex items-center justify-center transition-colors",
                checked ? "bg-primary border-primary" : "bg-background border-input",
              )}
            >
              {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
            </div>
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium truncate">{nombre}</span>
          </button>
        );
      })}
    </div>
  );
}

function SidebarSeccion({
  icon, label, hint, count, open, onToggle,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left px-4 pt-4 pb-1.5 sticky top-0 bg-background/95 backdrop-blur-sm z-[1] hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
          <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            {icon}
            {label}
          </p>
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground bg-muted/70 rounded-full px-2 py-0.5">
          {count}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground/80 ml-5">{hint}</p>
    </button>
  );
}

function CanalRow({
  canal, activo, pref, onClick, logoUrl, iniciales, colorEmpresa,
}: {
  canal: Canal;
  activo: boolean;
  pref: PrefCanal;
  onClick: () => void;
  logoUrl?: string;
  iniciales: string;
  colorEmpresa: string;
}) {
  const esDepto = canal.tipo === "departamento";
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50",
        activo ? "bg-primary/5" : "hover:bg-muted/40"
      )}
    >
      <GrupoAvatar logoUrl={logoUrl} iniciales={iniciales} color={colorEmpresa} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
            {canal.nombre}
            {esDepto && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {pref.silenciado && <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />}
          {pref.fijado && <Pin className="h-3 w-3 text-muted-foreground shrink-0" />}
          <p className="text-[12px] text-muted-foreground truncate">
            {canal.ultimoMensaje ?? "Sin mensajes todavía"}
          </p>
          {canal.sinLeer > 0 && (
            <Badge className="ml-auto h-5 px-1.5 text-[10px] bg-primary shrink-0">{canal.sinLeer}</Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function SettingRow({
  icon, label, description, checked, onChange,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function formatBytes(b: number): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function Adjunto({
  path, tipo, nombre, tamano, propio,
}: {
  path: string;
  tipo: "imagen" | "audio" | "archivo";
  nombre: string;
  tamano: number;
  propio: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let mounted = true;
    setCargando(true);
    getAdjuntoSignedUrl(path).then((res) => {
      if (!mounted) return;
      setUrl(res.url);
      setCargando(false);
    });
    return () => { mounted = false; };
  }, [path]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-2 opacity-70">
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    );
  }
  if (!url) {
    return <p className="text-[11px] italic opacity-70">Adjunto no disponible</p>;
  }

  if (tipo === "imagen") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mb-1">
        <img
          src={url}
          alt={nombre}
          className="max-h-72 rounded-lg object-cover"
        />
      </a>
    );
  }

  if (tipo === "audio") {
    return (
      <audio
        src={url}
        controls
        preload="metadata"
        className="my-1 block h-10 w-[230px] max-w-full"
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={nombre}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 mb-1 transition-colors",
        propio
          ? "bg-blue-700/40 hover:bg-blue-700/60 text-white"
          : "bg-muted hover:bg-muted/80 text-foreground",
      )}
    >
      <FileText className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate">{nombre}</p>
        <p className={cn("text-[10px]", propio ? "text-blue-100" : "text-muted-foreground")}>
          {formatBytes(tamano)}
        </p>
      </div>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}
