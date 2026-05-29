"use server";

/**
 * Promoción candidato → empleado + usuario (PRP-034).
 *
 * Flujo:
 *  1. Lock optimista en candidatos.promovido_at (idempotente).
 *  2. Detección de duplicados: si email/DNI ya existe en empleados, reactivar ficha existente.
 *  3. Si no existe: crear auth.users → profile (vía trigger handle_new_user) → empleados.
 *  4. Generar magic link tipo invite + enviar email de bienvenida.
 *  5. Insertar evento en audit_log.
 *  6. Notificar (in-app) a Director y usuarios con permiso RRHH de la empresa.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { sendEmail } from "@/lib/email/send";
import { bienvenidaEmpleadoEmail } from "@/lib/email/templates/bienvenida-empleado";
import { friendlyError } from "@/shared/lib/friendly-errors";
import {
  requireAdminUser,
  altaUsuarioEmpleado,
} from "@/features/rrhh/services/empleados-core";

interface PromoverInput {
  candidatoId: string;
  departamentoId?: string | null;
  puestoId?: string | null;
  localId: string;
}

interface PromoverResult {
  ok: boolean;
  error?: string;
  empleadoId?: string;
  reactivado?: boolean;
  magicLinkSent?: boolean;
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
  cv_url: string | null;
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
  if (!user) return { user: null, empresaId: null as string | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("user_id", user.id)
    .single();
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return {
    user,
    empresaId,
    actorEmail: (profile?.email ?? user.email ?? null) as string | null,
    actorName: (profile?.full_name ?? null) as string | null,
  };
}

async function notificarRRHH(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  empleadoId: string,
  empleadoNombre: string,
  vacanteTitulo: string | null,
) {
  // Buscar destinatarios: usuarios con rol director/admin/gerencia en la empresa
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, rol_label, empresa_id")
    .eq("empresa_id", empresaId);

  const userIds = new Set<string>();
  for (const p of profiles ?? []) {
    if (!p.user_id) continue;
    const rol = (p.rol_label ?? "").toLowerCase();
    if (rol.includes("director") || rol.includes("rrhh") || rol.includes("admin") || rol.includes("gerencia")) {
      userIds.add(p.user_id);
    }
  }

  if (userIds.size === 0) return;

  const titulo = "Nuevo empleado contratado";
  const mensaje = vacanteTitulo
    ? `${empleadoNombre} ha sido promovido/a a empleado desde la oferta "${vacanteTitulo}".`
    : `${empleadoNombre} ha sido promovido/a a empleado.`;

  const filas = Array.from(userIds).map((uid) => ({
    empresa_id: empresaId,
    usuario_id: uid,
    tipo: "exito" as const,
    titulo,
    mensaje,
    entidad_tipo: "empleado",
    entidad_id: empleadoId,
    accion_url: `/rrhh/empleados/${empleadoId}`,
  }));

  await admin.from("notificaciones").insert(filas);
}

async function registrarAuditoria(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  candidato: CandidatoRow,
  empleadoId: string,
  reactivado: boolean,
  actorUserId: string | null,
  actorEmail: string | null,
) {
  await admin.from("audit_log").insert({
    empresa_id: empresaId,
    tabla: "candidatos",
    registro_id: candidato.id,
    operacion: reactivado ? "PROMOTE_CANDIDATO_REACTIVAR" : "PROMOTE_CANDIDATO",
    campos_antes: {
      nombre: candidato.nombre,
      apellidos: candidato.apellidos,
      email: candidato.email,
      fase: candidato.fase,
      estado: candidato.estado,
    },
    campos_despues: {
      empleado_id: empleadoId,
      reactivado,
    },
    usuario_id: actorUserId,
    usuario_email: actorEmail,
  });
}

export async function promoverCandidato(input: PromoverInput): Promise<PromoverResult> {
  const { user, empresaId, actorEmail, actorName } = await getActor();
  if (!user || !empresaId) return { ok: false, error: "No autenticado" };

  // Autorización: solo admin/director con acceso a la empresa (GAP authz —
  // antes la promoción usaba service-role sin verificar rol).
  try {
    await requireAdminUser({ empresaIds: [empresaId] });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sin permisos" };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Supabase admin no configurado (falta SUPABASE_SERVICE_ROLE_KEY)." };
  }

  // 1. Cargar candidato y validar fase
  const { data: cand, error: candErr } = await admin
    .from("candidatos")
    .select("id, empresa_id, nombre, apellidos, email, telefono, dni_nie, cv_url, fase, estado, promovido_at, vacante_id")
    .eq("id", input.candidatoId)
    .eq("empresa_id", empresaId)
    .maybeSingle<CandidatoRow>();

  if (candErr) return { ok: false, error: friendlyError(candErr) };
  if (!cand) return { ok: false, error: "Candidato no encontrado" };

  if (cand.estado !== "prueba" || cand.fase !== "seleccionado") {
    return {
      ok: false,
      error: 'El candidato debe estar en fase "Seleccionado" → estado "Prueba" para crearlo en el sistema.',
    };
  }

  if (cand.promovido_at) {
    return { ok: false, error: "Este candidato ya fue promovido anteriormente." };
  }

  // 2. Lock optimista — solo el primero gana
  const nowIso = new Date().toISOString();
  const { data: lockRows, error: lockErr } = await admin
    .from("candidatos")
    .update({ promovido_at: nowIso, promovido_por: user.id })
    .eq("id", cand.id)
    .is("promovido_at", null)
    .select("id");

  if (lockErr) return { ok: false, error: friendlyError(lockErr) };
  if (!lockRows || lockRows.length === 0) {
    return { ok: false, error: "Promoción ya en curso (otro click más rápido)." };
  }

  // 3. Detección de duplicados: email lower-case Y DNI normalizado
  const emailLower = cand.email.toLowerCase();
  const dniNorm = normalizarDni(cand.dni_nie);

  let empleadoExistente: { id: string; user_id: string | null } | null = null;
  if (emailLower || dniNorm) {
    const orFilters: string[] = [];
    if (emailLower) orFilters.push(`email_personal.eq.${emailLower}`);
    if (dniNorm) orFilters.push(`dni_nie.eq.${dniNorm}`);

    const { data: matches } = await admin
      .from("empleados")
      .select("id, user_id")
      .eq("empresa_id", empresaId)
      .or(orFilters.join(","))
      .limit(1);

    if (matches && matches.length > 0) {
      empleadoExistente = matches[0];
    }
  }

  // Resolver nombre de puesto (la tabla empleados guarda puesto como TEXT, no FK)
  let puestoNombre: string | null = null;
  if (input.puestoId) {
    const { data: p } = await admin
      .from("puestos")
      .select("nombre")
      .eq("id", input.puestoId)
      .maybeSingle();
    puestoNombre = p?.nombre ?? null;
  }

  // 4a. Reactivar empleado existente
  if (empleadoExistente) {
    await admin
      .from("empleados")
      .update({
        estado: "Activo",
        fecha_baja: null,
        departamento_id: input.departamentoId ?? undefined,
        puesto: puestoNombre ?? undefined,
      })
      .eq("id", empleadoExistente.id);

    // Garantizar pertenencia canónica: el alta antigua pudo no escribir
    // user_empresas (gap histórico de la promoción). Idempotente.
    if (empleadoExistente.user_id) {
      await admin
        .from("user_empresas")
        .upsert(
          { user_id: empleadoExistente.user_id, empresa_id: empresaId },
          { onConflict: "user_id,empresa_id" },
        );
    }

    await admin
      .from("candidatos")
      .update({ empleado_id: empleadoExistente.id, fase: "seleccionado", estado: "empleado" })
      .eq("id", cand.id);

    // Vacante info para notif
    let vacanteTitulo: string | null = null;
    if (cand.vacante_id) {
      const { data: vac } = await admin.from("vacantes").select("titulo").eq("id", cand.vacante_id).maybeSingle();
      vacanteTitulo = vac?.titulo ?? null;
    }

    await registrarAuditoria(admin, empresaId, cand, empleadoExistente.id, true, user.id, actorEmail);
    await notificarRRHH(admin, empresaId, empleadoExistente.id, `${cand.nombre} ${cand.apellidos ?? ""}`.trim(), vacanteTitulo);

    return { ok: true, empleadoId: empleadoExistente.id, reactivado: true };
  }

  // 4b. Crear nuevo empleado vía el núcleo canónico (compartido con createEmpleado):
  // auth.user → profile → user_roles → user_empresas → empleado (con local + rollback).
  if (!input.localId) {
    await admin.from("candidatos").update({ promovido_at: null, promovido_por: null }).eq("id", cand.id);
    return { ok: false, error: "Debes asignar un local al nuevo empleado." };
  }

  const fullName = `${cand.nombre} ${cand.apellidos ?? ""}`.trim();
  const alta = await altaUsuarioEmpleado({
    admin,
    loginEmail: emailLower,
    emailPersonal: emailLower,
    emailEmpresa: null,
    fullName,
    nombre: cand.nombre,
    apellidos: cand.apellidos,
    telefono: cand.telefono,
    dniNie: dniNorm,
    departamentoId: input.departamentoId ?? null,
    puesto: puestoNombre,
    empresaPrincipalId: empresaId,
    empresasAcceso: [empresaId],
    localPrincipalId: input.localId,
  });

  if (!alta.ok) {
    // Rollback del lock optimista: el candidato vuelve a ser promocionable.
    await admin.from("candidatos").update({ promovido_at: null, promovido_por: null }).eq("id", cand.id);
    return { ok: false, error: alta.error };
  }

  // Linkar candidato → empleado
  await admin
    .from("candidatos")
    .update({ empleado_id: alta.empleadoId, fase: "seleccionado", estado: "empleado" })
    .eq("id", cand.id);

  // 5. Magic link de invitación (extra: la cuenta ya es usable con tempPassword).
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) ??
    "http://localhost:3000";
  const redirectTo = `${siteUrl.replace(/\/$/, "")}/primer-acceso`;

  let magicLinkSent = false;
  try {
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: emailLower,
      options: { redirectTo },
    });
    if (!linkErr && linkData?.properties?.action_link) {
      const empresaNombre = await admin
        .from("empresas")
        .select("nombre")
        .eq("id", empresaId)
        .single()
        .then((r) => r.data?.nombre ?? "tu empresa");

      const { subject, html, text } = bienvenidaEmpleadoEmail({
        recipientName: cand.nombre,
        actionUrl: linkData.properties.action_link,
        empresaNombre,
      });

      const sendRes = await sendEmail({
        to: emailLower,
        subject,
        html,
        text,
        empresaId,
      });
      magicLinkSent = sendRes.ok;
    }
  } catch (err) {
    console.error("[promocion] magic link error:", err);
  }

  // Vacante info para notif/auditoría
  let vacanteTitulo: string | null = null;
  if (cand.vacante_id) {
    const { data: vac } = await admin.from("vacantes").select("titulo").eq("id", cand.vacante_id).maybeSingle();
    vacanteTitulo = vac?.titulo ?? null;
  }

  await registrarAuditoria(admin, empresaId, cand, alta.empleadoId, false, user.id, actorEmail);
  await notificarRRHH(admin, empresaId, alta.empleadoId, fullName, vacanteTitulo);

  return {
    ok: true,
    empleadoId: alta.empleadoId,
    reactivado: false,
    magicLinkSent,
    tempPassword: alta.tempPassword,
  };
}
