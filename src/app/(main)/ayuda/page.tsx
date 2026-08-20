import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
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

  // Editar FAQs exige AJUSTES (editar) en Ajustes → Roles, no el flag director.
  const { permisos } = await getRolContext();
  const canEdit = puedeEditarModulo(permisos, "AJUSTES");

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
      conocimiento={conocimiento}
      estadoConocimiento={estadoConocimiento}
    />
  );
}
