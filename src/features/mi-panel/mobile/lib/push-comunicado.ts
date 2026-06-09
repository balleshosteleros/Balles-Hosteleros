import "server-only";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "./push-server";

/**
 * Resuelve los destinatarios de un comunicado a user_ids únicos.
 * Soporta: toda_empresa, empleados_destinatarios, roles_destinatarios,
 *          departamentos_destinatarios.
 */
async function resolverDestinatariosUserIds(comunicadoId: string): Promise<{
  userIds: string[];
  empresaId: string | null;
  titulo: string;
  cuerpo: string;
}> {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("comunicados")
    .select(
      "id, empresa_id, titulo, cuerpo, estado, toda_empresa, roles_destinatarios, empleados_destinatarios, departamentos_destinatarios",
    )
    .eq("id", comunicadoId)
    .maybeSingle();
  if (!c || c.estado !== "publicado") {
    return { userIds: [], empresaId: null, titulo: "", cuerpo: "" };
  }

  const empresaId = c.empresa_id as string;
  const ids = new Set<string>();

  if (c.toda_empresa === true) {
    const { data: rows } = await supabase
      .from("usuarios")
      .select("user_id")
      .eq("empresa_id", empresaId);
    (rows ?? []).forEach((r) => r.user_id && ids.add(r.user_id as string));
  }

  const empleados = (c.empleados_destinatarios as string[] | null) ?? [];
  empleados.forEach((id) => id && ids.add(id));

  const departamentos = (c.departamentos_destinatarios as string[] | null) ?? [];
  if (departamentos.length > 0) {
    const { data: rows } = await supabase
      .from("usuarios")
      .select("user_id")
      .eq("empresa_id", empresaId)
      .in("departamento", departamentos);
    (rows ?? []).forEach((r) => r.user_id && ids.add(r.user_id as string));
  }

  const roles = (c.roles_destinatarios as string[] | null) ?? [];
  if (roles.length > 0) {
    const { data: rows } = await supabase
      .from("usuarios")
      .select("user_id")
      .eq("empresa_id", empresaId)
      .in("rol_label", roles);
    (rows ?? []).forEach((r) => r.user_id && ids.add(r.user_id as string));
  }

  return {
    userIds: Array.from(ids),
    empresaId,
    titulo: (c.titulo as string) ?? "",
    cuerpo: (c.cuerpo as string) ?? "",
  };
}

export async function notificarComunicadoNuevo(comunicadoId: string): Promise<void> {
  try {
    const { userIds, empresaId, titulo, cuerpo } =
      await resolverDestinatariosUserIds(comunicadoId);
    if (!empresaId || userIds.length === 0) return;

    const body = cuerpo
      ? cuerpo.length > 110
        ? `${cuerpo.slice(0, 110)}…`
        : cuerpo
      : "Toca para leer el comunicado completo";

    await Promise.all(
      userIds.map((userId) =>
        sendPushToUser({
          userId,
          empresaId,
          eventType: "comunicado_nuevo",
          payload: {
            title: titulo || "Nuevo comunicado",
            body,
            url: "/m/comunicados",
            tag: `comunicado-${comunicadoId}`,
            data: { url: "/m/comunicados" },
          },
        }),
      ),
    );
  } catch (e) {
    console.error("[push] notificarComunicadoNuevo:", e);
  }
}
