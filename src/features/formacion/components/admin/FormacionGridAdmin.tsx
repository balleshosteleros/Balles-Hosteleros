"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Briefcase, UtensilsCrossed, GraduationCap, ChevronRight,
  PlayCircle, FileText, Search, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  useFormacionStore,
  leccionesOrdenadas,
} from "@/features/formacion/store/use-formacion-store";
import { usePuestosEmpresa } from "@/features/formacion/hooks/use-puestos-empresa";
import { syncCursosPorPuesto } from "@/features/formacion/actions/formacion-actions";
import {
  getAreaForDepartamento, AREA_FORM_LABEL, AREA_FORM_BADGE,
  getGradienteDepto, type AreaFormacion,
} from "@/features/formacion/data/formacionAreas";

/**
 * Grid admin de Formación estilo School: toggle Operativa/Administrativa arriba
 * + una tarjeta por PUESTO del área (1 puesto = 1 curso). Portada de imagen si
 * el curso la tiene, o gradiente por departamento. Clic → editor del curso.
 */
export function FormacionGridAdmin() {
  const router = useRouter();
  const { empresaActual } = useEmpresa();
  const { puestos, ready } = usePuestosEmpresa();
  const { cursos, secciones, lecciones, hydrate } = useFormacionStore();

  const [filtroArea, setFiltroArea] = useState<AreaFormacion>("OPERATIVA");
  const [busqueda, setBusqueda] = useState("");

  // Asegura 1 curso por puesto y recarga datos al entrar / cambiar de empresa.
  useEffect(() => {
    let alive = true;
    (async () => {
      await syncCursosPorPuesto();
      if (alive) await hydrate("");
    })();
    return () => { alive = false; };
  }, [empresaActual?.id, hydrate]);

  // Un "item" por puesto: su curso (si existe), nº lecciones, progreso global.
  const items = useMemo(() => {
    return puestos.map((p) => {
      const curso = cursos.find((c) => c.puestoId === p.id);
      const lecs = curso ? leccionesOrdenadas(secciones, lecciones, curso.id) : [];
      const numSecciones = curso
        ? secciones.filter((s) => s.cursoId === curso.id).length
        : 0;
      const conVideo = lecs.filter((l) => l.url).length;
      return {
        puesto: p,
        curso,
        area: getAreaForDepartamento(p.departamento),
        numLecciones: lecs.length,
        numSecciones,
        conVideo,
        publicado: curso?.publicado ?? false,
        cover: curso?.cover,
      };
    });
  }, [puestos, cursos, secciones, lecciones]);

  const counts = useMemo(() => ({
    OPERATIVA: items.filter((i) => i.area === "OPERATIVA").length,
    ADMINISTRATIVA: items.filter((i) => i.area === "ADMINISTRATIVA").length,
  }), [items]);

  const itemsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items
      .filter((i) => i.area === filtroArea)
      .filter((i) => !q || i.puesto.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.puesto.nombre.localeCompare(b.puesto.nombre));
  }, [items, filtroArea, busqueda]);

  function abrirCurso(cursoId?: string) {
    if (cursoId) router.push(`/rrhh/formacion/curso/${cursoId}`);
  }

  return (
    <div className="flex flex-col">
      {/* Selector de áreas */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {(["OPERATIVA", "ADMINISTRATIVA"] as const).map((opt) => {
          const active = filtroArea === opt;
          const Icon = opt === "OPERATIVA" ? UtensilsCrossed : Briefcase;
          return (
            <Button
              key={opt}
              type="button"
              variant={active ? "default" : "outline"}
              className="gap-2"
              onClick={() => setFiltroArea(opt)}
            >
              <Icon className="h-4 w-4" />
              {AREA_FORM_LABEL[opt]}
              <Badge variant="secondary" className="text-[10px] ml-1">{counts[opt]}</Badge>
            </Button>
          );
        })}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar puesto"
            className="pl-8"
          />
        </div>
      </div>

      {/* Grid de cursos por puesto */}
      {!ready ? (
        <div className="text-center text-muted-foreground py-20">Cargando…</div>
      ) : itemsFiltrados.length === 0 ? (
        <div className="text-center text-muted-foreground py-20">
          No hay puestos en el área seleccionada.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {itemsFiltrados.map(({ puesto, curso, area, numLecciones, numSecciones, conVideo, publicado, cover }) => {
            const gradiente = getGradienteDepto(puesto.departamento);
            const esImagen = cover && /^https?:\/\//.test(cover);
            return (
              <Card
                key={puesto.id}
                role="button"
                tabIndex={0}
                onClick={() => abrirCurso(curso?.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirCurso(curso?.id); }
                }}
                className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 group p-0"
              >
                {/* Portada */}
                <div className="relative h-32 w-full overflow-hidden">
                  {esImagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={puesto.nombre} className="h-full w-full object-cover" />
                  ) : (
                    <div className={cn("h-full w-full bg-gradient-to-br flex items-center justify-center", gradiente)}>
                      <GraduationCap className="h-10 w-10 text-white/90" />
                    </div>
                  )}
                  <Badge
                    variant="outline"
                    className={cn("absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0 bg-white/90", AREA_FORM_BADGE[area])}
                  >
                    {AREA_FORM_LABEL[area]}
                  </Badge>
                  {!publicado && (
                    <Badge className="absolute top-2 right-2 text-[10px] bg-amber-500 hover:bg-amber-500">Borrador</Badge>
                  )}
                </div>

                {/* Cuerpo */}
                <div className="p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-bold text-sm uppercase tracking-wide truncate">{puesto.nombre}</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{puesto.departamento ?? "—"}</p>

                  {numLecciones === 0 ? (
                    <p className="text-xs italic text-muted-foreground">Sin lecciones — pulsa para crear</p>
                  ) : (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{numSecciones} temas</span>
                      <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{numLecciones} lecciones</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
