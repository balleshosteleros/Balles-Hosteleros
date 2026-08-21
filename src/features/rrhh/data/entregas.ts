/**
 * Entregas de material y uniforme.
 *
 * UNA ENTREGA = UNA UNIDAD. No hay cantidades ni entregas con varias cosas:
 * tres camisetas son tres entregas. Asi el acta que firma el trabajador dice
 * exactamente que pieza recibio, y la de devolucion no admite dudas ("se
 * devuelve esto", nunca "2 de 3 camisetas").
 *
 * Ciclo completo, las dos mitades firmadas por el trabajador:
 *   1. RRHH registra la pieza  -> se le manda el acta de ENTREGA por correo.
 *   2. La firma                 -> queda como recibida y cuenta como suya.
 *   3. RRHH pide la devolucion  -> se le manda el acta de DEVOLUCION.
 *   4. La firma                 -> queda devuelta.
 */

/** Uniforme = ropa de trabajo. Material = llaves, taquilla, EPI, dispositivos. */
export type CategoriaMaterial = "uniforme" | "material";

export type EstadoEntrega = "borrador" | "pendiente_firma" | "firmada" | "rechazada";

/**
 * Desenlace de la pieza. `no_procede` cubre dos casos que en pantalla se leen
 * igual (no hay nada que devolver): la pieza no requiere devolucion, o aun no
 * se ha pedido.
 *
 * La MERMA vive aqui y no en un campo aparte porque es el mismo desenlace —la
 * pieza deja de estar en manos del trabajador—: cambia el motivo (la devolvio /
 * se le rompio), no el hecho.
 */
export type EstadoDevolucion =
  | "no_procede"
  | "pendiente_firma"
  | "devuelta"
  | "rechazada"
  | "merma_pendiente_firma"
  | "merma";

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

export const DEVOLUCION_LABEL: Record<EstadoDevolucion, string> = {
  no_procede: "—",
  pendiente_firma: "Devolución pendiente de firma",
  devuelta: "Devuelta",
  rechazada: "Devolución rechazada",
  merma_pendiente_firma: "Merma pendiente de firma",
  merma: "Merma",
};

export const DEVOLUCION_COLOR: Record<EstadoDevolucion, string> = {
  no_procede: "bg-zinc-50 text-zinc-700 border-zinc-200",
  pendiente_firma: "bg-amber-50 text-amber-700 border-amber-200",
  devuelta: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rechazada: "bg-rose-50 text-rose-700 border-rose-200",
  merma_pendiente_firma: "bg-amber-50 text-amber-700 border-amber-200",
  // La merma no es un fallo ni un logro: es material dado de baja.
  merma: "bg-slate-100 text-slate-700 border-slate-300",
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

/**
 * La pieza entregada. Es una por entrega, sin cantidad: si hacen falta tres
 * camisetas se crean tres entregas. El nombre y la categoria van congelados
 * (copiados del catalogo al entregar) para que el acta firmada siga diciendo lo
 * mismo aunque luego se renombre o se borre el tipo.
 */
export interface EntregaItem {
  id: string;
  tipoId: string | null;
  tipoNombre: string;
  categoria: CategoriaMaterial;
  talla: string | null;
  requiereDevolucion: boolean;
  devueltoEn: string | null;
}

/** Una entrega: un trabajador, una pieza y sus dos firmas. */
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
  /** La pieza. Null solo si la fila quedo huerfana por un fallo al crearla. */
  item: EntregaItem | null;
  devolucionEstado: EstadoDevolucion;
  devolucionFirmaId: string | null;
  devueltaEn: string | null;
  /** Por que se dio de baja la pieza. Solo en las mermas. */
  mermaMotivo: string | null;
  /** Cuando firmo el trabajador la baja por deterioro. */
  mermaEn: string | null;
}

/**
 * Lo que el trabajador tiene ahora mismo. Como cada entrega es una unidad, aqui
 * SI se agrupa por tipo y se cuenta, para no listar "Camiseta" tres veces
 * seguidas: `cantidad` es cuantas unidades tiene, no un campo de la entrega.
 */
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
    // Y lo que sigue teniendo: devuelto o dado de baja por deterioro, deja de serlo.
    if (entrega.devolucionEstado === "devuelta") continue;
    if (entrega.devolucionEstado === "merma") continue;

    const item = entrega.item;
    if (!item) continue;

    const clave = `${item.categoria}|${item.tipoNombre.toLowerCase()}`;
    const actual = porTipo.get(clave) ?? {
      tipoNombre: item.tipoNombre,
      categoria: item.categoria,
      cantidad: 0,
      tallas: [],
      requiereDevolucion: item.requiereDevolucion,
      pendienteDevolucion: 0,
    };

    actual.cantidad += 1;
    if (item.talla && !actual.tallas.includes(item.talla)) {
      actual.tallas.push(item.talla);
    }
    if (item.requiereDevolucion) {
      actual.requiereDevolucion = true;
      actual.pendienteDevolucion += 1;
    }

    porTipo.set(clave, actual);
  }

  return [...porTipo.values()].sort((a, b) => {
    // Uniforme primero, luego material; dentro de cada grupo, por nombre.
    if (a.categoria !== b.categoria) return a.categoria === "uniforme" ? -1 : 1;
    return a.tipoNombre.localeCompare(b.tipoNombre, "es");
  });
}

/**
 * Entregas a las que se les puede pedir la devolucion: firmadas por el
 * trabajador, que requieren devolucion y que no estan ya en curso o devueltas.
 */
export function sePuedePedirDevolucion(entrega: Entrega): boolean {
  return (
    entrega.estado === "firmada" &&
    Boolean(entrega.item?.requiereDevolucion) &&
    (entrega.devolucionEstado === "no_procede" ||
      entrega.devolucionEstado === "rechazada")
  );
}

/**
 * Se puede dar de baja por deterioro lo que el trabajador tiene y aun no ha
 * devuelto. No exige `requiereDevolucion`: una pieza puede romperse aunque no
 * hubiera que devolverla, y aun asi conviene dejar constancia de la baja.
 */
export function sePuedeDarDeBajaPorMerma(entrega: Entrega): boolean {
  return (
    entrega.estado === "firmada" &&
    entrega.devolucionEstado !== "devuelta" &&
    entrega.devolucionEstado !== "merma" &&
    entrega.devolucionEstado !== "merma_pendiente_firma"
  );
}

/**
 * Entregas que el trabajador tiene y aun no ha devuelto (para el offboarding).
 * Cuenta tambien las que estan pendientes de firmar la devolucion: pedirsela no
 * es lo mismo que haberla recibido.
 */
export function pendientesDeDevolucion(entregas: Entrega[]): Entrega[] {
  return entregas.filter(
    (e) =>
      e.estado === "firmada" &&
      Boolean(e.item?.requiereDevolucion) &&
      e.devolucionEstado !== "devuelta" &&
      // Lo dado de baja por deterioro ya no se le puede reclamar.
      e.devolucionEstado !== "merma",
  );
}
