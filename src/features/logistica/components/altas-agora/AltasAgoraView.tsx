"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Link2, Loader2, Plus, ShoppingCart, Utensils } from "lucide-react";
import {
  listAltasPendientes,
  vincularVentasHuerfanas,
  type AltaPendiente,
} from "@/features/logistica/actions/altas-agora-actions";
import { createProducto } from "@/features/logistica/actions/producto-actions";
import AltaProductoDialog from "./AltaProductoDialog";
import VincularProductoDialog from "./VincularProductoDialog";

/**
 * Lo que el TPV vende y Balles no conoce.
 *
 * Cada fila es un producto o un complemento que Ágora lleva registrando —a veces desde
 * junio— y que no casa con ninguna ficha, así que su consumo no se descuenta de nada.
 * No hay botón de descartar a propósito (decisión de Iván): esto se resuelve, no se
 * esconde.
 */

function formatearDia(dia: string): string {
  if (!dia) return "";
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

export default function AltasAgoraView() {
  const [pendientes, setPendientes] = useState<AltaPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aCrear, setACrear] = useState<AltaPendiente | null>(null);
  const [aVincular, setAVincular] = useState<AltaPendiente | null>(null);
  const [duplicado, setDuplicado] = useState<{ id: string; nombre: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const r = await listAltasPendientes();
    if (!r.ok) toast.error(r.error ?? "No se pudo cargar la lista.");
    setPendientes(r.data);
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const enlazar = async (agoraProductId: number, productoId: string) => {
    setGuardando(true);
    try {
      const r = await vincularVentasHuerfanas({ agoraProductId, productoId });
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo enlazar.");
        return;
      }
      const total = (r.lineas ?? 0) + (r.addins ?? 0);
      toast.success(
        `Enlazadas ${total} ${total === 1 ? "venta" : "ventas"} de ${r.dias ?? 0} ${
          (r.dias ?? 0) === 1 ? "día" : "días"
        }.`,
      );
      if ((r.diasSinDescontar ?? 0) > 0) {
        toast.warning(
          `${r.diasSinDescontar} ${(r.diasSinDescontar ?? 0) === 1 ? "día caía" : "días caían"} en período de almacén cerrado, así que no han descontado existencias.`,
        );
      }
      setACrear(null);
      setAVincular(null);
      setDuplicado(null);
      await cargar();
    } finally {
      setGuardando(false);
    }
  };

  const crear = async (datos: { nombre: string; tipo: string; categoria: string; medida: string }) => {
    if (!aCrear) return;
    setGuardando(true);
    try {
      const res = await createProducto({
        nombre: datos.nombre,
        tipo: datos.tipo as "venta" | "compra" | "elaboracion",
        categoria: datos.categoria,
        estado: "Activo",
        medida: datos.medida,
        agoraId: String(aCrear.agoraProductId),
      } as Parameters<typeof createProducto>[0]);

      // Si el nombre choca con uno que ya existe, casi seguro es el mismo producto
      // dado de alta dos veces en Ágora: se ofrece enlazarlo en vez de duplicarlo.
      if (res.duplicado) {
        setDuplicado({ id: res.duplicado.id, nombre: res.duplicado.nombre });
        return;
      }
      if (res.error || !res.producto) {
        toast.error(res.error ?? "No se pudo crear el producto.");
        return;
      }
      await enlazar(aCrear.agoraProductId, res.producto.id as string);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Altas pendientes de Ágora</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El TPV está vendiendo esto y Balles no sabe a qué producto corresponde, así que su
          consumo no se descuenta del almacén. Las ventas <strong>no se han perdido</strong>:
          están guardadas esperando, y al resolver cada línea se recuperan de golpe.
        </p>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : pendientes.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Todo lo que vende el TPV está reconocido. Nada pendiente.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Lo que vende Ágora</th>
                <th className="px-3 py-2.5 font-medium">Qué es</th>
                <th className="px-3 py-2.5 text-right font-medium">Veces</th>
                <th className="px-3 py-2.5 font-medium">Desde</th>
                <th className="px-3 py-2.5 font-medium">Última</th>
                <th className="px-3 py-2.5 text-right font-medium">Qué hacer</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((p) => (
                <tr key={`${p.origen}-${p.agoraProductId}`} className="border-b border-border/50">
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-foreground">{p.nombre}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ID {p.agoraProductId}
                    </span>
                    {p.coincidencia && (
                      <div className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                        Ya existe en Balles: <strong>{p.coincidencia.nombre}</strong>
                        {p.coincidencia.tieneAgoraId ? " (con otro ID de Ágora)" : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      {p.origen === "venta" ? (
                        <><Utensils className="h-3.5 w-3.5" /> Se vende</>
                      ) : (
                        <><ShoppingCart className="h-3.5 w-3.5" /> Complemento</>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">{p.veces}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatearDia(p.desde)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatearDia(p.hasta)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      {p.coincidencia ? (
                        <Button
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          disabled={guardando}
                          onClick={() => enlazar(p.agoraProductId, p.coincidencia!.id)}
                        >
                          <Link2 className="h-3 w-3" /> Enlazar a «{p.coincidencia.nombre}»
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs"
                          disabled={guardando}
                          onClick={() => setAVincular(p)}
                        >
                          <Link2 className="h-3 w-3" /> Vincular
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={p.coincidencia ? "outline" : "default"}
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={guardando}
                        onClick={() => { setDuplicado(null); setACrear(p); }}
                      >
                        <Plus className="h-3 w-3" /> Crear
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendientes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <Badge variant="outline" className="mr-1.5">{pendientes.length}</Badge>
          pendientes. Mientras estén aquí, lo que gastan no sale del almacén.
        </p>
      )}

      <AltaProductoDialog
        abierto={!!aCrear}
        onCerrar={() => { setACrear(null); setDuplicado(null); }}
        onCrear={crear}
        duplicado={duplicado}
        onVincularDuplicado={(productoId) => aCrear && enlazar(aCrear.agoraProductId, productoId)}
        nombreAgora={aCrear?.nombre ?? ""}
        origen={aCrear?.origen ?? "venta"}
        veces={aCrear?.veces ?? 0}
        guardando={guardando}
      />

      <VincularProductoDialog
        abierto={!!aVincular}
        onCerrar={() => setAVincular(null)}
        onVincular={(productoId) => aVincular && enlazar(aVincular.agoraProductId, productoId)}
        nombreAgora={aVincular?.nombre ?? ""}
        veces={aVincular?.veces ?? 0}
        desde={aVincular?.desde ?? ""}
        guardando={guardando}
      />
    </div>
  );
}
