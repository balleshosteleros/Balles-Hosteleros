"use server";

/**
 * Búsqueda de destinatarios ya guardados en el software, para autocompletar el
 * campo "Para" del compositor de correo.
 *
 * Reúne las agendas donde de verdad hay correos: la agenda de contactos y la
 * plantilla (empleados). Todo acotado a la EMPRESA ACTIVA — nunca se sugiere el
 * correo de otra empresa.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { googleFetchAuto } from "@/lib/google/api";

export interface Destinatario {
  nombre: string;
  email: string;
  /** De dónde sale, para que el usuario sepa a quién está escribiendo. */
  origen: "Agenda" | "Empleado" | "Gmail";
  /** Cargo, empresa o departamento; ayuda a desambiguar homónimos. */
  detalle?: string;
}

const MAX = 8;

type PeopleResp = {
  results?: Array<{
    person?: {
      names?: Array<{ displayName?: string }>;
      emailAddresses?: Array<{ value?: string }>;
      organizations?: Array<{ name?: string; title?: string }>;
    };
  }>;
};

/**
 * Contactos de la cuenta de Google ya vinculada. Cubre DOS fuentes:
 *  · `people:searchContacts`  → la agenda de Google del usuario.
 *  · `otherContacts:search`   → direcciones con las que ha intercambiado
 *    correo aunque nunca las guardara. Aquí es donde aparece, por ejemplo, la
 *    gestoría a la que se escribe cada trimestre.
 *
 * Esto es lo que hace que una empresa nueva tenga sus contactos disponibles en
 * cuanto vincula el correo, SIN que nadie tenga que importar nada a mano.
 */
async function buscarEnGoogle(q: string): Promise<Destinatario[]> {
  const endpoints = ["people:searchContacts", "otherContacts:search"] as const;
  const out: Destinatario[] = [];

  for (const ep of endpoints) {
    try {
      const url = new URL(`https://people.googleapis.com/v1/${ep}`);
      url.searchParams.set("query", q);
      url.searchParams.set("pageSize", "10");
      // `otherContacts` no admite `organizations` en el readMask.
      url.searchParams.set(
        "readMask",
        ep === "otherContacts:search"
          ? "names,emailAddresses"
          : "names,emailAddresses,organizations",
      );

      const { data, needsReauth } = await googleFetchAuto<PeopleResp>(url.toString());
      if (needsReauth) return out;

      for (const r of data?.results ?? []) {
        const email = r.person?.emailAddresses?.[0]?.value;
        if (!email) continue;
        const org = r.person?.organizations?.[0];
        out.push({
          nombre: r.person?.names?.[0]?.displayName ?? email,
          email,
          origen: "Gmail",
          detalle: [org?.title, org?.name].filter(Boolean).join(" · ") || undefined,
        });
      }
    } catch (err) {
      // Sin cuenta vinculada o sin permisos: no es un error, simplemente no hay
      // sugerencias de Google. Las de agenda y empleados siguen funcionando.
      console.error(`[correo] buscarEnGoogle(${ep}):`, err);
    }
  }
  return out;
}

export async function buscarDestinatarios(
  termino: string,
): Promise<{ ok: boolean; data: Destinatario[] }> {
  try {
    const q = termino.trim();
    if (q.length < 2) return { ok: true, data: [] };

    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };

    const patron = `%${q}%`;
    const resultados: Destinatario[] = [];

    // Agenda de contactos.
    const { data: agenda } = await supabase
      .from("contactos_agenda")
      .select("nombre, email, empresa_contacto, categoria")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .not("email", "is", null)
      .or(`nombre.ilike.${patron},email.ilike.${patron},empresa_contacto.ilike.${patron}`)
      .limit(MAX);

    for (const c of (agenda ?? []) as Array<{
      nombre: string | null;
      email: string | null;
      empresa_contacto: string | null;
      categoria: string | null;
    }>) {
      if (!c.email) continue;
      resultados.push({
        nombre: c.nombre ?? c.email,
        email: c.email,
        origen: "Agenda",
        detalle: [c.empresa_contacto, c.categoria].filter(Boolean).join(" · ") || undefined,
      });
    }

    // Empleados: se prefiere el correo de empresa sobre el personal.
    // Solo ACTIVOS: no se sugiere escribir a un ex-empleado.
    const { data: empleados } = await supabase
      .from("empleados")
      .select("nombre, apellidos, email_empresa, email_personal, puesto")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo")
      .or(
        `nombre.ilike.${patron},apellidos.ilike.${patron},email_empresa.ilike.${patron},email_personal.ilike.${patron}`,
      )
      .limit(MAX);

    for (const e of (empleados ?? []) as Array<{
      nombre: string | null;
      apellidos: string | null;
      email_empresa: string | null;
      email_personal: string | null;
      puesto: string | null;
    }>) {
      const email = e.email_empresa || e.email_personal;
      if (!email) continue;
      resultados.push({
        nombre: [e.nombre, e.apellidos].filter(Boolean).join(" ") || email,
        email,
        origen: "Empleado",
        detalle: e.puesto ?? undefined,
      });
    }

    // Contactos de la cuenta de Google vinculada (agenda + con quien se ha
    // intercambiado correo). Van DESPUÉS para que, ante el mismo correo, gane
    // la ficha propia del software, que trae puesto/empresa.
    resultados.push(...(await buscarEnGoogle(q)));

    // Un mismo correo puede estar en varias fuentes: se deja la primera.
    const vistos = new Set<string>();
    const unicos = resultados.filter((r) => {
      const clave = r.email.toLowerCase();
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });

    return { ok: true, data: unicos.slice(0, MAX) };
  } catch (err) {
    console.error("[correo] buscarDestinatarios:", err);
    return { ok: false, data: [] };
  }
}
