"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { getEnvioDetalle, type EnvioDetalle, type RespuestaDetalle } from "@/features/calidad/actions/envios-actions";
import { formatFechaAuditoria } from "@/features/calidad/lib/fecha-auditoria";
import { cn } from "@/lib/utils";

function nota(n: number | null): string {
  return n === null ? "—" : n.toFixed(2).replace(".", ",");
}

function colorNota(n: number | null): string {
  if (n === null) return "bg-muted text-muted-foreground";
  if (n >= 9) return "bg-emerald-100 text-emerald-700";
  if (n >= 7) return "bg-blue-100 text-blue-700";
  if (n >= 5) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export function AuditoriaRealizadaDetalle({ envioId }: { envioId: string }) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<EnvioDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [cerradas, setCerradas] = useState<Record<string, boolean>>({});

  const cargar = useCallback(() => {
    setLoading(true);
    getEnvioDetalle(envioId).then((d) => {
      setDetalle(d);
      setLoading(false);
    });
  }, [envioId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="px-4 md:px-6 py-16 text-center">
        <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
        <div className="text-sm text-muted-foreground">No se ha encontrado esta auditoría.</div>
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => router.push("/calidad/auditorias")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Auditorías realizadas
        </Button>
      </div>
    );
  }

  const totalPreguntas = detalle.secciones.reduce((a, s) => a + s.respuestas.length, 0);

  return (
    <div className="px-4 md:px-6 pt-2 pb-28 space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push("/calidad/auditorias")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Auditorías realizadas
          </Button>
          <div>
            <h2 className="text-lg font-semibold leading-tight">{detalle.plantilla_nombre}</h2>
            <p className="text-sm text-muted-foreground">
              Nº {detalle.numero_secuencial} · {formatFechaAuditoria(detalle.fecha)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">v{detalle.version}</Badge>
          {detalle.estado === "enviada" ? (
            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Enviada</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Borrador</Badge>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Ficha titulo="Nota final">
          <span className={cn("inline-flex rounded-md px-2 py-1 font-mono text-lg tabular-nums", colorNota(detalle.nota_final))}>
            {nota(detalle.nota_final)}
          </span>
        </Ficha>
        <Ficha titulo="Local">{detalle.local_nombre}</Ficha>
        <Ficha titulo="Auditor">{detalle.auditor_nombre}</Ficha>
        <Ficha titulo="Preguntas">
          <span className="tabular-nums">{totalPreguntas}</span>
          <span className="text-muted-foreground"> en {detalle.secciones.length} secciones</span>
        </Ficha>
      </div>

      {/* Secciones con las respuestas reales */}
      <div className="space-y-3">
        {detalle.secciones.map((s) => {
          const cerrada = cerradas[s.id] ?? false;
          return (
            <div key={s.id} className="bg-card rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => setCerradas((prev) => ({ ...prev, [s.id]: !cerrada }))}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="min-w-0">
                  <div className="font-medium">{s.titulo}</div>
                  {s.descripcion && <div className="text-xs text-muted-foreground truncate">{s.descripcion}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">{s.respuestas.length}</span>
                  <span className={cn("rounded-md px-2 py-0.5 font-mono text-sm tabular-nums", colorNota(s.nota))}>
                    {nota(s.nota)}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", cerrada && "-rotate-90")} />
                </div>
              </button>

              {!cerrada && (
                <div className="border-t divide-y">
                  {s.respuestas.map((r) => (
                    <FilaRespuesta key={r.pregunta_id} r={r} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ficha({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}

function FilaRespuesta({ r }: { r: RespuestaDetalle }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className="mt-0.5 w-7 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{r.numero_global}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm">{r.texto}</div>
        {r.valor_texto && (
          <div className="mt-1 rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground whitespace-pre-wrap">
            {r.valor_texto}
          </div>
        )}
        {r.valor_opciones && r.valor_opciones.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {r.valor_opciones.map((o) => (
              <Badge key={o} variant="outline" className="text-[10px]">{o}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0">
        {r.tipo === "escala" ? (
          <EscalaRespuesta r={r} />
        ) : r.valor_numero !== null ? (
          <span className="font-mono text-sm tabular-nums">{r.valor_numero}</span>
        ) : !r.valor_texto && (!r.valor_opciones || r.valor_opciones.length === 0) ? (
          <span className="text-xs text-muted-foreground">Sin responder</span>
        ) : null}
      </div>
    </div>
  );
}

function EscalaRespuesta({ r }: { r: RespuestaDetalle }) {
  const min = r.escala_min ?? 0;
  const max = r.escala_max ?? 5;
  const items = Array.from({ length: max - min + 1 }, (_, i) => i + min);

  if (r.valor_numero === null) {
    return <span className="text-xs text-muted-foreground">Sin responder</span>;
  }

  return (
    <div className="flex items-center gap-1" title={`${r.valor_numero} de ${max}`}>
      {items.map((n) => {
        const activo = n === r.valor_numero;
        return (
          <span
            key={n}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] tabular-nums",
              activo
                ? r.valor_numero! / max >= 0.8
                  ? "border-emerald-500 bg-emerald-100 text-emerald-700 font-semibold"
                  : r.valor_numero! / max >= 0.5
                    ? "border-amber-500 bg-amber-100 text-amber-700 font-semibold"
                    : "border-red-500 bg-red-100 text-red-700 font-semibold"
                : "text-muted-foreground/50",
            )}
          >
            {n}
          </span>
        );
      })}
    </div>
  );
}
