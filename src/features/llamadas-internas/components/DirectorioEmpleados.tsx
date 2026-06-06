"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { listLlamables } from "@/features/llamadas-internas/actions/llamadas-actions";
import type { EmpleadoLlamable } from "@/features/llamadas-internas/types";
import { useLlamadas } from "@/features/llamadas-internas/components/LlamadasProvider";

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DirectorioEmpleados({ onIniciar }: { onIniciar?: () => void }) {
  const { iniciarLlamada, conectadosIds, enLlamada } = useLlamadas();
  const [items, setItems] = useState<EmpleadoLlamable[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    listLlamables().then((r) => {
      if (alive) {
        setItems(r.data);
        setCargando(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const ordenados = useMemo(() => {
    const txt = q.trim().toLowerCase();
    return items
      .filter((e) => !txt || e.nombreCompleto.toLowerCase().includes(txt))
      .sort((a, b) => {
        const ca = conectadosIds.has(a.userId) ? 0 : 1;
        const cb = conectadosIds.has(b.userId) ? 0 : 1;
        if (ca !== cb) return ca - cb;
        return a.nombreCompleto.localeCompare(b.nombreCompleto, "es");
      });
  }, [items, q, conectadosIds]);

  async function llamar(e: EmpleadoLlamable) {
    await iniciarLlamada(e);
    onIniciar?.();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar compañero…"
          className="pl-8"
        />
      </div>

      {cargando ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando compañeros…</p>
      ) : ordenados.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay compañeros para llamar.</p>
      ) : (
        <ul className="flex flex-col">
          {ordenados.map((e) => {
            const online = conectadosIds.has(e.userId);
            return (
              <li key={e.userId} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    {e.avatarUrl && <AvatarImage src={e.avatarUrl} alt={e.nombreCompleto} />}
                    <AvatarFallback>{iniciales(e.nombreCompleto)}</AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                      online ? "bg-green-500" : "bg-muted-foreground/40"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.nombreCompleto}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {online ? "Disponible" : "Desconectado"}
                    {e.departamento ? ` · ${e.departamento}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void llamar(e)}
                  disabled={enLlamada}
                  aria-label={`Llamar a ${e.nombreCompleto}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-white transition active:scale-95 disabled:opacity-40"
                >
                  <Phone className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
