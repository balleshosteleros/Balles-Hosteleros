/**
 * A QUIÉN va un comunicado. Fuente ÚNICA para los tres avisos: la campana de la
 * app, el push del móvil y el correo.
 *
 * Por qué existe y por qué usa la clave de servicio:
 * la tabla `usuarios` tiene una RLS que solo deja ver el PROPIO perfil. La
 * resolución anterior consultaba `usuarios` con la sesión de quien publicaba,
 * así que un comunicado "a toda la empresa" resolvía exactamente una persona:
 * el que le daba a publicar. Nadie más recibía ni aviso ni push. Y filtrar por
 * departamento o por rol no devolvía a nadie en absoluto.
 *
 * La audiencia son los LOGINS de la empresa (los suyos y los de quien la tiene
 * como secundaria), quitando a quien ya no trabaja allí. Se parte de los logins
 * y no de la plantilla porque hay usuarios sin ficha de empleado —dirección,
 * administración— que también tienen que enterarse.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface ComunicadoAudiencia {
  empresaId: string;
  titulo: string;
  cuerpo: string;
  estado: string;
  /** Logins que deben recibirlo (campana y push). */
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

  const empresaId = c.empresa_id;

  // 1) Logins de la empresa: los que la tienen como principal y los que la
  //    tienen como secundaria (quien trabaja en dos).
  const [principales, secundarias] = await Promise.all([
    supabase.from("usuarios").select("user_id").eq("empresa_id", empresaId),
    supabase.from("usuario_empresas").select("user_id").eq("empresa_id", empresaId),
  ]);
  const deLaEmpresa = new Set<string>();
  for (const fila of [...(principales.data ?? []), ...(secundarias.data ?? [])]) {
    const id = (fila as { user_id: string | null }).user_id;
    if (id) deLaEmpresa.add(id);
  }
  if (deLaEmpresa.size === 0) {
    return { ...VACIA, empresaId, titulo: c.titulo ?? "", cuerpo: c.cuerpo ?? "", estado: c.estado };
  }

  // 2) Fichas de empleado de esa empresa: dan el correo y dicen quién sigue.
  const { data: fichas } = await supabase
    .from("empleados")
    .select("user_id, estado, email_personal, email_empresa")
    .eq("empresa_id", empresaId);

  const porUsuario = new Map<
    string,
    { estado: string; email: string }
  >();
  for (const f of (fichas ?? []) as Array<{
    user_id: string | null;
    estado: string | null;
    email_personal: string | null;
    email_empresa: string | null;
  }>) {
    if (!f.user_id) continue;
    porUsuario.set(f.user_id, {
      estado: (f.estado ?? "").trim(),
      email: (f.email_empresa || f.email_personal || "").trim().toLowerCase(),
    });
  }

  // Quien tiene ficha en la empresa y NO está activo, fuera: un comunicado no
  // se le manda a quien ya causó baja. Quien no tiene ficha (dirección,
  // administración) se queda: es un login de la empresa igual.
  const candidatos = Array.from(deLaEmpresa).filter((id) => {
    const ficha = porUsuario.get(id);
    return !ficha || ficha.estado === "Activo";
  });

  // 3) A quién va, según lo elegido en la ficha del comunicado.
  let elegidos: string[];
  if (c.toda_empresa === true) {
    elegidos = candidatos;
  } else {
    const set = new Set<string>(
      (c.empleados_destinatarios ?? []).filter((id): id is string => !!id),
    );

    const departamentos = (c.departamentos_destinatarios ?? []).filter(Boolean).map(norm);
    const roles = (c.roles_destinatarios ?? []).filter(Boolean).map(norm);

    if ((departamentos.length > 0 || roles.length > 0) && candidatos.length > 0) {
      const { data: perfiles } = await supabase
        .from("usuarios")
        .select("user_id, departamento, rol_label")
        .in("user_id", candidatos);

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

    // Solo quien de verdad pertenece a la empresa y sigue en ella.
    elegidos = candidatos.filter((id) => set.has(id));
  }

  // El correo sale de su ficha de empleado. Quien no la tiene —dirección,
  // administración— recibe en el correo con el que entra al software, que es el
  // único que hay de esa persona.
  const sinFicha = elegidos.filter((id) => !porUsuario.get(id)?.email);
  const correoDeAcceso = new Map<string, string>();
  if (sinFicha.length > 0) {
    const { data: logins } = await supabase
      .from("usuarios")
      .select("user_id, email")
      .in("user_id", sinFicha);
    for (const l of (logins ?? []) as Array<{ user_id: string; email: string | null }>) {
      correoDeAcceso.set(l.user_id, (l.email ?? "").trim().toLowerCase());
    }
  }

  const emails = Array.from(
    new Set(
      elegidos
        .map((id) => porUsuario.get(id)?.email || correoDeAcceso.get(id) || "")
        .filter(esEmailUtil),
    ),
  );

  return {
    empresaId,
    titulo: c.titulo ?? "",
    cuerpo: c.cuerpo ?? "",
    estado: c.estado,
    userIds: elegidos,
    emails,
  };
}
