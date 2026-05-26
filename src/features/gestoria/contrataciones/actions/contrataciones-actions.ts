"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  normalizarNombre,
  normalizarNombreOrNull,
} from "@/shared/lib/normalizar-nombre";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  altaEmailContent,
  bajaEmailContent,
  modificacionEmailContent,
} from "@/features/gestoria/contrataciones/lib/email-templates";
import type {
  AltaInput,
  BajaInput,
  ContratacionRow,
  ContratacionesConfig,
  EmpleadoActivo,
  ModificacionInput,
} from "@/features/gestoria/contrataciones/types";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null, empresaNombre: "" };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);

  let empresaNombre = "";
  if (empresaId) {
    const { data: e } = await supabase.from("empresas").select("nombre").eq("id", empresaId).maybeSingle();
    empresaNombre = (e?.nombre as string | undefined) ?? "";
  }
  return { supabase, user, empresaId, empresaNombre };
}

export async function listContrataciones(filtros?: {
  desde?: string | null;
  hasta?: string | null;
  tipo?: "alta" | "baja" | null;
}): Promise<{ ok: boolean; data: ContratacionRow[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "Sin empresa" };
    let q = supabase
      .from("contrataciones")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (filtros?.desde) q = q.gte("created_at", filtros.desde);
    if (filtros?.hasta) q = q.lte("created_at", filtros.hasta);
    if (filtros?.tipo) q = q.eq("tipo", filtros.tipo);
    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: (data ?? []) as ContratacionRow[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contrataciones] list:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function listPuestos(): Promise<{ ok: boolean; data: string[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "Sin empresa" };
    const [puestosRes, empleadosRes] = await Promise.all([
      supabase.from("puestos").select("nombre").eq("empresa_id", empresaId),
      supabase.from("empleados").select("puesto").eq("empresa_id", empresaId),
    ]);
    if (puestosRes.error) throw puestosRes.error;
    if (empleadosRes.error) throw empleadosRes.error;
    const set = new Set<string>();
    for (const r of puestosRes.data ?? []) {
      const v = ((r as Record<string, unknown>).nombre as string | undefined)?.trim();
      if (v) set.add(v);
    }
    for (const r of empleadosRes.data ?? []) {
      const v = ((r as Record<string, unknown>).puesto as string | undefined)?.trim();
      if (v) set.add(v);
    }
    const data = Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contrataciones] listPuestos:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function listEmpleadosActivos(): Promise<{ ok: boolean; data: EmpleadoActivo[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "Sin empresa" };
    const { data, error } = await supabase
      .from("empleados")
      .select("id, nombre, apellidos, puesto")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo")
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as EmpleadoActivo[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contrataciones] empleados:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function getContratacionesConfig(): Promise<{ ok: boolean; config: ContratacionesConfig | null; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, config: null, error: "Sin empresa" };
    const { data, error } = await supabase
      .from("empresas")
      .select("config_operativa")
      .eq("id", empresaId)
      .maybeSingle();
    if (error) throw error;
    const cfg = (data?.config_operativa as Record<string, unknown> | undefined)?.contrataciones as
      | ContratacionesConfig
      | undefined;
    return { ok: true, config: cfg ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contrataciones] getConfig:", msg);
    return { ok: false, config: null, error: msg };
  }
}

export async function saveContratacionesConfig(input: ContratacionesConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const { data: row, error: readErr } = await supabase
      .from("empresas")
      .select("config_operativa")
      .eq("id", empresaId)
      .maybeSingle();
    if (readErr) throw readErr;
    const current = (row?.config_operativa as Record<string, unknown> | null) ?? {};
    const next = {
      ...current,
      contrataciones: {
        email_gestoria: input.email_gestoria.trim(),
        email_departamento: input.email_departamento?.trim() || null,
      },
    };
    const { error } = await supabase
      .from("empresas")
      .update({ config_operativa: next, updated_at: new Date().toISOString() })
      .eq("id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contrataciones] saveConfig:", msg);
    return { ok: false, error: msg };
  }
}

export async function crearAlta(input: AltaInput, emailExtra?: string | null): Promise<{ ok: boolean; id?: string; emailOk?: boolean; emailError?: string; error?: string }> {
  try {
    const { supabase, user, empresaId, empresaNombre } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const cfgRes = await getContratacionesConfig();
    const dest = cfgRes.config?.email_gestoria;
    if (!dest) return { ok: false, error: "Configura el email de gestoría en Ajustes" };

    const insert = {
      empresa_id: empresaId,
      tipo: "alta" as const,
      nombre: normalizarNombre(input.nombre),
      apellidos: normalizarNombreOrNull(input.apellidos),
      dni: input.dni ?? null,
      numero_ss: input.numero_ss ?? null,
      fecha_comienzo: input.fecha_comienzo,
      nomina: input.nomina ?? "Según convenio",
      puesto: input.puesto,
      jornada_horas: input.jornada_horas,
      horario_lunes: input.horario_lunes ?? null,
      horario_martes: input.horario_martes ?? null,
      horario_miercoles: input.horario_miercoles ?? null,
      horario_jueves: input.horario_jueves ?? null,
      horario_viernes: input.horario_viernes ?? null,
      horario_sabado: input.horario_sabado ?? null,
      horario_domingo: input.horario_domingo ?? null,
      email_to_gestoria: dest,
      email_to_departamento: emailExtra?.trim() || null,
      email_estado: "pendiente",
      created_by: user.id,
    };

    const { data: row, error } = await supabase
      .from("contrataciones")
      .insert(insert)
      .select("id")
      .single();
    if (error) throw error;

    const id = row.id as string;
    const { subject, text, html } = altaEmailContent(input, empresaNombre);
    const recipients = [dest];
    if (emailExtra?.trim()) recipients.push(emailExtra.trim());

    let emailOk = true;
    let emailError: string | undefined;
    for (const to of recipients) {
      const r = await sendEmail({ to, subject, html, text, empresaId });
      if (!r.ok) {
        emailOk = false;
        emailError = "configured" in r && r.configured ? r.error : "Email no configurado";
        break;
      }
    }

    await supabase
      .from("contrataciones")
      .update({
        email_estado: emailOk ? "enviado" : "fallido",
        email_enviado_at: emailOk ? new Date().toISOString() : null,
        email_error: emailOk ? null : emailError ?? null,
      })
      .eq("id", id);

    return { ok: true, id, emailOk, emailError };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contrataciones] crearAlta:", msg);
    return { ok: false, error: msg };
  }
}

export async function crearBaja(input: BajaInput, emailExtra?: string | null): Promise<{ ok: boolean; id?: string; emailOk?: boolean; emailError?: string; error?: string }> {
  try {
    const { supabase, user, empresaId, empresaNombre } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const cfgRes = await getContratacionesConfig();
    const dest = cfgRes.config?.email_gestoria;
    if (!dest) return { ok: false, error: "Configura el email de gestoría en Ajustes" };

    const { data: emp, error: empErr } = await supabase
      .from("empleados")
      .select("id, nombre, apellidos, puesto")
      .eq("id", input.empleado_id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!emp) return { ok: false, error: "Empleado no encontrado" };

    const empleado: EmpleadoActivo = {
      id: emp.id as string,
      nombre: (emp.nombre as string) ?? "",
      apellidos: (emp.apellidos as string | null) ?? null,
      puesto: (emp.puesto as string | null) ?? null,
    };

    const insert = {
      empresa_id: empresaId,
      tipo: "baja" as const,
      nombre: empleado.nombre,
      apellidos: empleado.apellidos,
      puesto: empleado.puesto,
      empleado_id: input.empleado_id,
      fecha_finalizacion: input.fecha_finalizacion,
      motivo: input.motivo,
      motivo_otro: input.motivo === "Otro" ? input.motivo_otro ?? null : null,
      liquidar_vacaciones: input.liquidar_vacaciones,
      dias_vacaciones: input.liquidar_vacaciones ? input.dias_vacaciones ?? null : null,
      descontar_preaviso: input.descontar_preaviso,
      dias_preaviso: input.descontar_preaviso ? input.dias_preaviso ?? null : null,
      email_to_gestoria: dest,
      email_to_departamento: emailExtra?.trim() || null,
      email_estado: "pendiente",
      created_by: user.id,
    };

    const { data: row, error } = await supabase
      .from("contrataciones")
      .insert(insert)
      .select("id")
      .single();
    if (error) throw error;

    const id = row.id as string;
    const { subject, text, html } = bajaEmailContent(input, empleado, empresaNombre);
    const recipients = [dest];
    if (emailExtra?.trim()) recipients.push(emailExtra.trim());

    let emailOk = true;
    let emailError: string | undefined;
    for (const to of recipients) {
      const r = await sendEmail({ to, subject, html, text, empresaId });
      if (!r.ok) {
        emailOk = false;
        emailError = "configured" in r && r.configured ? r.error : "Email no configurado";
        break;
      }
    }

    await supabase
      .from("contrataciones")
      .update({
        email_estado: emailOk ? "enviado" : "fallido",
        email_enviado_at: emailOk ? new Date().toISOString() : null,
        email_error: emailOk ? null : emailError ?? null,
      })
      .eq("id", id);

    return { ok: true, id, emailOk, emailError };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contrataciones] crearBaja:", msg);
    return { ok: false, error: msg };
  }
}

export async function crearModificacion(input: ModificacionInput, emailExtra?: string | null): Promise<{ ok: boolean; id?: string; emailOk?: boolean; emailError?: string; error?: string }> {
  try {
    const { supabase, user, empresaId, empresaNombre } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const cfgRes = await getContratacionesConfig();
    const dest = cfgRes.config?.email_gestoria;
    if (!dest) return { ok: false, error: "Configura el email de gestoría en Ajustes" };

    const { data: emp, error: empErr } = await supabase
      .from("empleados")
      .select("id, nombre, apellidos, puesto")
      .eq("id", input.empleado_id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!emp) return { ok: false, error: "Empleado no encontrado" };

    const empleado: EmpleadoActivo = {
      id: emp.id as string,
      nombre: (emp.nombre as string) ?? "",
      apellidos: (emp.apellidos as string | null) ?? null,
      puesto: (emp.puesto as string | null) ?? null,
    };

    const detalleFinal = (() => {
      const partes: string[] = [];
      if (input.modificacion_tipo === "Puesto" && input.nuevo_puesto?.trim()) {
        partes.push(`De "${empleado.puesto ?? "—"}" a "${input.nuevo_puesto.trim()}"`);
      }
      if (input.modificacion_detalle?.trim()) partes.push(input.modificacion_detalle.trim());
      return partes.join(" · ");
    })();

    const insert = {
      empresa_id: empresaId,
      tipo: "modificacion" as const,
      nombre: empleado.nombre,
      apellidos: empleado.apellidos,
      puesto: empleado.puesto,
      empleado_id: input.empleado_id,
      fecha_cambio: input.fecha_cambio,
      modificacion_tipo: input.modificacion_tipo,
      modificacion_detalle: detalleFinal,
      email_to_gestoria: dest,
      email_to_departamento: emailExtra?.trim() || null,
      email_estado: "pendiente",
      created_by: user.id,
    };

    const { data: row, error } = await supabase
      .from("contrataciones")
      .insert(insert)
      .select("id")
      .single();
    if (error) throw error;

    const id = row.id as string;
    const { subject, text, html } = modificacionEmailContent(input, empleado, empresaNombre);
    const recipients = [dest];
    if (emailExtra?.trim()) recipients.push(emailExtra.trim());

    let emailOk = true;
    let emailError: string | undefined;
    for (const to of recipients) {
      const r = await sendEmail({ to, subject, html, text, empresaId });
      if (!r.ok) {
        emailOk = false;
        emailError = "configured" in r && r.configured ? r.error : "Email no configurado";
        break;
      }
    }

    await supabase
      .from("contrataciones")
      .update({
        email_estado: emailOk ? "enviado" : "fallido",
        email_enviado_at: emailOk ? new Date().toISOString() : null,
        email_error: emailOk ? null : emailError ?? null,
      })
      .eq("id", id);

    return { ok: true, id, emailOk, emailError };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contrataciones] crearModificacion:", msg);
    return { ok: false, error: msg };
  }
}
