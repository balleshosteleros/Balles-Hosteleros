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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Circle, EyeOff, AlertTriangle } from "lucide-react";
import { formatNumero } from "@/shared/lib/numero";
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
  /** El motivo es obligatorio (PRP-074 F4): nada queda fuera en silencio. */
  | { estado: "ignorada"; motivo: string }
  | { estado: "pendiente" };

interface Props {
  lineas: LineaEmparejada[];
  /**
   * Líneas que YA venían vinculadas del paso de subida (con productoId en el albarán).
   * No pasan por el asistente, pero también entran al almacén al confirmar: sin ellas el
   * resumen de "Antes de confirmar" contaba solo las resueltas aquí (decía "0 productos"
   * moviendo 9 — cazado en el piloto del 07-ago-2026).
   */
  lineasYaVinculadas?: Array<{ nombre: string; cantidad: number; precioUnitario: number | null }>;
  /**
   * Líneas cuya decisión en la mesa de incidencias fue "crear producto nuevo"
   * (por id de línea, con el IVA leído si venía). La mesa no puede crear el producto
   * (falta la categoría), así que aquí el diálogo abre directo en el formulario de
   * crear en vez de hacer rehacer la decisión desde cero.
   */
  intencionesCrear?: Record<string, { iva?: string | null }>;
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
  /**
   * Autosave (F5): se llama tras CADA resolución (vincular/crear/ignorar) para que el
   * padre la persista al vuelo. Sin esto, una recarga a mitad de revisión perdía todo
   * el trabajo no confirmado (caso real del piloto 07-ago-2026).
   */
  onResolucion?: (
    lineaId: string,
    res: { productoId: string | null; ignorada: boolean; motivoIgnorada?: string },
  ) => void;
}

export function AsistenteAlbaranPanel({
  lineas,
  lineasYaVinculadas = [],
  intencionesCrear = {},
  proveedorAlbaran,
  categorias,
  onConfirmar,
  confirmando,
  onResolucion,
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
  // PRP-074 F5 — el resumen previo: confirmar deja de ser un salto al vacío.
  const [mostrarResumen, setMostrarResumen] = useState(false);

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
      onResolucion?.(linea.id, { productoId: c.productoId, ignorada: false });
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
      onResolucion?.(linea.id, { productoId: res.productoId, ignorada: false });
      setDialogLinea(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setBusy(false);
    }
  };

  const handleIgnorar = (linea: LineaEmparejada, motivo: string) => {
    setEstado(linea.id, { estado: "ignorada", motivo });
    onResolucion?.(linea.id, { productoId: null, ignorada: true, motivoIgnorada: motivo });
    setDialogLinea(null);
  };

  /**
   * PRP-074 F5 — antes se confirmaba a ciegas: el usuario no sabía qué stock iba a
   * entrar ni qué precios se iban a registrar. Ahora se muestra el resumen y solo
   * entonces se ejecuta la transacción.
   */
  const resumen = useMemo(() => {
    const entran: Array<{ nombre: string; cantidad: number }> = [];
    const omitidas: Array<{ nombre: string; motivo: string }> = [];
    let importeEntrante = 0;

    for (const l of lineasYaVinculadas) {
      entran.push({ nombre: l.nombre, cantidad: l.cantidad });
      importeEntrante += (l.precioUnitario ?? 0) * l.cantidad;
    }
    for (const l of lineas) {
      const e = estados[l.id];
      if (e?.estado === "ligada") {
        entran.push({ nombre: e.nombreProducto, cantidad: l.cantidad });
        importeEntrante += (l.precioUnitario ?? 0) * l.cantidad;
      } else if (e?.estado === "ignorada") {
        omitidas.push({ nombre: l.nombre, motivo: e.motivo });
      }
    }
    return { entran, omitidas, importeEntrante };
  }, [lineas, lineasYaVinculadas, estados]);

  const handleConfirmar = () => {
    const resoluciones: Record<
      string,
      { productoId: string | null; ignorada: boolean; motivoIgnorada?: string }
    > = {};
    for (const l of lineas) {
      const e = estados[l.id];
      if (e?.estado === "ligada") resoluciones[l.id] = { productoId: e.productoId, ignorada: false };
      else if (e?.estado === "ignorada")
        resoluciones[l.id] = { productoId: null, ignorada: true, motivoIgnorada: e.motivo };
      else resoluciones[l.id] = { productoId: null, ignorada: false };
    }
    setMostrarResumen(false);
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
                        {e.motivo && (
                          <span className="italic">— {e.motivo}</span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <Circle className="h-3.5 w-3.5" /> Sin resolver
                        {intencionesCrear[l.id] && (
                          <span className="italic text-muted-foreground">
                            — elegiste crearlo en la subida
                          </span>
                        )}
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
                      {e.estado === "pendiente"
                        ? intencionesCrear[l.id]
                          ? "Crear"
                          : "Resolver"
                        : "Cambiar"}
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
          onClick={() => setMostrarResumen(true)}
          disabled={pendientes > 0 || confirmando}
          className="gap-1"
        >
          <CheckCircle2 className="h-4 w-4" />
          {confirmando ? "Confirmando…" : "Confirmar albarán"}
        </Button>
      </div>

      {/* PRP-074 F5 — resumen antes de ejecutar: qué entra, qué se omite y por qué. */}
      <Dialog open={mostrarResumen} onOpenChange={setMostrarResumen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Antes de confirmar</DialogTitle>
            <DialogDescription className="text-xs">
              Esto es lo que va a pasar al confirmar el albarán. Después ya no se puede
              deshacer sin revertir el documento entero.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">
                Entran en el almacén: {resumen.entran.length}{" "}
                {resumen.entran.length === 1 ? "producto" : "productos"}
              </p>
              {resumen.entran.length > 0 && (
                <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                  {resumen.entran.map((p, i) => (
                    <li key={i}>
                      · {formatNumero(p.cantidad)} × {p.nombre}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Se registran los precios de compra del albarán
              {resumen.importeEntrante > 0 && (
                <> · importe de lo que entra: {formatNumero(resumen.importeEntrante)} €</>
              )}
            </p>

            {resumen.omitidas.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="text-xs font-medium">
                  Quedan fuera {resumen.omitidas.length}{" "}
                  {resumen.omitidas.length === 1 ? "línea" : "líneas"}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {resumen.omitidas.map((o, i) => (
                    <li key={i}>
                      · {o.nombre} — <span className="italic">{o.motivo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMostrarResumen(false)}>
              Volver
            </Button>
            <Button onClick={handleConfirmar} disabled={confirmando} className="gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialogLinea && (
        <ResolverLineaDialog
          key={dialogLinea.id}
          open={!!dialogLinea}
          linea={dialogLinea}
          proveedorAlbaran={proveedorAlbaran}
          categorias={categorias}
          busy={busy}
          modoInicial={
            estados[dialogLinea.id]?.estado === "pendiente" && intencionesCrear[dialogLinea.id]
              ? "crear"
              : undefined
          }
          ivaInicial={intencionesCrear[dialogLinea.id]?.iva ?? null}
          onClose={() => setDialogLinea(null)}
          onVincular={(c) => handleVincular(dialogLinea, c)}
          onCrear={(datos) => handleCrear(dialogLinea, datos)}
          onIgnorar={(motivo) => handleIgnorar(dialogLinea, motivo)}
        />
      )}
    </div>
  );
}

// Silencia el import de tipo no usado directamente (ResolucionLinea documenta el contrato).
export type { ResolucionLinea };
