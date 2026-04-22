import { redirect } from "next/navigation";
import { headers } from "next/headers";

function esHostDemo(host: string): boolean {
  const h = host.toLowerCase().split(":")[0];
  return h === "demo.balleshosteleros.com" || h.startsWith("demo.");
}

export default async function Home() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";

  if (esHostDemo(host)) {
    redirect("/acceso-demo");
  }

  redirect("/direccion/estructura");
}
