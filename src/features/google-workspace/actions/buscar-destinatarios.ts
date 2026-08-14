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

export interface Destinatario {
  nombre: string;
  email: string;
  /** De dónde sale, para que el usuario sepa a quién está escribiendo. */
  origen: "Agenda" | "Empleado";
  /** Cargo, empresa o departamento; ayuda a desambiguar homónimos. */
  detalle?: string;
}

const MAX = 8;

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

    // Un mismo correo puede estar en la agenda y como empleado: se deja uno.
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
