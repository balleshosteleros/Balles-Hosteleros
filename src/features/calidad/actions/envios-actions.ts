"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

export interface EnvioResumen {
  id: string;
  numero_secuencial: number;
  fecha: string;
  nota_final: number | null;
  estado: "borrador" | "enviada";
  plantilla_nombre: string;
  version: number;
  local_nombre: string;
  auditor_nombre: string;
}

export async function listEnvios(): Promise<EnvioResumen[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];

  const { data, error } = await supabase
    .from("auditoria_envios")
    .select(`
      id, numero_secuencial, fecha, nota_final, estado,
      plantilla:auditoria_plantillas!auditoria_envios_plantilla_id_fkey(nombre),
      version:auditoria_plantilla_versiones!auditoria_envios_version_id_fkey(version),
      local:locales!auditoria_envios_local_id_fkey(nombre),
      auditor:empleados!auditoria_envios_auditor_empleado_id_fkey(nombre, apellidos)
    `)
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: false });

  if (error || !data) {
    console.error("[auditorias] listEnvios:", error?.message);
    return [];
  }

  return data.map((e) => {
    const plantilla = Array.isArray(e.plantilla) ? e.plantilla[0] : e.plantilla;
    const version = Array.isArray(e.version) ? e.version[0] : e.version;
    const local = Array.isArray(e.local) ? e.local[0] : e.local;
    const auditor = Array.isArray(e.auditor) ? e.auditor[0] : e.auditor;
    return {
      id: e.id as string,
      numero_secuencial: e.numero_secuencial as number,
      fecha: e.fecha as string,
      nota_final: (e.nota_final as number | null) ?? null,
      estado: (e.estado as "borrador" | "enviada") ?? "enviada",
      plantilla_nombre: (plantilla?.nombre as string | undefined) ?? "—",
      version: (version?.version as number | undefined) ?? 1,
      local_nombre: (local?.nombre as string | undefined) ?? "—",
      auditor_nombre: auditor ? `${auditor.nombre ?? ""} ${auditor.apellidos ?? ""}`.trim() : "—",
    };
  });
}
