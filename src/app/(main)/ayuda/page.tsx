import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listFaqsForCurrentUser,
  listAllFaqs,
} from "@/features/soporte/actions/faq-actions";
import { AyudaPortal } from "@/features/soporte/components";

export default async function AyudaPage() {
  const devBypass = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !devBypass) redirect("/");

  // Comprobar si el usuario puede gestionar FAQs (admin o director)
  let canEdit = false;
  if (user) {
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
    canEdit = roles.includes("admin") || roles.includes("director");
  }

  // Datos del visor — fallback a [] si la tabla aún no existe o falla
  let viewerData: Awaited<ReturnType<typeof listFaqsForCurrentUser>> = [];
  try {
    viewerData = await listFaqsForCurrentUser();
  } catch {
    viewerData = [];
  }

  // Datos del panel admin (solo si puede editar y hay user real)
  let adminData: Awaited<ReturnType<typeof listAllFaqs>> | null = null;
  if (canEdit && user) {
    try {
      adminData = await listAllFaqs();
    } catch {
      adminData = null;
    }
  }

  return <AyudaPortal viewerData={viewerData} adminData={adminData} />;
}
