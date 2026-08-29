import "server-only";

/**
 * DEVOLUCIÓN de las nóminas del mes a la gestoría.
 *
 * Es la otra salida de la revisión de RRHH: si las nóminas vienen mal, en vez de
 * confirmarlas (y publicarlas al empleado) se devuelven con las anomalías que
 * RRHH redacta. El ciclo queda cerrado:
 *
 *   gestoría sube → RRHH revisa → RECHAZA con motivo → se borra todo lo subido →
 *   correo a la gestoría con las anomalías → enlace reabierto → vuelve a subir
 *   TODO corregido → RRHH revisa otra vez (ronda +1).
 *
 * El borrado es a propósito TOTAL: si se dejaran las nóminas viejas y la gestoría
 * se dejara alguna al resubir, quedaría mezclada la mala con la buena y nadie lo
 * notaría. Un mes devuelto es un mes en blanco esperando entrega.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import { BUCKET_NOMINAS } from "@/features/rrhh/services/nominas/procesar-nominas";
import {
  correoGestoriaEmpresa,
  crearTokenNominasGestoria,
  nombreMes,
  urlSubidaNominas,
} from "@/features/rrhh/services/nominas/nominas-gestoria";

export interface ResultadoRechazo {
  nominasBorradas: number;
  tc1Borrado: boolean;
  emailEnviado: boolean;
  emailDestino: string | null;
  ronda: number;
  /** Enlace nuevo de subida, si se pudo generar. */
  enlace: string | null;
}

/**
 * Borra TODAS las nóminas del mes (filas + documentos del bucket) y deja los
 * importes de nómina de `rrhh_pagos` a cero, sin tocar el resto del desglose
 * (complementos, horas extras, bonus…), que no vienen de la gestoría.
 */
async function borrarNominasDelMes(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
): Promise<{ borradas: number; empleados: string[] }> {
  const { data: filas } = await admin
    .from("rrhh_pagos_nominas")
    .select("id, empleado_id, nomina_path")
    .eq("empresa_id", empresaId)
    .eq("periodo", periodo);

  const lista = filas ?? [];
  if (lista.length === 0) return { borradas: 0, empleados: [] };

  const { error } = await admin
    .from("rrhh_pagos_nominas")
    .delete()
    .eq("empresa_id", empresaId)
    .eq("periodo", periodo);
  if (error) throw error;

  // Los documentos se borran DESPUÉS de las filas: si fallara, quedan ficheros
  // huérfanos (inocuos) en vez de filas apuntando a documentos inexistentes.
  const paths = lista
    .map((f) => f.nomina_path as string | null)
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { error: stErr } = await admin.storage.from(BUCKET_NOMINAS).remove(paths);
    if (stErr) console.error("[nominas-rechazo] documentos huérfanos:", stErr.message);
  }

  const empleados = [...new Set(lista.map((f) => f.empleado_id as string))];
  return { borradas: lista.length, empleados };
}

/**
 * Pone a cero los importes que venían de la nómina en `rrhh_pagos` y recalcula el
 * total con el resto del desglose. Sin esto, el pago seguiría mostrando el neto
 * de una nómina que ya no existe.
 */
async function limpiarImportesDeNomina(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
  empleadoIds: string[],
): Promise<void> {
  for (const empleadoId of empleadoIds) {
    const { data: prev } = await admin
      .from("rrhh_pagos")
      .select("pago, complemento, horas_extras, bonus, complemento_mes_anterior, ajuste")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .eq("periodo", periodo)
      .maybeSingle();
    if (!prev) continue;

    const total =
      Number(prev.pago ?? 0) +
      Number(prev.complemento ?? 0) +
      Number(prev.horas_extras ?? 0) +
      Number(prev.bonus ?? 0) +
      Number(prev.complemento_mes_anterior ?? 0) +
      Number(prev.ajuste ?? 0);

    await admin
      .from("rrhh_pagos")
      .update({
        nomina: 0,
        ss_empleado: 0,
        ss_empresa: 0,
        irpf: 0,
        nomina_path: null,
        total: Math.round(total * 100) / 100,
      })
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .eq("periodo", periodo);
  }
}

/**
 * Borra TODOS los TC1 del mes (documentos y datos). Puede haber varios: la
 * liquidación ordinaria y las complementarias. Devuelve si había alguno.
 */
async function borrarTc1DelMes(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
): Promise<boolean> {
  const { data } = await admin
    .from("rrhh_nominas_tc1")
    .select("id, path")
    .eq("empresa_id", empresaId)
    .eq("periodo", periodo);
  const filas = data ?? [];
  if (filas.length === 0) return false;

  await admin
    .from("rrhh_nominas_tc1")
    .delete()
    .eq("empresa_id", empresaId)
    .eq("periodo", periodo);

  const paths = filas.map((f) => f.path as string).filter(Boolean);
  if (paths.length > 0) {
    const { error } = await admin.storage.from(BUCKET_NOMINAS).remove(paths);
    if (error) console.error("[nominas-rechazo] TC1 huérfano:", error.message);
  }
  return true;
}

/**
 * Correo a la gestoría con las anomalías que ha escrito RRHH y el enlace nuevo
 * para volver a subirlo todo. El texto de RRHH va literal y destacado: es la
 * instrucción de qué hay que corregir.
 */
async function avisarGestoriaRechazo(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
  motivo: string,
  ronda: number,
): Promise<{ enviado: boolean; destino: string | null; enlace: string | null }> {
  const { data: emp } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", empresaId)
    .maybeSingle();
  const empresaNombre = (emp?.nombre as string) ?? "la empresa";

  const { to, cc } = await correoGestoriaEmpresa(admin, empresaId);
  if (!to) return { enviado: false, destino: null, enlace: null };

  // Enlace NUEVO: el anterior pudo quedar cerrado al cuadrar la entrega. Se
  // regenera para que la gestoría pueda subir de cero sin pedir nada.
  const tk = await crearTokenNominasGestoria(admin, empresaId, periodo);
  const enlace = tk.ok ? urlSubidaNominas(tk.token) : null;

  const mes = nombreMes(periodo);
  const motivoHtml = motivo
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p style="margin:0 0 6px">${escaparHtml(l)}</p>`)
    .join("");

  const boton = enlace
    ? `<div style="margin:20px 0">
         <a href="${enlace}"
            style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
                   padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px">
           Volver a subir las nóminas
         </a>
         <p style="color:#888;font-size:12px;margin-top:8px">
           Subid de nuevo <b>todas</b> las nóminas del mes y sus TC1, ya corregidos.
           Lo anterior se ha eliminado del sistema.
         </p>
       </div>`
    : `<p style="color:#b91c1c">No se ha podido generar el enlace de subida. Contactad con la empresa.</p>`;

  const subject = `Nóminas de ${mes} devueltas para corregir · ${empresaNombre}`;
  const html = `
    <p>Hola,</p>
    <p>Hemos revisado las <b>nóminas de ${mes}</b> de ${empresaNombre} y <b>no las damos por
    buenas</b>. Os las devolvemos para que las corrijáis.</p>
    <div style="border-left:4px solid #f59e0b;background:#fffbeb;padding:12px 16px;margin:16px 0;
                border-radius:0 6px 6px 0">
      <p style="margin:0 0 8px;font-weight:600;color:#92400e">Anomalías detectadas</p>
      <div style="color:#1f2937;font-size:14px">${motivoHtml}</div>
    </div>
    <p>Todo lo que habíais subido de este mes <b>se ha eliminado</b>: hay que volver a subir
    la entrega completa, no solo las nóminas corregidas.</p>
    ${boton}
    <p style="color:#888;font-size:12px">
      Entrega nº ${ronda} de ${mes}. Enviado automáticamente desde el sistema de ${empresaNombre}.
    </p>`;
  const text =
    `Nóminas de ${mes} de ${empresaNombre} devueltas para corregir.\n\n` +
    `Anomalías detectadas:\n${motivo}\n\n` +
    `Todo lo subido se ha eliminado: hay que volver a subir la entrega completa.\n` +
    (enlace ? `Subidlas aquí: ${enlace}` : "Contactad con la empresa para el enlace.");

  const res = await sendEmail({
    to: cc ? `${to}, ${cc}` : to,
    subject,
    html,
    text,
    empresaId,
  });
  return { enviado: res.ok, destino: to, enlace };
}

/** Escapa el texto de RRHH antes de meterlo en el HTML del correo. */
function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Devuelve el mes de nóminas a la gestoría. Orden de las operaciones pensado para
 * que un fallo a mitad no deje el sistema en un estado raro:
 *   1. Se marca el mes como rechazado (ronda +1) → ya no se puede confirmar.
 *   2. Se borran nóminas, sus documentos y el TC1.
 *   3. Se limpian los importes de nómina en los pagos.
 *   4. Se manda el correo (si falla, el rechazo sigue en pie y queda registrado).
 *   5. Se guarda el histórico y se avisa a RRHH.
 */
export async function rechazarMesNominasGestoria(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
  motivo: string,
  userId: string | null,
): Promise<ResultadoRechazo> {
  const { data: mesPrev } = await admin
    .from("rrhh_nominas_mes")
    .select("ronda")
    .eq("empresa_id", empresaId)
    .eq("periodo", periodo)
    .maybeSingle();
  const rondaActual = Number(mesPrev?.ronda ?? 1);
  const rondaNueva = rondaActual + 1;

  // 1. Marcar el mes como devuelto. El CHECK de BD garantiza que no puede estar
  //    a la vez confirmado, y el motivo no puede ir vacío.
  const { error: eMes } = await admin.from("rrhh_nominas_mes").upsert(
    {
      empresa_id: empresaId,
      periodo,
      confirmado_en: null,
      confirmado_por: null,
      rechazado_en: new Date().toISOString(),
      rechazado_por: userId,
      rechazo_motivo: motivo,
      ronda: rondaNueva,
    },
    { onConflict: "empresa_id,periodo" },
  );
  if (eMes) throw eMes;

  // 2 y 3. Vaciar el mes.
  const { borradas, empleados } = await borrarNominasDelMes(admin, empresaId, periodo);
  await limpiarImportesDeNomina(admin, empresaId, periodo, empleados);
  const tc1Borrado = await borrarTc1DelMes(admin, empresaId, periodo);

  // 4. Avisar a la gestoría con las anomalías y el enlace nuevo.
  const correo = await avisarGestoriaRechazo(admin, empresaId, periodo, motivo, rondaNueva);

  // 5. Histórico + aviso interno.
  await admin.from("rrhh_nominas_rechazos").insert({
    empresa_id: empresaId,
    periodo,
    ronda: rondaNueva,
    motivo,
    nominas_borradas: borradas,
    tc1_borrado: tc1Borrado,
    email_enviado: correo.enviado,
    email_destino: correo.destino,
    creado_por: userId,
  });

  await avisarRrhhRechazo(empresaId, periodo, borradas, correo.enviado, correo.destino);

  return {
    nominasBorradas: borradas,
    tc1Borrado,
    emailEnviado: correo.enviado,
    emailDestino: correo.destino,
    ronda: rondaNueva,
    enlace: correo.enlace,
  };
}

/** Aviso in-app al área administrativa de que el mes se devolvió (o de que el correo falló). */
async function avisarRrhhRechazo(
  empresaId: string,
  periodo: string,
  borradas: number,
  emailEnviado: boolean,
  destino: string | null,
): Promise<void> {
  try {
    const mes = nombreMes(periodo);
    const detalle = emailEnviado
      ? `Se avisó a la gestoría (${destino}) con las anomalías y el enlace para volver a subirlo todo.`
      : `ATENCIÓN: no se pudo enviar el correo a la gestoría. Hay que avisarles por otra vía.`;
    await emitirNotificacion({
      empresaId,
      system: true,
      tipo: "nominas_gestoria_subidas",
      titulo: `Nóminas de ${mes} devueltas a la gestoría`,
      mensaje: `Se eliminaron ${borradas} nómina${borradas === 1 ? "" : "s"} del mes. ${detalle}`,
      segmento: { tipo: "area", area: "ADMINISTRATIVA" },
      refTabla: "empresas",
      refId: empresaId,
      accionUrl: "/rrhh/pagos",
      dedupeKey: `nominas_rechazo:${empresaId}:${periodo}:${borradas}:${emailEnviado}`,
    });
  } catch (e) {
    console.error("[nominas-rechazo] avisarRrhh:", e);
  }
}
