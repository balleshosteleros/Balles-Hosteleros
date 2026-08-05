"use client";

/**
 * MESA DE INCIDENCIAS (PRP-074 · F3).
 *
 * La ventana que aparece al terminar de escanear un albarán cuando el sistema ha
 * encontrado algo que no cuadra. Cada anomalía llega con su propuesta YA rellenada:
 * el usuario acepta con un clic o corrige.
 *
 * Reglas de la pantalla (Iván, 05-ago-2026):
 *  · Si el albarán está limpio, esta ventana NO aparece. No se añade fricción a lo
 *    que ya funciona.
 *  · "Aceptar todas las propuestas" resuelve de golpe el caso normal.
 *  · Las bloqueantes impiden confirmar; el resto deja seguir y guardar a medias.
 *  · Ignorar o dejar algo fuera EXIGE motivo escrito: nada se pierde en silencio.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileWarning,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  AccionIncidencia,
  SeveridadIncidencia,
} from "@/features/logistica/lib/albaranes/detectar-incidencias";
import type {
  DecisionIncidencia,
  IncidenciaPersistida,
} from "@/features/logistica/actions/incidencias-albaran-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidencias: IncidenciaPersistida[];
  /** Vínculos que el sistema resolvió solo (se muestran como "resuelto solo"). */
  vinculosAutomaticos?: Array<{ lineaId: string; productoId: string; motivo: string }>;
  proveedorNombre?: string | null;
  numeroAlbaran?: string | null;
  /** Se llama con todas las decisiones tomadas. */
  onResolver: (decisiones: DecisionIncidencia[]) => Promise<void>;
  /** Guardar el avance y seguir en otro momento. */
  onGuardarYSalir?: () => void;
}

/** Elección del usuario para una incidencia, aún sin enviar. */
interface Eleccion {
  accion: string;
  payload?: Record<string, unknown>;
  motivo: string;
}

const ORDEN: SeveridadIncidencia[] = ["bloqueante", "alta", "media"];

const ESTILO: Record<
  SeveridadIncidencia,
  { titulo: string; icono: typeof AlertTriangle; clase: string; badge: string }
> = {
  bloqueante: {
    titulo: "Hay que resolver antes de confirmar",
    icono: FileWarning,
    clase: "border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20",
    badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
  alta: {
    titulo: "Conviene revisarlo",
    icono: AlertTriangle,
    clase: "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  media: {
    titulo: "Propuestas listas — revisa y acepta",
    icono: Info,
    clase: "border-sky-200 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/20",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
};

export function MesaIncidenciasDialog({
  open,
  onOpenChange,
  incidencias,
  vinculosAutomaticos = [],
  proveedorNombre,
  numeroAlbaran,
  onResolver,
  onGuardarYSalir,
}: Props) {
  const [elecciones, setElecciones] = useState<Map<string, Eleccion>>(new Map());
  const [enviando, setEnviando] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);

  const abiertas = useMemo(
    () => incidencias.filter((i) => i.estado === "abierta"),
    [incidencias],
  );

  const porSeveridad = useMemo(() => {
    const grupos = new Map<SeveridadIncidencia, IncidenciaPersistida[]>();
    for (const sev of ORDEN) {
      const lista = abiertas.filter((i) => i.severidad === sev);
      if (lista.length > 0) grupos.set(sev, lista);
    }
    return grupos;
  }, [abiertas]);

  /** Una incidencia está lista si tiene acción elegida y, si la pide, motivo. */
  const estaLista = (inc: IncidenciaPersistida): boolean => {
    const el = elecciones.get(inc.id);
    if (!el) return false;
    const accion = inc.acciones.find((a) => a.clave === el.accion);
    if (accion?.pideMotivo && el.motivo.trim() === "") return false;
    return true;
  };

  const pendientes = abiertas.filter((i) => !estaLista(i));
  const bloqueantesPendientes = pendientes.filter((i) => i.severidad === "bloqueante");

  const elegir = (inc: IncidenciaPersistida, accion: AccionIncidencia) => {
    setElecciones((prev) => {
      const next = new Map(prev);
      next.set(inc.id, {
        accion: accion.clave,
        payload: accion.payload,
        motivo: prev.get(inc.id)?.motivo ?? "",
      });
      return next;
    });
    // Si la acción pide motivo, se abre el campo para escribirlo.
    setExpandida(accion.pideMotivo ? inc.id : null);
  };

  const escribirMotivo = (id: string, motivo: string) => {
    setElecciones((prev) => {
      const next = new Map(prev);
      const actual = next.get(id);
      if (actual) next.set(id, { ...actual, motivo });
      return next;
    });
  };

  /** Acepta de una vez todas las propuestas por defecto que no piden motivo. */
  const aceptarTodas = () => {
    setElecciones((prev) => {
      const next = new Map(prev);
      for (const inc of abiertas) {
        if (next.has(inc.id)) continue;
        const propuesta = inc.acciones.find((a) => a.propuesta && !a.pideMotivo);
        if (propuesta) {
          next.set(inc.id, {
            accion: propuesta.clave,
            payload: propuesta.payload,
            motivo: "",
          });
        }
      }
      return next;
    });
  };

  const conPropuestaAutomatica = abiertas.filter(
    (i) => !elecciones.has(i.id) && i.acciones.some((a) => a.propuesta && !a.pideMotivo),
  ).length;

  const enviar = async () => {
    setEnviando(true);
    try {
      const decisiones: DecisionIncidencia[] = [];
      for (const inc of abiertas) {
        const el = elecciones.get(inc.id);
        if (!el || !estaLista(inc)) continue;
        decisiones.push({
          incidenciaId: inc.id,
          accion: el.accion,
          payload: el.payload,
          motivo: el.motivo.trim() || undefined,
        });
      }
      await onResolver(decisiones);
    } finally {
      setEnviando(false);
    }
  };

  const total = abiertas.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {total === 1 ? "Hay 1 cosa que aclarar" : `Hay ${total} cosas que aclarar`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {[proveedorNombre, numeroAlbaran].filter(Boolean).join(" · ") || "Albarán escaneado"}
            {" — "}
            he revisado el documento y esto es lo que no me cuadra. Cada punto lleva mi propuesta:
            acéptala o corrígeme.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pb-2">
            {[...porSeveridad.entries()].map(([sev, lista]) => {
              const est = ESTILO[sev];
              const Icono = est.icono;
              return (
                <section key={sev} className="space-y-2">
                  <header className="flex items-center gap-2">
                    <Icono className="h-4 w-4 shrink-0" />
                    <h3 className="text-sm font-medium">{est.titulo}</h3>
                    <Badge variant="secondary" className={cn("text-xs", est.badge)}>
                      {lista.length}
                    </Badge>
                  </header>

                  <div className="space-y-2">
                    {lista.map((inc) => {
                      const el = elecciones.get(inc.id);
                      const accionElegida = inc.acciones.find((a) => a.clave === el?.accion);
                      const pideMotivo = accionElegida?.pideMotivo ?? false;
                      const lista_ = estaLista(inc);

                      return (
                        <article
                          key={inc.id}
                          className={cn(
                            "rounded-lg border p-3 transition-colors",
                            lista_
                              ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                              : est.clase,
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {lista_ && (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{inc.titulo}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {inc.explicacion}
                              </p>
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {inc.acciones.map((accion) => {
                              const activa = el?.accion === accion.clave;
                              return (
                                <Button
                                  key={accion.clave}
                                  type="button"
                                  size="sm"
                                  variant={
                                    activa ? "default" : accion.propuesta ? "secondary" : "outline"
                                  }
                                  className="h-7 text-xs"
                                  onClick={() => elegir(inc, accion)}
                                >
                                  {activa && <Check className="mr-1 h-3 w-3" />}
                                  {accion.etiqueta}
                                  {accion.propuesta && !activa && (
                                    <span className="ml-1 opacity-60">· propuesta</span>
                                  )}
                                </Button>
                              );
                            })}
                          </div>

                          {pideMotivo && (
                            <div className="mt-2">
                              <Textarea
                                value={el?.motivo ?? ""}
                                onChange={(e) => escribirMotivo(inc.id, e.target.value)}
                                placeholder="Explica por qué (queda registrado con tu nombre y la fecha)"
                                className="min-h-[60px] text-xs"
                                autoFocus={expandida === inc.id}
                              />
                              {(el?.motivo ?? "").trim() === "" && (
                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                  Hace falta un motivo para poder continuar.
                                </p>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {vinculosAutomaticos.length > 0 && (
              <>
                <Separator />
                <section className="space-y-1.5">
                  <header className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-medium">Resuelto solo</h3>
                    <Badge variant="secondary" className="text-xs">
                      {vinculosAutomaticos.length}
                    </Badge>
                  </header>
                  <ul className="space-y-0.5 pl-6 text-xs text-muted-foreground">
                    {vinculosAutomaticos.slice(0, 6).map((v) => (
                      <li key={v.lineaId}>· {v.motivo}</li>
                    ))}
                    {vinculosAutomaticos.length > 6 && (
                      <li className="opacity-70">
                        · y {vinculosAutomaticos.length - 6} más
                      </li>
                    )}
                  </ul>
                </section>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {pendientes.length === 0 ? (
              <span className="text-emerald-700 dark:text-emerald-400">
                Todo resuelto. Ya puedes continuar.
              </span>
            ) : bloqueantesPendientes.length > 0 ? (
              <>
                Faltan {bloqueantesPendientes.length} sin resolver que impiden confirmar
              </>
            ) : (
              <>Quedan {pendientes.length} por revisar</>
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            {onGuardarYSalir && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onGuardarYSalir}
                disabled={enviando}
              >
                Guardar y seguir luego
              </Button>
            )}
            {conPropuestaAutomatica > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={aceptarTodas}>
                Aceptar todas las propuestas ({conPropuestaAutomatica})
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={enviar}
              disabled={enviando || pendientes.length > 0}
            >
              {enviando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
