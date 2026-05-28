import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MiCalendarioView } from "@/features/mi-panel/components/MiCalendarioView";

export const dynamic = "force-dynamic";

export default function MobileCalendarioPage() {
  return (
    <>
      <MobilePageHeader title="Calendario" />
      <div className="px-3 py-4">
        <MiCalendarioView />
      </div>
    </>
  );
}
