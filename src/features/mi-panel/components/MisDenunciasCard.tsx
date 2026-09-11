"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, MessageSquareWarning, VenetianMask } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  listMisDenuncias,
  type EstadoDenuncia,
  type MiDenuncia,
} from "@/features/mi-panel/actions/denuncias-actions";
import { CATEGORIA_LABEL, DENUNCIA_ESTADO_LABEL } from "./DenunciaModal";

const ESTADO_COLOR: Record<EstadoDenuncia, string> = {
  recibida: "bg-blue-100 text-blue-800 border-blue-300",
  en_investigacion: "bg-amber-100 text-amber-800 border-amber-300",
  informacion_solicitada: "bg-purple-100 text-purple-800 border-purple-300",
  resuelta: "bg-emerald-100 text-emerald-800 border-emerald-300",
  archivada: "bg-slate-100 text-slate-600 border-slate-300",
};

/**
 * Las quejas del empleado, las que puso a su nombre y también las anónimas:
 * de una anónima la empresa no ve quién la presentó, pero él sí la sigue desde
 * aquí, marcada como tal.
 */
export function MisDenunciasCard({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<MiDenuncia[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listMisDenuncias();
    setItems(res.ok ? res.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar, refreshKey]);

  return (
    <Card className="p-4 md:p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <MessageSquareWarning className="h-4 w-4" />
        </div>
        <h2 className="font-semibold">Mis quejas y denuncias</h2>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No has presentado ninguna queja.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((d) => (
            <div key={d.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.asunto}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs text-muted-foreground">
                      {CATEGORIA_LABEL[d.categoria]} ·{" "}
                      {format(parseISO(d.created_at), "d MMM yyyy", { locale: es })}
                    </p>
                    {d.modalidad === "anonima" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        <VenetianMask className="h-3 w-3" />
                        Anónima
                      </span>
                    )}
                  </div>
                </div>
                <Badge className={`shrink-0 text-xs ${ESTADO_COLOR[d.estado]}`}>
                  {DENUNCIA_ESTADO_LABEL[d.estado]}
                </Badge>
              </div>
              {d.respuesta && (
                <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  <strong className="text-foreground">Respuesta de RRHH:</strong>{" "}
                  {d.respuesta}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
