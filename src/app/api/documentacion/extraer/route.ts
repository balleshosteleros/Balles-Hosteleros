/**
 * Extracción por IA (visión) de los números de los documentos del candidato.
 *
 * Endpoint PÚBLICO (sin sesión): lo llama el formulario `/documentacion/<token>`
 * cuando el candidato adjunta una imagen/PDF. La lectura en sí vive en
 * `leerDocumentoConIA`, compartida con el asistente de primer acceso del
 * empleado, para que los prompts se afinen en un solo sitio.
 *
 * La IA solo PROPONE: la persona revisa y confirma después. Si el formato no se
 * soporta o el modelo no lee nada, devuelve `valor: null` y el formulario pide
 * teclear el número.
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  leerDocumentoConIA,
  MAX_IA_BYTES,
} from "@/features/rrhh/services/documentacion/leer-documento-ia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Schema = z.object({
  token: z.string().guid(),
  // Qué dato queremos extraer de esta imagen.
  // dni_nie = anverso (número + fecha) · dni_reverso = domicilio · iban/ss = número.
  campo: z.enum(["dni_nie", "dni_reverso", "iban", "ss"]),
});

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const parsed = Schema.safeParse({
      token: String(fd.get("token") ?? "").trim(),
      campo: String(fd.get("campo") ?? "").trim(),
    });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos no válidos" }, { status: 400 });
    }
    const { token, campo } = parsed.data;

    const imagen = fd.get("imagen") as File | null;
    if (!imagen || imagen.size === 0) {
      return NextResponse.json({ ok: false, error: "Falta la imagen" }, { status: 400 });
    }
    if (imagen.size > MAX_IA_BYTES) {
      return NextResponse.json({ ok: false, error: "La imagen supera 10MB" }, { status: 400 });
    }

    // Verifica que el token corresponde a un candidato real (anti-abuso básico).
    const supabase = service();
    const { data: cand } = await supabase
      .from("candidatos")
      .select("id")
      .eq("documentacion_token", token)
      .maybeSingle();
    if (!cand) {
      return NextResponse.json({ ok: false, error: "Enlace no válido" }, { status: 404 });
    }

    const buffer = Buffer.from(await imagen.arrayBuffer());
    const lectura = await leerDocumentoConIA(campo, imagen.type, buffer);

    return NextResponse.json({ ok: true, ...lectura });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion/extraer] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
