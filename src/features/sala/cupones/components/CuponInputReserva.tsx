"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CUPON_CODIGO_REGEX,
  CUPON_MOTIVO_LABELS,
  describirBeneficio,
  type CuponMotivoInvalidez,
  type CuponPublico,
  type CuponValidacionResult,
} from "@/features/sala/cupones/data/cupones";

/**
 * Input compartido (admin + público) para introducir un código de cupón.
 * Valida en server con debounce. Avisa al padre del resultado vía `onResult`.
 * Si el código no llega a tener 6 chars, no muestra error (validación tolerante).
 */
interface Props {
  /** Código actual (controlado). */
  value: string;
  onChange: (v: string) => void;
  /** Llamada al server que valida (admin o público). */
  validar: (codigo: string) => Promise<CuponValidacionResult>;
  /** Padre recibe el último resultado válido o null. */
  onResult: (r: { ok: true; cuponId: string; cupon: CuponPublico } | { ok: false } | null) => void;
  /** Cambia cada vez que cambia un input externo (fecha/turno/personas) para revalidar. */
  contextoSerial?: string;
  disabled?: boolean;
  label?: string;
}

type EstadoUI =
  | { kind: "idle" }
  | { kind: "validando" }
  | { kind: "ok"; cupon: CuponPublico }
  | { kind: "error"; motivo: CuponMotivoInvalidez };

export function CuponInputReserva({
  value,
  onChange,
  validar,
  onResult,
  contextoSerial,
  disabled = false,
  label = "Código de cupón",
}: Props) {
  const [estado, setEstado] = useState<EstadoUI>({ kind: "idle" });

  useEffect(() => {
    const norm = value.trim().toUpperCase();
    if (!norm) {
      setEstado({ kind: "idle" });
      onResult(null);
      return;
    }
    // Validación tolerante: aún no son 6 chars o no es alfanumérico → no mostrar error.
    if (!CUPON_CODIGO_REGEX.test(norm)) {
      setEstado({ kind: "idle" });
      onResult(null);
      return;
    }
    setEstado({ kind: "validando" });
    const timer = setTimeout(async () => {
      const res = await validar(norm);
      if (res.ok && res.cupon) {
        setEstado({ kind: "ok", cupon: res.cupon });
        onResult({ ok: true, cuponId: res.cupon.id, cupon: res.cupon });
      } else {
        const motivo = res.motivo ?? "NO_EXISTE";
        setEstado({ kind: "error", motivo });
        onResult({ ok: false });
      }
    }, 300);
    return () => clearTimeout(timer);
    // contextoSerial fuerza revalidación si cambian fecha/turno/personas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, contextoSerial]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="cupon-codigo">{label}</Label>
      <div className="relative">
        <Input
          id="cupon-codigo"
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 6))}
          placeholder="6 caracteres (ej. K7M2X9)"
          maxLength={6}
          disabled={disabled}
          className="font-mono uppercase pr-9"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          {estado.kind === "validando" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {estado.kind === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {estado.kind === "error" && <XCircle className="h-4 w-4 text-destructive" />}
        </span>
      </div>
      {estado.kind === "ok" && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          {estado.cupon.tituloClienteEfectivo} · {describirBeneficio({
            beneficioTipo: estado.cupon.beneficioTipo,
            beneficioValor: estado.cupon.beneficioValor,
            productoDescripcion: estado.cupon.productoDescripcion,
          })}
        </p>
      )}
      {estado.kind === "error" && (
        <p className="text-xs text-destructive">{CUPON_MOTIVO_LABELS[estado.motivo]}</p>
      )}
    </div>
  );
}
