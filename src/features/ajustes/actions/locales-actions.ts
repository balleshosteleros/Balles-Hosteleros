"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, role: null };
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("empresa_id, role")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id),
  ]);
  const appRole = (roles ?? [])
    .map((r) => (r.role as string | null) ?? null)
    .find((role) => role === "admin" || role === "director")
    ?? (profile?.role as string | null)
    ?? null;
  return {
    supabase,
    user,
    empresaId: profile?.empresa_id ?? null,
    role: appRole,
  };
}

/**
 * Devuelve la empresa con la que operar. Si se pasa `empresaIdOverride`,
 * admin y director pueden usarlo; el resto se queda con la suya.
 */
function resolverEmpresa(
  empresaId: string | null,
  role: string | null,
  empresaIdOverride?: string | null
): string | null {
  if (empresaIdOverride && (role === "admin" || role === "director")) return empresaIdOverride;
  return empresaId;
}

async function resolveEmpresaAutorizada(
  userId: string,
  empresaId: string | null,
  role: string | null,
  empresaIdOverride?: string | null
): Promise<string | null> {
  const target = resolverEmpresa(empresaId, role, empresaIdOverride);
  if (!target) return null;
  if (!empresaIdOverride || target === empresaId) return target;

  const supabase = await createClient();
  const { data: acceso } = await supabase
    .from("user_empresas")
    .select("empresa_id")
    .eq("user_id", userId)
    .eq("empresa_id", target)
    .maybeSingle();

  if (acceso) return target;
  return null;
}

const localSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(120),
  direccion: z.string().max(300).optional().nullable(),
  ciudad: z.string().max(120).optional().nullable(),
  codigo_postal: z.string().max(12).optional().nullable(),
  pais: z.string().max(80).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  radio_metros: z.number().int().min(20).max(5000).default(100),
  color: z.string().max(40).optional().nullable(),
  notas: z.string().max(500).optional().nullable(),
  activo: z.boolean().optional(),
});

export type LocalInput = z.infer<typeof localSchema>;

export async function listLocales(empresaIdOverride?: string | null) {
  try {
    const { user, empresaId, role } = await getContext();
    if (!user) return { ok: false, data: [], error: "No autenticado" };
    const target = await resolveEmpresaAutorizada(
      user.id,
      empresaId,
      role,
      empresaIdOverride
    );
    if (!target) return { ok: false, data: [], error: "Sin empresa activa" };
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("locales")
      .select(
        "id, empresa_id, nombre, direccion, ciudad, codigo_postal, pais, lat, lng, radio_metros, color, notas, activo, created_at, updated_at"
      )
      .eq("empresa_id", target)
      .order("nombre", { ascending: true });
    if (error) throw error;

    const ids = (data ?? []).map((c) => c.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: empleados } = await admin
        .from("empleados")
        .select("local_id")
        .in("local_id", ids);
      counts = (empleados ?? []).reduce<Record<string, number>>((acc, e) => {
        if (e.local_id) acc[e.local_id] = (acc[e.local_id] ?? 0) + 1;
        return acc;
      }, {});
    }
    return {
      ok: true,
      data: (data ?? []).map((c) => ({ ...c, empleados_count: counts[c.id] ?? 0 })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] list:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function createLocal(
  input: LocalInput,
  empresaIdOverride?: string | null
) {
  try {
    const parsed = localSchema.parse(input);
    const { user, empresaId, role } = await getContext();
    const target = user
      ? await resolveEmpresaAutorizada(user.id, empresaId, role, empresaIdOverride)
      : null;
    if (!user || !target) return { ok: false, error: "No autenticado" };
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("locales")
      .insert({
        empresa_id: target,
        nombre: parsed.nombre,
        direccion: parsed.direccion ?? null,
        ciudad: parsed.ciudad ?? null,
        codigo_postal: parsed.codigo_postal ?? null,
        pais: parsed.pais ?? "España",
        lat: parsed.lat ?? null,
        lng: parsed.lng ?? null,
        radio_metros: parsed.radio_metros,
        color: parsed.color ?? "bg-violet-500",
        notas: parsed.notas ?? null,
        activo: parsed.activo ?? true,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateLocal(id: string, input: Partial<LocalInput>) {
  try {
    const parsed = localSchema.partial().parse(input);
    const { supabase } = await getContext();
    const { error } = await supabase.from("locales").update(parsed).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteLocal(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("locales").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] delete:", msg);
    return { ok: false, error: msg };
  }
}

export async function listEmpleadosLocal(localId: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("empleados")
      .select("id, nombre, apellidos, estado, permite_teletrabajo")
      .eq("empresa_id", empresaId)
      .eq("local_id", localId)
      .order("nombre");
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, data: [], error: msg };
  }
}

export async function listEmpleadosEmpresaParaLocales(
  empresaIdOverride?: string | null
) {
  try {
    const { user, empresaId, role } = await getContext();
    if (!user) return { ok: false, data: [] };
    const target = await resolveEmpresaAutorizada(
      user.id,
      empresaId,
      role,
      empresaIdOverride
    );
    if (!target) return { ok: false, data: [] };
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("empleados")
      .select("id, nombre, apellidos, estado, local_id, permite_teletrabajo")
      .eq("empresa_id", target)
      .order("nombre");
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, data: [], error: msg };
  }
}

export async function asignarLocalEmpleado(
  empleadoId: string,
  localId: string | null
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("empleados")
      .update({ local_id: localId })
      .eq("id", empleadoId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] asignarLocalEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

export async function setEmpleadoTeletrabajo(
  empleadoId: string,
  permite: boolean
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("empleados")
      .update({ permite_teletrabajo: permite })
      .eq("id", empleadoId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}
