import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

/** Empresa mostrable en el selector de empresa del móvil. */
export interface InicioEmpresa {
  id: string;
  nombre: string;
  isotipoUrl: string | null;
  logoUrl: string | null;
  color: string | null;
}

/**
 * Identidad del usuario en el móvil: quién es y en qué empresa está.
 *
 * Vive aparte del Inicio porque la cabecera de CUALQUIER pantalla (módulo o
 * submódulo) la necesita: el icono de empresa nunca puede desaparecer, para
 * poder cambiar de empresa desde donde estés (Iván, 28-ago).
 */
export interface MobileIdentidad {
  nombre: string;
  rolLabel: string | null;
  avatarUrl: string | null;
  empresaActual: InicioEmpresa | null;
  empresas: InicioEmpresa[];
}

/** "RECURSOS HUMANOS" → "Recursos humanos" (sentence case, regla de UI). */
export function aSentenceCase(s: string | null): string | null {
  if (!s) return null;
  const limpio = s.trim();
  if (!limpio) return null;
  // Siglas reales se quedan tal cual (RRHH, IT…): si es ≤4 y todo mayúsculas.
  if (limpio.length <= 4 && limpio === limpio.toUpperCase() && !limpio.includes(" ")) {
    return limpio;
  }
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}

const VACIO: MobileIdentidad = {
  nombre: "Empleado",
  rolLabel: null,
  avatarUrl: null,
  empresaActual: null,
  empresas: [],
};

export async function getMobileIdentidad(): Promise<MobileIdentidad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return VACIO;

  // Las lecturas del propio perfil/empresa van por el cliente admin: la RLS de
  // `empresas` (user_has_empresa_access) solo mira usuario_empresas y se deja
  // fuera la empresa principal del perfil, así que con el cliente del usuario
  // la empresa no se leía. Es el dato del propio usuario autenticado.
  const admin = createAdminClient();
  const empresaActivaId = await getEmpresaActivaForUser(admin, user.id);

  const [{ data: profile }, { data: linkRows }] = await Promise.all([
    admin
      .from("usuarios")
      .select("nombre, apellidos, avatar_url, rol_label, empresa_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("usuario_empresas").select("empresa_id").eq("user_id", user.id),
  ]);

  let nombre = `${profile?.nombre ?? ""} ${profile?.apellidos ?? ""}`.trim();
  if (!nombre) nombre = user.email?.split("@")[0] ?? "Empleado";

  // Conjunto de empresas accesibles: principal del perfil ∪ usuario_empresas.
  const idsEmpresa = new Set<string>();
  if (profile?.empresa_id) idsEmpresa.add(profile.empresa_id as string);
  for (const r of linkRows ?? []) idsEmpresa.add(r.empresa_id as string);

  let empresas: InicioEmpresa[] = [];
  if (idsEmpresa.size > 0) {
    const { data: empRows } = await admin
      .from("empresas")
      .select("id, nombre, logo_url, isotipo_url, color")
      .in("id", Array.from(idsEmpresa));
    empresas = (empRows ?? []).map((e) => ({
      id: e.id as string,
      nombre: (e.nombre as string) ?? "Empresa",
      isotipoUrl: (e.isotipo_url as string | null) ?? null,
      logoUrl: (e.logo_url as string | null) ?? null,
      color: (e.color as string | null) ?? null,
    }));
    empresas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  const empresaActual =
    empresas.find((e) => e.id === empresaActivaId) ??
    empresas.find((e) => e.id === profile?.empresa_id) ??
    empresas[0] ??
    null;

  return {
    nombre,
    rolLabel: aSentenceCase((profile?.rol_label as string | null) ?? null),
    avatarUrl: (profile?.avatar_url as string | null) ?? null,
    empresaActual,
    empresas,
  };
}
