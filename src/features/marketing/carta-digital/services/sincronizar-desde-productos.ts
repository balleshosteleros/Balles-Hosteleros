/**
 * Sincroniza la carta digital desde los productos de venta.
 *
 * POR QUÉ:
 * Los platos ya existen en Logística → Productos (tipo `venta`), con su precio
 * real, su categoría y sus alérgenos. Es lo que usa cocina y lo que cuadra con
 * el TPV. Si la carta digital tuviera su propia copia de precios, cambiar uno
 * obligaría a tocarlo en dos sitios y acabarían diciendo cosas distintas — el
 * mismo problema que ya resolvimos con los textos legales.
 *
 * Aquí PRODUCTOS MANDA en precio, alérgenos y categoría: vienen de allí y se
 * refrescan en cada sincronización. Lo que es propio de la carta —el nombre que
 * lee el comensal, el texto, la foto, el orden y el estado— NO se pisa nunca:
 * es trabajo editorial que no debe perderse al resincronizar.
 *
 * QUÉ ENTRA EN LA CARTA lo decide `productos.visible_carta`, el interruptor de
 * la ficha del producto. Si está apagado, ese producto no entra ni se puede
 * añadir desde la carta. Antes se adivinaba por categoría, que es frágil: una
 * empresa nueva con otras categorías se quedaba sin carta o con el inventario
 * entero dentro.
 */

import type { Alergeno } from "../types";

/** Fila de `productos` que necesita la sincronización. */
export interface ProductoVenta {
  id: string;
  nombre: string;
  categoria: string | null;
  precio_venta: string | null;
  carta_destacado: boolean | null;
  alergenos: string[] | null;
  /** auto = derivados del escandallo; manual = los de la propia lista. */
  alergenos_modo?: string | null;
  estilo_imagen_url: string | null;
  estado?: string | null;
  /** Interruptor maestro: si es false, este producto no es de carta. */
  visible_carta?: boolean | null;
}

export interface ItemSincronizado {
  producto_id: string;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  alergenos: Alergeno[];
  destacado: boolean;
  foto_url: string | null;
  orden: number;
}

export interface ResultadoSincronizacion {
  items: ItemSincronizado[];
  categorias: string[];
  /** Productos descartados y por qué, para poder explicarlo en la UI. */
  descartados: Array<{ nombre: string; motivo: string }>;
}

function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/**
 * Convierte el precio, que en `productos` se guarda como texto.
 * Admite coma decimal ("14,80") además de punto.
 */
export function parsePrecio(valor: string | null | undefined): number | null {
  const crudo = (valor ?? "").trim();
  if (!crudo) return null;
  const normalizado = crudo.replace(/\s/g, "").replace(",", ".");
  const n = Number(normalizado);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Prepara los items de carta a partir de los productos de venta.
 *
 * Un producto entra si tiene el interruptor «Visible en carta digital»
 * encendido, categoría y precio válido. Todo lo descartado se devuelve con su
 * motivo: es preferible poder decir "estos 57 no entran porque no tienen
 * precio" a que desaparezcan en silencio.
 */
export function prepararItemsDesdeProductos(
  productos: ProductoVenta[],
  /**
   * Alérgenos derivados del escandallo por producto, para los que están en
   * modo automático. Se resuelven fuera (hace falta la BD) y se pasan aquí
   * para que esta función siga siendo pura y testeable.
   */
  derivados?: Map<string, string[]>,
): ResultadoSincronizacion {
  const items: ItemSincronizado[] = [];
  const descartados: ResultadoSincronizacion["descartados"] = [];
  const ordenPorCategoria = new Map<string, number>();

  for (const p of productos) {
    // El interruptor maestro manda por encima de todo lo demás.
    if (p.visible_carta === false) {
      descartados.push({ nombre: p.nombre, motivo: "No marcado como visible en carta" });
      continue;
    }

    if (p.estado && normalizar(p.estado) === "inactivo") {
      descartados.push({ nombre: p.nombre, motivo: "Producto inactivo" });
      continue;
    }

    const categoria = (p.categoria ?? "").trim();
    if (!categoria) {
      descartados.push({ nombre: p.nombre, motivo: "Sin categoría" });
      continue;
    }

    const precio = parsePrecio(p.precio_venta);
    if (precio === null) {
      descartados.push({ nombre: p.nombre, motivo: "Sin precio de venta" });
      continue;
    }

    const orden = (ordenPorCategoria.get(categoria) ?? 0) + 1;
    ordenPorCategoria.set(categoria, orden);

    items.push({
      producto_id: p.id,
      categoria,
      // Nombre de ARRANQUE para un plato nuevo. El nombre comercial que lee
      // el comensal ("Bao de oreja" en vez de "Bao-cadillo de oreja con…") se
      // escribe luego en la carta digital y ya no vuelve a pisarse desde aquí.
      nombre: p.nombre.trim(),
      // El texto de venta nace vacío: lo escribe Marketing en la carta.
      descripcion: null,
      precio,
      // En AUTOMÁTICO los alérgenos no viven en el producto: se derivan del
      // escandallo. `derivados` los trae ya resueltos desde la BD; si el
      // producto es manual, manda su propia lista.
      alergenos: (p.alergenos_modo === "manual"
        ? (p.alergenos ?? [])
        : (derivados?.get(p.id) ?? p.alergenos ?? [])) as Alergeno[],
      destacado: Boolean(p.carta_destacado),
      foto_url: p.estilo_imagen_url ?? null,
      orden,
    });
  }

  const categorias = [...new Set(items.map((i) => i.categoria))];

  return { items, categorias, descartados };
}

/**
 * Orden con el que se presentan las categorías en la carta.
 *
 * Un comensal espera entrantes → principales → postres → bebidas, no orden
 * alfabético ni el del inventario. Las categorías que no estén aquí van
 * después, en el orden en que lleguen: así una empresa nueva con categorías
 * propias no se rompe.
 */
export const ORDEN_CATEGORIAS_SUGERIDO = [
  "para empezar",
  "entrantes",
  "para compartir",
  "ensaladas",
  "de la mar",
  "de la tierra",
  "arroces",
  "carnes",
  "pescados",
  "veganos",
  "para ninos",
  "postres",
  "cafes e infusiones",
  "nuestros cocteles",
  "cervezas",
  "vinos blancos",
  "vinos tintos",
  "vinos rosados",
  "champagne",
  "refrescos",
  "licores",
  "gins",
  "rones",
  "vodkas",
  "whiskys",
  "botellas",
];

export function ordenarCategorias(categorias: string[]): string[] {
  const peso = (nombre: string) => {
    const i = ORDEN_CATEGORIAS_SUGERIDO.indexOf(normalizar(nombre));
    return i === -1 ? ORDEN_CATEGORIAS_SUGERIDO.length : i;
  };
  return [...categorias].sort((a, b) => {
    const d = peso(a) - peso(b);
    return d !== 0 ? d : a.localeCompare(b, "es");
  });
}
