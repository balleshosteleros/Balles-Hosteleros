"use client";

/**
 * Recuento físico del almacén.
 *
 * Se abre un recuento, el sistema congela lo que él cree que hay, y se va
 * escribiendo lo que hay de verdad en la estantería. Al confirmarlo, cada
 * diferencia se convierte en un ajuste del libro con su motivo, y a partir de
 * ahí el sistema dice lo mismo que la estantería.
 *
 * Contar de menos no se castiga y contar de más tampoco: el descuadre es
 * información, no un fallo que haya que esconder.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClipboardList, Loader2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { formatearFechaEs } from "@/shared/lib/fecha";
import {
  listRecuentos,
  abrirRecuento,
  guardarConteo,
  confirmarRecuento,
  anularRecuento,
  type Recuento,
} from "@/features/rrhh/actions/material-recuentos-actions";
import { conSigno, nombrePieza } from "@/features/rrhh/data/material-stock";

const ESTADO_LABEL: Record<Recuento["estado"], string> = {
  abierto: "Contando",
  confirmado: "Confirmado",
  anulado: "Descartado",
};

const ESTADO_COLOR: Record<Recuento["estado"], string> = {
  abierto: "bg-amber-50 text-amber-700 border-amber-200",
  confirmado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  anulado: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

export function RecuentosTab() {
  const [recuentos, setRecuentos] = useState<Recuento[]>([]);
  const [loading, setLoading] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  /** Lo tecleado en cada línea antes de guardarlo, por id de línea. */
  const [conteos, setConteos] = useState<Record<string, string>>({});
  useGlobalLoadingSync(loading);

  const cargar = useCallback(async () => {
    setLoading(true);
    const data = await listRecuentos();
    setRecuentos(data);
    // Lo ya contado se muestra tal cual; lo que falta, en blanco.
    const previos: Record<string, string> = {};
    for (const r of data) {
      for (const l of r.lineas) {
        previos[l.id] = l.contadoAlmacen === null ? "" : String(l.contadoAlmacen);
      }
    }
    setConteos(previos);
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const abierto = recuentos.find((r) => r.estado === "abierto") ?? null;
  const cerrados = recuentos.filter((r) => r.estado !== "abierto");

  async function empezar() {
    setTrabajando(true);
    const res = await abrirRecuento();
    setTrabajando(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Recuento abierto. Ve apuntando lo que hay.");
    void cargar();
  }

  /** Guarda al salir del campo: contar es teclear muchas casillas seguidas. */
  async function apuntar(lineaId: string) {
    const texto = (conteos[lineaId] ?? "").trim();
    const contado = texto === "" ? null : Number(texto);
    if (contado !== null && (!Number.isInteger(contado) || contado < 0)) {
      toast.error("Cuenta en unidades enteras");
      return;
    }
    const res = await guardarConteo({ lineaId, contado });
    if (!res.ok) { toast.error(res.error); return; }
    void cargar();
  }

  async function confirmar(id: string) {
    setTrabajando(true);
    const res = await confirmarRecuento(id);
    setTrabajando(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(
      res.ajustes === 0
        ? "Todo cuadraba: no ha hecho falta ajustar nada"
        : res.ajustes === 1
          ? "Recuento cerrado con 1 ajuste"
          : `Recuento cerrado con ${res.ajustes} ajustes`,
    );
    void cargar();
  }

  async function descartar(id: string) {
    setTrabajando(true);
    const res = await anularRecuento(id);
    setTrabajando(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Recuento descartado");
    void cargar();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!abierto && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void empezar()} disabled={trabajando}>
            <Plus className="h-4 w-4 mr-1" />
            Empezar recuento
          </Button>
        </div>
      )}

      {abierto && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Recuento del {formatearFechaEs(abierto.fecha)}
              </h3>
              <Badge variant="outline" className={ESTADO_COLOR.abierto}>
                {ESTADO_LABEL.abierto}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void descartar(abierto.id)}
                disabled={trabajando}
              >
                <X className="h-4 w-4 mr-1" />
                Descartar
              </Button>
              <Button size="sm" onClick={() => void confirmar(abierto.id)} disabled={trabajando}>
                {trabajando ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Aceptar
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pieza</TableHead>
                  <TableHead className="text-right">Debería haber</TableHead>
                  <TableHead className="text-right">Hay</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {abierto.lineas.map((l) => {
                  const sinContar = l.contadoAlmacen === null;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        {nombrePieza(l.tipoNombre, l.talla)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.teoricoAlmacen}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={conteos[l.id] ?? ""}
                          onChange={(e) =>
                            setConteos((c) => ({ ...c, [l.id]: e.target.value }))
                          }
                          onBlur={() => void apuntar(l.id)}
                          placeholder="—"
                          className="h-8 w-20 ml-auto text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {sinContar ? (
                          <span className="text-muted-foreground">Sin contar</span>
                        ) : l.diferencia === 0 ? (
                          <span className="text-muted-foreground">Cuadra</span>
                        ) : (
                          <span
                            className={
                              l.diferencia > 0 ? "text-emerald-600" : "text-rose-600"
                            }
                          >
                            {conSigno(l.diferencia)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Al aceptar, cada diferencia se apunta en el libro del almacén con su
            motivo. Lo que dejes sin contar se queda como está.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Recuentos anteriores</h3>
        {cerrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Todavía no se ha cerrado ningún recuento.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Piezas contadas</TableHead>
                  <TableHead className="text-right">Descuadres</TableHead>
                  <TableHead>Cerrado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cerrados.map((r) => {
                  const contadas = r.lineas.filter((l) => l.contadoAlmacen !== null);
                  const descuadres = contadas.filter((l) => l.diferencia !== 0).length;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatearFechaEs(r.fecha)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ESTADO_COLOR[r.estado]}>
                          {ESTADO_LABEL[r.estado]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {contadas.length}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.estado === "anulado" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : descuadres === 0 ? (
                          <span className="text-muted-foreground">Todo cuadraba</span>
                        ) : (
                          <span className="text-rose-600">{descuadres}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.confirmadoPorNombre ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
