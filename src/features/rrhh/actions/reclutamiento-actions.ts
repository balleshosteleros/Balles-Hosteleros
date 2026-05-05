"use server";

import { createClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .single();
  return { supabase, user, empresaId: data?.empresa_id ?? null };
}

export async function listCandidatos() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("candidatos")
      .select("*, vacantes(id,titulo,puesto_id,departamento_id)")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[reclutamiento] listCandidatos:", err);
    return { ok: false, data: [] };
  }
}

export async function createCandidato(input: {
  nombre: string;
  apellidos?: string;
  email: string;
  telefono?: string;
  dni_nie?: string;
  vacante_id?: string;
  cv_url?: string;
  carta_presentacion?: string;
  origen?: "web" | "formulario" | "redes_sociales" | "recomendacion" | "base_datos" | "portal_empleo" | "otros";
  notas?: string;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("candidatos")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        apellidos: input.apellidos ?? null,
        email: input.email,
        telefono: input.telefono ?? null,
        dni_nie: input.dni_nie ?? null,
        vacante_id: input.vacante_id ?? null,
        cv_url: input.cv_url ?? null,
        carta_presentacion: input.carta_presentacion ?? null,
        origen: input.origen ?? "formulario",
        notas: input.notas ?? null,
        fase: "nuevo",
        estado: "nuevo",
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reclutamiento] createCandidato:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCandidato(
  id: string,
  input: {
    nombre?: string;
    apellidos?: string;
    email?: string;
    telefono?: string;
    dni_nie?: string;
    vacante_id?: string;
    cv_url?: string;
    notas?: string;
    fase?: string;
    estado?: string;
    puntuacion?: number;
  }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("candidatos")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reclutamiento] updateCandidato:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCandidato(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("candidatos")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reclutamiento] deleteCandidato:", msg);
    return { ok: false, error: msg };
  }
}
