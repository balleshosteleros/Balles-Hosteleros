import { redirect } from "next/navigation";
import { AppLayout } from "@/features/layout/components/app-layout";
import { getEmpleadoGuardStatus } from "@/features/primer-acceso/data/empleado-status";
import { getUserPermisos } from "@/features/auth/actions/permisos-actions";
import { AuthServerSeed, type AppRole } from "@/features/auth/contexts/auth-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { shouldShowWizard, hasUser } = await getEmpleadoGuardStatus();
  // Sin sesión → login. Refuerza al middleware, que en producción deja pasar
  // las rutas de módulo sin sesión (fail-open). ?auth=1 evita el rebote móvil.
  if (!hasUser) {
    redirect("/?auth=1");
  }
  // Empleado con perfil_completado=false → wizard bloqueante.
  if (shouldShowWizard) {
    redirect("/primer-acceso");
  }

  // Permisos del menú resueltos EN SERVIDOR (misma región que la BD) y
  // sembrados al AuthProvider antes del primer paint: el sidebar no espera a
  // la cola de server actions del arranque ni depende de la caché localStorage.
  // Solo visibilidad de UI — la autorización real sigue en cada action/route.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let seed: React.ReactNode = null;
  if (user) {
    const p = await getUserPermisos();
    // Guard anti-carrera (paridad con looksRaceFailure de loadFreshAuth): si la
    // resolución llegó a medias (sin empresa), NO sembramos ni cacheamos datos
    // incompletos — el cliente seguirá su flujo normal con reintentos.
    if (p.empresaId != null) {
      seed = (
        <AuthServerSeed
          payload={{
            userId: user.id,
            roles: p.appRoles as AppRole[],
            permisos: p.permisos,
          }}
        />
      );
    }
  }

  return (
    <AppLayout>
      {seed}
      {children}
    </AppLayout>
  );
}
