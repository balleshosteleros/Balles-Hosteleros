/**
 * A QUIÉN va un comunicado. Fuente ÚNICA para los tres avisos: la campana de la
 * app, el push del móvil y el correo.
 *
 * La audiencia son los EMPLEADOS ACTIVOS de la empresa, y solo ellos. Es lo
 * mismo que ofrece la ficha del comunicado, donde se elige por persona de una
 * lista de empleados: si "toda la empresa" incluyera además cualquier login,
 * el comunicado acabaría en cuentas que no son nadie de la plantilla —pasó: se
 * colaba la cuenta de pruebas de Ágora—.
 *
 * Por qué usa la clave de servicio: la tabla `usuarios` tiene una RLS que solo
 * deja ver el PROPIO perfil. La resolución anterior la consultaba con la sesión
 * de quien publicaba, así que un comunicado "a toda la empresa" resolvía
 * exactamente una persona —la que le daba a publicar— y filtrar por
 * departamento o por rol no devolvía a nadie.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface ComunicadoAudiencia {
  empresaId: string;
  titulo: string;
  cuerpo: string;
  estado: string;
  /** Logins de los empleados destinatarios (campana y push). */
  userIds: string[];
  /** Direcciones de correo, ya limpias y sin repetir. */
  emails: string[];
}

interface FilaComunicado {
  empresa_id: string;
  titulo: string | null;
  cuerpo: string | null;
  estado: string;
  toda_empresa: boolean;
  roles_destinatarios: string[] | null;
  departamentos_destinatarios: string[] | null;
  empleados_destinatarios: string[] | null;
}

const VACIA: ComunicadoAudiencia = {
  empresaId: "",
  titulo: "",
  cuerpo: "",
  estado: "",
  userIds: [],
  emails: [],
};

/** Un correo de migración o vacío no es una dirección a la que escribir. */
function esEmailUtil(e: string): boolean {
  return e.includes("@") && !e.endsWith("@sin-email.migracion");
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Resuelve la audiencia de un comunicado ya publicado.
 *
 * Devuelve la audiencia vacía si el comunicado no existe o aún no está
 * publicado: un borrador o un programado no debe avisar a nadie.
 */
export async function resolverAudienciaComunicado(
  comunicadoId: string,
): Promise<ComunicadoAudiencia> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("comunicados")
    .select(
      "empresa_id, titulo, cuerpo, estado, toda_empresa, roles_destinatarios, departamentos_destinatarios, empleados_destinatarios",
    )
    .eq("id", comunicadoId)
    .maybeSingle();
  if (error) {
    console.error("[comunicado-destinatarios] lectura:", error.message);
    return VACIA;
  }
  const c = data as FilaComunicado | null;
  if (!c || c.estado !== "publicado") return VACIA;

  const base = {
    empresaId: c.empresa_id,
    titulo: c.titulo ?? "",
    cuerpo: c.cuerpo ?? "",
    estado: c.estado,
  };

  // 1) La plantilla ACTIVA de esa empresa. Nadie más.
  const { data: fichas } = await supabase
    .from("empleados")
    .select("user_id, email_personal, email_empresa")
    .eq("empresa_id", c.empresa_id)
    .eq("estado", "Activo");

  const plantilla = (fichas ?? []) as Array<{
    user_id: string | null;
    email_personal: string | null;
    email_empresa: string | null;
  }>;
  if (plantilla.length === 0) return { ...VACIA, ...base };

  // El correo del trabajo manda sobre el personal; ver [[emails_empleado]].
  const correoDe = new Map<string, string>();
  for (const f of plantilla) {
    if (!f.user_id) continue;
    correoDe.set(
      f.user_id,
      (f.email_empresa || f.email_personal || "").trim().toLowerCase(),
    );
  }
  // Quien todavía no tiene login no puede recibir el aviso en la app, pero el
  // correo sí le llega: sigue siendo de la plantilla.
  const correosSinLogin = plantilla
    .filter((f) => !f.user_id)
    .map((f) => (f.email_empresa || f.email_personal || "").trim().toLowerCase());

  const conLogin = Array.from(correoDe.keys());

  // 2) A quién va, según lo elegido en la ficha del comunicado.
  let elegidos: string[];
  let emailsExtra: string[] = [];

  if (c.toda_empresa === true) {
    elegidos = conLogin;
    emailsExtra = correosSinLogin;
  } else {
    const set = new Set<string>(
      (c.empleados_destinatarios ?? []).filter((id): id is string => !!id),
    );

    const departamentos = (c.departamentos_destinatarios ?? []).filter(Boolean).map(norm);
    const roles = (c.roles_destinatarios ?? []).filter(Boolean).map(norm);

    if ((departamentos.length > 0 || roles.length > 0) && conLogin.length > 0) {
      // El departamento y el puesto de cada persona viven en `usuarios`.
      const { data: perfiles } = await supabase
        .from("usuarios")
        .select("user_id, departamento, rol_label")
        .in("user_id", conLogin);

      for (const p of (perfiles ?? []) as Array<{
        user_id: string;
        departamento: string | null;
        rol_label: string | null;
      }>) {
        const dep = norm(p.departamento);
        const rol = norm(p.rol_label);
        // El departamento cuenta también como "rol": en la ficha del comunicado
        // las dos listas se solapan, porque el rol se etiqueta con el área.
        if (
          (dep && departamentos.includes(dep)) ||
          (rol && roles.includes(rol)) ||
          (dep && roles.includes(dep))
        ) {
          set.add(p.user_id);
        }
      }
    }

    // Solo quien de verdad está en la plantilla activa de esta empresa.
    elegidos = conLogin.filter((id) => set.has(id));
  }

  const emails = Array.from(
    new Set(
      [...elegidos.map((id) => correoDe.get(id) ?? ""), ...emailsExtra].filter(esEmailUtil),
    ),
  );

  return { ...base, userIds: elegidos, emails };
}
