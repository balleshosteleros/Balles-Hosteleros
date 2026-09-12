/**
 * Lectura pública de la carta por slug (cliente anon).
 * Usado por el server component /carta/[slug]/page.tsx.
 * RLS exige `carta_publicada=true` y `visible=true`.
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { diaNegocioHoy } from "@/features/sala/lib/dia-negocio";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import type {
  CartaPublica,
  CartaCategoria,
  CartaItem,
  CartaEmpresaPublica,
  EstiloCards,
  ModoCarta,
  FormatoFoto,
  Alergeno,
  CartaFamilia,
} from "../types";

/**
 * Cliente service-role usado SÓLO para leer la fila de `empresas` por slug.
 * `empresas` tiene RLS que bloquea anon; en lugar de exponer la tabla completa
 * con una policy `to anon`, usamos el server component (esto se ejecuta server-side)
 * para leer los 4 campos públicos y devolver al cliente solo lo necesario.
 * Nunca expuesto al navegador.
 */
function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface EmpresaRow {
  id: string;
  nombre: string;
  carta_slug: string;
  carta_publicada: boolean;
  carta_descripcion: string | null;
  logo_url: string | null;
  logo_alt_url: string | null;
  isotipo_url: string | null;
  color: string | null;
  color_secundario: string | null;
  color_texto: string | null;
  carta_color_fondo: string | null;
  carta_color_acento: string | null;
  carta_fuente_titulos: string | null;
  carta_fuente_cuerpo: string | null;
  carta_hero_url: string | null;
  config_operativa: { zonaHoraria?: string } | null;
  carta_estilo_cards: string | null;
  carta_formato_foto: string | null;
  carta_modo: string | null;
}

interface CategoriaRow {
  formato_foto: string | null;
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  visible: boolean;
  familia: string | null;
  destacada: boolean | null;
  dias_semana: number[] | null;
  hora_desde: string | null;
  hora_hasta: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  empresa_id: string;
  categoria_id: string;
  producto_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number | string;
  foto_url: string | null;
  foto_storage_path: string | null;
  alergenos: string[] | null;
  orden: number;
  visible: boolean;
  destacado: boolean;
  likes_count: number;
  likes_base: number | null;
  oculto: boolean | null;
  oculto_desde: string | null;
  oculto_hasta: string | null;
  agotado_dia: string | null;
  created_at: string;
  updated_at: string;
}

function rowToCategoria(r: CategoriaRow): CartaCategoria {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    orden: r.orden,
    visible: r.visible,
    familia: (r.familia as CartaCategoria["familia"]) ?? null,
    formato_foto: (r.formato_foto as FormatoFoto | null) ?? null,
    destacada: r.destacada ?? false,
    dias_semana: r.dias_semana,
    hora_desde: r.hora_desde,
    hora_hasta: r.hora_hasta,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/**
 * ¿Toca servir esta categoría ahora mismo?
 *
 * Se evalúa en el SERVIDOR con la hora del restaurante, no la del móvil del
 * comensal: si alguien abre la carta con el reloj en otra zona, debe ver lo
 * que la cocina está sirviendo aquí, no lo que marca su teléfono.
 */
function categoriaEnHorario(c: CartaCategoria, zona: string): boolean {
  if (!c.dias_semana?.length && !c.hora_desde && !c.hora_hasta) return true;

  const ahora = new Date();
  const fmt = new Intl.DateTimeFormat("es-ES", {
    timeZone: zona,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const partes = Object.fromEntries(fmt.formatToParts(ahora).map((p) => [p.type, p.value]));

  if (c.dias_semana?.length) {
    // Intl da el día como texto; se traduce a 1=lunes … 7=domingo.
    const dias: Record<string, number> = { lun: 1, mar: 2, mié: 3, mie: 3, jue: 4, vie: 5, sáb: 6, sab: 6, dom: 7 };
    const clave = (partes.weekday ?? "").toLowerCase().slice(0, 3);
    const hoy = dias[clave];
    if (hoy && !c.dias_semana.includes(hoy)) return false;
  }

  if (c.hora_desde || c.hora_hasta) {
    const minutos = Number(partes.hour) * 60 + Number(partes.minute);
    const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
    if (c.hora_desde && minutos < aMin(c.hora_desde)) return false;
    if (c.hora_hasta && minutos > aMin(c.hora_hasta)) return false;
  }

  return true;
}

const DIAS_NOMBRE = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/**
 * El horario de la categoría, escrito para que lo lea un cliente.
 *
 * Solo se usa en la carta abierta desde la WEB: si el menú del día se enseña
 * un domingo, tiene que quedar claro cuándo se sirve. Sin esta frase, enseñar
 * la categoría fuera de su horario sería exactamente la promesa falsa que la
 * ventana horaria venía a evitar.
 */
function textoHorario(c: CartaCategoria): string | null {
  const dias = c.dias_semana?.length ? [...c.dias_semana].sort((a, b) => a - b) : null;
  let parteDias: string | null = null;

  if (dias && dias.length < 7) {
    const consecutivos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
    if (dias.length === 1) {
      parteDias = `los ${DIAS_NOMBRE[dias[0]]}`;
    } else if (consecutivos) {
      parteDias = `de ${DIAS_NOMBRE[dias[0]]} a ${DIAS_NOMBRE[dias[dias.length - 1]]}`;
    } else {
      const nombres = dias.map((d) => DIAS_NOMBRE[d]);
      parteDias = `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
    }
  }

  const hhmm = (h: string) => h.slice(0, 5);
  let parteHoras: string | null = null;
  if (c.hora_desde && c.hora_hasta) parteHoras = `de ${hhmm(c.hora_desde)} a ${hhmm(c.hora_hasta)}`;
  else if (c.hora_desde) parteHoras = `a partir de las ${hhmm(c.hora_desde)}`;
  else if (c.hora_hasta) parteHoras = `hasta las ${hhmm(c.hora_hasta)}`;

  if (!parteDias && !parteHoras) return null;
  const frase = [parteDias, parteHoras].filter(Boolean).join(", ");
  return `Se sirve ${frase}`;
}

function rowToItem(r: ItemRow, diaServicio: string): CartaItem {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    categoria_id: r.categoria_id,
    producto_id: r.producto_id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    precio: typeof r.precio === "string" ? parseFloat(r.precio) : r.precio,
    foto_url: r.foto_url,
    foto_storage_path: r.foto_storage_path,
    alergenos: (r.alergenos ?? []) as Alergeno[],
    orden: r.orden,
    visible: r.visible,
    destacado: r.destacado,
    likes_count: r.likes_count,
    likes_base: r.likes_base ?? 0,
    // Agotado es "de hoy": la marca caduca sola al cambiar el día de servicio.
    agotado: !!r.agotado_dia && r.agotado_dia === diaServicio,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/**
 * Dónde se está leyendo la carta.
 *
 *  · `local` (por defecto) — el QR de la mesa. Solo se enseña lo que la cocina
 *    sirve AHORA: un menú del día en la carta de un sábado por la noche es
 *    prometer algo que no existe, y el camarero acaba dando explicaciones.
 *  · `web` — el enlace desde la página del restaurante. Aquí manda lo
 *    contrario: quien mira la web un domingo por la tarde está decidiendo si
 *    viene el martes a comer, y el menú del día es justo lo que busca. Se
 *    enseña entero, con su horario escrito al lado.
 *
 * No hace falta reimprimir ningún QR: los de mesa ya apuntan al enlace pelado,
 * que es el modo `local`; es la web la que añade la marca.
 */
export type ModoLectura = "local" | "web";

export async function fetchCartaPorSlug(
  slug: string,
  modo: ModoLectura = "local",
): Promise<CartaPublica | null> {
  try {
    // Carga inicial con service role (server-side, no llega al navegador).
    // Las RLS actuales de carta_categorias/carta_items hacen un join a empresas
    // que el cliente anon no puede leer, devolviendo [] vacío. Por eso el server
    // hace la carga completa y entrega ya renderizado al cliente.
    // (Realtime client-side de likes seguirá usando anon — ver useLikesRealtime.)
    const supabase = serviceClient();

    const { data: empresa, error: empresaErr } = await supabase
      .from("empresas")
      .select(
        "id, nombre, carta_slug, carta_publicada, carta_descripcion, config_operativa, logo_url, logo_alt_url, isotipo_url, color, color_secundario, color_texto, carta_color_fondo, carta_color_acento, carta_fuente_titulos, carta_fuente_cuerpo, carta_hero_url, carta_estilo_cards, carta_modo, carta_formato_foto",
      )
      .eq("carta_slug", slug)
      .eq("carta_publicada", true)
      .maybeSingle<EmpresaRow>();

    if (empresaErr) {
      console.error("[carta-fetch] empresa error:", empresaErr.message);
      return null;
    }
    if (!empresa) return null;

    const empresaPub: CartaEmpresaPublica = {
      id: empresa.id,
      nombre: empresa.nombre,
      carta_slug: empresa.carta_slug,
      carta_publicada: empresa.carta_publicada,
      carta_descripcion: empresa.carta_descripcion,
      logo_url: empresa.logo_url,
      logo_alt_url: empresa.logo_alt_url,
      isotipo_url: empresa.isotipo_url,
      color_primario: empresa.color,
      color_secundario: empresa.color_secundario,
      color_texto: empresa.color_texto,
      carta_color_fondo: empresa.carta_color_fondo,
      carta_color_acento: empresa.carta_color_acento,
      carta_fuente_titulos: empresa.carta_fuente_titulos,
      carta_fuente_cuerpo: empresa.carta_fuente_cuerpo,
      carta_hero_url: empresa.carta_hero_url,
      carta_estilo_cards: (empresa.carta_estilo_cards as EstiloCards | null) ?? null,
      carta_modo: (empresa.carta_modo as ModoCarta | null) ?? null,
      carta_formato_foto: (empresa.carta_formato_foto as FormatoFoto | null) ?? null,
    };

    const [categoriasRes, itemsRes, familiasRes] = await Promise.all([
      supabase
        .from("carta_categorias")
        .select("*")
        .eq("empresa_id", empresa.id)
        .eq("visible", true)
        .order("orden", { ascending: true }),
      supabase
        .from("carta_items")
        .select("*")
        .eq("empresa_id", empresa.id)
        .eq("visible", true)
        .order("orden", { ascending: true }),
      supabase
        .from("carta_familias")
        .select("clave, nombre, orden, visible")
        .eq("empresa_id", empresa.id)
        .eq("visible", true)
        .order("orden", { ascending: true }),
    ]);

    if (categoriasRes.error) console.error("[carta-fetch] cat error:", categoriasRes.error.message);
    if (itemsRes.error) console.error("[carta-fetch] items error:", itemsRes.error.message);

    const categoriasRows = (categoriasRes.data ?? []) as CategoriaRow[];
    const itemsRows = (itemsRes.data ?? []) as ItemRow[];

    // Del producto solo se leen las decisiones que son SUYAS: si es de carta,
    // si lleva estrella y si hoy está agotado. El nombre y el texto que ve el
    // comensal los escribe Marketing en la propia carta y no se pisan aquí.
    const productoIds = Array.from(
      new Set(itemsRows.map((i) => i.producto_id).filter((v): v is string => !!v)),
    );
    const productosOverride = new Map<
      string,
      { carta_destacado: boolean; visible_carta: boolean; agotado_dia: string | null }
    >();
    if (productoIds.length > 0) {
      const { data: prodRows } = await supabase
        .from("productos")
        .select("id, carta_destacado, visible_carta, agotado_dia")
        .in("id", productoIds);
      for (const p of (prodRows ?? []) as {
        id: string;
        carta_destacado: boolean | null;
        visible_carta: boolean | null;
        agotado_dia: string | null;
      }[]) {
        productosOverride.set(p.id, {
          carta_destacado: p.carta_destacado ?? false,
          visible_carta: p.visible_carta ?? false,
          agotado_dia: p.agotado_dia,
        });
      }
    }

    // Zona del restaurante, no la del móvil de quien mira la carta.
    const zona = (empresa.config_operativa?.zonaHoraria || "").trim() || "Europe/Madrid";
    // Día de SERVICIO (corte a las 06:00): lo que cocina marcó agotado esta
    // noche sigue agotado a la 1 de la madrugada, que es el mismo servicio.
    const diaServicio = diaNegocioHoy(zona);
    const hoy = hoyEnZona(zona);

    const items = itemsRows
      // Un plato en pausa editorial ("en agosto no lo hacemos") no llega al
      // comensal. La regla de seguridad de la tabla ya lo dice, pero esta
      // carga usa la llave de servicio para poder leer la empresa, y esa llave
      // se salta las reglas: sin este filtro, un plato retirado seguía saliendo.
      .filter((row) => {
        if (!row.oculto) return true;
        if (row.oculto_desde && hoy < row.oculto_desde) return true;
        if (row.oculto_hasta && hoy > row.oculto_hasta) return true;
        return false;
      })
      // El interruptor maestro de la ficha del producto manda sobre todo: si
      // ahí se dijo que no es de carta, no es de carta.
      .filter((row) => !row.producto_id || productosOverride.get(row.producto_id)?.visible_carta !== false)
      .map((row) => {
      const item = rowToItem(row, diaServicio);
      if (row.producto_id) {
        const ov = productosOverride.get(row.producto_id);
        // La estrella destacada se gobierna desde la ficha del producto de venta.
        if (ov) item.destacado = ov.carta_destacado;
        // Cocina apaga el PRODUCTO, no el plato de la carta: así el mismo
        // toque vale para la carta, para la tecla del TPV y para la comanda
        // del camarero. El plato solo lleva marca propia cuando no tiene
        // producto detrás (los escritos a mano aquí).
        if (ov?.agotado_dia && ov.agotado_dia === diaServicio) item.agotado = true;
      }
      return item;
    });

    const categorias = categoriasRows
      .map(rowToCategoria)
      // En la mesa solo se enseña lo que se sirve ahora. Desde la web se
      // enseña todo, y lo que ahora no toca lleva su horario escrito.
      .filter((c) => modo === "web" || categoriaEnHorario(c, zona))
      .map((c) => {
        const fuera = modo === "web" && !categoriaEnHorario(c, zona);
        return {
          ...c,
          fuera_de_horario: fuera,
          horario_texto: textoHorario(c),
          items: items.filter((i) => i.categoria_id === c.id),
        };
      });
    const destacados = items.filter((i) => i.destacado);

    const familias: CartaFamilia[] =
      ((familiasRes.data ?? []) as CartaFamilia[]).length > 0
        ? (familiasRes.data as CartaFamilia[])
        : [
            { clave: "comida", nombre: "Comida", orden: 1, visible: true },
            { clave: "bebida", nombre: "Bebida", orden: 2, visible: true },
            { clave: "otros", nombre: "Otros", orden: 3, visible: true },
          ];

    return { empresa: empresaPub, familias, categorias, destacados };
  } catch (err) {
    console.error("[carta-fetch] fatal:", err);
    return null;
  }
}
