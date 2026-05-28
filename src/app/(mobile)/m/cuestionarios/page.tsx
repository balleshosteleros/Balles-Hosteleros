import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisCuestionariosView } from "@/features/mi-panel/components/MisCuestionariosView";

export const dynamic = "force-dynamic";

export default function MobileCuestionariosPage() {
  return (
    <>
      <MobilePageHeader title="Cuestionarios" />
      <div className="px-3 py-4">
        <MisCuestionariosView />
      </div>
    </>
  );
}
