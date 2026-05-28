import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisAusenciasView } from "@/features/mi-panel/components/MisAusenciasView";

export const dynamic = "force-dynamic";

export default function MobileSolicitudesPage() {
  return (
    <>
      <MobilePageHeader title="Solicitudes" />
      <div className="px-3 py-4">
        <MisAusenciasView />
      </div>
    </>
  );
}
