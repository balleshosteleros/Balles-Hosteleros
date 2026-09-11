import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { ToquesView } from "@/features/toques/components/ToquesView";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

export const dynamic = "force-dynamic";

export default async function MobilePointsPage() {
  // La empresa activa la sabe el servidor por la cookie. En el teléfono el
  // contexto de empresa del navegador no siempre llega a traer el id de base de
  // datos, y sin él la pantalla se quedaba en «No estás asignado a una empresa».
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const empresaId = user ? await getEmpresaActivaForUser(supabase, user.id) : null;

  return (
    <>
      <MobilePageHeader title="Points" />
      <div className="px-3 py-4">
        <ToquesView empresaIdInicial={empresaId} />
      </div>
    </>
  );
}
