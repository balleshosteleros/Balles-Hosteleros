/**
 * Genera la ANULACIÓN DEL PREAVISO y se la manda a firmar al trabajador que
 * vuelve al equipo.
 *
 * BLOQUEANTE, al revés que las cartas de baja: aquí la firma no es un acuse de
 * recibo, es la prueba de que la baja se anuló de mutuo acuerdo. Sin ella, la
 * empresa tiene a alguien trabajando con una baja voluntaria en vigor sobre la
 * mesa. Por eso, mientras no firme, el sistema no le deja fichar (ver
 * `anulacion-preaviso-pendiente.ts`).
 *
 * Puede firmarla desde el enlace del correo o desde la propia app (Mi Panel →
 * Mis documentos); al firmar, el token queda consumido y el enlace deja de valer.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIdentidadEmpresa } from "@/features/empresa/services/identidad-empresa";
import { getMarcaEmpresa } from "@/lib/pdf/cabecera-documento";
import { generarAnulacionPreavisoPDF } from "./anulacion-preaviso-pdf";
import { crearFirmaInterno } from "./crear-firma";

export type EnviarAnulacionPreavisoResult =
  | { ok: true; documentoId: string; emailEnviado: boolean }
  | { ok: false; error: string };

/** dd/mm/aaaa a partir de un ISO YYYY-MM-DD. */
function fmtEs(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export async function enviarAnulacionPreaviso(input: {
  empresaId: string;
  empleadoId: string;
  /** ISO YYYY-MM-DD del último día que figuraba en el preaviso. */
  bajaPrevistaIso: string;
  /** ISO YYYY-MM-DD del día en que presentó la baja (si se conoce). */
  fechaSolicitudIso?: string | null;
  enviadoPorUserId: string;
  enviadoPorNombre: string;
  /** Fecha de la anulación en ISO; por defecto hoy. */
  fechaAnulacionIso?: string;
}): Promise<EnviarAnulacionPreavisoResult> {
  try {
    const admin = createAdminClient();

    const empleadoRes = await admin
      .from("empleados")
      .select("id, nombre, apellidos, dni_nie, local_id")
      .eq("id", input.empleadoId)
      .eq("empresa_id", input.empresaId)
      .maybeSingle();

    const emp = empleadoRes.data as
      | {
          id: string;
          nombre: string | null;
          apellidos: string | null;
          dni_nie: string | null;
          local_id: string | null;
        }
      | null;
    if (!emp) return { ok: false, error: "No se encontró al trabajador." };

    const empleadoNombre =
      `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() || "Empleado/a";
    // La sociedad, desde Ajustes → Empresa: es con quien sigue el contrato.
    const identidad = await getIdentidadEmpresa(admin, input.empresaId);
    const empresaNombre = identidad.razonSocial;

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

    const fechaAnulacionIso =
      input.fechaAnulacionIso ?? new Date().toISOString().slice(0, 10);

    const doc = await generarAnulacionPreavisoPDF({
      empleadoNombre,
      empleadoDni: emp.dni_nie,
      empresaNombre,
      ciudad,
      fechaAnulacion: fmtEs(fechaAnulacionIso),
      fechaSolicitud: input.fechaSolicitudIso ? fmtEs(input.fechaSolicitudIso) : null,
      fechaBajaPrevista: fmtEs(input.bajaPrevistaIso),
      marca: await getMarcaEmpresa(input.empresaId),
    });

    // Mismo doble factor que el resto de documentos internos: OTP por email +
    // trazo manuscrito. Plazo corto (3 días): es lo que le separa de poder
    // volver a fichar, así que no debe quedarse ahí semanas.
    const firma = await crearFirmaInterno({
      empresaId: input.empresaId,
      empleadoId: emp.id,
      pdf: doc.buffer,
      titulo: "Anulación del preaviso de baja",
      tipo: "anulacion_preaviso",
      modalidad: "manuscrita_digital",
      validez: "eidas_simple",
      plazoDias: 3,
      observaciones:
        `Anulación del preaviso. La baja prevista para el ${fmtEs(input.bajaPrevistaIso)} queda sin efecto ` +
        "y continúa en la empresa en las mismas condiciones. Hasta que no la firme no puede fichar.",
      enviadoPorUserId: input.enviadoPorUserId,
      enviadoPorNombre: input.enviadoPorNombre,
      preferirEmailPersonal: true,
      posicionFirmaDefault: [doc.posicionFirma],
      emailAsunto: "Firma la anulación de tu baja",
      emailIntro:
        "Tu baja queda anulada y sigues en el equipo. Firma este documento para dejarlo por escrito: " +
        "hasta que no lo firmes no podrás fichar.",
    });

    if (!firma.ok) return { ok: false, error: firma.error };
    return { ok: true, documentoId: firma.documentoId, emailEnviado: firma.emailEnviado };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] enviarAnulacionPreaviso:", msg);
    return { ok: false, error: msg };
  }
}
