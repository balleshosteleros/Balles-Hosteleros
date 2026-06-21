"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  UserCircle,
  Building2,
  LogOut,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

type Vista = "paneles" | "departamentos";

/** Rutas de cada vista en el móvil (equivalente al toggle del software). */
const VISTA_RUTA: Record<Vista, string> = {
  paneles: "/m",
  departamentos: "/m/departamentos",
};

/** Iniciales del nombre para el avatar de respaldo. */
function inicialesNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "·";
}

interface Props {
  nombre: string;
  avatarUrl: string | null;
}

/**
 * Menú que se abre al pulsar la foto del empleado (mismo formato que el del
 * software): cambiar vista paneles/departamentos y, abajo del todo, cerrar
 * sesión. No incluye "Ajustes" (eso es exclusivo del software de escritorio).
 */
export function EmpleadoMenuMobile({ nombre, avatarUrl }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "/m";
  const [confirmando, setConfirmando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  // Vista activa según la ruta: /m/departamentos = departamentos; resto = paneles.
  const vistaActiva: Vista = pathname.startsWith("/m/departamentos")
    ? "departamentos"
    : "paneles";

  const irA = (modo: Vista) => {
    if (modo === vistaActiva) return;
    router.push(VISTA_RUTA[modo]);
  };

  const cerrarSesion = async () => {
    setSaliendo(true);
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
    } catch {
      /* seguimos: limpiamos también en el servidor */
    }
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* si falla, igual navegamos al login */
    }
    window.location.href = "/?logout=1";
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Mi panel"
            className="flex shrink-0 items-center justify-center rounded-full focus:outline-none active:opacity-70"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-border">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={nombre}
                  width={36}
                  height={36}
                  className="h-9 w-9 object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-xs font-bold text-primary">
                  {inicialesNombre(nombre)}
                </span>
              )}
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cambiar vista
          </DropdownMenuLabel>

          <DropdownMenuItem
            className={`cursor-pointer gap-2 px-3 py-2 ${vistaActiva === "paneles" ? "bg-accent/60" : ""}`}
            onSelect={() => irA("paneles")}
          >
            <UserCircle
              className={`h-4 w-4 ${vistaActiva === "paneles" ? "text-primary" : "text-muted-foreground"}`}
            />
            <span
              className={`text-xs uppercase tracking-widest ${vistaActiva === "paneles" ? "font-bold text-primary" : "font-semibold"}`}
            >
              MIS PANELES
            </span>
            {vistaActiva === "paneles" && (
              <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary" />
            )}
          </DropdownMenuItem>

          <DropdownMenuItem
            className={`cursor-pointer gap-2 px-3 py-2 ${vistaActiva === "departamentos" ? "bg-accent/60" : ""}`}
            onSelect={() => irA("departamentos")}
          >
            <Building2
              className={`h-4 w-4 ${vistaActiva === "departamentos" ? "text-primary" : "text-muted-foreground"}`}
            />
            <span
              className={`text-xs uppercase tracking-widest ${vistaActiva === "departamentos" ? "font-bold text-primary" : "font-semibold"}`}
            >
              MIS DEPARTAMENTOS
            </span>
            {vistaActiva === "departamentos" && (
              <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary" />
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirmando(true);
            }}
            className="cursor-pointer gap-2 px-3 py-1.5 text-destructive focus:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">CERRAR SESIÓN</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmación de cierre de sesión (evita salidas accidentales al tacto) */}
      {confirmando && (
        <div
          className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/50"
          onClick={() => !saliendo && setConfirmando(false)}
        >
          <div
            className="rounded-t-3xl bg-background p-5 pb-[max(env(safe-area-inset-bottom),20px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-950">
                <LogOut className="h-6 w-6" />
              </div>
              <h2 className="mt-3 text-lg font-semibold">¿Cerrar sesión?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tendrás que volver a iniciar sesión con tu correo para entrar.
              </p>
            </div>

            <button
              type="button"
              onClick={cerrarSesion}
              disabled={saliendo}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 text-sm font-semibold text-white active:bg-rose-600 disabled:opacity-60"
            >
              {saliendo ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Sí, cerrar sesión"
              )}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={saliendo}
              className="mt-2 h-11 w-full rounded-2xl text-sm font-medium text-muted-foreground active:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
