"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { AppExterna } from "../data/tipos";

function AppLogo({ nombre, logoUrl }: { nombre: string; logoUrl?: string | null }) {
  const [imgError, setImgError] = useState(false);
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-orange-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-sky-500",
    "bg-amber-600",
  ];
  const color = colors[(nombre.charCodeAt(0) || 0) % colors.length];

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={nombre}
        onError={() => setImgError(true)}
        className="h-12 w-12 rounded-lg object-contain p-1.5 bg-white dark:bg-white/90 border border-border/40"
      />
    );
  }
  return (
    <div
      className={`h-12 w-12 ${color} rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0`}
    >
      {nombre[0]?.toUpperCase()}
    </div>
  );
}

export function AppCard({
  app,
  credencialesVisibles,
  onClick,
}: {
  app: AppExterna;
  credencialesVisibles: number;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all p-4 group"
    >
      <div className="flex items-start gap-3">
        <AppLogo nombre={app.nombre} logoUrl={app.logo_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm truncate">{app.nombre}</h3>
            {app.url && (
              <a
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                title="Abrir app"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] mt-1 font-normal">
            {app.categoria}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1.5">
            {credencialesVisibles === 0
              ? "Sin credenciales visibles"
              : credencialesVisibles === 1
                ? "1 credencial"
                : `${credencialesVisibles} credenciales`}
          </p>
        </div>
      </div>
    </Card>
  );
}
