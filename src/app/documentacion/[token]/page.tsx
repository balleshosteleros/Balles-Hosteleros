import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { fetchDocumentacionPorToken } from "@/features/empleo-publico/services/empleo-fetch";
import { EmpleoBrandingShell } from "@/features/empleo-publico/components/EmpleoBrandingShell";
import { FormDocumentacionPublica } from "@/features/empleo-publico/components/FormDocumentacionPublica";

export const dynamic = "force-dynamic";

export default async function DocumentacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const datos = await fetchDocumentacionPorToken(token);
  if (!datos) notFound();

  const primerNombre = datos.candidatoNombre.split(" ")[0] || "";

  return (
    <EmpleoBrandingShell empresa={datos.empresa}>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Aporta tu documentación
          </h1>
          <p className="text-muted-foreground">
            {primerNombre ? `Hola ${primerNombre}, ` : ""}para continuar con tu incorporación
            necesitamos tu documentación. Adjunta cada documento (foto o archivo) y revisa
            los datos que detectemos automáticamente.
          </p>
        </header>

        {datos.yaCompletada ? (
          <div className="rounded-lg border bg-card p-8 text-center space-y-3">
            <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500" />
            <h2 className="text-lg font-semibold">Documentación recibida</h2>
            <p className="text-sm text-muted-foreground">
              Ya hemos recibido tu documentación. Si necesitas modificar algo, ponte en
              contacto con el equipo de Recursos Humanos.
            </p>
          </div>
        ) : (
          <FormDocumentacionPublica
            token={datos.token}
            empresaSlug={datos.empresa.empleo_slug}
          />
        )}
      </div>
    </EmpleoBrandingShell>
  );
}

export async function generateMetadata() {
  return { title: "Aporta tu documentación", robots: { index: false, follow: false } };
}
