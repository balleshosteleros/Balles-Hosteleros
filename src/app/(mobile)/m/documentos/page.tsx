import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisDocumentosView } from "@/features/mi-panel/components/MisDocumentosView";

export const dynamic = "force-dynamic";

export default function MobileDocumentosPage() {
  return (
    <>
      <MobilePageHeader title="Documentos" />
      <div className="px-3 py-4">
        <MisDocumentosView />
      </div>
    </>
  );
}
