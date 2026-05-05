import { redirect } from "next/navigation";
import { AppLayout } from "@/features/layout/components/app-layout";
import { getEmpleadoStatus } from "@/features/primer-acceso/actions/perfil-actions";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // Guard: si el usuario es empleado con perfil_completado=false → wizard bloqueante
  const status = await getEmpleadoStatus();
  if (status.shouldShowWizard) {
    redirect("/primer-acceso");
  }
  return <AppLayout>{children}</AppLayout>;
}
