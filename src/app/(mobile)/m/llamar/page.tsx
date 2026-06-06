import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { DirectorioEmpleados } from "@/features/llamadas-internas/components/DirectorioEmpleados";

export const dynamic = "force-dynamic";

export default function MobileLlamarPage() {
  return (
    <>
      <MobilePageHeader title="Llamar" />
      <div className="px-3 py-4">
        <DirectorioEmpleados />
      </div>
    </>
  );
}
