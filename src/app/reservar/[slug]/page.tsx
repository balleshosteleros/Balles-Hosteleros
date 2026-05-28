import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReservaPublicaForm } from "@/features/reservar-publica/components/ReservaPublicaForm";

export const dynamic = "force-dynamic";

async function fetchEmpresaBySlug(slug: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresas")
    .select("id, nombre, slug")
    .eq("slug", slug)
    .maybeSingle();
  return data as { id: string; nombre: string; slug: string } | null;
}

export default async function ReservarPublicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ o?: string }>;
}) {
  const { slug } = await params;
  const { o } = await searchParams;
  const empresa = await fetchEmpresaBySlug(slug);
  if (!empresa) notFound();

  // Validamos el formato del origen, pero lo persistimos aunque el link ya no exista
  // (la traza histórica debe sobrevivir a borrados).
  const origenLimpio = o && /^[A-Z0-9_]+$/.test(o) && o.length <= 32 ? o : null;

  return (
    <main className="min-h-screen bg-background">
      <ReservaPublicaForm
        empresaSlug={empresa.slug}
        empresaNombre={empresa.nombre}
        origen={origenLimpio}
      />
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const empresa = await fetchEmpresaBySlug(slug);
  return {
    title: empresa ? `Reservar — ${empresa.nombre}` : "Reservar",
    description: empresa ? `Reserva tu mesa en ${empresa.nombre}` : undefined,
  };
}
