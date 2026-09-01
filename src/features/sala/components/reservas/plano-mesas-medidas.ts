/**
 * Medidas del lienzo de sala y de las mesas que se dibujan sobre él.
 *
 * Son las mismas que usa el editor de planos de Ajustes (`SalaPlanoEditor`):
 * el plano se guarda con coordenadas absolutas sobre este lienzo, así que si
 * dos pantallas no coincidieran en el tamaño, las mesas del borde saldrían
 * desplazadas o recortadas en una de las dos.
 */

import type { FormaMesa, PlanoMesaPosicion } from "@/features/sala/planos/data/planos";

export const PLANO_CANVAS_W = 1200;
export const PLANO_CANVAS_H = 640;

const MESA_SIZE = 60;
const MESA_RECT_W = 84;
const MESA_RECT_H = 48;

/** Metadatos visuales de una mesa: su forma y el color de su zona. */
export interface MesaMetaPlano {
  forma: FormaMesa;
  colorZona: string;
  capacidadMin: number;
  capacidadMax: number;
  zonaId: string;
}

/**
 * Ancho y alto con los que se pinta una mesa. La posición puede traer medidas
 * propias (mesas redimensionadas en el editor); si no, manda su forma.
 */
export function dimsDeMesa(forma: FormaMesa, pos?: PlanoMesaPosicion | null) {
  const defW = forma === "rectangular" ? MESA_RECT_W : MESA_SIZE;
  const defH = forma === "rectangular" ? MESA_RECT_H : MESA_SIZE;
  return {
    w: pos?.width != null ? Number(pos.width) : defW,
    h: pos?.height != null ? Number(pos.height) : defH,
  };
}
