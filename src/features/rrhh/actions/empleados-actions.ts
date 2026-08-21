"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdminUser,
  requireEmpleadosLectura,
  requireRRHHAcceso,
  altaUsuarioEmpleado,
  sincronizarLoginEmailEmpleado,
  resolverLoginEmail,
  buscarEmpleadoDuplicado,
  mensajeDuplicado,
} from "@/features/rrhh/services/empleados-core";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/shared/lib/friendly-errors";
import {
  normalizarNombre,
  normalizarNombreOrNull,
} from "@/shared/lib/normalizar-nombre";
import { resolverHorarioResumen } from "@/features/rrhh/utils/horario-empleado";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
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
    // Lectura, no modificación: basta con permiso RRHH (ver) sobre la empresa
    // activa. Exigir DIRECTOR aquí dejaba la tabla vacía a roles como GERENCIA.
    await requireEmpleadosLectura(empresaId);

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
    // Avatar de sesión (usuarios): fuente alternativa de la foto cuando el
    // empleado subió su foto por su perfil y no quedó copiada en empleados.avatar_url.
    let avatarPorUser: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const { data: avUsers } = await admin
        .from("usuarios")
        .select("id, avatar_url")
        .in("id", userIds);
      avatarPorUser = (avUsers ?? []).reduce<Record<string, string | null>>((acc, u) => {
        acc[u.id as string] = (u.avatar_url as string | null) ?? null;
        return acc;
      }, {});
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
      // Orden alfabético estable: sin esto, Postgres devuelve las filas en orden
      // físico (por inserción), que varía por usuario → el chip empezaría por
      // HABANA en unos empleados y por BACANAL en otros. Ordenar garantiza que
      // todas las filas muestren las empresas en el mismo orden.
      for (const uid of Object.keys(empresasPorUser)) {
        empresasPorUser[uid].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      }
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

    // Nombre del departamento que valida las solicitudes de cada empleado.
    const validadorIds = Array.from(
      new Set(
        (data ?? [])
          .map((e) => e.validador_departamento_id)
          .filter((v): v is string => Boolean(v)),
      ),
    );
    let nombrePorEmpleadoId: Record<string, string> = {};
    if (validadorIds.length > 0) {
      const { data: vals } = await admin
        .from("departamentos")
        .select("id, nombre")
        .in("id", validadorIds);
      nombrePorEmpleadoId = (vals ?? []).reduce<Record<string, string>>((acc, v) => {
        acc[v.id as string] = (v.nombre as string) ?? "";
        return acc;
      }, {});
    }

    // Resumen de horario (tipo + horas hoy) por empleado, en pocas queries.
    const empleadoIds = Array.from(
      new Set((data ?? []).map((e) => e.id as string).filter(Boolean)),
    );
    // "Hoy" en la zona horaria de la empresa (PRP-069).
    const tzEmp = await getZonaHorariaEmpresa(admin, empresaId);
    const { fecha: hoyISO } = ahoraEnZona(tzEmp);
    const horarioPorEmpleado = await resolverHorarioResumen(
      admin,
      empresaId,
      empleadoIds,
      hoyISO,
    );

    // Puesto principal por empleado (fuente única empleado_puestos; se prefiere
    // el marcado es_principal, con la columna puesto_nombre como respaldo).
    const puestoPorEmpleado: Record<string, string> = {};
    if (empleadoIds.length > 0) {
      const { data: eps } = await admin
        .from("empleado_puestos")
        .select("empleado_id, es_principal, puesto_nombre, puestos(nombre)")
        .in("empleado_id", empleadoIds);
      for (const r of eps ?? []) {
        const row = r as unknown as {
          empleado_id: string;
          es_principal: boolean;
          puesto_nombre: string | null;
          puestos: { nombre?: string | null } | Array<{ nombre?: string | null }> | null;
        };
        const puestoRel = Array.isArray(row.puestos) ? row.puestos[0] : row.puestos;
        const nombrePuesto = puestoRel?.nombre ?? row.puesto_nombre ?? null;
        if (!nombrePuesto) continue;
        if (row.es_principal || !puestoPorEmpleado[row.empleado_id]) {
          puestoPorEmpleado[row.empleado_id] = nombrePuesto;
        }
      }
    }

    const enriched = [...porUser.values(), ...sinUser].map((e) => ({
      ...e,
      es_principal: e.empresa_id === empresaId,
      puesto: puestoPorEmpleado[e.id as string] ?? null,
      empresas_acceso: empresasPorUser[e.user_id as string] ?? [],
      // Foto del empleado: prioriza la copiada en empleados.avatar_url; si no,
      // usa el avatar de sesión (usuarios) como fallback (regla doble fuente).
      avatar_url: (e.avatar_url as string | null) ?? avatarPorUser[e.user_id as string] ?? null,
      areas: e.user_id
        ? Array.from(areasPorUser[e.user_id as string] ?? [])
        : [(e.departamentos as { area?: string } | null)?.area].filter(
            (a): a is string => Boolean(a),
          ),
      validador_departamento_nombre: e.validador_departamento_id
        ? nombrePorEmpleadoId[e.validador_departamento_id as string] ?? null
        : null,
      horario_resumen: horarioPorEmpleado.get(e.id as string) ?? null,
    }));
    enriched.sort((a, b) =>
      String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""), "es"),
    );

    return { ok: true, data: enriched };
  } catch (err) {
    console.error("[rrhh] listEmpleados:", err);
    // Sin el motivo, la vista pintaba "No hay empleados todavía" ante un fallo
    // de permisos: parecía una empresa vacía en vez de un acceso denegado.
    return { ok: false, data: [], error: friendlyError(err) };
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

    // Puesto principal desde la fuente única (tabla puente empleado_puestos).
    // La columna legacy empleados.puesto está vacía en muchas fichas y, cuando
    // trae algo, suele ser el nombre del departamento, no el puesto real. Por eso
    // resolvemos el puesto principal aquí y solo caemos a la columna como fallback.
    const empleadoIdsActivos = Array.from(
      new Set((data ?? []).map((e) => e.id as string).filter(Boolean)),
    );
    const puestoPrincipalPorEmpleado: Record<string, string> = {};
    if (empleadoIdsActivos.length > 0) {
      const { data: eps } = await supabase
        .from("empleado_puestos")
        .select("empleado_id, es_principal, puesto_nombre, puestos(nombre)")
        .in("empleado_id", empleadoIdsActivos);
      for (const r of eps ?? []) {
        const row = r as unknown as {
          empleado_id: string;
          es_principal: boolean;
          puesto_nombre: string | null;
          puestos: { nombre?: string | null } | Array<{ nombre?: string | null }> | null;
        };
        const puestoRel = Array.isArray(row.puestos) ? row.puestos[0] : row.puestos;
        const nombrePuesto = puestoRel?.nombre ?? row.puesto_nombre ?? null;
        if (!nombrePuesto) continue;
        // Preferimos el principal; si aún no hay ninguno guardado para este
        // empleado, tomamos el primero como respaldo.
        if (row.es_principal || !puestoPrincipalPorEmpleado[row.empleado_id]) {
          puestoPrincipalPorEmpleado[row.empleado_id] = nombrePuesto;
        }
      }
    }

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
        puesto:
          puestoPrincipalPorEmpleado[e.id as string] ??
          (e.puesto as string | null) ??
          null,
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
  /** DNI/NIE/pasaporte. Se usa para el control anti-duplicados de la empresa. */
  dniNie?: string;
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
    // Regla canónica única: login = empresa ?? personal (nunca null aquí, porque
    // emailPersonal es obligatorio).
    const email = resolverLoginEmail({ emailEmpresa, emailPersonal })!;

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
      dniNie: input.dniNie ?? null,
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

    // Reflejo multiempresa: los datos de IDENTIDAD de la persona (nombre,
    // apellidos, correos, teléfono) son de la persona, no de la relación con una
    // empresa concreta, por lo que deben propagarse a TODAS las fichas-espejo del
    // mismo empleado (mismo user_id). En cambio, departamento_id y puesto son
    // propios de cada empresa y NUNCA se propagan (si se propagaran, un director
    // multiempresa acabaría con el departamento de otra empresa — el bug que hacía
    // aparecer a un empleado en dos áreas a la vez).
    // `email_empresa` NO va aquí a propósito: es el buzón de trabajo DE ESA
    // empresa (direccion.grupobacanal@ vs direccion.grupohabana@), no un dato
    // de la persona. Propagándolo, editar el correo en una empresa machacaba
    // el de la otra y las dos fichas acababan con el mismo buzón.
    const patchIdentidad: Record<string, unknown> = {};
    for (const campo of ["nombre", "apellidos", "email_personal", "telefono"]) {
      if (campo in patch) patchIdentidad[campo] = patch[campo];
    }
    if (Object.keys(patchIdentidad).length > 0) {
      try {
        const { data: ficha } = await supabase
          .from("empleados")
          .select("user_id")
          .eq("id", id)
          .maybeSingle();
        const uid = ficha?.user_id as string | null;
        if (uid) {
          const admin = createAdminClient();
          await admin
            .from("empleados")
            .update(patchIdentidad)
            .eq("user_id", uid)
            .neq("id", id);
        }
      } catch (e) {
        // No rompemos el guardado principal si falla el reflejo a las espejo.
        console.error("[rrhh] updateEmpleado reflejo multiempresa:", e);
      }
    }

    // Si se han tocado los correos, resincronizar el login (auth.users) con la
    // regla canónica (empresa ?? personal). Solo cambia el identificador de
    // acceso; la contraseña se conserva y se avisa in-app al empleado.
    if (updates.emailEmpresa !== undefined || updates.emailPersonal !== undefined) {
      try {
        const { data: emp } = await supabase
          .from("empleados")
          .select("email_empresa, email_personal")
          .eq("id", id)
          .maybeSingle();
        const admin = createAdminClient();
        const sync = await sincronizarLoginEmailEmpleado({
          admin,
          empleadoId: id,
          emailEmpresa: emp?.email_empresa ?? null,
          emailPersonal: emp?.email_personal ?? null,
        });
        if (!sync.ok) {
          // No revertimos la ficha: informamos del fallo de sincronización.
          console.error("[rrhh] updateEmpleado sync login:", sync.error);
          revalidatePath("/rrhh/empleados");
          revalidatePath(`/rrhh/empleados/${id}`);
          return {
            ok: true,
            avisoLogin:
              "Los datos se guardaron, pero no se pudo actualizar el correo de acceso: " +
              sync.error,
          };
        }
        if (sync.cambiado) {
          revalidatePath("/rrhh/empleados");
          revalidatePath(`/rrhh/empleados/${id}`);
          return {
            ok: true,
            loginActualizado: { anterior: sync.anterior, nuevo: sync.nuevo },
          };
        }
      } catch (e) {
        console.error("[rrhh] updateEmpleado sync login (excepción):", e);
      }
    }

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
 *   - Para 'Activo' es obligatoria `fechaAlta`.
 *
 * Ambas fechas son obligatorias porque este cambio es MANUAL y se salta el flujo
 * de contratación de reclutamiento: sin fecha efectiva no hay forma de saber
 * desde cuándo cuenta el alta o la baja a efectos de nóminas y gestoría. Todo
 * movimiento queda registrado en `empleado_estado_historial`, y en las altas se
 * guarda además la lista de pasos del flujo que NO se han ejecutado.
 *
 * Al guardar, el trigger `empleados_sync_estado_acceso` actualiza
 * automáticamente `usuarios.estado_acceso` (Activo/Inactivo) si el empleado
 * tiene cuenta de portal vinculada.
 *
 * Al ACTIVAR se restaura además su fila en `usuario_empresas` para la empresa de
 * esta ficha. Sin eso, reactivar a alguien desvinculado con
 * `quitarEmpleadoDeEmpresa` lo dejaba Activo pero sin ver la empresa en el
 * selector ni pasar las RLS. Los locales de fichaje no se recuperan (se borran
 * al desvincular): hay que volver a marcarlos en la ficha.
 */
export async function setEmpleadoEstado(input: {
  id: string;
  estado: EstadoEmpleado;
  fechaBaja?: string | null;
  fechaAlta?: string | null;
  motivo?: string | null;
}) {
  try {
    if (input.estado !== "Activo" && !input.fechaBaja) {
      return {
        ok: false,
        error: "La fecha de baja es obligatoria al desactivar a un empleado.",
      };
    }
    if (input.estado === "Activo" && !input.fechaAlta) {
      return {
        ok: false,
        error: "La fecha de alta es obligatoria al activar a un empleado.",
      };
    }

    const { supabase } = await getAppContext();

    // Estado previo: hace falta para saber si esto es un movimiento real (y de
    // qué tipo) o solo un reguardado del mismo estado, que no debe ensuciar el
    // historial con una línea nueva. `user_id` y `empresa_id` se leen aquí para
    // poder restaurar la pertenencia a la empresa al reactivar (ver más abajo).
    const { data: previo } = await supabase
      .from("empleados")
      .select("estado, fecha_baja, user_id, empresa_id")
      .eq("id", input.id)
      .maybeSingle();
    const estadoAnterior = (previo?.estado as string | null) ?? null;
    const huboCambio = estadoAnterior !== input.estado;

    const patch: Record<string, unknown> = { estado: input.estado };
    if (input.estado === "Activo") {
      // Reactivación: la fecha de alta pasa a ser la nueva incorporación y se
      // limpia la fecha de baja. Dejarla puesta creaba un Activo con fecha de
      // baja en el pasado, que descuadraba los KPIs de auditoría y los avisos de
      // nóminas de ex-empleados. El movimiento anterior no se pierde: queda en
      // `empleado_estado_historial`, que es ahora el histórico de verdad.
      patch.fecha_alta = input.fechaAlta;
      patch.fecha_baja = null;
    } else if (input.fechaBaja) {
      patch.fecha_baja = input.fechaBaja;
    }

    const { error } = await supabase.from("empleados").update(patch).eq("id", input.id);
    if (error) throw error;

    // Reactivación: devolverle la pertenencia a la empresa de esta ficha. Si se
    // le quitó con `quitarEmpleadoDeEmpresa`, su fila de `usuario_empresas` se
    // borró, y sin ella la ficha queda Activa pero él no ve la empresa en el
    // selector ni pasa las RLS. El upsert es idempotente: en una reactivación
    // normal (baja simple, sin desvincular) la fila ya existe y no cambia nada.
    // Los locales de fichaje NO se restauran: se perdieron al desvincular y hay
    // que volver a marcarlos a mano en la ficha.
    if (input.estado === "Activo" && previo?.user_id && previo?.empresa_id) {
      try {
        const admin = createAdminClient();
        const { error: ueErr } = await admin
          .from("usuario_empresas")
          .upsert(
            { user_id: previo.user_id as string, empresa_id: previo.empresa_id as string },
            { onConflict: "user_id,empresa_id" },
          );
        if (ueErr) throw ueErr;
      } catch (e) {
        // No bloquea la reactivación: la ficha ya está Activa. Se registra para
        // poder detectar el caso de "activo pero sin ver la empresa".
        console.error(
          "[rrhh] setEmpleadoEstado → restaurar usuario_empresas:",
          e instanceof Error ? e.message : e,
        );
      }
    }

    if (huboCambio) {
      const { registrarMovimientoEstado } = await import(
        "@/features/rrhh/actions/empleado-estado-historial-actions"
      );
      const { PASOS_OMITIDOS_ALTA } = await import(
        "@/features/rrhh/data/empleado-estado-pasos"
      );
      const esAlta = input.estado === "Activo";
      await registrarMovimientoEstado({
        empleadoId: input.id,
        accion: esAlta ? "Alta" : "Baja",
        estadoAnterior,
        estadoNuevo: input.estado,
        fechaEfectiva: (esAlta ? input.fechaAlta : input.fechaBaja) as string,
        motivo: input.motivo ?? null,
        // Un alta manual no dispara nada del flujo de contratación: se deja
        // constancia de lo que RRHH tiene que completar a mano.
        avisosOmitidos: esAlta ? PASOS_OMITIDOS_ALTA.map((p) => p.clave) : [],
        origen: "ficha",
      });
    }

    // Baja efectiva: recorta el horario futuro (turnos/patrones ilimitados o que
    // terminarían después de la baja) a la fecha de baja, y limpia turnos sueltos
    // posteriores. No bloqueamos la baja si el recorte falla.
    if (input.estado !== "Activo" && input.fechaBaja) {
      try {
        const { recortarHorarioFuturoPorBaja } = await import(
          "@/features/rrhh/services/baja-horario"
        );
        await recortarHorarioFuturoPorBaja(supabase, {
          empleadoId: input.id,
          fechaBaja: input.fechaBaja,
        });
      } catch (e) {
        console.error(
          "[rrhh] setEmpleadoEstado → recorte horario:",
          e instanceof Error ? e.message : e,
        );
      }
      revalidatePath("/rrhh/horarios");
    }

    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${input.id}`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] setEmpleadoEstado:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Quita (DESVINCULA) a un empleado de UNA empresa, conservando todo su histórico.
 *
 * - La ficha de esa empresa pasa a Inactivo (no se borra: registro legal).
 * - Se le retira el acceso a esa empresa (`usuario_empresas`) y sus locales, de
 *   modo que en su software deja de ver nada de esa empresa.
 * - Mínimo 1: nunca puede quedarse sin empresas (debe conservar otra).
 * - Si esa era su empresa de referencia (login), se mueve a otra que le quede.
 *
 * `empleadoId` identifica al usuario (cualquiera de sus fichas); `empresaId` es
 * la empresa de la que se le quita.
 */
export async function quitarEmpleadoDeEmpresa(input: {
  empleadoId: string;
  empresaId: string;
}): Promise<{ ok: true } | { ok: false; error?: string }> {
  try {
    const { supabase } = await getAppContext();

    const { data: actual } = await supabase
      .from("empleados")
      .select("user_id")
      .eq("id", input.empleadoId)
      .maybeSingle();
    if (!actual?.user_id) return { ok: false, error: "Empleado no encontrado." };
    const userId = actual.user_id as string;

    await requireRRHHAcceso([input.empresaId]);

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { ok: false, error: "Supabase admin no configurado." };
    }

    // Todas las fichas del empleado (una por empresa).
    const { data: filas } = await admin
      .from("empleados")
      .select("id, empresa_id")
      .eq("user_id", userId);
    const objetivo = (filas ?? []).find((f) => f.empresa_id === input.empresaId);
    if (!objetivo) return { ok: false, error: "El empleado no está en esa empresa." };

    // Mínimo 1: debe quedarle al menos otra empresa.
    const otras = (filas ?? []).filter((f) => f.empresa_id !== input.empresaId);
    if (otras.length === 0) {
      return {
        ok: false,
        error:
          "Es su única empresa. No puedes desvincularlo de todas; para darlo de baja por completo, márcalo Inactivo en su ficha.",
      };
    }

    const objetivoId = objetivo.id as string;

    const hoy = new Date().toISOString().split("T")[0];

    // 1) Ficha de esta empresa → Inactivo (conserva todo). No hay que reasignar
    //    validador: quien valida las solicitudes es un departamento, no esta
    //    persona, así que su baja no deja ninguna solicitud sin resolver.
    const { error: upErr } = await admin
      .from("empleados")
      .update({ estado: "Inactivo", fecha_baja: hoy })
      .eq("id", objetivoId);
    if (upErr) throw upErr;

    // 2) Desvincular: quitar acceso a esta empresa + sus locales de fichaje.
    await admin
      .from("usuario_empresas")
      .delete()
      .eq("user_id", userId)
      .eq("empresa_id", input.empresaId);
    await admin.from("empleado_locales").delete().eq("empleado_id", objetivoId);

    // 3) Si esta era su empresa de referencia (login), moverla a otra que quede.
    const { data: prof } = await admin
      .from("usuarios")
      .select("empresa_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (prof?.empresa_id === input.empresaId) {
      await admin
        .from("usuarios")
        .update({ empresa_id: otras[0].empresa_id })
        .eq("user_id", userId);
    }

    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${input.empleadoId}`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] quitarEmpleadoDeEmpresa:", msg);
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
      .select("es_principal, puesto_nombre, puestos(nombre)")
      .eq("empleado_id", input.empleadoId);
    const puestosOrigen = (epO ?? []).map((r) => {
      const row = r as unknown as { es_principal: boolean; puesto_nombre: string | null; puestos: { nombre: string } | null };
      // Puesto vivo si existe; si fue borrado (plantilla), el nombre copiado.
      return { nombre: row.puestos?.nombre ?? row.puesto_nombre ?? undefined, esPrincipal: Boolean(row.es_principal) };
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

    // Anti-duplicados en la empresa DESTINO: aquí sí, porque copiar es crear una
    // ficha nueva. El guard previo solo miraba user_id+empresa_id, así que una
    // misma persona dada de alta dos veces con user_id distinto se colaba.
    const txt = (v: unknown): string | null => (typeof v === "string" ? v : null);
    const dupDestino = await buscarEmpleadoDuplicado(admin, input.empresaDestinoId, {
      dniNie: txt(o.dni_nie),
      nombre: txt(o.nombre),
      apellidos: txt(o.apellidos),
      emailPersonal: txt(o.email_personal),
      emailEmpresa: txt(emailEmpresa),
    });
    if (dupDestino) return { ok: false, error: mensajeDuplicado(dupDestino) };

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
      // Datos personales = reflejo idéntico en todas las empresas.
      tipo_documento: o.tipo_documento ?? null,
      dni_nie: o.dni_nie ?? null,
      fecha_nacimiento: o.fecha_nacimiento ?? null,
      nacionalidad: o.nacionalidad ?? null,
      genero: o.genero ?? null,
      estado_civil: o.estado_civil ?? null,
      telefono: o.telefono ?? null,
      telefono_empresa: o.telefono_empresa ?? null,
      email_personal: o.email_personal ?? null,
      email_empresa: emailEmpresa,
      direccion: o.direccion ?? null,
      codigo_postal: o.codigo_postal ?? null,
      ciudad: o.ciudad ?? null,
      provincia: o.provincia ?? null,
      pais: o.pais ?? null,
      numero_ss: o.numero_ss ?? null,
      iban: o.iban ?? null,
      banco_codigo: o.banco_codigo ?? null,
      banco_nombre: o.banco_nombre ?? null,
      titular_cuenta: o.titular_cuenta ?? null,
      iban_verificado: Boolean(o.iban_verificado),
      dni_archivo_url: o.dni_archivo_url ?? null,
      contacto_emergencia_nombre: o.contacto_emergencia_nombre ?? null,
      contacto_emergencia_telefono: o.contacto_emergencia_telefono ?? null,
      contacto_emergencia_relacion: o.contacto_emergencia_relacion ?? null,
      talla_uniforme: o.talla_uniforme ?? null,
      talla_camiseta: o.talla_camiseta ?? null,
      talla_pantalon: o.talla_pantalon ?? null,
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
    const { data: epO } = await admin.from("empleado_puestos").select("es_principal, puesto_nombre, puestos(nombre)").eq("empleado_id", input.empleadoId);
    const puestosOrigen = (epO ?? []).map((r) => {
      const row = r as unknown as { es_principal: boolean; puesto_nombre: string | null; puestos: { nombre: string } | null };
      return { nombre: row.puestos?.nombre ?? row.puesto_nombre ?? undefined, esPrincipal: Boolean(row.es_principal) };
    }).filter((p) => p.nombre);
    if (puestosOrigen.length) {
      const { data: pD } = await admin.from("puestos").select("id, nombre").eq("empresa_id", input.empresaDestinoId).in("nombre", puestosOrigen.map((p) => p.nombre as string));
      const idPorNombre = new Map((pD ?? []).map((p) => [p.nombre as string, p.id as string]));
      const hoy = new Date().toISOString().split("T")[0];
      const filas = puestosOrigen
        .filter((p) => idPorNombre.has(p.nombre as string))
        .map((p) => ({ empleado_id: nuevoId, puesto_id: idPorNombre.get(p.nombre as string), puesto_nombre: p.nombre as string, es_principal: p.esPrincipal, vigente_desde: hoy }));
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

    // Datos personales = ficha de empleado (fuente única). Solo el email de
    // cuenta (login) se lee de usuarios. emergencia_* del formulario mapea a
    // contacto_emergencia_* en empleados.
    const e = emp as Record<string, unknown>;
    let emailCuenta: string | null = null;
    if (emp.user_id) {
      const { data: cuenta } = await supabase
        .from("usuarios")
        .select("email")
        .eq("id", emp.user_id)
        .maybeSingle();
      emailCuenta = (cuenta?.email as string | null) ?? null;
    }

    const datosPersonales: DatosPersonalesCompletos = {
      nombre: (e.nombre as string | null) ?? null,
      apellidos: (e.apellidos as string | null) ?? null,
      email: emailCuenta ?? (e.email_empresa as string | null) ?? (e.email_personal as string | null) ?? null,
      tipo_documento: (e.tipo_documento as DatosPersonalesCompletos["tipo_documento"]) ?? null,
      dni_nie: (e.dni_nie as string | null) ?? null,
      fecha_nacimiento: (e.fecha_nacimiento as string | null) ?? null,
      nacionalidad: (e.nacionalidad as string | null) ?? null,
      genero: (e.genero as string | null) ?? null,
      estado_civil: (e.estado_civil as string | null) ?? null,
      numero_ss: (e.numero_ss as string | null) ?? null,
      telefono: (e.telefono as string | null) ?? null,
      telefono_empresa: (e.telefono_empresa as string | null) ?? null,
      email_personal: (e.email_personal as string | null) ?? null,
      email_empresa: (e.email_empresa as string | null) ?? null,
      direccion: (e.direccion as string | null) ?? null,
      codigo_postal: (e.codigo_postal as string | null) ?? null,
      ciudad: (e.ciudad as string | null) ?? null,
      provincia: (e.provincia as string | null) ?? null,
      pais: (e.pais as string | null) ?? null,
      iban: (e.iban as string | null) ?? null,
      banco_codigo: (e.banco_codigo as string | null) ?? null,
      banco_nombre: (e.banco_nombre as string | null) ?? null,
      titular_cuenta: (e.titular_cuenta as string | null) ?? null,
      iban_verificado: Boolean(e.iban_verificado),
      emergencia_nombre: (e.contacto_emergencia_nombre as string | null) ?? null,
      emergencia_relacion: (e.contacto_emergencia_relacion as string | null) ?? null,
      emergencia_telefono: (e.contacto_emergencia_telefono as string | null) ?? null,
      talla_camiseta: (e.talla_camiseta as string | null) ?? null,
      talla_pantalon: (e.talla_pantalon as string | null) ?? null,
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

function mapSolicitudEmpleado(
  row: Record<string, unknown>,
  nombrePorUserId?: Map<string, string>,
): SolicitudPersonal {
  const revisorId = (row.revisado_por as string | null) ?? null;
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
    revisadoPor: revisorId ? nombrePorUserId?.get(revisorId) ?? null : null,
    revisadoAt: (row.revisado_at as string | null) ?? null,
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

    // Nombre de quien resolvió cada solicitud (el permiso lo da el
    // departamento, pero aprueba una persona y su nombre queda como firma).
    const revisorIds = Array.from(
      new Set(
        (data ?? [])
          .map((r) => r.revisado_por as string | null)
          .filter((v): v is string => Boolean(v)),
      ),
    );
    const nombrePorUserId = new Map<string, string>();
    if (revisorIds.length > 0) {
      const { data: revisores } = await supabase
        .from("empleados")
        .select("user_id, nombre, apellidos")
        .eq("empresa_id", empresaId)
        .in("user_id", revisorIds);
      for (const r of revisores ?? []) {
        const nombre = `${r.nombre ?? ""} ${(r.apellidos as string | null) ?? ""}`.trim();
        if (nombre) nombrePorUserId.set(r.user_id as string, nombre);
      }
    }

    return {
      ok: true,
      data: (data ?? []).map((row) =>
        mapSolicitudEmpleado(row as Record<string, unknown>, nombrePorUserId),
      ),
    };
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

    const tallaCamiseta = trim(datos.talla_camiseta);
    // empleados es la fuente única de datos personales. Escribimos en esta
    // ficha; el trigger de BD replica los datos personales al resto de fichas
    // del mismo user_id (multi-empresa espejo). emergencia_* del formulario
    // mapea a contacto_emergencia_*; talla_uniforme refleja la de camiseta.
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
      contacto_emergencia_nombre: normalizarNombreOrNull(datos.emergencia_nombre),
      contacto_emergencia_relacion: trim(datos.emergencia_relacion),
      contacto_emergencia_telefono: trim(datos.emergencia_telefono),
      talla_camiseta: tallaCamiseta,
      talla_pantalon: trim(datos.talla_pantalon),
      talla_uniforme: tallaCamiseta,
      updated_at: new Date().toISOString(),
    };
    // nombre es NOT NULL en empleados: si llega vacío, no lo pisamos.
    if (payload.nombre == null) delete payload.nombre;

    const { error: updErr } = await admin
      .from("empleados")
      .update(payload)
      .eq("id", empleadoId);
    if (updErr) return { ok: false, error: friendlyError(updErr) };

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
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) return { ok: false, error: "No autenticado" };
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    // El filtro por empresa NO es opcional: quien trabaja en varias empresas
    // tiene una ficha espejo en cada una, todas con el mismo `user_id`. Sin él,
    // `maybeSingle()` devolvía una cualquiera (orden físico de Postgres, no
    // determinista): el empleado veía su contrato de la OTRA empresa —con DNI,
    // dirección, IBAN y nº de la Seguridad Social— y además cambiaba de una
    // recarga a otra. La RLS no lo corta: `empleados_self_read` autoriza por
    // `user_id`, sin empresa.
    const { data, error } = await supabase
      .from("empleados")
      .select(`
        *,
        departamentos(nombre),
        puestos_trabajo(nombre)
      `)
      .eq("user_id", userId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    console.error("[rrhh] getMiInformacionLaboral:", err);
    return { ok: false, error: "Error al obtener info laboral" };
  }
}
