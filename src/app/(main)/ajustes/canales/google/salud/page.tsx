import { getSaludRwg } from "@/features/canales-google-rwg/actions/salud-actions";
import { SaludRwgView } from "@/features/canales-google-rwg/components/SaludRwgView";

export const dynamic = "force-dynamic";

export default async function SaludRwgPage() {
  const data = await getSaludRwg();
  return <SaludRwgView data={data} />;
}
