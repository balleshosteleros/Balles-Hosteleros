import { notFound } from "next/navigation";
import { fetchInspeccionPublica } from "@/features/calidad/inspecciones/public-data";
import { SlideRenderer } from "@/features/calidad/inspecciones/components/SlideRenderer";
import { PublicFormulario } from "@/features/calidad/inspecciones/components/PublicFormulario";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InspectoresPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchInspeccionPublica(token);
  if (!data) notFound();

  const bg = data.empresa.color ?? "hsl(210 50% 20%)";

  return (
    <main className="min-h-screen" style={{ backgroundColor: bg }}>
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-6 md:space-y-10">
        {data.presentacion.map((s) => (
          <SlideRenderer key={s.id} slide={s} theme={data.empresa} />
        ))}
        <div className="pt-4">
          <PublicFormulario token={token} data={data} />
        </div>
      </div>
    </main>
  );
}
