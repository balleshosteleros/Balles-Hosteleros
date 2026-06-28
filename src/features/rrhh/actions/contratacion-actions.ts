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
import { revalidatePath } from "next/cache";

export interface ContratarInput {
  candidatoId: string;
  puestoId: string;
  nivel: number;
  primerDia: string; // 'YYYY-MM-DD'
  localId: string;
  /** Solo para puestos de área ADMINISTRATIVA: email corporativo de acceso. */
  emailEmpresa?: string | null;
}

export interface ContratarResult {
  ok: boolean;
  error?: string;
  empleadoId?: string;
  reactivado?: boolean;
  accesoEmailEnviado?: boolean;
  tempPassword?: string;
}

interface CandidatoRow {
  id: string;
  empresa_id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  telefono: string | null;
  dni_nie: string | null;
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
    .select("id, empresa_id, nombre, apellidos, email, telefono, dni_nie, fase, estado, promovido_at, vacante_id")
    .eq("id", input.candidatoId)
    .eq("empresa_id", empresaId)
    .maybeSingle<CandidatoRow>();
  if (candErr) return { ok: false, error: friendlyError(candErr) };
  if (!cand) return { ok: false, error: "Candidato no encontrado" };

  // CONTRATAR disponible en las columnas Prueba y Empleado.
  if (cand.estado !== "prueba" && cand.estado !== "empleado") {
    return { ok: false, error: "Solo se puede contratar a candidatos en las fases Prueba o Empleado." };
  }
  if (cand.promovido_at) {
    return { ok: false, error: "Este candidato ya fue contratado anteriormente." };
  }
  if (!input.puestoId) return { ok: false, error: "Selecciona el puesto." };
  if (!input.primerDia) return { ok: false, error: "Indica el primer día de trabajo." };
  if (!input.localId) return { ok: false, error: "Asigna un local al nuevo empleado." };

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

  const { data: cond } = await admin
    .from("puesto_salarios")
    .select("nomina_neta, efectivo_extra, salario_neto, jornada_contrato, horas_semanales, dias_libres, vacaciones, horario_semanal")
    .eq("puesto_id", input.puestoId)
    .eq("nivel", input.nivel)
    .maybeSingle();

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

  // 4. Detección de duplicados (email/DNI) → reactivar
  let empleadoExistente: { id: string; user_id: string | null } | null = null;
  {
    const orFilters: string[] = [];
    if (emailPersonal) orFilters.push(`email_personal.eq.${emailPersonal}`);
    if (dniNorm) orFilters.push(`dni_nie.eq.${dniNorm}`);
    if (orFilters.length > 0) {
      const { data: matches } = await admin
        .from("empleados").select("id, user_id").eq("empresa_id", empresaId).or(orFilters.join(",")).limit(1);
      if (matches && matches.length > 0) empleadoExistente = matches[0];
    }
  }

  const fullName = `${cand.nombre} ${cand.apellidos ?? ""}`.trim();

  if (empleadoExistente) {
    await admin.from("empleados").update({
      estado: "Activo",
      fecha_baja: null,
      departamento_id: puesto.departamento_id,
      puesto: puesto.nombre as string,
      fecha_alta: input.primerDia,
    }).eq("id", empleadoExistente.id);

    if (empleadoExistente.user_id) {
      await admin.from("usuario_empresas")
        .upsert({ user_id: empleadoExistente.user_id, empresa_id: empresaId }, { onConflict: "user_id,empresa_id" });
      // Re-sincronizar el ROL del usuario con el nuevo DEPARTAMENTO: el rol es
      // el departamento (SALA, COCINA…). Si la recontratación cambia de depto,
      // el rol debe seguirlo. El trigger sync_usuario_rol_id fija rol_id.
      if (deptoNombre) {
        await admin.from("usuarios")
          .update({ rol_label: deptoNombre, departamento: deptoNombre })
          .eq("user_id", empleadoExistente.user_id);
      }
    }
    await vincularPuestoPrincipal(admin, empleadoExistente.id, input.puestoId, puesto.nombre as string, input.primerDia);
    await guardarSnapshotCondiciones(admin, empresaId, empleadoExistente.id, input.puestoId, puesto.nombre as string, input.nivel, input.primerDia, tipoContrato, cond);

    await admin.from("candidatos")
      .update({ empleado_id: empleadoExistente.id, fase: "seleccionado", estado: "empleado" }).eq("id", cand.id);

    revalidatePath("/rrhh/reclutamiento");
    revalidatePath("/rrhh/empleados");
    return { ok: true, empleadoId: empleadoExistente.id, reactivado: true };
  }

  // 5. Alta nueva vía núcleo canónico
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
    departamentoId: puesto.departamento_id as string,
    puesto: puesto.nombre as string,
    empresaPrincipalId: empresaId,
    empresasAcceso: [empresaId],
    localIds: [input.localId],
  });
  if (!alta.ok) {
    await admin.from("candidatos").update({ promovido_at: null, promovido_por: null }).eq("id", cand.id);
    return { ok: false, error: alta.error };
  }

  // Primer día de trabajo + vínculo de puesto + snapshot de condiciones
  await admin.from("empleados").update({ fecha_alta: input.primerDia }).eq("id", alta.empleadoId);
  await vincularPuestoPrincipal(admin, alta.empleadoId, input.puestoId, puesto.nombre as string, input.primerDia);
  await guardarSnapshotCondiciones(admin, empresaId, alta.empleadoId, input.puestoId, puesto.nombre as string, input.nivel, input.primerDia, tipoContrato, cond);

  await admin.from("candidatos")
    .update({ empleado_id: alta.empleadoId, fase: "seleccionado", estado: "empleado" }).eq("id", cand.id);

  // 6. Email de acceso al trabajador (al email de login = personal u empresa según área)
  let accesoEmailEnviado = false;
  try {
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

  revalidatePath("/rrhh/reclutamiento");
  revalidatePath("/rrhh/empleados");
  return { ok: true, empleadoId: alta.empleadoId, reactivado: false, accesoEmailEnviado, tempPassword: alta.tempPassword };
}
