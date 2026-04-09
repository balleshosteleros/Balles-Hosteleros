import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { getRutasPorEmpresa, type RutaFormativa, type ModuloFormativo, type PreguntaEvaluacion } from "@/data/formacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  GraduationCap, Play, CheckCircle2, Lock, ChevronRight, ArrowLeft,
  BookOpen, Award, Video, AlertTriangle,
} from "lucide-react";

type Vista = "puestos" | "ruta" | "video" | "evaluacion" | "resultado";

export default function PortalFormativo() {
  const { empresaId } = useParams<{ empresaId: string }>();
  const rutas = useMemo(() => getRutasPorEmpresa(empresaId || "habana"), [empresaId]);

  const [vista, setVista] = useState<Vista>("puestos");
  const [rutaSeleccionada, setRutaSeleccionada] = useState<RutaFormativa | null>(null);
  const [moduloActual, setModuloActual] = useState(0);
  const [videoActual, setVideoActual] = useState(0);
  const [modulosCompletados, setModulosCompletados] = useState<Set<number>>(new Set());
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [notaResultado, setNotaResultado] = useState<number | null>(null);
  const [aprobado, setAprobado] = useState(false);

  const modulo = rutaSeleccionada?.modulos[moduloActual];

  function seleccionarPuesto(ruta: RutaFormativa) {
    setRutaSeleccionada(ruta);
    setModuloActual(0);
    setVideoActual(0);
    setModulosCompletados(new Set());
    setVista("ruta");
  }

  function abrirModulo(idx: number) {
    if (idx > 0 && !modulosCompletados.has(idx - 1)) return;
    setModuloActual(idx);
    setVideoActual(0);
    setVista("video");
  }

  function siguienteVideo() {
    if (!modulo) return;
    if (videoActual < modulo.videos.length - 1) {
      setVideoActual(videoActual + 1);
    } else {
      setRespuestas({});
      setNotaResultado(null);
      setVista("evaluacion");
    }
  }

  function enviarEvaluacion() {
    if (!modulo) return;
    const preguntas = modulo.evaluacion.preguntas;
    let correctas = 0;
    preguntas.forEach((p) => {
      if (respuestas[p.id] === p.respuestaCorrecta) correctas++;
    });
    const nota = Math.round((correctas / preguntas.length) * 100);
    const pass = nota >= modulo.evaluacion.notaMinima;
    setNotaResultado(nota);
    setAprobado(pass);
    if (pass) {
      setModulosCompletados((prev) => new Set(prev).add(moduloActual));
    }
    setVista("resultado");
  }

  function volverARuta() {
    setVista("ruta");
  }

  // ─── Vista: Selección de puesto ───────────────────────────────
  if (vista === "puestos") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <GraduationCap className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Portal Formativo</h1>
              <p className="text-xs text-muted-foreground">Selecciona tu puesto para comenzar el itinerario formativo</p>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Elige tu puesto</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rutas.map((ruta) => {
              const totalVideos = ruta.modulos.reduce((s, m) => s + m.videos.length, 0);
              return (
                <Card key={ruta.id} className="border bg-card cursor-pointer hover:border-primary/50 transition-colors" onClick={() => seleccionarPuesto(ruta)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-foreground">{ruta.puestoNombre}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{ruta.modulos.length} módulos</span>
                      <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5" />{totalVideos} vídeos</span>
                    </div>
                    <Button size="sm" className="w-full gap-2 mt-2">
                      Comenzar <ChevronRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  if (!rutaSeleccionada || !modulo) return null;

  // ─── Vista: Ruta (módulos) ────────────────────────────────────
  if (vista === "ruta") {
    const totalModulos = rutaSeleccionada.modulos.length;
    const completadosCount = modulosCompletados.size;
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setVista("puestos")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{rutaSeleccionada.puestoNombre}</h1>
              <p className="text-xs text-muted-foreground">Itinerario formativo — {completadosCount}/{totalModulos} módulos completados</p>
            </div>
            <Progress value={(completadosCount / totalModulos) * 100} className="h-2 w-32" />
          </div>
        </header>
        <main className="max-w-3xl mx-auto p-6 space-y-3">
          {rutaSeleccionada.modulos.map((m, idx) => {
            const completado = modulosCompletados.has(idx);
            const desbloqueado = idx === 0 || modulosCompletados.has(idx - 1);
            return (
              <Card
                key={m.id}
                className={`border cursor-pointer transition-colors ${completado ? "border-primary/30 bg-primary/5" : desbloqueado ? "hover:border-primary/50" : "opacity-50"}`}
                onClick={() => abrirModulo(idx)}
              >
                <CardContent className="py-4 px-5 flex items-center gap-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full border-2 shrink-0 text-sm font-bold border-primary/30 text-primary">
                    {completado ? <CheckCircle2 className="h-5 w-5" /> : desbloqueado ? idx + 1 : <Lock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{m.nombre}</p>
                    <p className="text-xs text-muted-foreground">{m.videos.length} vídeos · Evaluación (nota mínima: {m.evaluacion.notaMinima}%)</p>
                  </div>
                  {completado && <Badge variant="secondary">Completado</Badge>}
                  {!completado && desbloqueado && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                </CardContent>
              </Card>
            );
          })}
        </main>
      </div>
    );
  }

  // ─── Vista: Vídeo ─────────────────────────────────────────────
  if (vista === "video") {
    const video = modulo.videos[videoActual];
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={volverARuta}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-foreground">{modulo.nombre}</h1>
              <p className="text-xs text-muted-foreground">Vídeo {videoActual + 1} de {modulo.videos.length}</p>
            </div>
            <Progress value={((videoActual + 1) / modulo.videos.length) * 100} className="h-2 w-32" />
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-6 space-y-4">
          {/* Video placeholder */}
          <div className="aspect-video rounded-lg bg-muted border flex items-center justify-center">
            <div className="text-center space-y-2">
              <Play className="h-16 w-16 text-muted-foreground/40 mx-auto" />
              <p className="text-lg font-medium text-foreground">{video.titulo}</p>
              <p className="text-sm text-muted-foreground">Duración: {video.duracionMin} min · Tipo: {video.tipo === "generico" ? "Genérico" : "Específico"}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={siguienteVideo} className="gap-2">
              {videoActual < modulo.videos.length - 1 ? "Siguiente vídeo" : "Ir a evaluación"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ─── Vista: Evaluación ────────────────────────────────────────
  if (vista === "evaluacion") {
    const preguntas = modulo.evaluacion.preguntas;
    const todasRespondidas = preguntas.every((p) => respuestas[p.id] !== undefined);
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={volverARuta}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-foreground">{modulo.evaluacion.nombre}</h1>
              <p className="text-xs text-muted-foreground">Nota mínima requerida: {modulo.evaluacion.notaMinima}%</p>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto p-6 space-y-6">
          {preguntas.map((p, idx) => (
            <Card key={p.id} className="border bg-card">
              <CardContent className="py-4 px-5 space-y-3">
                <p className="font-medium text-foreground text-sm">{idx + 1}. {p.pregunta}</p>
                <RadioGroup
                  value={respuestas[p.id]?.toString()}
                  onValueChange={(val) => setRespuestas({ ...respuestas, [p.id]: parseInt(val) })}
                >
                  {p.opciones.map((op, oi) => (
                    <div key={oi} className="flex items-center space-x-2">
                      <RadioGroupItem value={oi.toString()} id={`${p.id}-${oi}`} />
                      <Label htmlFor={`${p.id}-${oi}`} className="text-sm text-foreground cursor-pointer">{op}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-end">
            <Button onClick={enviarEvaluacion} disabled={!todasRespondidas} className="gap-2">
              <Award className="h-4 w-4" /> Enviar evaluación
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ─── Vista: Resultado ─────────────────────────────────────────
  if (vista === "resultado") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Resultado de la evaluación</h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto p-6">
          <Card className={`border-2 ${aprobado ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
            <CardContent className="py-8 text-center space-y-4">
              {aprobado ? (
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
              ) : (
                <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
              )}
              <h2 className="text-2xl font-bold text-foreground">{aprobado ? "¡Aprobado!" : "No superado"}</h2>
              <div className="text-4xl font-bold text-foreground">{notaResultado}%</div>
              <p className="text-sm text-muted-foreground">
                Nota mínima requerida: {modulo.evaluacion.notaMinima}%
              </p>
              {aprobado ? (
                <p className="text-sm text-foreground">Has desbloqueado el siguiente módulo. ¡Sigue así!</p>
              ) : (
                <p className="text-sm text-foreground">Debes repetir este módulo para poder avanzar.</p>
              )}
              <Button onClick={volverARuta} className="mt-4">
                Volver al itinerario
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return null;
}
