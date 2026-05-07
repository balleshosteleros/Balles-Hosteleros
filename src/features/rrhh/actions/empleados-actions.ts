"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { DatosPersonalesInput, DatosPersonalesCompletos } from "@/features/mi-panel/actions/datos-personales-actions";

const ROLES_ADMIN = ["admin", "director"] as const;

export type EstadoEmpleado = "Activo" | "Baja temporal" | "Baja definitiva";

const ESTADOS_BAJA: EstadoEmpleado[] = ["Baja temporal", "Baja definitiva"];

const FALLBACK_DEPARTAMENTOS = [
  "DIRECCIÓN", "SALA", "COCINA", "GERENCIA", "CAMAREROS",
  "CACHIMBEROS", "ARTISTAS", "MANTENIMIENTO", "RRPP", "ADMINISTRATIVO",
].map(nombre => ({ id: `mock-dep-${nombre.toLowerCase().replace(/\s+/g, "-")}`, nombre }));

export async function listEmpleados() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };

    const { data, error } = await supabase
      .from("empleados")
      .select(`*, departamentos(nombre)`)
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });

    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[rrhh] listEmpleados:", err);
    return { ok: false, data: [] };
  }
}

// Regla de negocio: todo empleado DEBE tener un usuario. createEmpleado crea
// el auth.user + profile + user_role + empleado en cascada. Devuelve la
// contraseña temporal para que el admin la entregue al empleado en su primer
// acceso (el form la muestra en pantalla y permite copiarla).
export async function createEmpleado(input: {
  nombre: string;
  apellidos?: string;
  departamentoId?: string;
  puesto?: string;
  emailEmpresa: string;
  emailPersonal?: string;
  telefono?: string;
}) {
  try {
    await requireAdminUser();
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const email = (input.emailEmpresa ?? "").trim().toLowerCase();
    if (!email) return { ok: false, error: "El email de empresa es obligatorio (será el login del empleado)." };

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
      return { ok: false, error: createErr?.message ?? "No se pudo crear el usuario" };
    }
    const newUserId = created.user.id;

    // 2. Completar profile (el trigger handle_new_user crea la fila base)
    await admin.from("profiles").update({
      empresa_id: empresaId,
      full_name: fullName,
      nombre: input.nombre,
      apellidos: input.apellidos ?? null,
      es_empleado: true,
      avatar_obligatorio: true,
    }).eq("id", newUserId);

    // 3. Asignar rol RBAC base
    await admin.from("user_roles").insert({ user_id: newUserId, role: "empleado" });

    // 4. Crear empleado vinculado
    const isRealId = (id?: string) => !!id && !id.startsWith("mock-");
    const { error: empErr } = await admin.from("empleados").insert({
      empresa_id: empresaId,
      user_id: newUserId,
      nombre: input.nombre,
      apellidos: input.apellidos ?? null,
      departamento_id: isRealId(input.departamentoId) ? input.departamentoId : null,
      puesto: input.puesto ?? null,
      email_empresa: email,
      email_personal: input.emailPersonal ?? null,
      telefono: input.telefono ?? null,
      fecha_alta: new Date().toISOString().slice(0, 10),
      estado: "Activo",
      tipo_jornada: "Completa",
      perfil_completado: false,
    });

    if (empErr) {
      // Rollback manual: el auth.user ya existe pero el empleado falló.
      // Como CASCADE en empleados.user_id_fkey borra el empleado al borrar
      // el profile, eliminamos el auth.user para limpiar todo.
      await admin.auth.admin.deleteUser(newUserId);
      return { ok: false, error: empErr.message };
    }

    revalidatePath("/rrhh/empleados");
    return { ok: true, tempPassword, email };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] createEmpleado:", msg);
    return { ok: false, error: msg };
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

/**
 * Verifica que el invocador tenga rol admin o director. Lanza error si no.
 * Devuelve el user para usos posteriores.
 */
async function requireAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const ok = (roles ?? []).some((r: { role: string }) =>
    (ROLES_ADMIN as readonly string[]).includes(r.role),
  );
  if (!ok) throw new Error("Sin permisos: solo admin o director pueden modificar empleados");
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

    return { ok: true, empleado: emp, datosPersonales };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error cargando empleado";
    console.error("[rrhh] getEmpleadoConPerfil:", msg);
    return { ok: false, error: msg, data: null };
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
    if (empErr) return { ok: false, error: empErr.message };
    if (!emp) return { ok: false, error: "Empleado no encontrado" };

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
    if (updErr) return { ok: false, error: updErr.message };

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
      .eq("profile_id", userId)
      .maybeSingle();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    console.error("[rrhh] getMiInformacionLaboral:", err);
    return { ok: false, error: "Error al obtener info laboral" };
  }
}
