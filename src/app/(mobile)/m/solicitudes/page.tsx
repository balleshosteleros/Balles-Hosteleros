import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisSolicitudesMobile } from "@/features/mi-panel/mobile/components/MisSolicitudesMobile";

export const dynamic = "force-dynamic";

export default function MobileSolicitudesPage() {
  return (
    <>
      <MobilePageHeader title="Solicitudes" />
      <div className="px-4 py-4">
        <MisSolicitudesMobile />
      </div>
    </>
  );
}
