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
import { verificarIdentidadAccesos } from "@/features/rrhh/actions/accesos-apps-actions";

/**
 * Gate de verificación para visualizar contraseñas de accesos a apps.
 *
 * Aunque el rol del usuario tenga permiso para ver una credencial, ANTES de
 * revelar/copiar cualquier valor el sistema pide reconfirmar la contraseña de
 * acceso. Tras una verificación correcta, queda válida durante unos minutos
 * (devueltos por el server) para no repetirla en cada clic.
 *
 * Provider autónomo: usa `verificarIdentidadAccesos` de las server actions de
 * rrhh (no depende del módulo `accesos`).
 */
type Ctx = {
  /** Asegura verificación vigente; abre el diálogo si hace falta. true si OK. */
  ensureVerificado: () => Promise<boolean>;
};

const VerificacionContext = createContext<Ctx | null>(null);

export function VerificacionAccesosProvider({ children }: { children: React.ReactNode }) {
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
    setLoading(true);
    setError(null);
    const res = await verificarIdentidadAccesos(password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    validoHasta.current = performance.now() + res.validezMin * 60_000;
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
