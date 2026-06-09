"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
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
  const { data: rolesRows } = await supabase
    .from("usuario_roles")
    .select("role")
    .eq("user_id", userId);
  const appRoles = (rolesRows ?? []).map((r) => r.role as string);
  const esAdmin = appRoles.includes("director") || appRoles.includes("admin");

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
        if (p?.ver && p.modulo) candidatos.push(p.modulo);
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
        })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] listEmpleadosEmpresa:", msg);
    return { ok: false, data: [], error: msg };
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
