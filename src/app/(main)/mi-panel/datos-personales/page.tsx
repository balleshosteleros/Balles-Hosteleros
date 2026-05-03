import { redirect } from "next/navigation";
import { DatosPersonalesView } from "@/features/mi-panel/components/DatosPersonalesView";
import { cargarDatosPersonales } from "@/features/mi-panel/actions/datos-personales-actions";

export default async function MiPanelDatosPersonalesPage() {
  const initial = await cargarDatosPersonales();
  if (!initial) {
    redirect("/login");
  }
  return <DatosPersonalesView initial={initial} />;
}
