import { redirect } from "next/navigation";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeVerHerramienta } from "@/features/auth/lib/permisos";
import { AgendaView } from "@/features/agenda/components/AgendaView";

// La agenda lleva dentro los teléfonos y correos personales de los empleados.
// Sin el permiso AGENDA del rol (Ajustes → Roles) esta dirección no se abre
// aunque se escriba a mano en el navegador.
export default async function AgendaPage() {
  const { permisos } = await getRolContext();
  if (!puedeVerHerramienta(permisos, "HERR_AGENDA")) redirect("/");
  return <AgendaView />;
}
