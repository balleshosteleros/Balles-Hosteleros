import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listFaqsForCurrentUser,
  listAllFaqs,
} from "@/features/soporte/actions/faq-actions";
import {
  listConocimiento,
  estadoIndice,
} from "@/features/soporte/actions/conocimiento-actions";
import { AyudaPortal } from "@/features/soporte/components";

export default async function AyudaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: rolesData } = await supabase
    .from("usuario_roles")
    .select("role")
    .eq("user_id", user.id);
  const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
  const canEdit = roles.includes("admin") || roles.includes("director");

  let viewerData: Awaited<ReturnType<typeof listFaqsForCurrentUser>> = [];
  try {
    viewerData = await listFaqsForCurrentUser();
  } catch {
    viewerData = [];
  }

  let adminData: Awaited<ReturnType<typeof listAllFaqs>> | null = null;
  let conocimiento: Awaited<ReturnType<typeof listConocimiento>> | null = null;
  let estadoConocimiento: Awaited<ReturnType<typeof estadoIndice>> | null = null;
  if (canEdit) {
    try {
      adminData = await listAllFaqs();
    } catch {
      adminData = null;
    }
    try {
      [conocimiento, estadoConocimiento] = await Promise.all([
        listConocimiento(),
        estadoIndice(),
      ]);
    } catch {
      conocimiento = null;
      estadoConocimiento = null;
    }
  }

  return (
    <AyudaPortal
      viewerData={viewerData}
      adminData={adminData}
      userRoles={roles}
      conocimiento={conocimiento}
      estadoConocimiento={estadoConocimiento}
    />
  );
}
