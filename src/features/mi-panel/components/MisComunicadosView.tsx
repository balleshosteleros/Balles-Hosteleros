"use client";

import { useEffect, useState } from "react";
import { Loader2, Inbox, Paperclip } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listarComunicadosVisibles,
  type ComunicadoVisible,
} from "@/features/mi-panel/actions/mi-panel-actions";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  tamanoLegible,
  urlAdjuntoComunicado,
} from "@/features/gerencia/data/comunicados-adjuntos";

const PRIORIDAD_COLOR: Record<string, string> = {
  alta: "bg-rose-100 text-rose-700 border-rose-200",
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  baja: "bg-slate-100 text-slate-700 border-slate-200",
};

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
                      {formatFechaHoraEnZona(c.createdAt, c.zonaHoraria, {
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
                {c.contenido && (
                  <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line">
                    {c.contenido}
                  </p>
                )}
                {c.adjuntos.length > 0 && (
                  <div className="mt-4 pt-3 border-t space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {c.adjuntos.length === 1 ? "Documento adjunto" : "Documentos adjuntos"}
                    </p>
                    {c.adjuntos.map((a) => (
                      <a
                        key={a.path}
                        href={urlAdjuntoComunicado(a.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{a.name}</span>
                        {a.size > 0 && (
                          <span className="ml-auto text-xs text-muted-foreground shrink-0">
                            {tamanoLegible(a.size)}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
