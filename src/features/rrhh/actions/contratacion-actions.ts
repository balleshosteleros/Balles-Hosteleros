"use server";

/**
 * Contratación candidato → empleado + usuario (PRP-066).
 *
 * Extiende la promoción (PRP-034) con el modelo de PUESTO como plantilla:
 *  - Disponible desde las columnas "Prueba" y "Empleado" del pipeline.
 *  - El reclutador elige el PUESTO (sugerido por la vacante) y el NIVEL.
 *  - Las condiciones del nivel se COPIAN (snapshot) al empleado: editar el nivel
 *    después NO afecta a empleados ya contratados.
 *  - Regla de email de acceso: área OPERATIVA → email personal del candidato;
 *    área ADMINISTRATIVA → email de empresa (obligatorio).
 *  - Reutiliza el núcleo canónico `altaUsuarioEmpleado` (auth→profile→empleado).
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { sendEmail } from "@/lib/email/send";
import { bienvenidaEmpleadoEmail } from "@/lib/email/templates/bienvenida-empleado";
import { buildRecoveryActionUrl } from "@/lib/auth/recovery-link";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { requireAdminUser, altaUsuarioEmpleado } from "@/features/rrhh/services/empleados-core";
import { copiarDocumentacionCandidatoAEmpleado } from "@/features/rrhh/services/documentacion-candidato-a-empleado";
import { enviarAltaGestoria } from "@/features/rrhh/actions/gestoria-actions";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import { revalidatePath } from "next/cache";

/**
 * Deshace una contratación que quedó a medias: revierte el LOCK del candidato
 * (`promovido_at`/`promovido_por`/`empleado_id` a null) para que vuelva a ser
 * CONTRATABLE con un solo clic, y AVISA al equipo de RRHH (área administrativa)
 * de que la contratación falló y hay que reintentarla. Best-effort: si el aviso
 * falla, no importa; lo importante es dejar el candidato reintentables.
 */
async function revertirContratacionFallida(
  admin: Admin,
  empresaId: string,
  candidatoId: string,
  nombreCandidato: string,
  motivo: string,
): Promise<void> {
  // 1) Revertir el lock → el candidato vuelve a poder contratarse.
  try {
    await admin.from("candidatos")
      .update({ promovido_at: null, promovido_por: null, empleado_id: null })
      .eq("id", candidatoId);
  } catch (e) {
    console.error("[contratacion] revertir lock:", e);
  }
  // 2) Avisar a RRHH (in-app). dedupeKey por candidato: no spamea si se reintenta.
  try {
    await emitirNotificacion({
      empresaId,
      system: true,
      tipo: "warning",
      titulo: `Contratación fallida: ${nombreCandidato}`,
      mensaje: `No se pudo completar la contratación de ${nombreCandidato} y se ha revertido automáticamente. Vuelve a pulsar «Contratar» para reintentarlo. Motivo: ${motivo}`,
      segmento: { tipo: "area", area: "ADMINISTRATIVA" },
      refTabla: "candidatos",
      refId: candidatoId,
      accionUrl: "/rrhh/reclutamiento",
      accionLabel: "Ir a reclutamiento",
      dedupeKey: `contratacion_fallida:${candidatoId}`,
    });
  } catch (e) {
    console.error("[contratacion] aviso RRHH fallo:", e);
  }
}

export interface ContratarInput {
  candidatoId: string;
  puestoId: string;
  nivel: number;
  primerDia: string; // 'YYYY-MM-DD'
  localId: string;
  /** Solo para puestos de área ADMINISTRATIVA: email corporativo de acceso. */
  emailEmpresa?: string | null;
  /**
   * Si false, NO se envía el email de acceso (elige contraseña) al trabajador.
   * Se usa al ENTRAR en la fase Contratación: el empleado se crea para poder
   * gestionar alta + firmas, pero el acceso se difiere a la fase Prueba.
   * Default true (comportamiento clásico desde el diálogo de contratación).
   */
  enviarAcceso?: boolean;
  /**
   * Si false, NO se envía el alta de contrato a la gestoría. Al entrar en
   * Contratación el usuario confirma este envío en el diálogo (preview por email).
   * Default true (comportamiento clásico).
   */
  enviarGestoria?: boolean;
  /**
   * Si true, se permite contratar desde CUALQUIER fase previa (no solo
   * Contratación/Prueba/Empleado). Lo usa la ENTRADA en Contratación: arrastrar
   * el candidato a esa columna es precisamente el acto de contratarlo, y en ese
   * momento el candidato todavía está en su fase anterior (p. ej. Selección).
   * Default false (el resto de flujos siguen exigiendo la fase de contratación).
   */
  permitirDesdeCualquierFase?: boolean;
  /**
   * Fase/estado en que queda el candidato tras crear el empleado. Por defecto
   * (compat) pasa a `seleccionado`/`empleado`. Al entrar en Contratación se pasa
   * `{ fase: "contratacion", estado: "contratacion" }`.
   */
  destino?: { fase: string; estado: string };
}

export interface ContratarResult {
  ok: boolean;
  error?: string;
  empleadoId?: string;
  reactivado?: boolean;
  accesoEmailEnviado?: boolean;
  tempPassword?: string;
  /** El alta de contrato se envió automáticamente a la gestoría. */
  gestoriaEnviada?: boolean;
}

interface CandidatoRow {
  id: string;
  empresa_id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  telefono: string | null;
  dni_nie: string | null;
  iban: string | null;
  num_seguridad_social: string | null;
  direccion: string | null;
  fecha_nacimiento: string | null;
  documentacion_completada_at: string | null;
  fase: string;
  estado: string;
  promovido_at: string | null;
  vacante_id: string | null;
}

function normalizarDni(d: string | null | undefined): string | null {
  if (!d) return null;
  return d.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}

async function getActor() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, empresaId: null as string | null, actorEmail: null };
  const { data: profile } = await supabase
    .from("usuarios").select("full_name, email").eq("user_id", user.id).single();
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { user, empresaId, actorEmail: (profile?.email ?? user.email ?? null) as string | null };
}

type Admin = ReturnType<typeof createAdminClient>;

async function vincularPuestoPrincipal(admin: Admin, empleadoId: string, puestoId: string, puestoNombre: string, primerDia: string) {
  // Limpiar principal previo (índice único parcial) y garantizar el vínculo.
  await admin.from("empleado_puestos").update({ es_principal: false }).eq("empleado_id", empleadoId);
  const { data: existe } = await admin
    .from("empleado_puestos").select("id").eq("empleado_id", empleadoId).eq("puesto_id", puestoId).maybeSingle();
  if (existe?.id) {
    // Refrescamos también el nombre copiado por si la plantilla se renombró.
    await admin.from("empleado_puestos").update({ es_principal: true, puesto_nombre: puestoNombre }).eq("id", existe.id);
  } else {
    await admin.from("empleado_puestos")
      .insert({ empleado_id: empleadoId, puesto_id: puestoId, puesto_nombre: puestoNombre, es_principal: true, vigente_desde: primerDia });
  }
}

async function guardarSnapshotCondiciones(
  admin: Admin,
  empresaId: string,
  empleadoId: string,
  puestoId: string,
  puestoNombre: string,
  nivel: number,
  primerDia: string,
  tipoContrato: string | null,
  cond: {
    nomina_neta: number; efectivo_extra: number; salario_neto: number;
    jornada_contrato: string | null; horas_semanales: number | null;
    dias_libres: number | null; vacaciones: string | null; horario_semanal: unknown;
  } | null,
) {
  await admin.from("empleado_condiciones").upsert({
    empleado_id: empleadoId,
    empresa_id: empresaId,
    puesto_id: puestoId,
    puesto_nombre: puestoNombre,
    nivel,
    nomina_neta: cond?.nomina_neta ?? 0,
    efectivo_extra: cond?.efectivo_extra ?? 0,
    salario_neto: cond?.salario_neto ?? 0,
    jornada_contrato: cond?.jornada_contrato ?? null,
    horas_semanales: cond?.horas_semanales ?? null,
    dias_libres: cond?.dias_libres ?? null,
    vacaciones: cond?.vacaciones ?? null,
    horario_semanal: cond?.horario_semanal ?? [],
    primer_dia: primerDia,
    tipo_contrato: tipoContrato,
    updated_at: new Date().toISOString(),
  }, { onConflict: "empleado_id" });
}

export async function contratarCandidato(input: ContratarInput): Promise<ContratarResult> {
  const { user, empresaId, actorEmail } = await getActor();
  if (!user || !empresaId) return { ok: false, error: "No autenticado" };

  try {
    await requireAdminUser({ empresaIds: [empresaId] });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sin permisos" };
  }

  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Supabase admin no configurado (falta SUPABASE_SERVICE_ROLE_KEY)." };
  }

  // 1. Cargar candidato
  const { data: cand, error: candErr } = await admin
    .from("candidatos")
    .select("id, empresa_id, nombre, apellidos, email, telefono, dni_nie, iban, num_seguridad_social, direccion, fecha_nacimiento, documentacion_completada_at, fase, estado, promovido_at, vacante_id")
    .eq("id", input.candidatoId)
    .eq("empresa_id", empresaId)
    .maybeSingle<CandidatoRow>();
  if (candErr) return { ok: false, error: friendlyError(candErr) };
  if (!cand) return { ok: false, error: "Candidato no encontrado" };

  // CONTRATAR disponible al ENTRAR en Contratación (PRP-070) y, por compat, en
  // las columnas Prueba y Empleado. La entrada en Contratación es ahora el punto
  // canónico donde se materializa el empleado (firmas + alta requieren empleado).
  const ESTADOS_CONTRATACION = new Set([
    "contratacion",
    // legacy (compat con datos antiguos)
    "alta_pendiente_revision", "alta_enviada", "contrato_interno_firmado",
    "contrato_oficial_subido", "contrato_oficial_firmado", "alta_completada",
  ]);
  const estadoOk =
    input.permitirDesdeCualquierFase ||
    cand.estado === "prueba" || cand.estado === "empleado" || ESTADOS_CONTRATACION.has(cand.estado);
  if (!estadoOk) {
    return { ok: false, error: "Solo se puede contratar a candidatos en las fases Contratación, Prueba o Empleado." };
  }
  if (cand.promovido_at) {
    return { ok: false, error: "Este candidato ya fue contratado anteriormente." };
  }
  if (!input.puestoId) return { ok: false, error: "Selecciona el puesto." };
  if (!input.primerDia) return { ok: false, error: "Indica el primer día de trabajo." };
  if (!input.localId) return { ok: false, error: "Asigna un local al nuevo empleado." };

  // Datos completos OBLIGATORIOS para contratar: un candidato no puede convertirse
  // en empleado sin su documentación identificativa (DNI/NIE, IBAN, nº Seguridad
  // Social) ni sin haber completado el paso de Documentación. Se valida en el
  // SERVIDOR para que sea imposible saltárselo (el bloqueo del Kanban es solo UI).
  const faltan: string[] = [];
  if (!cand.dni_nie?.trim()) faltan.push("DNI/NIE");
  if (!cand.iban?.trim()) faltan.push("IBAN");
  if (!cand.num_seguridad_social?.trim()) faltan.push("nº de Seguridad Social");
  if (!cand.documentacion_completada_at) faltan.push("documentación completada");
  if (faltan.length > 0) {
    return {
      ok: false,
      error: `No se puede contratar a ${`${cand.nombre} ${cand.apellidos ?? ""}`.trim()}: faltan datos obligatorios (${faltan.join(", ")}). Completa la documentación del candidato antes de contratar.`,
    };
  }

  // 2. Puesto + área del departamento + condiciones del nivel
  const { data: puesto } = await admin
    .from("puestos")
    .select("id, nombre, departamento_id, tipo_contrato_defecto, departamentos(nombre, area)")
    .eq("id", input.puestoId)
    .maybeSingle();
  if (!puesto) return { ok: false, error: "Puesto no encontrado." };
  const depto = puesto.departamentos as { nombre?: string; area?: string } | null;
  const deptoNombre = (depto?.nombre ?? "").trim();
  const area = (depto?.area ?? "OPERATIVA").toUpperCase();
  const esAdministrativo = area === "ADMINISTRATIVA";

  // Regla de email de acceso por área
  const emailPersonal = cand.email.toLowerCase();
  const emailEmpresa = (input.emailEmpresa ?? "").trim().toLowerCase() || null;
  if (esAdministrativo && !emailEmpresa) {
    return { ok: false, error: "Los puestos administrativos requieren un email de empresa para el acceso." };
  }
  const loginEmail = esAdministrativo ? (emailEmpresa as string) : emailPersonal;

  // Plantilla del puesto: como el diálogo ya no elige nivel, heredamos el nivel
  // más bajo definido en la plantilla (normalmente el 1) en lugar de exigir un
  // nivel exacto. Así el empleado hereda las condiciones existan con la
  // numeración que existan; si la plantilla está vacía, `cond` queda null.
  const { data: condRows } = await admin
    .from("puesto_salarios")
    .select("nivel, nomina_neta, efectivo_extra, salario_neto, jornada_contrato, horas_semanales, dias_libres, vacaciones, horario_semanal")
    .eq("puesto_id", input.puestoId)
    .order("nivel", { ascending: true })
    .limit(1);
  const condRow = condRows?.[0] ?? null;
  // El nivel que se graba en el snapshot es el de la plantilla heredada (o el
  // que pidió el caller —hoy siempre 1— si la plantilla está vacía).
  const nivelHeredado = (condRow?.nivel as number | undefined) ?? input.nivel;
  const cond = condRow
    ? {
        nomina_neta: condRow.nomina_neta, efectivo_extra: condRow.efectivo_extra,
        salario_neto: condRow.salario_neto, jornada_contrato: condRow.jornada_contrato,
        horas_semanales: condRow.horas_semanales, dias_libres: condRow.dias_libres,
        vacaciones: condRow.vacaciones, horario_semanal: condRow.horario_semanal,
      }
    : null;

  // El puesto debe tener condiciones (salario/jornada) configuradas antes de
  // contratar: si no, la gestoría recibiría el alta con salario 0 y sin jornada.
  if (!cond || (cond.salario_neto == null && cond.jornada_contrato == null)) {
    return {
      ok: false,
      error:
        `El puesto «${puesto.nombre}» no tiene condiciones configuradas (salario, jornada…). ` +
        `Configúralas en RRHH → Puestos antes de contratar, para que la gestoría reciba el alta completa.`,
    };
  }

  // 3. Lock optimista
  const nowIso = new Date().toISOString();
  const { data: lockRows, error: lockErr } = await admin
    .from("candidatos")
    .update({ promovido_at: nowIso, promovido_por: user.id })
    .eq("id", cand.id)
    .is("promovido_at", null)
    .select("id");
  if (lockErr) return { ok: false, error: friendlyError(lockErr) };
  if (!lockRows || lockRows.length === 0) {
    return { ok: false, error: "Contratación ya en curso (otro click más rápido)." };
  }

  const dniNorm = normalizarDni(cand.dni_nie);
  const tipoContrato = (puesto.tipo_contrato_defecto as string | null) ?? null;
  // Fase/estado destino del candidato (compat = seleccionado/empleado).
  const destinoFase = input.destino?.fase ?? "seleccionado";
  const destinoEstado = input.destino?.estado ?? "empleado";
  const enviarAcceso = input.enviarAcceso !== false;
  const enviarGestoria = input.enviarGestoria !== false;

  // 4. Regla: NO se puede dar de alta un empleado cuyo DNI (o email) YA EXISTE en
  // esta empresa, esté ACTIVO o de baja. Se bloquea siempre con un mensaje claro
  // (evita duplicados y que una reactivación arrastre datos antiguos). Para
  // reincorporar a un ex-empleado se hace desde su ficha, no contratándolo de nuevo.
  {
    const orFilters: string[] = [];
    if (emailPersonal) orFilters.push(`email_personal.eq.${emailPersonal}`);
    if (dniNorm) orFilters.push(`dni_nie.eq.${dniNorm}`);
    if (orFilters.length > 0) {
      const { data: matches } = await admin
        .from("empleados").select("id, user_id, estado, nombre, apellidos, puesto, dni_nie")
        .eq("empresa_id", empresaId).or(orFilters.join(",")).limit(1);
      if (matches && matches.length > 0) {
        const m = matches[0];
        const nombreExistente = `${m.nombre ?? ""} ${m.apellidos ?? ""}`.trim();
        const dniMostrar = (m.dni_nie as string | null) ?? dniNorm ?? "";
        const estadoTxt = String(m.estado ?? "").toLowerCase() === "activo" ? "" : " (actualmente dado de baja)";
        return {
          ok: false,
          error:
            `Esta persona con DNI ${dniMostrar} ya se encuentra en la base de datos de empleados` +
            `${nombreExistente ? `: ${nombreExistente}` : ""}${m.puesto ? `, ${m.puesto}` : ""}${estadoTxt}. ` +
            `No se puede dar de alta de nuevo con el mismo DNI.`,
        };
      }
    }
  }

  const fullName = `${cand.nombre} ${cand.apellidos ?? ""}`.trim();

  // 5. Alta nueva vía núcleo canónico (siempre nueva: el DNI/email duplicado ya
  // se bloqueó arriba, no hay reactivación automática).
  const alta = await altaUsuarioEmpleado({
    admin,
    loginEmail,
    emailPersonal,
    emailEmpresa,
    fullName,
    nombre: cand.nombre,
    apellidos: cand.apellidos,
    telefono: cand.telefono,
    dniNie: dniNorm,
    // Datos personales de la documentación → van a la ficha y a la gestoría.
    numeroSs: cand.num_seguridad_social,
    iban: cand.iban,
    direccion: cand.direccion,
    fechaNacimiento: cand.fecha_nacimiento,
    departamentoId: puesto.departamento_id as string,
    puesto: puesto.nombre as string,
    empresaPrincipalId: empresaId,
    empresasAcceso: [empresaId],
    localIds: [input.localId],
  });
  if (!alta.ok) {
    // El núcleo no creó el empleado: revierte el lock para poder reintentar y avisa a RRHH.
    await revertirContratacionFallida(admin, empresaId, cand.id, fullName, alta.error);
    return { ok: false, error: alta.error };
  }

  // Pasos CRÍTICOS restantes (primer día + vínculo de puesto + snapshot + marcar
  // empleado en el candidato). Si alguno falla, la contratación queda a medias:
  // borramos el empleado recién creado, revertimos el lock del candidato y
  // avisamos a RRHH. Así el candidato vuelve a ser contratable con un solo clic.
  try {
    await admin.from("empleados").update({ fecha_alta: input.primerDia }).eq("id", alta.empleadoId);
    await vincularPuestoPrincipal(admin, alta.empleadoId, input.puestoId, puesto.nombre as string, input.primerDia);
    await guardarSnapshotCondiciones(admin, empresaId, alta.empleadoId, input.puestoId, puesto.nombre as string, nivelHeredado, input.primerDia, tipoContrato, cond);

    const { error: markErr } = await admin.from("candidatos")
      .update({ empleado_id: alta.empleadoId, fase: destinoFase, estado: destinoEstado }).eq("id", cand.id);
    if (markErr) throw new Error(markErr.message);
  } catch (err) {
    const motivo = err instanceof Error ? err.message : "Error al completar la contratación";
    // Deshace el empleado a medias (borra auth.user → cascada profiles/roles/empleado).
    try { await admin.auth.admin.deleteUser(alta.userId); } catch (e) { console.error("[contratacion] rollback deleteUser:", e); }
    await revertirContratacionFallida(admin, empresaId, cand.id, fullName, motivo);
    return { ok: false, error: `La contratación no se completó y se ha revertido. Puedes volver a intentarlo. (${motivo})` };
  }

  // Copia la documentación y la foto del candidato a la ficha del empleado
  // (copia física a empleados-docs; la foto se fija como avatar permanente).
  // Se conserva también en reclutamiento. Best-effort: no bloquea la contratación.
  await copiarDocumentacionCandidatoAEmpleado({
    admin, empresaId, candidatoId: cand.id, empleadoId: alta.empleadoId, userId: alta.userId,
  });

  // 6. Email de acceso al trabajador (al email de login = personal u empresa según área).
  //    Se OMITE al entrar en Contratación (enviarAcceso=false): el acceso se
  //    difiere a la fase Prueba, cuando el alta y los contratos están firmados.
  let accesoEmailEnviado = false;
  if (enviarAcceso) try {
    const siteUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) ??
      "http://localhost:3000";
    // Recovery link → /update-password: el empleado ELIGE su propia contraseña.
    // (No magic link: queremos que ponga contraseña, no solo que entre.)
    // El enlace pasa por /auth/confirm (verifyOtp server-side) para que el
    // prefetch de los clientes de correo no lo consuma antes de tiempo.
    const redirectTo = `${siteUrl.replace(/\/$/, "")}/update-password`;
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "recovery", email: loginEmail, options: { redirectTo },
    });
    const actionUrl = buildRecoveryActionUrl(siteUrl, linkData?.properties ?? undefined);
    if (actionUrl) {
      const empresaNombre = await admin.from("empresas").select("nombre").eq("id", empresaId).single()
        .then((r) => r.data?.nombre ?? "tu empresa");
      const { subject, html, text } = bienvenidaEmpleadoEmail({
        recipientName: cand.nombre, actionUrl, empresaNombre,
      });
      const sendRes = await sendEmail({ to: loginEmail, subject, html, text, empresaId });
      accesoEmailEnviado = sendRes.ok;
    }
  } catch (err) {
    console.error("[contratacion] email de acceso:", err);
  }

  // 7. Alta automática a la gestoría (tolerante a fallo: no bloquea la contratación).
  const gestoriaEnviada = enviarGestoria
    ? await enviarAltaGestoriaSeguro(alta.empleadoId)
    : false;

  revalidatePath("/rrhh/reclutamiento");
  revalidatePath("/rrhh/empleados");
  return { ok: true, empleadoId: alta.empleadoId, reactivado: false, accesoEmailEnviado, tempPassword: alta.tempPassword, gestoriaEnviada };
}

/** Envía el alta a la gestoría sin propagar errores: la contratación ya está hecha. */
async function enviarAltaGestoriaSeguro(empleadoId: string): Promise<boolean> {
  try {
    const res = await enviarAltaGestoria(empleadoId);
    return res.ok;
  } catch (err) {
    console.error("[contratacion] alta gestoría automática:", err);
    return false;
  }
}

/**
 * Envía el email de ACCESO (elige tu contraseña) a un empleado ya creado.
 * Se usa al pasar el candidato a la fase Prueba (PRP-070): el empleado se creó
 * al entrar en Contratación con el acceso diferido. Best-effort e idempotente
 * en la práctica (el recovery link más reciente invalida al anterior).
 */
export async function enviarAccesoEmpleadoPorId(
  empleadoId: string,
): Promise<{ ok: boolean; enviado?: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { data: emp } = await admin
      .from("empleados")
      .select("email_empresa, email_personal, nombre, empresa_id")
      .eq("id", empleadoId)
      .maybeSingle();
    if (!emp) return { ok: false, error: "Empleado no encontrado" };
    const loginEmail = ((emp.email_empresa as string | null) || (emp.email_personal as string | null) || "").toLowerCase();
    if (!loginEmail) return { ok: false, error: "El empleado no tiene email de acceso" };

    const siteUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) ??
      "http://localhost:3000";
    const redirectTo = `${siteUrl.replace(/\/$/, "")}/update-password`;
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "recovery", email: loginEmail, options: { redirectTo },
    });
    const actionUrl = buildRecoveryActionUrl(siteUrl, linkData?.properties ?? undefined);
    if (!actionUrl) return { ok: false, error: "No se pudo generar el enlace de acceso" };

    const empresaId = emp.empresa_id as string;
    const empresaNombre = await admin.from("empresas").select("nombre").eq("id", empresaId).single()
      .then((r) => r.data?.nombre ?? "tu empresa");
    const { subject, html, text } = bienvenidaEmpleadoEmail({
      recipientName: (emp.nombre as string) ?? "", actionUrl, empresaNombre,
    });
    const sendRes = await sendEmail({ to: loginEmail, subject, html, text, empresaId });
    return { ok: true, enviado: sendRes.ok };
  } catch (err) {
    console.error("[contratacion] enviarAccesoEmpleadoPorId:", err);
    return { ok: false, error: "No se pudo enviar el email de acceso" };
  }
}
