"use client";

import { useEffect } from "react";

/**
 * Mide qué hace el visitante: qué botones pulsa y cuánto tiempo está.
 *
 * UN SOLO SITIO, no un contador metido en cada botón. Los enlaces están
 * repartidos por veinte bloques distintos (hero, footer, WhatsApp, mapa...) y
 * tocarlos uno a uno significaría que cada bloque nuevo nazca sin medir. Aquí
 * se escucha el clic en la raíz del documento y se mira qué enlace o botón lo
 * originó, así que cualquier bloque que se añada mañana ya está contado.
 *
 * NO guarda cookies ni identificadores: manda "han pulsado este botón" y
 * "esta visita duró X segundos", y el servidor solo suma al contador del día.
 */

interface Props {
  paginaId: string | null;
}

/** Manda el evento sin bloquear la navegación ni retrasar el cierre. */
function enviar(cuerpo: unknown, alCerrar = false): void {
  const url = "/api/pagina-web/analitica";
  const json = JSON.stringify(cuerpo);

  // Al cerrar la pestaña, `fetch` se cancela con la página: sendBeacon es la
  // única vía que el navegador garantiza que sale.
  if (alCerrar && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([json], { type: "application/json" }));
    return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json,
    keepalive: true,
  }).catch(() => {
    // Medir es secundario. Si falla, el visitante no se entera de nada.
  });
}

/** Texto con el que se reconoce el botón en el panel. */
function etiquetaDe(el: HTMLElement): string {
  const propia =
    el.getAttribute("aria-label") ??
    el.getAttribute("title") ??
    el.textContent ??
    "";
  return propia.replace(/\s+/g, " ").trim().slice(0, 120);
}

export function MedidorWeb({ paginaId }: Props) {
  useEffect(() => {
    if (!paginaId) return;

    // ── Clics ────────────────────────────────────────────────────────────
    const onClick = (ev: MouseEvent) => {
      const origen = ev.target as HTMLElement | null;
      const el = origen?.closest?.("a[href], button") as HTMLElement | null;
      if (!el) return;

      const destino =
        el.tagName === "A"
          ? (el as HTMLAnchorElement).getAttribute("href") ?? ""
          : `botón: ${etiquetaDe(el) || "sin nombre"}`;

      if (!destino) return;
      // El aviso de cookies y el enlace de configurarlas no son contenido de la
      // web: contarlos como "botones más pulsados" taparía los que importan.
      if (destino.startsWith("#") && destino.length <= 1) return;

      enviar({
        tipo: "clic",
        paginaId,
        destino: destino.slice(0, 300),
        etiqueta: etiquetaDe(el),
      });
    };

    // ── Tiempo ───────────────────────────────────────────────────────────
    // Se cuenta el tiempo VISIBLE, no el que la pestaña llevaba abierta: una
    // pestaña olvidada en segundo plano toda la tarde no es alguien mirando la
    // carta, y esa media no le sirve a nadie.
    let visibleDesde = document.visibilityState === "visible" ? Date.now() : 0;
    let acumulado = 0;
    let interactuo = false;
    let enviado = false;

    const marcarInteraccion = () => {
      interactuo = true;
    };

    const acumular = () => {
      if (visibleDesde > 0) {
        acumulado += Date.now() - visibleDesde;
        visibleDesde = 0;
      }
    };

    const cerrar = () => {
      // Una sola vez: el navegador puede disparar `pagehide` y `visibilitychange`
      // seguidos al cerrar, y se contaría la misma visita dos veces.
      if (enviado) return;
      acumular();
      const segundos = Math.round(acumulado / 1000);
      if (segundos < 2) return;
      enviado = true;
      enviar(
        { tipo: "tiempo", paginaId, segundos: Math.min(segundos, 7200), interactuo },
        true,
      );
    };

    const onVisibilidad = () => {
      if (document.visibilityState === "visible") {
        // Si vuelve tras haber enviado, se sigue contando desde cero para no
        // perder la vuelta, pero ya no se reenvía lo anterior.
        if (visibleDesde === 0) visibleDesde = Date.now();
      } else {
        cerrar();
      }
    };

    document.addEventListener("click", onClick, true);
    // Bajar por la página también es interés: quien lee hasta el final no ha
    // rebotado aunque no pulse nada.
    window.addEventListener("scroll", marcarInteraccion, { passive: true, once: true });
    document.addEventListener("click", marcarInteraccion, { once: true });
    document.addEventListener("visibilitychange", onVisibilidad);
    window.addEventListener("pagehide", cerrar);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", marcarInteraccion);
      document.removeEventListener("click", marcarInteraccion);
      document.removeEventListener("visibilitychange", onVisibilidad);
      window.removeEventListener("pagehide", cerrar);
      cerrar();
    };
  }, [paginaId]);

  return null;
}
