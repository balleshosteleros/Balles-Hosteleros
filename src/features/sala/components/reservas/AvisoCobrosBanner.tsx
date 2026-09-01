"use client";

/**
 * Aviso al entrar en Reservas (PRP-082 §5.6).
 *
 * No se puede silenciar, pero cada línea desaparece sola en cuanto se actúa
 * sobre ella. Si no hay nada pendiente, no se pinta nada: una barra fija
 * diciendo "todo bien" solo estorba.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  getAvisosCobro,
  type ResumenAvisosCobro,
} from "@/features/sala/actions/avisos-cobro-actions";

export function AvisoCobrosBanner({
  onVerReservas,
  refrescarToken,
}: {
  /** Filtra la lista por esas reservas: el aviso lleva a donde se actúa. */
  onVerReservas?: (reservaIds: string[]) => void;
  /** Cambia para forzar una recarga tras cobrar o liberar. */
  refrescarToken?: number;
}) {
  const [resumen, setResumen] = useState<ResumenAvisosCobro | null>(null);

  const cargar = useCallback(async () => {
    setResumen(await getAvisosCobro());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, refrescarToken]);

  if (!resumen || resumen.total === 0) return null;

  const todas = Array.from(new Set(resumen.avisos.flatMap((a) => a.reservaIds)));

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 mb-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {resumen.total}{" "}
              {resumen.total === 1
                ? "reserva necesita tu atención"
                : "reservas necesitan tu atención"}
            </div>
            <ul className="mt-1 space-y-0.5">
              {resumen.avisos.map((a) => (
                <li key={a.tipo} className="text-xs text-amber-800/90 dark:text-amber-300/90">
                  {onVerReservas ? (
                    <button
                      type="button"
                      onClick={() => onVerReservas(a.reservaIds)}
                      className="text-left hover:underline"
                    >
                      {a.texto}
                    </button>
                  ) : (
                    a.texto
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {onVerReservas && (
          <button
            type="button"
            onClick={() => onVerReservas(todas)}
            className="shrink-0 h-7 px-3 rounded-md border border-amber-500/40 bg-background text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            Ver reservas
          </button>
        )}
      </div>
    </div>
  );
}
