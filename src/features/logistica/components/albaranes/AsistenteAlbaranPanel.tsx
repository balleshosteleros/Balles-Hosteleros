"use client";

/**
 * Panel del asistente de verificación de un albarán subido por foto (estado "Revisión").
 * Muestra cada línea leída por la IA, empareja contra el catálogo, y deja resolver las que
 * no casan (vincular / crear / ignorar). Cuando no queda ninguna pendiente, permite
 * CONFIRMAR el albarán (a partir de ahí suma stock — decisión de Iván 2026-07-29).
 *
 * Es "controlado": recibe las líneas ya emparejadas por el servidor y devuelve las
 * resoluciones al padre, que persiste el albarán y llama a confirmar.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, EyeOff, AlertTriangle } from "lucide-react";
import { IndicadorPrecio } from "@/features/logistica/components/albaranes/IndicadorPrecio";
import {
  ResolverLineaDialog,
  type ResolucionLinea,
} from "@/features/logistica/components/albaranes/ResolverLineaDialog";
import {
  crearProductoDesdeAlbaran,
  memorizarAliasProveedor,
  type LineaEmparejada,
  type SugerenciaCandidato,
} from "@/features/logistica/actions/asistente-albaran-actions";

/** Estado de resolución de cada línea (por id). */
type EstadoLinea =
  | { estado: "ligada"; productoId: string; nombreProducto: string; precioVigente: number | null }
  | { estado: "ignorada" }
  | { estado: "pendiente" };

interface Props {
  lineas: LineaEmparejada[];
  proveedorAlbaran: string;
  categorias: string[];
  /** Se llama cuando el usuario confirma: devuelve la resolución final de cada línea. */
  onConfirmar: (
    resoluciones: Record<
      string,
      { productoId: string | null; ignorada: boolean }
    >,
  ) => Promise<void> | void;
  confirmando?: boolean;
}

export function AsistenteAlbaranPanel({
  lineas,
  proveedorAlbaran,
  categorias,
  onConfirmar,
  confirmando,
}: Props) {
  // Estado inicial: las que ligaron solas quedan "ligada"; el resto "pendiente".
  const [estados, setEstados] = useState<Record<string, EstadoLinea>>(() => {
    const init: Record<string, EstadoLinea> = {};
    for (const l of lineas) {
      init[l.id] = l.ligadoAuto
        ? {
            estado: "ligada",
            productoId: l.ligadoAuto.productoId,
            nombreProducto: l.ligadoAuto.nombre,
            precioVigente: l.ligadoAuto.precioVigente,
          }
        : { estado: "pendiente" };
    }
    return init;
  });
  const [dialogLinea, setDialogLinea] = useState<LineaEmparejada | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendientes = useMemo(
    () => lineas.filter((l) => estados[l.id]?.estado === "pendiente").length,
    [lineas, estados],
  );

  const setEstado = (id: string, e: EstadoLinea) =>
    setEstados((prev) => ({ ...prev, [id]: e }));

  const handleVincular = async (linea: LineaEmparejada, c: SugerenciaCandidato) => {
    setBusy(true);
    setError(null);
    try {
      // Memoriza el alias del proveedor para que el próximo albarán case solo.
      await memorizarAliasProveedor(c.productoId, linea.nombre);
      setEstado(linea.id, {
        estado: "ligada",
        productoId: c.productoId,
        nombreProducto: c.nombre,
        precioVigente: c.precioVigente,
      });
      setDialogLinea(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al vincular");
    } finally {
      setBusy(false);
    }
  };

  const handleCrear = async (
    linea: LineaEmparejada,
    datos: { nombre: string; categoria: string; proveedor: string; iva: string; precio: number },
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await crearProductoDesdeAlbaran({
        ...datos,
        nombreProveedor: linea.nombre,
      });
      if (!res.ok || !res.productoId) {
        setError(res.error ?? "No se pudo crear el producto");
        return;
      }
      setEstado(linea.id, {
        estado: "ligada",
        productoId: res.productoId,
        nombreProducto: datos.nombre,
        precioVigente: datos.precio,
      });
      setDialogLinea(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setBusy(false);
    }
  };

  const handleIgnorar = (linea: LineaEmparejada) => {
    setEstado(linea.id, { estado: "ignorada" });
    setDialogLinea(null);
  };

  const handleConfirmar = () => {
    const resoluciones: Record<string, { productoId: string | null; ignorada: boolean }> = {};
    for (const l of lineas) {
      const e = estados[l.id];
      if (e?.estado === "ligada") resoluciones[l.id] = { productoId: e.productoId, ignorada: false };
      else if (e?.estado === "ignorada") resoluciones[l.id] = { productoId: null, ignorada: true };
      else resoluciones[l.id] = { productoId: null, ignorada: false };
    }
    void onConfirmar(resoluciones);
  };

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{lineas.length} líneas</Badge>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">
          {lineas.length - pendientes} resueltas
        </Badge>
        {pendientes > 0 && (
          <Badge className="gap-1 bg-amber-100 text-amber-900 border-amber-200">
            <AlertTriangle className="h-3 w-3" /> {pendientes} por resolver
          </Badge>
        )}
      </div>

      {/* Tabla de líneas */}
      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left">Leído en el albarán</th>
              <th className="px-3 py-2 text-right">Cantidad</th>
              <th className="px-3 py-2 text-right">Precio</th>
              <th className="px-3 py-2 text-left">Producto</th>
              <th className="px-3 py-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const e = estados[l.id] ?? { estado: "pendiente" as const };
              return (
                <tr key={l.id} className="border-b">
                  <td className="px-3 py-2 font-medium">{l.nombre}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.cantidad}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1 justify-end">
                      {l.precioUnitario != null
                        ? `${String(l.precioUnitario).replace(".", ",")} €`
                        : "—"}
                      {e.estado === "ligada" && (
                        <IndicadorPrecio
                          precioLeido={l.precioUnitario}
                          precioVigente={e.precioVigente}
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {e.estado === "ligada" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {e.nombreProducto}
                      </span>
                    ) : e.estado === "ignorada" ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <EyeOff className="h-3.5 w-3.5" /> Ignorada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <Circle className="h-3.5 w-3.5" /> Sin resolver
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant={e.estado === "pendiente" ? "default" : "outline"}
                      className="h-7 px-2 text-[10px]"
                      onClick={() => setDialogLinea(l)}
                    >
                      {e.estado === "pendiente" ? "Resolver" : "Cambiar"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {/* Confirmar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {pendientes > 0
            ? "Resuelve todas las líneas (vincular, crear o ignorar) para poder confirmar."
            : "Todo listo. Al confirmar, el albarán suma stock."}
        </p>
        <Button
          onClick={handleConfirmar}
          disabled={pendientes > 0 || confirmando}
          className="gap-1"
        >
          <CheckCircle2 className="h-4 w-4" />
          {confirmando ? "Confirmando…" : "Confirmar albarán"}
        </Button>
      </div>

      {dialogLinea && (
        <ResolverLineaDialog
          open={!!dialogLinea}
          linea={dialogLinea}
          proveedorAlbaran={proveedorAlbaran}
          categorias={categorias}
          busy={busy}
          onClose={() => setDialogLinea(null)}
          onVincular={(c) => handleVincular(dialogLinea, c)}
          onCrear={(datos) => handleCrear(dialogLinea, datos)}
          onIgnorar={() => handleIgnorar(dialogLinea)}
        />
      )}
    </div>
  );
}

// Silencia el import de tipo no usado directamente (ResolucionLinea documenta el contrato).
export type { ResolucionLinea };
