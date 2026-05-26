/**
 * Página pública /r/[token] — formulario de reseña abierto desde el email.
 *
 * Si llega con ?rating=5 y la empresa tiene activado el filtro
 * `redirigir_5estrellas_google`, este server-component NO redirige todavía:
 * deja que el cliente envíe la reseña primero (queda registrada interna)
 * y entonces el cliente component decide la redirección. Esto evita
 * "perder" reseñas que el cliente pulsó pero no llegó a confirmar.
 */

import { notFound } from "next/navigation";
import { fetchResenaPagina } from "@/features/visita/services/resena-fetch";
import { ResenaForm } from "@/features/visita/components/ResenaForm";

export const dynamic = "force-dynamic";

export default async function ResenaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ rating?: string }>;
}) {
  const { token } = await params;
  const { rating } = await searchParams;
  const data = await fetchResenaPagina(token);
  if (!data) notFound();

  const ratingInicial = (() => {
    const n = Number(rating);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  })();

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <ResenaForm
        token={token}
        nombreLead={data.lead.nombre}
        nombreEmpresa={data.empresa.nombre}
        logoUrl={data.empresa.logoUrl}
        colorPrimario={data.empresa.colorPrimario}
        ratingInicial={ratingInicial}
        redirigir5EstrellasGoogle={data.empresa.redirigir5EstrellasGoogle}
        googleReviewUrl={data.empresa.googleReviewUrl}
      />
    </main>
  );
}

export function generateMetadata() {
  return { title: "Tu opinión nos importa" };
}
