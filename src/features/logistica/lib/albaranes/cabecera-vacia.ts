/**
 * Estado inicial de la cabecera de un albarán, antes de que el OCR lea nada.
 *
 * Vive en su propio módulo (y no en `ocr-albaran.ts`) porque aquel es `server-only`:
 * los tipos se borran al compilar, pero una CONSTANTE es un valor en runtime y
 * arrastraría el módulo de servidor al bundle del cliente.
 */

import type { CabeceraOcrAlbaran } from "./ocr-albaran";

export const CABECERA_OCR_VACIA: CabeceraOcrAlbaran = {
  proveedor: null,
  numero: null,
  fecha: null,
  total: null,
  baseImponible: null,
  fiscal: {
    cifNif: null,
    razonSocial: null,
    direccion: null,
    codigoPostal: null,
    ciudad: null,
    provincia: null,
  },
  destinatario: {
    cifNif: null,
    razonSocial: null,
    direccion: null,
  },
  desgloseIva: [],
  continuaEnOtraPagina: false,
  paginaActual: null,
  paginasTotales: null,
  sumaYSigue: null,
};
