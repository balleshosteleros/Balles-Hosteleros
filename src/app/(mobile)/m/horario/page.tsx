import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { HorarioSemanaMobile } from "@/features/mi-panel/mobile/components/HorarioSemanaMobile";
import { getMobileHorarioSemana } from "@/features/mi-panel/mobile/lib/mobile-horario-data";

export const dynamic = "force-dynamic";

export default async function MobileHorarioPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const sp = await searchParams;
  const offset = Number(sp?.semana ?? 0) || 0;
  const data = await getMobileHorarioSemana(offset);

  return (
    <>
      <MobilePageHeader title="Horario" />
      <div className="px-3 py-4">
        <HorarioSemanaMobile data={data} offset={offset} />
      </div>
    </>
  );
}
