import { cn } from "@/lib/utils";
import type { Reserva } from "@/features/sala/data/reservas";

interface Props {
  reserva: Pick<Reserva, "externalOrigen" | "externalId">;
  className?: string;
}

const ORIGEN_LABEL: Record<string, { texto: string; color: string }> = {
  GOOGLE_RWG: { texto: "Reserve with Google", color: "bg-[#22c55e]/10 text-[#15803d] border-[#22c55e]/30" },
};

export function ReservaExternalBadge({ reserva, className }: Props) {
  const origen = reserva.externalOrigen ?? "";
  if (!origen) return null;
  const meta = ORIGEN_LABEL[origen];
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border",
        meta.color,
        className,
      )}
      title={reserva.externalId ? `Booking ID: ${reserva.externalId}` : undefined}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
      {meta.texto}
    </span>
  );
}
