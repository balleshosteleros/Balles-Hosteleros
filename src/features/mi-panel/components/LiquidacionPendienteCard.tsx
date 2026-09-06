"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  cobrarMiLiquidacion,
  rechazarMiLiquidacion,
  type PagoPendiente,
} from "@/features/rrhh/actions/pagos-actions";
import { BadgeEuro, Loader2 } from "lucide-react";

const fmt = (n: number) =>
  `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;

/**
 * La liquidación que espera respuesta del trabajador, arriba de "Mis pagos".
 *
 * Ve el desglose completo -- los importes viven aquí, no en el correo -- y
 * decide: cobrar (aprueba, y RRHH ya puede pagarle) o rechazar dejando un
 * motivo, que le llega a RRHH en la columna de comentarios.
 */
export function LiquidacionPendienteCard({
  pago,
  onResuelta,
}: {
  pago: PagoPendiente;
  onResuelta: () => void;
}) {
  const [enviando, setEnviando] = useState<"cobrar" | "rechazar" | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const conceptos = [
    { label: "Nómina", valor: pago.nomina },
    { label: "Complemento", valor: pago.complemento },
    { label: "Horas extras", valor: pago.horasExtras },
    { label: "Bonus", valor: pago.bonus },
    { label: "Ajuste", valor: pago.ajuste },
  ].filter((c) => c.valor !== 0);

  const cobrar = async () => {
    setEnviando("cobrar");
    const res = await cobrarMiLiquidacion(pago.id);
    setEnviando(null);
    if (!res.ok) return toast.error(res.error ?? "No se pudo confirmar.");
    toast.success("Liquidación confirmada. Te hemos enviado un correo.");
    onResuelta();
  };

  const rechazar = async () => {
    if (!motivo.trim()) return toast.error("Escribe el motivo del rechazo.");
    setEnviando("rechazar");
    const res = await rechazarMiLiquidacion(pago.id, motivo);
    setEnviando(null);
    if (!res.ok) return toast.error(res.error ?? "No se pudo rechazar.");
    toast.success("Rechazada. Se lo hemos comunicado a la empresa.");
    onResuelta();
  };

  return (
    <Card className="border-primary/30 p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BadgeEuro className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Tu liquidación de {pago.periodoLabel}</h2>
          <p className="text-sm text-muted-foreground">
            Revisa que los importes son correctos y confírmalo para cobrarla.
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
        {conceptos.map((c) => (
          <div key={c.label} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{c.label}</dt>
            <dd className="tabular-nums">{fmt(c.valor)}</dd>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-base font-semibold">
          <dt>Total a cobrar</dt>
          <dd className="tabular-nums">{fmt(pago.total)}</dd>
        </div>
      </dl>

      {/* Si ya la rechazó, se le recuerda lo que dijo: la empresa aún no la ha
          rehecho, y sin esto parecería que su rechazo no se guardó. */}
      {pago.rechazadaAt && !rechazando && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          La rechazaste y la empresa lo está revisando.
          {pago.comentarioEmpleado ? ` Tu motivo: «${pago.comentarioEmpleado}»` : ""}
        </p>
      )}

      {rechazando ? (
        <div className="mt-4 space-y-2">
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="¿Qué no te cuadra? Explícalo en una línea."
            rows={2}
            maxLength={280}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => void rechazar()}
              disabled={enviando !== null}
            >
              {enviando === "rechazar" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar rechazo"}
            </Button>
            <Button variant="ghost" onClick={() => setRechazando(false)} disabled={enviando !== null}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void cobrar()}
            disabled={enviando !== null}
          >
            {enviando === "cobrar" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cobrar"}
          </Button>
          <Button variant="outline" onClick={() => setRechazando(true)} disabled={enviando !== null}>
            Rechazar
          </Button>
        </div>
      )}
    </Card>
  );
}
