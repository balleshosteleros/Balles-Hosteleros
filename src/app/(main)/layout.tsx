import { redirect } from "next/navigation";
import { AppLayout } from "@/features/layout/components/app-layout";
import { getEmpleadoGuardStatus } from "@/features/primer-acceso/data/empleado-status";
import { getUserPermisos } from "@/features/auth/actions/permisos-actions";
import { AuthServerSeed, type AppRole } from "@/features/auth/contexts/auth-context";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

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

  // Empresa activa (cookie del switcher). Se usa como `key` del subárbol de la
  // página: al cambiar de empresa, el cliente hace router.refresh() → este
  // Server Component (force-dynamic) re-corre con la nueva cookie, la key cambia
  // y React REMONTA la página. Así los client components de datos vuelven a
  // ejecutar su effect de carga con la nueva empresa, sin recarga dura del
  // navegador (que era lenta y vaciaba los logos ya cacheados en el contexto).
  const empresaActivaKey = user
    ? await getEmpresaActivaForUser(supabase, user.id)
    : null;

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
            esAdminPlataforma: p.esAdminPlataforma,
          }}
        />
      );
    }
  }

  return (
    <AppLayout>
      {seed}
      {/* key = empresa activa → remonta la página al cambiar de empresa, para
          que los client components recarguen sus datos con la nueva empresa. */}
      <div key={empresaActivaKey ?? "sin-empresa"} className="contents">
        {children}
      </div>
    </AppLayout>
  );
}
