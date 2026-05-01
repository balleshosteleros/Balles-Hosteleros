"use client";

import { LogOut, RefreshCw, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
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

export function GoogleHeaderPill() {
  const { connected, email, disconnect } = useGoogleConnection();
  const pathname = usePathname();
  const next = encodeURIComponent(pathname || "/");

  if (!connected) {
    return (
      <a
        href={`/api/google/connect?next=${next}`}
        className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-blue-300 bg-gradient-to-r from-blue-50 to-white px-3 text-[11px] font-semibold text-blue-700 shadow-sm transition-all hover:from-blue-100 hover:to-blue-50 dark:border-blue-900/60 dark:from-blue-950/50 dark:to-blue-950/30 dark:text-blue-200"
        title="Conecta tu cuenta de Google para usar tu correo y calendario reales aquí"
      >
        <GoogleLogo className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden lg:inline">Conectar mi Google</span>
        <span className="inline lg:hidden">Conectar</span>
        <Sparkles className="h-3 w-3 text-blue-500 transition-transform group-hover:scale-110" />
      </a>
    );
  }

  const inicial = email?.charAt(0).toUpperCase() ?? "G";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-full border bg-card px-1 pr-2.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          title={`Conectado como ${email ?? ""}`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-[10px] font-bold text-white shrink-0">
            {inicial}
          </span>
          <span className="hidden md:inline truncate max-w-[160px]">{email}</span>
          <span className="md:hidden">Google</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white">
            {inicial}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              Conectado a Google
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href={`/api/google/connect?next=${next}&switch=1`}
            className="cursor-pointer"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Cambiar de cuenta Google
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => disconnect()}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Desconectar Google
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
          Tu correo y calendario solo los ves tú.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
