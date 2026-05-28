import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisCondicionesView } from "@/features/mi-panel/components/MisCondicionesView";

export const dynamic = "force-dynamic";

export default function MobileCondicionesPage() {
  return (
    <>
      <MobilePageHeader title="Condiciones" />
      <div className="px-3 py-4">
        <MisCondicionesView />
      </div>
    </>
  );
}
