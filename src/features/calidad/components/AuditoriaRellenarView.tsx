"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ClipboardCheck, ChevronDown, Star, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getEnvioDetalle,
  guardarRespuestas,
  dejarAuditoriaPendiente,
  cerrarAuditoria,
  type EnvioDetalle,
  type RespuestaDetalle,
} from "@/features/calidad/actions/envios-actions";
import { formatFechaAuditoria } from "@/features/calidad/lib/fecha-auditoria";
import { ESCALA_MAX, calcularNota } from "@/features/calidad/lib/nota-auditoria";
import { cn } from "@/lib/utils";

/** Lo contestado en pantalla, antes de guardarse. */
interface ValorRespuesta {
  valorNumero: number | null;
  valorTexto: string | null;
  valorOpciones: string[] | null;
}

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

function estaRespondida(v: ValorRespuesta | undefined): boolean {
  if (!v) return false;
  return v.valorNumero !== null || !!v.valorTexto || (!!v.valorOpciones && v.valorOpciones.length > 0);
}

export function AuditoriaRellenarView({ envioId }: { envioId: string }) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<EnvioDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [valores, setValores] = useState<Record<string, ValorRespuesta>>({});
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [cerradas, setCerradas] = useState<Record<string, boolean>>({});
  const [avisoPendienteOpen, setAvisoPendienteOpen] = useState(false);

  useEffect(() => {
    getEnvioDetalle(envioId).then((d) => {
      setDetalle(d);
      // Se arranca con lo que ya hubiera guardado, para poder retomar el borrador.
      if (d) {
        const iniciales: Record<string, ValorRespuesta> = {};
        for (const s of d.secciones) {
          for (const r of s.respuestas) {
            iniciales[r.pregunta_id] = {
              valorNumero: r.valor_numero,
              valorTexto: r.valor_texto,
              valorOpciones: r.valor_opciones,
            };
          }
        }
        setValores(iniciales);
      }
      setLoading(false);
    });
  }, [envioId]);

  const setValor = useCallback((preguntaId: string, patch: Partial<ValorRespuesta>) => {
    setValores((prev) => {
      const actual = prev[preguntaId] ?? { valorNumero: null, valorTexto: null, valorOpciones: null };
      return { ...prev, [preguntaId]: { ...actual, ...patch } };
    });
  }, []);

  const todas = useMemo(
    () => (detalle?.secciones ?? []).flatMap((s) => s.respuestas),
    [detalle],
  );
  const respondidas = todas.filter((r) => estaRespondida(valores[r.pregunta_id])).length;
  // TODAS las preguntas son obligatorias: una auditoría no se cierra a medias.
  const faltan = todas.length - respondidas;

  // Nota provisional con lo contestado hasta ahora, con el mismo criterio que
  // usa el servidor al cerrar: escala normalizada a 0..10 y ponderada por peso.
  const notaProvisional = useMemo(
    () =>
      calcularNota(
        todas.map((r) => ({
          tipo: r.tipo,
          escala_max: r.escala_max,
          peso: r.peso,
          valor_numero: valores[r.pregunta_id]?.valorNumero ?? null,
        })),
      ),
    [todas, valores],
  );

  const payload = useCallback(
    () =>
      Object.entries(valores).map(([preguntaId, v]) => ({
        preguntaId,
        valorNumero: v.valorNumero,
        valorTexto: v.valorTexto,
        valorOpciones: v.valorOpciones,
      })),
    [valores],
  );

  /**
   * Guardar a medias deja la auditoría PENDIENTE. Como no cuenta para nada
   * hasta terminarse, se avisa antes en vez de guardar en silencio.
   */
  async function handleGuardar() {
    if (faltan > 0) {
      setAvisoPendienteOpen(true);
      return;
    }
    setGuardando(true);
    const res = await guardarRespuestas(envioId, payload());
    setGuardando(false);
    if (res.ok) toast.success("Guardado");
    else toast.error(res.error);
  }

  async function confirmarDejarPendiente() {
    setAvisoPendienteOpen(false);
    setGuardando(true);
    const res = await dejarAuditoriaPendiente(envioId, payload());
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Guardada como pendiente. Te hemos avisado para que la termines");
    router.push("/calidad/auditorias");
  }

  async function handleCerrar() {
    setCerrando(true);
    // Siempre se guarda antes de cerrar: la nota se calcula en el servidor con
    // lo que hay en la base de datos, no con lo que hay en pantalla.
    const guardado = await guardarRespuestas(envioId, payload());
    if (!guardado.ok) {
      setCerrando(false);
      toast.error(guardado.error);
      return;
    }
    const res = await cerrarAuditoria(envioId);
    setCerrando(false);
    if (res.ok) {
      toast.success("Auditoría cerrada");
      router.push(`/calidad/auditorias/${envioId}`);
    } else {
      toast.error(res.error);
    }
  }

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

  // Una auditoría cerrada no se rellena: se ve.
  if (detalle.estado === "enviada") {
    router.replace(`/calidad/auditorias/${envioId}`);
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 pt-2 pb-28 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push("/calidad/auditorias")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Auditorías realizadas
          </Button>
          <div>
            <h2 className="text-lg font-semibold leading-tight">{detalle.plantilla_nombre}</h2>
            <p className="text-sm text-muted-foreground">
              Nº {detalle.numero_secuencial} · {formatFechaAuditoria(detalle.fecha)} · {detalle.local_nombre}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">v{detalle.version}</Badge>
          <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente</Badge>
        </div>
      </div>

      {/* Mientras esté sin terminar no cuenta para nada: hay que decirlo claro. */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Auditoría pendiente. <strong>No cuenta para estadísticas ni notas</strong> hasta que se
          conteste entera y se cierre.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Ficha titulo="Nota provisional">
          <span className={cn("inline-flex rounded-md px-2 py-1 font-mono text-lg tabular-nums", colorNota(notaProvisional))}>
            {nota(notaProvisional)}
          </span>
        </Ficha>
        <Ficha titulo="Contestadas">
          <span className="tabular-nums">{respondidas}</span>
          <span className="text-muted-foreground"> de {todas.length}</span>
        </Ficha>
        <Ficha titulo="Sin contestar">
          <span className={cn("tabular-nums", faltan > 0 && "text-red-600 font-semibold")}>{faltan}</span>
        </Ficha>
        <Ficha titulo="Auditor">{detalle.auditor_nombre}</Ficha>
      </div>

      <div className="space-y-3">
        {detalle.secciones.map((s) => {
          const cerrada = cerradas[s.id] ?? false;
          const contestadasSeccion = s.respuestas.filter((r) => estaRespondida(valores[r.pregunta_id])).length;
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
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      contestadasSeccion < s.respuestas.length
                        ? "text-red-600 font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {contestadasSeccion}/{s.respuestas.length}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", cerrada && "-rotate-90")} />
                </div>
              </button>

              {!cerrada && (
                <div className="border-t divide-y">
                  {s.respuestas.map((r) => (
                    <FilaPregunta
                      key={r.pregunta_id}
                      r={r}
                      valor={valores[r.pregunta_id]}
                      onChange={(patch) => setValor(r.pregunta_id, patch)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={handleGuardar} disabled={guardando || cerrando}>
          {guardando ? "Guardando…" : faltan > 0 ? "Dejar pendiente" : "Guardar"}
        </Button>
        <Button onClick={handleCerrar} disabled={guardando || cerrando || faltan > 0}>
          {cerrando ? "Cerrando…" : "Cerrar auditoría"}
        </Button>
      </div>
      {faltan > 0 && (
        <p className="text-right text-xs text-muted-foreground">
          {faltan === 1
            ? "Falta 1 pregunta por contestar. Hay que contestarlas todas para cerrar."
            : `Faltan ${faltan} preguntas por contestar. Hay que contestarlas todas para cerrar.`}
        </p>
      )}

      <Dialog open={avisoPendienteOpen} onOpenChange={setAvisoPendienteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>La auditoría se queda pendiente</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1 text-sm">
                <p>
                  {faltan === 1
                    ? "Queda 1 pregunta sin contestar."
                    : `Quedan ${faltan} preguntas sin contestar.`}{" "}
                  Puedes dejarla así y terminarla en otro momento.
                </p>
                <p>
                  Mientras esté sin terminar <strong>no cuenta para estadísticas, ni para la nota,
                  ni para nada</strong>. Te llegará un aviso para que no se te olvide.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvisoPendienteOpen(false)}>
              Seguir rellenando
            </Button>
            <Button onClick={confirmarDejarPendiente} disabled={guardando}>
              {guardando ? "Guardando…" : "Dejarla pendiente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function FilaPregunta({
  r,
  valor,
  onChange,
}: {
  r: RespuestaDetalle;
  valor: ValorRespuesta | undefined;
  onChange: (patch: Partial<ValorRespuesta>) => void;
}) {
  // Todas son obligatorias, así que lo que se señala es lo que FALTA.
  const pendiente = !estaRespondida(valor);
  return (
    <div className={cn("px-4 py-3", pendiente && "bg-red-50/50 dark:bg-red-950/10")}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-7 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {r.numero_global}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm">{r.texto}</div>
            {pendiente && (
              <span className="shrink-0 text-[10px] font-medium text-red-600">Sin contestar</span>
            )}
          </div>
          <ControlRespuesta r={r} valor={valor} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

function ControlRespuesta({
  r,
  valor,
  onChange,
}: {
  r: RespuestaDetalle;
  valor: ValorRespuesta | undefined;
  onChange: (patch: Partial<ValorRespuesta>) => void;
}) {
  const opciones = (r.opciones ?? []) as string[];

  switch (r.tipo) {
    case "escala": {
      // Estrellas 1..5, como las de Google: la peor valoración es 1 estrella,
      // no existe el 0. Se pinta hasta la estrella pulsada.
      const max = r.escala_max ?? ESCALA_MAX;
      const marcadas = valor?.valorNumero ?? 0;
      return (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1">
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
              const encendida = n <= marcadas;
              return (
                <button
                  key={n}
                  type="button"
                  // Volver a pulsar la estrella marcada borra la respuesta.
                  onClick={() => onChange({ valorNumero: marcadas === n ? null : n })}
                  title={`${n} de ${max}`}
                  aria-label={`${n} de ${max}`}
                  className="p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      "h-6 w-6",
                      encendida ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
                    )}
                  />
                </button>
              );
            })}
            {marcadas > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {marcadas} de {max}
              </span>
            )}
          </div>
          {(r.etiqueta_min || r.etiqueta_max) && (
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{r.etiqueta_min}</span>
              <span>{r.etiqueta_max}</span>
            </div>
          )}
        </div>
      );
    }

    case "si_no":
      return (
        <div className="flex gap-2">
          {[
            { label: "Sí", v: 1 },
            { label: "No", v: 0 },
          ].map((o) => {
            const activo = valor?.valorNumero === o.v;
            return (
              <Button
                key={o.label}
                type="button"
                size="sm"
                variant={activo ? "default" : "outline"}
                onClick={() => onChange({ valorNumero: activo ? null : o.v })}
              >
                {o.label}
              </Button>
            );
          })}
        </div>
      );

    case "opcion_unica":
      return (
        <div className="flex flex-wrap gap-2">
          {opciones.map((o) => {
            const activo = valor?.valorOpciones?.[0] === o;
            return (
              <Button
                key={o}
                type="button"
                size="sm"
                variant={activo ? "default" : "outline"}
                onClick={() => onChange({ valorOpciones: activo ? null : [o] })}
              >
                {o}
              </Button>
            );
          })}
        </div>
      );

    case "opcion_multiple":
      return (
        <div className="flex flex-wrap gap-2">
          {opciones.map((o) => {
            const actuales = valor?.valorOpciones ?? [];
            const activo = actuales.includes(o);
            return (
              <Button
                key={o}
                type="button"
                size="sm"
                variant={activo ? "default" : "outline"}
                onClick={() =>
                  onChange({
                    valorOpciones: activo ? actuales.filter((x) => x !== o) : [...actuales, o],
                  })
                }
              >
                {o}
              </Button>
            );
          })}
        </div>
      );

    case "texto_largo":
    case "observaciones":
      return (
        <Textarea
          value={valor?.valorTexto ?? ""}
          onChange={(e) => onChange({ valorTexto: e.target.value || null })}
          placeholder="Escribe aquí…"
          rows={3}
        />
      );

    default:
      return (
        <Input
          value={valor?.valorTexto ?? ""}
          onChange={(e) => onChange({ valorTexto: e.target.value || null })}
        />
      );
  }
}
