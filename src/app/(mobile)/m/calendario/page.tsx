import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { CalendarioMobile } from "@/features/mi-panel/mobile/components/CalendarioMobile";

export const dynamic = "force-dynamic";

export default function MobileCalendarioPage() {
  return (
    <>
      <MobilePageHeader title="Calendario" />
      <div className="px-3 py-4 pb-[calc(var(--nav-h)+1rem)]">
        <CalendarioMobile />
      </div>
    </>
  );
}
