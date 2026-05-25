"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/shared/lib/friendly-errors";
import type { DatosPersonalesInput, DatosPersonalesCompletos } from "@/features/mi-panel/actions/datos-personales-actions";
import type { SolicitudPersonal, SolicitudSubtipo, SolicitudTipo, SolicitudEstado } from "@/features/mi-panel/types";

const ROLES_ADMIN = ["admin", "director"] as const;

export type EstadoEmpleado = "Activo" | "Baja temporal" | "Baja definitiva";

const ESTADOS_BAJA: EstadoEmpleado[] = ["Baja temporal", "Baja definitiva"];

const FALLBACK_DEPARTAMENTOS = [
  "DIRECCIÓN", "SALA", "COCINA", "GERENCIA", "CAMAREROS",
  "CACHIMBEROS", "ARTISTAS", "MANTENIMIENTO", "RRPP", "ADMINISTRATIVO",
].map(nombre => ({ id: `mock-dep-${nombre.toLowerCase().replace(/\s+/g, "-")}`, nombre }));

function ordenarEmpresasConPrincipal(
  empresaIds: string[],
  empresaPrincipalId: string,
) {
  const resto = empresaIds.filter((id) => id !== empresaPrincipalId);
  return empresaIds.includes(empresaPrincipalId)
    ? [empresaPrincipalId, ...resto]
    : [empresaPrincipalId, ...resto];
}

export async function listEmpleados() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };

    // Un empleado aparece en una empresa si:
    //   1) su empresa_id es esa empresa (empresa principal), o
    //   2) su user_id tiene acceso a esa empresa vía user_empresas (acceso secundario).
    // Devolvemos todos esos empleados con un flag `es_principal` para la UI.

    const { data: accesosUE } = await supabase
      .from("user_empresas")
      .select("user_id")
      .eq("empresa_id", empresaId);
    const userIdsConAcceso = (accesosUE ?? []).map((r) => r.user_id as string);

    const filtro = userIdsConAcceso.length > 0
      ? `empresa_id.eq.${empresaId},user_id.in.(${userIdsConAcceso.join(",")})`
      : `empresa_id.eq.${empresaId}`;

    const { data, error } = await supabase
      .from("empleados")
      .select(`*, departamentos(nombre)`)
      .or(filtro)
      .order("nombre", { ascending: true });

    if (error) throw error;

    // Cargar todas las empresas a las que cada empleado tiene acceso para enriquecer.
    const userIds = Array.from(new Set((data ?? []).map((e) => e.user_id as string).filter(Boolean)));
    let empresasPorUser: Record<string, Array<{ id: string; nombre: string }>> = {};
    if (userIds.length > 0) {
      const { data: rels } = await supabase
        .from("user_empresas")
        .select("user_id, empresas:empresa_id(id, nombre)")
        .in("user_id", userIds);
      empresasPorUser = (rels ?? []).reduce<Record<string, Array<{ id: string; nombre: string }>>>(
        (acc, r) => {
          const uid = r.user_id as string;
          const emp = r.empresas as unknown as { id: string; nombre: string } | null;
          if (!emp) return acc;
          if (!acc[uid]) acc[uid] = [];
          acc[uid].push(emp);
          return acc;
        },
        {}
      );
    }

    // Dedup por user_id: si el mismo usuario tiene ficha en varias empresas
    // (p.ej. director multiempresa), la query con OR lo trae 2 veces — una
    // por su ficha principal en esta empresa y otra por la ficha de la otra
    // empresa incluida vía user_empresas. Nos quedamos con UNA fila por
    // user_id, prefiriendo la ficha de esta empresa (es_principal).
    const porUser = new Map<string, typeof data[number]>();
    const sinUser: typeof data = [];
    for (const e of data ?? []) {
      const uid = e.user_id as string | null;
      if (!uid) {
        sinUser.push(e);
        continue;
      }
      const prev = porUser.get(uid);
      if (!prev) {
        porUser.set(uid, e);
        continue;
      }
      const prevPrincipal = prev.empresa_id === empresaId;
      const currPrincipal = e.empresa_id === empresaId;
      if (currPrincipal && !prevPrincipal) porUser.set(uid, e);
    }

    const enriched = [...porUser.values(), ...sinUser].map((e) => ({
      ...e,
      es_principal: e.empresa_id === empresaId,
      empresas_acceso: empresasPorUser[e.user_id as string] ?? [],
    }));
    enriched.sort((a, b) =>
      String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""), "es"),
    );

    return { ok: true, data: enriched };
  } catch (err) {
    console.error("[rrhh] listEmpleados:", err);
    return { ok: false, data: [] };
  }
}

// Regla de negocio: todo empleado DEBE tener un usuario. createEmpleado crea
// el auth.user + profile + user_role + empleado en cascada. Devuelve la
// contraseña temporal para que el admin la entregue al empleado en su primer
// acceso (el form la muestra en pantalla y permite copiarla).
//
// Emails: emailPersonal es obligatorio; emailEmpresa solo si tiene cuenta
// corporativa real. El login se deriva como emailEmpresa ?? emailPersonal y
// queda fijo en auth.users — no se recalcula al editar emails desde la ficha
// del empleado, solo se cambia desde Ajustes → Usuarios.
export async function createEmpleado(input: {
  nombre: string;
  apellidos?: string;
  departamentoId?: string;
  puesto?: string;
  emailEmpresa?: string;
  emailPersonal: string;
  telefono?: string;
  // Empresas a las que el empleado tendrá acceso. La primera es la "principal"
  // (queda como empleados.empresa_id y profiles.empresa_id). Si no se pasa
  // `empresaPrincipalId`, se usa la primera o la empresa activa del admin.
  empresaIds?: string[];
  empresaPrincipalId?: string;
  // Mapa transitorio desde la UI. A día de hoy solo persistimos el local de la
  // empresa principal en empleados.local_id; los accesos secundarios se
  // guardan únicamente en user_empresas.
  localPorEmpresa?: Record<string, string | null>;
}) {
  try {
    const { empresaId: empresaActivaId } = await getAppContext();

    const empresasSeleccionadas = Array.from(new Set((input.empresaIds ?? []).filter(Boolean)));
    const empresaPrincipalId = input.empresaPrincipalId ?? empresasSeleccionadas[0] ?? empresaActivaId;
    if (!empresaPrincipalId) return { ok: false, error: "Selecciona al menos una empresa." };
    // Si no se pasó ninguna explícitamente, usamos la activa como única.
    const empresasAccesoBase = empresasSeleccionadas.length > 0
      ? empresasSeleccionadas
      : [empresaPrincipalId];
    const empresasAcceso = ordenarEmpresasConPrincipal(
      empresasAccesoBase,
      empresaPrincipalId,
    );
    if (!empresasAcceso.includes(empresaPrincipalId)) {
      return { ok: false, error: "La empresa principal debe estar incluida en los accesos." };
    }

    // Verificar admin + que el caller pertenece a TODAS las empresas a las
    // que va a dar acceso al nuevo empleado. Sin este check, un admin de la
    // empresa A podía dar de alta usuarios en la empresa B pasando su UUID.
    await requireAdminUser({ empresaIds: empresasAcceso });

    const emailEmpresa = (input.emailEmpresa ?? "").trim().toLowerCase() || null;
    const emailPersonal = (input.emailPersonal ?? "").trim().toLowerCase();
    if (!emailPersonal) return { ok: false, error: "El email personal es obligatorio." };
    const email = emailEmpresa ?? emailPersonal;

    let admin;
    try { admin = createAdminClient(); }
    catch { return { ok: false, error: "Supabase admin no configurado." }; }

    const fullName = `${input.nombre} ${input.apellidos ?? ""}`.trim();
    const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";

    // 1. Crear auth.user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr || !created?.user) {
      return { ok: false, error: createErr ? friendlyError(createErr) : "No se pudo crear el usuario" };
    }
    const newUserId = created.user.id;

    // 2. Completar profile (el trigger handle_new_user crea la fila base)
    await admin.from("profiles").update({
      empresa_id: empresaPrincipalId,
      full_name: fullName,
      nombre: input.nombre,
      apellidos: input.apellidos ?? null,
      rol_label: "EMPLEADO",
      es_empleado: true,
      avatar_obligatorio: true,
    }).eq("id", newUserId);

    // 3. Asignar rol RBAC base
    await admin.from("user_roles").insert({ user_id: newUserId, role: "empleado" });

    // 4. Acceso multi-empresa: insertar en user_empresas para cada empresa marcada.
    const accesosRows = empresasAcceso.map((eid) => ({
      user_id: newUserId,
      empresa_id: eid,
    }));
    const { error: accesoErr } = await admin
      .from("user_empresas")
      .upsert(accesosRows, { onConflict: "user_id,empresa_id" });
    if (accesoErr) {
      await admin.auth.admin.deleteUser(newUserId);
      return { ok: false, error: `Error asignando acceso a empresas: ${friendlyError(accesoErr)}` };
    }

    // 5. Crear empleado vinculado (en la empresa principal).
    const isRealId = (id?: string) => !!id && !id.startsWith("mock-");
    const localPrincipal =
      input.localPorEmpresa?.[empresaPrincipalId] ?? null;
    if (!localPrincipal) {
      await admin.auth.admin.deleteUser(newUserId);
      return { ok: false, error: "La empresa principal debe tener un local asignado." };
    }
    const { data: localRow, error: localErr } = await admin
      .from("locales")
      .select("id, empresa_id")
      .eq("id", localPrincipal)
      .maybeSingle();
    if (localErr || !localRow || localRow.empresa_id !== empresaPrincipalId) {
      await admin.auth.admin.deleteUser(newUserId);
      return {
        ok: false,
        error: "El local asignado debe pertenecer a la empresa principal.",
      };
    }
    const { error: empErr } = await admin.from("empleados").insert({
      empresa_id: empresaPrincipalId,
      user_id: newUserId,
      nombre: input.nombre,
      apellidos: input.apellidos ?? null,
      departamento_id: isRealId(input.departamentoId) ? input.departamentoId : null,
      puesto: input.puesto ?? null,
      email_empresa: emailEmpresa,
      email_personal: emailPersonal,
      telefono: input.telefono ?? null,
      fecha_alta: new Date().toISOString().slice(0, 10),
      estado: "Activo",
      tipo_jornada: "Completa",
      perfil_completado: false,
      local_id: localPrincipal,
    });

    if (empErr) {
      // Rollback: borrar el auth.user (CASCADE limpia profile, user_empresas, user_roles).
      await admin.auth.admin.deleteUser(newUserId);
      return { ok: false, error: friendlyError(empErr) };
    }

    revalidatePath("/rrhh/empleados");
    return { ok: true, tempPassword, email };
  } catch (err: unknown) {
    console.error("[rrhh] createEmpleado:", err);
    return { ok: false, error: friendlyError(err) };
  }
}

type UpdateEmpleadoInput = {
  nombre?: string;
  apellidos?: string | null;
  departamentoId?: string | null;
  puesto?: string | null;
  emailEmpresa?: string | null;
  emailPersonal?: string | null;
  telefono?: string | null;
  notas?: string | null;
};

export async function updateEmpleadoEmpresasAcceso(input: {
  empleadoId: string;
  empresaIds: string[];
}) {
  try {
    const empresaIds = Array.from(new Set(input.empresaIds.filter(Boolean)));
    if (empresaIds.length === 0) {
      return { ok: false, error: "Selecciona al menos una empresa." };
    }

    const { supabase } = await getAppContext();
    const { data: empleado, error: empErr } = await supabase
      .from("empleados")
      .select("id, user_id, empresa_id")
      .eq("id", input.empleadoId)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!empleado?.user_id || !empleado.empresa_id) {
      return { ok: false, error: "Empleado no encontrado o sin usuario vinculado." };
    }
    if (!empresaIds.includes(empleado.empresa_id)) {
      return {
        ok: false,
        error: "La empresa principal del empleado no se puede quitar del acceso.",
      };
    }

    await requireAdminUser({ empresaIds });

    let admin;
    try { admin = createAdminClient(); }
    catch { return { ok: false, error: "Supabase admin no configurado." }; }

    const { error: deleteErr } = await admin
      .from("user_empresas")
      .delete()
      .eq("user_id", empleado.user_id);
    if (deleteErr) throw deleteErr;

    const rows = empresaIds.map((empresa_id) => ({
      user_id: empleado.user_id,
      empresa_id,
    }));
    const { error: insertErr } = await admin
      .from("user_empresas")
      .insert(rows);
    if (insertErr) throw insertErr;

    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${input.empleadoId}`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] updateEmpleadoEmpresasAcceso:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateEmpleado(id: string, updates: UpdateEmpleadoInput) {
  try {
    const { supabase } = await getAppContext();
    const patch: Record<string, unknown> = {};
    if (updates.nombre !== undefined) patch.nombre = updates.nombre;
    if (updates.apellidos !== undefined) patch.apellidos = updates.apellidos;
    if (updates.departamentoId !== undefined) patch.departamento_id = updates.departamentoId;
    if (updates.puesto !== undefined) patch.puesto = updates.puesto;
    if (updates.emailEmpresa !== undefined) patch.email_empresa = updates.emailEmpresa;
    if (updates.emailPersonal !== undefined) patch.email_personal = updates.emailPersonal;
    if (updates.telefono !== undefined) patch.telefono = updates.telefono;
    if (updates.notas !== undefined) patch.notas = updates.notas;

    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase.from("empleados").update(patch).eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${id}`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] updateEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Cambia el estado del empleado. Validaciones (también las hace el constraint
 * `empleados_estado_check` en BD, esto es solo para dar errores legibles):
 *   - Para 'Baja temporal' / 'Baja definitiva' es obligatorio `fechaBaja`.
 *   - Para 'Activo' se limpia automáticamente la `fechaBaja`.
 *
 * Al guardar, el trigger `empleados_sync_estado_acceso` actualiza
 * automáticamente `profiles.estado_acceso` (Activo/Inactivo) si el empleado
 * tiene cuenta de portal vinculada.
 */
export async function setEmpleadoEstado(input: {
  id: string;
  estado: EstadoEmpleado;
  fechaBaja?: string | null;
}) {
  try {
    if (ESTADOS_BAJA.includes(input.estado) && !input.fechaBaja) {
      return {
        ok: false,
        error: "La fecha de baja es obligatoria para Baja temporal o Baja definitiva.",
      };
    }

    const { supabase } = await getAppContext();
    const patch: Record<string, unknown> = { estado: input.estado };
    patch.fecha_baja = input.estado === "Activo" ? null : input.fechaBaja ?? null;

    const { error } = await supabase.from("empleados").update(patch).eq("id", input.id);
    if (error) throw error;
    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${input.id}`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] setEmpleadoEstado:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteEmpleado(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("empleados").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${id}`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] deleteEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

export async function listDepartamentos() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: FALLBACK_DEPARTAMENTOS };
    const { data, error } = await supabase
      .from("departamentos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre");
    if (error) throw error;
    const result = data ?? [];
    return { ok: true, data: result.length > 0 ? result : FALLBACK_DEPARTAMENTOS };
  } catch {
    return { ok: true, data: FALLBACK_DEPARTAMENTOS };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica que el invocador tenga rol admin o director y, opcionalmente,
 * que sea miembro de TODAS las empresas indicadas en `opts.empresaIds`.
 *
 * - `director` es un rol de plataforma (Doc 4 §6) y conserva bypass total
 *   sobre el scope por empresa: un director puede operar cross-tenant.
 * - `admin` es rol tenant: debe pertenecer (vía user_empresas) a cada una
 *   de las empresas sobre las que opera. Si se pasa una empresa a la que
 *   no pertenece, se rechaza con error.
 *
 * Doc 4 P0 — gap B del audit 2026-05-15.
 */
async function requireAdminUser(opts?: { empresaIds?: string[] }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: rolesRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roles.some((r) =>
    (ROLES_ADMIN as readonly string[]).includes(r),
  );
  if (!isAdmin) {
    throw new Error("Sin permisos: solo admin o director pueden modificar empleados");
  }

  // director (rol plataforma) opera cross-tenant; salta el scope por empresa.
  if (opts?.empresaIds && opts.empresaIds.length > 0 && !roles.includes("director")) {
    const empresasReq = Array.from(
      new Set(opts.empresaIds.filter((id) => typeof id === "string" && UUID_RE.test(id))),
    );
    if (empresasReq.length === 0) {
      throw new Error("Sin permisos: empresas no válidas");
    }
    const { data: rels } = await supabase
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", user.id)
      .in("empresa_id", empresasReq);
    const accesibles = new Set((rels ?? []).map((r: { empresa_id: string }) => r.empresa_id));
    const sinAcceso = empresasReq.filter((id) => !accesibles.has(id));
    if (sinAcceso.length > 0) {
      throw new Error(
        sinAcceso.length === 1
          ? "Sin permisos: no tienes acceso a esa empresa"
          : `Sin permisos: no tienes acceso a ${sinAcceso.length} de las empresas seleccionadas`,
      );
    }
  }

  return user;
}

/**
 * Carga un empleado por id junto con los datos personales completos del
 * usuario vinculado. Devuelve la forma que espera `DatosPersonalesForm`
 * para que la ficha pueda renderizar el mismo formulario que ve el
 * empleado en Mi Panel.
 *
 * Por contrato (constraint NOT NULL en empleados.user_id) todo empleado
 * tiene siempre profile vinculado.
 */
export async function getEmpleadoConPerfil(empleadoId: string) {
  try {
    const { supabase } = await getAppContext();
    const { data: emp, error } = await supabase
      .from("empleados")
      .select(`*, departamentos(nombre)`)
      .eq("id", empleadoId)
      .maybeSingle();
    if (error) throw error;
    if (!emp) return { ok: false, error: "Empleado no encontrado", data: null };

    let perfil: Record<string, unknown> | null = null;
    if (emp.user_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select(
          "nombre, apellidos, email, tipo_documento, dni_nie, fecha_nacimiento, nacionalidad, genero, estado_civil, numero_ss, telefono, telefono_empresa, email_personal, email_empresa, direccion, codigo_postal, ciudad, provincia, pais, iban, banco_codigo, banco_nombre, titular_cuenta, iban_verificado, emergencia_nombre, emergencia_relacion, emergencia_telefono, talla_camiseta, talla_pantalon",
        )
        .eq("id", emp.user_id)
        .maybeSingle();
      perfil = p ?? null;
    }

    const datosPersonales: DatosPersonalesCompletos = {
      nombre: (perfil?.nombre as string | null) ?? emp.nombre ?? null,
      apellidos: (perfil?.apellidos as string | null) ?? emp.apellidos ?? null,
      email: (perfil?.email as string | null) ?? emp.email_empresa ?? emp.email_personal ?? null,
      tipo_documento: (perfil?.tipo_documento as DatosPersonalesCompletos["tipo_documento"]) ?? null,
      dni_nie: (perfil?.dni_nie as string | null) ?? emp.dni_nie ?? null,
      fecha_nacimiento: (perfil?.fecha_nacimiento as string | null) ?? emp.fecha_nacimiento ?? null,
      nacionalidad: (perfil?.nacionalidad as string | null) ?? emp.nacionalidad ?? null,
      genero: (perfil?.genero as string | null) ?? null,
      estado_civil: (perfil?.estado_civil as string | null) ?? null,
      numero_ss: (perfil?.numero_ss as string | null) ?? emp.numero_ss ?? null,
      telefono: (perfil?.telefono as string | null) ?? emp.telefono ?? null,
      telefono_empresa: (perfil?.telefono_empresa as string | null) ?? null,
      email_personal: (perfil?.email_personal as string | null) ?? emp.email_personal ?? null,
      email_empresa: (perfil?.email_empresa as string | null) ?? emp.email_empresa ?? null,
      direccion: (perfil?.direccion as string | null) ?? emp.direccion ?? null,
      codigo_postal: (perfil?.codigo_postal as string | null) ?? null,
      ciudad: (perfil?.ciudad as string | null) ?? null,
      provincia: (perfil?.provincia as string | null) ?? null,
      pais: (perfil?.pais as string | null) ?? null,
      iban: (perfil?.iban as string | null) ?? null,
      banco_codigo: (perfil?.banco_codigo as string | null) ?? null,
      banco_nombre: (perfil?.banco_nombre as string | null) ?? null,
      titular_cuenta: (perfil?.titular_cuenta as string | null) ?? null,
      iban_verificado: Boolean(perfil?.iban_verificado),
      emergencia_nombre: (perfil?.emergencia_nombre as string | null) ?? null,
      emergencia_relacion: (perfil?.emergencia_relacion as string | null) ?? null,
      emergencia_telefono: (perfil?.emergencia_telefono as string | null) ?? null,
      talla_camiseta: (perfil?.talla_camiseta as string | null) ?? null,
      talla_pantalon: (perfil?.talla_pantalon as string | null) ?? null,
    };

    // Empresas a las que tiene acceso (user_empresas) + cuál es la principal.
    let empresasAcceso: Array<{ id: string; nombre: string; esPrincipal: boolean }> = [];
    if (emp.user_id) {
      const { data: rels } = await supabase
        .from("user_empresas")
        .select("empresas:empresa_id(id, nombre)")
        .eq("user_id", emp.user_id);
      empresasAcceso = (rels ?? [])
        .map((r) => r.empresas as unknown as { id: string; nombre: string } | null)
        .filter((e): e is { id: string; nombre: string } => e !== null)
        .map((e) => ({ ...e, esPrincipal: e.id === emp.empresa_id }))
        .sort((a, b) => {
          if (a.esPrincipal && !b.esPrincipal) return -1;
          if (!a.esPrincipal && b.esPrincipal) return 1;
          return a.nombre.localeCompare(b.nombre);
        });
    }

    return { ok: true, empleado: emp, datosPersonales, empresasAcceso };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error cargando empleado";
    console.error("[rrhh] getEmpleadoConPerfil:", msg);
    return { ok: false, error: msg, data: null };
  }
}

function mapSolicitudEmpleado(row: Record<string, unknown>): SolicitudPersonal {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    userId: row.user_id as string,
    empleadoNombre: (row.empleado_nombre as string) ?? "",
    tipo: row.tipo as SolicitudTipo,
    subtipo: row.subtipo as SolicitudSubtipo,
    fechaInicio: row.fecha_inicio as string,
    fechaFin: (row.fecha_fin as string | null) ?? null,
    horas: (row.horas as number | null) ?? null,
    motivo: (row.motivo as string) ?? "",
    estado: row.estado as SolicitudEstado,
    createdAt: row.created_at as string,
  };
}

export async function listSolicitudesEmpleado(
  empleadoId: string,
): Promise<{ ok: true; data: SolicitudPersonal[] } | { ok: false; data: []; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };

    const { data: empleado, error: empErr } = await supabase
      .from("empleados")
      .select("user_id")
      .eq("id", empleadoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!empleado?.user_id) return { ok: false, data: [], error: "Empleado sin usuario vinculado" };

    const { data, error } = await supabase
      .from("solicitudes_personal")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("user_id", empleado.user_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    return { ok: true, data: (data ?? []).map((row) => mapSolicitudEmpleado(row as Record<string, unknown>)) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] listSolicitudesEmpleado:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export type EmpleadoHorarioActual = {
  patronId: string;
  nombre: string;
  tipo: string;
  asignadoAt: string;
};

export async function getEmpleadoHorarioActual(
  empleadoId: string,
): Promise<{ ok: true; data: EmpleadoHorarioActual | null } | { ok: false; data: null; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: null, error: "No autenticado" };

    const { data, error } = await supabase
      .from("rrhh_patron_empleados")
      .select("asignado_at, rrhh_patrones!inner(id, nombre, tipo, empresa_id, activo)")
      .eq("empleado_id", empleadoId)
      .eq("rrhh_patrones.empresa_id", empresaId)
      .eq("rrhh_patrones.activo", true)
      .order("asignado_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: null };

    const patron = data.rrhh_patrones as unknown as {
      id: string;
      nombre: string;
      tipo: string;
    } | null;

    if (!patron) return { ok: true, data: null };

    return {
      ok: true,
      data: {
        patronId: patron.id,
        nombre: patron.nombre,
        tipo: patron.tipo,
        asignadoAt: data.asignado_at as string,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] getEmpleadoHorarioActual:", msg);
    return { ok: false, data: null, error: msg };
  }
}

/**
 * Admin guarda los datos personales del empleado en el profile vinculado.
 * Sólo accesible por admin o director. Por contrato (NOT NULL) todo empleado
 * tiene user vinculado, por lo que el guardado siempre puede proceder.
 *
 * Tras guardar, los cambios se ven inmediatamente en `Mi Panel → Perfil`
 * del empleado correspondiente al recargar la pestaña (o en el siguiente
 * navegación).
 */
export async function guardarPerfilEmpleado(
  empleadoId: string,
  datos: DatosPersonalesInput,
) {
  try {
    // 1) Gate de rol global. Bloquea a no-admin antes de cualquier lectura.
    await requireAdminUser();

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { ok: false, error: "Supabase admin no configurado." };
    }

    const { data: emp, error: empErr } = await admin
      .from("empleados")
      .select("id, user_id, empresa_id")
      .eq("id", empleadoId)
      .maybeSingle();
    if (empErr) return { ok: false, error: friendlyError(empErr) };
    if (!emp) return { ok: false, error: "Empleado no encontrado" };

    // 2) Gate de scope por empresa, ya conocida la empresa del empleado.
    //    Un admin de empresa A no puede editar perfil de un empleado de B.
    await requireAdminUser({ empresaIds: [emp.empresa_id as string] });

    const trim = (v: string | null | undefined) => {
      if (v == null) return null;
      const t = v.trim();
      return t === "" ? null : t;
    };
    const iban = trim(datos.iban)?.replace(/\s+/g, "").toUpperCase() ?? null;

    const payload: Record<string, unknown> = {
      nombre: trim(datos.nombre),
      apellidos: trim(datos.apellidos),
      tipo_documento: trim(datos.tipo_documento as string | null | undefined),
      dni_nie: trim(datos.dni_nie),
      fecha_nacimiento: trim(datos.fecha_nacimiento),
      nacionalidad: trim(datos.nacionalidad),
      genero: trim(datos.genero),
      estado_civil: trim(datos.estado_civil),
      numero_ss: trim(datos.numero_ss),
      telefono: trim(datos.telefono),
      telefono_empresa: trim(datos.telefono_empresa),
      email_personal: trim(datos.email_personal),
      email_empresa: trim(datos.email_empresa),
      direccion: trim(datos.direccion),
      codigo_postal: trim(datos.codigo_postal),
      ciudad: trim(datos.ciudad),
      provincia: trim(datos.provincia),
      pais: trim(datos.pais),
      iban,
      banco_codigo: trim(datos.banco_codigo),
      banco_nombre: trim(datos.banco_nombre),
      titular_cuenta: trim(datos.titular_cuenta),
      emergencia_nombre: trim(datos.emergencia_nombre),
      emergencia_relacion: trim(datos.emergencia_relacion),
      emergencia_telefono: trim(datos.emergencia_telefono),
      talla_camiseta: trim(datos.talla_camiseta),
      talla_pantalon: trim(datos.talla_pantalon),
      datos_personales_actualizado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: updErr } = await admin
      .from("profiles")
      .update(payload)
      .eq("id", emp.user_id);
    if (updErr) return { ok: false, error: friendlyError(updErr) };

    // También sincronizamos nombre/apellidos en empleados para que la lista
    // de RRHH muestre los cambios sin tener que mirar el join. Sólo actualizamos
    // los campos que llegaron en el payload — nombre es NOT NULL en empleados.
    const empleadoPatch: Record<string, unknown> = {};
    const nombreTrim = trim(datos.nombre);
    if (nombreTrim) empleadoPatch.nombre = nombreTrim;
    if (datos.apellidos !== undefined) empleadoPatch.apellidos = trim(datos.apellidos);
    if (Object.keys(empleadoPatch).length > 0) {
      await admin.from("empleados").update(empleadoPatch).eq("id", empleadoId);
    }

    revalidatePath(`/rrhh/empleados/${empleadoId}`);
    revalidatePath("/rrhh/empleados");
    revalidatePath("/mi-panel/datos-personales");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error guardando perfil";
    console.error("[rrhh] guardarPerfilEmpleado:", msg);
    return { ok: false, error: msg };
  }
}
export async function getMiInformacionLaboral() {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("empleados")
      .select(`
        *,
        departamentos(nombre),
        puestos_trabajo(nombre)
      `)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    console.error("[rrhh] getMiInformacionLaboral:", err);
    return { ok: false, error: "Error al obtener info laboral" };
  }
}
