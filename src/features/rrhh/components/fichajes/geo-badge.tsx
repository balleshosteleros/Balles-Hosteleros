"use client";

import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, MapPin, MapPinOff } from "lucide-react";
import type { Fichaje } from "@/features/rrhh/data/fichajes";
import {
  FICHAJE_GEO_STATUS_LABEL,
  getFichajeGeoStatus,
  type FichajeGeoStatus,
} from "@/features/rrhh/utils/fichaje-geo-status";

type IconType = ComponentType<{ className?: string }>;

const STATUS_CONFIG: Record<
  FichajeGeoStatus,
  { className: string; icon: IconType }
> = {
  "en-local": {
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: Check,
  },
  teletrabajo: {
    className: "bg-violet-50 text-violet-700 border-violet-200",
    icon: MapPin,
  },
  fuera: {
    className: "bg-rose-50 text-rose-700 border-rose-200",
    icon: AlertTriangle,
  },
  "sin-datos": {
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
    icon: MapPinOff,
  },
};

function formatDistancia(metros: number | null | undefined): string | null {
  if (metros == null) return null;
  if (metros >= 50000) return ">50 km";
  if (metros >= 5000) return ">5 km";
  if (metros >= 1000) return `${(metros / 1000).toFixed(1)} km`;
  return `${Math.round(metros)} m`;
}

interface GeoBadgeProps {
  fichaje: Fichaje;
  /**
   * Si `true`, muestra solo el badge sin distancia anexa.
   * Útil en celdas estrechas o leyendas.
   */
  compact?: boolean;
}

/**
 * Badge visual del estado geográfico de un fichaje, con distancia precalculada
 * server-side al lado. Consume `Fichaje` con sus campos geo opcionales — si
 * faltan, el helper devuelve `sin-datos` y el badge se renderiza en gris.
 */
export function GeoBadge({ fichaje, compact = false }: GeoBadgeProps) {
  const status = getFichajeGeoStatus(fichaje, fichaje.local ?? null);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const distancia = formatDistancia(fichaje.distanciaEntradaMetros);
  const mostrarDistancia =
    !compact && distancia !== null && status !== "teletrabajo" && status !== "sin-datos";

  return (
    <div className="inline-flex items-center gap-1.5">
      <Badge variant="outline" className={`text-xs gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {FICHAJE_GEO_STATUS_LABEL[status]}
      </Badge>
      {mostrarDistancia && (
        <span className="text-xs text-muted-foreground tabular-nums">{distancia}</span>
      )}
    </div>
  );
}
