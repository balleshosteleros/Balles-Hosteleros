"use client";

import { ReactNode, useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  MessageSquare, Send, Hash, Users, Plus, Search, Pin, Smile,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listCanales,
  listMensajes,
  sendMensaje,
  createCanal,
} from "@/features/comunicacion/actions/comunicacion-actions";

type Canal = {
  id: string;
  nombre: string;
  tipo: "departamento" | "grupo" | "directo";
  miembros: number;
  ultimoMensaje?: string;
  sinLeer: number;
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

const DEFAULT_CANALES = [
  { nombre: "General", tipo: "departamento" },
  { nombre: "Cocina", tipo: "departamento" },
  { nombre: "Sala", tipo: "departamento" },
  { nombre: "Gerencia", tipo: "departamento" },
  { nombre: "Logistica", tipo: "departamento" },
  { nombre: "Mantenimiento", tipo: "grupo" },
  { nombre: "Eventos y reservas", tipo: "grupo" },
];

function mapDbCanal(r: Record<string, unknown>): Canal {
  return {
    id: r.id as string,
    nombre: (r.nombre as string) ?? "",
    tipo: (r.tipo as Canal["tipo"]) ?? "grupo",
    miembros: (r.miembros as number) ?? 0,
    ultimoMensaje: (r.ultimo_mensaje as string) || undefined,
    sinLeer: (r.sin_leer as number) ?? 0,
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

export function ChatDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [canales, setCanales] = useState<Canal[]>([]);
  const [canalActivo, setCanalActivo] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargandoMsgs, setCargandoMsgs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canal = canales.find((c) => c.id === canalActivo) ?? null;
  const msgDelCanal = useMemo(
    () => (canalActivo ? mensajes.filter((m) => m.canalId === canalActivo) : []),
    [mensajes, canalActivo]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgDelCanal.length]);

  const canalesFiltrados = busqueda.trim()
    ? canales.filter((c) => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : canales;

  const totalSinLeer = canales.reduce((s, c) => s + c.sinLeer, 0);

  const cargarCanales = useCallback(async () => {
    try {
      setCargando(true);
      const res = await listCanales();
      if (!res.ok) return;
      let data = res.data as Record<string, unknown>[];
      if (data.length === 0) {
        for (const def of DEFAULT_CANALES) await createCanal(def.nombre, def.tipo);
        const retry = await listCanales();
        if (retry.ok) data = retry.data as Record<string, unknown>[];
      }
      const mapped = data.map(mapDbCanal);
      setCanales(mapped);
      if (mapped.length > 0 && !canalActivo) setCanalActivo(mapped[0].id);
    } catch {
      toast.error("Error al cargar canales");
    } finally {
      setCargando(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (open && canales.length === 0) cargarCanales();
  }, [open, canales.length, cargarCanales]);

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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div className="relative inline-flex">
          {children}
          {totalSinLeer > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-3.5 min-w-3.5 px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-bold leading-none pointer-events-none">
              {totalSinLeer > 9 ? "9+" : totalSinLeer}
            </span>
          )}
        </div>
      </SheetTrigger>

      <SheetContent side="right" className="w-full max-w-4xl flex flex-col gap-0 p-0 overflow-hidden">
        {/* Layout chat: sidebar de canales + área de mensajes */}
        <div className="flex h-full">
          {/* Sidebar canales */}
          <aside className="w-60 shrink-0 border-r bg-muted/20 flex flex-col">
            <div className="border-b p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  Comunicación
                </h2>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Nuevo canal">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="h-8 pl-9 text-xs"
                  placeholder="Buscar canal…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {cargando && (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">Cargando…</p>
              )}
              {["departamento", "grupo"].map((tipo) => {
                const lista = canalesFiltrados.filter((c) => c.tipo === tipo);
                if (!lista.length) return null;
                return (
                  <div key={tipo}>
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tipo === "departamento" ? "Departamentos" : "Grupos"}
                    </p>
                    {lista.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCanalActivo(c.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                          canalActivo === c.id
                            ? "bg-primary/10 font-semibold text-primary"
                            : "text-muted-foreground hover:bg-muted/70"
                        )}
                      >
                        <Hash className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 truncate">{c.nombre}</span>
                        {c.sinLeer > 0 && (
                          <Badge className="h-5 px-1.5 text-[10px] bg-primary">{c.sinLeer}</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Área de chat */}
          <div className="flex flex-1 flex-col min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-bold text-foreground">
                  {canal?.nombre ?? "Selecciona un canal"}
                </h2>
                {canal && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Users className="mr-1 h-3 w-3" /> {canal.miembros}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <Pin className="h-3.5 w-3.5" /> Fijados
              </Button>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
              {cargandoMsgs && (
                <div className="py-12 text-center text-sm text-muted-foreground">Cargando mensajes…</div>
              )}
              {!cargandoMsgs && msgDelCanal.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No hay mensajes en este canal.
                </div>
              )}
              {msgDelCanal.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex gap-3",
                    m.fijado && "bg-amber-50/50 -mx-2 px-2 py-1 rounded-lg dark:bg-amber-950/20"
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {m.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-foreground">{m.autor}</span>
                      <span className="text-[10px] text-muted-foreground">{m.fecha} {m.hora}</span>
                      {m.fijado && <Pin className="h-3 w-3 text-amber-500" />}
                    </div>
                    <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">{m.texto}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t p-3 shrink-0">
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                  <Smile className="h-4 w-4" />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && enviar()}
                  placeholder={`Escribe en #${canal?.nombre ?? "canal"}…`}
                  className="flex-1"
                />
                <Button
                  onClick={enviar}
                  disabled={!input.trim()}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
