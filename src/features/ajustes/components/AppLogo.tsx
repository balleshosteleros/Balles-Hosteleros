"use client";

import { useState } from "react";

// Logo de una aplicación externa. Si no hay logoUrl (o falla la carga) cae a un
// cuadro de color con la inicial. Compartido por Aplicaciones y Accesos.
export function AppLogo({ nombre, logoUrl }: { nombre: string; logoUrl?: string }) {
  const [err, setErr] = useState(false);
  const colors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500", "bg-rose-500", "bg-teal-500"];
  const color = colors[(nombre.charCodeAt(0) || 0) % colors.length];
  if (logoUrl && !err)
    return (
      <img
        src={logoUrl}
        alt={nombre}
        onError={() => setErr(true)}
        className={`h-7 w-7 rounded-md object-contain p-0.5 ${
          logoUrl.endsWith(".svg")
            ? "bg-transparent"
            : "bg-white dark:bg-white/90 border border-border/40"
        }`}
      />
    );
  return (
    <div className={`h-7 w-7 ${color} rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {nombre[0]?.toUpperCase() || "?"}
    </div>
  );
}
