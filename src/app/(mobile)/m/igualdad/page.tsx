import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { IgualdadView } from "@/features/mi-panel/components/IgualdadView";

export const dynamic = "force-dynamic";

export default function MobileIgualdadPage() {
  return (
    <>
      <MobilePageHeader title="Igualdad" />
      {/* IgualdadView ya trae su propio padding: no lo duplicamos aquí. */}
      <IgualdadView />
    </>
  );
}
