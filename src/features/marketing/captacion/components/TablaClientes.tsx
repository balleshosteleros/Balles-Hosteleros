"use client";

import { colorOrigen, labelOrigen } from "@/features/sala/data/origenes";
import { CIFRA, TITULAR } from "../lib/estilo";
import { formatNumero, formatPorcentaje } from "@/shared/lib/numero";
import type { ClientesCanal } from "../types";

/**
 * La base de clientes que ha dejado cada canal.
 *
 * Una reserva es una noche; una ficha es alguien a quien se le puede volver a
 * escribir. Por eso aquí no se cuentan reservas: se cuenta gente, cuánta de
 * ella ha llegado a venir, cuánta ha vuelto y a cuánta se le puede mandar un
 * correo.
 *
 * La columna del correo es la que decide qué campañas son posibles: un canal
 * con miles de fichas y sin correos solo se puede trabajar por WhatsApp o SMS.
 */

export function TablaClientes({ clientes }: { clientes: ClientesCanal[] }) {
  if (clientes.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        Todavía no hay fichas de cliente con canal anotado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr
            className="border-b text-[.7rem] uppercase tracking-[.07em] text-muted-foreground"
            style={TITULAR}
          >
            <th className="p-3 text-left font-medium">Canal</th>
            <th className="p-3 text-right font-medium">Fichas</th>
            <th className="p-3 text-right font-medium">Han venido</th>
            <th className="p-3 text-right font-medium">Repiten</th>
            <th className="p-3 text-right font-medium">Con correo</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.canal} className="border-b last:border-0">
              <td className="p-3">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: colorOrigen(c.canal) }}
                  />
                  {labelOrigen(c.canal)}
                </span>
              </td>
              <td className="p-3 text-right text-[.86rem]" style={CIFRA}>{formatNumero(c.clientes)}</td>
              <td className="p-3 text-right text-[.86rem] text-muted-foreground" style={CIFRA}>
                {formatNumero(c.hanVenido)}
              </td>
              <td className="p-3 text-right text-[.86rem]" style={CIFRA}>
                {formatNumero(c.repiten)}
                {c.hanVenido > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({formatPorcentaje((c.repiten / c.hanVenido) * 100, { max: 0 })})
                  </span>
                )}
              </td>
              <td className="p-3 text-right text-[.86rem] text-muted-foreground" style={CIFRA}>
                {formatNumero(c.conEmail)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted-foreground">
        &quot;Repiten&quot; son los que han venido dos veces o más, sobre los que llegaron
        a venir alguna vez.
      </p>
    </div>
  );
}
