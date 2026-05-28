import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMisInspeccionesVerificadas } from "@/features/mi-panel/actions/inspecciones-actions";
import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisInspeccionesView } from "@/features/mi-panel/components/MisInspeccionesView";

export const dynamic = "force-dynamic";

export default async function MobileInspeccionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const inspecciones = await listMisInspeccionesVerificadas();
  return (
    <>
      <MobilePageHeader title="Inspecciones" />
      <div className="px-3 py-4">
        <MisInspeccionesView inspecciones={inspecciones} />
      </div>
    </>
  );
}
