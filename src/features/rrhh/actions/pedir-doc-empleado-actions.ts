"use server";

/**
 * Petición de documentación identificativa a un empleado.
 *
 * UNO A UNO, siempre: cada empleado recibe su propio enlace y solo se le habla
 * de lo suyo. El 4-sep-2026 la petición de los certificados bancarios salió con
 * los nueve en copia y, al responder en cadena, cada uno acabó viendo el IBAN
 * de los anteriores.
 *
 * Doble aviso por empleado:
 *   1. Notificación interna (campana + push) con botón "Subir mi documento".
 *   2. Correo con el mismo enlace, para quien no entra al software.
 *
 * El empleado solo SUBE el archivo: los datos de su ficha los graba RRHH. El
 * documento entra directo en su ficha, sin pasar por RRHH ni por Dirección.
 */

import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import { pedirDocumentoAEmpleado } from "@/features/rrhh/services/documentos/pedir-doc-empleado";
import {
  crearTokenDocEmpleado,
  DOCS_EMPLEADO,
  type TipoDocEmpleado,
} from "@/features/rrhh/services/documentos/empleado-doc-token";

const TIPOS = Object.keys(DOCS_EMPLEADO) as [TipoDocEmpleado, ...TipoDocEmpleado[]];

const Schema = z.object({
  empleadoIds: z.array(z.string().guid()).min(1),
  tipoDoc: z.enum(TIPOS),
  /** Ya se le pidió antes: cambia el tono, no el circuito. */
  recordatorio: z.boolean().optional().default(false),
});

export interface PedirDocResultado {
  ok: boolean;
  /** A quién le llegó, para poder confirmarlo uno a uno. */
  enviados: { empleado: string; email: string | null; notificado: boolean }[];
  errores: { empleado: string; error: string }[];
}

export async function pedirDocumentacionAEmpleados(
  input: unknown,
): Promise<PedirDocResultado> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, enviados: [], errores: [{ empleado: "—", error: "Datos no válidos" }] };
  }
  const { empleadoIds, tipoDoc, recordatorio } = parsed.data;

  const { empresaId } = await getAppContext();
  if (!empresaId) {
    return { ok: false, enviados: [], errores: [{ empleado: "—", error: "Sin empresa activa" }] };
  }

  const admin = createAdminClient();
  const enviados: PedirDocResultado["enviados"] = [];
  const errores: PedirDocResultado["errores"] = [];

  // En serie y no en paralelo: son pocos y así un fallo de correo no arrastra
  // al resto ni deja tokens huérfanos a medias.
  for (const empleadoId of empleadoIds) {
    const { data: emp } = await admin
      .from("empleados")
      .select("nombre, apellidos, email_personal, email_empresa")
      .eq("id", empleadoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    const nombre = emp
      ? `${(emp.nombre as string) ?? ""} ${(emp.apellidos as string) ?? ""}`.trim()
      : empleadoId;
    if (!emp) {
      errores.push({ empleado: nombre, error: "Empleado no encontrado en esta empresa" });
      continue;
    }

    // Un ÚNICO enlace para los dos canales. Crearlo dos veces lo renovaría
    // (upsert por empleado+tipo) y dejaría muerto el del primer aviso.
    const tk = await crearTokenDocEmpleado(admin, { empresaId, empleadoId, tipoDoc });
    if (!tk.ok) {
      errores.push({ empleado: nombre, error: tk.error });
      continue;
    }
    const url = tk.url;

    const correo = await pedirDocumentoAEmpleado(admin, {
      empresaId,
      empleadoId,
      tipoDoc,
      recordatorio,
      url,
    });
    if (!correo.ok) errores.push({ empleado: nombre, error: correo.error });

    const label = DOCS_EMPLEADO[tipoDoc].label;
    const notif = await emitirNotificacion({
      tipo: "doc_pendiente",
      titulo: recordatorio ? `Todavía nos falta: ${label}` : `Nos falta tu ${label}`,
      mensaje:
        "Pulsa el botón y súbelo desde tu enlace personal. Entra directo en tu ficha " +
        "y no lo ve ningún otro compañero.",
      segmento: { tipo: "empleados", empleadoIds: [empleadoId] },
      accionUrl: url,
      accionLabel: "Subir mi documento",
      requiereAccion: true,
    });
    const notificado = notif.ok && notif.creadas > 0;
    if (!notificado) {
      errores.push({ empleado: nombre, error: "No se pudo crear la notificación" });
    }

    if (correo.ok || notificado) {
      enviados.push({
        empleado: nombre,
        email: correo.ok ? correo.to : null,
        notificado,
      });
    }
  }

  return { ok: errores.length === 0, enviados, errores };
}
