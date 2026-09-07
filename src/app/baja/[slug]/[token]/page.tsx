import type { Viewport } from "next";
import { iconsDeEmpresa } from "@/shared/lib/favicon-empresa";
import { darDeBaja } from "@/features/marketing/services/baja-marketing";

// La baja se ejecuta al abrir la página, así que no puede servirse cacheada.
export const dynamic = "force-dynamic";

export default async function BajaPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { token } = await params;
  const r = await darDeBaja(token);
  const primario = r.color ?? "#0f172a";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      {r.isotipoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.isotipoUrl} alt={r.empresaNombre ?? ""} className="h-14 w-auto object-contain" />
      ) : null}

      {r.ok ? (
        <>
          <h1 className="text-2xl font-bold leading-tight">
            {r.yaEstaba ? "Ya estabas fuera de la lista" : "Listo, no te escribimos más"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {r.yaEstaba
              ? "No recibes correos comerciales nuestros desde hace tiempo."
              : `No volverás a recibir los correos de ${r.empresaNombre}. Si algún día quieres volver, dínoslo al reservar.`}
          </p>
          <p className="text-xs text-muted-foreground">
            Esto no afecta a tus reservas: cuando reserves mesa seguirás recibiendo tu confirmación.
          </p>
          <span
            className="mt-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ background: `${primario}1a`, color: primario }}
          >
            {r.empresaNombre}
          </span>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold leading-tight">Este enlace no vale</h1>
          <p className="text-sm text-muted-foreground">
            Puede que esté cortado por el programa de correo. Abre el enlace desde el correo
            original, o respóndenos y te damos de baja a mano.
          </p>
        </>
      )}
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    icons: await iconsDeEmpresa({ slug }),
    title: "Baja de correos",
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
