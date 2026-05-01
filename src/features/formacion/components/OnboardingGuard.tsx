"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/contexts/auth-context";

const STORAGE_KEY = "balles:onboarding-completado";

/**
 * Overlay que bloquea la app si el usuario no ha completado el onboarding.
 *
 * Fase 1 (actual): usa localStorage por usuario. Lo primero que ve un empleado
 * nuevo al entrar es este overlay que le obliga a ir a /formacion.
 *
 * Fase 2 (futura): reemplazar localStorage por un campo `onboarding_completado`
 * en la tabla `profiles` de Supabase, para que la info viaje con el usuario.
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, roles, loading } = useAuth();
  const pathname = usePathname();
  const [completado, setCompletado] = useState(true); // default true para evitar flash
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!user) return;
    const val = localStorage.getItem(`${STORAGE_KEY}-${user.id}`);
    setCompletado(val === "true");
  }, [user]);

  const esFormacion = pathname === "/formacion";
  // Exentos del onboarding obligatorio:
  // - Auth todavía cargando (evita flash mientras llegan los roles)
  // - No hay user
  // - Roles admin, director, gerencia (ellos no necesitan el onboarding de empleado)
  const exento =
    loading ||
    !user ||
    roles.some((r) => ["admin", "director", "gerencia"].includes(r));

  if (!mounted || completado || esFormacion || exento) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Overlay fullscreen */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <div className="mx-auto max-w-lg px-6 text-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400">
            <GraduationCap className="h-10 w-10" />
          </div>

          <h1 className="mt-6 text-3xl font-bold text-white">
            Bienvenido a Balles Hosteleros
          </h1>

          <p className="mt-4 text-base leading-relaxed text-blue-200/80">
            Antes de empezar a trabajar, necesitas completar tu{" "}
            <strong className="text-white">formación de entrada</strong>.
            Es un recorrido rápido por cada área de la empresa para que
            entiendas cómo funciona todo.
          </p>

          <div className="mt-8 space-y-3">
            <Button
              asChild
              size="lg"
              className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30"
            >
              <Link href="/formacion">
                <Sparkles className="h-5 w-5" />
                Empezar mi formación
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <p className="text-xs text-blue-300/50">
              Cuando termines de revisar todos los apartados, podrás
              acceder a la plataforma completa.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Botón que el usuario pulsa en /formacion cuando ha terminado.
 * Guarda en localStorage que completó y redirige al dashboard.
 */
export function OnboardingCompleteButton() {
  const { user } = useAuth();

  function completar() {
    if (!user) return;
    localStorage.setItem(`${STORAGE_KEY}-${user.id}`, "true");
    window.location.href = "/";
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-6 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
      <h2 className="mt-3 text-lg font-bold text-foreground">
        ¿Has terminado de revisar todos los apartados?
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Cuando pulses este botón, podrás acceder a todas las
        funcionalidades de la plataforma. Siempre puedes volver aquí
        desde el botón ONBOARDING del menú.
      </p>
      <Button
        onClick={completar}
        size="lg"
        className="mt-4 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
      >
        <CheckCircle2 className="h-5 w-5" />
        He terminado mi formación
      </Button>
    </div>
  );
}
