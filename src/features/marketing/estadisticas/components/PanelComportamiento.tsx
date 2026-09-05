"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { formatNumero } from "@/shared/lib/numero";
import { COMPORTAMIENTO_VACIO, type ComportamientoWeb } from "../types";

interface Props {
  /** Cuántos días hacia atrás. Lo manda el selector de arriba, para que la
   *  gráfica y estos números hablen SIEMPRE del mismo periodo. */
  dias: number;
  cargar: (dias: number) => Promise<
    { ok: true; data: ComportamientoWeb } | { ok: false; error: string }
  >;
}

/**
 * Qué hace la gente dentro de la web: qué botones pulsa, cuánto se queda y de
 * dónde llega.
 *
 * Es la mitad que faltaba. Saber que entraron 300 personas no dice si la web
 * funciona; saber que 40 pulsaron "Reservar" y que la media es de 1 min 20 s,
 * sí.
 */
export function PanelComportamiento({ dias, cargar }: Props) {
  const [datos, setDatos] = useState<ComportamientoWeb>(COMPORTAMIENTO_VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const res = await cargar(dias);
    if (res.ok) {
      setDatos(res.data);
    } else {
      setError(res.error);
      setDatos(COMPORTAMIENTO_VACIO);
    }
    setCargando(false);
  }, [dias, cargar]);

  useEffect(() => {
    void consultar();
  }, [consultar]);

  if (cargando) return <LoadingSpinner className="h-[200px]" size="lg" />;

  if (error) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  const maxClics = datos.botones[0]?.total ?? 0;
  const totalOrigenes = datos.origenes.reduce((acc, o) => acc + o.total, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Dato
          titulo="Tiempo medio"
          valor={
            datos.visitasMedidas > 0 ? formatearDuracion(datos.segundosMedios) : "—"
          }
          pie={
            datos.visitasMedidas > 0
              ? `Sobre ${formatNumero(datos.visitasMedidas)} visitas medidas`
              : "Aún sin visitas medidas"
          }
        />
        <Dato titulo="Clics en botones" valor={formatNumero(datos.clicsTotales)} />
        <Dato
          titulo="Se van sin tocar nada"
          /* `null` es "no se sabe todavía", no "cero". Un 0 % se leería como
             que nadie se va nunca, que es justo lo contrario. */
          valor={
            datos.porcentajeRebote === null
              ? "—"
              : `${formatNumero(datos.porcentajeRebote, { max: 0 })} %`
          }
        />
      </div>

      <Bloque titulo="Botones más pulsados">
        {datos.botones.length === 0 ? (
          <Vacio texto="Todavía no se ha pulsado ningún botón en este periodo." />
        ) : (
          <ul className="space-y-2">
            {datos.botones.slice(0, 10).map((b) => (
              <li key={b.destino} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm">{b.etiqueta}</span>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatNumero(b.total)}
                  </span>
                </div>
                {/* Barra: la lista de números sola no deja ver de un vistazo
                    cuál se lleva la mayoría de los clics. */}
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${maxClics > 0 ? (b.total / maxClics) * 100 : 0}%` }}
                  />
                </div>
                <p className="truncate text-xs text-muted-foreground">{b.destino}</p>
              </li>
            ))}
          </ul>
        )}
      </Bloque>

      <Bloque titulo="De dónde llega la gente">
        {datos.origenes.length === 0 ? (
          <Vacio texto="Todavía no hay visitas con origen conocido en este periodo." />
        ) : (
          <ul className="space-y-2">
            {datos.origenes.slice(0, 8).map((o) => (
              <li key={o.origen} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm capitalize">{o.origen}</span>
                <span className="shrink-0 text-sm tabular-nums">
                  <span className="font-medium">{formatNumero(o.total)}</span>
                  <span className="ml-2 text-muted-foreground">
                    {totalOrigenes > 0
                      ? `${formatNumero((o.total / totalOrigenes) * 100, { max: 0 })} %`
                      : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloque>
    </div>
  );
}

/**
 * Segundos a algo que se lee de un vistazo. "1 min 20 s" se entiende; "80 s"
 * obliga a dividir mentalmente cada vez que se mira.
 */
export function formatearDuracion(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  if (total < 60) return `${total} s`;
  const min = Math.floor(total / 60);
  const seg = total % 60;
  if (min < 60) return seg > 0 ? `${min} min ${seg} s` : `${min} min`;
  const horas = Math.floor(min / 60);
  return `${horas} h ${min % 60} min`;
}

function Dato({ titulo, valor, pie }: { titulo: string; valor: string; pie?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="text-xl font-semibold tabular-nums">{valor}</p>
      {pie && <p className="text-xs text-muted-foreground">{pie}</p>}
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      {children}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="text-sm text-muted-foreground">{texto}</p>;
}
