"use client";

import { useEffect, useState } from "react";
import { HardDrive, Loader2, Video, GraduationCap, Megaphone, PlayCircle, FileBox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

interface DesgloseItem {
  tipo: string;
  label: string;
  bytes: number;
  count: number;
}

interface QuotaResponse {
  bytes_used: number;
  bytes_limit: number;
  desglose: DesgloseItem[];
}

const GB = 1024 ** 3;

// Formato es-ES: coma decimal. GB con 2 decimales; MB si es < 1 GB.
function formatTamano(bytes: number): string {
  if (bytes >= GB) {
    return `${(bytes / GB).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`;
  }
  const mb = bytes / 1024 ** 2;
  return `${mb.toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

const ICONO_TIPO: Record<string, typeof Video> = {
  grabacion: Video,
  formacion: GraduationCap,
  marketing: Megaphone,
  onboarding: PlayCircle,
};

/**
 * Bloque de almacenamiento dentro de la pestaña Empresa (debajo de Locales).
 * Muestra el consumo de la empresa activa: barra 0-100, total/consumido,
 * desglose por tipo y un botón para ampliar el plan.
 */
export function AlmacenamientoEmpresa() {
  const { empresaActual } = useEmpresa();
  const [data, setData] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/recordings/quota")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [empresaActual?.id]);

  const used = data?.bytes_used ?? 0;
  const limit = data?.bytes_limit ?? 500 * GB;
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const usedGb = used / GB;
  const limitGb = limit / GB;
  const restanteGb = Math.max(0, limitGb - usedGb);
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-primary";

  return (
    <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold leading-none">Almacenamiento</h3>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-1.5 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() =>
            toast.info("Para ampliar tu plan de almacenamiento, contacta con soporte.", {
              description: "Pronto podrás ampliarlo desde aquí.",
            })
          }
        >
          <Plus className="h-4 w-4" /> Contratar más memoria
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Calculando…
        </div>
      ) : (
        <>
          {/* Barra 0-100 con total y consumido */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-semibold">
                {usedGb.toLocaleString("es-ES", { maximumFractionDigits: 2 })} GB usados
              </span>
              <span className="text-sm text-muted-foreground">
                de {limitGb.toLocaleString("es-ES", { maximumFractionDigits: 0 })} GB
              </span>
            </div>

            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{pct.toLocaleString("es-ES", { maximumFractionDigits: 0 })}% usado</span>
              <span>{restanteGb.toLocaleString("es-ES", { maximumFractionDigits: 2 })} GB disponibles</span>
            </div>

            {pct >= 90 && (
              <p className="text-sm text-red-600">
                Estás cerca del límite. Borra vídeos antiguos o amplía tu plan para seguir subiendo.
              </p>
            )}
          </div>

          {/* Desglose por tipo (solo si hay algo) */}
          {data && data.desglose.length > 0 && (
            <ul className="divide-y border-t pt-1">
              {data.desglose
                .slice()
                .sort((a, b) => b.bytes - a.bytes)
                .map((item) => {
                  const Icono = ICONO_TIPO[item.tipo] ?? FileBox;
                  return (
                    <li key={item.tipo} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <Icono className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{item.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.count.toLocaleString("es-ES")} {item.count === 1 ? "archivo" : "archivos"}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-medium tabular-nums">{formatTamano(item.bytes)}</span>
                    </li>
                  );
                })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
