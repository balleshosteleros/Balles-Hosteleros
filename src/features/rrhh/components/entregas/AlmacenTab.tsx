"use client";

/**
 * El almacén de uniforme y material.
 *
 * Tres números arriba y una tabla debajo que los desglosa por pieza y talla:
 * cuánto hay en la estantería, cuánto llevan puesto los trabajadores y cuánto
 * tiene la empresa entre las dos cosas.
 *
 * Y el libro: cada línea explica por qué cambió alguno de esos números. Es lo
 * que convierte "faltan tres camisas" en "dos se rompieron y una no volvió".
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Package, Shirt, Boxes, Loader2, Plus, PackageX, AlertTriangle,
} from "lucide-react";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { formatearFechaEs } from "@/shared/lib/fecha";
import {
  listSaldosMaterial,
  listMovimientosMaterial,
} from "@/features/rrhh/actions/material-almacen-actions";
import {
  MOVIMIENTO_LABEL,
  MOVIMIENTO_COLOR,
  conSigno,
  nombrePieza,
  totalesDe,
  tieneSaldoImposible,
  type MovimientoMaterial,
  type SaldoMaterial,
} from "@/features/rrhh/data/material-stock";
import { EntradaMaterialDialog } from "./EntradaMaterialDialog";
import { BajaAlmacenDialog } from "./BajaAlmacenDialog";
import { ToolTooltip } from "@/components/ui/tool-tooltip";

function Total({
  titulo, valor, Icono, color, pie,
}: {
  titulo: string;
  valor: number;
  Icono: React.ElementType;
  color?: string;
  pie: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icono className={`h-5 w-5 ${color ?? "text-primary"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{titulo}</p>
          <p className="text-xl font-semibold text-foreground">{valor}</p>
          <p className="text-xs text-muted-foreground truncate">{pie}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AlmacenTab() {
  const [saldos, setSaldos] = useState<SaldoMaterial[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoMaterial[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entradaAbierta, setEntradaAbierta] = useState(false);
  const [bajaAbierta, setBajaAbierta] = useState(false);
  /** Filtro por columna: se escribe debajo del nombre de la pieza. */
  const [filtroPieza, setFiltroPieza] = useState("");
  useGlobalLoadingSync(loading);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [s, m] = await Promise.all([
      listSaldosMaterial(),
      listMovimientosMaterial(0),
    ]);
    setSaldos(s);
    setMovimientos(m.movimientos);
    setHayMas(m.hayMas);
    setPagina(0);
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function cargarMas() {
    const siguiente = pagina + 1;
    const m = await listMovimientosMaterial(siguiente);
    setMovimientos((previos) => [...previos, ...m.movimientos]);
    setHayMas(m.hayMas);
    setPagina(siguiente);
  }

  const totales = useMemo(() => totalesDe(saldos), [saldos]);

  const filtradas = useMemo(() => {
    const texto = filtroPieza.trim().toLowerCase();
    if (!texto) return saldos;
    return saldos.filter((s) =>
      nombrePieza(s.tipoNombre, s.talla).toLowerCase().includes(texto),
    );
  }, [saldos, filtroPieza]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Total
          titulo="En almacén"
          valor={totales.enAlmacen}
          Icono={Boxes}
          pie="Disponible para entregar"
        />
        <Total
          titulo="En manos de los trabajadores"
          valor={totales.enManos}
          Icono={Shirt}
          color="text-sky-600"
          pie="Entregado y firmado"
        />
        <Total
          titulo="Total de la empresa"
          valor={totales.totalEmpresa}
          Icono={Package}
          color="text-emerald-600"
          pie="Lo uno más lo otro"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setEntradaAbierta(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Entrada
        </Button>
        <Button size="sm" variant="outline" onClick={() => setBajaAbierta(true)}>
          <PackageX className="h-4 w-4 mr-1" />
          Dar de baja
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : saldos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Boxes className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            El almacén está vacío. Registra una entrada para empezar a contar.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <div className="space-y-1.5 py-1">
                      <span>Pieza</span>
                      <Input
                        value={filtroPieza}
                        onChange={(e) => setFiltroPieza(e.target.value)}
                        placeholder="Filtrar"
                        className="h-7 text-xs font-normal"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">En almacén</TableHead>
                  <TableHead className="text-right">En manos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Último recuento</TableHead>
                  <TableHead className="text-right">Descuadre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((s) => (
                  <TableRow key={`${s.tipoId ?? ""}|${s.talla ?? ""}`}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {nombrePieza(s.tipoNombre, s.talla)}
                        {tieneSaldoImposible(s) && (
                          <ToolTooltip label="Hay más entregado que material registrado: falta cargar el saldo inicial">
                            <span
                              className="text-amber-600"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                          </ToolTooltip>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.enAlmacen}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.enManos}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {s.totalEmpresa}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.ultimoRecuento ? formatearFechaEs(s.ultimoRecuento) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.ultimoDescuadre === null ? (
                        "—"
                      ) : s.ultimoDescuadre === 0 ? (
                        <span className="text-muted-foreground">Cuadraba</span>
                      ) : (
                        <span
                          className={
                            s.ultimoDescuadre > 0 ? "text-emerald-600" : "text-rose-600"
                          }
                        >
                          {conSigno(s.ultimoDescuadre)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Movimientos</h3>
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Qué pasó</TableHead>
                    <TableHead>Pieza</TableHead>
                    <TableHead>Quién</TableHead>
                    <TableHead className="text-right">Almacén</TableHead>
                    <TableHead className="text-right">En manos</TableHead>
                    <TableHead>Motivo y observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatearFechaEs(m.fecha)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={MOVIMIENTO_COLOR[m.tipoMovimiento]}
                        >
                          {MOVIMIENTO_LABEL[m.tipoMovimiento]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {nombrePieza(m.tipoNombre, m.talla)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.empleadoNombre ?? m.proveedor ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.deltaAlmacen === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={
                              m.deltaAlmacen > 0 ? "text-emerald-600" : "text-rose-600"
                            }
                          >
                            {conSigno(m.deltaAlmacen)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.deltaManos === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={
                              m.deltaManos > 0 ? "text-sky-600" : "text-rose-600"
                            }
                          >
                            {conSigno(m.deltaManos)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[18rem]">
                        {/* El motivo explica por qué se perdió; las observaciones
                            son lo que alguien quiso apuntar además. */}
                        <span className="block truncate">{m.motivo ?? "—"}</span>
                        {m.observaciones && (
                          <span className="block truncate text-xs italic">
                            {m.observaciones}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {hayMas && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => void cargarMas()}>
                  Ver más
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <EntradaMaterialDialog
        open={entradaAbierta}
        onOpenChange={setEntradaAbierta}
        onHecho={() => void cargar()}
      />
      <BajaAlmacenDialog
        open={bajaAbierta}
        onOpenChange={setBajaAbierta}
        onHecho={() => void cargar()}
      />
    </div>
  );
}
