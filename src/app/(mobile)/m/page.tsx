import { getMobileInicioData } from "@/features/mi-panel/mobile/lib/mobile-inicio-data";
import { InicioHeader } from "@/features/mi-panel/mobile/components/InicioHeader";
import { MasGrid } from "@/features/mi-panel/mobile/components/MasGrid";
import { PushPermissionCard } from "@/features/mi-panel/mobile/components/PushPermissionCard";
import { WidgetBoundary } from "@/shared/components/WidgetBoundary";

export const dynamic = "force-dynamic";

export default async function MobileHomePage() {
  const data = await getMobileInicioData();

  return (
    <>
      {/* Aislados: un fallo en la cabecera o en el aviso de notificaciones no
          puede dejar al empleado sin la rejilla de paneles (ni sin fichar). */}
      <WidgetBoundary nombre="inicio-cabecera" silencioso>
        <InicioHeader data={data} />
      </WidgetBoundary>
      <WidgetBoundary nombre="push" silencioso>
        <PushPermissionCard />
      </WidgetBoundary>
      <div className="mt-5">
        <h2 className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Mis paneles
        </h2>
        <MasGrid />
      </div>
    </>
  );
}
