import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export type ConexionStatus =
  | "PENDING"
  | "ACTIVE"
  | "REQUIRES_RECONSENT"
  | "EXPIRED"
  | "ERROR"
  | "REVOKED"
  | "NOT_CONNECTED";

const LABELS: Record<ConexionStatus, { label: string; className: string }> = {
  PENDING: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  ACTIVE: {
    label: "Activa",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  REQUIRES_RECONSENT: {
    label: "Renovar consentimiento",
    className: "bg-orange-100 text-orange-800 border-orange-300",
  },
  EXPIRED: {
    label: "Expirada",
    className: "bg-red-100 text-red-800 border-red-300",
  },
  ERROR: {
    label: "Error",
    className: "bg-red-100 text-red-800 border-red-300",
  },
  REVOKED: {
    label: "Revocada",
    className: "bg-zinc-200 text-zinc-700 border-zinc-300",
  },
  NOT_CONNECTED: {
    label: "Sin conectar",
    className: "bg-sky-100 text-sky-800 border-sky-300",
  },
};

export function EstadoConexionBadge({
  status,
  expiresAt,
}: {
  status: ConexionStatus;
  expiresAt?: string | null;
}) {
  const info = LABELS[status] ?? LABELS.ERROR;
  // `nowMs` fijo al montar para idempotencia del render; el badge no necesita
  // recalcular el diff en tiempo real (se re-renderiza al cambiar `expiresAt`).
  const [nowMs] = useState(() => Date.now());
  let extra = "";
  if (status === "ACTIVE" && expiresAt) {
    const diff = new Date(expiresAt).getTime() - nowMs;
    const dias = Math.ceil(diff / (24 * 60 * 60 * 1000));
    if (dias <= 7 && dias >= 0) extra = ` · ${dias}d`;
  }
  return (
    <Badge variant="outline" className={info.className}>
      {info.label}
      {extra}
    </Badge>
  );
}
