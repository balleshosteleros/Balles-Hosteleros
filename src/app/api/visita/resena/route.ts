/**
 * POST /api/visita/resena — guarda la reseña enviada desde /r/[token].
 *
 * Inserta en la tabla `resenas` con `origen='carta'` y `external_id=token`
 * (anti-duplicado). Mapea rating→estado para que aparezca en el pipeline
 * de calidad correcto.
 *
 * Si la empresa tiene activado el filtro 5⭐→Google, devuelve
 * `{ redirect: '<google_review_url>' }` para que el cliente redirija.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Schema = z.object({
  token: z.string().min(10).max(100),
  rating: z.number().int().min(1).max(5),
  comentario: z.string().trim().max(1000).optional().default(""),
});

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function ratingAEstado(rating: number): string {
  if (rating >= 4) return "excelente";
  if (rating === 3) return "regular";
  return "malo";
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const { token, rating, comentario } = parsed.data;

  const supabase = service();

  // Lead + empresa
  const { data: lead } = await supabase
    .from("visita_leads")
    .select("id, empresa_id, nombre, email, telefono")
    .eq("resena_token", token)
    .maybeSingle();
  if (!lead) {
    return NextResponse.json({ ok: false, error: "Token no válido" }, { status: 404 });
  }

  // Anti-duplicado: si ya hay reseña con external_id=token, no creamos otra.
  const { data: existente } = await supabase
    .from("resenas")
    .select("id")
    .eq("empresa_id", lead.empresa_id)
    .eq("external_id", token)
    .maybeSingle();

  if (!existente) {
    const { error: errIns } = await supabase.from("resenas").insert({
      empresa_id: lead.empresa_id,
      nombre_comensal: lead.nombre ?? "Comensal",
      email: lead.email ?? null,
      telefono: lead.telefono ?? null,
      comentario: comentario || null,
      rating,
      estado: ratingAEstado(rating),
      origen: "carta",
      external_id: token,
      fecha_reseña: new Date().toISOString(),
    });
    if (errIns) {
      return NextResponse.json(
        { ok: false, error: errIns.message },
        { status: 500 },
      );
    }
  }

  // ¿Redirección a Google si 5⭐?
  let redirect: string | undefined;
  if (rating === 5) {
    const { data: cfg } = await supabase
      .from("visita_config")
      .select("redirigir_5estrellas_google, google_review_url")
      .eq("empresa_id", lead.empresa_id)
      .maybeSingle();
    if (cfg?.redirigir_5estrellas_google && cfg.google_review_url) {
      redirect = cfg.google_review_url as string;
    }
  }

  return NextResponse.json({ ok: true, redirect });
}
