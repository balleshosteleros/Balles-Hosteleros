import { createClient } from "@/lib/supabase/server";
import {
  getEmpresaActivaForUser,
  getZonaHorariaEmpresa,
} from "@/features/empresa/lib/empresa-server";
import { ZONA_HORARIA_FALLBACK } from "@/features/empresa/lib/zona-horaria";
import { CitasView } from "@/features/producto/citas/components/CitasView";

// Las citas se pintan en la hora de la EMPRESA, así que la zona se resuelve en
// el servidor y baja como dato: el navegador de quien mira no decide nada.
export const dynamic = "force-dynamic";

export default async function ProductoCitasPage() {
  let zona = ZONA_HORARIA_FALLBACK;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const empresaId = await getEmpresaActivaForUser(supabase, user.id);
      zona = await getZonaHorariaEmpresa(supabase, empresaId);
    }
  } catch {
    /* sin empresa resuelta se usa la de siempre */
  }

  return <CitasView zonaHoraria={zona} />;
}
