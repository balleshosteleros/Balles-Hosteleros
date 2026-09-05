"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { formatearFechaEs } from "@/shared/lib/fecha";
import { formatNumero } from "@/shared/lib/numero";
import { GraficaActividad } from "./GraficaActividad";
import { RANGOS } from "../rangos";
import { SERIE_VACIA, type SerieEstadisticas } from "../types";

interface Props {
  /** Qué se está midiendo: el QR o la página web. */
  titulo: string;
  /** A dónde apunta, bajo el título. */
  subtitulo?: string;
  /** Nombre de lo que se cuenta, en plural: "escaneos", "visitas". */
  unidad: string;
  /** Consulta el periodo. La inyecta quien usa el panel (QR o web). Recibe
   *  cuántos días hacia atrás: las fechas exactas las decide el servidor con la
   *  zona horaria de la empresa. */
  cargar: (dias: number) => Promise<
    { ok: true; data: SerieEstadisticas } | { ok: false; error: string }
  >;
  /**
   * Contenido extra bajo la gráfica, al que se le pasa el periodo elegido
   * arriba. Sirve para que el panel de comportamiento de la web (botones,
   * tiempo, orígenes) hable SIEMPRE del mismo tramo que la gráfica: con dos
   * selectores separados, los números de la misma pantalla se contradirían.
   * Los QR no lo usan: no tienen botones dentro.
   */
  extra?: (dias: number) => React.ReactNode;
}

/**
 * Panel de actividad compartido por los QR y las páginas web: la gráfica, el
 * total del periodo y el reparto por aparato.
 *
 * Es un solo componente para las dos cosas a propósito. Son la misma pregunta
 * ("cuánta gente entra y cuándo") y mantener dos gráficas distintas acabaría
 * con dos aspectos distintos para el mismo dato.
 */
export function PanelEstadisticas({ titulo, subtitulo, unidad, cargar, extra }: Props) {
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState<SerieEstadisticas>(SERIE_VACIA);
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
      setDatos(SERIE_VACIA);
    }
    setCargando(false);
  }, [dias, cargar]);

  useEffect(() => {
    void consultar();
  }, [consultar]);

  const d = datos.dispositivos;
  const totalAparatos = d.movil + d.tablet + d.escritorio + d.otro;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{titulo}</h3>
          {subtitulo && (
            <p className="truncate text-sm text-muted-foreground">{subtitulo}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {RANGOS.map((r) => (
            <button
              key={r.dias}
              type="button"
              onClick={() => setDias(r.dias)}
              className={
                dias === r.dias
                  ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  : "rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <LoadingSpinner className="h-[260px]" size="lg" />
      ) : error ? (
        <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {error}
        </div>
      ) : (
        <>
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {unidad}
            </p>
            <p className="text-3xl font-semibold tabular-nums">
              {formatNumero(datos.total)}
            </p>
            <p className="text-xs text-muted-foreground">
              Del {formatearFechaEs(datos.desde)} al {formatearFechaEs(datos.hasta)}
            </p>

            <div className="mt-4">
              <GraficaActividad datos={datos} unidad={unidad} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Dato
              titulo="Media al día"
              valor={formatNumero(datos.media, { min: 1, max: 1 })}
            />
            <Dato
              titulo="Mejor día"
              valor={
                datos.mejorDia
                  ? `${formatNumero(datos.mejorDia.total)}`
                  : "—"
              }
              pie={datos.mejorDia ? formatearFechaEs(datos.mejorDia.fecha) : undefined}
            />
            <Dato
              titulo="Desde el móvil"
              valor={
                totalAparatos > 0
                  ? `${formatNumero((d.movil / totalAparatos) * 100, { max: 0 })} %`
                  : "—"
              }
            />
          </div>

          {totalAparatos > 0 && (
            <div className="flex flex-wrap gap-4 rounded-xl border p-4 text-sm">
              <Aparato icono={<Smartphone className="h-4 w-4" />} label="Móvil" valor={d.movil} />
              <Aparato icono={<Tablet className="h-4 w-4" />} label="Tablet" valor={d.tablet} />
              <Aparato icono={<Monitor className="h-4 w-4" />} label="Ordenador" valor={d.escritorio} />
              {d.otro > 0 && <Aparato label="Otros" valor={d.otro} />}
            </div>
          )}

          {extra?.(dias)}
        </>
      )}
    </div>
  );
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

function Aparato({
  icono,
  label,
  valor,
}: {
  icono?: React.ReactNode;
  label: string;
  valor: number;
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {icono}
      <span>{label}</span>
      <span className="font-medium tabular-nums text-foreground">
        {formatNumero(valor)}
      </span>
    </div>
  );
}
