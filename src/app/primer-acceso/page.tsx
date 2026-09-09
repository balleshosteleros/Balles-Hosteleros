import { redirect } from "next/navigation";
import { getEmpleadoStatus } from "@/features/primer-acceso/data/empleado-status";
import { WizardPrimerAcceso } from "@/features/primer-acceso/components/WizardPrimerAcceso";

export const dynamic = "force-dynamic";

export default async function PrimerAccesoPage() {
  const status = await getEmpleadoStatus();

  if (!status.empleadoId) {
    // No es empleado o no autenticado
    redirect("/mi-panel");
  }
  // Tener el perfil completo ya NO basta para saltarse esto: quien lo completó
  // antes de que se pidiera la documentación vuelve aquí (modo "documentos")
  // hasta que suba sus papeles. `shouldShowWizard` decide por los dos motivos.
  if (!status.shouldShowWizard) {
    redirect("/mi-panel");
  }

  return <WizardPrimerAcceso prefilled={status.prefilled} modo={status.modo} />;
}
