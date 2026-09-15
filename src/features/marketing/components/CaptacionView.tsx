"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  resumenClientes,
  variacion,
} from "@/features/marketing/captacion/lib/agregados";
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
 * Responde cuatro preguntas, en este orden:
 *   1. ¿Cómo vamos este año? (las cuatro cifras de arriba)
 *   2. ¿De dónde vinieron las reservas, año a año? (las dos gráficas)
 *   3. ¿Qué canal sube y cuál baja, con sus números? (la tabla comparativa)
 *   4. ¿Qué canal trae buena reserva y qué base de clientes deja? (las dos
 *      últimas tablas)
 *
 * "Hoy" se decide en la zona horaria de la EMPRESA, no en la del navegador: es
 * lo que fija hasta qué mes llega el año en curso y con qué tramo del año
 * pasado se compara.
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

  if (cargando) return <LoadingSpinner className="py-24" size="lg" />;

  const hayDatos = datos.porMes.length > 0;

  return (
    <div className="space-y-6 p-4 pb-28 md:p-6">
      {!hayDatos ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Todavía no hay reservas con canal anotado en esta empresa.
          </CardContent>
        </Card>
      ) : (
        <>
          <TarjetasResumen tarjetas={tarjetas} />

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">De dónde vinieron las reservas</CardTitle>
              </CardHeader>
              <CardContent>
                <GraficaCanalesAnio porMes={datos.porMes} anioEnCurso={anioEnCurso} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Qué canal sube y cuál baja</CardTitle>
              </CardHeader>
              <CardContent>
                <GraficaTendenciaCanales porMes={datos.porMes} anioEnCurso={anioEnCurso} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Todos los canales, año a año</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TablaComparativa
                porMes={datos.porMes}
                anioEnCurso={anioEnCurso}
                hastaMes={mesEnCurso}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Qué reserva trae cada canal</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <TablaCalidad calidad={datos.calidad} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">La clientela que deja cada canal</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <TablaClientes clientes={datos.clientes} />
              </CardContent>
            </Card>
          </div>

          {(datos.sinOrigen.reservas > 0 || datos.sinOrigen.clientes > 0) && (
            <p className="text-xs text-muted-foreground">
              Fuera de estas cuentas quedan{" "}
              {formatNumero(datos.sinOrigen.reservas)} reservas y{" "}
              {formatNumero(datos.sinOrigen.clientes)} fichas de cliente sin canal
              anotado: de esas no se sabe por dónde entraron.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Las cuatro cifras de arriba, con su comparación contra el año pasado. */
function construirTarjetas(
  datos: CaptacionDatos,
  anio: number,
  mes: number,
): Tarjeta[] {
  const { actual, anterior } = compararMismoTramo(datos.porMes, anio, mes);

  const principal = rankingCanales(
    datos.porMes.filter((m) => m.anio === anio),
  )[0];
  const reservasPrincipal = datos.porMes
    .filter((m) => m.anio === anio && m.canal === principal)
    .reduce((s, m) => s + m.reservas, 0);
  const pesoPrincipal =
    actual.reservas > 0 ? (reservasPrincipal / actual.reservas) * 100 : 0;

  const totalCalidad = datos.calidad.reduce((s, c) => s + c.reservas, 0);
  const noShow = datos.calidad.reduce((s, c) => s + c.noShow, 0);
  const pctNoShow = totalCalidad > 0 ? (noShow / totalCalidad) * 100 : 0;

  const clientes = resumenClientes(datos);

  return [
    {
      etiqueta: "Reservas en lo que va de año",
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
      etiqueta: "Canal principal",
      valor: principal ? labelOrigen(principal) : "—",
      pie: principal
        ? `${formatPorcentaje(pesoPrincipal, { max: 0 })} de las reservas de ${anio}`
        : "Sin reservas este año",
    },
    {
      etiqueta: "No aparecen",
      valor: formatPorcentaje(pctNoShow, { max: 1 }),
      subirEsMalo: true,
      pie: `${formatNumero(clientes.total)} fichas de cliente, ${formatNumero(clientes.repiten)} han vuelto`,
    },
  ];
}
