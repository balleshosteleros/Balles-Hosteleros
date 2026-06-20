"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdminUser,
  requireRRHHAcceso,
  altaUsuarioEmpleado,
} from "@/features/rrhh/services/empleados-core";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/shared/lib/friendly-errors";
import {
  normalizarNombre,
  normalizarNombreOrNull,
} from "@/shared/lib/normalizar-nombre";
import type { DatosPersonalesInput, DatosPersonalesCompletos } from "@/features/mi-panel/actions/datos-personales-actions";
import type { SolicitudPersonal, SolicitudSubtipo, SolicitudTipo, SolicitudEstado } from "@/features/mi-panel/types";

export type EstadoEmpleado = "Activo" | "Inactivo";

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
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };
    await requireAdminUser({ empresaIds: [empresaId] });

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { ok: false, data: [], error: "Supabase admin no configurado." };
    }

    // Un empleado aparece en una empresa si:
    //   1) su empresa_id es esa empresa (empresa principal), o
    //   2) su user_id tiene acceso a esa empresa vía user_empresas (acceso secundario).
    // Devolvemos todos esos empleados con un flag `es_principal` para la UI.

    const { data: accesosUE } = await admin
      .from("usuario_empresas")
      .select("user_id")
      .eq("empresa_id", empresaId);
    const userIdsConAcceso = (accesosUE ?? []).map((r) => r.user_id as string);

    const filtro = userIdsConAcceso.length > 0
      ? `empresa_id.eq.${empresaId},user_id.in.(${userIdsConAcceso.join(",")})`
      : `empresa_id.eq.${empresaId}`;

    const { data, error } = await admin
      .from("empleados")
      .select(`*, departamentos(nombre, area)`)
      .or(filtro)
      .order("nombre", { ascending: true });

    if (error) throw error;

    // Áreas a las que pertenece cada usuario: se agregan las áreas de TODAS sus
    // fichas (una por empresa), porque un multiempresa puede ser operativo en una
    // y administrativo en otra y debe mostrar ambas.
    const areasPorUser: Record<string, Set<string>> = {};
    for (const e of data ?? []) {
      const uid = e.user_id as string | null;
      const area = (e.departamentos as { area?: string } | null)?.area;
      if (!uid || !area) continue;
      (areasPorUser[uid] ??= new Set<string>()).add(area);
    }

    // Cargar todas las empresas a las que cada empleado tiene acceso para enriquecer.
    const userIds = Array.from(new Set((data ?? []).map((e) => e.user_id as string).filter(Boolean)));
    let empresasPorUser: Record<string, Array<{ id: string; nombre: string }>> = {};
    if (userIds.length > 0) {
      const { data: rels } = await admin
        .from("usuario_empresas")
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

    // Nombres de los validadores (de trabajo y de ausencias) de cada empleado.
    const validadorIds = Array.from(
      new Set(
        (data ?? [])
          .flatMap((e) => [e.validador_trabajo_id, e.validador_ausencias_id])
          .filter((v): v is string => Boolean(v)),
      ),
    );
    let nombrePorEmpleadoId: Record<string, string> = {};
    if (validadorIds.length > 0) {
      const { data: vals } = await admin
        .from("empleados")
        .select("id, nombre, apellidos")
        .in("id", validadorIds);
      nombrePorEmpleadoId = (vals ?? []).reduce<Record<string, string>>((acc, v) => {
        acc[v.id as string] = `${(v.nombre as string) ?? ""} ${(v.apellidos as string | null) ?? ""}`.trim();
        return acc;
      }, {});
    }

    const enriched = [...porUser.values(), ...sinUser].map((e) => ({
      ...e,
      es_principal: e.empresa_id === empresaId,
      empresas_acceso: empresasPorUser[e.user_id as string] ?? [],
      areas: e.user_id
        ? Array.from(areasPorUser[e.user_id as string] ?? [])
        : [(e.departamentos as { area?: string } | null)?.area].filter(
            (a): a is string => Boolean(a),
          ),
      validador_trabajo_nombre: e.validador_trabajo_id
        ? nombrePorEmpleadoId[e.validador_trabajo_id as string] ?? null
        : null,
      validador_ausencias_nombre: e.validador_ausencias_id
        ? nombrePorEmpleadoId[e.validador_ausencias_id as string] ?? null
        : null,
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

export type EmpleadoActivoArea = "administrativa" | "operativa";

export interface EmpleadoActivo {
  empleadoId: string; // empleados.id (uuid real)
  userId: string | null;
  nombre: string;
  apellidos: string;
  nombreCompleto: string;
  departamento: string | null;
  area: EmpleadoActivoArea;
  puesto: string | null;
  avatarUrl: string | null;
  estado: string; // ciclo de vida (la action filtra "Activo")
}

/**
 * Fuente ÚNICA de empleados activos de la empresa activa (OLA2-01).
 *
 * Reemplaza al antiguo getter mock de empleados de `data/rrhh.ts`. Es una
 * generalización de `listEmpleadosParaPagos`: resuelve la empresa activa
 * server-side vía `getAppContext()`, o usa el UUID (dbId) que se le pase
 * (NUNCA el slug), filtrando por
 * `empresa_id` (uuid) respetando RLS, aplica el mismo OR (empresa principal +
 * acceso secundario vía `user_empresas`), deduplica por `user_id` y deriva el
 * área operativa/administrativa del departamento. Amplía el shape para cubrir a
 * los consumidores de RRHH (departamento, avatar, puesto, estado).
 */
export async function getEmpleadosActivos(
  empresaDbId?: string,
): Promise<{ ok: boolean; data: EmpleadoActivo[] }> {
  try {
    const { supabase, empresaId: empresaActivaId } = await getAppContext();
    // Preferimos el UUID explícito del cliente (empresaActual.dbId) para evitar
    // la carrera con la cookie de empresa activa al cambiar de empresa; si no se
    // pasa, caemos a la empresa activa resuelta server-side. RLS protege en
    // ambos casos (un dbId fuera de las empresas del usuario devuelve []).
    // Tolerante al slug: si llega un identificador no-UUID lo resolvemos contra
    // empresas.slug (algunos clientes solo disponen del slug, p.ej. Horarios).
    let empresaId = empresaDbId ?? empresaActivaId;
    if (empresaDbId && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(empresaDbId)) {
      const { data: emp } = await supabase
        .from("empresas")
        .select("id")
        .eq("slug", empresaDbId)
        .maybeSingle();
      empresaId = (emp?.id as string | undefined) ?? empresaActivaId;
    }
    if (!empresaId) return { ok: false, data: [] };

    const { data: accesosUE } = await supabase
      .from("usuario_empresas")
      .select("user_id")
      .eq("empresa_id", empresaId);
    const userIdsConAcceso = (accesosUE ?? []).map((r) => r.user_id as string);

    const filtro = userIdsConAcceso.length > 0
      ? `empresa_id.eq.${empresaId},user_id.in.(${userIdsConAcceso.join(",")})`
      : `empresa_id.eq.${empresaId}`;

    const { data, error } = await supabase
      .from("empleados")
      .select("id, nombre, apellidos, puesto, estado, user_id, empresa_id, avatar_url, departamentos(nombre, area)")
      .or(filtro)
      .eq("estado", "Activo")
      .order("nombre", { ascending: true });

    if (error) throw error;

    // Dedup por user_id (mismo patrón que listEmpleados/listEmpleadosParaPagos):
    // el OR puede traer 2 veces a un usuario multiempresa; preferimos su ficha
    // en la empresa activa.
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

    const rows: EmpleadoActivo[] = [...porUser.values(), ...sinUser].map((e) => {
      const deptoRel = e.departamentos as
        | { nombre?: string | null; area?: string | null }
        | Array<{ nombre?: string | null; area?: string | null }>
        | null;
      const deptoObj = Array.isArray(deptoRel) ? deptoRel[0] : deptoRel;
      const nombre = (e.nombre as string) ?? "";
      const apellidos = (e.apellidos as string | null) ?? "";
      const area: EmpleadoActivoArea =
        deptoObj?.area === "OPERATIVA" ? "operativa" : "administrativa";
      return {
        empleadoId: e.id as string,
        userId: (e.user_id as string | null) ?? null,
        nombre,
        apellidos,
        nombreCompleto: `${nombre} ${apellidos}`.trim(),
        departamento: (deptoObj?.nombre as string | null) ?? null,
        area,
        puesto: (e.puesto as string | null) ?? null,
        avatarUrl: (e.avatar_url as string | null) ?? null,
        estado: (e.estado as string) ?? "Activo",
      };
    });
    rows.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, "es"));

    return { ok: true, data: rows };
  } catch (err) {
    console.error("[rrhh] getEmpleadosActivos:", err);
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
  // Locales donde el empleado podrá fichar (de cualquiera de sus empresas).
  // Mínimo uno; se guardan en la tabla puente empleado_locales.
  localIds?: string[];
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

    const nombreNorm = normalizarNombre(input.nombre);
    const apellidosNorm = normalizarNombreOrNull(input.apellidos);
    const fullName = `${nombreNorm} ${apellidosNorm ?? ""}`.trim();
    // Locales donde podrá fichar: al menos uno (de cualquiera de sus empresas).
    const isRealId = (id?: string) => !!id && !id.startsWith("mock-");
    const localIds = Array.from(new Set((input.localIds ?? []).filter(Boolean)));
    if (localIds.length === 0) {
      return { ok: false, error: "Asigna al menos un local donde el empleado pueda fichar." };
    }

    // Alta en cascada (auth.user → profile → roles → user_empresas → empleado),
    // núcleo canónico compartido con la promoción de candidatos.
    const alta = await altaUsuarioEmpleado({
      admin,
      loginEmail: email,
      emailPersonal,
      emailEmpresa,
      fullName,
      nombre: nombreNorm,
      apellidos: apellidosNorm,
      telefono: input.telefono ?? null,
      departamentoId: isRealId(input.departamentoId) ? input.departamentoId : null,
      puesto: input.puesto ?? null,
      empresaPrincipalId,
      empresasAcceso,
      localIds,
    });
    if (!alta.ok) {
      return { ok: false, error: alta.error };
    }

    revalidatePath("/rrhh/empleados");
    return { ok: true, tempPassword: alta.tempPassword, email, empleadoId: alta.empleadoId };
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
        error: "No se puede quitar del acceso la empresa donde el empleado está dado de alta.",
      };
    }

    await requireAdminUser({ empresaIds });

    let admin;
    try { admin = createAdminClient(); }
    catch { return { ok: false, error: "Supabase admin no configurado." }; }

    const { error: deleteErr } = await admin
      .from("usuario_empresas")
      .delete()
      .eq("user_id", empleado.user_id);
    if (deleteErr) throw deleteErr;

    const rows = empresaIds.map((empresa_id) => ({
      user_id: empleado.user_id,
      empresa_id,
    }));
    const { error: insertErr } = await admin
      .from("usuario_empresas")
      .insert(rows);
    if (insertErr) throw insertErr;

    // Retirada "unida": al quitar una empresa, se retiran los locales de esa
    // empresa del conjunto donde el empleado puede fichar.
    const { data: asignados } = await admin
      .from("empleado_locales")
      .select("local_id, locales!inner(id, empresa_id)")
      .eq("empleado_id", input.empleadoId);
    const aRetirar = (asignados ?? [])
      .map((r) => (r as unknown as { locales: { id: string; empresa_id: string } }).locales)
      .filter((l) => l && !empresaIds.includes(l.empresa_id))
      .map((l) => l.id);
    if (aRetirar.length > 0) {
      await admin
        .from("empleado_locales")
        .delete()
        .eq("empleado_id", input.empleadoId)
        .in("local_id", aRetirar);
      // Recalcular el local por defecto si el actual quedó fuera del conjunto.
      const { data: emp } = await admin
        .from("empleados")
        .select("local_id")
        .eq("id", input.empleadoId)
        .maybeSingle();
      if (emp && aRetirar.includes(emp.local_id as string)) {
        const { data: resto } = await admin
          .from("empleado_locales")
          .select("local_id, locales!inner(empresa_id)")
          .eq("empleado_id", input.empleadoId);
        const filas = (resto ?? []).map(
          (r) => (r as unknown as { local_id: string; locales: { empresa_id: string } }),
        );
        const defecto =
          filas.find((f) => f.locales.empresa_id === empleado.empresa_id)?.local_id ??
          filas[0]?.local_id ??
          null;
        await admin.from("empleados").update({ local_id: defecto }).eq("id", input.empleadoId);
      }
    }

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
    if (updates.nombre !== undefined) patch.nombre = normalizarNombre(updates.nombre);
    if (updates.apellidos !== undefined)
      patch.apellidos = normalizarNombreOrNull(updates.apellidos);
    if (updates.departamentoId !== undefined) patch.departamento_id = updates.departamentoId;
    if (updates.puesto !== undefined) patch.puesto = updates.puesto;
    if (updates.emailEmpresa !== undefined) patch.email_empresa = updates.emailEmpresa;
    if (updates.emailPersonal !== undefined) patch.email_personal = updates.emailPersonal;
    if (updates.telefono !== undefined) patch.telefono = updates.telefono;

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
 *   - Para 'Inactivo' es obligatorio `fechaBaja`.
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
    if (input.estado !== "Activo" && !input.fechaBaja) {
      return {
        ok: false,
        error: "La fecha de baja es obligatoria al desactivar a un empleado.",
      };
    }

    const { supabase } = await getAppContext();
    // La fecha de baja queda siempre reflejada: al reactivar (Activo) NO se borra,
    // se conserva como historico de la ultima baja.
    const patch: Record<string, unknown> = {
      estado: input.estado,
      fecha_baja: input.fechaBaja ?? null,
    };

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

    // ─── REGLA DURA: no se borra un empleado YA GRABADO ────────────────────
    // Un empleado con datos (perfil completado, fichajes o turnos) NO se puede
    // borrar nunca — solo marcar Inactivo (registro legal). De momento el
    // borrado queda PROHIBIDO para empleados grabados; el ajuste de RRHH que lo
    // refleja está bloqueado (no editable). Solo se permite descartar un alta
    // en borrador (sin perfil completado y sin datos).
    const { data: emp } = await supabase
      .from("empleados")
      .select("perfil_completado, user_id")
      .eq("id", id)
      .maybeSingle();

    let tieneDatos = Boolean(emp?.perfil_completado);
    if (!tieneDatos && emp?.user_id) {
      const [{ count: nFichajes }, { count: nTurnos }, { count: nPatrones }] =
        await Promise.all([
          supabase
            .from("fichajes")
            .select("id", { count: "exact", head: true })
            .eq("empleado_id", emp.user_id as string),
          supabase
            .from("rrhh_turno_empleados")
            .select("turno_id", { count: "exact", head: true })
            .eq("empleado_id", id),
          supabase
            .from("rrhh_patron_empleados")
            .select("patron_id", { count: "exact", head: true })
            .eq("empleado_id", id),
        ]);
      tieneDatos =
        (nFichajes ?? 0) > 0 || (nTurnos ?? 0) > 0 || (nPatrones ?? 0) > 0;
    }

    if (tieneDatos) {
      return {
        ok: false,
        error:
          "No se puede borrar un empleado ya grabado (tiene horarios, turnos o fichajes). Márcalo como Inactivo en su lugar.",
      };
    }

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

/**
 * Datos que necesita el formulario de "Copiar empleado" para la empresa destino:
 * el estado del emparejado por NOMBRE (departamento/puesto) y las listas para
 * elegir lo obligatorio (calendario y local), todo de la empresa destino.
 */
export async function getDatosCopiaEmpleado(input: {
  empleadoId: string;
  empresaDestinoId: string;
}) {
  try {
    const { supabase } = await getAppContext();

    const { data: origen } = await supabase
      .from("empleados")
      .select("id, user_id, empresa_id, departamento_id")
      .eq("id", input.empleadoId)
      .maybeSingle();
    if (!origen?.user_id) return { ok: false, error: "Empleado no encontrado." };

    // Quien copia: con RRHH (editar) + acceso real a la empresa destino.
    await requireRRHHAcceso([input.empresaDestinoId]);

    let admin;
    try { admin = createAdminClient(); }
    catch { return { ok: false, error: "Supabase admin no configurado." }; }

    const { data: yaExiste } = await admin
      .from("empleados").select("id")
      .eq("user_id", origen.user_id).eq("empresa_id", input.empresaDestinoId).maybeSingle();

    // Departamento de origen → ¿existe por nombre en destino?
    let depNombre: string | null = null;
    let depExiste = false;
    if (origen.departamento_id) {
      const { data: depO } = await admin.from("departamentos").select("nombre").eq("id", origen.departamento_id as string).maybeSingle();
      depNombre = (depO?.nombre as string | undefined) ?? null;
      if (depNombre) {
        const { data: depD } = await admin.from("departamentos").select("id").eq("empresa_id", input.empresaDestinoId).eq("nombre", depNombre).maybeSingle();
        depExiste = Boolean(depD?.id);
      }
    }

    // Puestos del empleado → ¿existen por nombre en destino?
    const { data: epO } = await admin
      .from("empleado_puestos")
      .select("es_principal, puestos!inner(nombre)")
      .eq("empleado_id", input.empleadoId);
    const puestosOrigen = (epO ?? []).map((r) => {
      const row = r as unknown as { es_principal: boolean; puestos: { nombre: string } };
      return { nombre: row.puestos?.nombre, esPrincipal: Boolean(row.es_principal) };
    }).filter((p) => p.nombre);
    let puestosDest = new Set<string>();
    if (puestosOrigen.length) {
      const { data: pD } = await admin.from("puestos").select("nombre").eq("empresa_id", input.empresaDestinoId).in("nombre", puestosOrigen.map((p) => p.nombre as string));
      puestosDest = new Set((pD ?? []).map((p) => p.nombre as string));
    }
    const puestos = puestosOrigen.map((p) => ({ nombre: p.nombre as string, esPrincipal: p.esPrincipal, existe: puestosDest.has(p.nombre as string) }));

    const [{ data: cals }, { data: locs }] = await Promise.all([
      admin.from("rrhh_calendarios_vacaciones").select("id, nombre").eq("empresa_id", input.empresaDestinoId).order("nombre"),
      admin.from("locales").select("id, nombre").eq("empresa_id", input.empresaDestinoId).order("nombre"),
    ]);

    const motivos: string[] = [];
    if (yaExiste) motivos.push("El empleado ya tiene ficha en esa empresa.");
    if (origen.departamento_id && !depExiste) motivos.push(`El departamento "${depNombre}" no existe en la empresa destino.`);
    const faltaPuesto = puestos.find((p) => p.esPrincipal && !p.existe);
    if (faltaPuesto) motivos.push(`El puesto "${faltaPuesto.nombre}" no existe en la empresa destino.`);

    return {
      ok: true,
      data: {
        bloqueado: motivos.length > 0,
        motivos,
        departamento: depNombre ? { nombre: depNombre, existe: depExiste } : null,
        puestos,
        calendarios: (cals ?? []) as { id: string; nombre: string }[],
        locales: (locs ?? []) as { id: string; nombre: string }[],
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] getDatosCopiaEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Copia un empleado a OTRA empresa: crea su ficha (mismo `user_id`, sin crear
 * usuario nuevo) reutilizando los DATOS PERSONALES + teletrabajo, emparejando
 * departamento y puesto POR NOMBRE (bloquea si no existen), y rellenando lo
 * obligatorio de la empresa destino: email de empresa, calendario, local(es) y
 * nº de empleado correlativo. NO copia turnos (se asignan allí) ni el histórico.
 */
export async function copiarEmpleadoAEmpresa(input: {
  empleadoId: string;
  empresaDestinoId: string;
  emailEmpresa: string;
  calendarioId: string;
  localIds: string[];
}) {
  try {
    const { supabase } = await getAppContext();

    const emailEmpresa = (input.emailEmpresa ?? "").trim();
    const localIds = Array.from(new Set((input.localIds ?? []).filter(Boolean)));
    if (!emailEmpresa) return { ok: false, error: "Indica el email de empresa." };
    if (!input.calendarioId) return { ok: false, error: "Selecciona un calendario de vacaciones." };
    if (localIds.length === 0) return { ok: false, error: "Selecciona al menos un local de fichaje." };

    const { data: origen, error: origenErr } = await supabase
      .from("empleados").select("*").eq("id", input.empleadoId).maybeSingle();
    if (origenErr) throw origenErr;
    if (!origen?.user_id) return { ok: false, error: "Empleado no encontrado o sin usuario vinculado." };
    if (input.empresaDestinoId === origen.empresa_id) return { ok: false, error: "El empleado ya está en esa empresa." };

    // Quien copia: con RRHH (editar) + acceso real a la empresa destino.
    await requireRRHHAcceso([input.empresaDestinoId]);
    let admin;
    try { admin = createAdminClient(); }
    catch { return { ok: false, error: "Supabase admin no configurado." }; }

    const { data: yaExiste } = await admin.from("empleados").select("id")
      .eq("user_id", origen.user_id).eq("empresa_id", input.empresaDestinoId).maybeSingle();
    if (yaExiste) return { ok: false, error: "El empleado ya tiene ficha en esa empresa." };

    const o = origen as Record<string, unknown>;

    // Departamento por NOMBRE en destino (bloquea si no existe).
    let departamentoDestId: string | null = null;
    if (o.departamento_id) {
      const { data: depO } = await admin.from("departamentos").select("nombre").eq("id", o.departamento_id as string).maybeSingle();
      if (depO?.nombre) {
        const { data: depD } = await admin.from("departamentos").select("id").eq("empresa_id", input.empresaDestinoId).eq("nombre", depO.nombre).maybeSingle();
        if (!depD?.id) return { ok: false, error: `El departamento "${depO.nombre}" no existe en la empresa destino. Créalo allí antes de copiar.` };
        departamentoDestId = depD.id as string;
      }
    }

    // Calendario y locales deben ser de la empresa destino.
    const { data: calOk } = await admin.from("rrhh_calendarios_vacaciones").select("id").eq("id", input.calendarioId).eq("empresa_id", input.empresaDestinoId).maybeSingle();
    if (!calOk) return { ok: false, error: "El calendario elegido no es de la empresa destino." };
    const { data: locsOk } = await admin.from("locales").select("id").eq("empresa_id", input.empresaDestinoId).in("id", localIds);
    if ((locsOk ?? []).length !== localIds.length) return { ok: false, error: "Algún local elegido no es de la empresa destino." };

    // Nº de empleado correlativo al último de la empresa destino.
    const { data: nums } = await admin.from("empleados").select("numero_empleado").eq("empresa_id", input.empresaDestinoId);
    let maxN = 0;
    for (const r of nums ?? []) {
      const n = parseInt(String((r as { numero_empleado: string | null }).numero_empleado ?? "").replace(/\D/g, ""), 10);
      if (Number.isFinite(n) && n > maxN) maxN = n;
    }
    const numeroEmpleado = String(maxN + 1);

    const nuevo = {
      empresa_id: input.empresaDestinoId,
      user_id: origen.user_id,
      nombre: o.nombre,
      apellidos: o.apellidos ?? null,
      dni_nie: o.dni_nie ?? null,
      fecha_nacimiento: o.fecha_nacimiento ?? null,
      nacionalidad: o.nacionalidad ?? null,
      telefono: o.telefono ?? null,
      email_personal: o.email_personal ?? null,
      email_empresa: emailEmpresa,
      direccion: o.direccion ?? null,
      numero_ss: o.numero_ss ?? null,
      iban: o.iban ?? null,
      dni_archivo_url: o.dni_archivo_url ?? null,
      contacto_emergencia_nombre: o.contacto_emergencia_nombre ?? null,
      contacto_emergencia_telefono: o.contacto_emergencia_telefono ?? null,
      contacto_emergencia_relacion: o.contacto_emergencia_relacion ?? null,
      talla_uniforme: o.talla_uniforme ?? null,
      alergias_medicas: o.alergias_medicas ?? null,
      avatar_url: o.avatar_url ?? null,
      permite_teletrabajo: Boolean(o.permite_teletrabajo),
      tipo_jornada: o.tipo_jornada ?? "Completa",
      departamento_id: departamentoDestId,
      calendario_vacaciones_id: input.calendarioId,
      local_id: localIds[0],
      numero_empleado: numeroEmpleado,
      estado: "Activo", // aunque en origen esté Inactivo, la copia entra Activa.
      perfil_completado: false, // pendiente de asignar turnos/validadores en destino.
    };

    const { data: creado, error: insErr } = await admin.from("empleados").insert(nuevo).select("id").single();
    if (insErr) throw insErr;
    const nuevoId = creado.id as string;

    // Puestos por NOMBRE (los que existan en destino).
    const { data: epO } = await admin.from("empleado_puestos").select("es_principal, puestos!inner(nombre)").eq("empleado_id", input.empleadoId);
    const puestosOrigen = (epO ?? []).map((r) => {
      const row = r as unknown as { es_principal: boolean; puestos: { nombre: string } };
      return { nombre: row.puestos?.nombre, esPrincipal: Boolean(row.es_principal) };
    }).filter((p) => p.nombre);
    if (puestosOrigen.length) {
      const { data: pD } = await admin.from("puestos").select("id, nombre").eq("empresa_id", input.empresaDestinoId).in("nombre", puestosOrigen.map((p) => p.nombre as string));
      const idPorNombre = new Map((pD ?? []).map((p) => [p.nombre as string, p.id as string]));
      const hoy = new Date().toISOString().split("T")[0];
      const filas = puestosOrigen
        .filter((p) => idPorNombre.has(p.nombre as string))
        .map((p) => ({ empleado_id: nuevoId, puesto_id: idPorNombre.get(p.nombre as string), es_principal: p.esPrincipal, vigente_desde: hoy }));
      if (filas.length) await admin.from("empleado_puestos").insert(filas);
    }

    // Locales de fichaje elegidos.
    await admin.from("empleado_locales").insert(localIds.map((local_id) => ({ empleado_id: nuevoId, local_id })));

    // Acceso a la empresa destino.
    const { data: link } = await admin.from("usuario_empresas").select("user_id").eq("user_id", origen.user_id).eq("empresa_id", input.empresaDestinoId).maybeSingle();
    if (!link) {
      const { error: linkErr } = await admin.from("usuario_empresas").insert({ user_id: origen.user_id, empresa_id: input.empresaDestinoId });
      if (linkErr) throw linkErr;
    }

    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${input.empleadoId}`);
    return { ok: true, data: { empleadoId: nuevoId } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] copiarEmpleadoAEmpresa:", msg);
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
        .from("usuarios")
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
        .from("usuario_empresas")
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
      nombre: normalizarNombreOrNull(datos.nombre),
      apellidos: normalizarNombreOrNull(datos.apellidos),
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
      emergencia_nombre: normalizarNombreOrNull(datos.emergencia_nombre),
      emergencia_relacion: trim(datos.emergencia_relacion),
      emergencia_telefono: trim(datos.emergencia_telefono),
      talla_camiseta: trim(datos.talla_camiseta),
      talla_pantalon: trim(datos.talla_pantalon),
      datos_personales_actualizado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: updErr } = await admin
      .from("usuarios")
      .update(payload)
      .eq("id", emp.user_id);
    if (updErr) return { ok: false, error: friendlyError(updErr) };

    // También sincronizamos nombre/apellidos en empleados para que la lista
    // de RRHH muestre los cambios sin tener que mirar el join. Sólo actualizamos
    // los campos que llegaron en el payload — nombre es NOT NULL en empleados.
    const empleadoPatch: Record<string, unknown> = {};
    const nombreNorm = normalizarNombre(datos.nombre);
    if (nombreNorm) empleadoPatch.nombre = nombreNorm;
    if (datos.apellidos !== undefined)
      empleadoPatch.apellidos = normalizarNombreOrNull(datos.apellidos);
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
