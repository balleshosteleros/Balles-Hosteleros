import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { DepartamentosGrid } from "@/features/mi-panel/mobile/components/DepartamentosGrid";

export const dynamic = "force-dynamic";

export default function MobileDepartamentosPage() {
  return (
    <>
      <MobilePageHeader title="Mis departamentos" />
      <DepartamentosGrid />
    </>
  );
}
