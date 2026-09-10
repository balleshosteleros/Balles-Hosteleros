import { redirect } from "next/navigation";
import { AppLayout } from "@/features/layout/components/app-layout";
import { getEmpleadoGuardStatus } from "@/features/primer-acceso/data/empleado-status";
import { GateDocumentacion } from "@/features/primer-acceso/components/GateDocumentacion";
import { getUserPermisos } from "@/features/auth/actions/permisos-actions";
import { AuthServerSeed, type AppRole, type AuthProfile } from "@/features/auth/contexts/auth-context";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser, getCatalogoEmpresa } from "@/features/empresa/lib/empresa-server";
import { CatalogoEmpresaProvider } from "@/features/empresa/contexts/catalogo-empresa-context";
import { EmpresaActivaSeed } from "@/features/empresa/components/EmpresaActivaSeed";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { shouldShowWizard, hasUser, modo, bloquea } = await getEmpleadoGuardStatus();
  // Sin sesión → login. Refuerza al middleware, que en producción deja pasar
  // las rutas de módulo sin sesión (fail-open). ?auth=1 evita el rebote móvil.
  if (!hasUser) {
    redirect("/?auth=1");
  }
  // Quien deba documentación se tapa con `GateDocumentacion`, NO con un
  // redirect: el layout no sabe en qué pantalla está y mandaba al asistente
  // hasta cuando la persona iba a fichar. Ver el comentario del componente.

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

  // Catálogo de la empresa activa: qué módulos existen aquí. Se resuelve en
  // servidor, junto a los permisos, para que el menú se pinte de una sola vez.
  // No es lo mismo que los permisos del rol — ver catalogo-empresa-context.
  const catalogoEmpresa = await getCatalogoEmpresa(empresaActivaKey);

  let seed: React.ReactNode = null;
  if (user) {
    // Perfil y permisos EN PARALELO. El perfil (nombre + rol + avatar) se
    // resuelve aquí y no solo en el navegador: si la cabecera dependía del
    // fetch del cliente, al entrar aparecía sin nombre, sin rol y sin foto
    // durante el arranque, pese a que la sesión ya estaba validada.
    const [p, perfilRes] = await Promise.all([
      getUserPermisos(),
      supabase
        .from("usuarios")
        .select("nombre, apellidos, email, empresa_id, avatar_url, avatar_obligatorio, rol_label, departamento")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const profile = (perfilRes.data as AuthProfile | null) ?? null;

    // Guard anti-carrera (paridad con looksRaceFailure de loadFreshAuth): si la
    // resolución llegó a medias (sin empresa), NO sembramos ni cacheamos datos
    // incompletos — el cliente seguirá su flujo normal con reintentos.
    // El PERFIL, en cambio, sí se siembra en cuanto exista: es independiente de
    // los permisos y su ausencia es justo lo que dejaba la cabecera vacía.
    if (p.empresaId != null || profile) {
      seed = (
        <AuthServerSeed
          payload={{
            userId: user.id,
            roles: p.appRoles as AppRole[],
            permisos: p.permisos,
            esAdminPlataforma: p.esAdminPlataforma,
            profile,
            permisosValidos: p.empresaId != null,
          }}
        />
      );
    }
  }

  return (
    <CatalogoEmpresaProvider
      departamentos={catalogoEmpresa.departamentos}
      esMatriz={catalogoEmpresa.esMatriz}
    >
      <AppLayout>
        {seed}
        {/* Con qué empresa ha respondido el servidor. Mientras no coincida con
            la que se acaba de elegir, el logotipo de arriba no cambia y la
            pantalla sigue tapada: así el menú y el logotipo nunca se ven de dos
            empresas distintas a la vez. */}
        <EmpresaActivaSeed empresaActivaId={empresaActivaKey} />
        {/* key = empresa activa → remonta la página al cambiar de empresa, para
            que los client components recarguen sus datos con la nueva empresa. */}
        <div key={empresaActivaKey ?? "sin-empresa"} className="contents">
          <GateDocumentacion activo={shouldShowWizard} modo={modo} bloquea={bloquea}>
            {children}
          </GateDocumentacion>
        </div>
      </AppLayout>
    </CatalogoEmpresaProvider>
  );
}
