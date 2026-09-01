"use client";

/**
 * Panel "Monedero" de la configuración de Reservas.
 *
 * Los WhatsApp y SMS se pagan por adelantado: se recarga saldo y cada mensaje
 * lo descuenta. Esta pantalla responde a tres preguntas, en este orden:
 * cuánto queda, para cuántos mensajes da, y en qué se ha ido.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessageCircle, Smartphone, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getSaldo,
  listMovimientos,
  getTarifas,
  recargarSaldo,
} from "@/features/mensajeria/actions/monedero-actions";
import {
  formatearImporte,
  IMPORTES_RECARGA_CENTS,
  UMBRAL_SALDO_BAJO_CENTS,
  TIPO_MOVIMIENTO_LABEL,
  type MonederoSaldo,
  type MonederoMovimiento,
  type TarifasMensajeria,
} from "@/features/mensajeria/data/monedero";
import { cn } from "@/lib/utils";

export function MonederoPanel() {
  const [saldo, setSaldo] = useState<MonederoSaldo | null>(null);
  const [movimientos, setMovimientos] = useState<MonederoMovimiento[]>([]);
  const [tarifas, setTarifas] = useState<TarifasMensajeria | null>(null);
  const [loading, setLoading] = useState(true);

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [importeElegido, setImporteElegido] = useState<number>(IMPORTES_RECARGA_CENTS[1]);
  const [concepto, setConcepto] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const [s, m, t] = await Promise.all([getSaldo(), listMovimientos(), getTarifas()]);
    setSaldo(s.data);
    setMovimientos(m.data);
    setTarifas(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function onRecargar() {
    const texto = concepto.trim();
    if (!texto) {
      toast.error("Indica el concepto de la recarga");
      return;
    }
    setGuardando(true);
    const res = await recargarSaldo({ importeCents: importeElegido, concepto: texto });
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Saldo recargado. Quedan ${formatearImporte(res.saldoCents)}`);
    setDialogAbierto(false);
    setConcepto("");
    void cargar();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const saldoCents = saldo?.saldoCents ?? 0;
  const saldoBajo = saldoCents < UMBRAL_SALDO_BAJO_CENTS;

  return (
    <div className="space-y-4 pb-28">
      {/* ── Saldo ────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Saldo disponible</p>
              <p
                className={cn(
                  "text-3xl font-semibold tabular-nums",
                  saldoBajo && "text-amber-600 dark:text-amber-400",
                )}
              >
                {formatearImporte(saldoCents)}
              </p>

              {/* El saldo en euros no dice nada por sí solo: lo que el
                  restaurante necesita saber es para cuántos avisos le da. */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {saldo?.whatsappRestantes ?? 0} WhatsApp
                </span>
                <span className="flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  {saldo?.smsRestantes ?? 0} SMS
                </span>
              </div>
            </div>

            <Button size="sm" onClick={() => setDialogAbierto(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Recargar
            </Button>
          </div>

          {saldoBajo && (
            <div className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Te queda poco saldo. Cuando se agote, los avisos de reserva
                seguirán saliendo por correo, pero no por WhatsApp ni SMS.
              </p>
            </div>
          )}

          {tarifas && (
            <p className="mt-4 text-[11px] text-muted-foreground">
              Cada WhatsApp cuesta {formatearImporte(tarifas.whatsappCents)} y cada
              SMS {formatearImporte(tarifas.smsCents)}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Extracto ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-3 text-sm font-medium">Movimientos</h3>

          {movimientos.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Todavía no hay movimientos.
            </p>
          ) : (
            <div className="divide-y">
              {movimientos.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {TIPO_MOVIMIENTO_LABEL[m.tipo]}
                      </Badge>
                      <span className="truncate text-xs">{m.concepto}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(m.creadoAt).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {m.usuarioNombre ? ` · ${m.usuarioNombre}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        m.importeCents > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground",
                      )}
                    >
                      {m.importeCents > 0 ? "+" : "−"}
                      {formatearImporte(Math.abs(m.importeCents))}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {formatearImporte(m.saldoDespuesCents)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recargar ─────────────────────────────────────────────────── */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recargar saldo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Importe</Label>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {IMPORTES_RECARGA_CENTS.map((cents) => (
                  <Button
                    key={cents}
                    type="button"
                    variant={importeElegido === cents ? "default" : "outline"}
                    size="sm"
                    onClick={() => setImporteElegido(cents)}
                  >
                    {formatearImporte(cents)}
                  </Button>
                ))}
              </div>
              {tarifas && tarifas.whatsappCents > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Da para {Math.floor(importeElegido / tarifas.whatsappCents)} WhatsApp.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="concepto" className="text-xs">
                Concepto
              </Label>
              <Input
                id="concepto"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Transferencia del 2 de septiembre"
                className="mt-1.5"
                maxLength={200}
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Queda escrito en el extracto para poder cuadrarlo después.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={onRecargar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
