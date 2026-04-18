"use client";

import { useEffect, useState } from "react";
import { Clock, User, MessageSquare, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listHistorial } from "../actions/recetas-actions";
import type { HistorialEntry } from "../types";

interface Props {
  recetaId: string;
}

export function HistorialTab({ recetaId }: Props) {
  const [entries, setEntries] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await listHistorial(recetaId);
      if (res.ok) setEntries(res.data);
      setLoading(false);
    })();
  }, [recetaId]);

  if (loading) return <p className="text-sm text-muted-foreground p-4">Cargando historial...</p>;

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-4 text-center">
        Sin movimientos registrados todavía.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.id} className="flex gap-3 p-3 rounded-lg bg-muted/40">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {e.fase_anterior_nombre && (
                <>
                  <Badge variant="outline" className="text-[10px]">{e.fase_anterior_nombre}</Badge>
                  <span className="text-muted-foreground text-xs">→</span>
                </>
              )}
              <Badge className="text-[10px]">{e.fase_nueva_nombre ?? "—"}</Badge>
              {e.comunicado && (
                <Badge variant="outline" className="text-[10px] text-primary border-primary/40 gap-0.5">
                  <Send className="h-2.5 w-2.5" /> Comunicado
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                {e.usuario_nombre ?? "Sistema"}
              </span>
              <span>{new Date(e.created_at).toLocaleString("es-ES")}</span>
            </div>
            {e.nota && (
              <p className="text-xs text-foreground mt-1.5 flex items-start gap-1">
                <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground" />
                {e.nota}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
