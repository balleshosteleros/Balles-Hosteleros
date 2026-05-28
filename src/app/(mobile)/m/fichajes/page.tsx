import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisFichajesMobile } from "@/features/mi-panel/mobile/components/MisFichajesMobile";

export const dynamic = "force-dynamic";

export default function MobileFichajesPage() {
  return (
    <>
      <MobilePageHeader title="Mis fichajes" subtitle="Últimos 60 días" />
      <div className="px-4 py-4">
        <MisFichajesMobile />
      </div>
    </>
  );
}
