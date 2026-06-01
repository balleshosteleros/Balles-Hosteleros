"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CreditCard,
  Ticket,
  ShieldAlert,
  Wallet,
  Lock,
  Users,
  MessageSquare,
  Globe,
  RefreshCw,
  CheckCheck,
  CircleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  esOrigenChannelManager,
  type Reserva,
  type ReservaEtiqueta,
  type ClienteInsights,
} from "@/features/sala/data/reservas";

interface Props {
  reserva: Reserva;
  etiquetas?: ReservaEtiqueta[];
  insights?: ClienteInsights | null;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Pinta los iconos acumulables (flags) de una reserva. Solo aparece el chip
 * cuando el flag está activo; no ocupa espacio si no aplica.
 */
export function ReservaFlagsChips({
  reserva,
  etiquetas,
  insights,
  className,
  size = "sm",
}: Props) {
  const etiqueta = reserva.etiquetaId ? etiquetas?.find((t) => t.id === reserva.etiquetaId) : null;
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const chipSize = size === "sm" ? "h-5 px-1.5" : "h-6 px-2";
  const origen = reserva.origen ?? "";
  const isMotorWeb = origen.toLowerCase().includes("web") && !esOrigenChannelManager(origen);
  const isChannelManager = esOrigenChannelManager(origen);
  const tieneObs = !!reserva.observaciones && reserva.observaciones.trim().length > 0;
  const reconfirmada = !!reserva.reconfirmadaAt;

  const chips: Array<{ key: string; label: string; icon: React.ReactNode; cls: string; extra?: string }> = [];

  if (etiqueta) {
    chips.push({
      key: "etiqueta",
      label: etiqueta.nombre,
      icon: <span className="leading-none">{etiqueta.emoji ?? "📌"}</span>,
      cls: "border",
    });
  }
  if (reserva.tarjetaIntroducida) {
    chips.push({ key: "tarjeta", label: "Tarjeta introducida", icon: <CreditCard className={iconSize} />, cls: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10" });
  }
  if (reserva.esTicket) {
    chips.push({ key: "ticket", label: "Reserva tipo Ticket", icon: <Ticket className={iconSize} />, cls: "text-pink-500 border-pink-500/40 bg-pink-500/10" });
  }
  if (reserva.politicaCancelacionId) {
    chips.push({ key: "politica", label: "Política de cancelación", icon: <ShieldAlert className={iconSize} />, cls: "text-sky-500 border-sky-500/40 bg-sky-500/10" });
  }
  if (reserva.garantiaImporte != null && reserva.garantiaImporte > 0) {
    chips.push({ key: "garantia", label: `Garantía ${reserva.garantiaImporte}€`, icon: <Wallet className={iconSize} />, cls: "text-amber-600 border-amber-500/40 bg-amber-500/10" });
  }
  if (reserva.bloqueada) {
    chips.push({ key: "bloqueada", label: "Reserva bloqueada", icon: <Lock className={iconSize} />, cls: "text-zinc-500 border-zinc-500/40 bg-zinc-500/10" });
  }
  if (reserva.grupoId) {
    chips.push({ key: "grupo", label: "Reserva de grupo", icon: <Users className={iconSize} />, cls: "text-rose-500 border-rose-500/40 bg-rose-500/10" });
  }
  if (tieneObs) {
    chips.push({ key: "comentario", label: "Tiene comentario", icon: <MessageSquare className={iconSize} />, cls: "text-muted-foreground border-border" });
  }
  if (reconfirmada) {
    chips.push({ key: "reconfirmada", label: "Reserva reconfirmada", icon: <CheckCheck className={iconSize} />, cls: "text-teal-500 border-teal-500/40 bg-teal-500/10" });
  }
  if (isMotorWeb) {
    chips.push({ key: "web", label: "Reserva web", icon: <Globe className={iconSize} />, cls: "text-blue-500 border-blue-500/40 bg-blue-500/10" });
  }
  if (isChannelManager) {
    chips.push({ key: "channel", label: `Channel manager${origen ? ` · ${origen}` : ""}`, icon: <RefreshCw className={iconSize} />, cls: "text-zinc-600 border-zinc-500/40 bg-zinc-500/10" });
  }
  if (insights && insights.visitasSinValoracion > 0) {
    chips.push({
      key: "visitas_sin",
      label: `${insights.visitasSinValoracion} reserva${insights.visitasSinValoracion > 1 ? "s" : ""} previa${insights.visitasSinValoracion > 1 ? "s" : ""} sin valoración`,
      icon: <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />,
      cls: "text-blue-600 border-blue-500/40 bg-blue-500/10",
      extra: String(insights.visitasSinValoracion),
    });
  }
  if (insights && insights.visitasConValoracion > 0) {
    chips.push({
      key: "visitas_con",
      label: `${insights.visitasConValoracion} reserva${insights.visitasConValoracion > 1 ? "s" : ""} previa${insights.visitasConValoracion > 1 ? "s" : ""} con valoración`,
      icon: <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />,
      cls: "text-emerald-600 border-emerald-500/40 bg-emerald-500/10",
      extra: String(insights.visitasConValoracion),
    });
  }
  if (insights && insights.otrosLocalesGrupo > 0) {
    chips.push({
      key: "cross_local",
      label: `Cliente con histórico en ${insights.otrosLocalesGrupo} otro${insights.otrosLocalesGrupo > 1 ? "s" : ""} local${insights.otrosLocalesGrupo > 1 ? "es" : ""} de tu grupo`,
      icon: <CircleAlert className={iconSize} />,
      cls: "text-orange-500 border-orange-500/40 bg-orange-500/10",
    });
  }

  if (chips.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex flex-wrap items-center gap-1", className)}>
        {chips.map((c) => (
          <Tooltip key={c.key}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border text-[10px] font-medium",
                  chipSize,
                  c.cls,
                )}
              >
                {c.icon}
                {c.key === "etiqueta" && <span>{(c as { label: string }).label}</span>}
                {c.key === "garantia" && <span>{reserva.garantiaImporte}€</span>}
                {c.extra && <span>{c.extra}</span>}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{c.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
