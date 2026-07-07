/**
 * Extracción por IA (visión) de las nóminas de un mes.
 *
 * Endpoint AUTENTICADO (gestores de RRHH): lo llama el módulo de Pagos cuando se
 * adjuntan una o varias nóminas. Admite un archivo por empleado O UN PDF con
 * TODAS las nóminas juntas (una por página, el caso de la gestoría): el núcleo
 * compartido `extraerNominasDeArchivo` parte el PDF y lee cada página con Gemini.
 *
 * Devuelve un array `nominas` (NominaLeida): datos leídos + el propio documento
 * en base64, para que el cliente lo guarde en Storage vinculado al empleado.
 *
 * La misma lógica de lectura la reutiliza el enlace público de la gestoría
 * (`/api/gestoria/nominas/[token]`). Si no hay GEMINI_API_KEY, degrada con
 * elegancia.
 */
import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/supabase/get-context";
import {
  extraerNominasDeArchivo,
  resolverMimeNomina,
  GeminiKeyMissingError,
  MAX_NOMINAS_BYTES,
} from "@/features/rrhh/services/nominas/extraer-nominas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Autenticación: solo usuarios con empresa activa (gestores de RRHH).
    const { empresaId } = await getAppContext();
    if (!empresaId) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const fd = await req.formData();
    const archivo = fd.get("archivo") as File | null;
    if (!archivo || archivo.size === 0) {
      return NextResponse.json({ ok: false, error: "Falta el archivo" }, { status: 400 });
    }
    if (archivo.size > MAX_NOMINAS_BYTES) {
      return NextResponse.json({ ok: false, error: "El archivo supera 25MB" }, { status: 400 });
    }
    const tipo = resolverMimeNomina(archivo);
    if (!tipo) {
      return NextResponse.json(
        { ok: false, error: "Formato no admitido (usa PDF, JPG, PNG o WebP)" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());

    try {
      const nominas = await extraerNominasDeArchivo(buffer, tipo);
      if (nominas.length === 0) {
        return NextResponse.json({ ok: false, motivo: "ia_fallo", error: "No se pudo leer ninguna nómina" });
      }
      return NextResponse.json({ ok: true, nominas });
    } catch (e) {
      if (e instanceof GeminiKeyMissingError) {
        return NextResponse.json({ ok: false, motivo: "ia_no_configurada", error: "IA no configurada" });
      }
      console.error("[nominas/extraer] fatal ia:", e);
      return NextResponse.json({ ok: false, motivo: "ia_fallo", error: "No se pudo leer la nómina" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[nominas/extraer] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
