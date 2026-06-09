import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { TareasMobile } from "@/features/tareas/mobile/TareasMobile";

export const dynamic = "force-dynamic";

export default function MobileTareasPage() {
  return (
    <>
      <MobilePageHeader title="Tareas" />
      <div className="px-3 py-4">
        <TareasMobile />
      </div>
    </>
  );
}
