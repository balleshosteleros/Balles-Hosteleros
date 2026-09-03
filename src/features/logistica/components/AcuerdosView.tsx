"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { formatEur, formatNumero } from "@/shared/lib/numero";
import { AcuerdosConfigView } from "@/features/logistica/components/acuerdos/AcuerdosConfigView";
import {
  listMarcas,
  getAcuerdoAnual,
  type MarcaRow,
  type AcuerdoAnual,
} from "@/features/logistica/actions/marcas-actions";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Celda desplegada: qué referencia y qué mes están mostrando sus albaranes. */
interface Desglose {
  referenciaId: string;
  mes: number;
}

export function AcuerdosView() {
  const [marcas, setMarcas] = useState<MarcaRow[]>([]);
  const [marcaId, setMarcaId] = useState("");
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [acuerdo, setAcuerdo] = useState<AcuerdoAnual | null>(null);
  const [loadingMarcas, setLoadingMarcas] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [desglose, setDesglose] = useState<Desglose | null>(null);

  const cargarMarcas = useCallback(async () => {
    setLoadingMarcas(true);
    const res = await listMarcas();
    if (!res.ok) {
      toast.error(res.error ?? "Error cargando marcas");
      setLoadingMarcas(false);
      return;
    }
    setMarcas(res.data);
    // Si la marca abierta ya no existe (se borró en configuración), se cae a la primera.
    setMarcaId((actual) => {
      if (actual && res.data.some((m) => m.id === actual)) return actual;
      return res.data[0]?.id ?? "";
    });
    setLoadingMarcas(false);
  }, []);

  useEffect(() => {
    cargarMarcas();
  }, [cargarMarcas]);

  useEffect(() => {
    if (!marcaId) {
      setAcuerdo(null);
      return;
    }
    let vigente = true;
    setLoading(true);
    setDesglose(null);
    getAcuerdoAnual(marcaId, anio).then((res) => {
      if (!vigente) return;
      if (!res.ok) toast.error(res.error ?? "Error cargando el acuerdo");
      setAcuerdo(res.data);
      setLoading(false);
    });
    return () => {
      vigente = false;
    };
  }, [marcaId, anio]);

  const anios = useMemo(() => {
    const actual = new Date().getFullYear();
    // Ventana fija hacia atrás: los acuerdos se revisan año a año.
    return Array.from({ length: 6 }, (_, i) => actual + 1 - i);
  }, []);

  const totalesMes = useMemo(() => {
    const cantidades = Array.from({ length: 12 }, () => 0);
    const rapeles = Array.from({ length: 12 }, () => 0);
    for (const fila of acuerdo?.filas ?? []) {
      fila.meses.forEach((m, i) => {
        cantidades[i] += m.cantidad;
        rapeles[i] += m.rapel;
      });
    }
    return { cantidades, rapeles };
  }, [acuerdo]);

  const totalAnual = useMemo(() => {
    let cantidad = 0;
    let rapel = 0;
    for (const fila of acuerdo?.filas ?? []) {
      cantidad += fila.totalCantidad;
      rapel += fila.totalRapel;
    }
    return { cantidad, rapel };
  }, [acuerdo]);

  const marcaActual = marcas.find((m) => m.id === marcaId) ?? null;

  const albaranesDesglose = useMemo(() => {
    if (!desglose || !acuerdo) return null;
    const fila = acuerdo.filas.find((f) => f.referenciaId === desglose.referenciaId);
    if (!fila) return null;
    return {
      producto: fila.producto,
      mes: desglose.mes,
      albaranes: fila.meses[desglose.mes]?.albaranes ?? [],
    };
  }, [desglose, acuerdo]);

  if (showConfig) {
    return (
      <div className="p-4 md:p-6">
        <AcuerdosConfigView onBack={() => setShowConfig(false)} onChanged={cargarMarcas} />
      </div>
    );
  }

  if (loadingMarcas) {
    return (
      <div className="p-4 md:p-6">
        <div className="py-20 text-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 pb-28">
      {/* Barra horizontal 1: selectores a la izquierda, apoyo solo icono a la derecha. */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={marcaId} onValueChange={setMarcaId} disabled={marcas.length === 0}>
          <SelectTrigger className="h-9 w-[240px]">
            <SelectValue placeholder="Elige una marca" />
          </SelectTrigger>
          <SelectContent>
            {marcas.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
          <SelectTrigger className="h-9 w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {anios.map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {marcaActual?.estado === "Inactivo" && (
          <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400 border-0 text-[10px]">
            Inactivo
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Móvil sin botones de configuración: solo ordenador. */}
          <Button
            size="icon"
            variant="outline"
            className="hidden md:inline-flex h-9 w-9"
            onClick={() => setShowConfig(true)}
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {marcaActual && (marcaActual.fechaInicio || marcaActual.visibilidad) && (
        <div className="rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground space-y-1">
          {(marcaActual.fechaInicio || marcaActual.fechaFin) && (
            <div>
              <span className="font-medium text-foreground">Vigencia del acuerdo: </span>
              {marcaActual.fechaInicio ?? "—"} → {marcaActual.fechaFin ?? "—"}
            </div>
          )}
          {marcaActual.visibilidad && (
            <div>
              <span className="font-medium text-foreground">Visibilidad: </span>
              {marcaActual.visibilidad}
            </div>
          )}
        </div>
      )}

      {marcas.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <p>No hay marcas con acuerdo todavía.</p>
          <p className="mt-1 text-xs">
            Créalas desde configuración y vincula las referencias que entran en cada acuerdo.
          </p>
        </div>
      ) : loading ? (
        <div className="py-20 text-center">
          <LoadingSpinner />
        </div>
      ) : !acuerdo || acuerdo.filas.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <p>Esta marca aún no tiene referencias vinculadas.</p>
          <p className="mt-1 text-xs">
            Añádelas desde configuración para ver lo comprado mes a mes.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2.5 text-left font-medium sticky left-0 bg-muted/50 min-w-[200px]">
                    Referencia
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Rapel/ud.</th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Objetivo</th>
                  {MESES_CORTOS.map((m, i) => (
                    <th
                      key={m}
                      className="px-2 py-2.5 text-right font-medium whitespace-nowrap"
                      title={MESES[i]}
                    >
                      {m}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Comprado</th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Rapel</th>
                </tr>
              </thead>
              <tbody>
                {acuerdo.filas.map((fila) => {
                  const cumplido =
                    fila.objetivo > 0 && fila.totalCantidad >= fila.objetivo;
                  return (
                    <tr key={fila.referenciaId} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 font-medium sticky left-0 bg-card">
                        {fila.producto}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatEur(fila.rapelUnidad)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {fila.objetivo > 0 ? formatNumero(fila.objetivo) : "—"}
                      </td>
                      {fila.meses.map((celda, i) => {
                        const abierto =
                          desglose?.referenciaId === fila.referenciaId && desglose.mes === i;
                        const tieneCompras = celda.cantidad > 0;
                        return (
                          <td key={i} className="px-2 py-2.5 text-right tabular-nums">
                            {tieneCompras ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setDesglose(
                                    abierto ? null : { referenciaId: fila.referenciaId, mes: i },
                                  )
                                }
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-accent ${
                                  abierto ? "bg-accent" : ""
                                }`}
                                title={`Ver los albaranes de ${MESES[i]}`}
                              >
                                {abierto ? (
                                  <ChevronDown className="h-3 w-3" strokeWidth={2} />
                                ) : (
                                  <ChevronRight className="h-3 w-3 opacity-40" strokeWidth={2} />
                                )}
                                {formatNumero(celda.cantidad)}
                              </button>
                            ) : (
                              // No es "sin dato": sabemos que se compró 0.
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                        <span className={cumplido ? "text-emerald-600 dark:text-emerald-400" : ""}>
                          {formatNumero(fila.totalCantidad)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                        {formatEur(fila.totalRapel)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="px-3 py-2.5 sticky left-0 bg-muted/30">Totales</td>
                  <td />
                  <td />
                  {totalesMes.cantidades.map((c, i) => (
                    <td key={i} className="px-2 py-2.5 text-right tabular-nums">
                      {c > 0 ? formatNumero(c) : <span className="text-muted-foreground">0</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatNumero(totalAnual.cantidad)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatEur(totalAnual.rapel)}
                  </td>
                </tr>
                <tr className="border-t bg-muted/10 text-xs text-muted-foreground">
                  <td className="px-3 py-2 sticky left-0 bg-muted/10">Rapel del mes</td>
                  <td />
                  <td />
                  {totalesMes.rapeles.map((r, i) => (
                    <td key={i} className="px-2 py-2 text-right tabular-nums">
                      {r > 0 ? formatEur(r) : formatEur(0)}
                    </td>
                  ))}
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {albaranesDesglose && (
            <div className="bg-card rounded-lg border">
              <div className="flex items-center gap-2 px-4 py-3 border-b">
                <span className="text-sm font-semibold">
                  {albaranesDesglose.producto} · {MESES[albaranesDesglose.mes]} {anio}
                </span>
                <span className="text-xs text-muted-foreground">
                  {albaranesDesglose.albaranes.length}{" "}
                  {albaranesDesglose.albaranes.length === 1 ? "albarán" : "albaranes"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-8 text-xs"
                  onClick={() => setDesglose(null)}
                >
                  Cerrar
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Albarán</th>
                      <th className="px-3 py-2 text-left font-medium">Nº proveedor</th>
                      <th className="px-3 py-2 text-left font-medium">Proveedor</th>
                      <th className="px-3 py-2 text-left font-medium">Fecha</th>
                      <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                      <th className="px-3 py-2 text-right font-medium">Importe</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {albaranesDesglose.albaranes.map((a, i) => (
                      <tr key={`${a.albaranId}-${i}`} className="border-b">
                        <td className="px-3 py-2 font-medium">{a.numero || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {a.numeroProveedor || "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{a.proveedor || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{a.fecha}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumero(a.cantidad)} {a.unidad}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatEur(a.total)}</td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/logistica/pedidos?albaran=${a.albaranId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Abrir
                            <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
