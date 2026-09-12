"use client";

/**
 * Panel de "se ha acabado": todo el catálogo de venta, por categorías, con un
 * toque para apagar y otro para volver a encender.
 *
 * Pensado para usarse de pie y con prisa: se marca lo que falte —uno o diez— y
 * se pulsa Guardar una vez. Antes cada toque era una llamada al servidor y el
 * panel se quedaba esperando entre pulsaciones.
 *
 * EN MÓVIL VA A PANTALLA COMPLETA Y FIJO. El diálogo normal se centra con
 * porcentajes (`top-50% translate-y-[-50%]`) y trae su propio scroll: al abrir
 * el teclado del buscador la pantalla se recalculaba y el panel entero saltaba
 * de sitio (Iván, 12-sep). Aquí se ancla a los cuatro bordes, el contenedor no
 * hace scroll (`overflow-hidden`) y el único que se mueve es la lista.
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
import { Button } from "@/shared/components/ui/button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import {
  guardarApagadosProductos,
  listarProductosApagables,
  type CategoriaApagable,
} from "../actions/apagados-actions";
import { HORAS_APAGADO_DEFAULT } from "../lib/caducidad";

export function ApagadosPanel({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const [categorias, setCategorias] = useState<CategoriaApagable[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  /** Lo tocado desde que se abrió: `id → apagado`. Vacío = nada que guardar. */
  const [cambios, setCambios] = useState<Map<string, boolean>>(new Map());
  const [horas, setHoras] = useState(HORAS_APAGADO_DEFAULT);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    (async () => {
      setCargando(true);
      setCambios(new Map());
      setBusqueda("");
      const res = await listarProductosApagables();
      if (cancelado) return;
      if (res.ok) {
        setCategorias(res.data.categorias);
        setHoras(res.data.horas);
      } else toast.error(res.error);
      setCargando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [abierto]);

  /** Estado que se ve: lo guardado, con lo tocado encima. */
  const estaApagado = (id: string, guardado: boolean) => cambios.get(id) ?? guardado;

  const apagados = useMemo(
    () =>
      categorias
        .flatMap((c) => c.productos)
        .filter((p) => estaApagado(p.id, p.apagado)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categorias, cambios],
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

  function alternar(id: string, guardado: boolean) {
    setCambios((prev) => {
      const next = new Map(prev);
      const deseado = !estaApagado(id, guardado);
      // Volver al valor que ya estaba guardado no es un cambio: se retira de
      // la lista para que el contador diga la verdad.
      if (deseado === guardado) next.delete(id);
      else next.set(id, deseado);
      return next;
    });
  }

  async function guardar() {
    if (cambios.size === 0) {
      onCerrar();
      return;
    }
    setGuardando(true);
    const res = await guardarApagadosProductos(
      Array.from(cambios, ([id, apagado]) => ({ id, apagado })),
    );
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      cambios.size === 1 ? "Producto actualizado" : `${cambios.size} productos actualizados`,
    );
    onCerrar();
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent
        className={cn(
          // Móvil: anclado a los cuatro bordes, sin centrado por porcentajes y
          // sin scroll propio. Escritorio: diálogo normal, alto fijo.
          "flex flex-col gap-0 overflow-hidden p-0",
          "max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh]",
          "max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
          "sm:h-[86vh] sm:max-h-[86vh] sm:max-w-3xl",
        )}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <DialogTitle className="text-base">Apagar productos</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Marca lo que se haya acabado y pulsa Guardar. Sale como agotado en la carta y no se
            puede vender. Vuelve solo a las {horas} h.
          </p>
        </DialogHeader>

        <div className="shrink-0 border-b px-5 py-3">
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
                ? "1 producto apagado"
                : `${apagados.length} productos apagados`}
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
          // El ÚNICO scroll del panel. `overscroll-contain` evita que al llegar
          // al final el gesto arrastre la página de detrás.
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {filtradas.map((cat) => (
              <section key={cat.nombre} className="mb-6 last:mb-0">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {cat.nombre}
                </h3>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {cat.productos.map((p) => {
                    const apagado = estaApagado(p.id, p.apagado);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => alternar(p.id, p.apagado)}
                        aria-pressed={apagado}
                        className={cn(
                          "flex h-12 items-center justify-between gap-3 rounded-lg border px-3 text-left transition-colors",
                          apagado
                            ? "border-amber-300 bg-amber-50 text-amber-900"
                            : "bg-background hover:bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "truncate text-sm",
                            apagado && "line-through decoration-amber-500/70",
                          )}
                        >
                          {p.nombre}
                        </span>
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                            apagado
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-muted-foreground/30",
                          )}
                        >
                          {apagado ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4 opacity-25" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Pie fijo: en móvil deja hueco para la barra del sistema. */}
        <div className="shrink-0 border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {cambios.size === 0
                ? "Sin cambios"
                : cambios.size === 1
                  ? "1 cambio sin guardar"
                  : `${cambios.size} cambios sin guardar`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCerrar} disabled={guardando}>
                Cancelar
              </Button>
              <Button variant="primary" size="lg" onClick={() => void guardar()} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
