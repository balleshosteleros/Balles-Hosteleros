import { getMobileHomeData } from "@/features/mi-panel/mobile/lib/mobile-home-data";
import { HomeHeader } from "@/features/mi-panel/mobile/components/HomeHeader";
import { BigClockButton } from "@/features/mi-panel/mobile/components/BigClockButton";
import { SolicitudesQuickCard } from "@/features/mi-panel/mobile/components/SolicitudesQuickCard";
import { Tablon } from "@/features/mi-panel/mobile/components/Tablon";
import { VerTodoCTA } from "@/features/mi-panel/mobile/components/VerTodoCTA";
import { PushPermissionCard } from "@/features/mi-panel/mobile/components/PushPermissionCard";

export const dynamic = "force-dynamic";

type Estado = "sin-fichar" | "trabajando" | "pausa" | "completado";

function deriveEstado(fichajeHoy: Awaited<ReturnType<typeof getMobileHomeData>>["fichajeHoy"]): Estado {
  if (!fichajeHoy) return "sin-fichar";
  const e = (fichajeHoy.estado || "").toLowerCase();
  if (e === "trabajando") return "trabajando";
  if (e === "pausa") return "pausa";
  if (e === "completado" || fichajeHoy.horaSalida) return "completado";
  return "sin-fichar";
}

export default async function MobileHomePage() {
  const data = await getMobileHomeData();
  const estado = deriveEstado(data.fichajeHoy);

  return (
    <>
      <HomeHeader saludo={data.saludo} nombre={data.nombre} />
      <BigClockButton fichajeId={data.fichajeHoy?.id ?? null} estado={estado} />
      <PushPermissionCard />
      <SolicitudesQuickCard
        pendientes={data.resumen.solicitudes.pendientes}
        aprobadas={data.resumen.solicitudes.aprobadas}
      />
      <Tablon data={data} />
      <VerTodoCTA />
    </>
  );
}
