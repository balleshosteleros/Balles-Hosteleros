/**
 * Entregas de material y uniforme.
 *
 * RRHH registra lo que le da a un trabajador (uniforme o material), el
 * trabajador lo firma como recibido y queda en su ficha. Al salir, en el
 * offboarding, hay que confirmar que ha devuelto lo que estaba marcado
 * como "requiere devolucion".
 */

/** Uniforme = ropa de trabajo. Material = llaves, taquilla, EPI, dispositivos. */
export type CategoriaMaterial = "uniforme" | "material";

export type EstadoEntrega = "borrador" | "pendiente_firma" | "firmada" | "rechazada";

export const CATEGORIA_LABEL: Record<CategoriaMaterial, string> = {
  uniforme: "Uniforme",
  material: "Material",
};

export const ESTADO_LABEL: Record<EstadoEntrega, string> = {
  borrador: "Borrador",
  pendiente_firma: "Pendiente de firma",
  firmada: "Firmada",
  rechazada: "Rechazada",
};

export const ESTADO_COLOR: Record<EstadoEntrega, string> = {
  borrador: "bg-zinc-50 text-zinc-700 border-zinc-200",
  pendiente_firma: "bg-amber-50 text-amber-700 border-amber-200",
  firmada: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rechazada: "bg-rose-50 text-rose-700 border-rose-200",
};

/** Tallas de ropa. Las de calzado se escriben a mano (numero). */
export const TALLAS_ROPA = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;

/** Un tipo del catalogo de la empresa: "Camiseta", "Llaves del local"... */
export interface TipoMaterial {
  id: string;
  nombre: string;
  categoria: CategoriaMaterial;
  requiereTalla: boolean;
  requiereDevolucion: boolean;
  activo: boolean;
  orden: number;
}

/** Una linea de una entrega. */
export interface EntregaItem {
  id: string;
  tipoId: string | null;
  tipoNombre: string;
  categoria: CategoriaMaterial;
  cantidad: number;
  talla: string | null;
  requiereDevolucion: boolean;
  devueltoEn: string | null;
  orden: number;
}

/** Una entrega completa con sus lineas. */
export interface Entrega {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  fecha: string;
  nota: string | null;
  estado: EstadoEntrega;
  firmaId: string | null;
  firmadaEn: string | null;
  entregadoPorNombre: string | null;
  items: EntregaItem[];
}

/** Lo que el trabajador tiene ahora mismo: una linea por tipo, sumando cantidades. */
export interface ResumenMaterial {
  tipoNombre: string;
  categoria: CategoriaMaterial;
  cantidad: number;
  tallas: string[];
  requiereDevolucion: boolean;
  pendienteDevolucion: number;
}

/**
 * Agrupa las lineas de todas las entregas firmadas en un resumen de lo que el
 * trabajador tiene ahora. Lo usan el perfil del empleado y su portal.
 */
export function resumirMaterial(entregas: Entrega[]): ResumenMaterial[] {
  const porTipo = new Map<string, ResumenMaterial>();

  for (const entrega of entregas) {
    // Solo cuenta lo que el trabajador ha reconocido como recibido.
    if (entrega.estado !== "firmada") continue;

    for (const item of entrega.items) {
      const clave = `${item.categoria}|${item.tipoNombre.toLowerCase()}`;
      const actual = porTipo.get(clave) ?? {
        tipoNombre: item.tipoNombre,
        categoria: item.categoria,
        cantidad: 0,
        tallas: [],
        requiereDevolucion: item.requiereDevolucion,
        pendienteDevolucion: 0,
      };

      actual.cantidad += item.cantidad;
      if (item.talla && !actual.tallas.includes(item.talla)) {
        actual.tallas.push(item.talla);
      }
      if (item.requiereDevolucion) {
        actual.requiereDevolucion = true;
        if (!item.devueltoEn) actual.pendienteDevolucion += item.cantidad;
      }

      porTipo.set(clave, actual);
    }
  }

  return [...porTipo.values()].sort((a, b) => {
    // Uniforme primero, luego material; dentro de cada grupo, por nombre.
    if (a.categoria !== b.categoria) return a.categoria === "uniforme" ? -1 : 1;
    return a.tipoNombre.localeCompare(b.tipoNombre, "es");
  });
}

/** Lineas pendientes de devolver de un trabajador (para el offboarding). */
export function pendientesDeDevolucion(entregas: Entrega[]): EntregaItem[] {
  return entregas
    .filter((e) => e.estado === "firmada")
    .flatMap((e) => e.items)
    .filter((i) => i.requiereDevolucion && !i.devueltoEn);
}
