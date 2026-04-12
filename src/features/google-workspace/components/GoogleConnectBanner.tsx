"use client";

import { ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";

interface Props {
  servicio: string;
}

export function GoogleConnectBanner({ servicio }: Props) {
  const pathname = usePathname();
  const href = `/api/google/connect?next=${encodeURIComponent(pathname || "/dashboard")}`;

  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3 sm:flex-row sm:items-center dark:border-blue-900/50 dark:bg-blue-950/30">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-blue-600 p-1.5 text-white">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">
            Conecta tu cuenta de Google para ver tu {servicio} aquí dentro
          </p>
          <p className="text-[11px] text-muted-foreground">
            Estás viendo datos de demostración. Conéctate y trabajarás con tus
            datos reales sin salir de la plataforma.
          </p>
        </div>
      </div>
      {/* Link directo a la ruta server: 1 redirect → Google. Sin JS, sin lag. */}
      <a
        href={href}
        className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        Conectar Google
      </a>
    </div>
  );
}
