"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-actualizador de la PWA. En iOS la app instalada NO se recarga al
 * reabrirla (resucita el snapshot congelado), así que nunca veía los deploys
 * nuevos. Este componente compara la versión horneada en el bundle
 * (NEXT_PUBLIC_BUILD_SHA) contra la desplegada (/api/version) al abrir la app,
 * al volver a ella y cada minuto.
 *
 * Recarga "sin sacarte": si detecta versión nueva MIENTRAS estás usando la app,
 * NO recarga en ese momento (te mandaría al inicio a media acción). Marca la
 * actualización como pendiente y la aplica en cuanto la app pasa a segundo plano
 * o cuando vuelves a ella —momentos en los que una recarga no interrumpe nada—.
 *
 * iOS standalone: al reabrir la app, iOS suele restaurar el snapshot congelado
 * SIN disparar `visibilitychange` ni `focus` (por eso antes no se actualizaba y
 * había que cerrarla y abrirla a mano). El evento fiable en ese caso es
 * `pageshow` con `event.persisted === true` (restauración desde bfcache), que sí
 * escuchamos aquí: al volver así, comprobamos versión (o aplicamos la pendiente).
 *
 * Sin UI: devuelve null.
 */
const BAKED = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
const CHECK_MS = 60 * 1000; // re-chequeo periódico mientras está abierta
const RELOADED_KEY = "bh_reloaded_for_sha";

export function VersionAutoUpdate() {
  const comprobando = useRef(false);
  // SHA nuevo detectado pero aún no aplicado (app en primer plano en uso).
  const pendiente = useRef<string | null>(null);
  // ¿Es el primer chequeo tras montar? Entonces la app se acaba de abrir y una
  // recarga es segura (no interrumpe nada en curso).
  const primerChequeo = useRef(true);

  useEffect(() => {
    // En desarrollo (o si no hay SHA horneada) no auto-recargamos.
    if (!BAKED || BAKED === "dev") return;

    const recargar = (sha: string) => {
      // Anti-bucle: si ya recargamos por este mismo SHA y el bundle sigue sin
      // coincidir (propagación de CDN en curso), no recargamos otra vez.
      try {
        if (sessionStorage.getItem(RELOADED_KEY) === sha) return;
        sessionStorage.setItem(RELOADED_KEY, sha);
      } catch {
        /* noop */
      }
      window.location.reload();
    };

    /**
     * ¿El servidor sigue reconociendo esta sesión?
     *
     * La PWA de iOS resucita un snapshot congelado al reabrirse: la pantalla te
     * muestra dentro aunque la sesión esté muerta en el servidor. Así, el botón
     * de cerrar sesión "no hace nada" —no queda nada que cerrar— y el usuario se
     * queda atrapado en una app que solo existe en la foto (Iván, 05-ago).
     *
     * Si el servidor ya no la reconoce, se sale al login sin preguntar.
     */
    const comprobarSesion = async () => {
      try {
        const res = await fetch("/api/auth/estado", { cache: "no-store" });
        if (!res.ok) return;
        const { autenticado } = (await res.json()) as { autenticado?: boolean };
        if (autenticado === false) {
          window.location.replace("/?logout=1");
        }
      } catch {
        // Sin red: no se concluye nada. Mejor dejar la app como está que echar
        // a alguien por un corte de cobertura.
      }
    };

    const comprobar = async () => {
      if (comprobando.current) return;
      comprobando.current = true;
      const eraPrimero = primerChequeo.current;
      primerChequeo.current = false;
      try {
        // Primero la sesión: no tiene sentido actualizar una app a la que ya no
        // se puede entrar.
        void comprobarSesion();

        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { sha } = (await res.json()) as { sha?: string };
        if (!sha || sha === "dev" || sha === BAKED) return;

        // Hay versión nueva. Solo recargamos "sin sacar":
        //  · en el primer chequeo (la app se acaba de abrir), o
        //  · si la app está oculta (segundo plano).
        // Si estás usándola (visible y no es el arranque), lo dejamos pendiente
        // y lo aplicamos al pasar a segundo plano o al volver.
        if (eraPrimero || document.visibilityState !== "visible") {
          recargar(sha);
        } else {
          pendiente.current = sha;
        }
      } catch {
        /* sin red: lo reintentamos en el próximo ciclo */
      } finally {
        comprobando.current = false;
      }
    };

    // Al mandar la app a segundo plano con una actualización pendiente, es el
    // momento seguro para recargar: al volver ya verás la versión nueva y no te
    // hemos cortado nada.
    const onHidden = () => {
      if (document.visibilityState === "hidden" && pendiente.current) {
        recargar(pendiente.current);
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Si volviste y había algo pendiente, aplícalo ahora (acabas de entrar,
      // no interrumpe nada). Si no, comprueba por si hubo un deploy nuevo.
      if (pendiente.current) recargar(pendiente.current);
      else void comprobar();
    };

    // Restauración del snapshot en iOS standalone (bfcache). Es un "reingreso":
    // tratamos la próxima comprobación como segura para recargar de inmediato
    // (como el primer arranque), porque el usuario acaba de volver a la app.
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      if (pendiente.current) {
        recargar(pendiente.current);
        return;
      }
      primerChequeo.current = true;
      void comprobar();
    };

    // Al montar (app recién abierta), al volver a primer plano y cada minuto.
    void comprobar();
    document.addEventListener("visibilitychange", onHidden);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    const id = window.setInterval(comprobar, CHECK_MS);

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
