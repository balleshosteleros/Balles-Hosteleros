"use client";

/**
 * Panel de "se ha acabado": todo el catálogo de venta, por categorías, con un
 * toque para apagar y otro para volver a encender.
 *
 * Pensado para usarse de pie y con prisa: filas altas, una sola pulsación por
 * producto, sin guardar ni confirmar. Lo apagado sube arriba del todo, que es
 * lo que cocina quiere repasar antes de abrir.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import {
  alternarApagadoProducto,
  listarProductosApagables,
  type CategoriaApagable,
} from "../actions/apagados-actions";

export function ApagadosPanel({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const [categorias, setCategorias] = useState<CategoriaApagable[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    (async () => {
      setCargando(true);
      const res = await listarProductosApagables();
      if (cancelado) return;
      if (res.ok) setCategorias(res.data);
      else toast.error(res.error);
      setCargando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [abierto]);

  const apagados = useMemo(
    () => categorias.flatMap((c) => c.productos).filter((p) => p.apagado),
    [categorias],
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return categorias;
    return categorias
      .map((c) => ({
        ...c,
        productos: c.productos.filter(
          (p) => p.nombre.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.productos.length > 0);
  }, [categorias, busqueda]);

  /**
   * Se pinta ANTES de que conteste el servidor y se deshace si falla: en plena
   * comanda, esperar medio segundo a que un botón responda hace que se pulse
   * dos veces y acabe encendido lo que se quería apagar.
   */
  async function alternar(productoId: string, apagar: boolean) {
    setCategorias((prev) =>
      prev.map((c) => ({
        ...c,
        productos: c.productos.map((p) => (p.id === productoId ? { ...p, apagado: apagar } : p)),
      })),
    );
    const res = await alternarApagadoProducto(productoId, apagar);
    if (!res.ok) {
      toast.error(res.error);
      setCategorias((prev) =>
        prev.map((c) => ({
          ...c,
          productos: c.productos.map((p) =>
            p.id === productoId ? { ...p, apagado: !apagar } : p,
          ),
        })),
      );
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="flex h-[86vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base">Apagar productos</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Lo que apagues sale como agotado en la carta y no se puede vender. Se enciende
            solo mañana.
          </p>
        </DialogHeader>

        <div className="border-b px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar"
              className="h-11 pl-9"
            />
          </div>
          {apagados.length > 0 ? (
            <p className="mt-3 text-xs font-medium text-amber-600">
              {apagados.length === 1
                ? "1 producto apagado hoy"
                : `${apagados.length} productos apagados hoy`}
              : {apagados.map((p) => p.nombre).join(", ")}
            </p>
          ) : null}
        </div>

        {cargando ? (
          <LoadingSpinner className="flex-1" size="lg" />
        ) : filtradas.length === 0 ? (
          <p className="flex-1 px-5 py-10 text-center text-sm text-muted-foreground">
            {busqueda ? "Ningún producto con ese nombre." : "No hay productos de venta."}
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {filtradas.map((cat) => (
              <section key={cat.nombre} className="mb-6 last:mb-0">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {cat.nombre}
                </h3>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {cat.productos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => void alternar(p.id, !p.apagado)}
                      aria-pressed={p.apagado}
                      className={cn(
                        "flex h-12 items-center justify-between gap-3 rounded-lg border px-3 text-left transition-colors",
                        p.apagado
                          ? "border-amber-300 bg-amber-50 text-amber-900"
                          : "bg-background hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "truncate text-sm",
                          p.apagado && "line-through decoration-amber-500/70",
                        )}
                      >
                        {p.nombre}
                      </span>
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                          p.apagado
                            ? "border-amber-500 bg-amber-500 text-white"
                            : "border-muted-foreground/30",
                        )}
                      >
                        {p.apagado ? <X className="h-4 w-4" /> : <Check className="h-4 w-4 opacity-25" />}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
