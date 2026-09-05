import { headers } from "next/headers";
import { fetchCartaAdmin } from "@/features/marketing/carta-digital/services/carta-admin-fetch";
import { CartaAdminBoard } from "@/features/marketing/carta-digital/components/admin/CartaAdminBoard";
import { MetricasLikesPanel } from "@/features/marketing/carta-digital/components/admin/MetricasLikesPanel";
import { dominioPublicoDeEmpresa } from "@/features/marketing/pagina-web/services/dominio-empresa";

export const dynamic = "force-dynamic";

export default async function CartaDigitalAdminPage() {
  const data = await fetchCartaAdmin();

  // La URL que se enseña aquí es la que acaba IMPRESA en el QR de la mesa, así
  // que tiene que ser la del restaurante (`bacanalmadrid.com/carta`), no la del
  // panel desde el que se mira —que es el dominio del software y delataría a la
  // gestora en la mesa de un cliente.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const dominioPropio = data.empresa ? await dominioPublicoDeEmpresa(data.empresa.id) : null;
  const baseUrl = dominioPropio ?? `${proto}://${host}`;
  const conDominioPropio = Boolean(dominioPropio);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CartaAdminBoard data={data} baseUrl={baseUrl} conDominioPropio={conDominioPropio} />
      {data.items.length > 0 ? (
        <div className="px-4 sm:px-6">
          <MetricasLikesPanel items={data.items} />
        </div>
      ) : null}
    </div>
  );
}
