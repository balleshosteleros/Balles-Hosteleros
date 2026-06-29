import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Clock, Briefcase, FileText } from "lucide-react";
import { fetchOfertaPublica, fetchOrigenesPublicos, fetchCamposFormularioPublico } from "@/features/empleo-publico/services/empleo-fetch";
import { EmpleoBrandingShell } from "@/features/empleo-publico/components/EmpleoBrandingShell";
import { FormCandidaturaPublica } from "@/features/empleo-publico/components/FormCandidaturaPublica";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const JORNADA_LABEL: Record<string, string> = {
  completa: "Jornada completa",
  parcial: "Jornada parcial",
  rotativa: "Rotativa",
  fines_de_semana: "Fines de semana",
  extra: "Horas extra",
};

export default async function OfertaPublicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; oferta: string }>;
  searchParams: Promise<{ o?: string }>;
}) {
  const { slug, oferta: ofertaId } = await params;
  const { o: canalCodigo } = await searchParams;
  const detalle = await fetchOfertaPublica(slug, ofertaId);
  if (!detalle) notFound();
  const { empresa, oferta } = detalle;
  const [origenes, campos] = await Promise.all([
    fetchOrigenesPublicos(empresa.id),
    fetchCamposFormularioPublico(empresa.id),
  ]);

  return (
    <EmpleoBrandingShell empresa={empresa}>
      <div className="space-y-6">
        <Link
          href={`/empleo/${empresa.empleo_slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a las ofertas
        </Link>

        <header className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {oferta.titulo}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {(oferta.departamento_nombre || oferta.categoria) && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" />
                {oferta.departamento_nombre ?? oferta.categoria}
              </span>
            )}
            {oferta.ubicacion && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {oferta.ubicacion}
              </span>
            )}
            {oferta.tipo_jornada && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {JORNADA_LABEL[oferta.tipo_jornada] ?? oferta.tipo_jornada}
              </span>
            )}
            {oferta.tipo_contrato && (
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                {oferta.tipo_contrato}
              </span>
            )}
          </div>
          {oferta.salario_rango && (
            <div className="inline-block rounded-md bg-muted px-3 py-1 text-sm font-medium">
              {oferta.salario_rango}
            </div>
          )}
        </header>

        {oferta.descripcion && (
          <article className="rounded-lg border bg-card p-5 md:p-6">
            <h2 className="text-base font-semibold mb-3">Descripción del puesto</h2>
            <div className="text-sm text-foreground/85 whitespace-pre-line leading-relaxed">
              {oferta.descripcion}
            </div>
          </article>
        )}

        <FormCandidaturaPublica
          empresaSlug={empresa.empleo_slug}
          empresaId={empresa.id}
          ofertaId={oferta.id}
          ofertaTitulo={oferta.titulo}
          canalCodigo={canalCodigo ?? null}
          cuestionario={oferta.cuestionarioPlantilla ?? null}
          origenes={origenes}
          campos={campos}
        />
      </div>
    </EmpleoBrandingShell>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; oferta: string }>;
}) {
  const { slug, oferta: ofertaId } = await params;
  const detalle = await fetchOfertaPublica(slug, ofertaId);
  if (!detalle) return { title: "Oferta no encontrada" };
  const desc =
    detalle.oferta.descripcion?.slice(0, 160) ??
    `Postula a ${detalle.oferta.titulo} en ${detalle.empresa.nombre}`;
  return {
    title: `${detalle.oferta.titulo} · ${detalle.empresa.nombre}`,
    description: desc,
    openGraph: {
      title: `${detalle.oferta.titulo} — ${detalle.empresa.nombre}`,
      description: desc,
      type: "website",
    },
  };
}
