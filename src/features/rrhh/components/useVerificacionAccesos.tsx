"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/features/auth/contexts/auth-context";

/** Minutos que dura una verificación antes de volver a pedirla. */
const VERIFICACION_VALIDEZ_MIN = 5;

/**
 * Verifica la contraseña del usuario SIN tocar su sesión.
 * Hace un fetch directo al endpoint de login de Supabase desde el navegador.
 * La respuesta NO se guarda en ningún sitio (no persiste sesión, no escribe
 * cookies de @supabase/ssr), así que la sesión activa queda intacta pase lo
 * que pase. Solo nos interesa si responde 200 (correcta) o no.
 */
async function verificarPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return false;
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Gate de verificación para visualizar contraseñas de accesos a apps.
 *
 * Aunque el rol del usuario tenga permiso para ver una credencial, ANTES de
 * revelar/copiar cualquier valor el sistema pide reconfirmar la contraseña de
 * acceso. Tras una verificación correcta, queda válida durante unos minutos
 * (devueltos por el server) para no repetirla en cada clic.
 *
 * Provider autónomo: verifica la contraseña en el CLIENTE con un fetch directo
 * al endpoint de Supabase Auth, sin server action y sin tocar la sesión.
 */
type Ctx = {
  /** Asegura verificación vigente; abre el diálogo si hace falta. true si OK. */
  ensureVerificado: () => Promise<boolean>;
};

const VerificacionContext = createContext<Ctx | null>(null);

export function VerificacionAccesosProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const email = profile?.email ?? user?.email ?? "";
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validoHasta = useRef<number>(0);
  const pending = useRef<((ok: boolean) => void) | null>(null);

  const ensureVerificado = useCallback(async () => {
    if (performance.now() < validoHasta.current) return true;
    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
      setPassword("");
      setError(null);
      setOpen(true);
    });
  }, []);

  function resolvePending(ok: boolean) {
    pending.current?.(ok);
    pending.current = null;
  }

  async function handleConfirm() {
    if (!email) {
      setError("No se pudo determinar tu cuenta");
      return;
    }
    setLoading(true);
    setError(null);
    const ok = await verificarPassword(email, password);
    setLoading(false);
    if (!ok) {
      setError("Contraseña incorrecta");
      return;
    }
    validoHasta.current = performance.now() + VERIFICACION_VALIDEZ_MIN * 60_000;
    setOpen(false);
    setPassword("");
    resolvePending(true);
  }

  function handleCancel() {
    setOpen(false);
    setPassword("");
    resolvePending(false);
  }

  return (
    <VerificacionContext.Provider value={{ ensureVerificado }}>
      {children}
      <Dialog open={open} onOpenChange={(v) => !v && handleCancel()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Verificación de seguridad
            </DialogTitle>
            <DialogDescription>
              Para ver contraseñas, confirma tu contraseña de acceso. Quedará
              válida unos minutos.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            className="space-y-3"
          >
            <div>
              <Label htmlFor="verif-pwd-rrhh">Tu contraseña de acceso</Label>
              <Input
                id="verif-pwd-rrhh"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
              {error && <p className="text-[12px] text-destructive mt-1">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || password.length === 0}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Verificar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </VerificacionContext.Provider>
  );
}

export function useVerificacionAccesos(): Ctx {
  const ctx = useContext(VerificacionContext);
  if (!ctx) {
    throw new Error("useVerificacionAccesos debe usarse dentro de VerificacionAccesosProvider");
  }
  return ctx;
}
