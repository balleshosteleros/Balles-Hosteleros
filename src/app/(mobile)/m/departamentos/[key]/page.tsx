import { Building2 } from "lucide-react";
import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";

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
      <MobilePageHeader title={label} />
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
          <Building2 className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-base font-semibold">Pendiente de configurar</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Aún no hemos habilitado las opciones de {label} en móvil. Aparecerán
          aquí en cuanto estén listas.
        </p>
      </div>
    </>
  );
}
