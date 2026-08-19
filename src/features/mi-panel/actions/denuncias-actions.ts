"use server";

import { createHash, randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

export type ModalidadDenuncia = "nominal" | "anonima";

export type CategoriaDenuncia =
  | "acoso_laboral"
  | "discriminacion"
  | "seguridad_salud"
  | "irregularidad"
  | "trato_cliente"
  | "queja_general"
  | "otro";

export type EstadoDenuncia =
  | "recibida"
  | "en_investigacion"
  | "informacion_solicitada"
  | "resuelta"
  | "archivada";

export interface DenunciaRow {
  id: string;
  modalidad: ModalidadDenuncia;
  denunciante_nombre: string | null;
  categoria: CategoriaDenuncia;
  asunto: string;
  relato: string;
  fecha_hechos: string | null;
  lugar: string | null;
  personas_implicadas: string | null;
  testigos: string | null;
  estado: EstadoDenuncia;
  respuesta: string | null;
  notas_internas: string | null;
  revisado_at: string | null;
  cerrado_at: string | null;
  created_at: string;
}

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const empresaId = user ? await getEmpresaActivaForUser(supabase, user.id) : null;
  return { supabase, user, empresaId };
}

/** El código se entrega al denunciante; en BD solo se guarda su hash. */
function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo.trim().toUpperCase()).digest("hex");
}

/** Código legible, sin caracteres que se confundan al copiarlo a mano. */
function generarCodigo(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alfabeto[bytes[i] % alfabeto.length];
    if (i === 3 || i === 7) out += "-";
  }
  return out;
}

export interface PresentarDenunciaInput {
  modalidad: ModalidadDenuncia;
  categoria: CategoriaDenuncia;
  asunto: string;
  relato: string;
  fecha_hechos?: string | null;
  lugar?: string | null;
  personas_implicadas?: string | null;
  testigos?: string | null;
}

/**
 * Presenta una denuncia por el canal interno.
 *
 * En la modalidad anónima se inserta con el cliente admin y sin `user_id`:
 * no queda ningún vínculo entre la denuncia y quien la presenta. A cambio se
 * devuelve un código de seguimiento (solo esta vez) para poder consultarla.
 */
export async function presentarDenuncia(
  input: PresentarDenunciaInput,
): Promise<{ ok: boolean; codigoSeguimiento?: string; error?: string }> {
  try {
    const { supabase, user, empresaId } = await ctx();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };
    if (!input.asunto.trim()) return { ok: false, error: "El asunto es obligatorio" };
    if (!input.relato.trim()) return { ok: false, error: "Hay que describir los hechos" };

    const comun = {
      empresa_id: empresaId,
      categoria: input.categoria,
      asunto: input.asunto.trim(),
      relato: input.relato.trim(),
      fecha_hechos: input.fecha_hechos || null,
      lugar: input.lugar?.trim() || null,
      personas_implicadas: input.personas_implicadas?.trim() || null,
      testigos: input.testigos?.trim() || null,
      estado: "recibida" as const,
    };

    if (input.modalidad === "anonima") {
      const codigo = generarCodigo();
      // Cliente admin: la fila no se asocia a la sesión de quien la presenta.
      const admin = createAdminClient();
      const { error } = await admin.from("denuncias").insert({
        ...comun,
        modalidad: "anonima",
        user_id: null,
        denunciante_nombre: null,
        seguimiento_hash: hashCodigo(codigo),
      });
      if (error) throw error;
      return { ok: true, codigoSeguimiento: codigo };
    }

    const { data: perfil } = await supabase
      .from("usuarios")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error } = await supabase.from("denuncias").insert({
      ...comun,
      modalidad: "nominal",
      user_id: user.id,
      denunciante_nombre: (perfil?.full_name as string) ?? null,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[denuncias] presentarDenuncia:", msg);
    return { ok: false, error: msg };
  }
}

/** Denuncias que el empleado presentó a su nombre. Las anónimas no salen aquí. */
export async function listMisDenuncias(): Promise<{ ok: boolean; data: DenunciaRow[] }> {
  try {
    const { supabase, user, empresaId } = await ctx();
    if (!user || !empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("denuncias")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("modalidad", "nominal")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as DenunciaRow[] };
  } catch (err) {
    console.error("[denuncias] listMisDenuncias:", err);
    return { ok: false, data: [] };
  }
}

export interface SeguimientoAnonimo {
  categoria: string;
  asunto: string;
  estado: EstadoDenuncia;
  respuesta: string | null;
  created_at: string;
  revisado_at: string | null;
  cerrado_at: string | null;
}

/** Consulta de una denuncia anónima con su código. No revela identidad alguna. */
export async function consultarPorCodigo(
  codigo: string,
): Promise<{ ok: boolean; data?: SeguimientoAnonimo; error?: string }> {
  try {
    const { supabase, user } = await ctx();
    if (!user) return { ok: false, error: "No autenticado" };
    if (!codigo.trim()) return { ok: false, error: "Introduce el código" };

    const { data, error } = await supabase.rpc("consultar_denuncia_por_codigo", {
      p_hash: hashCodigo(codigo),
    });
    if (error) throw error;

    const fila = Array.isArray(data) ? data[0] : null;
    if (!fila) return { ok: false, error: "No hay ninguna denuncia con ese código" };
    return { ok: true, data: fila as SeguimientoAnonimo };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[denuncias] consultarPorCodigo:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Bandeja de RRHH ────────────────────────────────────────────────────────

/** Todas las denuncias de la empresa. La RLS ya restringe esto a RRHH. */
export async function listDenunciasRRHH(): Promise<{ ok: boolean; data: DenunciaRow[] }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("denuncias")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as DenunciaRow[] };
  } catch (err) {
    console.error("[denuncias] listDenunciasRRHH:", err);
    return { ok: false, data: [] };
  }
}

/** ¿El usuario actual puede acceder a la bandeja de denuncias? */
export async function puedeVerDenuncias(): Promise<boolean> {
  try {
    const { supabase, user } = await ctx();
    if (!user) return false;
    const { data, error } = await supabase.rpc("rol_puede_ver_denuncias", { uid: user.id });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("[denuncias] puedeVerDenuncias:", err);
    return false;
  }
}

export async function actualizarDenuncia(
  id: string,
  patch: { estado?: EstadoDenuncia; respuesta?: string | null; notas_internas?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user, empresaId } = await ctx();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };

    const upd: Record<string, unknown> = {
      ...patch,
      revisado_por: user.id,
      revisado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (patch.estado === "resuelta" || patch.estado === "archivada") {
      upd.cerrado_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("denuncias")
      .update(upd)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    if (patch.estado) {
      await supabase.from("denuncias_actuaciones").insert({
        denuncia_id: id,
        empresa_id: empresaId,
        tipo: `estado:${patch.estado}`,
        detalle: patch.respuesta ?? null,
        realizado_por: user.id,
      });
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[denuncias] actualizarDenuncia:", msg);
    return { ok: false, error: msg };
  }
}
