import { getMobileInicioData } from "@/features/mi-panel/mobile/lib/mobile-inicio-data";
import { InicioHeader } from "@/features/mi-panel/mobile/components/InicioHeader";
import { DepartamentosGrid } from "@/features/mi-panel/mobile/components/DepartamentosGrid";

export const dynamic = "force-dynamic";

export default async function MobileDepartamentosPage() {
  // Misma cabecera fija que "Mis paneles" (/m): pill de perfil + campana. La vista
  // de departamentos es un modo alterno de la home, no una subpágina con "atrás".
  const data = await getMobileInicioData();

  return (
    <>
      <InicioHeader data={data} />
      <div className="mt-5">
        <h2 className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Mis departamentos
        </h2>
        <DepartamentosGrid />
      </div>
    </>
  );
}
