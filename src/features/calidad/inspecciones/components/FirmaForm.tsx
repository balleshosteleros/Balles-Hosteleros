"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  ShieldCheck,
  Loader2,
  TicketPercent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { firmarEnvioConDni } from "../actions";
import type { JefeSalaFirma, VerificacionResultado, EmpresaTheme } from "../types";

interface FirmaFormProps {
  qrToken: string;
  ctx: JefeSalaFirma;
  empresa: EmpresaTheme | null;
}

export function FirmaForm({ qrToken, ctx, empresa }: FirmaFormProps) {
  const bg = empresa?.color ?? "hsl(210 50% 20%)";
  const accent = empresa?.color_secundario ?? empresa?.color ?? "#10b981";
  const accentSoft = `${accent}22`;
  const [dni, setDni] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<VerificacionResultado | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const valor = dni.trim();
    if (!valor) {
      setError("Escribe tu DNI o NIE para firmar.");
      return;
    }
    startTransition(async () => {
      const result = await firmarEnvioConDni({ qrToken, dni: valor });
      if (result.ok) {
        setSuccess(result);
        return;
      }
      switch (result.motivo) {
        case "dni_no_coincide":
          setError(
            `Ese DNI no corresponde a ${ctx.jefe_sala?.nombre_completo ?? "el jefe de sala indicado"}. Solo él puede firmar esta inspección.`,
          );
          break;
        case "ya_verificado":
        case "token_usado":
          setError(
            "Este QR ya se utilizó para firmar otra inspección. Pide al inspector que regenere el código.",
          );
          break;
        case "token_caducado":
          setError(
            "El QR ha caducado (más de 2 horas). Pide al inspector que regenere el código.",
          );
          break;
        case "token_revocado":
          setError("Este QR ya no es válido. El inspector generó uno nuevo.");
          break;
        default:
          setError("No se ha podido firmar. Inténtalo de nuevo.");
      }
    });
  }

  if (success?.ok && success.envio) {
    return (
      <main
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: bg }}
      >
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-8 text-center space-y-4">
          {empresa?.logo_url && (
            <div className="mx-auto mb-2 flex h-12 items-center justify-center">
              <Image
                src={empresa.logo_url}
                alt={empresa.nombre}
                width={120}
                height={48}
                className="object-contain h-12 w-auto"
              />
            </div>
          )}
          <div
            className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: accentSoft, color: accent }}
          >
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold">Inspección firmada</h1>
          <p className="text-sm text-muted-foreground">
            Inspección #{success.envio.numero_secuencial ?? "—"}
            {success.envio.local_nombre ? ` · ${success.envio.local_nombre}` : ""}
            {success.envio.fecha_inspeccion
              ? ` · ${new Date(success.envio.fecha_inspeccion).toLocaleString()}`
              : ""}
          </p>
          <div
            className="rounded-lg px-4 py-3 flex items-start gap-3 text-left"
            style={{
              backgroundColor: accentSoft,
              color: accent,
              border: `1px solid ${accent}55`,
            }}
          >
            <TicketPercent className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="text-sm leading-relaxed">
              Aplica el <strong>descuento INSPECCIÓN</strong> al ticket del
              inspector{" "}
              <span className="font-medium">{success.envio.nombre_inspector}</span>
              .
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Firmado por{" "}
            <span className="font-medium text-foreground">
              {success.envio.verificado_por_nombre}
            </span>
          </p>
          <Link
            href="/mi-panel/inspecciones"
            className="inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: accent }}
          >
            Ver inspección en Mi Panel
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: bg }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl p-8 space-y-5"
      >
        <div className="text-center space-y-2">
          {empresa?.logo_url && (
            <div className="mx-auto mb-1 flex h-12 items-center justify-center">
              <Image
                src={empresa.logo_url}
                alt={empresa.nombre}
                width={120}
                height={48}
                className="object-contain h-12 w-auto"
              />
            </div>
          )}
          <div
            className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: accentSoft, color: accent }}
          >
            <ShieldCheck className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold">Firma tu inspección</h1>
          <p className="text-sm text-muted-foreground">
            Inspección #{ctx.numero_secuencial ?? "—"}
            {ctx.local_nombre ? ` · ${ctx.local_nombre}` : ""}
          </p>
        </div>

        <div
          className="rounded-lg px-4 py-3 space-y-1.5 text-sm"
          style={{
            backgroundColor: accentSoft,
            border: `1px solid ${accent}55`,
          }}
        >
          <div
            className="text-xs uppercase tracking-wider"
            style={{ color: accent }}
          >
            El inspector indicó que el jefe de sala eras tú
          </div>
          <div className="font-semibold text-base">
            {ctx.jefe_sala?.nombre_completo ?? "—"}
          </div>
          {ctx.jefe_sala?.puesto && (
            <div className="text-xs text-muted-foreground">
              {ctx.jefe_sala.puesto}
            </div>
          )}
          <div className="pt-1 text-xs text-muted-foreground">
            Inspector:{" "}
            <span className="text-foreground">{ctx.nombre_inspector}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dni" className="text-sm font-medium">
            Tu DNI o NIE
          </Label>
          <Input
            id="dni"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder="12345678A"
            autoComplete="off"
            autoCapitalize="characters"
            inputMode="text"
            className="text-lg tracking-wider uppercase"
            disabled={pending}
          />
          <p className="text-[11px] text-muted-foreground">
            Lo comparamos con el DNI registrado en tu ficha. Si te equivocas,
            puedes volver a intentarlo.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full text-white"
          style={{ backgroundColor: accent }}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-2" />
          )}
          Firmar inspección
        </Button>
      </form>
    </main>
  );
}
