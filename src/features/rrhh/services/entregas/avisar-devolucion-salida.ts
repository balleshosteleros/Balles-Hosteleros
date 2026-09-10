/**
 * Aviso al trabajador cuando su salida entra en la fase de ENTREGAS.
 *
 * Se dispara el día en que su tarjeta llega a esa casilla: automáticamente al
 * pasar su último día, o a mano si RRHH la mueve antes. Le llega por correo y
 * por la campana, porque a esas alturas ya no pisa el local y el correo puede
 * tardar en leerlo.
 *
 * Le dice tres cosas y ninguna más: qué tiene registrado a su nombre, que hasta
 * devolverlo no se le puede cerrar el finiquito, y que hable con RRHH para
 * entregarlo. Nada de plazos ni amenazas: el material se recoge hablando.
 *
 * No bloquea nada: si el envío falla, la salida sigue su curso y RRHH lo ve en
 * el tablero igual (la tarjeta no sale de Entregas mientras quede algo).
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";

export interface AvisoDevolucionResult {
  ok: boolean;
  /** Piezas que se le reclaman. 0 = no debía nada y no se envía nada. */
  piezas: number;
  emailEnviado: boolean;
  error?: string;
}

/** Nombre legible de una pieza: «Camisa negra (talla M)». */
function nombrePieza(item: { tipo_nombre: string | null; talla: string | null }): string {
  const nombre = (item.tipo_nombre ?? "").trim() || "Material";
  const talla = (item.talla ?? "").trim();
  return talla ? `${nombre} (talla ${talla})` : nombre;
}

/**
 * Lo que el trabajador tiene sin devolver: entregas suyas ya firmadas, con
 * piezas que hay que devolver, y que no están ni devueltas ni dadas de baja por
 * deterioro. Mismo criterio que el contador del Kanban, para que el correo diga
 * exactamente lo que ve RRHH.
 */
async function piezasSinDevolver(
  admin: SupabaseClient,
  args: { empresaId: string; empleadoId: string },
): Promise<string[]> {
  const { data, error } = await admin
    .from("entregas_material")
    .select("id, entregas_material_items!inner(tipo_nombre, talla, requiere_devolucion, devuelto_en)")
    .eq("empresa_id", args.empresaId)
    .eq("empleado_id", args.empleadoId)
    .eq("estado", "firmada")
    .eq("entregas_material_items.requiere_devolucion", true)
    .not("devolucion_estado", "in", '("devuelta","merma")');
  if (error) {
    console.error("[rrhh] piezasSinDevolver:", error.message);
    return [];
  }

  const piezas: string[] = [];
  for (const fila of (data ?? []) as Array<{
    entregas_material_items: Array<{
      tipo_nombre: string | null;
      talla: string | null;
      devuelto_en: string | null;
    }>;
  }>) {
    for (const item of fila.entregas_material_items ?? []) {
      if (item.devuelto_en) continue; // esa pieza ya volvió
      piezas.push(nombrePieza(item));
    }
  }
  return piezas;
}

export async function avisarDevolucionSalida(
  admin: SupabaseClient,
  args: { empresaId: string; empleadoId: string },
): Promise<AvisoDevolucionResult> {
  try {
    const piezas = await piezasSinDevolver(admin, args);
    // Sin nada que devolver no hay nada que decirle: mandarle un correo pidiendo
    // material que no tiene solo genera una llamada a RRHH.
    if (piezas.length === 0) return { ok: true, piezas: 0, emailEnviado: false };

    const [empRes, empresaRes] = await Promise.all([
      admin
        .from("empleados")
        .select("nombre, apellidos, email_personal, email_empresa, user_id")
        .eq("id", args.empleadoId)
        .maybeSingle(),
      admin.from("empresas").select("nombre").eq("id", args.empresaId).maybeSingle(),
    ]);

    const emp = empRes.data as
      | {
          nombre: string | null;
          apellidos: string | null;
          email_personal: string | null;
          email_empresa: string | null;
          user_id: string | null;
        }
      | null;
    if (!emp) return { ok: false, piezas: piezas.length, emailEnviado: false, error: "Empleado no encontrado" };

    const nombre = `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() || "compañero/a";
    const empresaNombre = (empresaRes.data?.nombre as string | undefined) ?? "la empresa";
    // Ya está fuera: el correo de empresa puede haber dejado de mirarlo, así que
    // manda el personal.
    const destino = emp.email_personal || emp.email_empresa;

    const listaHtml = piezas.map((p) => `<li style="margin:2px 0;">${p}</li>`).join("");
    const listaText = piezas.map((p) => `· ${p}`).join("\n");

    const { entregasDevolucionEmail } = await import(
      "@/lib/email/templates/entregas-devolucion"
    );
    const { subject, html, text } = entregasDevolucionEmail({
      recipientName: nombre,
      empresaNombre,
      listaHtml,
      listaText,
    });

    let emailEnviado = false;
    if (destino) {
      const res = await sendEmail({ to: destino, subject, html, text, empresaId: args.empresaId });
      emailEnviado = res.ok;
    } else {
      console.warn("[rrhh] avisarDevolucionSalida: sin email para", args.empleadoId);
    }

    // Campana: le entra aunque no mire el correo, y es donde luego le llegará el
    // documento de devolución para firmar.
    if (emp.user_id) {
      try {
        const { emitirNotificacion } = await import(
          "@/features/notificaciones/actions/notificaciones-actions"
        );
        await emitirNotificacion({
          system: true,
          empresaId: args.empresaId,
          tipo: "recordatorio",
          titulo:
            piezas.length === 1
              ? "Te queda 1 cosa por devolver"
              : `Te quedan ${piezas.length} cosas por devolver`,
          mensaje:
            `${piezas.join(", ")}. Ponte en contacto con RRHH para entregarlo: hasta que no esté ` +
            "devuelto y firmado no podemos cerrar tu finiquito.",
          segmento: { tipo: "usuarios", usuarioIds: [emp.user_id] },
          accionUrl: "/mi-panel/documentos",
          accionLabel: "Visto",
          requiereAccion: false,
          refTabla: "empleados",
          refId: args.empleadoId,
          // Una sola vez por salida, aunque la tarjeta entre otra vez en Entregas.
          dedupeKey: `devolucion_salida:${args.empleadoId}`,
        });
      } catch (e) {
        console.error("[rrhh] avisarDevolucionSalida → notificación:", e);
      }
    }

    return { ok: true, piezas: piezas.length, emailEnviado };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] avisarDevolucionSalida:", msg);
    return { ok: false, piezas: 0, emailEnviado: false, error: msg };
  }
}
