"use client";

// Portal de Formación — pantalla de inicio (estilo Skool).
// - Cabecera con nombre y avance global
// - Novedades de los últimos 3 meses
// - Grid de tarjetas: cursos generales + cursos del puesto del empleado
// El detalle de cada curso vive en /mi-panel/formacion/curso/[cursoId].

import { useMemo } from "react";
import {
  GraduationCap,
  Sparkles,
  UserSquare2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  useFormacionStore,
  cursosVisibles,
  avanceCurso,
  duracionCurso,
  leccionesOrdenadas,
} from "../store/use-formacion-store";
import { usePuestoActual } from "../hooks/use-puesto";
import { PUESTOS, type Puesto } from "../types";
import { NovedadesPanel } from "./NovedadesPanel";
import { CursoCard } from "./CursoCard";

const TRES_MESES_MS = 1000 * 60 * 60 * 24 * 90;

export function PortalFormacionView() {
  const { profile, roles } = useAuth();
  const { empresaActual } = useEmpresa();
  const userKey = profile?.email ?? "anon";
  const { puesto, setPuesto, ready } = usePuestoActual(userKey);

  const cursos = useFormacionStore((s) => s.cursos);
  const secciones = useFormacionStore((s) => s.secciones);
  const lecciones = useFormacionStore((s) => s.lecciones);
  const completadas = useFormacionStore((s) => s.completadas);

  const visibles = useMemo(
    () => cursosVisibles(cursos, empresaActual.id, puesto),
    [cursos, empresaActual.id, puesto],
  );

  const generales = visibles.filter((c) => c.ambito === "general");
  const especificos = visibles.filter((c) => c.ambito === "puesto");

  // Métricas globales
  const stats = useMemo(() => {
    let totalLecciones = 0;
    let totalVistas = 0;
    for (const c of visibles) {
      const a = avanceCurso(secciones, lecciones, completadas, userKey, c.id);
      totalLecciones += a.total;
      totalVistas += a.vistas;
    }
    const pct =
      totalLecciones > 0 ? Math.round((totalVistas / totalLecciones) * 100) : 0;
    return { totalLecciones, totalVistas, pct };
  }, [visibles, secciones, lecciones, completadas, userKey]);

  // Cursos publicados en los últimos 3 meses → badge "Nuevo".
  const ahora = Date.now();
  function esNuevo(fechaIso: string): boolean {
    return ahora - new Date(fechaIso).getTime() <= TRES_MESES_MS;
  }

  const nombre = profile?.nombre ?? "Compañero";
  const esResponsableODirector = roles.some((r) =>
    ["admin", "director", "gerencia", "responsable"].includes(r),
  );

  if (!ready) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground">Cargando portal…</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Cabecera */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Portal de Formación
                </div>
                <h1 className="mt-1 text-xl font-bold text-foreground">
                  Hola, {nombre}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Aquí están tus cursos. Ve avanzando lección a lección; tu
                  progreso se guarda automáticamente.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:items-end">
              <div className="flex items-center gap-2 text-sm">
                <UserSquare2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Tu puesto:</span>
                <Select
                  value={puesto}
                  onValueChange={(v) => setPuesto(v as Puesto)}
                  disabled={!esResponsableODirector}
                >
                  <SelectTrigger className="h-8 w-[180px] text-sm font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PUESTOS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {esResponsableODirector && (
                <p className="text-[11px] text-muted-foreground">
                  Como responsable puedes simular el portal de cada puesto.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Avance global</span>
                <span className="font-semibold text-foreground">
                  {stats.pct}%
                </span>
              </div>
              <Progress value={stats.pct} className="h-2" />
              <p className="text-[11px] text-muted-foreground">
                {stats.totalVistas} de {stats.totalLecciones} lecciones
                completadas
              </p>
            </div>
            <div className="rounded-md border bg-card p-3">
              <div className="text-xs text-muted-foreground">Cursos generales</div>
              <p className="mt-1 text-2xl font-bold">{generales.length}</p>
            </div>
            <div className="rounded-md border bg-card p-3">
              <div className="text-xs text-muted-foreground">
                Específicos para {puesto}
              </div>
              <p className="mt-1 text-2xl font-bold">{especificos.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Novedades */}
      <NovedadesPanel empresaId={empresaActual.id} puesto={puesto} />

      {/* Cursos generales */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Cursos para todo el equipo
          </h2>
          <span className="text-xs text-muted-foreground">
            {generales.length}{" "}
            {generales.length === 1 ? "curso" : "cursos"}
          </span>
        </div>
        {generales.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Aún no hay cursos generales publicados.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {generales.map((c) => {
              const ords = leccionesOrdenadas(secciones, lecciones, c.id);
              const a = avanceCurso(
                secciones,
                lecciones,
                completadas,
                userKey,
                c.id,
              );
              return (
                <CursoCard
                  key={c.id}
                  curso={c}
                  totalLecciones={ords.length}
                  totalMinutos={duracionCurso(secciones, lecciones, c.id)}
                  avancePct={a.pct}
                  destacar={esNuevo(c.fechaPublicacion)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Cursos del puesto */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Específicos para tu puesto · {puesto}
          </h2>
          <span className="text-xs text-muted-foreground">
            {especificos.length}{" "}
            {especificos.length === 1 ? "curso" : "cursos"}
          </span>
        </div>
        {especificos.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Tu puesto aún no tiene cursos específicos publicados.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {especificos.map((c) => {
              const ords = leccionesOrdenadas(secciones, lecciones, c.id);
              const a = avanceCurso(
                secciones,
                lecciones,
                completadas,
                userKey,
                c.id,
              );
              return (
                <CursoCard
                  key={c.id}
                  curso={c}
                  totalLecciones={ords.length}
                  totalMinutos={duracionCurso(secciones, lecciones, c.id)}
                  avancePct={a.pct}
                  destacar={esNuevo(c.fechaPublicacion)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
