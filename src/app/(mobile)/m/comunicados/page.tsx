import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisComunicadosMobile } from "@/features/mi-panel/mobile/components/MisComunicadosMobile";

export const dynamic = "force-dynamic";

export default function MobileComunicadosPage() {
  return (
    <>
      <MobilePageHeader title="Comunicados" />
      <div className="px-4 py-4">
        <MisComunicadosMobile />
      </div>
    </>
  );
}
