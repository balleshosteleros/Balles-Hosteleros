"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CreditCard,
  Ticket,
  Wallet,
  Lock,
  Users,
  MessageSquare,
  CheckCheck,
  CircleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Reserva, ClienteInsights } from "@/features/sala/data/reservas";

/** 98 → "98,00 €" (coma decimal). */
function fmtEuro(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

interface Props {
  reserva: Reserva;
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
  insights,
  className,
  size = "sm",
}: Props) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const chipSize = size === "sm" ? "h-5 px-1.5" : "h-6 px-2";
  const tieneObs = !!reserva.observaciones && reserva.observaciones.trim().length > 0;
  const reconfirmada = !!reserva.reconfirmadaAt;

  const chips: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    cls: string;
    extra?: string;
    /** Contenido del tooltip cuando no basta con la etiqueta (comentario completo). */
    tooltip?: React.ReactNode;
  }> = [];

  if (reserva.tarjetaIntroducida) {
    chips.push({ key: "tarjeta", label: "Tarjeta introducida", icon: <CreditCard className={iconSize} />, cls: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10" });
  }
  if (reserva.esTicket) {
    // Rojo y al lado del nombre: es la marca de que esa mesa ya está pagada.
    // Al pasar el ratón se ve qué compró y cuánto, sin abrir la ficha.
    const unidades = reserva.ticketUnidades ?? reserva.comensales ?? 1;
    const total = reserva.ticketImporte ?? 0;
    const unitario = unidades > 0 ? total / unidades : total;
    chips.push({
      key: "ticket",
      label: "Reserva con Ticket",
      icon: <Ticket className={iconSize} />,
      cls: "text-red-600 border-red-500/40 bg-red-500/10",
      tooltip: (
        <span className="block text-left leading-relaxed">
          <span className="block font-medium">
            {reserva.ticketProductoNombre ?? "Reserva con Ticket"}
          </span>
          {total > 0 && (
            <span className="block">
              {unidades > 1
                ? `${unidades} personas × ${fmtEuro(unitario)} = ${fmtEuro(total)}`
                : fmtEuro(total)}
            </span>
          )}
          {reserva.ticketCodigo && (
            <span className="block font-mono text-[10px] opacity-70">
              {reserva.ticketCodigo}
            </span>
          )}
        </span>
      ),
    });
  }
  if (reserva.garantiaImporte != null && reserva.garantiaImporte > 0) {
    chips.push({ key: "garantia", label: `Importe retenido ${reserva.garantiaImporte}€`, icon: <Wallet className={iconSize} />, cls: "text-amber-600 border-amber-500/40 bg-amber-500/10" });
  }
  if (reserva.tipoCategoria === "cupon" && reserva.importePagado != null && reserva.importePagado > 0) {
    chips.push({ key: "cupon", label: `Cupón pagado ${reserva.importePagado}€`, icon: <Ticket className={iconSize} />, cls: "text-emerald-600 border-emerald-500/40 bg-emerald-500/10" });
  }
  if (reserva.codigo) {
    chips.push({
      key: "codigo_cupon",
      label: `Cupón ${reserva.codigo}`,
      icon: <Ticket className={iconSize} />,
      cls: "text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/10",
      extra: reserva.codigo,
    });
  }
  if (reserva.tipoCategoria === "gratis") {
    chips.push({ key: "gratis", label: "Reserva gratis", icon: <span className="leading-none">🆓</span>, cls: "text-zinc-600 border-zinc-400/40 bg-zinc-200/40" });
  }
  if (reserva.bloqueada) {
    chips.push({ key: "bloqueada", label: "Reserva bloqueada", icon: <Lock className={iconSize} />, cls: "text-zinc-500 border-zinc-500/40 bg-zinc-500/10" });
  }
  if (reserva.grupoId) {
    chips.push({ key: "grupo", label: "Reserva de grupo", icon: <Users className={iconSize} />, cls: "text-rose-500 border-rose-500/40 bg-rose-500/10" });
  }
  if (tieneObs) {
    // El tooltip de este chip NO es una etiqueta: enseña el comentario entero.
    // Se lee pasando el ratón por encima, sin abrir la ficha.
    chips.push({
      key: "comentario",
      label: "Comentarios",
      icon: <MessageSquare className={iconSize} />,
      cls: "text-muted-foreground border-border",
      tooltip: reserva.observaciones!.trim(),
    });
  }
  if (reconfirmada) {
    chips.push({ key: "reconfirmada", label: "Reserva reconfirmada", icon: <CheckCheck className={iconSize} />, cls: "text-teal-500 border-teal-500/40 bg-teal-500/10" });
  }
  // El ORIGEN de la reserva (web, channel manager…) NO lleva icono: ya tiene
  // su propia columna en el listado y repetirlo pegado al nombre solo restaba
  // sitio al dato por el que se busca a la gente en sala.
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
                {c.key === "garantia" && <span>{reserva.garantiaImporte}€</span>}
                {c.key === "cupon" && <span>{reserva.importePagado}€</span>}
                {c.extra && <span>{c.extra}</span>}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className={c.tooltip ? "max-w-xs whitespace-pre-wrap text-left" : undefined}>
              {c.tooltip ?? c.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
