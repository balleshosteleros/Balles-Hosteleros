"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { listVacantesConCandidatos, asegurarVacantesPorPuesto } from "@/features/rrhh/actions/reclutamiento-actions";
import {
  publicarVacante, despublicarVacante, reordenarVacantes,
} from "@/features/rrhh/actions/vacantes-actions";
import { moverCandidatoFase, moverCandidatoAVacante } from "@/features/rrhh/actions/candidatos-actions";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  contarCandidatosPorFase,
  getFasePrincipal,
  FASES_PRINCIPALES,
  FASES_PRINCIPALES_ORDER,
  ESTADOS_CONFIG,
  ESTADOS_CONFIG as FASES_CONFIG,
  FASES_ORDER,
  ESTADO_PUBLICACION_LABELS,
  ORIGEN_LABELS,
  type Vacante,
  type Candidato,
  type FaseReclutamiento,
  type FasePrincipal,
  type EstadoReclutamiento,
} from "@/features/rrhh/data/reclutamiento";
import { KanbanPipeline } from "@/features/rrhh/components/reclutamiento/KanbanPipeline";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, MoreHorizontal, MapPin, Clock, CalendarDays,
  FileText, Users, Send, ArrowLeft, User, Phone, Mail, Tag, Kanban, List,
  Pencil, Utensils, Building2, Settings, Check,
  GripVertical, TrendingUp,
} from "lucide-react";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";
import { ReclutamientoConfigView } from "@/features/rrhh/components/reclutamiento/config/ReclutamientoConfigView";
import { CandidatosRealesTab } from "@/features/rrhh/components/reclutamiento/CandidatosRealesTab";
import { OfertaFormDialog } from "@/features/rrhh/components/reclutamiento/OfertaFormDialog";
import { CandidatoDetailModal } from "@/features/rrhh/components/reclutamiento/CandidatoDetailModal";
import { PromocionInternaDialog } from "@/features/rrhh/components/reclutamiento/PromocionInternaDialog";
import { FunnelMetrics } from "@/features/rrhh/components/reclutamiento/FunnelMetrics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Vacancy Card ────────────────────────────────────────────────
interface VacanteCardProps {
  vacante: Vacante & { visiblePublicamente?: boolean };
  onSelectFase: (v: Vacante, f: FaseReclutamiento | null) => void;
  onPublicar?: (id: string) => void;
  onDespublicar?: (id: string) => void;
  onEditar?: (v: Vacante) => void;
  /** Asa de arrastre (drag & drop). Solo se pinta si se pasa. */
  dragHandle?: React.ReactNode;
}

function VacanteCard({
  vacante, onSelectFase,
  onPublicar, onDespublicar, onEditar, dragHandle,
}: VacanteCardProps) {
  // Los candidatos inactivos no cuentan en la vista principal (no generan ruido);
  // se conservan y siguen visibles en el listado de Candidatos.
  const counts = contarCandidatosPorFase(vacante.candidatos.filter((c) => c.activo !== false));
  const visiblePublicamente = !!vacante.visiblePublicamente;
  const estaPublicada = vacante.estadoPublicacion === "publicada";
  // En el portal de empleo solo aparece si está publicada Y visible.
  const enPortal = estaPublicada && visiblePublicamente;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          {dragHandle}
          <h3
            className="text-base font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
            onClick={() => onSelectFase(vacante, null)}
          >
            {vacante.puesto}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Botón toggle único: blanco "Publicar" ↔ verde "Publicada".
              Publicar = aparece en el portal de empleo; siempre conmuta en ambas direcciones. */}
          {enPortal ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onDespublicar?.(vacante.id)}
              disabled={!onDespublicar}
              className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Check className="h-3.5 w-3.5" /> Publicada
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onPublicar?.(vacante.id)}
              disabled={!onPublicar}
              className="h-8 gap-1.5"
            >
              <Send className="h-3.5 w-3.5" /> Publicar
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {onEditar && (
                <DropdownMenuItem onClick={() => onEditar(vacante)}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onSelectFase(vacante, null)}>
                <Users className="h-4 w-4 mr-2" /> Ver candidatos
              </DropdownMenuItem>
              {/* Las vacantes NO se borran aquí: son espejo del puesto activo
                  (se regenerarían). Se gestionan desde Puestos. */}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Las 4 fases se reparten el ancho por igual (flex-1 + basis-0); dentro,
            los 4 estados también. min-h uniforme en cada estado para que las
            etiquetas largas (p. ej. «Suspenso Formación», «Ex-empleados») no hagan
            que unos recuadros crezcan más que otros. */}
        <div className="flex gap-2 overflow-x-auto">
          {FASES_PRINCIPALES_ORDER.map((fp) => {
            const fpCfg = FASES_PRINCIPALES[fp];
            const fpCount = fpCfg.estados.reduce((sum, e) => sum + (counts[e] || 0), 0);
            return (
              <div key={fp} className="flex-1 basis-0 min-w-0">
                <div className="h-1.5 rounded-t" style={{ background: `linear-gradient(90deg, ${fpCfg.colorFrom}, ${fpCfg.colorTo})` }} />
                <div className="border border-t-0 border-border rounded-b-lg p-1.5 bg-muted/20">
                  <div className="text-[9px] font-semibold text-foreground uppercase tracking-wider text-center mb-1">{fpCfg.label} ({fpCount})</div>
                  <div className="flex items-stretch gap-1">
                    {fpCfg.estados.map((estado) => {
                      const estCfg = ESTADOS_CONFIG[estado];
                      const count = counts[estado] || 0;
                      return (
                        <button
                          key={estado}
                          onClick={() => count > 0 ? onSelectFase(vacante, estado) : undefined}
                          className={`flex-1 basis-0 min-w-0 flex flex-col items-center justify-start rounded border border-border p-1.5 min-h-[52px] transition-all ${count > 0 ? "hover:border-primary/40 hover:shadow-sm cursor-pointer" : "opacity-50 cursor-default"}`}
                        >
                          <span className="text-sm font-bold text-foreground">{count}</span>
                          {/* Alto fijo (2 líneas) para que las etiquetas largas
                              («Suspenso Formación», «No se presenta», «Ex-empleados»)
                              no agranden los recuadros de Offboarding/Descartado
                              frente a los de etiqueta corta. */}
                          <span className="flex h-6 items-center text-[9px] leading-tight text-muted-foreground text-center font-medium line-clamp-2">{estCfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-5 py-3 bg-muted/30 border-t border-border text-xs text-muted-foreground">
        {vacante.tipoJornada && (
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{vacante.tipoJornada}</span>
        )}
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{vacante.fechaCreacion}</span>
        {vacante.cuestionario && <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />Cuestionario</span>}
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{vacante.reclutadores.join(", ")}</span>
      </div>
    </Card>
  );
}

// ─── Vacancy Card arrastrable (drag & drop para fijar el orden) ──
// El orden manual se persiste en `vacantes.orden` y el portal público
// (/empleo) muestra las ofertas en este mismo orden.
function SortableVacanteCard(props: VacanteCardProps & { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative",
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <VacanteCard
        {...props}
        dragHandle={
          <button
            type="button"
            className="shrink-0 -ml-1 flex h-7 w-7 items-center justify-center rounded-md cursor-grab touch-none text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label="Arrastrar para reordenar"
            title="Arrastra para reordenar"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        }
      />
    </div>
  );
}

// ─── All Candidates Tab ─────────────────────────────────────────
// Vista de "todos los candidatos" preparada pero aún no enlazada en la UI.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AllCandidatosView({ vacantes }: { vacantes: Vacante[] }) {
  const [search, setSearch] = useState("");
  const [selectedCandidato, setSelectedCandidato] = useState<Candidato | null>(null);

  const allCandidatos = useMemo(() => vacantes.flatMap((v) => v.candidatos.map((c) => ({ ...c, puesto: v.puesto }))), [vacantes]);

  const filtered = useMemo(() => {
    if (!search) return allCandidatos;
    const s = search.toLowerCase();
    return allCandidatos.filter((c) => `${c.nombre} ${c.apellidos} ${c.email} ${c.puesto}`.toLowerCase().includes(s));
  }, [allCandidatos, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar candidato..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidato</TableHead>
              <TableHead>Vacante</TableHead>
              <TableHead>Fase</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Reclutador</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCandidato(c)}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">{c.nombre[0]}{c.apellidos[0]}</div>
                    <span className="font-medium">{c.nombre} {c.apellidos}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{c.puesto}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[11px]" style={{ borderColor: FASES_CONFIG[c.fase].color, color: FASES_CONFIG[c.fase].color }}>
                    {FASES_CONFIG[c.fase].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.telefono}</TableCell>
                <TableCell className="text-muted-foreground">{c.email}</TableCell>
                <TableCell className="text-muted-foreground">{c.canal ?? ORIGEN_LABELS[c.origen]}</TableCell>
                <TableCell className="text-muted-foreground">{c.reclutadorAsignado}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <CandidatoDialog candidato={selectedCandidato} open={!!selectedCandidato} onOpenChange={(o) => !o && setSelectedCandidato(null)} />
    </div>
  );
}

// ─── Candidate Detail Dialog ────────────────────────────────────
function CandidatoDialog({ candidato, open, onOpenChange }: { candidato: Candidato | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  if (!candidato) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              {candidato.nombre[0]}{candidato.apellidos[0]}
            </div>
            {candidato.nombre} {candidato.apellidos}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm mt-2">
          <Row icon={<Tag className="h-4 w-4" />} label="Fase" value={FASES_CONFIG[candidato.fase].label} />
          <Row icon={<Phone className="h-4 w-4" />} label="Teléfono" value={candidato.telefono} />
          <Row icon={<Mail className="h-4 w-4" />} label="Email" value={candidato.email} />
          <Row icon={<CalendarDays className="h-4 w-4" />} label="Inscripción" value={candidato.fechaInscripcion} />
          <Row icon={<MapPin className="h-4 w-4" />} label="Canal" value={candidato.canal ?? ORIGEN_LABELS[candidato.origen]} />
          <Row icon={<User className="h-4 w-4" />} label="Reclutador" value={candidato.reclutadorAsignado} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium text-muted-foreground w-24">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

// ─── Candidates List for a Vacancy ─────────────────────────────
function CandidatosView({ vacante, vacantes = [], faseInicial, onBack, onMoved }: { vacante: Vacante; vacantes?: Vacante[]; faseInicial: FaseReclutamiento | null; onBack: () => void; onMoved?: () => void }) {
  const [faseFilter, setFaseFilter] = useState<string>(faseInicial || "todas");
  const [search, setSearch] = useState("");
  const [selectedCandidato, setSelectedCandidato] = useState<Candidato | null>(null);
  const [candidatosLocal, setCandidatosLocal] = useState<Candidato[]>(vacante.candidatos);

  useEffect(() => { setCandidatosLocal(vacante.candidatos); }, [vacante]);

  const filtered = useMemo(() => {
    let list = candidatosLocal;
    if (faseFilter !== "todas") list = list.filter((c) => c.fase === faseFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c) => `${c.nombre} ${c.apellidos} ${c.email}`.toLowerCase().includes(s));
    }
    return list;
  }, [candidatosLocal, faseFilter, search]);

  const handleUpdateCandidato = (updated: Candidato) => {
    setCandidatosLocal((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedCandidato(updated);
  };

  const handleMoverVacante = async (c: Candidato, vacanteId: string, estado: EstadoReclutamiento) => {
    const fase = getFasePrincipal(estado);
    const res = await moverCandidatoAVacante(c.id, vacanteId, fase, estado);
    if (!res.ok) {
      toast.error(("error" in res && res.error) || "No se pudo mover de vacante");
      return;
    }
    // Sale de la lista de esta vacante.
    setCandidatosLocal((prev) => prev.filter((x) => x.id !== c.id));
    setSelectedCandidato(null);
    toast.success("Candidato movido de vacante");
    onMoved?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">{vacante.puesto}</h2>
          <p className="text-sm text-muted-foreground">{candidatosLocal.length} candidatos</p>
        </div>
      </div>

      <FunnelMetrics candidatos={candidatosLocal} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar candidato..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={faseFilter} onValueChange={setFaseFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las fases</SelectItem>
            {FASES_ORDER.map((f) => (
              <SelectItem key={f} value={f}>{FASES_CONFIG[f].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidato</TableHead>
              <TableHead>Fase</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Inscripción</TableHead>
              <TableHead>Reclutador</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Sin candidatos en esta fase</TableCell></TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCandidato(c)}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
                      {c.nombre[0]}{c.apellidos[0]}
                    </div>
                    <span className="font-medium text-foreground">{c.nombre} {c.apellidos}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[11px]" style={{ borderColor: FASES_CONFIG[c.fase].color, color: FASES_CONFIG[c.fase].color }}>
                    {FASES_CONFIG[c.fase].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.telefono}</TableCell>
                <TableCell className="text-muted-foreground">{c.email}</TableCell>
                <TableCell className="text-muted-foreground">{c.canal ?? ORIGEN_LABELS[c.origen]}</TableCell>
                <TableCell className="text-muted-foreground">{c.fechaInscripcion}</TableCell>
                <TableCell className="text-muted-foreground">{c.reclutadorAsignado}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CandidatoDetailModal
        open={!!selectedCandidato}
        onOpenChange={(o) => !o && setSelectedCandidato(null)}
        candidato={selectedCandidato}
        candidatos={filtered}
        vacante={vacante}
        vacantes={vacantes}
        onSelectCandidato={setSelectedCandidato}
        onUpdateCandidato={handleUpdateCandidato}
        onMoverVacante={handleMoverVacante}
      />
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export function ReclutamientoView() {
  const { empresaActual } = useEmpresa();
  const [vacantes, setVacantes] = useState<Vacante[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);
  const [reloadKey, setReloadKey] = useState(0);
  const recargar = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Regla del modelo: cada puesto activo tiene su vacante (idempotente),
      // siempre para la empresa seleccionada en el contexto del cliente.
      await asegurarVacantesPorPuesto(empresaActual.id);
      const res = await listVacantesConCandidatos(empresaActual.id);
      if (!cancelled) {
        setVacantes((res.data ?? []) as unknown as Vacante[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [empresaActual.id, reloadKey]);

  // Acciones reales sobre vacantes
  const handlePublicar = useCallback(async (id: string) => {
    const res = await publicarVacante(id);
    if (res.ok) {
      toast.success("Oferta publicada");
      recargar();
    } else toast.error("No se pudo publicar");
  }, [recargar]);

  const handleDespublicar = useCallback(async (id: string) => {
    const res = await despublicarVacante(id);
    if (res.ok) {
      toast.success("Oferta retirada del portal");
      recargar();
    } else toast.error("No se pudo despublicar");
  }, [recargar]);

  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);

  const [selectedVacante, setSelectedVacante] = useState<Vacante | null>(null);
  const [selectedFase, setSelectedFase] = useState<FaseReclutamiento | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "tabla">("kanban");

  // Dialogs (creación/edición)
  const [nuevaOfertaOpen, setNuevaOfertaOpen] = useState(false);
  const [ofertaEditando, setOfertaEditando] = useState<Vacante | null>(null);

  // Selector de área (vacantes operativas vs. administrativas)
  const [areaFiltro, setAreaFiltro] = useState<"operativa" | "administrativa">("operativa");
  const [showConfig, setShowConfig] = useState(false);
  const [showCandidatos, setShowCandidatos] = useState(false);
  const [showPromocion, setShowPromocion] = useState(false);


  const acceso = (v: Vacante, campo: string): unknown => {
    if (campo === "estadoPublicacion") return ESTADO_PUBLICACION_LABELS[v.estadoPublicacion];
    if (campo === "categoria") return v.categoria;
    if (campo === "tipoJornada") return v.tipoJornada;
    if (campo === "puesto") return v.puesto;
    if (campo === "ubicacion") return v.ubicacion;
    return (v as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let list = vacantes.filter(
      (v) => ((v as Vacante & { area?: string }).area ?? "administrativa") === areaFiltro,
    );
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((v) => v.puesto.toLowerCase().includes(s) || v.ubicacion.toLowerCase().includes(s));
    }
    list = aplicarFiltrosToolbar(list, filtros, acceso);
    list = aplicarOrdenToolbar(list, orden, acceso);
    return list;
  }, [vacantes, search, filtros, orden, areaFiltro]);

  const conteoArea = useMemo(() => {
    let admin = 0;
    let oper = 0;
    for (const v of vacantes) {
      const a = (v as Vacante & { area?: string }).area ?? "administrativa";
      if (a === "operativa") oper++;
      else admin++;
    }
    return { administrativa: admin, operativa: oper };
  }, [vacantes]);

  const handleSelectFase = (v: Vacante, f: FaseReclutamiento | null) => {
    setSelectedVacante(v);
    setSelectedFase(f);
  };

  // ── Drag & drop para ordenar vacantes a mano ─────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  // Solo se puede arrastrar con la lista "natural": sin búsqueda/filtros/orden,
  // que reordenarían y romperían la correspondencia con lo que se persiste.
  const puedeReordenar = !search && filtros.length === 0 && !orden;

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex((v) => v.id === active.id);
    const newIndex = filtered.findIndex((v) => v.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    // Reordena el área visible y reconstruye la lista completa para persistir.
    const reordenadaArea = arrayMove(filtered, oldIndex, newIndex);
    const areaDe = (v: Vacante) => (v as Vacante & { area?: string }).area ?? "administrativa";
    const operativas = areaFiltro === "operativa"
      ? reordenadaArea
      : vacantes.filter((v) => areaDe(v) === "operativa");
    const administrativas = areaFiltro === "administrativa"
      ? reordenadaArea
      : vacantes.filter((v) => areaDe(v) === "administrativa");
    const full = [...operativas, ...administrativas];

    setVacantes(full); // optimista: el portal usará este mismo orden
    (async () => {
      const res = await reordenarVacantes(full.map((v) => v.id));
      if (!res.ok) {
        toast.error("No se pudo guardar el orden");
        recargar();
      }
    })();
  };

  if (selectedVacante) {
    const isKanban = viewMode === "kanban";
    const viewToggle = (
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        <Button variant={isKanban ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setViewMode("kanban")}>
          <Kanban className="h-3.5 w-3.5" /> Pipeline
        </Button>
        <Button variant={!isKanban ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setViewMode("tabla")}>
          <List className="h-3.5 w-3.5" /> Tabla
        </Button>
      </div>
    );

    if (isKanban) {
      return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
          <div className="flex justify-end px-6 pt-4">{viewToggle}</div>
          <div className="flex-1">
            <KanbanPipeline
              vacante={selectedVacante}
              vacantes={vacantes}
              onMoved={recargar}
              onBack={() => setSelectedVacante(null)}
              onUpdateCandidatos={async (updated) => {
                // Detecta candidatos cuyo `fase` (= estado real) cambió y persiste a Supabase.
                const previos = selectedVacante.candidatos;
                const cambios = updated.filter((c) => {
                  const prev = previos.find((p) => p.id === c.id);
                  return prev && prev.fase !== c.fase;
                });
                setSelectedVacante({ ...selectedVacante, candidatos: updated });
                for (const c of cambios) {
                  const fase = (Object.entries(FASES_PRINCIPALES) as Array<[FasePrincipal, { estados: EstadoReclutamiento[] }]>)
                    .find(([, cfg]) => cfg.estados.includes(c.fase as EstadoReclutamiento))?.[0];
                  if (!fase) continue;
                  const res = await moverCandidatoFase(c.id, fase, c.fase);
                  if (!res.ok && "error" in res && res.error === "YA_EMPLEADO") {
                    toast.error("Este candidato ya es empleado y no puede descartarse desde aquí. Gestiona su baja desde la ficha del empleado.");
                  } else if (!res.ok && "error" in res && res.error === "NO_FUE_EMPLEADO") {
                    toast.error("Solo pueden pasar a Ex-empleados quienes fueron empleados (vienen de la casilla «Empleado»).");
                  } else if (!res.ok) {
                    toast.error(("error" in res && res.error) || "Error al mover candidato");
                  } else if (res.empleadoYaContratado) {
                    toast.info("Candidato ya promovido — el movimiento es solo organizativo.");
                  }
                }
                // Sincroniza la lista global tras los cambios
                if (cambios.length > 0) recargar();
              }}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-end mb-4">{viewToggle}</div>
        <CandidatosView vacante={selectedVacante} vacantes={vacantes} faseInicial={selectedFase} onBack={() => setSelectedVacante(null)} onMoved={recargar} />
      </div>
    );
  }


  // Render condicional según el modo (vacantes / candidatos / config)
  if (showConfig) {
    return (
      <div className="px-4 md:px-6 pt-2 pb-6 max-w-[1400px] mx-auto space-y-2">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(false)}
            className="gap-1.5 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a vacantes
          </Button>
        </div>
        <ReclutamientoConfigView />
      </div>
    );
  }

  if (showCandidatos) {
    return (
      <div className="px-4 md:px-6 pt-2 pb-6 max-w-[1400px] mx-auto space-y-2">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCandidatos(false)}
            className="gap-1.5 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a vacantes
          </Button>
        </div>
        <CandidatosRealesTab />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 pt-2 pb-6 max-w-[1400px] mx-auto space-y-2">
      <div className="space-y-3 mt-2">
          {/* Selector de área (mismo estilo que COMPRA/VENTA/ELABORACIONES) */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={areaFiltro === "operativa" ? "default" : "outline"}
              className="gap-2"
              onClick={() => setAreaFiltro("operativa")}
            >
              <Utensils className="h-4 w-4" />
              ÁREA OPERATIVA
              <Badge variant="secondary" className="text-[10px] ml-1">{conteoArea.operativa}</Badge>
            </Button>
            <Button
              variant={areaFiltro === "administrativa" ? "default" : "outline"}
              className="gap-2"
              onClick={() => setAreaFiltro("administrativa")}
            >
              <Building2 className="h-4 w-4" />
              ÁREA ADMINISTRATIVA
              <Badge variant="secondary" className="text-[10px] ml-1">{conteoArea.administrativa}</Badge>
            </Button>
          </div>

          <SubmoduleToolbar
            busqueda={search}
            onBusquedaChange={setSearch}
            placeholderBusqueda="Buscar"
            onNuevo={() => setNuevaOfertaOpen(true)}
            filtros={filtros}
            onFiltrosChange={setFiltros}
            orden={orden}
            onOrdenChange={setOrden}
            extraIzquierda={
              <>
                <Button
                  size="sm"
                  onClick={() => setShowPromocion(true)}
                  className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
                >
                  <TrendingUp className="h-3.5 w-3.5" /> Promoción interna
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCandidatos(true)}
                  className="gap-1.5"
                >
                  <Users className="h-3.5 w-3.5" /> Candidatos
                </Button>
              </>
            }
            extraDerecha={
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9"
                onClick={() => setShowConfig(true)}
                title="Configuración"
                aria-label="Configuración"
              >
                <Settings className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            }
          />

          <div className="space-y-4">
            {loading && (
              <Card><CardContent className="py-16 text-center text-muted-foreground">Cargando vacantes…</CardContent></Card>
            )}
            {!loading && filtered.length === 0 && (
              <Card><CardContent className="py-16 text-center text-muted-foreground">
                No hay vacantes en esta área.
              </CardContent></Card>
            )}
            {!loading && filtered.length > 0 && (
              puedeReordenar ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filtered.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {filtered.map((v) => (
                        <SortableVacanteCard
                          key={v.id}
                          id={v.id}
                          vacante={v as Vacante & { visiblePublicamente?: boolean }}
                          onSelectFase={handleSelectFase}
                          onPublicar={handlePublicar}
                          onDespublicar={handleDespublicar}
                          onEditar={(vc) => { setOfertaEditando(vc); setNuevaOfertaOpen(true); }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                filtered.map((v) => (
                  <VacanteCard
                    key={v.id}
                    vacante={v as Vacante & { visiblePublicamente?: boolean }}
                    onSelectFase={handleSelectFase}
                    onPublicar={handlePublicar}
                    onDespublicar={handleDespublicar}
                    onEditar={(vc) => { setOfertaEditando(vc); setNuevaOfertaOpen(true); }}
                  />
                ))
              )
            )}
          </div>
        </div>

      {/* ── Dialog crear/editar oferta ───────────────── */}
      <OfertaFormDialog
        open={nuevaOfertaOpen}
        onOpenChange={(o) => {
          setNuevaOfertaOpen(o);
          if (!o) setOfertaEditando(null);
        }}
        vacanteId={ofertaEditando?.id ?? null}
        onSaved={recargar}
      />

      {/* ── Dialog promoción interna (empleado cambia de puesto) ── */}
      <PromocionInternaDialog
        open={showPromocion}
        onOpenChange={setShowPromocion}
        onDone={recargar}
      />
    </div>
  );
}
