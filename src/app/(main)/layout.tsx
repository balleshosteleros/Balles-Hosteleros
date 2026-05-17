import { redirect } from "next/navigation";
import { AppLayout } from "@/features/layout/components/app-layout";
import { getEmpleadoGuardStatus } from "@/features/primer-acceso/data/empleado-status";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // Guard: si el usuario es empleado con perfil_completado=false → wizard bloqueante
  const { shouldShowWizard } = await getEmpleadoGuardStatus();
  if (shouldShowWizard) {
    redirect("/primer-acceso");
  }
  return <AppLayout>{children}</AppLayout>;
}
