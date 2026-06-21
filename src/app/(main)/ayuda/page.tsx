import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
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

  const { esDirector } = await getRolContext();
  const roles = esDirector ? ["director"] : ["empleado"];
  const canEdit = esDirector;

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
