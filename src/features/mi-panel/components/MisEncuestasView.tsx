"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  type Encuesta,
  type PreguntaEncuesta,
} from "@/features/rrhh/data/encuestas";
import {
  listEncuestasActivasEmpleado,
  submitRespuestaEncuesta,
} from "@/features/gerencia/actions/encuestas-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList, ArrowLeft, AlertCircle, Inbox, CheckCircle2, Star,
  EyeOff, Lock,
} from "lucide-react";

function ListadoMisEncuestas({
  pendientes, completadas, onAbrir,
}: {
  pendientes: Encuesta[];
  completadas: Encuesta[];
  onAbrir: (e: Encuesta) => void;
}) {
  if (pendientes.length === 0 && completadas.length === 0) {
    return (
      <Card className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
        <Inbox className="h-8 w-8 mb-2" />
        <p className="text-sm font-medium">No tienes encuestas asignadas</p>
        <p className="text-xs mt-1">
          Cuando RRHH o Gerencia te envíen una encuesta, aparecerá aquí.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {pendientes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />Pendientes
            <Badge variant="outline" className="ml-1">{pendientes.length}</Badge>
          </h2>
          <div className="space-y-3">
            {pendientes.map((e) => {
              const totalPreguntas = e.grupos.reduce((s, g) => s + g.preguntas.length, 0);
              return (
                <Card key={e.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-foreground">{e.nombre}</h3>
                            {e.anonima && (
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <EyeOff className="h-3 w-3" />Encuesta anónima
                              </p>
                            )}
                          </div>
                          <Button size="sm" onClick={() => onAbrir(e)}>Responder</Button>
                        </div>
                        {e.descripcion && (
                          <p className="text-sm text-muted-foreground mt-2">{e.descripcion}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <span>{totalPreguntas} preguntas</span>
                          {e.fechaCierre && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <AlertCircle className="h-3 w-3" />Cierra: {e.fechaCierre}
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

      {completadas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />Completadas
            <Badge variant="outline" className="ml-1">{completadas.length}</Badge>
          </h2>
          <div className="space-y-3">
            {completadas.map((e) => (
              <Card key={e.id} className="opacity-80">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground">{e.nombre}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <Lock className="h-3 w-3" />
                        Ya has respondido
                        {e.modificarRespuesta && <span className="text-primary">· Puedes modificar</span>}
                      </p>
                    </div>
                    <Badge className="bg-emerald-500 text-white text-[11px] gap-1">
                      <CheckCircle2 className="h-3 w-3" />Respondida
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ResponderEncuesta({
  encuesta, onBack, onSubmitted,
}: {
  encuesta: Encuesta;
  onBack: () => void;
  onSubmitted: () => void;
}) {
  // Si ya respondió y puede modificar, partimos de sus respuestas previas.
  const [respuestas, setRespuestas] = useState<Record<string, string | string[] | number>>(
    () => encuesta.respuestas[0]?.respuestas ?? {},
  );
  const [enviada, setEnviada] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    const res = await submitRespuestaEncuesta(encuesta.id, respuestas);
    setEnviando(false);
    if (res.ok) {
      setEnviada(true);
      onSubmitted();
    } else {
      toast.error(res.error ?? "No se pudo enviar la encuesta");
    }
  };

  const setUnica = (id: string, valor: string) => {
    setRespuestas((prev) => ({ ...prev, [id]: valor }));
  };
  const setMultiple = (id: string, opcion: string, checked: boolean) => {
    setRespuestas((prev) => {
      const actual = (prev[id] as string[]) ?? [];
      return {
        ...prev,
        [id]: checked ? [...actual, opcion] : actual.filter((x) => x !== opcion),
      };
    });
  };
  const setTexto = (id: string, valor: string) => {
    setRespuestas((prev) => ({ ...prev, [id]: valor }));
  };
  const setNumero = (id: string, valor: number) => {
    setRespuestas((prev) => ({ ...prev, [id]: valor }));
  };

  if (enviada) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{encuesta.nombre}</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold">¡Gracias por participar!</h2>
            {encuesta.mensajeFinal && (
              <p className="text-muted-foreground max-w-md mx-auto">{encuesta.mensajeFinal}</p>
            )}
            <Button onClick={onBack} className="mt-4">Volver a mis encuestas</Button>
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
          <h1 className="text-xl font-bold">{encuesta.nombre}</h1>
          {encuesta.anonima && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <EyeOff className="h-3 w-3" />Tus respuestas son anónimas
            </p>
          )}
        </div>
      </div>

      {encuesta.mensajeInicial && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 text-sm">{encuesta.mensajeInicial}</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {encuesta.grupos.map((grupo) => (
          <div key={grupo.id} className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{grupo.titulo}</h2>
            {grupo.descripcion && (
              <p className="text-xs text-muted-foreground">{grupo.descripcion}</p>
            )}
            {grupo.preguntas.map((p, i) => (
              <PreguntaItem
                key={p.id}
                index={i + 1}
                pregunta={p}
                valor={respuestas[p.id]}
                onUnica={(v) => setUnica(p.id, v)}
                onMultiple={(v, c) => setMultiple(p.id, v, c)}
                onTexto={(v) => setTexto(p.id, v)}
                onNumero={(v) => setNumero(p.id, v)}
              />
            ))}
            <Separator />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={enviar} size="lg" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar respuestas"}
        </Button>
      </div>
    </div>
  );
}

function PreguntaItem({
  index, pregunta, valor, onUnica, onMultiple, onTexto, onNumero,
}: {
  index: number;
  pregunta: PreguntaEncuesta;
  valor: string | string[] | number | undefined;
  onUnica: (v: string) => void;
  onMultiple: (v: string, c: boolean) => void;
  onTexto: (v: string) => void;
  onNumero: (v: number) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-sm font-semibold text-muted-foreground">{index}.</span>
          <p className="font-medium text-sm flex-1">
            {pregunta.titulo}
            {pregunta.obligatoria && <span className="text-red-500 ml-1">*</span>}
          </p>
        </div>

        <div className="pl-7 space-y-2">
          {pregunta.tipo === "unica" && (
            <RadioGroup value={(valor as string) ?? ""} onValueChange={onUnica}>
              {pregunta.opciones.map((op) => (
                <label key={op.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm">
                  <RadioGroupItem value={op.id} id={`${pregunta.id}-${op.id}`} />
                  <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: op.color }} />
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
                  <label key={op.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={checked} onCheckedChange={(v) => onMultiple(op.id, !!v)} />
                    <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: op.color }} />
                    <span>{op.texto}</span>
                  </label>
                );
              })}
            </div>
          )}

          {pregunta.tipo === "si_no" && (
            <RadioGroup value={(valor as string) ?? ""} onValueChange={onUnica}>
              <label className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm">
                <RadioGroupItem value="si" id={`${pregunta.id}-si`} />
                <span>Sí</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm">
                <RadioGroupItem value="no" id={`${pregunta.id}-no`} />
                <span>No</span>
              </label>
            </RadioGroup>
          )}

          {pregunta.tipo === "valoracion" && (
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onNumero(n)}
                  className={`h-10 w-10 rounded-md flex items-center justify-center transition-colors ${
                    (valor as number) >= n
                      ? "bg-amber-100 text-amber-600"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  aria-label={`Valoración ${n}`}
                >
                  <Star className={`h-5 w-5 ${(valor as number) >= n ? "fill-amber-400 stroke-amber-500" : ""}`} />
                </button>
              ))}
            </div>
          )}

          {pregunta.tipo === "escala" && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onNumero(n)}
                    className={`h-9 w-9 rounded-md font-medium text-sm transition-colors ${
                      valor === n
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                <span>Nada</span>
                <span>Mucho</span>
              </div>
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

export function MisEncuestasView() {
  const [activa, setActiva] = useState<Encuesta | null>(null);
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await listEncuestasActivasEmpleado();
    setEncuestas(res.ok ? res.data : []);
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const pendientes: Encuesta[] = [];
  const completadas: Encuesta[] = [];
  for (const e of encuestas) {
    const yaRespondi = e.respuestas.length > 0;
    if (yaRespondi && !e.modificarRespuesta) completadas.push(e);
    else pendientes.push(e);
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Mis encuestas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Encuestas de clima laboral, satisfacción y opinión
        </p>
      </div>

      {activa ? (
        <ResponderEncuesta
          encuesta={activa}
          onBack={() => setActiva(null)}
          onSubmitted={cargar}
        />
      ) : cargando ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Cargando…</Card>
      ) : (
        <ListadoMisEncuestas pendientes={pendientes} completadas={completadas} onAbrir={setActiva} />
      )}
    </div>
  );
}
