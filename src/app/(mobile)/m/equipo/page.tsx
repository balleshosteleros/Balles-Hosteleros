import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { EquipoOrganigramaView } from "@/features/mi-panel/components/EquipoOrganigramaView";

export const dynamic = "force-dynamic";

export default function MobileEquipoPage() {
  return (
    <>
      <MobilePageHeader title="Equipo" />
      <div className="px-3 py-4">
        <EquipoOrganigramaView />
      </div>
    </>
  );
}
