import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MiHorarioView } from "@/features/mi-panel/components/MiHorarioView";

export const dynamic = "force-dynamic";

export default function MobileHorarioPage() {
  return (
    <>
      <MobilePageHeader title="Horario" />
      <div className="px-3 py-4">
        <MiHorarioView />
      </div>
    </>
  );
}
