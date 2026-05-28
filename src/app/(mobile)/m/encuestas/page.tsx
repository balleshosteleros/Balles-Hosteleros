import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisEncuestasView } from "@/features/mi-panel/components/MisEncuestasView";

export const dynamic = "force-dynamic";

export default function MobileEncuestasPage() {
  return (
    <>
      <MobilePageHeader title="Encuestas" />
      <div className="px-3 py-4">
        <MisEncuestasView />
      </div>
    </>
  );
}
