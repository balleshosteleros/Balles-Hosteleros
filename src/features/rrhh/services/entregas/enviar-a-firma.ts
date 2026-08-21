/**
 * Envío a firma de las dos actas de una entrega de material.
 *
 * ENTREGA:    RRHH registra la pieza y el trabajador firma que la ha recibido.
 * DEVOLUCIÓN: RRHH pide la devolución y el trabajador firma que la ha devuelto.
 *
 * Las dos usan el mismo motor de firmas que el contrato o la baja voluntaria
 * (`crearFirmaInterno`), así que heredan gratis el doble factor (OTP + trazo
 * manuscrito), el acta eIDAS y el archivado del PDF firmado.
 *
 * El correo va al email PERSONAL del trabajador: el material le concierne a él
 * y tiene que poder firmar la devolución aunque ya haya perdido el correo de
 * empresa al salir.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { crearFirmaInterno } from "@/features/rrhh/services/firmas/crear-firma";
import {
  generarActaEntregaPDF,
  tituloActa,
  type ActaEntregaVariante,
} from "@/features/rrhh/services/firmas/entrega-material-pdf";

export type EnviarAFirmaResult =
  | { ok: true; documentoId: string; emailEnviado: boolean }
  | { ok: false; error: string };

/** dd/mm/yyyy a partir de un ISO o `yyyy-mm-dd`, sin desplazar por zona horaria. */
function formatFechaEs(iso: string): string {
  const soloFecha = iso.slice(0, 10);
  const [a, m, d] = soloFecha.split("-");
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

interface EnviarActaInput {
  variante: ActaEntregaVariante;
  entregaId: string;
  empresaId: string;
  /** Quién lo solicita (RRHH). Va en `enviado_por` de la firma. */
  solicitanteUserId: string;
  solicitanteNombre: string;
  /** Solo para la MERMA: por qué se da de baja la pieza. */
  motivoMerma?: string | null;
}

/**
 * Genera el acta, la manda a firmar y devuelve el id del documento de firma.
 * No toca el estado de la entrega: eso lo hace el llamador, que es quien sabe
 * si está registrando una entrega o pidiendo una devolución.
 */
export async function enviarActaEntregaAFirma(
  input: EnviarActaInput,
): Promise<EnviarAFirmaResult> {
  try {
    const admin = createAdminClient();

    // ─── La entrega, su pieza y el trabajador ───────────────────
    const { data: entrega } = await admin
      .from("entregas_material")
      .select("id, empresa_id, empleado_id, fecha, nota")
      .eq("id", input.entregaId)
      .eq("empresa_id", input.empresaId)
      .maybeSingle();
    if (!entrega) return { ok: false, error: "La entrega ya no existe" };

    const e = entrega as {
      id: string;
      empresa_id: string;
      empleado_id: string;
      fecha: string;
      nota: string | null;
    };

    const { data: item } = await admin
      .from("entregas_material_items")
      .select("tipo_nombre, categoria, talla, requiere_devolucion")
      .eq("entrega_id", input.entregaId)
      .maybeSingle();
    if (!item) return { ok: false, error: "La entrega no tiene material asociado" };

    const it = item as {
      tipo_nombre: string;
      categoria: string;
      talla: string | null;
      requiere_devolucion: boolean | null;
    };

    const { data: empleado } = await admin
      .from("empleados")
      .select("id, nombre, apellidos, dni_nie, local_id")
      .eq("id", e.empleado_id)
      .maybeSingle();
    if (!empleado) return { ok: false, error: "El trabajador ya no existe" };

    const emp = empleado as {
      id: string;
      nombre: string | null;
      apellidos: string | null;
      dni_nie: string | null;
      local_id: string | null;
    };
    const empleadoNombre =
      `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() || "Trabajador/a";

    // ─── Empresa y ciudad para la cabecera del acta ─────────────
    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre, nif")
      .eq("id", input.empresaId)
      .maybeSingle();
    const emprRow = empresa as { nombre?: string | null; nif?: string | null } | null;
    const empresaNombre = emprRow?.nombre ?? "La empresa";
    const empresaCif = emprRow?.nif ?? null;

    let ciudad: string | null = null;
    if (emp.local_id) {
      const { data: local } = await admin
        .from("locales")
        .select("ciudad")
        .eq("id", emp.local_id)
        .maybeSingle();
      ciudad = (local as { ciudad?: string | null } | null)?.ciudad ?? null;
    }

    // ─── El acta ────────────────────────────────────────────────
    const esEntrega = input.variante === "entrega";
    const esMerma = input.variante === "merma";
    const acta = await generarActaEntregaPDF({
      variante: input.variante,
      empleadoNombre,
      empleadoDni: emp.dni_nie,
      empresaNombre,
      empresaCif,
      ciudad,
      // La entrega se fecha el día que se entregó; devolución y merma, hoy.
      fecha: formatFechaEs(esEntrega ? e.fecha : new Date().toISOString()),
      tipoNombre: it.tipo_nombre,
      categoria: it.categoria === "uniforme" ? "uniforme" : "material",
      talla: it.talla,
      requiereDevolucion: Boolean(it.requiere_devolucion),
      nota: e.nota,
      motivoMerma: input.motivoMerma ?? null,
    });

    const titulo = tituloActa(input.variante, it.tipo_nombre);

    return await crearFirmaInterno({
      empresaId: input.empresaId,
      empleadoId: emp.id,
      pdf: acta.buffer,
      titulo,
      tipo: esEntrega
        ? "entrega_material"
        : esMerma
          ? "merma_material"
          : "devolucion_material",
      // Doble factor, igual que el contrato: código por email + trazo manuscrito.
      modalidad: "manuscrita_digital",
      validez: "eidas_simple",
      plazoDias: 14,
      observaciones: (() => {
        const pieza = `${it.tipo_nombre}${it.talla ? ` (talla ${it.talla})` : ""}`;
        if (esEntrega) return `Entrega de ${pieza}.`;
        if (esMerma) {
          const motivo = input.motivoMerma?.trim();
          return `Baja por deterioro de ${pieza}.${motivo ? ` Motivo: ${motivo}` : ""}`;
        }
        return `Devolución de ${pieza}.`;
      })(),
      enviadoPorUserId: input.solicitanteUserId,
      enviadoPorNombre: input.solicitanteNombre || empresaNombre,
      // Documento personal: a su correo, no al corporativo (que pierde al salir).
      preferirEmailPersonal: true,
      // El generador calculó el hueco exacto, así que la firma va ya colocada.
      posicionFirmaDefault: acta.posicionFirma,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}
