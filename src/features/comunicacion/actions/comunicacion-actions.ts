"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeVerModulo } from "@/features/auth/lib/permisos";
import type { SupabaseClient } from "@supabase/supabase-js";
async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, nombre: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);

  const { data } = await supabase

    .from("usuarios")

    .select("nombre, apellidos")

    .eq("user_id", user.id)

    .single();
const partes = [data?.nombre, data?.apellidos]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());
  const nombreCompleto = partes.length > 0
    ? partes.join(" ")
    : (user.email ?? "Usuario");
  return {
    supabase,
    user,
    empresaId,
    nombre: nombreCompleto,
  };
}

const COMBINING_MARKS = /[\u0300-\u036f]/g;
function normalizar(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "").toUpperCase().trim();
}

// M\u00f3dulos de permiso que NO son departamentos: son ajustes/toggles extra dentro
// de Roles (candado de Ajustes, c\u00e1mara de la toolbar, lanzadores de apps/accesos).
// Los chats existen SOLO por departamento, as\u00ed que estos m\u00f3dulos nunca dan acceso
// a un chat aunque est\u00e9n con "ver:true".
const MODULOS_NO_DEPARTAMENTO = new Set([
  "AJUSTES",
  "CAMARAS",
  "HERR_APLICACIONES",
  "HERR_ACCESOS",
]);

// Sinónimos para matchear nombre de canal (ej "RR.HH") contra módulo de permisos
// (ej "RECURSOS HUMANOS"). Cada array agrupa equivalentes; cualquier elemento
// del array matchea cualquier otro.
const SINONIMOS_DEPT: string[][] = [
  ["RECURSOS HUMANOS", "RRHH", "RR.HH", "RR HH", "RESPONSABLE RRHH"],
  ["DIRECCION", "DIRECTOR"],
  ["COCINA", "JEFE DE COCINA"],
  ["SALA", "JEFE DE SALA"],
  ["LOGISTICA", "JEFE DE LOGISTICA"],
  ["GERENCIA", "GERENTE"],
  ["CALIDAD", "RESPONSABLE CALIDAD"],
  ["MARKETING", "RESPONSABLE MARKETING"],
  ["CONTABILIDAD", "CONTABLE"],
  ["GESTORIA", "GESTOR"],
  ["JURIDICO", "ABOGADO"],
];

function matchDepartamento(canalNombre: string, candidatos: string[]): boolean {
  const target = normalizar(canalNombre);
  const candNorm = candidatos.map(normalizar);
  if (candNorm.includes(target)) return true;
  // Buscamos el grupo de sinónimos del target y comprobamos si algún
  // candidato cae en el mismo grupo.
  const grupo = SINONIMOS_DEPT.find((g) => g.map(normalizar).includes(target));
  if (!grupo) return false;
  const grupoNorm = grupo.map(normalizar);
  return candNorm.some((c) => grupoNorm.includes(c));
}

// ───────── Control de acceso a canales (espejo de la RLS) ─────────
// La seguridad real vive en RLS (ver migración canales_visibilidad_departamentos);
// estas funciones replican la lógica en el servidor para filtrar y validar.
type AccesoCtx = { esAdmin: boolean; candidatos: string[]; userId: string };

async function getAccesoCtx(
  supabase: SupabaseClient,
  userId: string,
  empresaId: string,
): Promise<AccesoCtx> {
  // Acceso total a los canales: manda el permiso DIRECCIÓN de Ajustes → Roles,
  // no el flag de director.
  const { permisos } = await getRolContext(userId);
  const esAdmin = puedeVerModulo(permisos, "DIRECCIÓN");

  const candidatos: string[] = [];
  if (!esAdmin) {
    const { data: profile } = await supabase
      .from("usuarios")
      .select("rol_label, departamento")
      .eq("user_id", userId)
      .maybeSingle();
    const rolLabel = ((profile?.rol_label as string | null) ?? "").trim();
    const departamento = ((profile?.departamento as string | null) ?? "").trim();
    if (departamento) candidatos.push(departamento);
    if (rolLabel) candidatos.push(rolLabel);

    if (rolLabel) {
      const { data: rolRow } = await supabase
        .from("empresa_roles")
        .select("permisos")
        .eq("empresa_id", empresaId)
        .ilike("nombre", rolLabel)
        .maybeSingle();
      const permisos = (rolRow?.permisos ?? []) as Array<{
        modulo: string;
        ver: boolean;
      }>;
      for (const p of permisos) {
        // Solo módulos que sean departamentos reales (los chats existen por
        // departamento; los ajustes/toggles extra no dan acceso a chat).
        if (p?.ver && p.modulo && !MODULOS_NO_DEPARTAMENTO.has(normalizar(p.modulo))) {
          candidatos.push(p.modulo);
        }
      }
    }
  }
  return { esAdmin, candidatos, userId };
}

// ¿Puede el usuario (según ctx) ver esta fila de canal?
// - departamento: visible si su rol da acceso a ese departamento (por nombre).
// - asunto/grupo/directo: visible si su rol da acceso a alguno de los
//   departamentos ligados al canal, o si es miembro explícito.
function canalAccesible(row: Record<string, unknown>, ctx: AccesoCtx): boolean {
  if (ctx.esAdmin) return true;
  const tipo = (row.tipo as string | null) ?? "asunto";
  const miembros = (row.miembros_user_ids as string[] | null) ?? [];
  if (miembros.includes(ctx.userId)) return true;
  if (tipo === "departamento") {
    return matchDepartamento(String(row.nombre ?? ""), ctx.candidatos);
  }
  const deptos = (row.departamentos as string[] | null) ?? [];
  return deptos.some((d) => matchDepartamento(String(d ?? ""), ctx.candidatos));
}

// Verifica acceso a un canal por id (lee la fila y comprueba pertenencia).
async function assertAccesoCanal(
  supabase: SupabaseClient,
  userId: string,
  empresaId: string,
  canalId: string,
): Promise<boolean> {
  const { data: row } = await supabase
    .from("canales")
    .select("id, empresa_id, nombre, tipo, miembros_user_ids, departamentos")
    .eq("id", canalId)
    .maybeSingle();
  if (!row) return false;
  if ((row.empresa_id as string) !== empresaId) return false;
  const ctx = await getAccesoCtx(supabase, userId, empresaId);
  return canalAccesible(row, ctx);
}

export async function listCanales(_empresaSlug: string) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("canales")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre");
    if (error) throw error;
    const rows = data ?? [];

    if (!user) return { ok: true, data: rows, esAdmin: false };

    const ctx = await getAccesoCtx(supabase, user.id, empresaId);
    if (ctx.esAdmin) return { ok: true, data: rows, esAdmin: true };

    const filtered = rows.filter((row) => canalAccesible(row, ctx));
    return { ok: true, data: filtered, esAdmin: false };
  } catch (err) {
    console.error("[comunicacion] listCanales:", err);
    return { ok: false, data: [], esAdmin: false };
  }
}

export async function createCanal(
  nombre: string,
  tipo: string = "grupo",
  miembrosUserIds: string[] = [],
  _empresaSlug: string = "",
  departamentos: string[] = [],
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "Falta empresa" };
    const { data, error } = await supabase
      .from("canales")
      .insert({
        nombre,
        tipo,
        empresa_id: empresaId,
        miembros_user_ids: miembrosUserIds,
        departamentos,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] createCanal:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCanalMiembros(
  canalId: string,
  miembrosUserIds: string[],
) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("canales")
      .update({ miembros_user_ids: miembrosUserIds })
      .eq("id", canalId)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] updateCanalMiembros:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCanalDepartamentos(
  canalId: string,
  departamentos: string[],
) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("canales")
      .update({ departamentos })
      .eq("id", canalId)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] updateCanalDepartamentos:", msg);
    return { ok: false, error: msg };
  }
}

export interface EmpleadoCanal {
  userId: string;
  nombre: string;
  apellidos: string;
  rolLabel: string | null;
  departamento: string | null;
  /** Puesto REAL del empleado (p. ej. "CANTANTE"). En este sistema `rolLabel`
   *  es el nombre del departamento, así que para mostrar "puesto · departamento"
   *  hay que usar este campo, no `rolLabel`. */
  puesto: string | null;
}

export async function listEmpleadosEmpresa(): Promise<{
  ok: boolean;
  data: EmpleadoCanal[];
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };
    // Vía RPC SECURITY DEFINER: profiles tiene RLS que solo deja ver el propio
    // perfil, así que una lectura directa devolvería la lista vacía.
    const { data, error } = await supabase.rpc("chat_empleados", { p_empresa: empresaId });
    if (error) throw error;
    return {
      ok: true,
      data: (data ?? [])
        .filter((r: Record<string, unknown>) => !!r.user_id)
        .map((r: Record<string, unknown>) => ({
          userId: r.user_id as string,
          nombre: (r.nombre as string) ?? "",
          apellidos: (r.apellidos as string) ?? "",
          rolLabel: (r.rol_label as string | null) ?? null,
          departamento: (r.departamento as string | null) ?? null,
          puesto: (r.puesto as string | null) ?? null,
        })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] listEmpleadosEmpresa:", msg);
    return { ok: false, data: [], error: msg };
  }
}

// ───────── Miembros efectivos por canal (quién tiene acceso) ─────────
// Para un canal-departamento la pertenencia NO es una lista explícita: son
// todos los empleados cuyo rol/permisos dan acceso a ese departamento. Esta
// acción calcula, para cada canal accesible, la lista real de usuarios con
// acceso — replicando la misma lógica que la RLS (getAccesoCtx / canalAccesible)
// pero evaluada empleado a empleado. Alimenta el contador de personas del header
// del chat y la lista "quién tiene acceso" (se re-calcula al cambiar roles).

export interface MiembroCanal {
  userId: string;
  nombre: string;
  apellidos: string;
  rolLabel: string | null;
  departamento: string | null;
  /** Puesto REAL (p. ej. "CANTANTE"). Para mostrar "puesto · departamento":
   *  `rolLabel` es el nombre del departamento en este sistema. */
  puesto: string | null;
}

// Resuelve los candidatos de acceso de UN empleado (departamento + rol +
// módulos-departamento de los permisos de su rol), igual que getAccesoCtx pero
// a partir de una fila de empleado ya cargada y su mapa de permisos por rol.
function candidatosDeEmpleado(
  emp: { rolLabel: string | null; departamento: string | null },
  permisosPorRol: Map<string, string[]>,
): string[] {
  const candidatos: string[] = [];
  const departamento = (emp.departamento ?? "").trim();
  const rolLabel = (emp.rolLabel ?? "").trim();
  if (departamento) candidatos.push(departamento);
  if (rolLabel) {
    candidatos.push(rolLabel);
    const modulos = permisosPorRol.get(normalizar(rolLabel)) ?? [];
    candidatos.push(...modulos);
  }
  return candidatos;
}

/**
 * Devuelve, por cada canal accesible del usuario, la lista de usuarios que
 * tienen acceso a ese canal según su rol/permisos (departamentos) o pertenencia
 * explícita (asuntos). Se usa para el contador "N personas" del header y para
 * la lista desplegable de miembros. Se re-evalúa en cada carga, así que refleja
 * automáticamente cualquier cambio de roles/permisos de los usuarios.
 */
export async function listMiembrosPorCanal(): Promise<{
  ok: boolean;
  data: Record<string, MiembroCanal[]>;
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: true, data: {} };

    // 1. Canales visibles para el usuario (mismo filtro que listCanales).
    const { data: canalesRows, error: canalesErr } = await supabase
      .from("canales")
      .select("id, empresa_id, nombre, tipo, miembros_user_ids, departamentos")
      .eq("empresa_id", empresaId);
    if (canalesErr) throw canalesErr;
    const ctx = await getAccesoCtx(supabase, user.id, empresaId);
    const canales = (canalesRows ?? []).filter((row) => canalAccesible(row, ctx));
    if (canales.length === 0) return { ok: true, data: {} };

    // 2. Todos los empleados de la empresa (vía RPC SECURITY DEFINER, igual que
    //    listEmpleadosEmpresa: profiles tiene RLS de solo-propio-perfil).
    const { data: empleadosRaw, error: empErr } = await supabase.rpc("chat_empleados", {
      p_empresa: empresaId,
    });
    if (empErr) throw empErr;
    const empleados: MiembroCanal[] = (empleadosRaw ?? [])
      .filter((r: Record<string, unknown>) => !!r.user_id)
      .map((r: Record<string, unknown>) => ({
        userId: r.user_id as string,
        nombre: (r.nombre as string) ?? "",
        apellidos: (r.apellidos as string) ?? "",
        rolLabel: (r.rol_label as string | null) ?? null,
        departamento: (r.departamento as string | null) ?? null,
        puesto: (r.puesto as string | null) ?? null,
      }));

    // 3. Permisos por rol (una sola query): rol → módulos-departamento con ver:true.
    const { data: rolesRows } = await supabase
      .from("empresa_roles")
      .select("nombre, permisos")
      .eq("empresa_id", empresaId);
    const permisosPorRol = new Map<string, string[]>();
    for (const r of rolesRows ?? []) {
      const nombre = normalizar(String((r as Record<string, unknown>).nombre ?? ""));
      if (!nombre) continue;
      const permisos = ((r as Record<string, unknown>).permisos ?? []) as Array<{
        modulo: string;
        ver: boolean;
      }>;
      const modulos = permisos
        .filter((p) => p?.ver && p.modulo && !MODULOS_NO_DEPARTAMENTO.has(normalizar(p.modulo)))
        .map((p) => p.modulo);
      permisosPorRol.set(nombre, modulos);
    }

    // 4. Para cada canal, evaluamos qué empleados tienen acceso (mismo predicado
    //    que canalAccesible, pero con el ctx de cada empleado).
    const resultado: Record<string, MiembroCanal[]> = {};
    for (const canal of canales) {
      const tipo = ((canal.tipo as string | null) ?? "asunto");
      const miembrosExplicitos = new Set(
        ((canal.miembros_user_ids as string[] | null) ?? []),
      );
      const nombre = String(canal.nombre ?? "");
      const deptos = ((canal.departamentos as string[] | null) ?? []);
      const lista: MiembroCanal[] = [];
      for (const emp of empleados) {
        let tieneAcceso = miembrosExplicitos.has(emp.userId);
        if (!tieneAcceso) {
          const cand = candidatosDeEmpleado(emp, permisosPorRol);
          if (tipo === "departamento") {
            tieneAcceso = matchDepartamento(nombre, cand);
          } else {
            tieneAcceso = deptos.some((d) => matchDepartamento(String(d ?? ""), cand));
          }
        }
        if (tieneAcceso) lista.push(emp);
      }
      resultado[canal.id as string] = lista;
    }

    return { ok: true, data: resultado };
  } catch (err) {
    console.error("[comunicacion] listMiembrosPorCanal:", err);
    return { ok: true, data: {} };
  }
}

export async function listMensajes(canalId: string) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, data: [] };
    if (!(await assertAccesoCanal(supabase, user.id, empresaId, canalId))) {
      return { ok: false, data: [] };
    }
    const { data, error } = await supabase
      .from("mensajes")
      .select("*")
      .eq("canal_id", canalId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[comunicacion] listMensajes:", err);
    return { ok: false, data: [] };
  }
}

export async function sendMensaje(canalId: string, texto: string) {
  try {
    const { supabase, user, nombre, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };
    if (!(await assertAccesoCanal(supabase, user.id, empresaId, canalId))) {
      return { ok: false, error: "Sin acceso a este canal" };
    }
    const { data, error } = await supabase
      .from("mensajes")
      .insert({
        canal_id: canalId,
        autor_id: user?.id ?? null,
        autor_nombre: nombre ?? "Anónimo",
        texto,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] sendMensaje:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Envía un mensaje con adjunto. El cliente sube primero el archivo al bucket
 * 'chat-archivos' y luego invoca esta acción con la URL pública firmada y los metadatos.
 */
export async function sendMensajeAdjunto(input: {
  canalId: string;
  texto?: string | null;
  adjuntoUrl: string;
  adjuntoTipo: "imagen" | "audio" | "archivo";
  adjuntoNombre: string;
  adjuntoMime: string;
  adjuntoTamano: number;
}) {
  try {
    const { supabase, user, nombre, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };
    if (!(await assertAccesoCanal(supabase, user.id, empresaId, input.canalId))) {
      return { ok: false, error: "Sin acceso a este canal" };
    }
    const { data, error } = await supabase
      .from("mensajes")
      .insert({
        canal_id: input.canalId,
        autor_id: user?.id ?? null,
        autor_nombre: nombre ?? "Anónimo",
        texto: input.texto ?? null,
        adjunto_url: input.adjuntoUrl,
        adjunto_tipo: input.adjuntoTipo,
        adjunto_nombre: input.adjuntoNombre,
        adjunto_mime: input.adjuntoMime,
        adjunto_tamano: input.adjuntoTamano,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] sendMensajeAdjunto:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Devuelve una URL firmada (1h) para descargar/reproducir un adjunto privado.
 */
export async function getAdjuntoSignedUrl(path: string) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado", url: null };
    // El path es `${empresaSlug}/${canalId}/...`: validamos acceso al canal
    // antes de firmar, para que nadie descargue adjuntos de canales ajenos.
    const canalId = path.split("/")[1] ?? "";
    if (!canalId || !(await assertAccesoCanal(supabase, user.id, empresaId, canalId))) {
      return { ok: false, error: "Sin acceso a este adjunto", url: null };
    }
    const { data, error } = await supabase.storage
      .from("chat-archivos")
      .createSignedUrl(path, 60 * 60);
    if (error) throw error;
    return { ok: true, url: data?.signedUrl ?? null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] getAdjuntoSignedUrl:", msg);
    return { ok: false, error: msg, url: null };
  }
}

export async function updateCanalNombre(canalId: string, nombre: string) {
  try {
    const { supabase } = await getContext();
    const limpio = nombre.trim();
    if (!limpio) return { ok: false, error: "El nombre no puede estar vacío" };
    const { data, error } = await supabase
      .from("canales")
      .update({ nombre: limpio })
      .eq("id", canalId)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] updateCanalNombre:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Borra los canales obsoletos: cualquier canal de tipo distinto a "asunto"
 * cuyo nombre no esté en la lista permitida. Útil para sanear los grupos
 * heredados ("BACANAL X", "Cocina", "Sala", "JEFES SAL/COC", etc.) cuando se
 * pasa al modelo "1 grupo por departamento del organigrama".
 *
 * Los canales de tipo "asunto" (creados manualmente por el usuario) se preservan.
 */
export async function purgeCanalesObsoletos(
  nombresPermitidos: string[],
  _empresaSlug: string,
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "Falta empresa", borrados: 0 };
    const allowed = new Set(nombresPermitidos.map((n) => n.trim().toUpperCase()));
    const { data, error } = await supabase
      .from("canales")
      .select("id, nombre, tipo")
      .eq("empresa_id", empresaId);
    if (error) throw error;
    const aBorrar = (data ?? [])
      .filter((c: Record<string, unknown>) => {
        const tipo = (c.tipo as string) ?? "";
        if (tipo === "asunto") return false; // preservar los manuales
        const nombre = String(c.nombre ?? "").trim().toUpperCase();
        return !allowed.has(nombre);
      })
      .map((c: Record<string, unknown>) => c.id as string);
    if (aBorrar.length === 0) return { ok: true, borrados: 0 };
    const { error: delErr } = await supabase
      .from("canales")
      .delete()
      .in("id", aBorrar);
    if (delErr) throw delErr;
    return { ok: true, borrados: aBorrar.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] purgeCanalesObsoletos:", msg);
    return { ok: false, error: msg, borrados: 0 };
  }
}

export async function deleteCanal(canalId: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("canales").delete().eq("id", canalId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] deleteCanal:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCanalConfig(
  canalId: string,
  patch: {
    descripcion?: string | null;
    solo_admins_envian?: boolean;
    bloquear_ajustes?: boolean;
    mensajes_efimeros_dias?: number | null;
  }
) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("canales")
      .update(patch)
      .eq("id", canalId)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] updateCanalConfig:", msg);
    return { ok: false, error: msg };
  }
}

export async function listCanalPreferencias() {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("canales_preferencias")
      .select("*")
      .eq("user_id", user.id);
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[comunicacion] listCanalPreferencias:", err);
    return { ok: false, data: [] };
  }
}

export async function upsertCanalPreferencia(
  canalId: string,
  patch: { silenciado?: boolean; fijado?: boolean; last_read_at?: string }
) {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };
    const { data, error } = await supabase
      .from("canales_preferencias")
      .upsert(
        { user_id: user.id, canal_id: canalId, ...patch },
        { onConflict: "user_id,canal_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] upsertCanalPreferencia:", msg);
    return { ok: false, error: msg };
  }
}

export async function vaciarCanal(canalId: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("mensajes").delete().eq("canal_id", canalId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] vaciarCanal:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Marca un canal como leído hasta ahora (last_read_at = now()) para el usuario
 * actual. A partir de este instante, los mensajes ya recibidos dejan de contar
 * como "sin leer" en el badge. También retira la marca manual de "no leído":
 * abrir el grupo siempre lo deja al día.
 */
export async function marcarCanalLeido(canalId: string) {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("canales_preferencias")
      .upsert(
        {
          user_id: user.id,
          canal_id: canalId,
          last_read_at: new Date().toISOString(),
          marcado_no_leido: false,
        },
        { onConflict: "user_id,canal_id" }
      );
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] marcarCanalLeido:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Deja un canal marcado como "no leído" a mano (como WhatsApp): el grupo queda
 * señalado como pendiente aunque ya se hubiera leído. La marca es personal y
 * desaparece en cuanto el usuario vuelve a abrir el grupo.
 */
export async function marcarCanalNoLeido(canalId: string) {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("canales_preferencias")
      .upsert(
        { user_id: user.id, canal_id: canalId, marcado_no_leido: true },
        { onConflict: "user_id,canal_id" }
      );
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] marcarCanalNoLeido:", msg);
    return { ok: false, error: msg };
  }
}

export interface ResumenSinLeer {
  userId: string | null;
  /** Nº de canales con al menos un mensaje sin leer. */
  totalGrupos: number;
  /** Suma total de mensajes sin leer en todos los canales. */
  totalMensajes: number;
  /** Detalle por canal: { [canalId]: nº mensajes sin leer }. */
  porCanal: Record<string, number>;
}

/**
 * Cuenta los mensajes sin leer del usuario actual en todos los canales a los que
 * tiene acceso. "Sin leer" = mensaje posterior al last_read_at de su preferencia
 * (o cualquier mensaje si nunca ha abierto el canal), excluyendo los mensajes
 * escritos por el propio usuario. Alimenta el badge del icono de chat.
 */
export async function contarMensajesSinLeer(): Promise<{ ok: boolean; data: ResumenSinLeer }> {
  const vacio: ResumenSinLeer = { userId: null, totalGrupos: 0, totalMensajes: 0, porCanal: {} };
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: true, data: vacio };

    // 1. Canales accesibles para el usuario (mismo filtro que listCanales).
    const { data: canalesRows, error: canalesErr } = await supabase
      .from("canales")
      .select("id, empresa_id, nombre, tipo, miembros_user_ids, departamentos")
      .eq("empresa_id", empresaId);
    if (canalesErr) throw canalesErr;
    const ctx = await getAccesoCtx(supabase, user.id, empresaId);
    const canalesVisibles = (canalesRows ?? []).filter((row) => canalAccesible(row, ctx));
    if (canalesVisibles.length === 0) return { ok: true, data: { ...vacio, userId: user.id } };
    const canalIds = canalesVisibles.map((c) => c.id as string);

    // 2. last_read_at por canal (preferencias del usuario) + canales silenciados
    //    + grupos que el usuario dejó marcados como no leídos a mano.
    const { data: prefs } = await supabase
      .from("canales_preferencias")
      .select("canal_id, last_read_at, silenciado, marcado_no_leido")
      .eq("user_id", user.id)
      .in("canal_id", canalIds);
    const lastReadMap = new Map<string, string | null>();
    const silenciados = new Set<string>();
    const marcados = new Set<string>();
    for (const p of prefs ?? []) {
      lastReadMap.set(p.canal_id as string, (p.last_read_at as string | null) ?? null);
      if (p.silenciado) silenciados.add(p.canal_id as string);
      if (p.marcado_no_leido) marcados.add(p.canal_id as string);
    }

    // 3. Mensajes de esos canales que no son del propio usuario. Traemos solo lo
    //    necesario (canal_id + created_at) y contamos en memoria contra cada
    //    last_read_at — evita N queries (una por canal).
    const { data: msgs, error: msgErr } = await supabase
      .from("mensajes")
      .select("canal_id, created_at, autor_id")
      .in("canal_id", canalIds)
      .neq("autor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (msgErr) throw msgErr;

    const porCanal: Record<string, number> = {};
    for (const m of msgs ?? []) {
      const canalId = m.canal_id as string;
      if (silenciados.has(canalId)) continue; // canal silenciado: no cuenta al badge
      const lastRead = lastReadMap.get(canalId);
      const createdAt = m.created_at as string;
      // Sin last_read_at → el canal nunca se abrió: todos sus mensajes cuentan.
      if (!lastRead || createdAt > lastRead) {
        porCanal[canalId] = (porCanal[canalId] ?? 0) + 1;
      }
    }

    const totalMensajes = Object.values(porCanal).reduce((a, b) => a + b, 0);

    // Los grupos que el usuario dejó en "no leído" a mano también cuentan como
    // pendientes, aunque no tengan mensajes nuevos: por eso suman al nº de
    // grupos, pero no al total de mensajes.
    const gruposPendientes = new Set(Object.keys(porCanal));
    for (const id of marcados) {
      if (!silenciados.has(id)) gruposPendientes.add(id);
    }

    return {
      ok: true,
      data: {
        userId: user.id,
        totalGrupos: gruposPendientes.size,
        totalMensajes,
        porCanal,
      },
    };
  } catch (err) {
    console.error("[comunicacion] contarMensajesSinLeer:", err);
    return { ok: true, data: vacio };
  }
}

export interface ResumenCanal {
  /** Texto del último mensaje del canal (vacío si nunca se escribió nada). */
  ultimoMensaje: string | null;
  /** Fecha ISO del último mensaje, para ordenar por actividad. */
  ultimoMensajeAt: string | null;
  /** Mensajes de otros posteriores a tu last_read_at. */
  sinLeer: number;
  /** El usuario dejó el grupo marcado como no leído a mano. */
  marcadoNoLeido: boolean;
}

/**
 * Devuelve, para cada canal visible, su último mensaje y cuántos mensajes lleva
 * el usuario sin leer. La lista de canales (tabla `canales`) no guarda ninguna
 * de las dos cosas: se calculan aquí a partir de `mensajes` y del `last_read_at`
 * de las preferencias del usuario. Alimenta la lista de grupos del chat.
 */
export async function listResumenCanales(): Promise<{
  ok: boolean;
  data: Record<string, ResumenCanal>;
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: true, data: {} };

    // 1. Canales accesibles para el usuario (mismo filtro que listCanales).
    const { data: canalesRows, error: canalesErr } = await supabase
      .from("canales")
      .select("id, empresa_id, nombre, tipo, miembros_user_ids, departamentos")
      .eq("empresa_id", empresaId);
    if (canalesErr) throw canalesErr;
    const ctx = await getAccesoCtx(supabase, user.id, empresaId);
    const canalIds = (canalesRows ?? [])
      .filter((row) => canalAccesible(row, ctx))
      .map((c) => c.id as string);
    if (canalIds.length === 0) return { ok: true, data: {} };

    // 2. Preferencias del usuario: hasta dónde leyó y si dejó marca manual.
    const { data: prefs } = await supabase
      .from("canales_preferencias")
      .select("canal_id, last_read_at, marcado_no_leido")
      .eq("user_id", user.id)
      .in("canal_id", canalIds);
    const lastReadMap = new Map<string, string | null>();
    const marcados = new Set<string>();
    for (const p of prefs ?? []) {
      lastReadMap.set(p.canal_id as string, (p.last_read_at as string | null) ?? null);
      if (p.marcado_no_leido) marcados.add(p.canal_id as string);
    }

    // 3. Mensajes recientes de esos canales (los más nuevos primero). De una
    //    sola pasada sacamos el último de cada canal y el conteo de no leídos.
    const { data: msgs, error: msgErr } = await supabase
      .from("mensajes")
      .select("canal_id, created_at, autor_id, texto, adjunto_tipo, adjunto_nombre")
      .in("canal_id", canalIds)
      .order("created_at", { ascending: false })
      .limit(3000);
    if (msgErr) throw msgErr;

    const data: Record<string, ResumenCanal> = {};
    for (const id of canalIds) {
      data[id] = {
        ultimoMensaje: null,
        ultimoMensajeAt: null,
        sinLeer: 0,
        marcadoNoLeido: marcados.has(id),
      };
    }

    for (const m of msgs ?? []) {
      const canalId = m.canal_id as string;
      const resumen = data[canalId];
      if (!resumen) continue;

      // Como vienen ordenados de más nuevo a más viejo, el primero de cada
      // canal es su último mensaje.
      if (!resumen.ultimoMensajeAt) {
        resumen.ultimoMensajeAt = m.created_at as string;
        resumen.ultimoMensaje = describirMensaje(m);
      }

      // Sin leer: mensajes de otros posteriores a tu last_read_at (o todos si
      // nunca abriste el canal).
      if ((m.autor_id as string | null) === user.id) continue;
      const lastRead = lastReadMap.get(canalId);
      if (!lastRead || (m.created_at as string) > lastRead) {
        resumen.sinLeer += 1;
      }
    }

    return { ok: true, data };
  } catch (err) {
    console.error("[comunicacion] listResumenCanales:", err);
    return { ok: true, data: {} };
  }
}

/** Texto corto que representa un mensaje en la lista de grupos. */
function describirMensaje(m: Record<string, unknown>): string {
  const texto = ((m.texto as string) ?? "").trim();
  if (texto) return texto;
  const tipo = m.adjunto_tipo as string | null;
  if (tipo === "imagen") return "📷 Foto";
  if (tipo === "audio") return "🎤 Audio";
  if (tipo === "archivo") return `📎 ${((m.adjunto_nombre as string) ?? "Archivo").trim()}`;
  return "";
}

// ───────── Lecturas (doble tick azul) ─────────

/**
 * Marca como leídos todos los mensajes ajenos del canal para el usuario actual.
 * Es lo que enciende el doble tick azul en el lado de quien los escribió.
 *
 * La operación es idempotente e irreversible por diseño: la RPC hace
 * `on conflict do nothing`, así que la hora guardada es la de la PRIMERA lectura
 * y no existe forma (ni acción, ni policy de update/delete) de deshacerla.
 */
export async function marcarMensajesLeidos(canalId: string) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };
    if (!(await assertAccesoCanal(supabase, user.id, empresaId, canalId))) {
      return { ok: false, error: "Sin acceso a este canal" };
    }
    const { error } = await supabase.rpc("chat_marcar_leidos", { p_canal: canalId });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] marcarMensajesLeidos:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Para cada mensaje PROPIO del canal, cuántas personas lo han leído.
 * Devuelve { [mensajeId]: nºLectores }. Con ≥1 el tick se pinta azul.
 */
export async function getLecturasCanal(canalId: string): Promise<{
  ok: boolean;
  data: Record<string, number>;
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: true, data: {} };
    if (!(await assertAccesoCanal(supabase, user.id, empresaId, canalId))) {
      return { ok: true, data: {} };
    }
    const { data, error } = await supabase.rpc("chat_lecturas_canal", { p_canal: canalId });
    if (error) throw error;
    const map: Record<string, number> = {};
    for (const r of (data ?? []) as Array<{ mensaje_id: string; lectores: number }>) {
      map[r.mensaje_id] = r.lectores ?? 0;
    }
    return { ok: true, data: map };
  } catch (err) {
    console.error("[comunicacion] getLecturasCanal:", err);
    return { ok: true, data: {} };
  }
}

export interface LectorMensaje {
  userId: string;
  nombre: string;
  leidoAt: string;
}

/** Quién ha leído un mensaje concreto y a qué hora ("Leído por…"). */
export async function getLectoresMensaje(mensajeId: string): Promise<{
  ok: boolean;
  data: LectorMensaje[];
}> {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: true, data: [] };
    const { data, error } = await supabase.rpc("chat_lectores_mensaje", {
      p_mensaje: mensajeId,
    });
    if (error) throw error;
    return {
      ok: true,
      data: ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
        const partes = [r.nombre, r.apellidos]
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim());
        return {
          userId: r.user_id as string,
          nombre: partes.join(" ") || "Sin nombre",
          leidoAt: r.leido_at as string,
        };
      }),
    };
  } catch (err) {
    console.error("[comunicacion] getLectoresMensaje:", err);
    return { ok: true, data: [] };
  }
}

export async function toggleFijado(mensajeId: string, fijado: boolean) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("mensajes")
      .update({ fijado })
      .eq("id", mensajeId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] toggleFijado:", msg);
    return { ok: false, error: msg };
  }
}
