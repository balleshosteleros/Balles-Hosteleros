"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCatalogoEmpresa,
  type CatalogoEmpresaData,
} from "@/features/empresa/lib/empresa-server";

/**
 * Catálogo de módulos de OTRA empresa del usuario.
 *
 * Lo necesita el selector de empresa: para decidir a dónde te lleva al cambiar
 * de sociedad hay que saber qué módulos existen en la de DESTINO, y el contexto
 * del navegador todavía tiene el catálogo de la de origen. Sin esto, salir de
 * SALA en un restaurante te dejaba en SALA en una empresa que no tiene sala.
 *
 * Solo responde por empresas a las que el usuario tenga acceso.
 */
export async function getCatalogoEmpresaAction(
  empresaId: string,
): Promise<CatalogoEmpresaData | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminClient();
    const { data: acceso } = await admin
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!acceso) return null;

    return await getCatalogoEmpresa(empresaId);
  } catch {
    return null;
  }
}
