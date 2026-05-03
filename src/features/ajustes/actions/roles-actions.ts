"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface PermisoModulo {
  modulo: string;
  ver: boolean;
  editar: boolean;
}

interface Rol {
  id: string;
  nombre: string;
  descripcion?: string;
  permisos: PermisoModulo[];
}

async function getEmpresaId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();
    
  return profile?.empresa_id || "780967a5-5028-4f3e-956e-8217f09876a5";
}

export async function saveRolesToSupabase(roles: Rol[]): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const empresa_id = await getEmpresaId()

    const rolesToSave = roles.map((r) => {
      const payload: any = {
        empresa_id,
        nombre: r.nombre,
        descripcion: r.descripcion,
        permisos: r.permisos,
      }
      if (r.id && !r.id.startsWith('rol-')) {
        payload.id = r.id
      }
      return payload
    })

    const { error: upsertError } = await supabase
      .from('empresa_roles')
      .upsert(rolesToSave, { onConflict: 'id' })

    if (upsertError) {
      console.error('Error en upsert:', upsertError)
      const { error: deleteError } = await supabase
        .from('empresa_roles')
        .delete()
        .eq('empresa_id', empresa_id)

      if (deleteError) return { error: deleteError.message }

      const { error: insertError } = await supabase
        .from('empresa_roles')
        .insert(rolesToSave)

      if (insertError) return { error: insertError.message }
    }

    revalidatePath("/ajustes");
    return {}
  } catch (e) {
    console.error('Excepción en saveRoles:', e)
    return { error: String(e) }
  }
}

export async function loadRolesFromSupabase(): Promise<Rol[]> {
  try {
    const supabase = await createClient()
    const empresa_id = await getEmpresaId()

    const { data, error } = await supabase
      .from('empresa_roles')
      .select('*')
      .eq('empresa_id', empresa_id)
      .order('nombre')

    if (error) throw error
    return data || []
  } catch (e) {
    console.error('Error loading roles:', e)
    return []
  }
}

export async function deleteRolFromSupabase(rolId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("empresa_roles")
    .delete()
    .eq("id", rolId);
    
  if (error) throw error;
  revalidatePath("/ajustes");
}
