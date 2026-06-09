import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { AgendaMobile } from "@/features/agenda/mobile/AgendaMobile";

export const dynamic = "force-dynamic";

export default function MobileLlamarPage() {
  return (
    <>
      <MobilePageHeader title="Llamar" />
      <div className="px-3 py-4">
        <AgendaMobile />
      </div>
    </>
  );
}
