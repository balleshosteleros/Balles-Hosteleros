"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Hourglass,
  CheckCircle2,
  CircleAlert,
  Circle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getPeriodoPrueba,
  evaluarHitoPrueba,
  decidirPeriodoPrueba,
  type PeriodoPruebaVista,
} from "@/features/rrhh/actions/periodo-prueba-actions";
import {
  ETIQUETA_DECISION,
  formatearNota,
  type EvaluacionPrueba,
} from "@/features/rrhh/data/periodo-prueba";

interface Props {
  empleadoId: string | null;
  candidatoId: string | null;
  nombre: string;
}

function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Un hito vencido y sin evaluar es lo que RRHH tiene que ver primero. */
function estadoHito(ev: EvaluacionPrueba): "completada" | "vencida" | "pendiente" {
  if (ev.estado === "completada") return "completada";
  return ev.fechaPrevista <= hoyIso() ? "vencida" : "pendiente";
}

export function PeriodoPruebaPanel({ empleadoId, candidatoId, nombre }: Props) {
  const [vista, setVista] = useState<PeriodoPruebaVista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void getPeriodoPrueba({ empleadoId, candidatoId }).then((r) => {
      if (!vivo) return;
      setVista(r.data);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [empleadoId, candidatoId]);

  if (cargando) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  if (!vista) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <Hourglass className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Sin periodo de prueba. Se abre solo al pasar al trabajador a la fase «Prueba».
        </p>
      </div>
    );
  }

  const { periodo, progreso, resumen } = vista;
  const cerrado = periodo.decision !== "pendiente";

  const guardarHito = async (ev: EvaluacionPrueba) => {
    const bruto = (notas[ev.id] ?? "").replace(",", ".").trim();
    const nota = Number(bruto);
    if (bruto === "" || !Number.isFinite(nota) || nota < 0 || nota > 10) {
      toast.error("La nota debe estar entre 0 y 10");
      return;
    }
    setGuardando(ev.id);
    try {
      const res = await evaluarHitoPrueba({
        evaluacionId: ev.id,
        nota,
        comentario: comentarios[ev.id],
      });
      if (res.ok) {
        setVista(res.periodo);
        toast.success(`Validación ${ev.numero} guardada`);
      } else {
        toast.error(res.error);
      }
    } finally {
      setGuardando(null);
    }
  };

  const decidir = async (decision: "continua" | "no_continua") => {
    setGuardando("decision");
    try {
      const res = await decidirPeriodoPrueba({
        periodoId: periodo.id,
        decision,
        motivo,
      });
      if (res.ok) {
        setVista(res.periodo);
        toast.success(
          decision === "continua"
            ? "Periodo superado: continúa en la empresa"
            : "Registrado: no continúa",
        );
      } else {
        toast.error(res.error);
      }
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* ─── Cabecera: cuánto le queda ─── */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Hourglass className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-foreground">
                Periodo de prueba
              </span>
              {cerrado && (
                <Badge
                  variant={periodo.decision === "continua" ? "default" : "destructive"}
                  className="text-[11px]"
                >
                  {ETIQUETA_DECISION[periodo.decision]}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Del {fechaCorta(periodo.fechaInicio)} al {fechaCorta(periodo.fechaFin)} ·{" "}
              {periodo.duracionDias} días
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {progreso.diasTranscurridos}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / {progreso.duracionDias}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {cerrado
                ? "Periodo cerrado"
                : progreso.vencido
                  ? "Periodo vencido: falta decidir"
                  : `Quedan ${progreso.diasRestantes} ${progreso.diasRestantes === 1 ? "día" : "días"}`}
            </p>
          </div>
        </div>
        <Progress value={progreso.progresoPct} className="h-2" />
      </div>

      {/* ─── Validaciones ─── */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h4 className="text-sm font-semibold text-foreground">
            Validaciones ({resumen.evaluacionesCompletadas} de {resumen.evaluacionesTotales})
          </h4>
          <span className="text-xs text-muted-foreground">
            Nota media:{" "}
            <strong className="text-foreground tabular-nums">
              {formatearNota(resumen.notaFinal)}
            </strong>
          </span>
        </div>

        {periodo.evaluaciones.map((ev) => {
          const est = estadoHito(ev);
          const Icono =
            est === "completada" ? CheckCircle2 : est === "vencida" ? CircleAlert : Circle;
          return (
            <div
              key={ev.id}
              className={cn(
                "rounded-lg border p-3 space-y-2",
                est === "vencida" ? "border-amber-300 bg-amber-50/40" : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icono
                    className={cn(
                      "h-4 w-4 shrink-0",
                      est === "completada"
                        ? "text-emerald-600"
                        : est === "vencida"
                          ? "text-amber-600"
                          : "text-muted-foreground",
                    )}
                  />
                  <span className="text-sm font-medium text-foreground">
                    Validación {ev.numero}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {fechaCorta(ev.fechaPrevista)}
                    {est === "vencida" && " · pendiente"}
                  </span>
                </div>
                {ev.estado === "completada" && (
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {formatearNota(ev.nota)}
                  </span>
                )}
              </div>

              {ev.estado === "completada" ? (
                ev.comentario && (
                  <p className="text-xs text-muted-foreground pl-6">{ev.comentario}</p>
                )
              ) : cerrado ? (
                <p className="text-xs text-muted-foreground pl-6">Sin evaluar</p>
              ) : (
                <div className="pl-6 space-y-2">
                  <div className="flex items-end gap-2">
                    <div className="space-y-1">
                      <Label
                        htmlFor={`nota-${ev.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        Nota (0–10)
                      </Label>
                      <Input
                        id={`nota-${ev.id}`}
                        inputMode="decimal"
                        placeholder="0,0"
                        className="w-24 h-9"
                        value={notas[ev.id] ?? ""}
                        onChange={(e) =>
                          setNotas((n) => ({ ...n, [ev.id]: e.target.value }))
                        }
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-9"
                      disabled={guardando === ev.id}
                      onClick={() => void guardarHito(ev)}
                    >
                      {guardando === ev.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando…
                        </>
                      ) : (
                        "Guardar"
                      )}
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Comentario (opcional)"
                    className="text-xs"
                    value={comentarios[ev.id] ?? ""}
                    onChange={(e) =>
                      setComentarios((c) => ({ ...c, [ev.id]: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Decisión ─── */}
      {!cerrado && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">
              Decisión sobre {nombre}
            </h4>
            {resumen.recomendacion === "sin_datos" ? (
              <p className="text-xs text-muted-foreground">
                Sin validaciones completadas todavía. Evalúa al menos una antes de decidir.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Recomendación:{" "}
                <strong
                  className={
                    resumen.recomendacion === "apto"
                      ? "text-emerald-600"
                      : "text-destructive"
                  }
                >
                  {resumen.recomendacion === "apto" ? "Apto" : "No apto"}
                </strong>{" "}
                · nota {formatearNota(resumen.notaFinal)} sobre un corte de{" "}
                {formatearNota(resumen.notaCorte)}
                {resumen.incompleto && " · faltan validaciones por completar"}
              </p>
            )}
          </div>

          <Textarea
            rows={2}
            placeholder="Motivo de la decisión (opcional)"
            className="text-xs"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={guardando === "decision"}
              onClick={() => void decidir("continua")}
            >
              <ThumbsUp className="h-4 w-4" /> Continúa
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              disabled={guardando === "decision"}
              onClick={() => void decidir("no_continua")}
            >
              <ThumbsDown className="h-4 w-4" /> No continúa
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            La decisión la tomas tú: el sistema solo calcula la nota y recomienda.
          </p>
        </div>
      )}

      {cerrado && periodo.decisionMotivo && (
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Motivo:</strong> {periodo.decisionMotivo}
          </p>
        </div>
      )}
    </div>
  );
}
