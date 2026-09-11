import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listFaqsForCurrentUser } from "@/features/soporte/actions/faq-actions";
import { AyudaPortal } from "@/features/soporte/components";

/**
 * Ayuda, tal como la ve la plantilla.
 *
 * Solo para consultar: las preguntas frecuentes que le tocan por su rol, la
 * formación inicial y el asistente. Gestionarlas es cosa de Dirección → Ayuda,
 * así que aquí ya no hay pestañas de administración.
 */
export default async function AyudaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  let viewerData: Awaited<ReturnType<typeof listFaqsForCurrentUser>> = [];
  try {
    viewerData = await listFaqsForCurrentUser();
  } catch {
    viewerData = [];
  }

  return <AyudaPortal viewerData={viewerData} />;
}
