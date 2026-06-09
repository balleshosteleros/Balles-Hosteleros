import { getMobileInicioData } from "@/features/mi-panel/mobile/lib/mobile-inicio-data";
import { InicioHeader } from "@/features/mi-panel/mobile/components/InicioHeader";
import { FicharCard } from "@/features/mi-panel/mobile/components/FicharCard";
import { MasGrid } from "@/features/mi-panel/mobile/components/MasGrid";
import { PushPermissionCard } from "@/features/mi-panel/mobile/components/PushPermissionCard";

export const dynamic = "force-dynamic";

export default async function MobileHomePage() {
  const data = await getMobileInicioData();

  return (
    <>
      <InicioHeader data={data} />
      <FicharCard jornadaHoy={data.jornadaHoy} />
      <PushPermissionCard />
      <div className="mt-5">
        <h2 className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Mis paneles
        </h2>
        <MasGrid />
      </div>
    </>
  );
}
