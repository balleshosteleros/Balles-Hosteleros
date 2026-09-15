/**
 * La tipografía del informe de captación.
 *
 * Las tres familias se cargan en `app/(main)/marketing/captacion/page.tsx` con
 * `next/font` y quedan expuestas como variables CSS; aquí solo se nombran para
 * no repetir la pila de reserva en cada componente. Se usan EN ESTA PANTALLA:
 * el resto del software sigue con su Inter.
 */

export const TITULAR = {
  fontFamily: 'var(--fuente-titulares), "Helvetica Neue", Arial, sans-serif',
} as const;

export const TEXTO = {
  fontFamily: 'var(--fuente-texto), Georgia, "Times New Roman", serif',
} as const;

export const CIFRA = {
  fontFamily: 'var(--fuente-cifras), ui-monospace, SFMono-Regular, monospace',
  fontVariantNumeric: "tabular-nums",
} as const;

/** Gris del montón que agrupa los canales pequeños de la gráfica. */
export const COLOR_RESTO = "#94a3b8";

/** Cuántos canales llevan color propio; el resto va al montón. */
export const CANALES_CON_COLOR = 7;
