import { redirect } from "next/navigation";
import { getEmpleadoStatus } from "@/features/primer-acceso/actions/perfil-actions";
import { WizardPrimerAcceso } from "@/features/primer-acceso/components/WizardPrimerAcceso";

export const dynamic = "force-dynamic";

export default async function PrimerAccesoPage() {
  const status = await getEmpleadoStatus();

  if (!status.empleadoId) {
    // No es empleado o no autenticado
    redirect("/dashboard");
  }
  if (status.perfilCompletado) {
    redirect("/dashboard");
  }

  return <WizardPrimerAcceso prefilled={status.prefilled} />;
}
