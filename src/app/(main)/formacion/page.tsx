import { FormacionView } from "@/features/formacion/components/FormacionView";
import { OnboardingCompleteButton } from "@/features/formacion/components/OnboardingGuard";

export default function FormacionPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <FormacionView />
      <div className="px-4 pb-6 md:px-6">
        <OnboardingCompleteButton />
      </div>
    </div>
  );
}
