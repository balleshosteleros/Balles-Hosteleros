"use server";

/**
 * Server actions públicas para Like/Unlike de items de carta.
 * No requiere autenticación. Usa device_id (cookie+fingerprint) y rate-limit por IP.
 */
import { headers } from "next/headers";
import { createAnonClient } from "@/lib/supabase/anon";
import { hashIp, permitirLike } from "../services/like-anti-spam";
import type { ToggleLikeResult } from "../types";

const DEVICE_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;

/**
 * Días que dura un "me gusta" antes de poder repetirse.
 *
 * Quien vuelve al restaurante puede volver a votar su plato: el contador mide
 * así lo que se sigue pidiendo, no solo quién pasó por aquí una vez. Dentro del
 * plazo el corazón funciona como interruptor —se puede retirar—; pasado el
 * plazo, el mismo dispositivo suma otro voto.
 */
const DIAS_VIGENCIA = 15;

/**
 * Lo que ve el comensal: el arranque configurado más los votos reales.
 * `likes_base` no es un voto —no se guarda en `carta_item_likes`— así que las
 * estadísticas siguen contando solo lo que ha pulsado gente de verdad.
 */
function totalVisible(item: { likes_count: number; likes_base?: number | null } | null): number {
  if (!item) return 0;
  return (item.likes_base ?? 0) + (item.likes_count ?? 0);
}

/**
 * Lee el total visible de un plato con clave de servicio.
 *
 * La RLS de `carta_items` cruza con `empresas`, que anon no puede leer: la
 * consulta no falla, devuelve vacío, y el contador se quedaba en 0 al votar.
 * Es la misma razón por la que la carta se carga desde el servidor.
 */
async function clienteServicio() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function leerTotal(itemId: string): Promise<number> {
  const admin = await clienteServicio();
  const { data } = await admin
    .from("carta_items")
    .select("likes_count, likes_base")
    .eq("id", itemId)
    .maybeSingle();
  return totalVisible(data as { likes_count: number; likes_base: number | null } | null);
}

async function obtenerIpHash(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0] : h.get("x-real-ip"))?.trim() ?? null;
  return await hashIp(ip);
}

export async function toggleLike(itemId: string, deviceId: string): Promise<ToggleLikeResult> {
  try {
    if (!itemId || !deviceId || !DEVICE_ID_RE.test(deviceId)) {
      return { ok: false, error: "Identificador inválido.", codigo: "ERROR" };
    }

    const supabase = createAnonClient();

    const { data: existente, error: selErr } = await supabase
      .from("carta_item_likes")
      .select("id, created_at")
      .eq("item_id", itemId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (selErr) {
      console.error("[like] sel:", selErr.message);
      return { ok: false, error: "Error consultando like.", codigo: "ERROR" };
    }

    // Un voto vale 15 días. Pasado ese plazo el mismo cliente puede volver a
    // votar en su siguiente visita: cuenta como voto nuevo, no como retirada.
    const previo = existente as { id: string; created_at: string } | null;
    const caducado =
      !!previo &&
      Date.now() - new Date(previo.created_at).getTime() > DIAS_VIGENCIA * 86_400_000;

    if (caducado) {
      // Se limpia el viejo para que el insert de abajo no choque con la clave
      // única (item + dispositivo) y el voto quede con fecha de hoy.
      const admin = await clienteServicio();
      await admin.from("carta_item_likes").delete().eq("id", previo!.id);
    }

    if (previo && !caducado) {
      // El borrado va con clave de servicio: `carta_item_likes` no tiene
      // politica de DELETE para anon —y no debe tenerla, o cualquiera podria
      // borrar votos ajenos—, asi que por el cliente publico Postgres no
      // borraba nada y tampoco daba error: el corazon se apagaba, el numero
      // bajaba un instante y volvia a subir al releer el total.
      const admin = await clienteServicio();
      const { data: borradas, error: delErr } = await admin
        .from("carta_item_likes")
        .delete()
        .eq("id", previo.id)
        .eq("device_id", deviceId)
        .select("id");
      if (delErr) {
        console.error("[like] del:", delErr.message);
        return { ok: false, error: "No se pudo retirar el like.", codigo: "ERROR" };
      }
      // Si no se borro ninguna fila el voto sigue puesto: hay que decirlo, o el
      // corazon quedaria apagado mientras el voto sigue contando.
      if (!borradas || borradas.length === 0) {
        return { ok: true, liked: true, likesCount: await leerTotal(itemId) };
      }
            return {
        ok: true,
        liked: false,
        likesCount: await leerTotal(itemId),
      };
    }

    const ipHash = await obtenerIpHash();
    if (ipHash && !permitirLike(ipHash)) {
      return { ok: false, error: "Demasiados votos. Espera un momento.", codigo: "RATE_LIMIT" };
    }

    const h = await headers();
    const ua = (h.get("user-agent") ?? "").slice(0, 200);

    const { error: insErr } = await supabase
      .from("carta_item_likes")
      .insert({ item_id: itemId, device_id: deviceId, ip_hash: ipHash, user_agent: ua });

    if (insErr) {
      if (insErr.code === "23505") {
        // race: ya existe
                return {
          ok: true,
          liked: true,
          likesCount: await leerTotal(itemId),
        };
      }
      console.error("[like] ins:", insErr.message);
      return { ok: false, error: "No se pudo registrar el like.", codigo: "ERROR" };
    }

    
    return {
      ok: true,
      liked: true,
      likesCount: await leerTotal(itemId),
    };
  } catch (err) {
    console.error("[like] fatal:", err);
    return { ok: false, error: "Error inesperado.", codigo: "ERROR" };
  }
}

export async function getLikesDelDevice(deviceId: string, itemIds: string[]): Promise<string[]> {
  try {
    if (!deviceId || !DEVICE_ID_RE.test(deviceId) || itemIds.length === 0) return [];
    const supabase = createAnonClient();
    // Solo los votos vigentes pintan el corazón: uno caducado ya no cuenta como
    // "tuyo", y si siguiera marcado el cliente no vería que puede votar de nuevo.
    const desde = new Date(Date.now() - DIAS_VIGENCIA * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("carta_item_likes")
      .select("item_id")
      .eq("device_id", deviceId)
      .gte("created_at", desde)
      .in("item_id", itemIds);
    if (error) {
      console.error("[like] getDevice:", error.message);
      return [];
    }
    return ((data ?? []) as { item_id: string }[]).map((r) => r.item_id);
  } catch (err) {
    console.error("[like] getDevice fatal:", err);
    return [];
  }
}
