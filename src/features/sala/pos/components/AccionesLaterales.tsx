"use client";

import {
  ChefHat,
  Percent,
  Split,
  CreditCard,
  Receipt,
  ArrowLeftRight,
  Printer,
  DoorOpen,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePOSTicket } from "../hooks/usePOSTicket";

interface Props {
  onAbrirMesa: () => void;
  onEnviarCocina: () => void;
  onDescuento: () => void;
  onDividir: () => void;
  onCobrar: () => void;
  onHistorial: () => void;
  onImprimir: () => void;
  onCambiarMesa: () => void;
  onCerrarSesion: () => void;
}

export function AccionesLaterales({
  onAbrirMesa,
  onEnviarCocina,
  onDescuento,
  onDividir,
  onCobrar,
  onHistorial,
  onImprimir,
  onCambiarMesa,
  onCerrarSesion,
}: Props) {
  const { state, totales } = usePOSTicket();
  const tieneLineas = state.lineas.length > 0;

  return (
    <div className="flex h-full flex-col gap-1.5">
      <BotonAccion icon={Users} label="Mesa" onClick={onAbrirMesa} variant="outline" />
      <BotonAccion icon={ArrowLeftRight} label="Cambiar mesa" onClick={onCambiarMesa} variant="outline" disabled={!state.mesaId} />
      <BotonAccion icon={ChefHat} label="Enviar cocina" onClick={onEnviarCocina} disabled={!tieneLineas} />
      <BotonAccion icon={Percent} label="Descuento" onClick={onDescuento} variant="outline" disabled={!tieneLineas} />
      <BotonAccion icon={Split} label="Dividir" onClick={onDividir} variant="outline" disabled={!tieneLineas} />
      <BotonAccion
        icon={CreditCard}
        label={`Cobrar ${totales.total > 0 ? "· " + totales.total.toFixed(2) + "€" : ""}`}
        onClick={onCobrar}
        variant="primary"
        disabled={!tieneLineas}
      />
      <BotonAccion icon={Printer} label="Imprimir" onClick={onImprimir} variant="outline" disabled={!tieneLineas} />
      <BotonAccion icon={Receipt} label="Tickets hoy" onClick={onHistorial} variant="outline" />
      <div className="flex-1" />
      <BotonAccion icon={DoorOpen} label="Cerrar caja" onClick={onCerrarSesion} variant="destructive" />
    </div>
  );
}

function BotonAccion({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  disabled,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  onClick: () => void;
  variant?: "default" | "primary" | "outline" | "destructive";
  disabled?: boolean;
}) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      className="h-14 w-full justify-start px-3 text-xs font-semibold"
    >
      <Icon className="h-5 w-5" />
      <span className="truncate">{label}</span>
    </Button>
  );
}
