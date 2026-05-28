import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { ToquesView } from "@/features/toques/components/ToquesView";

export const dynamic = "force-dynamic";

export default function MobilePointsPage() {
  return (
    <>
      <MobilePageHeader title="Points" />
      <div className="px-3 py-4">
        <ToquesView />
      </div>
    </>
  );
}
