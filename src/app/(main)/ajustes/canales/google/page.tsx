import { getEmpresaPlaceInfo } from "@/features/calidad/actions/resenas-actions";
import { CanalGoogleConfigView } from "@/features/canales-google-rwg/components/CanalGoogleConfigView";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CanalGooglePage() {
  const info = await getEmpresaPlaceInfo();
  if (!info) redirect("/login");
  return (
    <CanalGoogleConfigView
      empresaNombre={info.nombre}
      direccion={info.direccion}
      placeIdInicial={info.googlePlaceId}
    />
  );
}
