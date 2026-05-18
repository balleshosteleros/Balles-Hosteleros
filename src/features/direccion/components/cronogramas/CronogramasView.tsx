"use client";

import { useEffect, useMemo, useState, Fragment, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useCronogramasOperativos,
  CronogramaOperativo,
  Frecuencia,
  TerminaTipo,
} from "../../hooks/useCronogramasOperativos";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectLabel, SelectSeparator,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, CalendarDays, Edit2, ChevronDown, ChevronRight, Video, Upload, X, ArrowLeft,
  Hand, Table2, CalendarRange,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  uploadCronogramaVideo, deleteCronogramaVideo, updateCronogramaResumen,
} from "../../actions/cronograma-video-actions";
import { deleteCronogramaRolMultiEmpresa } from "../../actions/cronograma-multiempresa-actions";
import { CronogramasHome } from "./CronogramasHome";
import { SelectorDiasTarea, BadgesDiasTarea } from "./SelectorDiasTarea";
import { CalendarioCronograma } from "./CalendarioCronograma";
import { SelectorEmpresasDialog, type SelectorAccion } from "./SelectorEmpresasDialog";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  AREA_BADGE_CLASS,
  AREA_LABEL,
  getAreaForRol,
  getModuloForCronograma,
  type AreaCronograma,
} from "../../data/cronogramaAreas";
import { cn } from "@/lib/utils";
import { listDepartamentos, type DepartamentoRow } from "@/features/ajustes/actions/departamentos-actions";
import { getUserPermisos } from "@/features/auth/actions/permisos-actions";

const ORDERED_FREQUENCIES: Frecuencia[] = [
  "DIARIO", "SEMANAL", "MENSUAL", "TRIMESTRAL", "ANUAL", "POR NECESIDAD",
];

function normalizeNombre(s: string): string {
  return s
    .toUpperCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

interface Grupo {
  main: CronogramaOperativo;
  subs: CronogramaOperativo[];
}

interface PendingSelector {
  accion: SelectorAccion;
  run: (empresaIds: string[]) => Promise<void>;
}

export function CronogramasView() {
  const router = useRouter();
  const { empresas } = useEmpresa();
  const todosDbIds = useMemo(
    () => empresas.filter((e) => !!e.dbId).map((e) => e.dbId!),
    [empresas],
  );
  const haySoloUnaEmpresa = todosDbIds.length === 1;

  const { data, isLoading, addTareaMulti, updateTareaMulti, deleteTareaMulti, refresh } = useCronogramasOperativos();
  const [selectedRol, setSelectedRol] = useState<string>("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [detalle, setDetalle] = useState<CronogramaOperativo | null>(null);
  const [nuevaDraft, setNuevaDraft] = useState<{
    parentId: string | null;
    parentClaveTarea: string | null;
    parentIdVisible: string | null;
    subCount: number;
    nextOrden: number;
    nextIdVisible: string;
  } | null>(null);
  const [filtroAreaSelect, setFiltroAreaSelect] = useState<"TODAS" | AreaCronograma>("TODAS");
  const [vistaModo, setVistaModo] = useState<"TABLA" | "CALENDARIO">("TABLA");
  const [departamentos, setDepartamentos] = useState<DepartamentoRow[]>([]);
  const [pendingSelector, setPendingSelector] = useState<PendingSelector | null>(null);

  /**
   * Abre el selector de empresas y, al confirmar, ejecuta la acción.
   * Si solo hay 1 empresa en el grupo, la acción se ejecuta directamente.
   */
  const askEmpresasYEjecutar = (
    accion: SelectorAccion,
    run: (empresaIds: string[]) => Promise<void>,
  ) => {
    if (haySoloUnaEmpresa) {
      void run(todosDbIds);
      return;
    }
    setPendingSelector({ accion, run });
  };

  useEffect(() => {
    listDepartamentos().then((rows) => setDepartamentos(rows ?? []));
  }, []);

  // Departamento al que está asignado el usuario (`profiles.departamento`).
  // Sólo verá los cronogramas de su propio departamento. `null` = aún
  // cargando → no filtramos para evitar parpadeo. Director/admin (app_role)
  // reciben acceso total (sentinela "*"). Si el usuario no tiene
  // departamento asignado, el set queda vacío → no ve ningún cronograma.
  const [accessibleModulos, setAccessibleModulos] = useState<Set<string> | null>(null);
  useEffect(() => {
    let alive = true;
    getUserPermisos()
      .then((res) => {
        if (!alive) return;
        const set = new Set<string>();
        const esDirectorApp = res.appRoles?.some(
          (r) => r === "director" || r === "admin",
        );
        if (esDirectorApp) {
          set.add("*");
        } else if (res.departamento) {
          set.add(normalizeNombre(res.departamento));
        }
        setAccessibleModulos(set);
      })
      .catch(() => setAccessibleModulos(new Set()));
    return () => {
      alive = false;
    };
  }, []);

  const moduloAccesible = (modulo: string) => {
    if (accessibleModulos === null) return true; // cargando: no filtrar
    if (accessibleModulos.has("*")) return true;
    return accessibleModulos.has(normalizeNombre(modulo));
  };

  // nombre departamento (normalizado) → área. Permite resolver el área de un
  // puesto a partir de su departamento sin volver a consultar la BD.
  const depAreaMap = useMemo(() => {
    const map = new Map<string, AreaCronograma>();
    for (const d of departamentos) {
      map.set(normalizeNombre(d.nombre), d.area);
    }
    return map;
  }, [departamentos]);

  // rol → departamento (cualquier fila del rol que lo tenga). Memo para no
  // recorrer el array entero en cada render.
  const rolToDepartamento = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of data) {
      if (it.departamento && !map.has(it.rol)) map.set(it.rol, it.departamento);
    }
    return map;
  }, [data]);

  const areaForRol = (rol: string): AreaCronograma => {
    const dep = rolToDepartamento.get(rol);
    if (dep) {
      const fromDep = depAreaMap.get(normalizeNombre(dep));
      if (fromDep) return fromDep;
    }
    const fromRol = depAreaMap.get(normalizeNombre(rol));
    if (fromRol) return fromRol;
    return getAreaForRol(rol);
  };

  // Fila pendiente (nueva subtarea inline en tabla)
  const [pendingNew, setPendingNew] = useState<{
    parentId: string | null;
    parentClaveTarea: string | null;
    parentIdVisible: string | null;
    subCount: number;
    nextOrden: number;
    text: string;
  } | null>(null);

  const rolesDisponibles = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.rol))).filter(Boolean).sort();
  }, [data]);

  // Jerarquía ÁREA → DEPARTAMENTO → puestos[]. Fuente: tabla `departamentos`.
  // Si `cronogramas_operativos.departamento` no está poblado para un rol, se
  // intenta resolver por (1) nombre del rol == nombre de departamento, o
  // (2) módulo asociado vía CRONOGRAMA_TO_MODULO.
  const puestosPorAreaYDepto = useMemo(() => {
    const tree: Record<AreaCronograma, Map<string, string[]>> = {
      OPERATIVA: new Map(),
      ADMINISTRATIVA: new Map(),
    };
    const deptoByName = new Map<string, string>();
    for (const d of departamentos) {
      const area = d.area as AreaCronograma;
      if (!tree[area].has(d.nombre)) tree[area].set(d.nombre, []);
      deptoByName.set(normalizeNombre(d.nombre), d.nombre);
    }
    const huerfanos: string[] = [];
    for (const rol of rolesDisponibles) {
      let depto = rolToDepartamento.get(rol);
      if (!depto) {
        depto = deptoByName.get(normalizeNombre(rol));
      }
      if (!depto) {
        const moduloName = getModuloForCronograma(rol);
        depto = deptoByName.get(normalizeNombre(moduloName));
      }
      if (!depto) {
        huerfanos.push(rol);
        continue;
      }
      const area = depAreaMap.get(normalizeNombre(depto)) ?? getAreaForRol(rol);
      const map = tree[area];
      const arr = map.get(depto) ?? [];
      if (!arr.includes(rol)) arr.push(rol);
      arr.sort((a, b) => a.localeCompare(b));
      map.set(depto, arr);
    }
    return { tree, huerfanos };
  }, [rolesDisponibles, rolToDepartamento, depAreaMap, departamentos]);

  const rolesPorArea = useMemo(() => {
    const operativa: string[] = [];
    const administrativa: string[] = [];
    for (const [, puestos] of puestosPorAreaYDepto.tree.OPERATIVA) operativa.push(...puestos);
    for (const [, puestos] of puestosPorAreaYDepto.tree.ADMINISTRATIVA) administrativa.push(...puestos);
    return { OPERATIVA: operativa, ADMINISTRATIVA: administrativa };
  }, [puestosPorAreaYDepto]);

  const rolesFiltrados = useMemo(() => {
    if (filtroAreaSelect === "TODAS") return rolesDisponibles;
    return rolesPorArea[filtroAreaSelect];
  }, [rolesDisponibles, rolesPorArea, filtroAreaSelect]);

  const rolActivo = selectedRol || (rolesFiltrados.length > 0 ? rolesFiltrados[0] : "");
  const tareasDeRol = useMemo(() => data.filter((d) => d.rol === rolActivo), [data, rolActivo]);

  // Construir jerarquía: main = sin parent_id, subs = con parent_id
  const grupos = useMemo<Grupo[]>(() => {
    const mains = tareasDeRol.filter((t) => !t.parent_id);
    const subsByParent = new Map<string, CronogramaOperativo[]>();
    for (const t of tareasDeRol) {
      if (t.parent_id) {
        const arr = subsByParent.get(t.parent_id) ?? [];
        arr.push(t);
        subsByParent.set(t.parent_id, arr);
      }
    }
    return mains.map((m) => ({
      main: m,
      subs: (subsByParent.get(m.id) ?? []).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
    }));
  }, [tareasDeRol]);

  const toggleGroup = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedGroups((p) => ({ ...p, [id]: p[id] === undefined ? false : !p[id] }));
  };

  const handleAddMain = () => {
    if (!rolActivo) return;
    const nextOrden = Math.max(0, ...tareasDeRol.map((t) => t.orden ?? 0)) + 1;
    setNuevaDraft({
      parentId: null,
      parentClaveTarea: null,
      parentIdVisible: null,
      subCount: 0,
      nextOrden,
      nextIdVisible: String(grupos.length + 1),
    });
  };

  const handleAddSub = (parent: CronogramaOperativo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!rolActivo) return;
    const grupo = grupos.find((g) => g.main.id === parent.id);
    const subCount = grupo?.subs.length ?? 0;
    const nextOrden = (parent.orden ?? 0) * 1000 + subCount + 1;
    setExpandedGroups((p) => ({ ...p, [parent.id]: true }));
    setPendingNew({
      parentId: parent.id,
      parentClaveTarea: parent.clave_tarea ?? null,
      parentIdVisible: parent.id_visible ?? null,
      subCount,
      nextOrden,
      text: "",
    });
  };

  const commitPending = async () => {
    if (!pendingNew) return;
    const text = pendingNew.text.trim();
    if (!text) { setPendingNew(null); return; } // vacío → descartar
    const { parentId, parentClaveTarea, parentIdVisible, subCount, nextOrden } = pendingNew;
    const nextIdVis = parentId
      ? `${parentIdVisible ?? ""}.${subCount + 1}`
      : String(grupos.length + 1);

    const base: Partial<CronogramaOperativo> = {
      rol: rolActivo,
      departamento: rolToDepartamento.get(rolActivo) ?? null,
      tarea: text,
      frecuencia: "OTRO",
      tiempo_requerido: "",
      id_visible: nextIdVis,
      orden: nextOrden,
    };

    setPendingNew(null);

    askEmpresasYEjecutar("crear", async (empresaIds) => {
      const res = await addTareaMulti({
        base,
        empresaIds,
        parentClaveTarea: parentClaveTarea ?? undefined,
      });
      if (!res.ok) toast.error(res.error);
      else toast.success("Tarea creada");
    });
  };

  const renderPendingRow = (isSub: boolean) => {
    if (!pendingNew) return null;
    const idVis = pendingNew.parentId
      ? `${pendingNew.parentIdVisible ?? ""}.${pendingNew.subCount + 1}`
      : String(grupos.length + 1);
    return (
      <tr className={`group transition-colors ${isSub ? "bg-muted/5" : "bg-primary/5 border-b border-primary/15"}`}>
        <td className="px-3 py-3 text-center text-xs tabular-nums font-medium text-muted-foreground/70 align-middle whitespace-nowrap">
          {idVis}
        </td>
        <td className={`px-4 py-3 align-middle ${isSub ? "pl-10" : ""}`}>
          <div className="flex items-center gap-2">
            {isSub && <span className="w-3 h-px bg-border/80" />}
            <Input
              autoFocus
              value={pendingNew.text}
              onChange={(e) => setPendingNew((p) => p ? { ...p, text: e.target.value } : p)}
              onBlur={commitPending}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitPending(); }
                if (e.key === "Escape") setPendingNew(null);
              }}
              placeholder={isSub ? "Escribe la subtarea…" : "Escribe la tarea…"}
              className="text-sm h-8 bg-background border-primary flex-1"
            />
          </div>
        </td>
        {ORDERED_FREQUENCIES.map((freq) => {
          const isManual = freq === "POR NECESIDAD";
          return (
            <td
              key={freq}
              className={cn(
                "px-2 py-3 text-center align-middle",
                isManual && "border-l border-r border-dashed border-amber-300/40 dark:border-amber-700/30 bg-amber-50/15 dark:bg-amber-950/10",
              )}
            >
              <span className={cn("text-muted-foreground/30", isManual && "text-amber-600/30")}>—</span>
            </td>
          );
        })}
        <td className="px-2 py-3 text-center align-middle bg-muted/10 border-l border-border/30">
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
            onClick={() => setPendingNew(null)}
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </Button>
        </td>
      </tr>
    );
  };

  const handleDeleteTarea = (item: CronogramaOperativo) => {
    if (!item.clave_tarea) {
      toast.error("Tarea sin clave_tarea — refresca la página.");
      return;
    }
    askEmpresasYEjecutar("eliminar", async (empresaIds) => {
      const res = await deleteTareaMulti({
        claveTarea: item.clave_tarea!,
        empresaIds,
      });
      if (!res.ok) toast.error(res.error);
      else toast.success("Tarea eliminada");
    });
  };

  const renderRow = (item: CronogramaOperativo, isSub: boolean, hasSubs: boolean) => {
    const isExpanded = expandedGroups[item.id] !== false;
    return (
      <tr
        key={item.id}
        className={`group transition-colors ${isSub ? "bg-muted/5 hover:bg-muted/10" : "hover:bg-muted/10 border-b border-border/25"}`}
      >
        {/* ID */}
        <td className="px-3 py-3 text-center text-xs tabular-nums font-medium text-muted-foreground/70 align-middle whitespace-nowrap">
          {item.id_visible || "—"}
        </td>

        {/* TAREA */}
        <td className={`px-4 py-3 align-middle ${isSub ? "pl-10 text-muted-foreground" : ""}`}>
          <div className="flex items-center gap-2">
            {!isSub && hasSubs ? (
              <button
                className="p-1 hover:bg-muted rounded text-muted-foreground"
                onClick={(e) => toggleGroup(item.id, e)}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-6" />
            )}
            {isSub && <span className="w-3 h-px bg-border/80" />}
            <div className={`flex-1 ${!isSub ? "font-medium text-foreground" : ""}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span>{item.tarea}</span>
                {item.video_url && <Video className="inline-block h-3.5 w-3.5 text-emerald-600" />}
              </div>
              {!isSub && (
                <div className="mt-1.5">
                  <BadgesDiasTarea
                    frecuencia={item.frecuencia}
                    dia_semana={item.dia_semana}
                    dia_mes={item.dia_mes}
                    fecha_anual={item.fecha_anual}
                    meses_trimestrales={item.meses_trimestrales}
                    intervalo={item.intervalo}
                    termina_tipo={item.termina_tipo}
                    termina_fecha={item.termina_fecha}
                    termina_repeticiones={item.termina_repeticiones}
                  />
                </div>
              )}
            </div>
          </div>
        </td>

        {/* FRECUENCIAS */}
        {ORDERED_FREQUENCIES.map((freq) => {
          const isActive = item.frecuencia === freq;
          const isManual = freq === "POR NECESIDAD";
          return (
            <td
              key={freq}
              className={cn(
                "px-2 py-3 text-center align-middle",
                isManual && "border-l border-r border-dashed border-amber-300/40 dark:border-amber-700/30 bg-amber-50/15 dark:bg-amber-950/10",
                isActive && !isManual && "bg-primary/5",
                isActive && isManual && "bg-amber-100/50 dark:bg-amber-950/25",
              )}
            >
              {isActive ? (
                <span
                  className={cn(
                    "font-bold text-[11px] tracking-wider inline-flex items-center gap-1",
                    isManual ? "text-amber-700 dark:text-amber-300" : "text-primary",
                  )}
                >
                  {isManual && <Hand className="h-3 w-3" />}
                  {item.tiempo_requerido || "✓"}
                </span>
              ) : (
                <span className={cn("text-muted-foreground/30", isManual && "text-amber-600/30")}>—</span>
              )}
            </td>
          );
        })}

        {/* ACCIONES — panel lateral derecho */}
        <td className="px-2 py-3 text-center align-middle bg-muted/10 border-l border-border/30">
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
              onClick={(e) => { e.stopPropagation(); setDetalle(item); }}
              title="Editar tarea"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTarea(item);
              }}
              title="Eliminar tarea"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {!isSub && (
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600"
                onClick={(e) => handleAddSub(item, e)}
                title="Añadir subtarea"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  /**
   * Crear nuevo PUESTO. Los puestos siempre se crean en TODAS las empresas
   * del grupo (no se pregunta), porque rol/departamento son compartidos.
   * Lo único que se replica es la tarea inicial vacía.
   */
  const handleCreatePuesto = async (puesto: string, departamentoNombre: string) => {
    const res = await addTareaMulti({
      base: {
        rol: puesto,
        departamento: departamentoNombre,
        tarea: "Añadir misión de " + puesto,
        frecuencia: "OTRO",
        tiempo_requerido: "",
        id_visible: "1",
        orden: 1,
        parent_id: null,
      },
      empresaIds: todosDbIds,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSelectedRol(puesto);
    setShowNewDialog(false);
  };

  const handleDeleteRolCompleto = () => {
    if (!rolActivo) return;
    askEmpresasYEjecutar("eliminar", async (empresaIds) => {
      const res = await deleteCronogramaRolMultiEmpresa({
        rol: rolActivo,
        empresaIds,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Cronograma "${rolActivo}" eliminado`);
      setSelectedRol("");
      await refresh();
    });
  };

  // HOME (cards por departamento) cuando no hay rol seleccionado
  if (!selectedRol) {
    return (
      <>
        <CronogramasHome
          data={data}
          isLoading={isLoading}
          onSelect={setSelectedRol}
          onCrearCronograma={() => setShowNewDialog(true)}
          onIrProductividad={() => router.push("/direccion/cronogramas/productividad")}
          isRolAccesible={(rol) => {
            // Un puesto es accesible si su departamento (o el módulo derivado
            // del nombre del puesto) está dentro de los módulos con `ver: true`
            // del rol del usuario en empresa_roles.
            const dep = rolToDepartamento.get(rol);
            if (dep && moduloAccesible(dep)) return true;
            return moduloAccesible(getModuloForCronograma(rol));
          }}
        />
        <NuevoPuestoDialog
          open={showNewDialog}
          onOpenChange={setShowNewDialog}
          departamentos={departamentos}
          onCreate={handleCreatePuesto}
        />
        {pendingSelector && (
          <SelectorEmpresasDialog
            open
            onOpenChange={(v) => { if (!v) setPendingSelector(null); }}
            accion={pendingSelector.accion}
            onConfirm={async (ids) => {
              await pendingSelector.run(ids);
              setPendingSelector(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-muted/20">
      <div className="flex flex-col md:flex-row md:items-center gap-4 px-6 py-4 border-b bg-card">
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => setSelectedRol("")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Volver
          </Button>

          <div className="flex items-center gap-1 group">
            <Select
              value={rolActivo}
              onValueChange={setSelectedRol}
              disabled={isLoading || rolesDisponibles.length === 0}
            >
              <SelectTrigger className="w-[280px] bg-background">
                <SelectValue placeholder={isLoading ? "…" : "Selecciona Departamento"} />
              </SelectTrigger>
              <SelectContent>
                <div className="flex items-center gap-1 px-2 py-1.5 border-b mb-1">
                  {(["TODAS", "OPERATIVA", "ADMINISTRATIVA"] as const).map((opt) => {
                    const active = filtroAreaSelect === opt;
                    const label = opt === "TODAS" ? "Todas" : AREA_LABEL[opt];
                    const n = opt === "TODAS"
                      ? rolesDisponibles.length
                      : rolesPorArea[opt].length;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFiltroAreaSelect(opt);
                        }}
                        className={cn(
                          "text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1.5 transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {label}
                        <span className={cn(
                          "text-[10px] font-mono px-1 rounded",
                          active ? "bg-background/30" : "bg-background",
                        )}>
                          {n}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const areasVisibles: AreaCronograma[] =
                    filtroAreaSelect === "TODAS"
                      ? ["OPERATIVA", "ADMINISTRATIVA"]
                      : [filtroAreaSelect];
                  // Sólo mostramos áreas/departamentos a los que el usuario
                  // actual tiene acceso según su rol en empresa_roles
                  // (`permisos[].ver`). Director/admin pasa todo (sentinela "*").
                  const areasConPuestos = areasVisibles.filter((a) =>
                    Array.from(puestosPorAreaYDepto.tree[a].entries()).some(
                      ([depto, p]) => p.length > 0 && moduloAccesible(depto),
                    ),
                  );
                  const huerfanosVisibles =
                    filtroAreaSelect === "TODAS"
                      ? puestosPorAreaYDepto.huerfanos.filter((rol) =>
                          moduloAccesible(getModuloForCronograma(rol)),
                        )
                      : [];

                  if (areasConPuestos.length === 0 && huerfanosVisibles.length === 0) {
                    return (
                      <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                        Sin cronogramas accesibles para tu rol.
                      </div>
                    );
                  }

                  return (
                    <>
                      {areasConPuestos.map((area, idx) => {
                        const deptosConPuestos = Array.from(
                          puestosPorAreaYDepto.tree[area].entries(),
                        ).filter(
                          ([depto, puestos]) =>
                            puestos.length > 0 && moduloAccesible(depto),
                        );
                        return (
                          <Fragment key={area}>
                            {idx > 0 && <SelectSeparator />}
                            <SelectGroup>
                              <SelectLabel
                                className={cn(
                                  "text-[10px] font-semibold uppercase tracking-wider",
                                  AREA_BADGE_CLASS[area],
                                )}
                              >
                                {AREA_LABEL[area]}
                              </SelectLabel>
                            </SelectGroup>
                            {deptosConPuestos.map(([depto, puestos]) => (
                              <SelectGroup key={depto}>
                                <SelectLabel className="pl-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {depto}
                                </SelectLabel>
                                {puestos.map((r) => (
                                  <SelectItem key={r} value={r} className="pl-6">
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </Fragment>
                        );
                      })}
                      {huerfanosVisibles.length > 0 && (
                        <>
                          {areasConPuestos.length > 0 && <SelectSeparator />}
                          <SelectGroup>
                            <SelectLabel className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200">
                              Sin departamento — asígnalo
                            </SelectLabel>
                            {huerfanosVisibles.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </>
                      )}
                    </>
                  );
                })()}
              </SelectContent>
            </Select>

            {rolActivo && (
              <Button
                type="button" variant="ghost" size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                onClick={handleDeleteRolCompleto}
                title={`Eliminar cronograma ${rolActivo}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {rolActivo && (() => {
            const area = areaForRol(rolActivo);
            return (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5",
                  AREA_BADGE_CLASS[area],
                )}
                title={`Área ${AREA_LABEL[area]}`}
              >
                Área · {AREA_LABEL[area]}
              </Badge>
            );
          })()}

          {rolActivo && (
            <div className="flex items-center gap-2 sm:ml-auto">
              {/* Toggle Tabla / Calendario */}
              <div className="inline-flex p-0.5 rounded-lg bg-muted/40 border">
                <button
                  type="button"
                  onClick={() => setVistaModo("TABLA")}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all",
                    vistaModo === "TABLA"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Vista tabla"
                >
                  <Table2 className="h-3.5 w-3.5" />
                  Tabla
                </button>
                <button
                  type="button"
                  onClick={() => setVistaModo("CALENDARIO")}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all",
                    vistaModo === "CALENDARIO"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Vista calendario"
                >
                  <CalendarRange className="h-3.5 w-3.5" />
                  Calendario
                </button>
              </div>

              <Button type="button" size="sm" onClick={handleAddMain} className="shadow-sm" disabled={isLoading}>
                <Plus className="h-4 w-4 mr-1.5" />
                Añadir Tarea
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* CONTENIDO */}
      <div id="table-scroll-container" className="flex-1 p-6 overflow-auto">
        {!rolActivo ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 opacity-20 mb-4" />
            <p className="mb-2">No hay ningún departamento disponible.</p>
          </div>
        ) : vistaModo === "CALENDARIO" ? (
          <CalendarioCronograma
            grupos={grupos}
            onTareaClick={(t) => setDetalle(t)}
          />
        ) : (
          <div className="w-full max-w-7xl mx-auto space-y-3">
            <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[1100px] border-collapse bg-card text-sm">
                <thead>
                  <tr className="bg-muted/20 text-muted-foreground uppercase text-xs tracking-wider border-b border-border/30 font-semibold">
                    <th className="py-4 px-3 w-[6%] text-center">ID</th>
                    <th className="py-4 px-4 text-left w-[36%]">Tarea a ejecutar</th>
                    {ORDERED_FREQUENCIES.map((f) => {
                      const isManual = f === "POR NECESIDAD";
                      return (
                        <th
                          key={f}
                          className={cn(
                            "py-4 px-2 text-center w-[10%]",
                            isManual && "border-l border-r border-dashed border-amber-300/50 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-950/15 text-amber-800 dark:text-amber-300",
                          )}
                        >
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {isManual && <Hand className="h-3 w-3" />}
                            <span>{f}</span>
                          </div>
                        </th>
                      );
                    })}
                    <th className="py-4 px-3 w-[10%] text-center bg-muted/30 border-l border-border/30 text-card-foreground">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        Sin tareas. Pulsa &quot;Añadir Tarea&quot;.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {grupos.map((g) => {
                        const isExpanded = expandedGroups[g.main.id] !== false;
                        const hasSubs = g.subs.length > 0;
                        const isPendingParent = pendingNew?.parentId === g.main.id;
                        return (
                          <Fragment key={g.main.id}>
                            {renderRow(g.main, false, hasSubs || isPendingParent)}
                            {isExpanded && (
                              <>
                                {hasSubs && g.subs.map((sub) => renderRow(sub, true, false))}
                                {isPendingParent && renderPendingRow(true)}
                              </>
                            )}
                          </Fragment>
                        );
                      })}
                      {pendingNew && !pendingNew.parentId && renderPendingRow(false)}
                    </>
                  )}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}
      </div>

      <NuevoPuestoDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        departamentos={departamentos}
        onCreate={handleCreatePuesto}
      />

      {/* DIALOG DETALLE TAREA */}
      {detalle && (
        <DetalleTareaDialog
          tarea={detalle}
          mode="edit"
          onClose={() => setDetalle(null)}
          onSubmitEdit={async (patch) => {
            if (!detalle.clave_tarea) {
              toast.error("Tarea sin clave_tarea — refresca la página.");
              return;
            }
            const claveTarea = detalle.clave_tarea;
            const tareaId = detalle.id;
            askEmpresasYEjecutar("editar", async (empresaIds) => {
              const res = await updateTareaMulti({
                claveTarea,
                empresaIds,
                patch,
              });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              if (typeof patch.resumen !== "undefined") {
                await updateCronogramaResumen(tareaId, patch.resumen ?? "");
              }
              toast.success("Cambios guardados");
              setDetalle(null);
            });
          }}
        />
      )}

      {/* DIALOG NUEVA TAREA (misma ficha en modo creación) */}
      {nuevaDraft && (
        <DetalleTareaDialog
          mode="create"
          tarea={{
            id: "__new__",
            rol: rolActivo,
            tarea: "",
            frecuencia: "OTRO",
            tiempo_requerido: "",
            id_visible: nuevaDraft.nextIdVisible,
            orden: nuevaDraft.nextOrden,
            parent_id: nuevaDraft.parentId,
          }}
          onClose={() => setNuevaDraft(null)}
          onSubmitCreate={async (payload) => {
            const draft = nuevaDraft;
            askEmpresasYEjecutar("crear", async (empresaIds) => {
              const res = await addTareaMulti({
                base: {
                  ...payload,
                  rol: rolActivo,
                  departamento: rolToDepartamento.get(rolActivo) ?? null,
                  parent_id: draft.parentId,
                  id_visible: draft.nextIdVisible,
                  orden: draft.nextOrden,
                },
                empresaIds,
                parentClaveTarea: draft.parentClaveTarea ?? undefined,
              });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("Tarea creada");
              setNuevaDraft(null);
            });
          }}
        />
      )}

      {pendingSelector && (
        <SelectorEmpresasDialog
          open
          onOpenChange={(v) => { if (!v) setPendingSelector(null); }}
          accion={pendingSelector.accion}
          onConfirm={async (ids) => {
            await pendingSelector.run(ids);
            setPendingSelector(null);
          }}
        />
      )}
    </div>
  );
}

/* ───────────── DETALLE DE TAREA (dialog con resumen + video) ───────────── */

function DetalleTareaDialog({
  tarea, mode, onClose, onSubmitCreate, onSubmitEdit,
}: {
  tarea: CronogramaOperativo;
  mode: "edit" | "create";
  onClose: () => void;
  /** En modo create: callback que recibe el payload ya armado. El parent decide en qué empresas crearlo. */
  onSubmitCreate?: (payload: Partial<CronogramaOperativo>) => Promise<void>;
  /** En modo edit: callback que recibe el patch. El parent decide en qué empresas aplicarlo. */
  onSubmitEdit?: (patch: Partial<CronogramaOperativo>) => Promise<void>;
}) {
  const isCreate = mode === "create";
  const [nombre, setNombre] = useState(tarea.tarea ?? "");
  const [resumen, setResumen] = useState(tarea.resumen ?? "");
  const [videoUrl, setVideoUrl] = useState(tarea.video_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [cal, setCal] = useState<{
    frecuencia: Frecuencia;
    dia_semana: number[] | null;
    dia_mes: number | null;
    fecha_anual: string | null;
    meses_trimestrales: number[] | null;
    tiempo_requerido: string;
    intervalo: number | null;
    termina_tipo: TerminaTipo | null;
    termina_fecha: string | null;
    termina_repeticiones: number | null;
    fecha_inicio: string | null;
  }>({
    frecuencia: tarea.frecuencia as Frecuencia,
    dia_semana: tarea.dia_semana ?? null,
    dia_mes: tarea.dia_mes ?? null,
    fecha_anual: tarea.fecha_anual ?? null,
    meses_trimestrales: tarea.meses_trimestrales ?? null,
    tiempo_requerido: tarea.tiempo_requerido ?? "",
    intervalo: tarea.intervalo ?? 1,
    termina_tipo: tarea.termina_tipo ?? null,
    termina_fecha: tarea.termina_fecha ?? null,
    termina_repeticiones: tarea.termina_repeticiones ?? null,
    fecha_inicio: tarea.fecha_inicio ?? null,
  });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSaveAll = async () => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      toast.error("La tarea necesita un nombre.");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<CronogramaOperativo> = {
        tarea: nombreLimpio,
        frecuencia: cal.frecuencia,
        dia_semana: cal.dia_semana,
        dia_mes: cal.dia_mes,
        fecha_anual: cal.fecha_anual,
        meses_trimestrales: cal.meses_trimestrales,
        tiempo_requerido: cal.tiempo_requerido,
        intervalo: cal.intervalo,
        termina_tipo: cal.termina_tipo,
        termina_fecha: cal.termina_fecha,
        termina_repeticiones: cal.termina_repeticiones,
        fecha_inicio: cal.fecha_inicio,
        resumen,
      };

      if (isCreate && onSubmitCreate) {
        await onSubmitCreate(payload);
      } else if (!isCreate && onSubmitEdit) {
        await onSubmitEdit(payload);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const res = await uploadCronogramaVideo(tarea.id, file.name, base64, file.type);
      if (!res.ok) { toast.error(res.error); return; }
      setVideoUrl(res.url);
      toast.success("Video subido");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoUrl) return;
    if (!confirm("¿Eliminar el video?")) return;
    const res = await deleteCronogramaVideo(tarea.id, videoUrl);
    if (!res.ok) { toast.error(res.error); return; }
    setVideoUrl("");
    toast.success("Video eliminado");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-10">
            {tarea.id_visible && (
              <Badge variant="outline" className="font-mono text-xs px-2 py-1 mt-1">
                ID {tarea.id_visible}
              </Badge>
            )}
            <div className="flex-1">
              <DialogTitle className="sr-only">
                {isCreate ? "Nueva tarea" : "Editar tarea"}
              </DialogTitle>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={isCreate ? "Nombre de la tarea…" : "Nombre de la tarea"}
                autoFocus={isCreate}
                className="text-lg font-semibold leading-tight border-0 border-b border-transparent focus-visible:border-primary focus-visible:ring-0 px-0 h-auto py-1 shadow-none"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            >
              {saving ? "Guardando…" : isCreate ? "Crear" : "Guardar"}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Metadatos */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground block">{tarea.departamento ? "Puesto · Departamento" : "Departamento"}</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {tarea.rol}
                  {tarea.departamento && (
                    <span className="text-muted-foreground font-normal"> · {tarea.departamento}</span>
                  )}
                </span>
                {(() => {
                  const area = getAreaForRol(tarea.departamento || tarea.rol);
                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0",
                        AREA_BADGE_CLASS[area],
                      )}
                    >
                      {AREA_LABEL[area]}
                    </Badge>
                  );
                })()}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground block">Calendario actual</span>
              <BadgesDiasTarea
                frecuencia={cal.frecuencia}
                dia_semana={cal.dia_semana}
                dia_mes={cal.dia_mes}
                fecha_anual={cal.fecha_anual}
                meses_trimestrales={cal.meses_trimestrales}
                intervalo={cal.intervalo}
                termina_tipo={cal.termina_tipo}
                termina_fecha={cal.termina_fecha}
                termina_repeticiones={cal.termina_repeticiones}
              />
            </div>
          </div>

          {/* Video formativo (compacto, arriba) — solo en modo edición */}
          {!isCreate && (
          <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            <div className="w-40 aspect-video rounded-md border bg-black/5 dark:bg-black/30 flex items-center justify-center overflow-hidden shrink-0">
              {videoUrl ? (
                <video src={videoUrl} controls className="w-full h-full object-contain" />
              ) : (
                <Video className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-sm font-bold flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5" /> Video formativo
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                {videoUrl ? "Vídeo cargado." : "Sube un vídeo corto para formar al equipo."}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant={videoUrl ? "outline" : "default"}
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="gap-1.5 h-7 text-xs"
                >
                  <Upload className="h-3 w-3" />
                  {uploading ? "Subiendo…" : videoUrl ? "Reemplazar" : "Subir"}
                </Button>
                {videoUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeleteVideo}
                    className="gap-1 h-7 text-xs text-destructive"
                  >
                    <X className="h-3 w-3" /> Quitar
                  </Button>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Calendario / Frecuencia */}
          <div className="rounded-lg border bg-card p-4">
            <Label className="text-sm font-bold mb-3 block">Programación</Label>
            <SelectorDiasTarea
              frecuencia={cal.frecuencia}
              dia_semana={cal.dia_semana}
              dia_mes={cal.dia_mes}
              fecha_anual={cal.fecha_anual}
              meses_trimestrales={cal.meses_trimestrales}
              tiempo_requerido={cal.tiempo_requerido}
              intervalo={cal.intervalo}
              termina_tipo={cal.termina_tipo}
              termina_fecha={cal.termina_fecha}
              termina_repeticiones={cal.termina_repeticiones}
              fecha_inicio={cal.fecha_inicio}
              onChange={(patch) => setCal((prev) => ({ ...prev, ...patch }))}
            />
          </div>

          {/* Resumen */}
          <div>
            <Label className="text-sm font-bold mb-2 block">Resumen</Label>
            <Textarea
              value={resumen}
              onChange={(e) => setResumen(e.target.value)}
              placeholder="Describe brevemente esta tarea: qué hacer, cuándo, qué considerar…"
              rows={5}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── NUEVO PUESTO (departamento → puesto, área derivada) ───────────── */

function NuevoPuestoDialog({
  open,
  onOpenChange,
  departamentos,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departamentos: DepartamentoRow[];
  onCreate: (puesto: string, departamentoNombre: string) => Promise<void>;
}) {
  const [departamentoId, setDepartamentoId] = useState<string>("");
  const [puesto, setPuesto] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDepartamentoId("");
      setPuesto("");
    }
  }, [open]);

  const departamentoSel = departamentos.find((d) => d.id === departamentoId) ?? null;

  const grupos = useMemo(() => {
    const op: DepartamentoRow[] = [];
    const ad: DepartamentoRow[] = [];
    for (const d of departamentos) {
      if (d.area === "OPERATIVA") op.push(d);
      else ad.push(d);
    }
    op.sort((a, b) => a.nombre.localeCompare(b.nombre));
    ad.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return { OPERATIVA: op, ADMINISTRATIVA: ad };
  }, [departamentos]);

  const puedeCrear = !!departamentoSel && puesto.trim().length > 0 && !saving;

  const submit = async () => {
    if (!departamentoSel || !puesto.trim()) return;
    setSaving(true);
    try {
      await onCreate(puesto.trim().toUpperCase(), departamentoSel.nombre);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear un nuevo cronograma</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label>Departamento</Label>
            <Select value={departamentoId} onValueChange={setDepartamentoId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecciona el departamento" />
              </SelectTrigger>
              <SelectContent>
                {grupos.OPERATIVA.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className={cn("text-[10px] font-semibold uppercase tracking-wider", AREA_BADGE_CLASS.OPERATIVA)}>
                      {AREA_LABEL.OPERATIVA}
                    </SelectLabel>
                    {grupos.OPERATIVA.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {grupos.OPERATIVA.length > 0 && grupos.ADMINISTRATIVA.length > 0 && <SelectSeparator />}
                {grupos.ADMINISTRATIVA.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className={cn("text-[10px] font-semibold uppercase tracking-wider", AREA_BADGE_CLASS.ADMINISTRATIVA)}>
                      {AREA_LABEL.ADMINISTRATIVA}
                    </SelectLabel>
                    {grupos.ADMINISTRATIVA.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>

            {departamentoSel && (
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5",
                    AREA_BADGE_CLASS[departamentoSel.area as AreaCronograma],
                  )}
                >
                  Área · {AREA_LABEL[departamentoSel.area as AreaCronograma]}
                </Badge>
              </div>
            )}
          </div>

          <div>
            <Label>Nombre del puesto</Label>
            <Input
              value={puesto}
              onChange={(e) => setPuesto(e.target.value.toUpperCase())}
              className="mt-2"
              placeholder="Ej. COCTELERO"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && puedeCrear) submit();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={!puedeCrear}>{saving ? "Creando…" : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
