"use client";

import { useEffect, useState } from "react";
import { Loader2, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listarComunicadosVisibles,
  type ComunicadoVisible,
} from "@/features/mi-panel/actions/mi-panel-actions";

const PRIORIDAD_COLOR: Record<string, string> = {
  alta: "bg-rose-100 text-rose-700 border-rose-200",
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  baja: "bg-slate-100 text-slate-700 border-slate-200",
};

function formatFechaHora(s: string): string {
  try {
    return new Date(s).toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

export function MisComunicadosView() {
  const [items, setItems] = useState<ComunicadoVisible[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    listarComunicadosVisibles().then((res) => {
      if (cancel) return;
      setItems(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {loading ? (
        <Card className="p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground">
          <Inbox className="h-7 w-7 mb-2" />
          <p className="text-sm font-medium">Sin comunicados</p>
          <p className="text-xs mt-1">No hay anuncios publicados por el momento.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id}>
              <Card className="p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{c.titulo}</h3>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${PRIORIDAD_COLOR[c.prioridad] ?? PRIORIDAD_COLOR.normal}`}
                      >
                        {c.prioridad}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatFechaHora(c.createdAt)}
                    </p>
                  </div>
                </div>
                {c.contenido && (
                  <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line">
                    {c.contenido}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
