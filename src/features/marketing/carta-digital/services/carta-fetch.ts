/**
 * Lectura pública de la carta por slug (cliente anon).
 * Usado por el server component /carta/[slug]/page.tsx.
 * RLS exige `carta_publicada=true` y `visible=true`.
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { diaNegocioHoy } from "@/features/sala/lib/dia-negocio";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { categoriaEnHorario } from "../lib/horario";
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
 * La carta, tal y como se sirve AHORA MISMO.
 *
 * Hay un único enlace: el del QR de la mesa y el de la web del restaurante son
 * el mismo, y lo que se enseña no depende de por dónde entre el cliente, sino
 * del horario de cada categoría. Un menú del día en la carta de un sábado por
 * la noche es prometer algo que no existe, y el camarero acaba dando
 * explicaciones; para eso está la ventana horaria de la categoría.
 */
export async function fetchCartaPorSlug(
  slug: string,
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
      // Solo lo que se sirve ahora, se llegue por el QR de la mesa o desde la
      // web: es la misma carta y un solo enlace.
      .filter((c) => categoriaEnHorario(c, zona))
      .map((c) => ({
        ...c,
        items: items.filter((i) => i.categoria_id === c.id),
      }));
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
