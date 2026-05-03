"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Verifica si el usuario actual tiene privilegios de administrador.
 * En esta versión profesional, consideramos que cualquier usuario logueado 
 * vía Google (OAuth) es un administrador o director con acceso completo.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return false;
  }

  // Si el usuario entró por Google, le damos acceso total de administración
  const isGoogleUser = user.app_metadata?.provider === 'google' || 
                       user.identities?.some(id => id.provider === 'google');
  
  if (isGoogleUser) {
    return true;
  }

  // Verificación secundaria por perfil si no es Google
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  return profile?.rol === 'admin' || profile?.rol === 'director';
}

/**
 * Obtiene el ID de la empresa del usuario actual.
 */
export async function getEmpresaId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single();

  return profile?.empresa_id || "780967a5-5028-4f3e-956e-8217f09876a5";
}
