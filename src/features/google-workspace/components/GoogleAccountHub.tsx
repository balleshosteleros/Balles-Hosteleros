"use client";

import { usePathname } from "next/navigation";
import { LogOut, Plus, Check, UserCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGoogleConnection } from "./useGoogleConnection";

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

function Avatar({ email, size = "sm" }: { email: string; size?: "sm" | "md" }) {
  const inicial = email.charAt(0).toUpperCase();
  const sizeClass = size === "md" ? "h-9 w-9 text-sm" : "h-6 w-6 text-[11px]";
  return (
    <div className={`flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 font-bold text-white shrink-0 ${sizeClass}`}>
      {inicial}
    </div>
  );
}

export function GoogleAccountHub() {
  const pathname = usePathname();
  const { connected, email, knownAccounts, disconnect } = useGoogleConnection();

  const otherAccounts = knownAccounts.filter((a) => a !== email);
  const connectUrl = (hint?: string) => {
    const base = `/api/google/connect?switch=1&next=${encodeURIComponent(pathname || "/dashboard")}`;
    return hint ? `${base}&login_hint=${encodeURIComponent(hint)}` : base;
  };

  if (!connected) {
    return (
      <a
        href={`/api/google/connect?next=${encodeURIComponent(pathname || "/dashboard")}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
      >
        <GoogleLogo className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Conectar Google</span>
      </a>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs font-medium shadow-sm transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={`Cuenta activa: ${email ?? ""}`}
        >
          <Avatar email={email ?? "G"} size="sm" />
          <span className="hidden max-w-[140px] truncate md:inline text-muted-foreground">
            {email}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="center" className="w-72">
        {/* Cuenta activa */}
        <DropdownMenuLabel className="flex items-center gap-2.5 py-3">
          <Avatar email={email ?? "G"} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{email}</p>
            <p className="text-[10px] text-emerald-600 font-medium">Cuenta activa</p>
          </div>
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
        </DropdownMenuLabel>

        {/* Otras cuentas conocidas */}
        {otherAccounts.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Otras cuentas
            </p>
            {otherAccounts.map((acc) => (
              <DropdownMenuItem key={acc} asChild>
                <a href={connectUrl(acc)} className="flex items-center gap-2.5 cursor-pointer">
                  <Avatar email={acc} size="sm" />
                  <span className="flex-1 truncate text-xs">{acc}</span>
                </a>
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Añadir cuenta */}
        <DropdownMenuItem asChild>
          <a href={connectUrl()} className="cursor-pointer gap-2">
            <Plus className="h-4 w-4" />
            Añadir otra cuenta de Google
          </a>
        </DropdownMenuItem>

        {/* Desconectar */}
        <DropdownMenuItem
          onClick={() => disconnect()}
          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Desconectar esta cuenta
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <div className="px-3 py-2 text-[10px] text-muted-foreground flex items-center gap-1.5">
          <UserCircle2 className="h-3 w-3 shrink-0" />
          Tus emails y eventos solo los ves tú
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
