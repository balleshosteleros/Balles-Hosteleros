import { GraduationCap } from "lucide-react";
import { FormacionView } from "@/features/formacion/components/FormacionView";
import { OnboardingCompleteButton } from "@/features/formacion/components/OnboardingGuard";

export default function FormacionPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-600/10 p-2 text-blue-600">
          <GraduationCap className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">ONBOARDING</h1>
          <p className="text-sm text-muted-foreground">
            Tu plan de formación dentro de Balles Hosteleros
          </p>
        </div>
      </div>

      <FormacionView />
      <div className="px-4 pb-6 md:px-6">
        <OnboardingCompleteButton />
      </div>
    </div>
  );
}
