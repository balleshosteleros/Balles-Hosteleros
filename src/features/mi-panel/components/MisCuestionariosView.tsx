"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useAuth } from "@/features/auth/contexts/auth-context";
import {
  type Cuestionario,
  type PreguntaCuestionario,
  type RespuestaEmpleadoCuestionario,
  getCuestionariosPorEmpresa,
  calcularPuntuacionMaxima,
  CATEGORIA_CUESTIONARIO_LABEL,
} from "@/features/rrhh/data/cuestionarios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardCheck, Clock, Award, ArrowLeft, CheckCircle2, XCircle,
  AlertCircle, Inbox, Trophy, GraduationCap, BookOpen, ListChecks,
} from "lucide-react";

const ICONO_CATEGORIA = {
  evaluacion: Award,
  formacion: GraduationCap,
  conocimiento: BookOpen,
  induccion: ListChecks,
} as const;

function ListadoMisCuestionarios({
  pendientes, completados, onAbrir,
}: {
  pendientes: { c: Cuestionario; intentosRealizados: number }[];
  completados: { c: Cuestionario; respuesta: RespuestaEmpleadoCuestionario }[];
  onAbrir: (c: Cuestionario) => void;
}) {
  if (pendientes.length === 0 && completados.length === 0) {
    return (
      <Card className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
        <Inbox className="h-8 w-8 mb-2" />
        <p className="text-sm font-medium">No tienes cuestionarios asignados</p>
        <p className="text-xs mt-1">
          Cuando RRHH o Gerencia te asignen una evaluación, aparecerá aquí.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {pendientes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />Pendientes
            <Badge variant="outline" className="ml-1">{pendientes.length}</Badge>
          </h2>
          <div className="space-y-3">
            {pendientes.map(({ c, intentosRealizados }) => {
              const Icon = ICONO_CATEGORIA[c.categoria];
              const intentosRestantes = c.intentosMax - intentosRealizados;
              return (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-foreground">{c.nombre}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {CATEGORIA_CUESTIONARIO_LABEL[c.categoria]}
                            </p>
                          </div>
                          <Button size="sm" onClick={() => onAbrir(c)}>
                            {intentosRealizados > 0 ? "Reintentar" : "Comenzar"}
                          </Button>
                        </div>
                        {c.descripcion && (
                          <p className="text-sm text-muted-foreground mt-2">{c.descripcion}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />{c.duracionMinutos} min
                          </span>
                          <span className="flex items-center gap-1">
                            <Award className="h-3 w-3" />Nota corte: {c.notaCorte}%
                          </span>
                          <span>Intentos: {intentosRestantes}/{c.intentosMax}</span>
                          {c.fechaCierre && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <AlertCircle className="h-3 w-3" />Cierra: {c.fechaCierre}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {completados.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4" />Completados
            <Badge variant="outline" className="ml-1">{completados.length}</Badge>
          </h2>
          <div className="space-y-3">
            {completados.map(({ c, respuesta }) => {
              const pct = respuesta.notaSobre > 0
                ? Math.round((respuesta.puntuacion / respuesta.notaSobre) * 100)
                : 0;
              return (
                <Card key={c.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground">{c.nombre}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Realizado el {respuesta.fecha} · {respuesta.duracionMin} min
                        </p>
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex-1 max-w-[200px]">
                            <Progress value={pct} className="h-2" />
                          </div>
                          <span className="text-sm font-semibold">{pct}%</span>
                        </div>
                      </div>
                      {respuesta.aprobado ? (
                        <Badge className="bg-emerald-500 text-white text-[11px] gap-1 shrink-0">
                          <CheckCircle2 className="h-3 w-3" />Aprobado
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500 text-white text-[11px] gap-1 shrink-0">
                          <XCircle className="h-3 w-3" />No aprobado
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function ResolverCuestionario({
  cuestionario, onBack,
}: {
  cuestionario: Cuestionario;
  onBack: () => void;
}) {
  const preguntasPlanas = useMemo(
    () => cuestionario.bloques.flatMap((b) => b.preguntas.map((p) => ({ ...p, bloque: b.titulo }))),
    [cuestionario],
  );
  const [respuestas, setRespuestas] = useState<Record<string, string | string[]>>({});
  const [resultado, setResultado] = useState<{
    puntos: number;
    sobre: number;
    aprobado: boolean;
  } | null>(null);

  const setUnica = (preguntaId: string, opcionId: string) => {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: opcionId }));
  };
  const setMultiple = (preguntaId: string, opcionId: string, checked: boolean) => {
    setRespuestas((prev) => {
      const actual = (prev[preguntaId] as string[]) ?? [];
      return {
        ...prev,
        [preguntaId]: checked ? [...actual, opcionId] : actual.filter((id) => id !== opcionId),
      };
    });
  };
  const setTexto = (preguntaId: string, valor: string) => {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
  };

  const enviar = () => {
    let puntos = 0;
    const sobre = calcularPuntuacionMaxima(cuestionario);
    preguntasPlanas.forEach((p) => {
      const r = respuestas[p.id];
      if (p.tipo === "unica" || p.tipo === "verdadero_falso") {
        const correctaId = p.opciones.find((o) => o.correcta)?.id;
        if (correctaId && r === correctaId) puntos += p.puntos;
      } else if (p.tipo === "multiple") {
        const correctas = p.opciones.filter((o) => o.correcta).map((o) => o.id).sort();
        const seleccionadas = ((r as string[]) ?? []).slice().sort();
        if (
          correctas.length === seleccionadas.length &&
          correctas.every((id, i) => id === seleccionadas[i])
        ) {
          puntos += p.puntos;
        }
      }
    });
    const pct = sobre > 0 ? (puntos / sobre) * 100 : 0;
    setResultado({ puntos, sobre, aprobado: pct >= cuestionario.notaCorte });
  };

  if (resultado) {
    const pct = resultado.sobre > 0 ? Math.round((resultado.puntos / resultado.sobre) * 100) : 0;
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{cuestionario.nombre}</h1>
        </div>
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            {resultado.aprobado ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                <h2 className="text-2xl font-bold">¡Has aprobado!</h2>
                {cuestionario.mensajeAprobado && (
                  <p className="text-muted-foreground">{cuestionario.mensajeAprobado}</p>
                )}
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                <h2 className="text-2xl font-bold">No has alcanzado la nota de corte</h2>
                {cuestionario.mensajeNoAprobado && (
                  <p className="text-muted-foreground">{cuestionario.mensajeNoAprobado}</p>
                )}
              </>
            )}
            <div className="pt-4 space-y-2 max-w-sm mx-auto">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tu puntuación</span>
                <span className="font-semibold">{resultado.puntos} / {resultado.sobre}</span>
              </div>
              <Progress value={pct} className="h-3" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{pct}%</span>
                <span>Nota corte: {cuestionario.notaCorte}%</span>
              </div>
            </div>
            <Button onClick={onBack} className="mt-4">Volver a mis cuestionarios</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{cuestionario.nombre}</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{cuestionario.duracionMinutos} min</span>
            <span className="flex items-center gap-1"><Award className="h-3 w-3" />Nota corte: {cuestionario.notaCorte}%</span>
          </div>
        </div>
      </div>

      {cuestionario.mensajeInicial && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 text-sm">{cuestionario.mensajeInicial}</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {cuestionario.bloques.map((bloque) => (
          <div key={bloque.id} className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{bloque.titulo}</h2>
            {bloque.descripcion && (
              <p className="text-xs text-muted-foreground">{bloque.descripcion}</p>
            )}
            {bloque.preguntas.map((p, i) => (
              <PreguntaItem
                key={p.id}
                index={i + 1}
                pregunta={p}
                valor={respuestas[p.id]}
                onUnica={(opId) => setUnica(p.id, opId)}
                onMultiple={(opId, checked) => setMultiple(p.id, opId, checked)}
                onTexto={(t) => setTexto(p.id, t)}
              />
            ))}
            <Separator />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={enviar} size="lg">Enviar respuestas</Button>
      </div>
    </div>
  );
}

function PreguntaItem({
  index, pregunta, valor, onUnica, onMultiple, onTexto,
}: {
  index: number;
  pregunta: PreguntaCuestionario;
  valor: string | string[] | undefined;
  onUnica: (opcionId: string) => void;
  onMultiple: (opcionId: string, checked: boolean) => void;
  onTexto: (valor: string) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-sm font-semibold text-muted-foreground">{index}.</span>
          <div className="flex-1">
            <p className="font-medium text-sm">
              {pregunta.titulo}
              {pregunta.obligatoria && <span className="text-red-500 ml-1">*</span>}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{pregunta.puntos} pts</p>
          </div>
        </div>

        <div className="pl-7 space-y-2">
          {(pregunta.tipo === "unica" || pregunta.tipo === "verdadero_falso") && (
            <RadioGroup value={(valor as string) ?? ""} onValueChange={onUnica}>
              {pregunta.opciones.map((op) => (
                <label
                  key={op.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm"
                >
                  <RadioGroupItem value={op.id} id={`${pregunta.id}-${op.id}`} />
                  <span>{op.texto}</span>
                </label>
              ))}
            </RadioGroup>
          )}

          {pregunta.tipo === "multiple" && (
            <div className="space-y-1">
              {pregunta.opciones.map((op) => {
                const checked = ((valor as string[]) ?? []).includes(op.id);
                return (
                  <label
                    key={op.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => onMultiple(op.id, !!v)}
                    />
                    <span>{op.texto}</span>
                  </label>
                );
              })}
            </div>
          )}

          {pregunta.tipo === "texto" && (
            <div className="space-y-1">
              <Label htmlFor={`txt-${pregunta.id}`} className="sr-only">Respuesta</Label>
              <Textarea
                id={`txt-${pregunta.id}`}
                value={(valor as string) ?? ""}
                onChange={(e) => onTexto(e.target.value)}
                rows={3}
                placeholder="Escribe tu respuesta..."
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MisCuestionariosView() {
  const { empresaActual } = useEmpresa();
  const { profile } = useAuth();
  const [activo, setActivo] = useState<Cuestionario | null>(null);

  const empleadoId = profile?.email ?? "";

  const { pendientes, completados } = useMemo(() => {
    const todos = getCuestionariosPorEmpresa(empresaActual.id).filter((c) => c.estado === "activo");
    const pend: { c: Cuestionario; intentosRealizados: number }[] = [];
    const comp: { c: Cuestionario; respuesta: RespuestaEmpleadoCuestionario }[] = [];
    todos.forEach((c) => {
      const misRespuestas = c.respuestas.filter((r) => r.empleadoId === empleadoId);
      const aprobada = misRespuestas.find((r) => r.aprobado);
      if (aprobada) {
        comp.push({ c, respuesta: aprobada });
      } else if (misRespuestas.length >= c.intentosMax) {
        const ultima = misRespuestas[misRespuestas.length - 1];
        comp.push({ c, respuesta: ultima });
      } else {
        pend.push({ c, intentosRealizados: misRespuestas.length });
      }
    });
    return { pendientes: pend, completados: comp };
  }, [empresaActual.id, empleadoId]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Mis cuestionarios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Evaluaciones y tests asignados por RRHH
        </p>
      </div>

      {activo ? (
        <ResolverCuestionario cuestionario={activo} onBack={() => setActivo(null)} />
      ) : (
        <ListadoMisCuestionarios pendientes={pendientes} completados={completados} onAbrir={setActivo} />
      )}
    </div>
  );
}
