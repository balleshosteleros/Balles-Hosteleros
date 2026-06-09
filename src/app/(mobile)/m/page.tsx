import { getMobileHomeData } from "@/features/mi-panel/mobile/lib/mobile-home-data";
import { HomeHeader } from "@/features/mi-panel/mobile/components/HomeHeader";
import { SolicitudesQuickCard } from "@/features/mi-panel/mobile/components/SolicitudesQuickCard";
import { Tablon } from "@/features/mi-panel/mobile/components/Tablon";
import { MasGrid } from "@/features/mi-panel/mobile/components/MasGrid";
import { PushPermissionCard } from "@/features/mi-panel/mobile/components/PushPermissionCard";

export const dynamic = "force-dynamic";

export default async function MobileHomePage() {
  const data = await getMobileHomeData();

  return (
    <>
      <HomeHeader saludo={data.saludo} nombre={data.nombre} />
      <PushPermissionCard />
      <SolicitudesQuickCard
        pendientes={data.resumen.solicitudes.pendientes}
        aprobadas={data.resumen.solicitudes.aprobadas}
      />
      <Tablon data={data} />
      <div className="mt-2">
        <h2 className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Mis paneles
        </h2>
        <MasGrid />
      </div>
    </>
  );
}
