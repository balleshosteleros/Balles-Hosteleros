/**
 * Genera la carta de COMUNICACIÓN DE BAJA (la que causa la empresa) y la manda
 * a firmar al trabajador.
 *
 * NO BLOQUEANTE por diseño: un trabajador puede negarse a firmar un despido, y
 * esa negativa no lo invalida. Si el envío falla o el trabajador no firma, la
 * baja sigue su curso; lo que queda es la constancia — el acta eIDAS registra
 * la apertura del documento (fecha, hora, IP) aunque no se llegue a firmar.
 *
 * Por eso esta función nunca lanza: devuelve el resultado para informarlo en la
 * UI, pero jamás tumba la tramitación de la baja.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarcaEmpresa } from "@/lib/pdf/cabecera-documento";
import { generarCartaBajaEmpresaPDF } from "./baja-empresa-pdf";
import { crearFirmaInterno } from "./crear-firma";

export type EnviarCartaBajaResult =
  | { ok: true; documentoId: string; emailEnviado: boolean }
  | { ok: false; error: string };

/** dd/mm/aaaa a partir de un ISO YYYY-MM-DD. */
function fmtEs(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Día siguiente a un ISO (día oficial de la baja). */
function diaSiguienteIso(iso: string): string {
  const t = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return iso;
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

export async function enviarCartaBajaEmpresa(input: {
  empresaId: string;
  empleadoId: string;
  /** ISO YYYY-MM-DD del último día de prestación de servicios. */
  ultimoDiaIso: string;
  /** Etiqueta del tipo de baja (Disciplinaria, Fin de contrato…). */
  tipoBajaLabel: string;
  /** Hechos que motivan la baja, ya redactados por RRHH. */
  hechos: string | null;
  /** Quién tramita la baja (para `enviado_por` y el correo). */
  enviadoPorUserId: string;
  enviadoPorNombre: string;
  /** Fecha de emisión en ISO; por defecto, hoy en la zona del servidor. */
  fechaComunicacionIso?: string;
}): Promise<EnviarCartaBajaResult> {
  try {
    const admin = createAdminClient();

    const [empleadoRes, empresaRes] = await Promise.all([
      admin
        .from("empleados")
        .select("id, nombre, apellidos, dni_nie, local_id")
        .eq("id", input.empleadoId)
        .eq("empresa_id", input.empresaId)
        .maybeSingle(),
      admin
        .from("empresas")
        .select("nombre, datos_generales")
        .eq("id", input.empresaId)
        .maybeSingle(),
    ]);

    const emp = empleadoRes.data as
      | { id: string; nombre: string | null; apellidos: string | null; dni_nie: string | null; local_id: string | null }
      | null;
    if (!emp) return { ok: false, error: "No se encontró al trabajador." };

    const empleadoNombre =
      `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() || "Empleado/a";
    const empresaNombre = (empresaRes.data?.nombre as string | undefined) ?? "La empresa";

    // CIF de la empresa (Ajustes → Datos generales). Best-effort: si no está,
    // la carta se emite igual sin él.
    const dg = (empresaRes.data?.datos_generales as Record<string, unknown> | null) ?? null;
    const empresaCif =
      typeof dg?.cif === "string" && dg.cif.trim() ? (dg.cif as string).trim() : null;

    // Ciudad del local del trabajador, para el encabezado (best-effort).
    let ciudad: string | null = null;
    if (emp.local_id) {
      const { data: local } = await admin
        .from("locales")
        .select("ciudad")
        .eq("id", emp.local_id)
        .maybeSingle();
      ciudad = (local?.ciudad as string | null) ?? null;
    }

    const fechaComunicacionIso =
      input.fechaComunicacionIso ?? new Date().toISOString().slice(0, 10);

    // 1) Generar el PDF. El generador devuelve la posición EXACTA del hueco de
    //    firma, para estamparla automáticamente (el trabajador no la coloca).
    const carta = await generarCartaBajaEmpresaPDF({
      empleadoNombre,
      empleadoDni: emp.dni_nie,
      empresaNombre,
      empresaCif,
      ciudad,
      fechaComunicacion: fmtEs(fechaComunicacionIso),
      ultimoDia: fmtEs(input.ultimoDiaIso),
      diaOficial: fmtEs(diaSiguienteIso(input.ultimoDiaIso)),
      tipoBajaLabel: input.tipoBajaLabel,
      hechos: input.hechos,
      marca: await getMarcaEmpresa(input.empresaId),
    });

    // 2) Enviar a firma. Mismo doble factor que el resto de documentos internos
    //    (OTP por email + trazo manuscrito). Plazo amplio: a diferencia de la
    //    baja voluntaria, aquí el trabajador no está esperando el enlace y debe
    //    poder abrirlo con calma.
    const firma = await crearFirmaInterno({
      empresaId: input.empresaId,
      empleadoId: emp.id,
      pdf: carta.buffer,
      titulo: "Comunicación de baja de contrato",
      tipo: "baja_empresa",
      modalidad: "manuscrita_digital",
      validez: "eidas_simple",
      plazoDias: 14,
      observaciones: `Comunicación de baja (${input.tipoBajaLabel}). Último día: ${fmtEs(input.ultimoDiaIso)}. La firma acredita la recepción, no la conformidad.`,
      enviadoPorUserId: input.enviadoPorUserId,
      enviadoPorNombre: input.enviadoPorNombre,
      // Documento personal: al correo personal del trabajador si lo tiene.
      preferirEmailPersonal: true,
      posicionFirmaDefault: carta.posicionFirma,
    });

    if (!firma.ok) return { ok: false, error: firma.error };
    return { ok: true, documentoId: firma.documentoId, emailEnviado: firma.emailEnviado };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] enviarCartaBajaEmpresa:", msg);
    return { ok: false, error: msg };
  }
}
