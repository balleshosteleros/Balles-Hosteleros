"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { CategoriaEtiquetasCard } from "./CategoriaEtiquetasCard";
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
  const [dialogCategoria, setDialogCategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [creandoCategoria, setCreandoCategoria] = useState(false);
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
   * Etiquetas que quedaron huérfanas al borrar su grupo. Se listan aparte para
   * poder editarlas, borrarlas o devolverlas a un grupo: si no, seguirían
   * asignables en las fichas pero serían invisibles aquí.
   */
  const sueltas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return etiquetas
      .filter((e) => e.scope === scope && e.categoriaId === null)
      .filter((e) => !q || e.nombre.toLowerCase().includes(q));
  }, [etiquetas, scope, busqueda]);

  async function handleCrearCategoria() {
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    setCreandoCategoria(true);
    // El orden se calcula sobre TODAS las categorías del scope, no sobre las
    // filtradas por la búsqueda: si no, con un filtro activo la nueva categoría
    // nacía con un orden ya ocupado.
    const orden = categorias.filter((c) => c.scope === scope).length + 1;
    const res = await createEtiquetaCategoria({ scope, nombre, orden });
    setCreandoCategoria(false);
    if (!res.ok) toast.error(res.error ?? "No se pudo crear");
    else {
      toast.success("Categoría creada");
      setNuevaCategoria("");
      setDialogCategoria(false);
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
          Organiza etiquetas en grupos para clasificar reservas y clientes. Las
          predefinidas vienen de fábrica, pero puedes renombrarlas, editarlas o
          borrarlas igual que las tuyas.
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
        <Button size="sm" onClick={() => { setNuevaCategoria(""); setDialogCategoria(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Categoría
        </Button>
      </div>

      <Dialog open={dialogCategoria} onOpenChange={setDialogCategoria}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre</Label>
            <Input
              autoFocus
              className="h-8 text-xs"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nuevaCategoria.trim() && !creandoCategoria) {
                  handleCrearCategoria();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogCategoria(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCrearCategoria}
              disabled={!nuevaCategoria.trim() || creandoCategoria}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2.5">
        {catsFiltradas.length === 0 && sueltas.length === 0 && (
          <div className="border border-dashed rounded-md p-6 text-center text-xs text-muted-foreground">
            {busqueda
              ? "Sin resultados para la búsqueda."
              : `Sin grupos de ${scopeActual.label.toLowerCase()}. Crea uno arriba.`}
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
