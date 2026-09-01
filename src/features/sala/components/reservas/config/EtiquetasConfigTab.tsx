"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { CategoriaEtiquetasCard } from "./CategoriaEtiquetasCard";
import {
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
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    const [c, e] = await Promise.all([
      listEtiquetaCategorias(),
      listEtiquetas(),
    ]);
    if (c.ok) setCategorias(c.data);
    if (e.ok) setEtiquetas(e.data);
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

  /**
   * Etiquetas heredadas sin grupo (de cuando los grupos eran borrables). Se
   * listan aparte para poder reubicarlas o borrarlas; con los grupos fijos ya
   * no se generan nuevas.
   */
  const sueltas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return etiquetas
      .filter((e) => e.scope === scope && e.categoriaId === null)
      .filter((e) => !q || e.nombre.toLowerCase().includes(q));
  }, [etiquetas, scope, busqueda]);

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
          Los grupos son fijos: clasifican reservas y clientes de fábrica y no
          se crean, renombran ni borran. Dentro de cada uno puedes añadir tus
          propias etiquetas y editarlas.
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
      </div>

      <div className="space-y-2.5">
        {catsFiltradas.length === 0 && sueltas.length === 0 && (
          <div className="border border-dashed rounded-md p-6 text-center text-xs text-muted-foreground">
            {busqueda
              ? "Sin resultados para la búsqueda."
              : `Sin grupos de ${scopeActual.label.toLowerCase()}.`}
          </div>
        )}
        {catsFiltradas.map((cat) => (
          <CategoriaEtiquetasCard
            key={cat.id}
            categoria={cat}
            etiquetas={etiquetasDe(cat.id)}
            categorias={categorias.filter((c) => c.scope === scope)}
            onChange={cargar}
          />
        ))}
        {sueltas.length > 0 && (
          <CategoriaEtiquetasCard
            categoria={null}
            scope={scope}
            etiquetas={sueltas}
            categorias={categorias.filter((c) => c.scope === scope)}
            onChange={cargar}
          />
        )}
      </div>
    </div>
  );
}
