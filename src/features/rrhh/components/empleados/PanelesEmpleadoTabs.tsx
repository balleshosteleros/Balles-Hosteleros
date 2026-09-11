"use client";

/**
 * Los paneles del trabajador, vistos desde SU FICHA.
 *
 * La ficha enseña lo mismo que él tiene en «Mis paneles» y en el mismo orden,
 * para que RRHH vea de un vistazo lo que ve el trabajador. Todo es de SOLO
 * LECTURA: cada cosa se edita en su módulo, que es la fuente única (points en
 * Points, cursos en Formación, comunicados en Gerencia…).
 */

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, GraduationCap, Megaphone, CalendarClock,
  CheckCircle2, Circle, Inbox,
} from "lucide-react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import {
  getPointsEmpleado,
  getFormacionEmpleado,
  getComunicadosEmpleado,
  type PointsEmpleado,
  type CursoEmpleado,
  type ComunicadoEmpleado,
} from "@/features/rrhh/actions/ficha-paneles-actions";
import {
  getMiCronograma,
  type MiCronogramaDepartamento,
} from "@/features/mi-panel/actions/cronograma-actions";

/* ─── Piezas comunes ──────────────────────────────────────────────────── */

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
      <Inbox className="mb-2 h-6 w-6" />
      {texto}
    </div>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-4xl space-y-4 p-6">{children}</div>;
}

/* ─── POINTS ──────────────────────────────────────────────────────────── */

export function PointsEmpleadoTab({ empleadoId }: { empleadoId: string }) {
  const { empresaActual } = useEmpresa();
  const [datos, setDatos] = useState<PointsEmpleado | null>(null);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    getPointsEmpleado(empleadoId)
      .then((r) => { if (activo) setDatos(r.ok ? r.data : null); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [empleadoId]);

  // Su nivel es el último cuyo mínimo ya ha superado; el siguiente marca cuánto
  // le queda.
  const { nivel, siguiente } = useMemo(() => {
    const orden = [...(datos?.niveles ?? [])].sort((a, b) => a.toquesMin - b.toquesMin);
    const acum = datos?.acumulados ?? 0;
    let actual = null as (typeof orden)[number] | null;
    let sig = null as (typeof orden)[number] | null;
    for (const n of orden) {
      if (acum >= n.toquesMin) actual = n;
      else if (!sig) sig = n;
    }
    return { nivel: actual, siguiente: sig };
  }, [datos]);

  if (cargando) return <LoadingSpinner className="py-16" />;
  if (!datos) return <Vacio texto="No se han podido leer sus points." />;

  return (
    <Marco>
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: nivel?.badgeColor ?? "#9ca3af" }}
          >
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Nivel</p>
            <p className="text-lg font-semibold">{nivel?.nombre ?? "Sin nivel"}</p>
            {siguiente && (
              <p className="text-xs text-muted-foreground">
                Le faltan {siguiente.toquesMin - datos.acumulados} points para {siguiente.nombre}
              </p>
            )}
          </div>
          <div className="ml-auto flex gap-8">
            <div className="text-center">
              <p className="text-2xl font-semibold">{datos.acumulados}</p>
              <p className="text-xs text-muted-foreground">Acumulados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold">{datos.canjeables}</p>
              <p className="text-xs text-muted-foreground">Canjeables</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Últimos movimientos</h2>
        {datos.movimientos.length === 0 ? (
          <Vacio texto="Todavía no ha sumado points." />
        ) : (
          <ul className="divide-y">
            {datos.movimientos.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-muted-foreground">
                  {formatFechaEnZona(m.fecha, empresaActual.zonaHoraria) || "—"}
                </span>
                <span className="flex-1">{m.motivo || m.origen}</span>
                <span className={m.toques >= 0 ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                  {m.toques >= 0 ? `+${m.toques}` : m.toques}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Marco>
  );
}

/* ─── CRONOGRAMA ──────────────────────────────────────────────────────── */

export function CronogramaEmpleadoTab({ userId }: { userId: string | null }) {
  const [deptos, setDeptos] = useState<MiCronogramaDepartamento[]>([]);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);

  useEffect(() => {
    let activo = true;
    if (!userId) { setDeptos([]); setCargando(false); return; }
    setCargando(true);
    getMiCronograma(userId)
      .then((r) => { if (activo) setDeptos(r.ok ? r.data.departamentos : []); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [userId]);

  if (cargando) return <LoadingSpinner className="py-16" />;
  if (!userId) return <Vacio texto="Todavía no tiene cuenta de acceso." />;
  const conTareas = deptos.filter((d) => d.tareas.length > 0);
  if (conTareas.length === 0) return <Vacio texto="Sus puestos no tienen tareas de cronograma." />;

  return (
    <Marco>
      {conTareas.map((d) => (
        <Card key={d.rol} className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">{d.label}</h2>
            <Badge variant="secondary">{d.departamento}</Badge>
            <span className="ml-auto text-xs text-muted-foreground">
              {d.tareas.length} {d.tareas.length === 1 ? "tarea" : "tareas"}
            </span>
          </div>
          <ul className="divide-y">
            {d.tareas.map((t) => (
              <li key={t.id} className="flex items-start gap-3 py-2 text-sm">
                <span className="flex-1">{t.tarea}</span>
                <Badge variant="outline" className="shrink-0">{t.frecuencia}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </Marco>
  );
}

/* ─── FORMACIÓN ───────────────────────────────────────────────────────── */

export function FormacionEmpleadoTab({ empleadoId }: { empleadoId: string }) {
  const [cursos, setCursos] = useState<CursoEmpleado[]>([]);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    getFormacionEmpleado(empleadoId)
      .then((r) => { if (activo) setCursos(r.ok ? r.data : []); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [empleadoId]);

  if (cargando) return <LoadingSpinner className="py-16" />;
  if (cursos.length === 0) return <Vacio texto="No tiene ningún curso publicado." />;

  return (
    <Marco>
      {cursos.map((c) => {
        const pct = c.lecciones > 0 ? Math.round((c.completadas / c.lecciones) * 100) : 0;
        return (
          <Card key={c.id} className="p-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">{c.titulo}</h2>
              {c.puesto && <Badge variant="secondary">{c.puesto}</Badge>}
              <span className="ml-auto text-sm text-muted-foreground">
                {c.completadas} de {c.lecciones}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </Card>
        );
      })}
    </Marco>
  );
}

/* ─── COMUNICADOS ─────────────────────────────────────────────────────── */

export function ComunicadosEmpleadoTab({ empleadoId }: { empleadoId: string }) {
  const { empresaActual } = useEmpresa();
  const [items, setItems] = useState<ComunicadoEmpleado[]>([]);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    getComunicadosEmpleado(empleadoId)
      .then((r) => { if (activo) setItems(r.ok ? r.data : []); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [empleadoId]);

  if (cargando) return <LoadingSpinner className="py-16" />;
  if (items.length === 0) return <Vacio texto="No le ha llegado ningún comunicado." />;

  return (
    <Marco>
      <Card className="divide-y p-0">
        {items.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <Megaphone className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {formatFechaEnZona(c.createdAt, empresaActual.zonaHoraria)}
              </p>
            </div>
            {c.vistoEl ? (
              <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Leído el {formatFechaEnZona(c.vistoEl, empresaActual.zonaHoraria)}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Circle className="h-3.5 w-3.5" />
                Sin leer
              </span>
            )}
          </div>
        ))}
      </Card>
    </Marco>
  );
}
