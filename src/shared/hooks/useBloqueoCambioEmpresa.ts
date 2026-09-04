"use client";

import { useEffect, useRef } from "react";
import { useGlobalLoading } from "@/shared/stores/use-global-loading";

/**
 * MANTIENE EL RECUADRO DE CARGA HASTA QUE LA VISTA TIENE SUS DATOS
 * ================================================================
 * Al cambiar de empresa, el software tapa la pantalla con el recuadro de
 * "Cargando…" para que nadie toque nada mientras llega la otra empresa. Ese
 * recuadro se quitaba con un temporizador fijo de 900 ms, sin mirar si los
 * datos habían llegado: en Reservas —que es de lo más pesado que hay— siempre
 * se destapaba antes de tiempo. Durante unos segundos se veían, y se podían
 * pulsar, las reservas del restaurante ANTERIOR.
 *
 * Este hook lo cierra: la vista declara si está cargando y, mientras lo esté
 * después de un cambio de empresa, el recuadro sigue puesto. Se suelta solo
 * cuando la vista termina, se desmonta, o al llegar al tope de seguridad —para
 * que un fallo de red no deje la pantalla bloqueada para siempre.
 *
 *   useBloqueoCambioEmpresa(loading);
 */

/** Tope de seguridad: nunca se bloquea más de esto, pase lo que pase. */
const MAX_BLOQUEO_MS = 15_000;

export function useBloqueoCambioEmpresa(cargando: boolean): void {
  const seq = useGlobalLoading((s) => s.cambioEmpresaSeq);
  const show = useGlobalLoading((s) => s.show);
  const hide = useGlobalLoading((s) => s.hide);

  // Ojo: al cambiar de empresa la vista se REMONTA (el layout la recrea con la
  // empresa nueva como clave), así que nace ya con el contador subido y
  // "recién montada y cargando" ES el caso a cubrir. Se arranca en `seq - 1`
  // sólo si ya hubo algún cambio de empresa en esta sesión (`seq > 0`); en una
  // entrada normal a la vista se arranca al día y no se tapa nada, que para eso
  // cada módulo ya tiene su propia pantalla de carga.
  const seqAtendida = useRef(seq > 0 ? seq - 1 : seq);
  /** ¿Tenemos ahora mismo un bloqueo pedido por NOSOTROS? */
  const reteniendo = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const soltar = () => {
      if (!reteniendo.current) return;
      reteniendo.current = false;
      if (temporizador.current) {
        clearTimeout(temporizador.current);
        temporizador.current = null;
      }
      hide();
    };

    // Cambió la empresa y esta vista aún no ha recargado: retenemos.
    if (seq !== seqAtendida.current) {
      seqAtendida.current = seq;
      if (cargando && !reteniendo.current) {
        reteniendo.current = true;
        show("Cambiando de empresa…");
        temporizador.current = setTimeout(soltar, MAX_BLOQUEO_MS);
      }
      return;
    }

    // Ya cargó: se suelta el bloqueo y la pantalla vuelve a ser usable.
    if (!cargando) soltar();
  }, [seq, cargando, show, hide]);

  // Desmontar (salir del módulo a media carga) no debe dejar el recuadro puesto.
  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      if (reteniendo.current) {
        reteniendo.current = false;
        hide();
      }
    };
  }, [hide]);
}
