"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * ¿Hay ahora mismo una capa de fichaje en pantalla?
 *
 * EL FICHAJE MANDA. Los avisos de la app (comunicados, liquidaciones) se
 * pintan con diálogos MODALES de Radix: mientras están abiertos, Radix deja el
 * `body` en `pointer-events: none` para que nada de fuera reciba toques. El
 * aviso de fichar vive fuera de ese diálogo, así que se veía encima (z-60
 * contra z-50) pero NO se podía pulsar: Iván y Farid le daban al botón verde a
 * su hora de entrada y no pasaba nada (12-09-2026).
 *
 * Quien publica esta marca es `CapaFichaje`, y lo hace sola por el hecho de
 * estar montada: así nadie tiene que acordarse de encenderla ni apagarla.
 * Mientras esté encendida, cualquier aviso de la app espera su turno.
 *
 * Es un CONTADOR, no un booleano: sobre el aviso de fichar se abren sus propias
 * hojas (confirmar entrada, elegir tipo, motivo de salida…). Al cerrarse una,
 * las demás siguen en pantalla y la marca no puede apagarse antes de tiempo.
 */
let capasMontadas = 0;
const suscriptores = new Set<() => void>();

function avisar(): void {
  for (const f of suscriptores) f();
}

/** La llama `CapaFichaje` al montarse; devuelve el apagado. */
export function registrarCapaFichaje(): () => void {
  capasMontadas += 1;
  avisar();
  let liberada = false;
  return () => {
    if (liberada) return;
    liberada = true;
    capasMontadas -= 1;
    avisar();
  };
}

/** Marca la capa mientras el componente esté montado. */
export function useCapaFichajeMontada(): void {
  useEffect(() => registrarCapaFichaje(), []);
}

function subscribe(f: () => void): () => void {
  suscriptores.add(f);
  return () => {
    suscriptores.delete(f);
  };
}

export function useAvisoFichajeActivo(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => capasMontadas > 0,
    () => false,
  );
}
