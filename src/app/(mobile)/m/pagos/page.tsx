import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisPagosView } from "@/features/mi-panel/components/MisPagosView";

export const dynamic = "force-dynamic";

export default function MobilePagosPage() {
  return (
    <>
      <MobilePageHeader title="Mis pagos" />
      <div className="px-3 py-4">
        <MisPagosView />
      </div>
    </>
  );
}
