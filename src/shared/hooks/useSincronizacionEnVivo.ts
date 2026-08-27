"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * MOTOR DE SINCRONIZACIÓN EN VIVO
 * ================================
 * Mantiene una vista al día con lo que pasa en la base de datos, sin recargar.
 * Si alguien cambia algo desde otro sitio, la pantalla se entera y se refresca.
 *
 * Pensado para enchufarse en UNA línea a cualquier vista que ya sepa recargarse:
 *
 *   useSincronizacionEnVivo({ tablas: ["reservas"], onCambio: recargar });
 *
 * ── Por qué existe ────────────────────────────────────────────────────────────
 * Las vistas cargaban sus datos UNA vez y no volvían a mirar: te quedabas viendo
 * una foto vieja y decidías sobre ella (mover un candidato que ya no estaba en
 * esa fase, sentar una mesa que otro acababa de ocupar…). Esto lo cierra.
 *
 * ── Reglas que respeta ────────────────────────────────────────────────────────
 * · NO pisa lo que estás escribiendo. Si `pausado` es true (formulario abierto,
 *   edición en curso), los avisos se acumulan y se aplican al reanudar. Perder
 *   el trabajo a medias es peor que ver un dato con unos segundos de retraso.
 * · Agrupa ráfagas: diez cambios seguidos = una sola recarga, no diez.
 * · Filtra por empresa cuando la tabla lo permite, para no escuchar de más.
 * · Se limpia al desmontar: no deja suscripciones colgando.
 *
 * Requisito: la tabla debe estar en la publicación `supabase_realtime`. Las que
 * no lo estén simplemente no avisan (la vista sigue funcionando como antes).
 */

/** Sufijo incremental para que cada montaje tenga su propio canal. */
let contadorCanales = 0;

export interface SincronizacionEnVivoOpts {
  /** Tablas a vigilar. Un cambio en cualquiera dispara `onCambio`. */
  tablas: string[];
  /** Qué hacer cuando algo cambia. Normalmente, recargar los datos de la vista. */
  onCambio: () => void;
  /**
   * Empresa a la que limitar la escucha. Si se indica, solo llegan cambios de
   * esa empresa (menos ruido y menos tráfico). Omitir en tablas sin `empresa_id`.
   */
  empresaId?: string | null;
  /**
   * Mientras sea true no se refresca: los avisos se guardan y se aplican al
   * volver a false. Úsalo con un formulario abierto o una edición en curso.
   */
  pausado?: boolean;
  /** Desactiva la sincronización por completo. */
  desactivado?: boolean;
  /**
   * Margen para agrupar ráfagas de cambios, en ms. Por defecto 400: suficiente
   * para que diez escrituras seguidas provoquen una sola recarga.
   */
  margenMs?: number;
}

export function useSincronizacionEnVivo({
  tablas,
  onCambio,
  empresaId,
  pausado = false,
  desactivado = false,
  margenMs = 400,
}: SincronizacionEnVivoOpts): void {
  // La función de recarga se guarda en una ref: así puede cambiar en cada render
  // sin obligarnos a rehacer la suscripción (que es cara).
  const onCambioRef = useRef(onCambio);
  onCambioRef.current = onCambio;

  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Hubo cambios mientras estábamos pausados: se aplican al reanudar. */
  const pendienteRef = useRef(false);
  const pausadoRef = useRef(pausado);

  // Clave estable: sin esto, un array nuevo en cada render rehace la suscripción
  // constantemente (y se pierden avisos entre medias).
  const claveTablas = tablas.join(",");

  useEffect(() => {
    if (desactivado || tablas.length === 0) return;

    const supabase = createClient();
    // Nombre ÚNICO por montaje, no solo por (tablas + empresa).
    //
    // `supabase.channel(nombre)` NO crea uno nuevo si ya existe otro con ese
    // nombre: devuelve el que hay. Con un nombre fijo, dos vistas que vigilaran
    // las mismas tablas —o la misma vista mientras su canal anterior aún no se
    // había cerrado del todo— recuperaban un canal YA suscrito y le añadían
    // callbacks encima. Eso lanza:
    //
    //   cannot add `postgres_changes` callbacks for realtime:… after `subscribe()`
    //
    // La excepción sube durante el render, React aborta el árbol (error #310:
    // "cambió el número de hooks") y Next pinta su pantalla de error. Es el
    // "This page couldn't load" que salía al entrar en Mi Panel, donde varios
    // widgets montan este hook a la vez.
    const nombreCanal = `sync:${claveTablas}:${empresaId ?? "global"}:${++contadorCanales}`;
    const canal = supabase.channel(nombreCanal);

    const solicitarRecarga = () => {
      // Pausado (formulario abierto): se anota y se aplica al reanudar.
      if (pausadoRef.current) {
        pendienteRef.current = true;
        return;
      }
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
      temporizadorRef.current = setTimeout(() => {
        temporizadorRef.current = null;
        onCambioRef.current();
      }, margenMs);
    };

    // Blindaje: la sincronización en vivo es una COMODIDAD (ver los cambios sin
    // recargar). Si el canal falla, la vista debe seguir funcionando — nunca
    // tumbar la página entera, que es lo que pasaba: la excepción subía durante
    // el render y Next mostraba su pantalla de error.
    try {
      for (const tabla of claveTablas.split(",")) {
        canal.on(
          "postgres_changes",
          {
            event: "*", // altas, cambios y bajas
            schema: "public",
            table: tabla,
            ...(empresaId ? { filter: `empresa_id=eq.${empresaId}` } : {}),
          },
          solicitarRecarga,
        );
      }

      canal.subscribe();
    } catch (e) {
      console.error("[sincronizacion-en-vivo] no se pudo suscribir:", e);
    }

    return () => {
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
      temporizadorRef.current = null;
      try {
        void supabase.removeChannel(canal);
      } catch {
        /* el canal ya pudo cerrarse solo: nada que hacer */
      }
    };
  }, [claveTablas, empresaId, desactivado, margenMs, tablas.length]);

  // Al dejar de estar pausado, se aplica lo que llegó mientras tanto.
  useEffect(() => {
    pausadoRef.current = pausado;
    if (!pausado && pendienteRef.current) {
      pendienteRef.current = false;
      onCambioRef.current();
    }
  }, [pausado]);
}
