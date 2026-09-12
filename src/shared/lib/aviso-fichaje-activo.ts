"use client";

import { useSyncExternalStore } from "react";

/**
 * ¿Hay ahora mismo un aviso de fichaje en pantalla?
 *
 * EL FICHAJE MANDA. Los avisos de la app (comunicados, liquidaciones) se
 * pintan con un AlertDialog de Radix, que es MODAL: mientras está abierto,
 * Radix pone `pointer-events: none` en el `body` para que nada de fuera reciba
 * toques. El aviso de fichar vive fuera de ese diálogo, así que se veía encima
 * (z-60 contra z-50) pero NO se podía pulsar: Iván y Farid le daban al botón
 * verde a su hora de entrada y no pasaba nada (12-09-2026).
 *
 * Con esta marca, mientras toca fichar los avisos esperan su turno: en cuanto
 * se ficha (o se pospone el aviso) vuelven a salir, sin perderse ninguno.
 */
let activo = false;
const suscriptores = new Set<() => void>();

export function setAvisoFichajeActivo(valor: boolean): void {
  if (activo === valor) return;
  activo = valor;
  for (const f of suscriptores) f();
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
    () => activo,
    () => false,
  );
}
