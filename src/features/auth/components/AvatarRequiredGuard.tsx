"use client";

import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { AvatarPicker } from "@/features/auth/components/AvatarPicker";

export function AvatarRequiredGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, roles, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const tieneFoto = !!profile?.avatar_url;
  const obligatorio = profile?.avatar_obligatorio === true;
  const exento =
    loading ||
    !user ||
    roles.some((r) => ["admin", "director", "gerencia"].includes(r));

  if (!mounted || tieneFoto || !obligatorio || exento) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400">
          <ImagePlus className="h-10 w-10" />
        </div>

        <h1 className="mt-6 text-3xl font-bold text-white">
          Añade tu foto de perfil
        </h1>
        <p className="mt-3 text-base leading-relaxed text-blue-200/80">
          Para continuar necesitas una foto tuya. Te ayuda a que tu equipo te
          reconozca y aparece en tu panel personal.
        </p>

        <div className="mt-8">
          <AvatarPicker variant="overlay" />
        </div>
      </div>
    </div>
  );
}
