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
      .select("id")
      .eq("item_id", itemId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (selErr) {
      console.error("[like] sel:", selErr.message);
      return { ok: false, error: "Error consultando like.", codigo: "ERROR" };
    }

    if (existente) {
      const { error: delErr } = await supabase
        .from("carta_item_likes")
        .delete()
        .eq("id", (existente as { id: string }).id);
      if (delErr) {
        console.error("[like] del:", delErr.message);
        return { ok: false, error: "No se pudo retirar el like.", codigo: "ERROR" };
      }
      const { data: item } = await supabase
        .from("carta_items")
        .select("likes_count")
        .eq("id", itemId)
        .maybeSingle();
      return {
        ok: true,
        liked: false,
        likesCount: (item as { likes_count: number } | null)?.likes_count ?? 0,
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
        const { data: item } = await supabase
          .from("carta_items")
          .select("likes_count")
          .eq("id", itemId)
          .maybeSingle();
        return {
          ok: true,
          liked: true,
          likesCount: (item as { likes_count: number } | null)?.likes_count ?? 0,
        };
      }
      console.error("[like] ins:", insErr.message);
      return { ok: false, error: "No se pudo registrar el like.", codigo: "ERROR" };
    }

    const { data: item } = await supabase
      .from("carta_items")
      .select("likes_count")
      .eq("id", itemId)
      .maybeSingle();

    return {
      ok: true,
      liked: true,
      likesCount: (item as { likes_count: number } | null)?.likes_count ?? 0,
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
    const { data, error } = await supabase
      .from("carta_item_likes")
      .select("item_id")
      .eq("device_id", deviceId)
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
