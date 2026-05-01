"use client";

import { LogOut, RefreshCw, UserCircle2 } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useGoogleConnection } from "./useGoogleConnection";

export function GoogleAccountButton() {
  const { connected, email, disconnect } = useGoogleConnection();
  const pathname = usePathname();

  if (!connected) {
    // Si no está conectado, mostramos un botón directo de "Conectar Google"
    return (
      <a
        href={`/api/google/connect?next=${encodeURIComponent(pathname || "/")}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <span className="hidden md:inline">Conectar Google</span>
      </a>
    );
  }

  const inicial = email?.charAt(0).toUpperCase() ?? "G";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={`Cuenta Google: ${email ?? ""}`}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-[11px] font-bold text-white">
            {inicial}
          </div>
        </Button>
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
            href={`/api/google/connect?next=${encodeURIComponent(pathname || "/")}&switch=1`}
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
          <UserCircle2 className="mr-1 inline h-3 w-3" />
          Tus emails y eventos solo los ves tú
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
