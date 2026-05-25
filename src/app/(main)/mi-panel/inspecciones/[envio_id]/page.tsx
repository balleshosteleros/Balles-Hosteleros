import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMiInspeccionDetalle } from "@/features/mi-panel/actions/inspecciones-actions";
import { MiInspeccionDetalleView } from "@/features/mi-panel/components/MiInspeccionDetalleView";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ envio_id: string }>;
}

export default async function MiPanelInspeccionDetallePage({ params }: Props) {
  const { envio_id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const envio = await getMiInspeccionDetalle(envio_id);
  if (!envio) notFound();
  return <MiInspeccionDetalleView envio={envio} />;
}
