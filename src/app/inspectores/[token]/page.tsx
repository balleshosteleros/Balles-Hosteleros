import { fetchInspeccionPublica } from "@/features/calidad/inspecciones/public-data";
import { SlideRenderer } from "@/features/calidad/inspecciones/components/SlideRenderer";
import { PublicFormulario } from "@/features/calidad/inspecciones/components/PublicFormulario";
import { InvalidLinkScreen } from "@/features/calidad/inspecciones/components/InvalidLinkScreen";
import { InspectorChatDrawer } from "@/features/calidad/inspecciones/components/InspectorChatDrawer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InspectoresPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchInspeccionPublica(token);
  if (!data) return <InvalidLinkScreen />;

  const bg = data.empresa.color ?? "hsl(210 50% 20%)";
  const accent = data.empresa.color_secundario ?? data.empresa.color ?? "#10b981";

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
      <InspectorChatDrawer
        token={token}
        empresaNombre={data.empresa.nombre}
        accentColor={accent}
      />
    </main>
  );
}
