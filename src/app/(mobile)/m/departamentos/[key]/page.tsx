import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { SubmodulosGrid } from "@/features/mi-panel/mobile/components/SubmodulosGrid";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  direccion: "Dirección",
  sala: "Sala",
  cocina: "Cocina",
  gerencia: "Gerencia",
  calidad: "Calidad",
  rrhh: "Recursos Humanos",
  marketing: "Marketing",
  logistica: "Logística",
  contabilidad: "Contabilidad",
  gestoria: "Gestoría",
  juridico: "Jurídico",
};

export default async function MobileDepartamentoDetallePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const label = LABELS[key] ?? "Departamento";

  return (
    <>
      <MobilePageHeader title={label} backHref="/m/departamentos" />
      <div className="mt-3">
        <SubmodulosGrid deptoKey={key} />
      </div>
    </>
  );
}
