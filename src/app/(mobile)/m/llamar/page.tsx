import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { LlamarMobileView } from "@/features/mi-panel/mobile/components/LlamarMobileView";

export const dynamic = "force-dynamic";

export default function MobileLlamarPage() {
  return (
    <>
      <MobilePageHeader title="Llamar" />
      <div className="px-3 py-4">
        <LlamarMobileView />
      </div>
    </>
  );
}
