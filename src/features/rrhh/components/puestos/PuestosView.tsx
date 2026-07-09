"use client";

import { useState, useMemo, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useTabQuery } from "@/shared/hooks/use-tab-query";
import { type PuestoSalarial, type NormaSalarial, NORMAS_BASE, DEPARTAMENTOS_DISPONIBLES } from "@/features/rrhh/data/puestos";
import { listPuestosEmpresa } from "@/features/rrhh/actions/puestos-actions";
import { crearCronogramaParaPuesto } from "@/features/rrhh/actions/vacantes-actions";
import { getCursoDePuesto } from "@/features/formacion/actions/formacion-actions";
import { listBonusEmpresa, togglePuestoBonus } from "@/features/rrhh/actions/bonus-actions";
import { getHorarioPuesto, type PatronElegible } from "@/features/rrhh/actions/puesto-horario-actions";
import type { Turno } from "@/features/rrhh/data/horarios";
import type { Bonus } from "@/features/rrhh/data/bonus";
import { PERIODICIDAD_LABEL } from "@/features/rrhh/data/bonus";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, Plus, Settings, Settings2, Euro, Clock, Calendar,
  Briefcase, ChevronRight, Target, FileText, Pencil, ListChecks,
  UtensilsCrossed, ChefHat, Crown, User, Package, Camera, Calculator,
  CheckCircle2, Scale, Users, Gift, Loader2, GraduationCap,
} from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { puestosIO } from "@/features/rrhh/io/puestos.io";
import { PuestoSalarioDialog } from "./PuestoSalarioDialog";
import { PuestoHorarioDialog } from "./PuestoHorarioDialog";

const estadoBadge = (e: string) => {
  switch (e) {
    case "activo": return <Badge className="bg-emerald-100 text-emerald-700 border-0 hover:bg-emerald-100">Activo</Badge>;
    case "borrador": return <Badge className="bg-amber-100 text-amber-700 border-0 hover:bg-amber-100">Borrador</Badge>;
    default: return <Badge variant="secondary" className="hover:bg-secondary">Inactivo</Badge>;
  }
};

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

// ─── Áreas (misma visual que Cronogramas en Dirección) ──────────
type AreaPuesto = "OPERATIVA" | "ADMINISTRATIVA";

const AREA_LABEL: Record<AreaPuesto, string> = {
  OPERATIVA: "Operativa",
  ADMINISTRATIVA: "Administrativa",
};

const AREA_BADGE_CLASS: Record<AreaPuesto, string> = {
  OPERATIVA: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ADMINISTRATIVA: "bg-sky-100 text-sky-700 border-sky-200",
};

function normDepto(d: string): string {
  return d.toUpperCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Departamentos operativos (equipo en local). El resto es administrativo.
// Nombres normalizados sin tildes (ver normDepto).
const DEPTOS_OPERATIVOS = new Set([
  "SALA", "COCINA", "ARTISTAS", "ARTISTA", "MANTENIMIENTO",
  "OPERACIONES", "ENTRETENIMIENTO",
]);

function getAreaForDepto(depto: string): AreaPuesto {
  return DEPTOS_OPERATIVOS.has(normDepto(depto)) ? "OPERATIVA" : "ADMINISTRATIVA";
}

// Mapeo visual departamento → icono + colores (alineado con Cronogramas/sidebar).
const DEPTO_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  "DIRECTOR":       { icon: Crown,           color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  "DIRECCION":      { icon: Crown,           color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  "GERENCIA":       { icon: Briefcase,       color: "text-rose-600",   bg: "bg-rose-50 border-rose-200" },
  "RR.HH":          { icon: User,            color: "text-pink-600",   bg: "bg-pink-50 border-pink-200" },
  "RRHH":           { icon: User,            color: "text-pink-600",   bg: "bg-pink-50 border-pink-200" },
  "CALIDAD":        { icon: CheckCircle2,    color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  "CONTABILIDAD":   { icon: Calculator,      color: "text-teal-600",   bg: "bg-teal-50 border-teal-200" },
  "LOGISTICA":      { icon: Package,         color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  "MARKETING":      { icon: Camera,          color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  "GESTORIA":       { icon: FileText,        color: "text-sky-600",    bg: "bg-sky-50 border-sky-200" },
  "JURIDICO":       { icon: Scale,           color: "text-fuchsia-600", bg: "bg-fuchsia-50 border-fuchsia-200" },
  "SALA":           { icon: UtensilsCrossed, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  "COCINA":         { icon: ChefHat,         color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  "ARTISTAS":       { icon: Users,           color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  "ARTISTA":        { icon: Users,           color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  "MANTENIMIENTO":  { icon: Package,         color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  "OPERACIONES":    { icon: Users,           color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  "ENTRETENIMIENTO":{ icon: Users,           color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
};

function getDeptoConfig(depto: string) {
  // Se conserva el icono por departamento, pero el recuadro usa un color
  // neutro uniforme para todos (sin colores por departamento).
  const base = DEPTO_CONFIG[normDepto(depto)] ?? { icon: Briefcase };
  return {
    icon: base.icon,
    color: "text-muted-foreground",
    bg: "bg-card border-border",
  };
}

export function PuestosView() {
  const { empresaActual } = useEmpresa();
  const [data, setData] = useState<{ puestos: PuestoSalarial[]; normas: NormaSalarial[] }>(
    { puestos: [], normas: NORMAS_BASE },
  );
  const reload = useCallback(() => {
    listPuestosEmpresa().then(setData);
  }, []);
  useEffect(() => {
    let activo = true;
    listPuestosEmpresa().then((res) => { if (activo) setData(res); });
    return () => { activo = false; };
  }, [empresaActual.id]);

  type View = "list" | "detail" | "config";
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = data.puestos.find((p) => p.id === selectedId) ?? null;

  if (view === "detail" && selected) return <DetalleView puesto={selected} onBack={() => setView("list")} onChanged={reload} />;
  if (view === "config") return <ConfigView puestos={data.puestos} normas={data.normas} onBack={() => setView("list")} />;

  return (
    <ListView
      puestos={data.puestos}
      onDetail={(id) => { setSelectedId(id); setView("detail"); }}
      onConfig={() => setView("config")}
      onChanged={reload}
      empresaId={empresaActual.id}
    />
  );
}

function ListView({
  puestos,
  onDetail,
  onConfig,
  onChanged,
  empresaId,
}: {
  puestos: PuestoSalarial[];
  onDetail: (id: string) => void;
  onConfig: () => void;
  onChanged: () => void;
  empresaId: string;
}) {
  const router = useRouter();
  const [pendingCronoId, setPendingCronoId] = useState<string | null>(null);
  const [, startCronoTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPuesto, setEditingPuesto] = useState<PuestoSalarial | null>(null);
  const [horarioOpen, setHorarioOpen] = useState(false);
  const [horarioPuesto, setHorarioPuesto] = useState<PuestoSalarial | null>(null);

  // Cronograma del puesto (uno por puesto): si no existe lo crea y abre la
  // pantalla de cronogramas DIRECTAMENTE en el cronograma de este puesto
  // (vía ?rol=). Idempotente.
  const irAlCronograma = (p: PuestoSalarial) => {
    const abrir = (rol: string) =>
      router.push(`/direccion/cronogramas?rol=${encodeURIComponent(rol)}`);
    if (p.tieneCronograma) {
      abrir(p.puesto);
      return;
    }
    setPendingCronoId(p.id);
    startCronoTransition(async () => {
      const res = await crearCronogramaParaPuesto(p.id);
      setPendingCronoId(null);
      if (res.ok) {
        toast.success(res.yaExistia ? "Ese puesto ya tenía cronograma" : `Cronograma creado para ${p.puesto}`);
        onChanged();
        abrir(res.rol ?? p.puesto);
      } else {
        toast.error(res.error ?? "No se pudo crear el cronograma");
      }
    });
  };

  // Formación del puesto (1 puesto = 1 curso): abre el curso de este puesto.
  // Si el curso no existe todavía, la acción lo crea al vuelo.
  const [pendingFormId, setPendingFormId] = useState<string | null>(null);
  const irAFormacion = async (p: PuestoSalarial) => {
    setPendingFormId(p.id);
    const res = await getCursoDePuesto(p.id);
    setPendingFormId(null);
    if (res.ok && res.cursoId) {
      router.push(`/rrhh/formacion/curso/${res.cursoId}`);
    } else {
      toast.error(res.error ?? "No se pudo abrir la formación");
    }
  };

  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [filtroArea, setFiltroArea] = useState<AreaPuesto>("OPERATIVA");

  const acceso = (p: PuestoSalarial, campo: string): unknown => {
    if (campo === "departamento") return p.departamento;
    if (campo === "jornada") return p.jornadaContrato;
    if (campo === "estado") return p.estado === "activo" ? "Activo" : p.estado === "borrador" ? "Borrador" : "Inactivo";
    if (campo === "salarioBruto") return p.salarioBruto;
    if (campo === "horasSemanales") return p.horasSemanales;
    if (campo === "puesto") return p.puesto;
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let lista = puestos.filter((p) => {
      if (busqueda && !`${p.puesto} ${p.departamento}`.toLowerCase().includes(busqueda.toLowerCase())) return false;
      return true;
    });
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [puestos, busqueda, filtros, orden]);

  // Recuento por área (solo cuenta lo que pasa por búsqueda/filtros).
  const areaCounts = useMemo(() => ({
    OPERATIVA: filtered.filter((p) => getAreaForDepto(p.departamento) === "OPERATIVA").length,
    ADMINISTRATIVA: filtered.filter((p) => getAreaForDepto(p.departamento) === "ADMINISTRATIVA").length,
  }), [filtered]);

  // Puestos del área activa, ordenados por departamento y nombre.
  const puestosArea = useMemo(() => (
    filtered
      .filter((p) => getAreaForDepto(p.departamento) === filtroArea)
      .sort((a, b) =>
        a.departamento.localeCompare(b.departamento) || a.puesto.localeCompare(b.puesto),
      )
  ), [filtered, filtroArea]);

  const filtros_columnasDef: ToolbarColumna[] = [
    { campo: "puesto", label: "Puesto", bloqueada: true },
    { campo: "salarioBruto", label: "Salario bruto" },
    { campo: "jornada", label: "Jornada" },
    { campo: "horasSemanales", label: "Horas/sem" },
    { campo: "estado", label: "Estado" },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-muted/20">
      {/* Selector de áreas — mutuamente excluyente (igual que Cronogramas) */}
      <div className="flex items-center gap-2 px-4 md:px-6 pt-3 flex-wrap">
        {(["OPERATIVA", "ADMINISTRATIVA"] as const).map((opt) => {
          const active = filtroArea === opt;
          // Ambas áreas se muestran siempre, aunque estén vacías.
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
              {AREA_LABEL[opt]}
              <Badge variant="secondary" className="text-[10px] ml-1">
                {areaCounts[opt]}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* BARRA HORIZONTAL 1 */}
      <div className="px-4 md:px-6 pt-3 pb-3 border-b bg-card">
        <SubmoduleToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          placeholderBusqueda="Buscar"
          onNuevo={() => { setEditingPuesto(null); setDialogOpen(true); }}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          orden={orden}
          onOrdenChange={setOrden}
          columnas={filtros_columnasDef}
          extraDerecha={
            <>
              <IOActions
                config={puestosIO}
                context={{ empresaId }}
                onSuccess={() => window.location.reload()}
              />
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9"
                onClick={onConfig}
                title="Configuración"
                aria-label="Configuración"
              >
                <Settings className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </>
          }
        />
      </div>

      {/* Grid de recuadros — un recuadro por puesto */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {puestosArea.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">
            <p className="mb-3">No hay puestos en el área seleccionada.</p>
            <Button variant="primary" size="lg" onClick={() => { setEditingPuesto(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Nuevo puesto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {puestosArea.map((p) => {
              const area = getAreaForDepto(p.departamento);
              const { icon: Icon, color, bg } = getDeptoConfig(p.departamento);
              return (
                <Card
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onDetail(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onDetail(p.id);
                    }
                  }}
                  className={`p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 group border ${bg}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2.5 rounded-lg bg-white ${color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex items-center gap-1">
                      {estadoBadge(p.estado)}
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0 mb-1.5 ${AREA_BADGE_CLASS[area]}`}
                  >
                    {AREA_LABEL[area]} · {p.departamento}
                  </Badge>
                  <h3 className="font-bold text-base uppercase tracking-wide mb-0.5 flex items-center gap-2">
                    {p.puesto}
                    {p.nivelesCount > 1 && (
                      <Badge variant="secondary" className="text-[10px] normal-case font-medium">
                        {p.nivelesCount} niveles
                      </Badge>
                    )}
                  </h3>
                  <p className="text-lg font-bold text-foreground mb-3">{eur(p.salarioBruto)}<span className="text-xs font-normal text-muted-foreground"> bruto/mes</span></p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4">
                    <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {p.jornadaContrato}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {p.horasSemanales}h/sem</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {p.diasLibres} libres</span>
                  </div>

                  {/* Acciones — no propagan el click de la card */}
                  <div className="flex flex-wrap gap-1 pt-3 border-t border-black/5">
                    <Button
                      variant="ghost" size="sm" className="h-8 px-2"
                      onClick={(e) => { e.stopPropagation(); setEditingPuesto(p); setDialogOpen(true); }}
                    >
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-8 px-2"
                      onClick={(e) => { e.stopPropagation(); setHorarioPuesto(p); setHorarioOpen(true); }}
                    >
                      <Calendar className="h-4 w-4 mr-1" /> Horario
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-8 px-2"
                      onClick={(e) => { e.stopPropagation(); irAlCronograma(p); }}
                      disabled={pendingCronoId === p.id}
                      title={p.tieneCronograma ? "Ver el cronograma del puesto" : "Crear el cronograma del puesto"}
                    >
                      <ListChecks className={`h-4 w-4 mr-1 ${p.tieneCronograma ? "text-emerald-600" : "text-muted-foreground"}`} />
                      Cronograma
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-8 px-2"
                      onClick={(e) => { e.stopPropagation(); irAFormacion(p); }}
                      disabled={pendingFormId === p.id}
                      title="Ver la formación de este puesto"
                    >
                      {pendingFormId === p.id
                        ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        : <GraduationCap className="h-4 w-4 mr-1 text-violet-600" />}
                      Formación
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <PuestoSalarioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingPuesto}
        onSaved={onChanged}
      />

      <PuestoHorarioDialog
        open={horarioOpen}
        onOpenChange={setHorarioOpen}
        puesto={horarioPuesto}
      />
    </div>
  );
}

// Apartado "Bonus" dentro de la ficha del puesto. Lee/escribe el mismo vínculo
// (rrhh_bonus_puestos) que el apartado "¿A qué puestos aplica?" de Bonus, por lo
// que ambos lados quedan siempre sincronizados.
function BonusDelPuesto({ puestoId }: { puestoId: string }) {
  const [bonus, setBonus] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    listBonusEmpresa().then((list) => {
      if (activo) { setBonus(list); setLoading(false); }
    });
    return () => { activo = false; };
  }, [puestoId]);

  const toggle = async (b: Bonus) => {
    const aplica = b.puestoIds.includes(puestoId);
    setPendingId(b.id);
    // Optimista.
    setBonus((prev) => prev.map((x) => x.id === b.id
      ? { ...x, puestoIds: aplica ? x.puestoIds.filter((id) => id !== puestoId) : [...x.puestoIds, puestoId] }
      : x));
    const res = await togglePuestoBonus(puestoId, b.id, !aplica);
    setPendingId(null);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo actualizar el bonus");
      // Revertir.
      setBonus((prev) => prev.map((x) => x.id === b.id
        ? { ...x, puestoIds: aplica ? [...x.puestoIds, puestoId] : x.puestoIds.filter((id) => id !== puestoId) }
        : x));
    } else {
      toast.success(!aplica ? `Bonus "${b.nombre}" añadido al puesto` : `Bonus "${b.nombre}" quitado del puesto`);
    }
  };

  const aplicados = bonus.filter((b) => b.puestoIds.includes(puestoId));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> Bonus del puesto</CardTitle>
        <CardDescription>
          Bonus que recibe este puesto. Ligado al módulo de Bonus: marcar o desmarcar aquí también se refleja allí.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin mr-2" />Cargando bonus…</div>
        ) : bonus.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay bonus configurados en esta empresa.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Aplican a este puesto {aplicados.length > 0 && <span>({aplicados.length})</span>}
              </p>
              {aplicados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún bonus asignado todavía. Marca los que apliquen abajo.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {aplicados.map((b) => (
                    <Badge key={b.id} className="gap-1 py-1">
                      <Gift className="h-3 w-3" />{b.nombre}
                      <span className="opacity-70">· {PERIODICIDAD_LABEL[b.periodicidad]}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Todos los bonus de la empresa</p>
              <div className="space-y-1.5">
                {bonus.map((b) => {
                  const aplica = b.puestoIds.includes(puestoId);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggle(b)}
                      disabled={pendingId === b.id}
                      className={`w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${aplica ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50"}`}
                    >
                      <span className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${aplica ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {pendingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : aplica ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Gift className="h-3.5 w-3.5" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="text-sm font-medium block truncate">{b.nombre || "Bonus sin nombre"}</span>
                        <span className="text-xs text-muted-foreground block truncate">{b.tipo || "—"} · {PERIODICIDAD_LABEL[b.periodicidad]}</span>
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">{aplica ? "Aplicado" : "Añadir"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Horario del puesto dentro de la ficha: muestra el patrón seleccionado en
// Horarios (nombre + su semana). Es la misma fuente que el diálogo "Horario".
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function HorarioDelPuesto({ puestoId }: { puestoId: string }) {
  const [patron, setPatron] = useState<PatronElegible | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    getHorarioPuesto(puestoId).then((res) => {
      if (!activo) return;
      setTurnos(res.turnos);
      setPatron(res.patrones.find((p) => p.familiaId === res.familiaSeleccionada) ?? null);
      setLoading(false);
    });
    return () => { activo = false; };
  }, [puestoId]);

  const turnoById = useMemo(() => {
    const m = new Map<string, Turno>();
    turnos.forEach((t) => m.set(t.id, t));
    return m;
  }, [turnos]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Horario del puesto</CardTitle>
        <CardDescription>
          {patron ? `Horario "${patron.nombre}" (creado en Horarios). Se hereda al empleado que se contrate para este puesto.` : "Horario que se hereda al empleado. Se elige con el botón Horario, entre los creados en Horarios."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground py-2"><Loader2 className="h-4 w-4 animate-spin mr-2" />Cargando horario…</div>
        ) : !patron ? (
          <p className="text-sm text-muted-foreground">Sin horario asignado. Usa el botón «Horario» en la lista de puestos para elegir uno.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {DIAS_SEMANA.map((d) => <TableHead key={d} className="text-center">{d}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                {patron.dias.map((turnoId, i) => {
                  const t = turnoId ? turnoById.get(turnoId) : null;
                  return (
                    <TableCell key={i} className="text-center">
                      {t ? (
                        <Badge className="border-0 text-white" style={{ backgroundColor: t.colorHex }}>{t.codigo}</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">LIBRE</Badge>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function DetalleView({ puesto, onBack, onChanged }: { puesto: PuestoSalarial; onBack: () => void; onChanged: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [horarioOpen, setHorarioOpen] = useState(false);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-base font-semibold text-foreground">{puesto.puesto}</h2>
          <p className="text-muted-foreground text-sm">Departamento: {puesto.departamento}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {estadoBadge(puesto.estado)}
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setHorarioOpen(true)}>
            <Calendar className="h-4 w-4 mr-1" /> Horario
          </Button>
          <Button variant="primary" size="sm" className="h-8" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Editar condiciones
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Salario bruto", value: eur(puesto.salarioBruto), icon: Euro, color: "text-primary bg-primary/10" },
          { label: "Jornada", value: puesto.jornadaContrato || "—", icon: Briefcase, color: "text-amber-600 bg-amber-500/10" },
          { label: "Horas/semana", value: `${puesto.horasSemanales}h`, icon: Clock, color: "text-emerald-600 bg-emerald-500/10" },
          { label: "Vacaciones", value: puesto.vacaciones || "—", icon: Calendar, color: "text-blue-600 bg-blue-500/10" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {puesto.descripcion && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Descripción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{puesto.descripcion}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Condiciones del puesto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Euro className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Salario bruto</p>
                <p className="font-medium">{eur(puesto.salarioBruto)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Jornada de contrato</p>
                <p className="font-medium">{puesto.jornadaContrato || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Horas / semana</p>
                <p className="font-medium">{puesto.horasSemanales}h / semana</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Días libres</p>
                <p className="font-medium">{puesto.diasLibres} días / semana</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Vacaciones</p>
                <p className="font-medium">{puesto.vacaciones || "—"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos de gestoría</CardTitle>
          <CardDescription>Se envían a la gestoría al dar de alta al empleado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Convenio colectivo</p>
                <p className="font-medium">{puesto.convenioColectivo || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Tipo de contrato</p>
                <p className="font-medium capitalize">{puesto.tipoContratoDefecto || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Grupo / categoría</p>
                <p className="font-medium">{puesto.grupoCategoriaProf || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Epígrafe / cotización</p>
                <p className="font-medium">{puesto.epigrafeCotizacion || "—"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <HorarioDelPuesto puestoId={puesto.id} />

      {puesto.observaciones && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{puesto.observaciones}</p>
          </CardContent>
        </Card>
      )}

      {puesto.objetivos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" /> Objetivos y crecimiento
            </CardTitle>
            <CardDescription>Objetivos de referencia para este puesto</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {puesto.objetivos.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <BonusDelPuesto puestoId={puesto.id} />

      <p className="text-xs text-muted-foreground text-right">Última actualización: {puesto.updatedAt}</p>

      <PuestoSalarioDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={puesto}
        onSaved={onChanged}
      />
      <PuestoHorarioDialog
        open={horarioOpen}
        onOpenChange={setHorarioOpen}
        puesto={puesto}
      />
    </div>
  );
}

function ConfigView({ puestos, normas, onBack }: { puestos: PuestoSalarial[]; normas: NormaSalarial[]; onBack: () => void }) {
  const [tab, setTab] = useTabQuery(["puestos", "departamentos", "normas"] as const, "puestos");

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-base font-semibold text-foreground">Configuración de puestos</h2>
          <p className="text-muted-foreground text-sm">Gestión de departamentos, puestos y condiciones</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "puestos" | "departamentos" | "normas")}>
        <TabsList>
          <TabsTrigger value="puestos">Puestos</TabsTrigger>
          <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
          <TabsTrigger value="normas">Normas</TabsTrigger>
        </TabsList>

        <TabsContent value="puestos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Todos los puestos</CardTitle>
              <Button variant="primary" size="sm"><Plus className="h-4 w-4" />Nuevo</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Puesto</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="text-right">Salario bruto</TableHead>
                    <TableHead className="text-center">Jornada</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {puestos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.puesto}</TableCell>
                      <TableCell>{p.departamento}</TableCell>
                      <TableCell className="text-right">{eur(p.salarioBruto)}</TableCell>
                      <TableCell className="text-center">{p.jornadaContrato}</TableCell>
                      <TableCell className="text-center">{estadoBadge(p.estado)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm"><Settings2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departamentos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Departamentos disponibles</CardTitle>
              <Button variant="primary" size="sm"><Plus className="h-4 w-4" />Nuevo</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DEPARTAMENTOS_DISPONIBLES.map((d) => {
                  const count = puestos.filter((p) => p.departamento === d).length;
                  return (
                    <div key={d} className="border rounded-lg p-3 flex items-center justify-between">
                      <span className="font-medium text-sm">{d}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="normas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Normas y cláusulas</CardTitle>
              <Button variant="primary" size="sm"><Plus className="h-4 w-4" />Nuevo</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {normas.map((n) => (
                <div key={n.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-sm">{n.titulo}</h4>
                    <Button variant="ghost" size="sm"><Settings2 className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.descripcion}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

