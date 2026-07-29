import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { SubirAlbaranMobile } from "@/features/logistica/mobile/components/SubirAlbaranMobile";

export const dynamic = "force-dynamic";

export default async function SubirAlbaranPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <MobilePageHeader
        title="Subir albarán por foto"
        subtitle="Se guarda en Revisión para resolver desde el ordenador"
        backHref="/m/albaranes"
      />
      <div className="px-3 py-4">
        <SubirAlbaranMobile />
      </div>
    </>
  );
}
