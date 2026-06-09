"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/contexts/auth-context";

/**
 * Botón de cerrar sesión para el Inicio móvil. Con confirmación para evitar
 * salidas accidentales; `signOut` limpia la sesión y redirige a "/".
 */
export function CerrarSesionButton() {
  const { signOut } = useAuth();
  const [confirmando, setConfirmando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label="Cerrar sesión"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/60 text-muted-foreground backdrop-blur active:bg-muted"
      >
        <LogOut className="h-4 w-4" />
      </button>

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
              onClick={async () => {
                setSaliendo(true);
                await signOut();
              }}
              disabled={saliendo}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 text-sm font-semibold text-white active:bg-rose-600 disabled:opacity-60"
            >
              {saliendo ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sí, cerrar sesión"}
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
