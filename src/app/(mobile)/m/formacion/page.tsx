import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MiFormacionView } from "@/features/mi-panel/components/MiFormacionView";

export const dynamic = "force-dynamic";

export default function MobileFormacionPage() {
  return (
    <>
      <MobilePageHeader title="Formación" />
      <div className="px-3 py-4">
        <MiFormacionView />
      </div>
    </>
  );
}
