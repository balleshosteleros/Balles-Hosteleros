"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptOptional } from "../lib/crypto";
import {
  credencialSchema,
  credencialUpdateSchema,
  type Credencial,
  type CredencialInput,
  type CredencialUpdateInput,
  type DatoExtraInput,
} from "../data/tipos";

type DatoExtraCifrado = { nombre: string; valor_cifrado: string };

function cifrarDatosExtra(datos: DatoExtraInput[]): DatoExtraCifrado[] {
  return datos
    .filter((d) => d.nombre.trim() && d.valor.length > 0)
    .map((d) => ({ nombre: d.nombre.trim(), valor_cifrado: encryptOptional(d.valor) }));
}

/**
 * Devuelve SOLO las credenciales visibles para el usuario.
 *
 * SEGURIDAD: usa el cliente del USUARIO (no admin), de modo que la RLS
 * `app_credenciales_tenant_role_read` filtra por ROL VISIBLE. PROGRAMADOR
 * (Fernando) no recibe ninguna fila. NUNCA incluye contraseña ni valores extra.
 */
export async function listCredencialesVisibles(appId?: string): Promise<Credencial[]> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return [];

  let query = supabase
    .from("app_credenciales")
    .select(
      `id, app_id, empresa_id, etiqueta, usuario, url_especifica, notas,
       rol_responsable, datos_extra, created_at, updated_at,
       app_credencial_roles ( rol_id, empresa_roles ( id, nombre ) )`,
    )
    .eq("empresa_id", empresaId)
    .order("etiqueta", { ascending: true });

  if (appId) query = query.eq("app_id", appId);

  const { data, error } = await query;
  if (error) {
    console.error("[listCredencialesVisibles]", error);
    return [];
  }

  type RawRow = {
    id: string;
    app_id: string;
    empresa_id: string;
    etiqueta: string;
    usuario: string;
    url_especifica: string | null;
    notas: string;
    rol_responsable: string | null;
    datos_extra: Array<{ nombre: string; valor_cifrado: string }> | null;
    created_at: string;
    updated_at: string;
    app_credencial_roles: Array<{
      rol_id: string;
      empresa_roles: { id: string; nombre: string } | null;
    }>;
  };

  return (data as unknown as RawRow[]).map((row) => ({
    id: row.id,
    app_id: row.app_id,
    empresa_id: row.empresa_id,
    etiqueta: row.etiqueta,
    usuario: row.usuario,
    url_especifica: row.url_especifica,
    notas: row.notas,
    rol_responsable: row.rol_responsable ?? "",
    // Solo se exponen los NOMBRES de los datos extra; los valores se revelan aparte.
    datos_extra: (row.datos_extra ?? []).map((d) => ({ nombre: d.nombre })),
    created_at: row.created_at,
    updated_at: row.updated_at,
    roles: (row.app_credencial_roles ?? [])
      .map((acr) => acr.empresa_roles)
      .filter((r): r is { id: string; nombre: string } => r !== null),
  }));
}

export async function createCredencial(
  input: CredencialInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { userId, empresaId } = await getAppContext();
  if (!userId || !empresaId) return { ok: false, error: "No autenticado" };

  const parsed = credencialSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();

  // Verifica que la app pertenece a la empresa activa.
  const { data: app, error: appErr } = await admin
    .from("apps_externas")
    .select("id, empresa_id")
    .eq("id", parsed.data.app_id)
    .single();
  if (appErr || !app || app.empresa_id !== empresaId) {
    return { ok: false, error: "App inválida" };
  }

  // Verifica que TODOS los roles visibles pertenecen a la empresa activa.
  const { data: roles, error: rolesErr } = await admin
    .from("empresa_roles")
    .select("id")
    .eq("empresa_id", empresaId)
    .in("id", parsed.data.roles_ids);
  if (rolesErr || !roles || roles.length !== parsed.data.roles_ids.length) {
    return { ok: false, error: "Algún rol no pertenece a tu empresa" };
  }

  let passwordCifrado: string;
  let datosExtra: DatoExtraCifrado[];
  try {
    passwordCifrado = encryptOptional(parsed.data.password ?? "");
    datosExtra = cifrarDatosExtra(parsed.data.datos_extra ?? []);
  } catch (e) {
    return { ok: false, error: `Error de cifrado: ${(e as Error).message}` };
  }

  const { data: cred, error: insErr } = await admin
    .from("app_credenciales")
    .insert({
      app_id: parsed.data.app_id,
      empresa_id: empresaId,
      etiqueta: parsed.data.etiqueta,
      usuario: parsed.data.usuario ?? "",
      password_cifrado: passwordCifrado,
      url_especifica: parsed.data.url_especifica || null,
      notas: parsed.data.notas ?? "",
      rol_responsable: parsed.data.rol_responsable ?? "",
      datos_extra: datosExtra,
      created_by: userId,
    })
    .select("id")
    .single();
  if (insErr || !cred) return { ok: false, error: insErr?.message ?? "Error al guardar" };

  const credId = cred.id as string;
  const { error: rolesInsErr } = await admin.from("app_credencial_roles").insert(
    parsed.data.roles_ids.map((rolId) => ({
      credencial_id: credId,
      rol_id: rolId,
      empresa_id: empresaId,
    })),
  );
  if (rolesInsErr) {
    await admin.from("app_credenciales").delete().eq("id", credId);
    return { ok: false, error: rolesInsErr.message };
  }

  revalidatePath("/accesos");
  return { ok: true, id: credId };
}

export async function updateCredencial(
  id: string,
  input: CredencialUpdateInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { empresaId } = await getAppContext();
  if (!empresaId) return { ok: false, error: "No autenticado" };

  const parsed = credencialUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("app_credenciales")
    .select("id, empresa_id")
    .eq("id", id)
    .single();
  if (!existing || existing.empresa_id !== empresaId) {
    return { ok: false, error: "Credencial no encontrada" };
  }

  const { data: roles } = await admin
    .from("empresa_roles")
    .select("id")
    .eq("empresa_id", empresaId)
    .in("id", parsed.data.roles_ids);
  if (!roles || roles.length !== parsed.data.roles_ids.length) {
    return { ok: false, error: "Algún rol no pertenece a tu empresa" };
  }

  const updatePayload: Record<string, unknown> = {
    etiqueta: parsed.data.etiqueta,
    usuario: parsed.data.usuario ?? "",
    url_especifica: parsed.data.url_especifica || null,
    notas: parsed.data.notas ?? "",
    rol_responsable: parsed.data.rol_responsable ?? "",
  };

  try {
    // Contraseña: solo se re-cifra si se proporciona una nueva.
    if (parsed.data.password && parsed.data.password.length > 0) {
      updatePayload.password_cifrado = encryptOptional(parsed.data.password);
    }
    // Datos extra: se re-cifran y reemplazan por completo en cada guardado.
    updatePayload.datos_extra = cifrarDatosExtra(parsed.data.datos_extra ?? []);
  } catch (e) {
    return { ok: false, error: `Error de cifrado: ${(e as Error).message}` };
  }

  const { error: updErr } = await admin
    .from("app_credenciales")
    .update(updatePayload)
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (updErr) return { ok: false, error: updErr.message };

  await admin.from("app_credencial_roles").delete().eq("credencial_id", id);
  const { error: rolesInsErr } = await admin.from("app_credencial_roles").insert(
    parsed.data.roles_ids.map((rolId) => ({
      credencial_id: id,
      rol_id: rolId,
      empresa_id: empresaId,
    })),
  );
  if (rolesInsErr) return { ok: false, error: rolesInsErr.message };

  revalidatePath("/accesos");
  return { ok: true };
}

export async function deleteCredencial(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { empresaId } = await getAppContext();
  if (!empresaId) return { ok: false, error: "No autenticado" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("app_credenciales")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/accesos");
  return { ok: true };
}
