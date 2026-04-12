"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Hash,
  Users,
  Plus,
  Search,
  Pin,
  Smile,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const CANALES: Canal[] = [
  { id: "general", nombre: "General", tipo: "departamento", miembros: 24, ultimoMensaje: "Buenos días a todos", sinLeer: 3 },
  { id: "cocina", nombre: "Cocina", tipo: "departamento", miembros: 8, ultimoMensaje: "El pedido de pescado llega a las 7", sinLeer: 0 },
  { id: "sala", nombre: "Sala", tipo: "departamento", miembros: 12, ultimoMensaje: "Mesa 8 alérgico a frutos secos", sinLeer: 1 },
  { id: "gerencia", nombre: "Gerencia", tipo: "departamento", miembros: 4, ultimoMensaje: "Ratios de esta semana actualizados", sinLeer: 0 },
  { id: "logistica", nombre: "Logística", tipo: "departamento", miembros: 5, ultimoMensaje: "Aceite de oliva subió un 14%", sinLeer: 2 },
  { id: "mantenimiento", nombre: "Mantenimiento", tipo: "grupo", miembros: 3, ultimoMensaje: "Frigorífico reparado", sinLeer: 0 },
  { id: "eventos", nombre: "Eventos y reservas", tipo: "grupo", miembros: 6, ultimoMensaje: "Reserva grupo 20 personas sábado", sinLeer: 1 },
];

const MENSAJES_SEED: Mensaje[] = [
  { id: "m1", canalId: "general", autor: "Iván", avatar: "IB", texto: "Buenos días a todos. Recordad que hoy tenemos cata de nuevos platos a las 12:00 en sala.", fecha: "Hoy", hora: "08:15", fijado: true },
  { id: "m2", canalId: "general", autor: "Marta", avatar: "MG", texto: "¡Buenos días! Allí estaré.", fecha: "Hoy", hora: "08:22", fijado: false },
  { id: "m3", canalId: "general", autor: "Pablo", avatar: "PE", texto: "Perfecto. ¿Llevo algo preparado o vamos a probar directamente?", fecha: "Hoy", hora: "08:30", fijado: false },
  { id: "m4", canalId: "cocina", autor: "Chef", avatar: "CH", texto: "El pedido de pescado llega a las 7. Necesito a alguien para recepcionarlo.", fecha: "Hoy", hora: "06:45", fijado: false },
  { id: "m5", canalId: "sala", autor: "Laura", avatar: "LR", texto: "Mesa 8 alérgico a frutos secos. Avisar a cocina antes de servir.", fecha: "Hoy", hora: "13:10", fijado: true },
  { id: "m6", canalId: "logistica", autor: "Iván", avatar: "IB", texto: "Aceite de oliva 5L subió de 28€ a 32€. Ya lo registré en Incidencias.", fecha: "Hoy", hora: "10:00", fijado: false },
];

export function ComunicacionView() {
  const [canalActivo, setCanalActivo] = useState("general");
  const [mensajes, setMensajes] = useState<Mensaje[]>(MENSAJES_SEED);
  const [input, setInput] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const canal = CANALES.find((c) => c.id === canalActivo)!;
  const msgDelCanal = useMemo(
    () => mensajes.filter((m) => m.canalId === canalActivo),
    [mensajes, canalActivo],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgDelCanal.length]);

  const canalesFiltrados = busqueda.trim()
    ? CANALES.filter((c) =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()),
      )
    : CANALES;

  function enviar() {
    if (!input.trim()) return;
    const nuevo: Mensaje = {
      id: `m-${Date.now()}`,
      canalId: canalActivo,
      autor: "Tú",
      avatar: "TU",
      texto: input.trim(),
      fecha: "Hoy",
      hora: new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      fijado: false,
    };
    setMensajes((prev) => [...prev, nuevo]);
    setInput("");
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar canales */}
      <aside className="w-64 shrink-0 border-r bg-muted/20 flex flex-col">
        <div className="border-b p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
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
                        : "text-muted-foreground hover:bg-muted/70",
                    )}
                  >
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate">{c.nombre}</span>
                    {c.sinLeer > 0 && (
                      <Badge className="h-5 px-1.5 text-[10px] bg-primary">
                        {c.sinLeer}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Chat */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header canal */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-bold text-foreground">
              {canal.nombre}
            </h2>
            <Badge variant="secondary" className="text-[10px]">
              <Users className="mr-1 h-3 w-3" /> {canal.miembros}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <Pin className="h-3.5 w-3.5" /> Fijados
          </Button>
        </div>

        {/* Mensajes */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {msgDelCanal.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex gap-3",
                m.fijado && "bg-amber-50/50 -mx-2 px-2 py-1 rounded-lg dark:bg-amber-950/20",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {m.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {m.autor}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {m.fecha} {m.hora}
                  </span>
                  {m.fijado && (
                    <Pin className="h-3 w-3 text-amber-500" />
                  )}
                </div>
                <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">
                  {m.texto}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <Smile className="h-4 w-4" />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              placeholder={`Escribe en #${canal.nombre}…`}
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
  );
}
