import type { SupabaseClient } from "@supabase/supabase-js";
import { exigePermiso, type SegmentoJson } from "@/features/marketing/data/campanas";

/**
 * A quién le toca una campaña.
 *
 * ── Por qué el filtro lo resuelve la base de datos ─────────────────────────
 * La primera versión se traía las fichas de la empresa y las juzgaba aquí. Se
 * leía bien y daba el resultado correcto, pero con veinte mil clientes tardaba
 * veinte segundos por consulta —veinte páginas de mil filas, una detrás de
 * otra— y el contador de "a cuánta gente le llega" se recalcula cada vez que se
 * toca un filtro. Ahora lo hace `clientes_del_segmento` de una pasada y con los
 * índices: instantáneo, y sigue siéndolo cuando la base de clientes doble.
 *
 * Este archivo es solo la puerta: traduce la campaña a los argumentos de esa
 * función. Las condiciones viven en la migración
 * `20260907220000_segmento_clientes_en_base_de_datos.sql`, y añadir una nueva es
 * añadir un WHEN allí y una línea en el desplegable del editor.
 *
 * ── El permiso ────────────────────────────────────────────────────────────
 * Por defecto solo entra quien dio permiso comercial EN EL CANAL de la campaña:
 * quien aceptó correos no aceptó que le escriban al móvil. Se puede desactivar
 * (`soloConPermiso: false`) porque el negocio responde de sus envíos, pero es
 * una decisión suya y consciente, nunca el punto de partida. El dato de
 * contacto se exige siempre: sin dirección no hay a dónde escribir.
 */

export type CanalContacto = "email" | "whatsapp" | "sms";

interface FilaSegmento {
  id: string;
  email: string | null;
  telefono: string | null;
}

const SEGMENTO_VACIO: SegmentoJson = { operador: "AND", condiciones: [] };

/**
 * Tamaño de página al leer del servidor.
 *
 * PostgREST corta CUALQUIER respuesta en mil filas, también las de una función.
 * Sin pedir las páginas siguientes, una campaña a doce mil clientes salía a mil
 * y devolvía "enviado" sin más: el resto no recibía nada y nadie se enteraba.
 * La función ordena por `id`, así que las páginas no se solapan ni se saltan
 * fichas.
 */
const PAGINA = 1000;

async function resolver(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson | null | undefined,
  canal: CanalContacto | null,
): Promise<FilaSegmento[]> {
  const todas: FilaSegmento[] = [];

  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .rpc("clientes_del_segmento", {
        p_empresa_id: empresaId,
        p_segmento: segmento ?? SEGMENTO_VACIO,
        p_canal: canal,
        p_con_permiso: exigePermiso(segmento),
      })
      .range(desde, desde + PAGINA - 1);
    if (error) throw error;

    const lote = (data ?? []) as FilaSegmento[];
    todas.push(...lote);
    if (lote.length < PAGINA) break;
  }

  return todas;
}

/**
 * Cuántas fichas encajan, contando en la base de datos.
 *
 * Se cuenta allí y no aquí porque traerse veinte mil filas para pedirles el
 * `length` son dos segundos de red por cada filtro que se toca, y este número se
 * recalcula mientras el usuario escribe.
 */
async function contar(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson | null | undefined,
  canal: CanalContacto | null,
): Promise<number> {
  const { data, error } = await supabase.rpc("contar_clientes_del_segmento", {
    p_empresa_id: empresaId,
    p_segmento: segmento ?? SEGMENTO_VACIO,
    p_canal: canal,
    p_con_permiso: exigePermiso(segmento),
  });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/**
 * Cuántas fichas encajan en el filtro, sin mirar permisos ni datos de contacto.
 * Es la cifra de "a cuánta gente describe esto", SIEMPRE mayor que la de los que
 * van a recibir el mensaje.
 */
export async function contarSegmento(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson,
): Promise<number> {
  return contar(supabase, empresaId, segmento, null);
}

/** Cuántos lo recibirían DE VERDAD por ese canal: con permiso y con contacto. */
export async function contarDestinatariosPorCanal(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson,
  canal: CanalContacto,
): Promise<number> {
  return contar(supabase, empresaId, segmento, canal);
}

export async function clienteIdsDelSegmento(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson,
): Promise<FilaSegmento[]> {
  return resolver(supabase, empresaId, segmento, null);
}

/**
 * Destinatarios REALES de una campaña, por canal: con permiso (salvo que la
 * campaña lo desactive), con dato de contacto y sin repetidos.
 *
 * Lo de los repetidos no lo hace la base de datos y aquí sí: el mismo correo en
 * dos fichas —pasa, el cliente reservó con dos teléfonos— recibiría el mensaje
 * dos veces.
 */
export async function destinatariosDeCampanaPorCanal(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson,
  canal: CanalContacto,
): Promise<Array<{ id: string; contacto: string }>> {
  const filas = await resolver(supabase, empresaId, segmento, canal);

  const salida: Array<{ id: string; contacto: string }> = [];
  const vistos = new Set<string>();

  for (const f of filas) {
    const bruto = canal === "email" ? f.email : f.telefono;
    const contacto =
      canal === "email"
        ? (bruto ?? "").trim().toLowerCase()
        : (bruto ?? "").replace(/\s+/g, "");
    if (!contacto || vistos.has(contacto)) continue;
    vistos.add(contacto);
    salida.push({ id: f.id, contacto });
  }

  return salida;
}

/** Destinatarios de una campaña de CORREO. */
export async function destinatariosDeCampana(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson,
): Promise<Array<{ id: string; email: string }>> {
  const filas = await destinatariosDeCampanaPorCanal(supabase, empresaId, segmento, "email");
  return filas.map((f) => ({ id: f.id, email: f.contacto }));
}

/** Destinatarios de una campaña de WHATSAPP. */
export async function destinatariosWhatsAppDeCampana(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson,
): Promise<Array<{ id: string; telefono: string }>> {
  const filas = await destinatariosDeCampanaPorCanal(supabase, empresaId, segmento, "whatsapp");
  return filas.map((f) => ({ id: f.id, telefono: f.contacto }));
}

/** Destinatarios de una campaña de SMS. */
export async function destinatariosSmsDeCampana(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson,
): Promise<Array<{ id: string; telefono: string }>> {
  const filas = await destinatariosDeCampanaPorCanal(supabase, empresaId, segmento, "sms");
  return filas.map((f) => ({ id: f.id, telefono: f.contacto }));
}
