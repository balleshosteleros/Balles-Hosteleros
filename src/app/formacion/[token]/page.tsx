import { notFound } from "next/navigation";
import { Clock, GraduationCap } from "lucide-react";
import { fetchFormacionPorToken } from "@/features/formacion/services/formacion-publica";
import { EmpleoBrandingShell } from "@/features/empleo-publico/components/EmpleoBrandingShell";
import { FormacionPublicaVista } from "@/features/formacion/components/FormacionPublicaVista";

export const dynamic = "force-dynamic";

export default async function FormacionPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const datos = await fetchFormacionPorToken(token);
  if (!datos) notFound();

  return (
    <EmpleoBrandingShell empresa={datos.empresa}>
      {datos.caducada ? (
        <div className="rounded-lg border bg-card p-8 text-center space-y-3">
          <Clock className="h-14 w-14 mx-auto text-amber-500" />
          <h2 className="text-lg font-semibold">Este enlace ha caducado</h2>
          <p className="text-sm text-muted-foreground">
            El plazo para acceder a tu formación con este enlace ha finalizado.
            Escribe al equipo de Recursos Humanos y te enviaremos uno nuevo.
          </p>
        </div>
      ) : datos.sinCurso ? (
        <div className="rounded-lg border bg-card p-8 text-center space-y-3">
          <GraduationCap className="h-14 w-14 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">Formación en preparación</h2>
          <p className="text-sm text-muted-foreground">
            Tu formación aún se está preparando. Recursos Humanos te avisará en
            cuanto esté disponible.
          </p>
        </div>
      ) : (
        <FormacionPublicaVista datos={datos} />
      )}
    </EmpleoBrandingShell>
  );
}

export async function generateMetadata() {
  return { title: "Tu formación", robots: { index: false, follow: false } };
}
