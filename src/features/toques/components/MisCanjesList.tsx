"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Inbox } from "lucide-react";
import type { Canje } from "@/features/toques/types/toques.types";
import { CANJE_ESTADO_COLOR, CANJE_ESTADO_LABEL } from "@/features/toques/types/toques.types";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";

interface Props {
  canjes: Canje[];
  /** Zona horaria (IANA) de la empresa activa para formatear las fechas. */
  zonaHoraria: string;
}

const FMT_OPTS: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };

/** Instante (timestamp con hora): se muestra en la zona de la empresa. */
function formatInstante(s: string | null, tz: string): string {
  if (!s) return "—";
  return formatFechaEnZona(s, tz, FMT_OPTS) || s;
}

/** Día de calendario (fecha de disfrute elegida): se muestra tal cual, sin desplazar por zona. */
function formatDia(s: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s.includes("T") ? s : `${s}T12:00:00Z`);
    return d.toLocaleDateString("es-ES", FMT_OPTS);
  } catch {
    return s;
  }
}

export function MisCanjesList({ canjes, zonaHoraria }: Props) {
  return (
    <Card className="p-4 md:p-5">
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        <ShoppingBag className="h-4 w-4 text-amber-500" />
        Mis canjes
      </h2>
      {canjes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-28 text-muted-foreground text-sm">
          <Inbox className="h-6 w-6 mb-1.5" />
          Aún no has canjeado ningún toque.
        </div>
      ) : (
        <ul className="divide-y">
          {canjes.map((c) => (
            <li key={c.id} className="py-2.5 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.recompensaNombre || c.recompensaId}</div>
                <div className="text-xs text-muted-foreground">
                  Solicitado {formatInstante(c.solicitadoAt, zonaHoraria)}
                  {c.fechaDisfrute ? ` · Disfrute ${formatDia(c.fechaDisfrute)}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-amber-600 font-bold tabular-nums text-sm">
                  −{c.costeToques}
                </div>
                <Badge variant="outline" className={`text-[10px] mt-0.5 ${CANJE_ESTADO_COLOR[c.estado]}`}>
                  {CANJE_ESTADO_LABEL[c.estado]}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
