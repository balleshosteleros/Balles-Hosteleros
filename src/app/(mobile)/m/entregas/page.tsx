import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisEntregasView } from "@/features/mi-panel/components/MisEntregasView";

export const dynamic = "force-dynamic";

export default function MobileEntregasPage() {
  return (
    <>
      <MobilePageHeader title="Entregas" />
      <div className="px-3 py-4">
        <MisEntregasView />
      </div>
    </>
  );
}
