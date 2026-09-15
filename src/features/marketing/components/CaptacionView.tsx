"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { labelOrigen } from "@/features/sala/data/origenes";
import { formatNumero, formatPorcentaje } from "@/shared/lib/numero";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { cargarCaptacion } from "@/features/marketing/captacion/actions";
import { CAPTACION_VACIA, type CaptacionDatos } from "@/features/marketing/captacion/types";
import {
  compararMismoTramo,
  rankingCanales,
  variacion,
} from "@/features/marketing/captacion/lib/agregados";
import { construirHallazgos } from "@/features/marketing/captacion/lib/hallazgos";
import { TEXTO, TITULAR } from "@/features/marketing/captacion/lib/estilo";
import {
  TarjetasResumen,
  type Tarjeta,
} from "@/features/marketing/captacion/components/TarjetasResumen";
import { GraficaCanalesAnio } from "@/features/marketing/captacion/components/GraficaCanalesAnio";
import { GraficaTendenciaCanales } from "@/features/marketing/captacion/components/GraficaTendenciaCanales";
import { TablaComparativa } from "@/features/marketing/captacion/components/TablaComparativa";
import { TablaCalidad } from "@/features/marketing/captacion/components/TablaCalidad";
import { TablaClientes } from "@/features/marketing/captacion/components/TablaClientes";

/**
 * Marketing → Captación: por dónde entra la gente, comparado con los años
 * anteriores.
 *
 * Está maquetada como un INFORME y no como un panel de widgets: se lee de
 * arriba abajo, cada bloque es una pregunta y la siguiente contesta a la
 * anterior. De ahí la tipografía propia (ver `page.tsx`), las secciones
 * separadas por una regla y los hallazgos escritos en palabras al final.
 *
 *   1. ¿Cómo vamos este año?          → las cuatro cifras
 *   2. ¿De dónde vinieron?            → la gráfica apilada
 *   3. ¿Qué sube y qué baja?          → la gráfica de líneas y la tabla
 *   4. ¿Qué trae cada canal?          → calidad de la reserva y clientela
 *   5. ¿Y entonces qué miro?          → los hallazgos, sacados de los datos
 *
 * "Hoy" se decide en la zona horaria de la EMPRESA: es lo que fija hasta qué
 * mes llega el año en curso y con qué tramo del año pasado se compara.
 */

export function CaptacionView() {
  const { empresaActual } = useEmpresa();
  const [datos, setDatos] = useState<CaptacionDatos>(CAPTACION_VACIA);
  const [cargando, setCargando] = useState(true);

  const hoy = hoyEnZona(empresaActual.zonaHoraria);
  const [anioEnCurso, mesEnCurso] = hoy.split("-").map(Number);

  const cargar = useCallback(async () => {
    try {
      const res = await cargarCaptacion();
      if (!res.ok) {
        toast.error("No se han podido cargar los datos de captación", {
          description: res.error,
        });
        return;
      }
      setDatos(res.datos);
    } catch (err) {
      toast.error("No se han podido cargar los datos de captación", {
        description: friendlyError(err, "CaptacionView"),
      });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const tarjetas = useMemo(
    () => construirTarjetas(datos, anioEnCurso, mesEnCurso),
    [datos, anioEnCurso, mesEnCurso],
  );
  const hallazgos = useMemo(
    () => construirHallazgos(datos, anioEnCurso, mesEnCurso),
    [datos, anioEnCurso, mesEnCurso],
  );

  if (cargando) return <LoadingSpinner className="py-24" size="lg" />;

  if (datos.porMes.length === 0) {
    return (
      <div className="p-6">
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Todavía no hay reservas con canal anotado en esta empresa.
        </p>
      </div>
    );
  }

  const totalReservas = datos.porMes.reduce((s, m) => s + m.reservas, 0);
  const totalFichas = datos.clientes.reduce((s, c) => s + c.clientes, 0);
  const primerAnio = Math.min(...datos.porMes.map((m) => m.anio));

  return (
    <div
      className="mx-auto flex max-w-[1080px] flex-col gap-10 p-4 pb-28 md:p-6"
      style={TEXTO}
    >
      <p className="max-w-[62ch] text-[1.02rem] leading-relaxed text-muted-foreground">
        Todas las reservas de {empresaActual.nombre} desde {primerAnio}, repartidas por el
        canal que las trajo: {formatNumero(totalReservas)} reservas y{" "}
        {formatNumero(totalFichas)} fichas de cliente. {anioEnCurso} va hasta hoy, así que
        cuando se compara con años anteriores se compara contra el mismo tramo.
      </p>

      <TarjetasResumen tarjetas={tarjetas} />

      <Seccion titulo="Qué trajo cada canal, año a año" apunte="Reservas, apiladas por canal">
        <Marco>
          <GraficaCanalesAnio porMes={datos.porMes} anioEnCurso={anioEnCurso} />
        </Marco>
      </Seccion>

      <Seccion titulo="Cuál sube y cuál baja" apunte="Cada canal por su cuenta">
        <Marco>
          <GraficaTendenciaCanales porMes={datos.porMes} anioEnCurso={anioEnCurso} />
        </Marco>
      </Seccion>

      <Seccion titulo="Todos los canales, con sus números" apunte="Reservas por año">
        <Caja>
          <TablaComparativa
            porMes={datos.porMes}
            anioEnCurso={anioEnCurso}
            hastaMes={mesEnCurso}
          />
        </Caja>
      </Seccion>

      <Seccion titulo="Qué reserva trae cada canal" apunte="Últimos dos años">
        <Caja>
          <TablaCalidad calidad={datos.calidad} />
        </Caja>
      </Seccion>

      <Seccion titulo="La clientela que deja cada canal" apunte="Fichas, no reservas">
        <Caja>
          <TablaClientes clientes={datos.clientes} />
        </Caja>
      </Seccion>

      {hallazgos.length > 0 && (
        <Seccion titulo="Lo que hay que mirar" apunte="Sacado de los números de arriba">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {hallazgos.map((h) => (
              <article
                key={h.titulo}
                className="flex flex-col gap-2 rounded-lg border bg-card p-5"
              >
                <p
                  className="text-[.72rem] font-medium uppercase tracking-[.09em] text-primary"
                  style={TITULAR}
                >
                  {h.rotulo}
                </p>
                <h3 className="text-[1.02rem] font-bold leading-snug" style={TITULAR}>
                  {h.titulo}
                </h3>
                <p className="text-[.92rem] leading-relaxed text-muted-foreground" style={TEXTO}>
                  {h.texto}
                </p>
              </article>
            ))}
          </div>
        </Seccion>
      )}

      <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        Los años anteriores a que se pusiera en marcha el software salen del histórico que
        se trajo de CoverManager, con su canal traducido al de aquí; de ahí en adelante son
        las reservas de este sistema. Quedan fuera de estas cuentas{" "}
        {formatNumero(datos.sinOrigen.reservas)} reservas y{" "}
        {formatNumero(datos.sinOrigen.clientes)} fichas de cliente sin canal anotado: de
        esas no se sabe por dónde entraron.
      </p>
    </div>
  );
}

/** Bloque del informe: regla arriba, título y apunte en la misma línea. */
function Seccion({
  titulo,
  apunte,
  children,
}: {
  titulo: string;
  apunte: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3 border-t pt-4">
        <h2 className="text-[1.35rem] font-bold tracking-tight" style={TITULAR}>
          {titulo}
        </h2>
        <p className="text-sm text-muted-foreground" style={TITULAR}>
          {apunte}
        </p>
      </div>
      {children}
    </section>
  );
}

/** Caja de gráfica: con aire alrededor del dibujo. */
function Marco({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border bg-card p-5">{children}</div>;
}

/** Caja de tabla: sin aire, la tabla llega hasta el borde. */
function Caja({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border bg-card">{children}</div>;
}

/** Las cuatro cifras de arriba, con su comparación contra el año pasado. */
function construirTarjetas(
  datos: CaptacionDatos,
  anio: number,
  mes: number,
): Tarjeta[] {
  const { actual, anterior } = compararMismoTramo(datos.porMes, anio, mes);

  const principal = rankingCanales(datos.porMes.filter((m) => m.anio === anio))[0];
  const reservasPrincipal = datos.porMes
    .filter((m) => m.anio === anio && m.canal === principal)
    .reduce((s, m) => s + m.reservas, 0);
  const pesoPrincipal =
    actual.reservas > 0 ? (reservasPrincipal / actual.reservas) * 100 : 0;

  const totalCalidad = datos.calidad.reduce((s, c) => s + c.reservas, 0);
  const noShow = datos.calidad.reduce((s, c) => s + c.noShow, 0);
  const canceladas = datos.calidad.reduce((s, c) => s + c.canceladas, 0);
  const pctNoShow = totalCalidad > 0 ? (noShow / totalCalidad) * 100 : 0;
  const pctCancela = totalCalidad > 0 ? (canceladas / totalCalidad) * 100 : 0;

  return [
    {
      etiqueta: `Reservas en lo que va de ${anio}`,
      valor: formatNumero(actual.reservas),
      variacion: variacion(actual.reservas, anterior.reservas),
      pie: `Frente a ${formatNumero(anterior.reservas)} en el mismo tramo de ${anio - 1}`,
    },
    {
      etiqueta: "Comensales",
      valor: formatNumero(actual.comensales),
      variacion: variacion(actual.comensales, anterior.comensales),
      pie: `Frente a ${formatNumero(anterior.comensales)} en el mismo tramo de ${anio - 1}`,
    },
    {
      etiqueta: `Canal principal en ${anio}`,
      valor: principal ? labelOrigen(principal) : "—",
      pie: principal
        ? `${formatPorcentaje(pesoPrincipal, { max: 0 })} de las reservas del año`
        : "Sin reservas este año",
    },
    {
      etiqueta: "Mesas que se pierden",
      valor: formatPorcentaje(pctNoShow, { max: 1 }),
      subirEsMalo: true,
      pie: `No aparecen. Otro ${formatPorcentaje(pctCancela, { max: 0 })} cancela y avisa`,
    },
  ];
}
