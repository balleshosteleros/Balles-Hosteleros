"use client";

import { Check, Loader2, LogOut, Plus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGoogleConnection, type CuentaGoogle } from "./useGoogleConnection";

const GOOGLE_RING_BG =
  "conic-gradient(from 0deg, #4285F4 0deg, #4285F4 90deg, #EA4335 90deg, #EA4335 180deg, #FBBC05 180deg, #FBBC05 270deg, #34A853 270deg, #34A853 360deg)";

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function Avatar({
  cuenta,
  size = "sm",
  showRing = true,
}: {
  cuenta: { email?: string | null; name?: string | null; picture?: string | null };
  size?: "sm" | "md" | "lg";
  showRing?: boolean;
}) {
  const dims =
    size === "lg" ? "h-9 w-9 text-sm" : size === "md" ? "h-7 w-7 text-xs" : "h-6 w-6 text-[10px]";
  const ringPad = size === "lg" ? "p-[2px]" : "p-[1.5px]";
  const innerGap = size === "lg" ? "p-[1.5px]" : "p-[1px]";
  const inicial = (cuenta.name || cuenta.email || "G").charAt(0).toUpperCase();
  const inner = cuenta.picture ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cuenta.picture}
      alt={cuenta.name ?? cuenta.email ?? "Cuenta Google"}
      referrerPolicy="no-referrer"
      className={`${dims} shrink-0 rounded-full object-cover`}
    />
  ) : (
    <div
      className={`${dims} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 font-bold text-white`}
    >
      {inicial}
    </div>
  );
  if (!showRing) return inner;
  return (
    <div
      className={`${ringPad} shrink-0 rounded-full`}
      style={{ background: GOOGLE_RING_BG }}
    >
      <div className={`${innerGap} rounded-full bg-card`}>{inner}</div>
    </div>
  );
}

export function GoogleHeaderPill() {
  const {
    connected,
    email,
    picture,
    name,
    accounts,
    switching,
    disconnect,
    switchTo,
  } = useGoogleConnection();
  const pathname = usePathname();
  const router = useRouter();
  const next = encodeURIComponent(pathname || "/");
  const [open, setOpen] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  if (!connected) {
    return (
      <a
        href={`/api/google/connect?next=${next}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-card shadow-sm transition-colors hover:bg-muted"
        title="Conecta tu cuenta de Google para sincronizar correo, calendario y Meet"
        aria-label="Conectar mi Google"
      >
        <GoogleLogo className="h-3.5 w-3.5 shrink-0" />
      </a>
    );
  }

  const cuentaActiva: CuentaGoogle = {
    email: email ?? "",
    name: name ?? "",
    picture: picture ?? "",
  };

  const otras = accounts.filter(
    (a) => a.email.toLowerCase() !== (email ?? "").toLowerCase(),
  );

  const onSwitch = async (correo: string) => {
    setBusyEmail(correo);
    const ok = await switchTo(correo);
    setBusyEmail(null);
    if (ok) {
      setOpen(false);
      router.refresh();
    } else {
      window.location.href = `/api/google/connect?next=${next}&switch=1`;
    }
  };

  const onRemove = async (correo: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusyEmail(correo);
    await disconnect(correo);
    setBusyEmail(null);
    router.refresh();
  };

  const onSignOutActive = async () => {
    setBusyEmail(email ?? "");
    await disconnect(email ?? undefined);
    setBusyEmail(null);
    setOpen(false);
    router.refresh();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-card shadow-sm transition-colors hover:bg-muted"
          title={`Cuenta Google activa: ${email ?? ""}`}
          aria-label={`Cuenta Google activa: ${email ?? ""}`}
        >
          {switching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Avatar cuenta={cuentaActiva} size="sm" showRing={false} />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <DropdownMenuLabel className="flex items-center gap-2 border-b bg-muted/40 px-3 py-3">
          <Avatar cuenta={cuentaActiva} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">
              {name || "Conectado a Google"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {email}
            </p>
          </div>
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
        </DropdownMenuLabel>

        {otras.length > 0 && (
          <>
            <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Otras cuentas
            </div>
            {otras.map((cuenta) => {
              const ocupada = busyEmail === cuenta.email;
              return (
                <div
                  key={cuenta.email}
                  className="group flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted"
                >
                  <button
                    type="button"
                    onClick={() => onSwitch(cuenta.email)}
                    disabled={ocupada}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-60"
                  >
                    {ocupada ? (
                      <Loader2 className="h-7 w-7 shrink-0 animate-spin p-1.5 text-muted-foreground" />
                    ) : (
                      <Avatar cuenta={cuenta} size="sm" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {cuenta.name || cuenta.email}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {cuenta.email}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onRemove(cuenta.email, e)}
                    disabled={ocupada}
                    aria-label={`Quitar ${cuenta.email}`}
                    title="Quitar cuenta"
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-30"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a
            href={`/api/google/connect?next=${next}&switch=1`}
            className="cursor-pointer"
            title="Solo la primera vez por cuenta. Después cambias con un click."
          >
            <Plus className="mr-2 h-4 w-4" />
            Añadir otra cuenta de Google
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onSignOutActive}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Desconectar esta cuenta
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground">
          Tus emails y eventos solo los ves tú.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
