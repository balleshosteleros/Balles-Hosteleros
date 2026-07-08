/**
 * Extracción por IA (visión) de los números de los documentos del candidato.
 *
 * Endpoint PÚBLICO (sin sesión): lo llama el formulario `/documentacion/<token>`
 * cuando el candidato adjunta una imagen/PDF. Lee el documento con Gemini (visión
 * nativa, el mismo motor que el resto del proyecto) y PROPONE el número detectado.
 * La persona siempre revisa y confirma después (la IA solo propone, no decide).
 *
 * Procesa imágenes Y PDF (Gemini lee ambos). Si el formato no se soporta o la IA
 * no detecta nada, devuelve `valor: null` y el formulario pide teclear el número.
 * Best-effort: si la IA no detecta nada, devuelve `valor: null` y el formulario
 * pide rehacer la foto.
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import {
  normalizarDniNie,
  normalizarIban,
  normalizarSeguridadSocial,
} from "@/features/rrhh/lib/documentacion-validacion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMG_BYTES = 10 * 1024 * 1024;
// Gemini lee imágenes Y PDFs, así que aceptamos ambos para autocompletar.
const TIPOS_IA = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif", "application/pdf"]);

const Schema = z.object({
  token: z.string().guid(),
  // Qué número queremos extraer de esta imagen.
  campo: z.enum(["dni_nie", "iban", "ss"]),
});

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const PROMPTS: Record<"dni_nie" | "iban" | "ss", string> = {
  dni_nie:
    "Esta imagen debe ser un DNI español o una tarjeta de NIE (documento de identidad de extranjero en España). " +
    "Extrae el número del documento (DNI: 8 dígitos + letra; NIE: letra X/Y/Z + 7 dígitos + letra), " +
    "la fecha de nacimiento del titular y su domicilio/dirección postal si aparece (suele estar en el reverso). " +
    "Responde SOLO con un JSON: {\"valor\":\"<numero o vacío>\",\"fecha_nacimiento\":\"<AAAA-MM-DD o vacío>\",\"direccion\":\"<domicilio completo o vacío>\"}. " +
    "La fecha SIEMPRE en formato AAAA-MM-DD (año-mes-día). La dirección tal cual aparece. Sin texto adicional.",
  iban:
    "Esta imagen muestra datos bancarios de una persona. Extrae el IBAN (empieza por dos letras de país, p.ej. ES, seguidas de 22 caracteres) " +
    "y, si aparecen, el NOMBRE COMPLETO del titular y su DNI/NIE. " +
    "Responde SOLO con un JSON: {\"valor\":\"<iban o vacío>\",\"titular_nombre\":\"<nombre o vacío>\",\"titular_dni\":\"<dni/nie o vacío>\"}. Sin texto adicional.",
  ss:
    "Esta imagen muestra un documento de la Seguridad Social de una persona. Extrae el número de afiliación (11 o 12 dígitos) " +
    "y, si aparecen, el NOMBRE COMPLETO del titular y su DNI/NIE. " +
    "Responde SOLO con un JSON: {\"valor\":\"<numero o vacío>\",\"titular_nombre\":\"<nombre o vacío>\",\"titular_dni\":\"<dni/nie o vacío>\"}. Sin texto adicional.",
};

/** Schema de salida: número detectado (+ fecha de nacimiento en el caso del DNI). */
const RESPUESTA_SCHEMA = {
  type: "object",
  properties: {
    valor: {
      type: "string",
      description: "El número detectado, o cadena vacía si no se puede leer con seguridad.",
    },
    fecha_nacimiento: {
      type: "string",
      description: "Fecha de nacimiento en formato AAAA-MM-DD (solo DNI/NIE/pasaporte), o cadena vacía.",
    },
    direccion: {
      type: "string",
      description: "Domicilio/dirección postal del titular si aparece (solo DNI/NIE), o cadena vacía.",
    },
    titular_nombre: {
      type: "string",
      description: "Nombre completo del titular que figura en el documento (IBAN/SS), o cadena vacía.",
    },
    titular_dni: {
      type: "string",
      description: "DNI/NIE del titular que figura en el documento (IBAN/SS), o cadena vacía.",
    },
  },
  required: ["valor"],
} as const;

/** Limpia el valor devuelto por el modelo (vacío/“null” → null). */
function limpiarValor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const limpio = v.trim();
  if (!limpio || limpio.toLowerCase() === "null") return null;
  return limpio;
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
    if (imagen.size > MAX_IMG_BYTES) {
      return NextResponse.json({ ok: false, error: "La imagen supera 10MB" }, { status: 400 });
    }
    if (!TIPOS_IA.has(imagen.type)) {
      // Formato no soportado por IA; el candidato teclea el número.
      return NextResponse.json({ ok: true, valor: null, motivo: "no_soportado" });
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

    // Lee la imagen con Gemini (visión nativa + JSON estructurado). El mismo
    // motor que ya usa el resto del proyecto (facturas, inspecciones…). Si no hay
    // GEMINI_API_KEY, degrada con elegancia: el candidato teclea el número.
    const buffer = Buffer.from(await imagen.arrayBuffer());
    let valor: string | null = null;
    let fechaNacimiento: string | null = null;
    let direccion: string | null = null;
    let titularDni: string | null = null;
    let titularNombre: string | null = null;
    try {
      const { data } = await geminiJSON<{
        valor?: string; fecha_nacimiento?: string; direccion?: string; titular_dni?: string; titular_nombre?: string;
      }>(PROMPTS[campo], {
        responseSchema: RESPUESTA_SCHEMA as never,
        temperature: 0,
        attachments: [{ mimeType: imagen.type, base64: buffer.toString("base64") }],
      });
      valor = limpiarValor(data.valor);
      // Fecha de nacimiento y dirección solo del DNI/NIE.
      if (campo === "dni_nie") {
        const f = typeof data.fecha_nacimiento === "string" ? data.fecha_nacimiento.trim() : "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
          const d = new Date(`${f}T00:00:00Z`);
          if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) fechaNacimiento = f;
        }
        const dir = typeof data.direccion === "string" ? data.direccion.trim() : "";
        if (dir.length >= 3 && dir.length <= 200) direccion = dir;
      }
      // Titular del documento (IBAN/SS): para verificar que coincide con el DNI.
      if (campo === "iban" || campo === "ss") {
        titularDni = limpiarValor(data.titular_dni);
        if (titularDni) titularDni = normalizarDniNie(titularDni);
        titularNombre = limpiarValor(data.titular_nombre);
      }
    } catch (e) {
      if (e instanceof GeminiKeyMissingError) {
        // Sin IA configurada: no es un error para el candidato, solo no autocompleta.
        return NextResponse.json({ ok: true, valor: null, motivo: "ia_no_configurada" });
      }
      console.error("[documentacion/extraer] gemini:", e);
      return NextResponse.json({ ok: true, valor: null, motivo: "ia_fallo" });
    }

    // Normaliza según el campo (mismo formato que validará el envío final).
    if (valor) {
      if (campo === "dni_nie") valor = normalizarDniNie(valor);
      else if (campo === "iban") valor = normalizarIban(valor);
      else if (campo === "ss") valor = normalizarSeguridadSocial(valor);
    }

    return NextResponse.json({
      ok: true, valor, fecha_nacimiento: fechaNacimiento, direccion,
      titular_dni: titularDni, titular_nombre: titularNombre,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion/extraer] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
