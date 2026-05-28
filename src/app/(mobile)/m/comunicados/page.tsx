import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisComunicadosView } from "@/features/mi-panel/components/MisComunicadosView";

export const dynamic = "force-dynamic";

export default function MobileComunicadosPage() {
  return (
    <>
      <MobilePageHeader title="Comunicados" />
      <div className="px-3 py-4">
        <MisComunicadosView />
      </div>
    </>
  );
}
