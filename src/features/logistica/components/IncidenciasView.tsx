"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Check,
  Package,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  listIncidencias,
  createIncidencia,
} from "@/features/logistica/actions/incidencias-actions";

type Registro = {
  id: string;
  producto: string;
  proveedor: string;
  precioActual: number;
  precioNuevo: number;
  fecha: string;
};

function pct(actual: number, nuevo: number): number {
  if (!actual) return 0;
  return ((nuevo - actual) / actual) * 100;
}

function fmtEuros(n: number): string {
  return n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

export function IncidenciasView() {
  const [producto, setProducto] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [precioActual, setPrecioActual] = useState<string>("");
  const [precioNuevo, setPrecioNuevo] = useState<string>("");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargarRegistros = useCallback(async () => {
    try {
      setCargando(true);
      const res = await listIncidencias();
      if (res.ok) {
        const mapped: Registro[] = (res.data as Record<string, unknown>[]).map((r) => ({
          id: r.id as string,
          producto: (r.producto as string) ?? "",
          proveedor: (r.proveedor as string) ?? "---",
          precioActual: (r.precio_actual as number) ?? 0,
          precioNuevo: (r.precio_nuevo as number) ?? 0,
          fecha: ((r.created_at as string) ?? "").slice(0, 10),
        }));
        setRegistros(mapped);
      }
    } catch {
      toast.error("Error al cargar incidencias");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarRegistros();
  }, [cargarRegistros]);

  const actualNum = parseFloat(precioActual.replace(",", ".")) || 0;
  const nuevoNum = parseFloat(precioNuevo.replace(",", ".")) || 0;

  const variacion = useMemo(() => pct(actualNum, nuevoNum), [actualNum, nuevoNum]);
  const subio = variacion > 0;
  const bajo = variacion < 0;
  const muyAlta = Math.abs(variacion) >= 10;

  async function registrar() {
    if (!producto.trim()) {
      toast.error("Indica el producto");
      return;
    }
    if (!actualNum || !nuevoNum) {
      toast.error("Rellena los dos precios");
      return;
    }
    try {
      const res = await createIncidencia({
        producto: producto.trim(),
        proveedor: proveedor.trim() || undefined,
        precio_actual: actualNum,
        precio_nuevo: nuevoNum,
      });
      if (!res.ok) { toast.error(res.error ?? "Error al registrar"); return; }
      setProducto("");
      setProveedor("");
      setPrecioActual("");
      setPrecioNuevo("");
      toast.success("Subida registrada");
      await cargarRegistros();
    } catch {
      toast.error("Error al registrar subida");
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Calculadora */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Nueva subida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="producto">Producto</Label>
                <div className="relative mt-1">
                  <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="producto"
                    value={producto}
                    onChange={(e) => setProducto(e.target.value)}
                    placeholder="Ej: Aceite de oliva 5L"
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="proveedor">Proveedor</Label>
                <Input
                  id="proveedor"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="actual">Precio actual (€)</Label>
                <Input
                  id="actual"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={precioActual}
                  onChange={(e) => setPrecioActual(e.target.value)}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="nuevo">Precio que debería tener (€)</Label>
                <Input
                  id="nuevo"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={precioNuevo}
                  onChange={(e) => setPrecioNuevo(e.target.value)}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
            </div>

            <Button onClick={registrar} className="w-full sm:w-auto">
              <Save className="mr-1 h-4 w-4" /> Registrar subida
            </Button>
          </CardContent>
        </Card>

        {/* Resultado */}
        <Card
          className={
            muyAlta
              ? "border-red-300 bg-red-50/50 dark:bg-red-950/20"
              : subio
                ? "border-orange-300 bg-orange-50/50 dark:bg-orange-950/20"
                : bajo
                  ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : ""
          }
        >
          <CardHeader>
            <CardTitle className="text-base">Variación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              {subio && <TrendingUp className="h-6 w-6 text-orange-600" />}
              {bajo && <TrendingDown className="h-6 w-6 text-emerald-600" />}
              {!subio && !bajo && <Check className="h-6 w-6 text-muted-foreground" />}
              <p
                className={`text-4xl font-bold ${
                  muyAlta
                    ? "text-red-600"
                    : subio
                      ? "text-orange-600"
                      : bajo
                        ? "text-emerald-600"
                        : "text-foreground"
                }`}
              >
                {variacion >= 0 ? "+" : ""}
                {variacion.toFixed(2)}%
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Actual</span>
                <span className="font-medium text-foreground">
                  {fmtEuros(actualNum)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Debería ser</span>
                <span className="font-medium text-foreground">
                  {fmtEuros(nuevoNum)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Diferencia</span>
                <span className="font-medium text-foreground">
                  {fmtEuros(nuevoNum - actualNum)}
                </span>
              </div>
            </div>
            {muyAlta && (
              <div className="flex gap-2 rounded-md bg-red-100 p-2 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Subida superior al 10%. Revisa con el proveedor antes de aceptarla.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subidas registradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Nuevo</TableHead>
                <TableHead className="text-right">Variación</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Cargando incidencias...
                  </TableCell>
                </TableRow>
              )}
              {!cargando && registros.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Todavía no has registrado ninguna subida.
                  </TableCell>
                </TableRow>
              )}
              {registros.map((r) => {
                const v = pct(r.precioActual, r.precioNuevo);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.producto}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.proveedor}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmtEuros(r.precioActual)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {fmtEuros(r.precioNuevo)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          v >= 10
                            ? "border-red-300 text-red-700"
                            : v > 0
                              ? "border-orange-300 text-orange-700"
                              : v < 0
                                ? "border-emerald-300 text-emerald-700"
                                : ""
                        }
                      >
                        {v >= 0 ? "+" : ""}
                        {v.toFixed(2)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.fecha}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
