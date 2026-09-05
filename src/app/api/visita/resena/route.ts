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
import { sendEmail } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Estrella = z.number().int().min(1).max(5);

const Schema = z.object({
  token: z.string().min(10).max(100),
  /** Nota global: media de las tres, o la única si viene del QR de la carta. */
  rating: Estrella,
  comentario: z.string().trim().max(1000).optional().default(""),
  // Desglose (solo en la valoración tras una reserva). Opcionales: el cliente
  // puede puntuar solo lo que le apetezca.
  ratingComida: Estrella.optional(),
  ratingServicio: Estrella.optional(),
  ratingAmbiente: Estrella.optional(),
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
  const {
    token,
    rating,
    comentario,
    ratingComida,
    ratingServicio,
    ratingAmbiente,
  } = parsed.data;

  const supabase = service();

  // El token puede ser de un lead del QR de la carta o del correo de
  // valoración de una reserva. En el segundo caso la reseña queda enlazada al
  // CLIENTE y a la RESERVA, que es lo que permite mostrar su nota en la ficha.
  const { data: leadRow } = await supabase
    .from("visita_leads")
    .select("id, empresa_id, nombre, email, telefono")
    .eq("resena_token", token)
    .maybeSingle();

  let lead: {
    empresa_id: string;
    nombre: string | null;
    email: string | null;
    telefono: string | null;
    cliente_id: string | null;
    reserva_id: string | null;
    origen: "carta" | "reserva";
  } | null = leadRow
    ? {
        empresa_id: leadRow.empresa_id as string,
        nombre: (leadRow.nombre as string | null) ?? null,
        email: (leadRow.email as string | null) ?? null,
        telefono: (leadRow.telefono as string | null) ?? null,
        cliente_id: null,
        reserva_id: null,
        origen: "carta",
      }
    : null;

  if (!lead) {
    const { data: reserva } = await supabase
      .from("reservas")
      .select(
        "id, empresa_id, cliente_id, cliente_nombre, cliente_email, cliente_telefono",
      )
      .eq("valoracion_token", token)
      .maybeSingle();
    if (reserva) {
      lead = {
        empresa_id: reserva.empresa_id as string,
        nombre: (reserva.cliente_nombre as string | null) ?? null,
        email: (reserva.cliente_email as string | null) ?? null,
        telefono: (reserva.cliente_telefono as string | null) ?? null,
        cliente_id: (reserva.cliente_id as string | null) ?? null,
        reserva_id: reserva.id as string,
        origen: "reserva",
      };
    }
  }

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

  // Ya valorada con este enlace: se responde explícitamente en vez de fingir
  // que se ha guardado. Devolver `ok` a secas hacía que el cliente que abría el
  // correo en otro dispositivo rellenara todo otra vez y viera "gracias",
  // creyendo que su segunda opinión contaba, cuando se descartaba en silencio.
  if (existente) {
    return NextResponse.json({
      ok: true,
      yaRespondio: true,
      mensaje: "Esta visita ya estaba valorada. Se conserva tu primera opinión.",
    });
  }

  {
    const { error: errIns } = await supabase.from("resenas").insert({
      empresa_id: lead.empresa_id,
      nombre_comensal: lead.nombre ?? "Comensal",
      email: lead.email ?? null,
      telefono: lead.telefono ?? null,
      comentario: comentario || null,
      rating,
      rating_comida: ratingComida ?? null,
      rating_servicio: ratingServicio ?? null,
      rating_ambiente: ratingAmbiente ?? null,
      estado: ratingAEstado(rating),
      origen: lead.origen,
      cliente_id: lead.cliente_id,
      reserva_id: lead.reserva_id,
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

  // AVISO DE ESTRENO: la PRIMERA valoración que entra por el software (de
  // cualquier empresa) se avisa por correo, una sola vez, para poder verla
  // funcionar. No hace falta una marca aparte: si solo existe esta reseña
  // propia, es que es la primera. A partir de la segunda no vuelve a salir.
  await avisarPrimeraValoracion(supabase, {
    empresaId: lead.empresa_id,
    nombre: lead.nombre,
    rating,
    ratingComida,
    ratingServicio,
    ratingAmbiente,
    comentario,
  });

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

/** Destinatario del aviso de estreno. */
const AVISO_PRIMERA_VALORACION_A = "balleshosteleros@gmail.com";

/**
 * Correo de estreno: avisa de la PRIMERA valoración recogida por el software.
 *
 * Se manda una sola vez en todo el sistema, sea de la empresa que sea. Es para
 * comprobar que el circuito funciona de punta a punta, no un aviso permanente:
 * en cuanto hay más de una reseña propia, deja de salir para siempre.
 *
 * Nunca tumba la respuesta al cliente: si el correo falla, la valoración ya
 * está guardada y eso es lo que importa.
 */
async function avisarPrimeraValoracion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  datos: {
    empresaId: string;
    nombre: string | null;
    rating: number;
    ratingComida: number | null | undefined;
    ratingServicio: number | null | undefined;
    ratingAmbiente: number | null | undefined;
    comentario: string | null | undefined;
  },
): Promise<void> {
  try {
    // Reseñas nacidas EN el software: las de Cover y las de Google no cuentan,
    // son histórico importado y no dicen nada de si esto funciona.
    const { count } = await supabase
      .from("resenas")
      .select("id", { count: "exact", head: true })
      .in("origen", ["reserva", "carta"]);
    if ((count ?? 0) !== 1) return;

    const { data: emp } = await supabase
      .from("empresas")
      .select("nombre")
      .eq("id", datos.empresaId)
      .maybeSingle();
    const local = (emp?.nombre as string | null) ?? "";

    const fila = (etiqueta: string, valor: string) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#666">${etiqueta}</td>` +
      `<td style="padding:4px 0;font-weight:600">${valor}</td></tr>`;
    const nota = (n: number | null | undefined) =>
      typeof n === "number" ? `${n} / 5` : "no se preguntó";

    const html =
      `<p>Ha entrado la <strong>primera valoración</strong> recogida por el ` +
      `software. El circuito funciona.</p>` +
      `<table style="border-collapse:collapse;font-size:14px">` +
      fila("Local", local) +
      fila("Cliente", datos.nombre ?? "Comensal") +
      fila("Nota global", `${datos.rating} / 5`) +
      fila("Comida", nota(datos.ratingComida)) +
      fila("Servicio", nota(datos.ratingServicio)) +
      fila("Ambiente", nota(datos.ratingAmbiente)) +
      `</table>` +
      (datos.comentario
        ? `<p style="margin-top:12px"><em>“${datos.comentario}”</em></p>`
        : "") +
      `<p style="color:#666;font-size:13px;margin-top:16px">Este aviso sale ` +
      `una sola vez, con la primera. Las siguientes se ven en Calidad → ` +
      `Reseñas.</p>`;

    await sendEmail({
      to: AVISO_PRIMERA_VALORACION_A,
      subject: `Primera valoración recogida${local ? ` — ${local}` : ""}`,
      html,
      empresaId: datos.empresaId,
    });
  } catch (e) {
    console.error("[resena] aviso primera valoracion:", e);
  }
}
