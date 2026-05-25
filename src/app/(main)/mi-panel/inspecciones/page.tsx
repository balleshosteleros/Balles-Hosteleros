import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMisInspeccionesVerificadas } from "@/features/mi-panel/actions/inspecciones-actions";
import { MisInspeccionesView } from "@/features/mi-panel/components/MisInspeccionesView";

export const dynamic = "force-dynamic";

export default async function MiPanelInspeccionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const inspecciones = await listMisInspeccionesVerificadas();
  return <MisInspeccionesView inspecciones={inspecciones} />;
}
