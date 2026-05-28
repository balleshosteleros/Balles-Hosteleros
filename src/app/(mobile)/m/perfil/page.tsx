import { redirect } from "next/navigation";
import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { DatosPersonalesView } from "@/features/mi-panel/components/DatosPersonalesView";
import { cargarDatosPersonales } from "@/features/mi-panel/actions/datos-personales-actions";

export const dynamic = "force-dynamic";

export default async function MobilePerfilPage() {
  const initial = await cargarDatosPersonales();
  if (!initial) redirect("/login");
  return (
    <>
      <MobilePageHeader title="Perfil" />
      <div className="px-3 py-4">
        <DatosPersonalesView initial={initial} />
      </div>
    </>
  );
}
