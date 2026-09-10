"use client";

/**
 * Con quién habla el buzón: la tabla protagonista del panel (PRP-094, Fase 3).
 *
 * Los contactos van del que más correo genera al que menos, y cada fila lleva su
 * porcentaje y el ACUMULADO. Donde el acumulado cruza el 80 % se pinta una línea:
 * lo que queda por encima es el puñado de contactos que genera la mayor parte del
 * trabajo del buzón. Ahí es donde merece la pena hacer algo — automatizar un
 * proveedor pesado, cortar un boletín, repartir carga.
 *
 * La barrita de cada fila no es decoración: deja ver de un vistazo la caída, que
 * es lo que distingue «un contacto se lo come todo» de «esto está repartido».
 */

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatoNumero, formatoPorcentaje } from "../lib/formato";
import type { ContactoDelRanking } from "../types";

export function CorreoContactosTabla({
  ranking,
  porDominio,
}: {
  ranking: ContactoDelRanking[];
  porDominio: boolean;
}) {
  const [filtro, setFiltro] = useState("");

  const filas = useMemo(() => {
    const busqueda = filtro.trim().toLowerCase();
    if (!busqueda) return ranking;
    return ranking.filter(
      (f) =>
        f.contacto.toLowerCase().includes(busqueda) ||
        f.nombre.toLowerCase().includes(busqueda),
    );
  }, [ranking, filtro]);

  // Primera fila cuyo acumulado ya pasa del 80 %: ahí va la línea. Se calcula
  // sobre el ranking COMPLETO, no sobre lo filtrado: el 80 % del buzón no
  // cambia porque alguien escriba en el buscador.
  const corte80 = useMemo(() => {
    const indice = ranking.findIndex((f) => f.acumulado >= 80);
    return indice === -1 ? null : ranking[indice].contacto;
  }, [ranking]);

  const maximo = ranking[0]?.total ?? 0;

  if (!ranking.length) {
    return (
      <div className="rounded-md border px-3 py-8 text-center text-sm text-muted-foreground">
        No hay correo en este periodo.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {porDominio ? "Con qué empresas" : "Con quién"}
        </div>
        <Input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar contacto"
          className="h-8 w-56"
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                {porDominio ? "Empresa" : "Contacto"}
              </th>
              <th className="px-3 py-2 text-right font-medium">Recibidos</th>
              <th className="px-3 py-2 text-right font-medium">Enviados</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-right font-medium">% del total</th>
              <th className="px-3 py-2 text-right font-medium">Acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.map((fila) => (
              <FilaContacto
                key={fila.contacto}
                fila={fila}
                maximo={maximo}
                esCorte={fila.contacto === corte80}
              />
            ))}
          </tbody>
        </table>
      </div>

      {corte80 ? (
        <p className="text-xs text-muted-foreground">
          Por encima de la línea está el grupo de contactos que genera el 80 % del
          correo de este buzón. Es donde más se nota cualquier mejora.
        </p>
      ) : null}

      {ranking.length >= 100 ? (
        <p className="text-xs text-muted-foreground">
          Se enseñan los 100 contactos con más correo.
        </p>
      ) : null}
    </div>
  );
}

function FilaContacto({
  fila,
  maximo,
  esCorte,
}: {
  fila: ContactoDelRanking;
  maximo: number;
  esCorte: boolean;
}) {
  const ancho = maximo > 0 ? Math.max((fila.total / maximo) * 100, 2) : 0;

  return (
    <tr
      className={
        // La línea del 80 % se pinta DEBAJO de la fila que lo cruza: esa fila
        // todavía forma parte del grupo que genera la mayor parte del trabajo.
        esCorte ? "border-b-2 border-b-amber-500" : undefined
      }
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-foreground">
              {fila.nombre || fila.contacto}
            </div>
            {fila.nombre ? (
              <div className="truncate text-xs text-muted-foreground">
                {fila.contacto}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/60"
            style={{ width: `${ancho}%` }}
          />
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatoNumero(fila.entrantes)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {/* Cero enviados con muchos recibidos es una señal: ese contacto
            escribe y no se le contesta. Se marca sin alarmismo. */}
        {fila.salientes === 0 && fila.entrantes > 0 ? (
          <span className="text-muted-foreground">0</span>
        ) : (
          formatoNumero(fila.salientes)
        )}
      </td>
      <td className="px-3 py-2 text-right font-medium tabular-nums">
        {formatoNumero(fila.total)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
        {formatoPorcentaje(fila.porcentaje)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
        {formatoPorcentaje(fila.acumulado)}
      </td>
    </tr>
  );
}
