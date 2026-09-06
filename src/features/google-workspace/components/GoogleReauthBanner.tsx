"use client";

import { usePathname } from "next/navigation";

interface Props {
  servicio?: string;
}

export function GoogleReauthBanner({ servicio }: Props) {
  const pathname = usePathname();
  const href = `/api/google/connect?next=${encodeURIComponent(pathname || "/")}`;

  return (
    <div className="border-b bg-amber-50/60 px-5 py-3">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold text-foreground">
            Tu cuenta de Google necesita un permiso más
          </p>
          <p className="text-[11px] text-muted-foreground">
            {servicio
              ? `Autorízala de nuevo para ver ${servicio}. No pierdes nada: es la misma cuenta y el correo y el calendario siguen igual.`
              : "Autorízala de nuevo para seguir sincronizando. Es la misma cuenta: no pierdes nada."}
          </p>
        </div>
        <a
          href={href}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-amber-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
        >
          Autorizar
        </a>
      </div>
    </div>
  );
}
