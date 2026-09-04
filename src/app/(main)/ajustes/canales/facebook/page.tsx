import { redirect } from "next/navigation";
import { getEstadoCanalSocial } from "@/features/canales-sociales/actions/canal-social-actions";
import { CanalSocialConfigView } from "@/features/canales-sociales/components/CanalSocialConfigView";
import { CANALES_SOCIALES } from "@/features/canales-sociales/data/canales-sociales";

export const dynamic = "force-dynamic";

export default async function CanalFacebookPage() {
  const estado = await getEstadoCanalSocial("facebook");
  if (!estado) redirect("/login");
  return <CanalSocialConfigView canal={CANALES_SOCIALES.facebook} estado={estado} />;
}
