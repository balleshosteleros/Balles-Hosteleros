import { headers } from "next/headers";
import { fetchCartaAdmin } from "@/features/marketing/carta-digital/services/carta-admin-fetch";
import { CartaAdminBoard } from "@/features/marketing/carta-digital/components/admin/CartaAdminBoard";
import { MetricasLikesPanel } from "@/features/marketing/carta-digital/components/admin/MetricasLikesPanel";

export const dynamic = "force-dynamic";

export default async function CartaDigitalAdminPage() {
  const data = await fetchCartaAdmin();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CartaAdminBoard data={data} baseUrl={baseUrl} />
      {data.items.length > 0 ? (
        <div className="px-4 sm:px-6">
          <MetricasLikesPanel items={data.items} />
        </div>
      ) : null}
    </div>
  );
}
