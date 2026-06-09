import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { getHorarioDia, type Tramo } from "@/features/rrhh/utils/horario-empleado";

/** Empresa mostrable en el selector del Inicio móvil. */
export interface InicioEmpresa {
  id: string;
  nombre: string;
  isotipoUrl: string | null;
  logoUrl: string | null;
  color: string | null;
}

/** Jornada del empleado para hoy, resuelta desde cuadrantes/turnos. */
export type JornadaHoy =
  | { tipo: "libra" }
  | { tipo: "trabaja"; tramos: Tramo[] }
  | { tipo: "flexible"; horas: number }
  | { tipo: "desconocida" };

export interface MobileInicioData {
  nombre: string;
  rolLabel: string | null;
  avatarUrl: string | null;
  empresaActual: InicioEmpresa | null;
  empresas: InicioEmpresa[];
  jornadaHoy: JornadaHoy;
}

/** "RECURSOS HUMANOS" → "Recursos humanos" (sentence case, regla de UI). */
function aSentenceCase(s: string | null): string | null {
  if (!s) return null;
  const limpio = s.trim();
  if (!limpio) return null;
  // Siglas reales se quedan tal cual (RRHH, IT…): si es ≤4 y todo mayúsculas.
  if (limpio.length <= 4 && limpio === limpio.toUpperCase() && !limpio.includes(" ")) {
    return limpio;
  }
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}

function todayISO(): string {
  // Fecha en zona Madrid (coherente con el resto del fichaje).
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export async function getMobileInicioData(): Promise<MobileInicioData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Las lecturas del propio perfil/empresa van por el cliente admin: la RLS de
  // `empresas` (user_has_empresa_access) solo mira usuario_empresas y se deja
  // fuera la empresa principal del perfil, así que con el cliente del usuario
  // la empresa no se leía. Es el dato del propio usuario autenticado.
  const admin = createAdminClient();

  const vacio: MobileInicioData = {
    nombre: "Empleado",
    rolLabel: null,
    avatarUrl: null,
    empresaActual: null,
    empresas: [],
    jornadaHoy: { tipo: "desconocida" },
  };
  if (!user) return vacio;

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

  // Jornada de hoy (libra / trabaja con tramos / flexible) en la empresa activa.
  let jornadaHoy: JornadaHoy = { tipo: "desconocida" };
  const empresaParaHorario = empresaActual?.id ?? empresaActivaId;
  if (empresaParaHorario) {
    const { data: empleado } = await admin
      .from("empleados")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (empleado?.id) {
      try {
        const horario = await getHorarioDia(
          admin,
          empresaParaHorario,
          empleado.id as string,
          todayISO(),
        );
        if (horario.tipo === "ninguno") jornadaHoy = { tipo: "libra" };
        else if (horario.tipo === "fijo") jornadaHoy = { tipo: "trabaja", tramos: horario.tramos };
        else jornadaHoy = { tipo: "flexible", horas: horario.objetivoHoras };
      } catch {
        jornadaHoy = { tipo: "desconocida" };
      }
    }
  }

  return {
    nombre,
    rolLabel: aSentenceCase((profile?.rol_label as string | null) ?? null),
    avatarUrl: (profile?.avatar_url as string | null) ?? null,
    empresaActual,
    empresas,
    jornadaHoy,
  };
}
