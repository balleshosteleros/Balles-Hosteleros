import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisFichajesView } from "@/features/mi-panel/components/MisFichajesView";

export const dynamic = "force-dynamic";

export default function MobileFichajesPage() {
  return (
    <>
      <MobilePageHeader title="Mis fichajes" />
      <div className="px-3 py-4">
        <MisFichajesView />
      </div>
    </>
  );
}
