import { CalidadInspeccionesView } from "@/features/calidad/components/CalidadInspeccionesView";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

export const dynamic = "force-dynamic";

export default async function CalidadInspeccionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let empresaSlug: string | null = null;
  if (user) {
    const empresaId = await getEmpresaActivaForUser(supabase, user.id);
    if (empresaId) {
      const { data } = await supabase
        .from("empresas")
        .select("slug")
        .eq("id", empresaId)
        .maybeSingle();
      empresaSlug = data?.slug ?? null;
    }
  }

  return <CalidadInspeccionesView empresaSlug={empresaSlug} />;
}
