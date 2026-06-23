import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { getOnboardingResumen } from "@/features/onboarding/actions/onboarding-actions";
import { OnboardingWizard } from "@/features/onboarding/components/OnboardingWizard";

export const metadata = { title: "Onboarding" };

// Asistente de volcado de datos inicial (PRP-067). La capa (main) ya garantiza
// sesión; el bootstrap es solo para el director (igual que el panel legacy).
export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { esDirector } = await getRolContext(user.id);
  if (!esDirector) redirect("/");

  const res = await getOnboardingResumen();
  if (!res.ok || !res.data) redirect("/");

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Pon tu empresa en marcha</h1>
        <p className="text-sm text-muted-foreground">
          Carga los datos iniciales de tu negocio paso a paso. Puedes salir y volver cuando quieras: se guarda tu avance.
        </p>
      </header>
      <OnboardingWizard initial={res.data} />
    </div>
  );
}
