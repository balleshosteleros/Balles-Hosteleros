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

  // El fondo de la página NUNCA debe ser el mismo color plano que las
  // secciones — si lo fuera, los bloques flotan sin contraste. Construimos
  // un degradado muy difuminado a partir del color corporativo + acento +
  // negro, y sumamos varios orbes blur grandes para dar profundidad visual
  // clara (perceptible sin esfuerzo).
  const pageBackground = `
    radial-gradient(circle at 10% -10%, ${accent}aa 0%, transparent 55%),
    radial-gradient(circle at 90% 10%, ${bg}aa 0%, transparent 50%),
    radial-gradient(circle at 50% 110%, ${accent}88 0%, transparent 60%),
    linear-gradient(160deg, ${bg} 0%, #050505 70%, #000 100%)
  `;

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundImage: pageBackground, backgroundColor: "#050505" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[640px] w-[640px] rounded-full blur-[120px] opacity-70 mix-blend-screen"
        style={{ backgroundColor: accent }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-48 h-[680px] w-[680px] rounded-full blur-[140px] opacity-60 mix-blend-screen"
        style={{ backgroundColor: bg }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-56 left-1/4 h-[720px] w-[720px] rounded-full blur-[160px] opacity-55 mix-blend-screen"
        style={{ backgroundColor: accent }}
      />
      <div className="relative max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-6 md:space-y-10">
        {data.presentacion.map((s, i) => (
          <SlideRenderer key={s.id} slide={s} theme={data.empresa} index={i} />
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
