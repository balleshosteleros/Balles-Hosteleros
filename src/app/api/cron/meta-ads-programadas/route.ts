/**
 * PRP-087 · Fase 7 — Arrancar las campañas programadas.
 *
 * Cada 10 minutos mira si a alguna programación le ha llegado la hora y activa
 * en Meta la campaña, su conjunto y sus anuncios.
 *
 * No lleva ninguna ventana horaria local: compara `arrancar_at` (que ya está en
 * UTC, calculado con el reloj de la empresa) contra el momento actual. Un cron
 * con ventana se queda mudo en cuanto alguien le cambia la hora en vercel.json.
 *
 * El tope de gasto se comprueba TAMBIÉN aquí: entre que se programó y llegó la
 * hora, el mes ha podido agotarse. En ese caso no se activa y se anota el
 * motivo, en vez de saltarse el tope por ser automático.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getMetaCredenciales } from "@/features/marketing/meta-ads/services/meta-credenciales";
import { getGastoDelMes } from "@/features/marketing/meta-ads/services/meta-insights";
import { cambiarEstado } from "@/features/marketing/meta-ads/services/meta-escritura";
import { centimosAEuros } from "@/features/marketing/meta-ads/lib/meta-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface Programacion {
  id: string;
  empresa_id: string;
  campana_meta_id: string;
  arrancar_at: string;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: pendientes, error } = await db
    .from("meta_programaciones")
    .select("id, empresa_id, campana_meta_id, arrancar_at")
    .eq("estado", "pendiente")
    .lte("arrancar_at", new Date().toISOString())
    .order("arrancar_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const hechas: string[] = [];
  const fallidas: Array<{ id: string; motivo: string }> = [];

  for (const p of (pendientes ?? []) as Programacion[]) {
    try {
      const cred = await getMetaCredenciales(db, p.empresa_id);
      if (!cred) throw new Error("La empresa ya no tiene Meta conectado.");

      const gasto = await getGastoDelMes(db, p.empresa_id, cred.topeGastoMensualCent);
      if (gasto.bloqueado) {
        throw new Error(
          `Tope de gasto del mes alcanzado (${centimosAEuros(gasto.gastadoCent)} € de ${centimosAEuros(
            gasto.topeCent,
          )} €). No se ha activado.`,
        );
      }

      // Los tres niveles: activar solo la campaña deja el conjunto y el anuncio
      // en pausa, y no saldría nada.
      const [conjuntos, anuncios] = await Promise.all([
        db.from("meta_conjuntos").select("meta_id").eq("empresa_id", p.empresa_id).eq("campana_meta_id", p.campana_meta_id),
        db.from("meta_anuncios").select("meta_id").eq("empresa_id", p.empresa_id).eq("campana_meta_id", p.campana_meta_id),
      ]);

      await cambiarEstado(cred, p.campana_meta_id, "ACTIVE");
      for (const c of (conjuntos.data ?? []) as Array<{ meta_id: string }>) {
        await cambiarEstado(cred, c.meta_id, "ACTIVE");
      }
      for (const a of (anuncios.data ?? []) as Array<{ meta_id: string }>) {
        await cambiarEstado(cred, a.meta_id, "ACTIVE");
      }

      await db
        .from("meta_programaciones")
        .update({ estado: "hecha", ejecutada_at: new Date().toISOString(), error: null })
        .eq("id", p.id);

      await db
        .from("meta_campanas")
        .update({ estado: "ACTIVE" })
        .eq("empresa_id", p.empresa_id)
        .eq("meta_id", p.campana_meta_id);

      await db.from("meta_acciones").insert({
        empresa_id: p.empresa_id,
        usuario_id: null,
        usuario_nombre: "Programada",
        nivel: "campana",
        meta_id: p.campana_meta_id,
        accion: "activar",
        detalle: { origen: "programacion", programada_para: p.arrancar_at },
      });

      hechas.push(p.id);
    } catch (err) {
      const motivo = err instanceof Error ? err.message : "Error desconocido";
      console.error(`[meta-ads-programadas] ${p.campana_meta_id}:`, motivo);

      // Se marca como error y NO se reintenta sola: una campaña que arranca
      // horas tarde por su cuenta puede gastar cuando ya no interesaba. Queda
      // visible para que alguien decida.
      await db
        .from("meta_programaciones")
        .update({ estado: "error", error: motivo, ejecutada_at: new Date().toISOString() })
        .eq("id", p.id);

      fallidas.push({ id: p.id, motivo });
    }
  }

  return NextResponse.json({ ok: true, activadas: hechas.length, fallidas });
}
