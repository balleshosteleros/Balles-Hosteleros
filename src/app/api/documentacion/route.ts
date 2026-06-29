/**
 * Envío final del paso «Documentación» del candidato.
 *
 * Endpoint PÚBLICO (sin sesión): lo llama el formulario `/documentacion/<token>`.
 * Recibe los documentos (DNI/NIE anverso+reverso, IBAN, SS) y los números que el
 * candidato ha REVISADO y CONFIRMADO. Valida formato, sube los archivos al bucket
 * privado `documentacion-candidatos` con el service-role y guarda todo en la ficha
 * del candidato, marcando `documentacion_completada_at`.
 *
 * Seguridad: el candidato solo puede escribir SU propia ficha (resuelta por el
 * token único); nunca lee ni toca datos de otros candidatos.
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  esDniNieValido,
  esIbanValido,
  esSeguridadSocialValida,
  normalizarDniNie,
  normalizarIban,
  normalizarSeguridadSocial,
} from "@/features/rrhh/lib/documentacion-validacion";
import { BUCKET_DOC_CANDIDATOS } from "@/features/rrhh/lib/documentacion-candidato";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_DOC_BYTES = 10 * 1024 * 1024;
const TIPOS_OK: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const Schema = z.object({
  token: z.string().guid(),
  dni_nie: z.string().min(1).max(20),
  iban: z.string().min(1).max(40),
  num_seguridad_social: z.string().min(1).max(20),
  direccion: z.string().min(1).max(200),
  // YYYY-MM-DD; debe ser una fecha real y anterior a hoy.
  fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
});

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Sube un documento al bucket privado y devuelve su path, o null si falla/ausente. */
async function subirDoc(
  supabase: ReturnType<typeof service>,
  file: File | null,
  empresaId: string,
  candidatoId: string,
  tipo: string,
): Promise<{ path: string | null; error?: string }> {
  if (!file || file.size === 0) return { path: null };
  if (file.size > MAX_DOC_BYTES) return { path: null, error: `${tipo}: supera 10MB` };
  const ext = TIPOS_OK[file.type];
  if (!ext) return { path: null, error: `${tipo}: formato no admitido` };

  const path = `${empresaId}/${candidatoId}/${tipo}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET_DOC_CANDIDATOS)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (error) return { path: null, error: `${tipo}: ${error.message}` };
  return { path };
}

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const parsed = Schema.safeParse({
      token: String(fd.get("token") ?? "").trim(),
      dni_nie: String(fd.get("dni_nie") ?? "").trim(),
      iban: String(fd.get("iban") ?? "").trim(),
      num_seguridad_social: String(fd.get("num_seguridad_social") ?? "").trim(),
      direccion: String(fd.get("direccion") ?? "").trim(),
      fecha_nacimiento: String(fd.get("fecha_nacimiento") ?? "").trim(),
    });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos incompletos" }, { status: 400 });
    }

    // La fecha de nacimiento debe ser real y estar en el pasado.
    const fechaNac = new Date(`${parsed.data.fecha_nacimiento}T00:00:00Z`);
    if (Number.isNaN(fechaNac.getTime()) || fechaNac.getTime() >= Date.now()) {
      return NextResponse.json({ ok: false, error: "La fecha de nacimiento no es válida" }, { status: 400 });
    }

    // Normaliza + valida los números confirmados por la persona.
    const dniNie = normalizarDniNie(parsed.data.dni_nie);
    const iban = normalizarIban(parsed.data.iban);
    const ss = normalizarSeguridadSocial(parsed.data.num_seguridad_social);
    if (!esDniNieValido(dniNie)) {
      return NextResponse.json({ ok: false, error: "El DNI/NIE no es válido" }, { status: 400 });
    }
    if (!esIbanValido(iban)) {
      return NextResponse.json({ ok: false, error: "El IBAN no es válido" }, { status: 400 });
    }
    if (!esSeguridadSocialValida(ss)) {
      return NextResponse.json({ ok: false, error: "El nº de la Seguridad Social no es válido" }, { status: 400 });
    }

    const supabase = service();

    // Resuelve el candidato por su token (única forma de identificarlo sin sesión).
    const { data: cand } = await supabase
      .from("candidatos")
      .select("id, empresa_id, nombre, apellidos, vacante_id, documentacion_completada_at")
      .eq("documentacion_token", parsed.data.token)
      .maybeSingle();
    if (!cand) {
      return NextResponse.json({ ok: false, error: "Enlace no válido o caducado" }, { status: 404 });
    }
    const candidatoId = cand.id as string;
    const empresaId = cand.empresa_id as string;

    // Documentos: DNI anverso + reverso y SS son obligatorios; el IBAN puede venir
    // como documento o solo como número tecleado.
    const dniAnverso = fd.get("dni_anverso") as File | null;
    const dniReverso = fd.get("dni_reverso") as File | null;
    const docIban = fd.get("doc_iban") as File | null;
    const docSs = fd.get("doc_ss") as File | null;
    const fotoPerfil = fd.get("foto_perfil") as File | null;
    if (!dniAnverso || dniAnverso.size === 0) {
      return NextResponse.json({ ok: false, error: "Falta el documento del DNI/NIE (anverso)" }, { status: 400 });
    }
    if (!dniReverso || dniReverso.size === 0) {
      return NextResponse.json({ ok: false, error: "Falta el documento del DNI/NIE (reverso)" }, { status: 400 });
    }
    if (!docSs || docSs.size === 0) {
      return NextResponse.json({ ok: false, error: "Falta el documento de la Seguridad Social" }, { status: 400 });
    }
    if (!fotoPerfil || fotoPerfil.size === 0) {
      return NextResponse.json({ ok: false, error: "Falta la foto de perfil" }, { status: 400 });
    }
    // La foto de perfil debe ser una imagen (no PDF).
    if (!fotoPerfil.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "La foto de perfil debe ser una imagen" }, { status: 400 });
    }

    // Sube los documentos (best-effort por archivo; si alguno obligatorio falla, aborta).
    const subidas = await Promise.all([
      subirDoc(supabase, dniAnverso, empresaId, candidatoId, "dni_anverso"),
      subirDoc(supabase, dniReverso, empresaId, candidatoId, "dni_reverso"),
      subirDoc(supabase, docIban, empresaId, candidatoId, "iban"),
      subirDoc(supabase, docSs, empresaId, candidatoId, "ss"),
      subirDoc(supabase, fotoPerfil, empresaId, candidatoId, "foto_perfil"),
    ]);
    const errSubida = subidas.find((s) => s.error)?.error;
    if (errSubida) {
      return NextResponse.json({ ok: false, error: `No se pudo subir un documento (${errSubida})` }, { status: 500 });
    }
    const [anverso, reverso, ibanDoc, ssDoc, fotoDoc] = subidas;

    // Guarda números + paths + sello de completado en la ficha.
    const { error: upErr } = await supabase
      .from("candidatos")
      .update({
        dni_nie: dniNie,
        iban,
        num_seguridad_social: ss,
        doc_dni_anverso_path: anverso.path,
        doc_dni_reverso_path: reverso.path,
        doc_iban_path: ibanDoc.path,
        doc_ss_path: ssDoc.path,
        foto_perfil_path: fotoDoc.path,
        direccion: parsed.data.direccion,
        fecha_nacimiento: parsed.data.fecha_nacimiento,
        documentacion_completada_at: new Date().toISOString(),
      })
      .eq("id", candidatoId);
    if (upErr) {
      console.error("[documentacion] update error:", upErr.message);
      return NextResponse.json({ ok: false, error: "No se pudo guardar la documentación" }, { status: 500 });
    }

    // Aviso al equipo de RRHH de que el candidato ha completado su documentación.
    // Best-effort: nunca rompe el flujo. Solo la primera vez que se completa.
    if (!cand.documentacion_completada_at) {
      try {
        const { emitirNotificacion } = await import(
          "@/features/notificaciones/actions/notificaciones-actions"
        );
        const nombreCompleto = `${(cand.nombre as string) ?? ""} ${(cand.apellidos as string) ?? ""}`.trim();
        await emitirNotificacion({
          empresaId,
          system: true,
          tipo: "documentacion_candidato",
          titulo: `Documentación recibida: ${nombreCompleto}`,
          mensaje: `${nombreCompleto} ha aportado su documentación (DNI/NIE, IBAN y Seguridad Social).`,
          segmento: { tipo: "area", area: "ADMINISTRATIVA" },
          refTabla: "candidatos",
          refId: candidatoId,
          accionUrl: "/rrhh/reclutamiento",
          dedupeKey: `documentacion:${candidatoId}`,
        });
      } catch (e) {
        console.error("[documentacion] aviso equipo:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
