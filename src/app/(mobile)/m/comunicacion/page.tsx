import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { ComunicacionMobile } from "@/features/mi-panel/mobile/components/ComunicacionMobile";

export const dynamic = "force-dynamic";

export default function MobileComunicacionPage() {
  return (
    <>
      <MobilePageHeader title="Comunicación" />
      <ComunicacionMobile />
    </>
  );
}
