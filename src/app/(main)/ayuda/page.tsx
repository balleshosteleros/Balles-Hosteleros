import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listFaqsForCurrentUser,
  listAllFaqs,
} from "@/features/soporte/actions/faq-actions";
import { AyudaPortal } from "@/features/soporte/components";

export default async function AyudaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Comprobar si el usuario puede gestionar FAQs (admin o director)
  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
  const canEdit = roles.includes("admin") || roles.includes("director");

  // Datos del visor (filtrados por rol vía RLS)
  const viewerData = await listFaqsForCurrentUser();

  // Datos del panel admin (solo si puede editar)
  const adminData = canEdit ? await listAllFaqs() : null;

  return <AyudaPortal viewerData={viewerData} adminData={adminData} />;
}
