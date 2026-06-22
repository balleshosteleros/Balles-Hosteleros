/**
 * Resolución de destinatarios del motor de alertas (PRP-065). Server-only.
 *
 * `resolverDestinatarios(supabase, empresaId, segmento)` devuelve la lista de
 * `{ empleadoId, usuarioId }` deduplicada para un segmento, sobre los empleados
 * ACTIVOS con login de la empresa (incluyendo acceso multi-empresa vía
 * `usuario_empresas`). Acepta cualquier cliente (usuario con RLS o service role)
 * para poder usarse desde el panel manual, eventos y crons.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Destinatario, Segmento } from "@/features/notificaciones/types";

interface EmpleadoRow {
  id: string;
  user_id: string | null;
  empresa_id: string;
  departamento_id: string | null;
  departamentos:
    | { area?: string | null }
    | { area?: string | null }[]
    | null;
}

function area(row: EmpleadoRow): string | null {
  const d = Array.isArray(row.departamentos) ? row.departamentos[0] : row.departamentos;
  return d?.area ?? null;
}

export async function resolverDestinatarios(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: Segmento,
): Promise<Destinatario[]> {
  if (!empresaId) return [];

  // Segmento por logins concretos (emisores que ya resuelven en espacio user_id,
  // p. ej. comunicados/encuestas). Mapea a su ficha de esta empresa si existe;
  // si no, entrega igual por usuario_id (la bandeja filtra por usuario o ficha).
  if (segmento.tipo === "usuarios") {
    const ids = Array.from(new Set(segmento.usuarioIds.filter(Boolean)));
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from("empleados")
      .select("id, user_id")
      .in("user_id", ids)
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo");
    const fichaPorUser = new Map<string, string>();
    for (const e of data ?? []) {
      if (e.user_id) fichaPorUser.set(e.user_id as string, e.id as string);
    }
    return ids.map((uid) => ({ empleadoId: fichaPorUser.get(uid) ?? null, usuarioId: uid }));
  }

  // Acceso multi-empresa: usuarios con acceso secundario a esta empresa.
  const { data: accesosUE } = await supabase
    .from("usuario_empresas")
    .select("user_id")
    .eq("empresa_id", empresaId);
  const userIdsConAcceso = (accesosUE ?? []).map((r) => r.user_id as string);

  const filtro =
    userIdsConAcceso.length > 0
      ? `empresa_id.eq.${empresaId},user_id.in.(${userIdsConAcceso.join(",")})`
      : `empresa_id.eq.${empresaId}`;

  const { data, error } = await supabase
    .from("empleados")
    .select("id, user_id, empresa_id, departamento_id, departamentos(area)")
    .or(filtro)
    .eq("estado", "Activo");
  if (error) {
    console.error("[targeting] resolverDestinatarios:", error);
    return [];
  }

  let rows = (data ?? []) as EmpleadoRow[];
  // Solo personas con login (reciben en la app); requerido por la bandeja.
  rows = rows.filter((r) => !!r.user_id);

  // Dedup por user_id, prefiriendo la ficha de la empresa principal.
  const porUser = new Map<string, EmpleadoRow>();
  for (const e of rows) {
    const uid = e.user_id as string;
    const prev = porUser.get(uid);
    if (!prev) {
      porUser.set(uid, e);
      continue;
    }
    if (e.empresa_id === empresaId && prev.empresa_id !== empresaId) porUser.set(uid, e);
  }
  let candidatos = [...porUser.values()];

  // Filtro por segmento.
  switch (segmento.tipo) {
    case "empresa":
      break;
    case "empleados": {
      const set = new Set(segmento.empleadoIds);
      candidatos = candidatos.filter((e) => set.has(e.id));
      break;
    }
    case "departamento":
      candidatos = candidatos.filter((e) => e.departamento_id === segmento.departamentoId);
      break;
    case "area":
      candidatos = candidatos.filter((e) => area(e) === segmento.area);
      break;
    case "rol": {
      // El rol vive en usuarios.rol_label (espejo de empresa_roles.nombre).
      const userIds = candidatos.map((e) => e.user_id as string);
      if (userIds.length === 0) break;
      const { data: us } = await supabase
        .from("usuarios")
        .select("user_id, rol_label")
        .in("user_id", userIds);
      const objetivo = segmento.rolLabel.trim().toLowerCase();
      const rolesPorUser = new Map<string, string>();
      for (const u of us ?? []) {
        rolesPorUser.set(u.user_id as string, ((u.rol_label as string | null) ?? "").trim().toLowerCase());
      }
      candidatos = candidatos.filter((e) => rolesPorUser.get(e.user_id as string) === objetivo);
      break;
    }
  }

  return candidatos.map((e) => ({ empleadoId: e.id, usuarioId: e.user_id as string }));
}
