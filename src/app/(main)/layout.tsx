import { redirect } from "next/navigation";
import { AppLayout } from "@/features/layout/components/app-layout";
import { getEmpleadoGuardStatus } from "@/features/primer-acceso/data/empleado-status";

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
  return <AppLayout>{children}</AppLayout>;
}
