import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MiCronogramaView } from "@/features/mi-panel/components/MiCronogramaView";

export const dynamic = "force-dynamic";

export default function MobileCronogramaPage() {
  return (
    <>
      <MobilePageHeader title="Cronograma" />
      <div className="px-3 py-4">
        <MiCronogramaView />
      </div>
    </>
  );
}
