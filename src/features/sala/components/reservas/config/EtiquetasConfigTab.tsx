"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { CategoriaEtiquetasCard } from "./CategoriaEtiquetasCard";
import { TiposReservaList } from "./TiposReservaList";
import { Separator } from "@/components/ui/separator";
import { listReservaTipos } from "@/features/sala/actions/reserva-tipos-actions";
import type { ReservaTipo } from "@/features/sala/data/reservas";
import {
  createEtiquetaCategoria,
  listEtiquetaCategorias,
  listEtiquetas,
  type Etiqueta,
  type EtiquetaCategoria,
  type EtiquetaScope,
} from "@/features/sala/actions/sala-etiquetas-actions";

const SCOPES: { value: EtiquetaScope; label: string; hint: string }[] = [
  {
    value: "reserva",
    label: "Reservas",
    hint: "Etiqueta exclusiva de UNA reserva (no se propaga al cliente).",
  },
  {
    value: "cliente",
    label: "Clientes",
    hint: "Etiqueta del cliente — se autoaplica a todas sus reservas futuras.",
  },
];

export function EtiquetasConfigTab() {
  const [scope, setScope] = useState<EtiquetaScope>("reserva");
  const [categorias, setCategorias] = useState<EtiquetaCategoria[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [tipos, setTipos] = useState<ReservaTipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    const [c, e, t] = await Promise.all([
      listEtiquetaCategorias(),
      listEtiquetas(),
      listReservaTipos(),
    ]);
    if (c.ok) setCategorias(c.data);
    if (e.ok) setEtiquetas(e.data);
    if (t.ok) setTipos(t.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const catsFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return categorias
      .filter((c) => c.scope === scope)
      .filter((c) => {
        if (!q) return true;
        if (c.nombre.toLowerCase().includes(q)) return true;
        return etiquetas.some(
          (e) => e.categoriaId === c.id && e.nombre.toLowerCase().includes(q),
        );
      });
  }, [categorias, etiquetas, scope, busqueda]);

  function etiquetasDe(catId: string): Etiqueta[] {
    const q = busqueda.trim().toLowerCase();
    return etiquetas
      .filter((e) => e.categoriaId === catId)
      .filter((e) => !q || e.nombre.toLowerCase().includes(q));
  }

  async function handleCrearCategoria() {
    const nombre = window.prompt("Nombre de la categoría:");
    if (!nombre?.trim()) return;
    const res = await createEtiquetaCategoria({
      scope,
      nombre: nombre.trim(),
      orden: catsFiltradas.length + 1,
    });
    if (!res.ok) toast.error(res.error ?? "No se pudo crear");
    else {
      toast.success("Categoría creada");
      cargar();
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const scopeActual = SCOPES.find((s) => s.value === scope)!;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Organiza etiquetas en categorías para clasificar reservas y clientes.
          Las del sistema vienen predefinidas y no se pueden borrar (solo
          desactivar). Crea las tuyas propias libremente.
        </p>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as EtiquetaScope)}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          {SCOPES.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {SCOPES.map((s) => (
          <TabsContent key={s.value} value={s.value} className="mt-3 space-y-3">
            <p className="text-[11px] text-muted-foreground -mt-1 italic">{s.hint}</p>
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar categorías o etiquetas…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-8 pl-7"
          />
        </div>
        <Button size="sm" onClick={handleCrearCategoria}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Categoría
        </Button>
      </div>

      <div className="space-y-2.5">
        {catsFiltradas.length === 0 && (
          <div className="border border-dashed rounded-md p-6 text-center text-xs text-muted-foreground">
            {busqueda
              ? "Sin resultados para la búsqueda."
              : `Sin categorías de ${scopeActual.label.toLowerCase()}. Crea una arriba.`}
          </div>
        )}
        {catsFiltradas.map((cat) => (
          <CategoriaEtiquetasCard
            key={cat.id}
            categoria={cat}
            etiquetas={etiquetasDe(cat.id)}
            onChange={cargar}
          />
        ))}
      </div>

      <Separator />

      <TiposReservaList tipos={tipos} onChange={cargar} />
    </div>
  );
}
