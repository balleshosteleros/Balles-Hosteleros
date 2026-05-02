"use client";

import { ReactNode, useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  MessageSquare, Send, Users, Plus, Search, Pin, Smile, MoreVertical,
  BellOff, Bell, Pencil, Trash2, LogOut, Lock, ChevronLeft,
  ShieldCheck, Eraser, Hourglass, X, Paperclip, Mic, Building2, Briefcase, Check,
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
  listEmpleadosEmpresa,
  purgeCanalesObsoletos,
  type EmpleadoCanal,
} from "@/features/comunicacion/actions/comunicacion-actions";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getOrganigrama } from "@/features/direccion/actions/organigrama-actions";
import { orgChartsPorEmpresa } from "@/features/direccion/data/direccion";

type Canal = {
  id: string;
  nombre: string;
  tipo: "departamento" | "asunto" | "grupo" | "directo";
  miembros: number;
  miembrosUserIds: string[];
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
};

type PrefCanal = { silenciado: boolean; fijado: boolean };
const PREF_DEFAULT: PrefCanal = { silenciado: false, fijado: false };

// Los grupos por defecto se derivan del organigrama de la empresa:
// 1 grupo por cada bloque del organigrama (excepto los nodos del área "externo", p.ej. SOCIOS).
async function getDepartamentosDelOrganigrama(empresaId: string): Promise<string[]> {
  let chart = await getOrganigrama(empresaId);
  if (!chart || chart.nodes.length === 0) {
    chart = orgChartsPorEmpresa[empresaId] ?? orgChartsPorEmpresa.habana;
  }
  const labels = chart.nodes
    .filter((n) => n.area !== "externo")
    .map((n) => n.label.trim().toUpperCase())
    .filter((l) => l.length > 0);
  return Array.from(new Set(labels));
}

function mapDbCanal(r: Record<string, unknown>): Canal {
  const miembrosArr = Array.isArray(r.miembros_user_ids)
    ? (r.miembros_user_ids as string[])
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
    ultimoMensaje: (r.ultimo_mensaje as string) || undefined,
    sinLeer: (r.sin_leer as number) ?? 0,
    descripcion: (r.descripcion as string) || undefined,
    soloAdminsEnvian: (r.solo_admins_envian as boolean) ?? false,
    bloquearAjustes: (r.bloquear_ajustes as boolean) ?? false,
    mensajesEfimerosDias: (r.mensajes_efimeros_dias as number | null) ?? null,
  };
}

function mapDbMensaje(r: Record<string, unknown>): Mensaje {
  const createdAt = r.created_at ? new Date(r.created_at as string) : new Date();
  const hoy = new Date();
  const esHoy = createdAt.toDateString() === hoy.toDateString();
  const nombre = (r.autor_nombre as string) ?? "Anon";
  const iniciales = nombre.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return {
    id: r.id as string,
    canalId: (r.canal_id as string) ?? "",
    autor: nombre,
    avatar: iniciales,
    texto: (r.texto as string) ?? "",
    fecha: esHoy ? "Hoy" : createdAt.toLocaleDateString("es-ES"),
    hora: createdAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    fijado: (r.fijado as boolean) ?? false,
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
  const { empresaActual, getLogoUrl } = useEmpresa();
  const logoUrl = getLogoUrl(empresaActual.id);

  const [open, setOpen] = useState(false);
  const [canales, setCanales] = useState<Canal[]>([]);
  const [canalActivo, setCanalActivo] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargandoMsgs, setCargandoMsgs] = useState(false);
  const [prefsMap, setPrefsMap] = useState<Record<string, PrefCanal>>({});

  const [dlgNuevo, setDlgNuevo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [miembrosNuevo, setMiembrosNuevo] = useState<Set<string>>(new Set());
  const [dlgAjustes, setDlgAjustes] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreEdit, setNombreEdit] = useState("");
  const [confirmVaciar, setConfirmVaciar] = useState(false);
  const [confirmSalir, setConfirmSalir] = useState(false);
  const [empleados, setEmpleados] = useState<EmpleadoCanal[]>([]);
  const [busquedaEmpleados, setBusquedaEmpleados] = useState("");
  const [dlgMiembros, setDlgMiembros] = useState(false);
  const [miembrosEdit, setMiembrosEdit] = useState<Set<string>>(new Set());

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
    try {
      setCargando(true);
      const departamentos = await getDepartamentosDelOrganigrama(empresaActual.id);

      // 1. Purgar grupos obsoletos (legacy, BACANAL prefijado, etc.) preservando 'asunto'
      await purgeCanalesObsoletos(departamentos);

      // 2. Releer y crear los que falten
      const res = await listCanales();
      if (!res.ok) return;
      let data = res.data as Record<string, unknown>[];

      const existentes = new Set(
        data.map((d) => String(d.nombre ?? "").trim().toUpperCase())
      );
      const faltantes = departamentos.filter((nombre) => !existentes.has(nombre));
      if (faltantes.length > 0) {
        await Promise.all(faltantes.map((nombre) => createCanal(nombre, "departamento")));
        const retry = await listCanales();
        if (retry.ok) data = retry.data as Record<string, unknown>[];
      }

      const mapped = data.map(mapDbCanal);
      setCanales(mapped);
    } catch {
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
    if (miembrosNuevo.size === 0) {
      toast.error("Selecciona al menos un miembro");
      return;
    }
    try {
      const res = await createCanal(limpio, "asunto", Array.from(miembrosNuevo));
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
      setBusquedaEmpleados("");
      toast.success("Asunto creado");
    } catch {
      toast.error("No se pudo crear el asunto");
    }
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

  const iniciales = empresaActual.iniciales;
  const colorEmpresa = empresaActual.color;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>

      <SheetContent
        side="right"
        className="w-screen max-w-none flex flex-col gap-0 p-0 sm:max-w-none [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Comunicación interna</SheetTitle>

        {/* Top bar global */}
        <header className="flex items-center justify-between border-b px-4 py-2 shrink-0 bg-background">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-blue-600" />
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
              {cargando && (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">Cargando…</p>
              )}

              {!cargando && (
                <>
                  <SidebarSeccion
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    label="Departamentos"
                    hint="De serie · no editables"
                  />
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

                  <SidebarSeccion
                    icon={<Briefcase className="h-3.5 w-3.5" />}
                    label="Asuntos"
                    hint="Manuales · tú eliges miembros"
                  />
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
            </div>

            {/* Botón crear asunto */}
            <div className="p-3 border-t shrink-0">
              <Button
                onClick={() => { setNombreNuevo(""); setMiembrosNuevo(new Set()); setBusquedaEmpleados(""); setDlgNuevo(true); }}
                className="w-full gap-2 rounded-full h-12 text-sm font-semibold shadow-sm"
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
                  {cargandoMsgs && (
                    <div className="py-12 text-center text-sm text-muted-foreground">Cargando mensajes…</div>
                  )}
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
                          <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
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
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                      <Smile className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                      <Paperclip className="h-5 w-5" />
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
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                        <Mic className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
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
                Crea un grupo manual con el título y los miembros que tú elijas. El icono se fija al de la empresa.
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
              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Miembros ({miembrosNuevo.size})
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
              <Button onClick={crearAsunto} disabled={!nombreNuevo.trim() || miembrosNuevo.size === 0}>
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

function SidebarSeccion({
  icon, label, hint,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <div className="px-4 pt-4 pb-1.5 sticky top-0 bg-background/95 backdrop-blur-sm z-[1]">
      <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="text-[10px] text-muted-foreground/80">{hint}</p>
    </div>
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
