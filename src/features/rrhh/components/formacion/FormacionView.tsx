"use client";

// Dashboard admin del Portal de Formación (RRHH).
// Lee del MISMO store que el portal del empleado (useFormacionStore), por lo
// que cualquier cambio aquí (publicar curso, añadir lección, novedad) se ve
// al instante en /mi-panel/formacion.
//
// KPIs y tablas derivadas SIEMPRE de datos reales:
//   - Cursos / secciones / lecciones / novedades del store.
//   - Empleados de la empresa desde getEmpleadosActivos (empleados reales).
// No se inventan notas, evaluaciones ni progreso por empleado: el modelo del
// store sólo registra "lección completada por usuario logueado". Cuando exista
// una tabla `formacion_progreso` por empleado en Supabase, esta vista cruzará
// los datos reales.

import { useState, useMemo, useEffect } from "react";
import {
  BookOpen,
  GraduationCap,
  Layers,
  ListChecks,
  Timer,
  UserSquare2,
  Users,
} from "lucide-react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  useFormacionStore,
  leccionesOrdenadas,
} from "@/features/formacion/store/use-formacion-store";
import { PUESTOS, type Puesto } from "@/features/formacion/types";
import { getEmpleadosActivos, type EmpleadoActivo } from "@/features/rrhh/actions/empleados-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminFormacionPanel } from "@/features/formacion/components/admin/AdminFormacionPanel";

// Mapa de departamento de RRHH a "puesto" del modelo de formación.
// Los departamentos sin equivalente (DIRECCIÓN, RRPP) sólo verán cursos generales.
const DEPARTAMENTO_A_PUESTO: Record<string, Puesto> = {
  CAMAREROS: "CAMARERO",
  "JEFE DE SALA": "JEFE DE SALA",
  COCINA: "COCINERO",
  CACHIMBEROS: "CACHIMBERO",
  ARTISTAS: "ARTISTA",
  MANTENIMIENTO: "MANTENIMIENTO",
  GERENTE: "GERENTE",
  ADMINISTRATIVO: "CONTABLE",
};

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function FormacionView() {
  const { empresaActual } = useEmpresa();
  const cursos = useFormacionStore((s) => s.cursos);
  const secciones = useFormacionStore((s) => s.secciones);
  const lecciones = useFormacionStore((s) => s.lecciones);
  const novedades = useFormacionStore((s) => s.novedades);

  // OLA2-01: empleados reales (fuente única). Antes venían del mock data/rrhh.ts.
  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  useEffect(() => {
    let alive = true;
    getEmpleadosActivos(empresaActual.dbId).then((r) => {
      if (alive) setEmpleados(r.ok ? r.data : []);
    });
    return () => {
      alive = false;
    };
  }, [empresaActual.dbId]);

  const cursosEmpresa = useMemo(
    () => cursos.filter((c) => c.empresaId === empresaActual.id),
    [cursos, empresaActual.id],
  );

  const novedadesEmpresa = useMemo(
    () => novedades.filter((n) => n.empresaId === empresaActual.id),
    [novedades, empresaActual.id],
  );

  // ─── KPIs globales ──────────────────────────────────────────
  const stats = useMemo(() => {
    const cursoIds = new Set(cursosEmpresa.map((c) => c.id));
    const leccionesEmpresa = lecciones.filter((l) => cursoIds.has(l.cursoId));
    const totalMinutos = leccionesEmpresa.reduce(
      (acc, l) => acc + l.duracionMin,
      0,
    );
    return {
      totalCursos: cursosEmpresa.length,
      publicados: cursosEmpresa.filter((c) => c.publicado).length,
      borradores: cursosEmpresa.filter((c) => !c.publicado).length,
      generales: cursosEmpresa.filter((c) => c.ambito === "general").length,
      porPuesto: cursosEmpresa.filter((c) => c.ambito === "puesto").length,
      totalLecciones: leccionesEmpresa.length,
      totalMinutos,
      novedadesActivas: novedadesEmpresa.length,
    };
  }, [cursosEmpresa, lecciones, novedadesEmpresa]);

  // ─── Por puesto ─────────────────────────────────────────────
  const filasPuesto = useMemo(() => {
    return PUESTOS.map((puesto) => {
      const cursosGenerales = cursosEmpresa.filter(
        (c) => c.ambito === "general",
      );
      const cursosEspecificos = cursosEmpresa.filter(
        (c) => c.ambito === "puesto" && c.puesto === puesto,
      );
      const cursosDisponibles = [...cursosGenerales, ...cursosEspecificos];
      const totalLecciones = cursosDisponibles.reduce(
        (acc, c) =>
          acc + leccionesOrdenadas(secciones, lecciones, c.id).length,
        0,
      );
      const empleadosPuesto = empleados.filter(
        (e) => DEPARTAMENTO_A_PUESTO[e.departamento ?? ""] === puesto,
      ).length;

      return {
        puesto,
        empleados: empleadosPuesto,
        cursosTotales: cursosDisponibles.length,
        cursosPublicados: cursosDisponibles.filter((c) => c.publicado).length,
        cursosEspecificos: cursosEspecificos.length,
        totalLecciones,
      };
    }).filter((f) => f.empleados > 0 || f.cursosEspecificos > 0);
  }, [cursosEmpresa, secciones, lecciones, empleados]);

  // ─── Catálogo de cursos ─────────────────────────────────────
  const catalogo = useMemo(() => {
    return [...cursosEmpresa]
      .map((c) => {
        const ords = leccionesOrdenadas(secciones, lecciones, c.id);
        const minutos = ords.reduce((acc, l) => acc + l.duracionMin, 0);
        return {
          curso: c,
          lecciones: ords.length,
          minutos,
        };
      })
      .sort((a, b) => {
        if (a.curso.ambito !== b.curso.ambito)
          return a.curso.ambito === "general" ? -1 : 1;
        return a.curso.orden - b.curso.orden;
      });
  }, [cursosEmpresa, secciones, lecciones]);

  // ─── Empleados sin puesto reconocido ────────────────────────
  const empleadosSinPuesto = empleados.filter(
    (e) => !DEPARTAMENTO_A_PUESTO[e.departamento ?? ""],
  ).length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Banner: explica la conexión admin ↔ portal */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 px-4 py-3">
          <BookOpen className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-foreground">
            Lo que creas o publiques aquí aparece <strong>al instante</strong>{" "}
            en <code>Mi Panel → Formación</code> de los empleados. Esta pantalla
            es el panel de administración; el portal es el reflejo.
          </p>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: "Cursos publicados",
            value: stats.publicados,
            icon: GraduationCap,
            sub: `${stats.borradores} en borrador`,
          },
          {
            label: "Cursos generales",
            value: stats.generales,
            icon: Layers,
            sub: "para todo el equipo",
          },
          {
            label: "Cursos por puesto",
            value: stats.porPuesto,
            icon: UserSquare2,
            sub: "específicos",
          },
          {
            label: "Total lecciones",
            value: stats.totalLecciones,
            icon: ListChecks,
            sub: "vídeos del catálogo",
          },
          {
            label: "Duración total",
            value: `${Math.round(stats.totalMinutos / 60)}h`,
            icon: Timer,
            sub: `${stats.totalMinutos} min`,
          },
          {
            label: "Empleados",
            value: empleados.length,
            icon: Users,
            sub: `${empleadosSinPuesto} sin puesto formativo`,
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {kpi.value}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reparto publicado / borrador */}
      <Card className="border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Estado del catálogo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Publicados</span>
              <span className="font-semibold">
                {stats.publicados}/{stats.totalCursos}
              </span>
            </div>
            <Progress
              value={
                stats.totalCursos > 0
                  ? (stats.publicados / stats.totalCursos) * 100
                  : 0
              }
              className="h-2"
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Borradores</span>
              <span className="font-semibold">{stats.borradores}</span>
            </div>
            <Progress
              value={
                stats.totalCursos > 0
                  ? (stats.borradores / stats.totalCursos) * 100
                  : 0
              }
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cobertura por puesto */}
      <Card className="border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <UserSquare2 className="h-4 w-4" />
            Cobertura por puesto
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filasPuesto.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Aún no hay cursos por puesto ni empleados asignados a puestos
              formativos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Puesto</TableHead>
                  <TableHead className="text-center">Empleados</TableHead>
                  <TableHead className="text-center">Cursos disponibles</TableHead>
                  <TableHead className="text-center">Específicos</TableHead>
                  <TableHead className="text-center">Lecciones</TableHead>
                  <TableHead className="text-center">Publicados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasPuesto.map((f) => (
                  <TableRow key={f.puesto}>
                    <TableCell className="font-medium">{f.puesto}</TableCell>
                    <TableCell className="text-center">{f.empleados}</TableCell>
                    <TableCell className="text-center">
                      {f.cursosTotales}
                    </TableCell>
                    <TableCell className="text-center">
                      {f.cursosEspecificos}
                    </TableCell>
                    <TableCell className="text-center">
                      {f.totalLecciones}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[11px]">
                        {f.cursosPublicados}/{f.cursosTotales}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Catálogo de cursos */}
      <Card className="border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            Catálogo actual ({catalogo.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {catalogo.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Aún no hay cursos. Crea el primero desde el panel de gestión más
              abajo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead>Ámbito</TableHead>
                  <TableHead className="text-center">Lecciones</TableHead>
                  <TableHead className="text-center">Duración</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Publicado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalogo.map(({ curso, lecciones: nLecc, minutos }) => (
                  <TableRow key={curso.id}>
                    <TableCell>
                      <div className="font-medium">{curso.titulo}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {curso.descripcion}
                      </div>
                    </TableCell>
                    <TableCell>
                      {curso.ambito === "general" ? (
                        <Badge variant="outline">General</Badge>
                      ) : (
                        <Badge variant="secondary">{curso.puesto}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{nLecc}</TableCell>
                    <TableCell className="text-center">
                      {minutos > 0 ? `${minutos} min` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {curso.publicado ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          Publicado
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          Borrador
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatFecha(curso.fechaPublicacion)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Panel de gestión real (cursos + novedades) */}
      <AdminFormacionPanel />
    </div>
  );
}
