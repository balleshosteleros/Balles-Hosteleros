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
  // `perfil_completado` ya NO decide nada: estaba a true en fichas a las que les
  // faltaba el teléfono, la fecha de nacimiento o la cuenta. Lo que manda es lo
  // que falta DE VERDAD, campo a campo (ver `ficha-incompleta.ts`).
  if (!status.shouldShowWizard) {
    redirect("/mi-panel");
  }

  // `pasos` = solo donde le falta algo. A quien únicamente le falta el teléfono
  // no se le hacen recorrer cinco pantallas de datos que ya dio.
  return (
    <WizardPrimerAcceso prefilled={status.prefilled} modo={status.modo} pasos={status.pasos} />
  );
}
