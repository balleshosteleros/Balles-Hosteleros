import "server-only";

/**
 * Materializa la ENTREGA de una solicitud de material aprobada.
 *
 * El trabajador pide una prenda desde Solicitudes; cuando RRHH la aprueba, se
 * crea la entrega en `entregas_material` exactamente igual que si la hubiera
 * registrado a mano desde el módulo Entregas, y se le manda el acta para que
 * firme que la ha recibido. A partir de ahí sigue el mismo ciclo que cualquier
 * otra entrega: firma, devolución, merma.
 *
 * Idempotente: si la solicitud ya tiene `entrega_id`, no crea una segunda.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarActaEntregaAFirma } from "@/features/rrhh/services/entregas/enviar-a-firma";

/** `yyyy-mm-dd` → `dd/mm/yyyy`, sin desplazar por zona horaria. */
function formatFechaEs(iso: string): string {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

export interface SolicitudEntrega {
  id: string;
  empresa_id: string;
  user_id: string;
  entrega_tipo_id: string | null;
  entrega_tipo_nombre: string | null;
  entrega_talla: string | null;
  entrega_id: string | null;
  motivo: string | null;
  /** Día en que el trabajador la pidió (`fecha_inicio` de la solicitud). */
  fecha_inicio: string | null;
}

export interface MaterializarEntregaResult {
  ok: boolean;
  entregaId?: string;
  /** La entrega se creó pero el correo de firma no salió: RRHH puede reenviarlo. */
  firmaEnviada?: boolean;
  error?: string;
}

/**
 * Crea la entrega de una solicitud de material aprobada.
 *
 * `admin` debe poder escribir sin RLS (service-role): quien aprueba es RRHH,
 * pero la entrega se registra a nombre del trabajador que la pidió.
 */
export async function materializarEntregaDeSolicitud(
  admin: SupabaseClient,
  solicitud: SolicitudEntrega,
  aprobador: { userId: string; nombre: string },
): Promise<MaterializarEntregaResult> {
  // Ya materializada (reaprobación): no se duplica.
  if (solicitud.entrega_id) {
    return { ok: true, entregaId: solicitud.entrega_id, firmaEnviada: true };
  }

  const tipoNombre = solicitud.entrega_tipo_nombre?.trim();
  if (!tipoNombre) {
    return { ok: false, error: "La solicitud no dice qué material se pidió." };
  }

  // La ficha del trabajador en ESTA empresa: quien pide es un usuario, pero la
  // entrega se registra contra su ficha de empleado.
  const { data: empleado } = await admin
    .from("empleados")
    .select("id")
    .eq("user_id", solicitud.user_id)
    .eq("empresa_id", solicitud.empresa_id)
    .maybeSingle();
  const empleadoId = (empleado as { id: string } | null)?.id;
  if (!empleadoId) {
    return { ok: false, error: "El solicitante no tiene ficha de empleado en esta empresa." };
  }

  // Categoría y devolución salen del catálogo. Si el tipo se borró después de
  // pedirlo, se usan los valores por defecto y se conserva el nombre pedido.
  let categoria = "material";
  let requiereDevolucion = true;
  if (solicitud.entrega_tipo_id) {
    const { data: tipo } = await admin
      .from("entregas_tipos_material")
      .select("categoria, requiere_devolucion")
      .eq("id", solicitud.entrega_tipo_id)
      .maybeSingle();
    const t = tipo as { categoria?: string; requiere_devolucion?: boolean } | null;
    if (t) {
      categoria = t.categoria === "uniforme" ? "uniforme" : "material";
      requiereDevolucion = t.requiere_devolucion !== false;
    }
  }

  // La entrega se fecha el día en que se da, no el que se pidió. Pero el día de
  // la petición queda escrito en la nota, que es lo que ve el trabajador.
  const hoy = new Date().toISOString().slice(0, 10);
  const pedidaEl = solicitud.fecha_inicio?.slice(0, 10);
  const nota = [
    pedidaEl
      ? `Entregado a petición del trabajador (pedida el ${formatFechaEs(pedidaEl)}).`
      : "Entregado a petición del trabajador.",
    solicitud.motivo?.trim() ? `Motivo: ${solicitud.motivo.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const { data: cabecera, error: errCab } = await admin
    .from("entregas_material")
    .insert({
      empresa_id: solicitud.empresa_id,
      empleado_id: empleadoId,
      fecha: hoy,
      nota,
      estado: "borrador",
      entregado_por: aprobador.userId,
      entregado_por_nombre: aprobador.nombre,
    })
    .select("id")
    .single();
  if (errCab) {
    return { ok: false, error: errCab.message };
  }

  const entregaId = (cabecera as { id: string }).id;
  const { error: errItem } = await admin.from("entregas_material_items").insert({
    entrega_id: entregaId,
    tipo_id: solicitud.entrega_tipo_id,
    tipo_nombre: tipoNombre,
    categoria,
    talla: solicitud.entrega_talla?.trim() || null,
    requiere_devolucion: requiereDevolucion,
  });
  if (errItem) {
    // Sin la pieza la entrega no significa nada: se deshace entera.
    await admin.from("entregas_material").delete().eq("id", entregaId);
    return { ok: false, error: errItem.message };
  }

  // Se le manda el acta para que firme que la ha recibido.
  const firma = await enviarActaEntregaAFirma({
    variante: "entrega",
    entregaId,
    empresaId: solicitud.empresa_id,
    solicitanteUserId: aprobador.userId,
    solicitanteNombre: aprobador.nombre,
  });

  if (firma.ok) {
    await admin
      .from("entregas_material")
      .update({
        estado: "pendiente_firma",
        firma_id: firma.documentoId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entregaId);
  }

  // Se enlaza la solicitud con la entrega que generó.
  await admin
    .from("solicitudes_personal")
    .update({ entrega_id: entregaId })
    .eq("id", solicitud.id);

  // La entrega existe aunque el correo no saliera: no se tumba la aprobación
  // por eso, RRHH puede reenviar el acta desde el módulo Entregas.
  return { ok: true, entregaId, firmaEnviada: firma.ok };
}
