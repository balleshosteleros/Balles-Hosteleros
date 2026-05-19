"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { listVacantesConCandidatos, seedVacantesDesdeOrganigrama } from "@/features/rrhh/actions/reclutamiento-actions";
import {
  publicarVacante, cerrarVacante, deleteVacante, toggleVisibilidadVacante,
} from "@/features/rrhh/actions/vacantes-actions";
import { moverCandidatoFase } from "@/features/rrhh/actions/candidatos-actions";
import { toast } from "sonner";
import {
  contarCandidatosPorFase,
  FASES_PRINCIPALES,
  FASES_PRINCIPALES_ORDER,
  ESTADOS_CONFIG,
  ESTADOS_CONFIG as FASES_CONFIG,
  FASES_ORDER,
  TIPO_JORNADA_LABELS,
  ESTADO_PUBLICACION_LABELS,
  ORIGEN_LABELS,
  type Vacante,
  type Candidato,
  type FaseReclutamiento,
  type FasePrincipal,
  type EstadoReclutamiento,
} from "@/features/rrhh/data/reclutamiento";
import {
  getVacantesDesdeRoles,
  getRolesPorEmpresa,
} from "@/features/rrhh/data/roles-empresa";
import { KanbanPipeline } from "@/features/rrhh/components/reclutamiento/KanbanPipeline";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Search, Star, MoreHorizontal, MapPin, Clock, CalendarDays,
  FileText, Users, Send, ArrowLeft, User, Phone, Mail, Tag, Kanban, List,
  Pencil, Share2, EyeOff, Trash2, Utensils, Building2, Settings,
} from "lucide-react";
import { DialogSnippetEmbed } from "@/features/empleo-publico/components/DialogSnippetEmbed";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { reclutamientoIO } from "@/features/rrhh/io/reclutamiento.io";
import { ReclutamientoConfigView } from "@/features/rrhh/components/reclutamiento/config/ReclutamientoConfigView";
import { CandidatosRealesTab } from "@/features/rrhh/components/reclutamiento/CandidatosRealesTab";
import { OfertaFormDialog } from "@/features/rrhh/components/reclutamiento/OfertaFormDialog";
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
  onCerrar?: (id: string) => void;
  onEliminar?: (id: string) => void;
  onToggleVisible?: (id: string, visible: boolean) => void;
  onCompartir?: (v: Vacante) => void;
  onEditar?: (v: Vacante) => void;
}

function VacanteCard({
  vacante, onSelectFase,
  onPublicar, onCerrar, onEliminar, onToggleVisible, onCompartir, onEditar,
}: VacanteCardProps) {
  const counts = contarCandidatosPorFase(vacante.candidatos);
  const total = vacante.candidatos.length;
  const visiblePublicamente = !!vacante.visiblePublicamente;
  const estaPublicada = vacante.estadoPublicacion === "publicada";
  const estadoColor: Record<string, string> = {
    publicada: "bg-emerald-100 text-emerald-700",
    borrador: "bg-amber-100 text-amber-700",
    cerrada: "bg-muted text-muted-foreground",
    archivada: "bg-muted text-muted-foreground",
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button className="text-muted-foreground hover:text-amber-400 transition-colors">
            <Star className={`h-4 w-4 ${vacante.favorita ? "fill-amber-400 text-amber-400" : ""}`} />
          </button>
          <h3
            className="text-base font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
            onClick={() => onSelectFase(vacante, null)}
          >
            {vacante.puesto}
          </h3>
          <Badge variant="secondary" className="text-xs font-normal">{total} candidatos</Badge>
          <Badge className={`text-[11px] font-medium border-0 ${estadoColor[vacante.estadoPublicacion] || ""}`}>
            {ESTADO_PUBLICACION_LABELS[vacante.estadoPublicacion]}
          </Badge>
          {visiblePublicamente && estaPublicada && (
            <Badge variant="outline" className="text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700">
              🌐 Pública
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!estaPublicada ? (
            <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-border bg-muted/30">
              <button
                type="button"
                onClick={() => onPublicar?.(vacante.id)}
                disabled={!onPublicar}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Send className="h-3 w-3" /> Publicar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-border bg-muted/30">
              <span className="text-[11px] text-muted-foreground">Pública</span>
              <Switch
                checked={visiblePublicamente}
                onCheckedChange={(n) => onToggleVisible?.(vacante.id, n)}
                disabled={!onToggleVisible}
                aria-label="Visible en el portal público"
              />
            </div>
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
              {onCompartir && (
                <DropdownMenuItem onClick={() => onCompartir(vacante)}>
                  <Share2 className="h-4 w-4 mr-2" /> Compartir / embed
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onSelectFase(vacante, null)}>
                <Users className="h-4 w-4 mr-2" /> Ver candidatos
              </DropdownMenuItem>
              {estaPublicada && onCerrar && (
                <DropdownMenuItem onClick={() => onCerrar(vacante.id)}>
                  <EyeOff className="h-4 w-4 mr-2" /> Cerrar
                </DropdownMenuItem>
              )}
              {onEliminar && (
                <DropdownMenuItem onClick={() => onEliminar(vacante.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex gap-2 overflow-x-auto">
          {FASES_PRINCIPALES_ORDER.map((fp) => {
            const fpCfg = FASES_PRINCIPALES[fp];
            const fpCount = fpCfg.estados.reduce((sum, e) => sum + (counts[e] || 0), 0);
            return (
              <div key={fp} className="flex-1 min-w-0">
                <div className="h-1.5 rounded-t" style={{ background: `linear-gradient(90deg, ${fpCfg.colorFrom}, ${fpCfg.colorTo})` }} />
                <div className="border border-t-0 border-border rounded-b-lg p-1.5 bg-muted/20">
                  <div className="text-[9px] font-semibold text-foreground uppercase tracking-wider text-center mb-1">{fpCfg.label} ({fpCount})</div>
                  <div className="flex gap-1">
                    {fpCfg.estados.map((estado) => {
                      const estCfg = ESTADOS_CONFIG[estado];
                      const count = counts[estado] || 0;
                      return (
                        <button
                          key={estado}
                          onClick={() => count > 0 ? onSelectFase(vacante, estado) : undefined}
                          className={`flex-1 flex flex-col items-center rounded border border-border p-1.5 transition-all ${count > 0 ? "hover:border-primary/40 hover:shadow-sm cursor-pointer" : "opacity-50 cursor-default"}`}
                        >
                          <span className="text-sm font-bold text-foreground">{count}</span>
                          <span className="text-[9px] leading-tight text-muted-foreground text-center font-medium">{estCfg.label}</span>
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
        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{vacante.ubicacion}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{TIPO_JORNADA_LABELS[vacante.tipoJornada]}</span>
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{vacante.fechaCreacion}</span>
        {vacante.cuestionario && <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />Cuestionario</span>}
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{vacante.reclutadores.join(", ")}</span>
      </div>
    </Card>
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
          <Row icon={<MapPin className="h-4 w-4" />} label="Origen" value={ORIGEN_LABELS[candidato.origen]} />
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
function CandidatosView({ vacante, faseInicial, onBack }: { vacante: Vacante; faseInicial: FaseReclutamiento | null; onBack: () => void }) {
  const [faseFilter, setFaseFilter] = useState<string>(faseInicial || "todas");
  const [search, setSearch] = useState("");
  const [selectedCandidato, setSelectedCandidato] = useState<Candidato | null>(null);

  const filtered = useMemo(() => {
    let list = vacante.candidatos;
    if (faseFilter !== "todas") list = list.filter((c) => c.fase === faseFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c) => `${c.nombre} ${c.apellidos} ${c.email}`.toLowerCase().includes(s));
    }
    return list;
  }, [vacante, faseFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">{vacante.puesto}</h2>
          <p className="text-sm text-muted-foreground">{vacante.candidatos.length} candidatos · {vacante.ubicacion}</p>
        </div>
      </div>

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
              <TableHead>Origen</TableHead>
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
                <TableCell className="text-muted-foreground">{ORIGEN_LABELS[c.origen]}</TableCell>
                <TableCell className="text-muted-foreground">{c.fechaInscripcion}</TableCell>
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

// ─── All Candidates Tab ─────────────────────────────────────────
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
              <TableHead>Origen</TableHead>
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
                <TableCell className="text-muted-foreground">{ORIGEN_LABELS[c.origen]}</TableCell>
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

// ─── Main Page ──────────────────────────────────────────────────
export function ReclutamientoView() {
  const { empresaActual } = useEmpresa();
  const router = useRouter();
  const [vacantes, setVacantes] = useState<Vacante[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const recargar = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Asegura que cada nodo del organigrama tenga su vacante (idempotente),
      // siempre para la empresa seleccionada en el contexto del cliente.
      await seedVacantesDesdeOrganigrama(empresaActual.id);
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

  const handleCerrar = useCallback(async (id: string) => {
    const res = await cerrarVacante(id);
    if (res.ok) {
      toast.success("Oferta cerrada");
      recargar();
    } else toast.error("No se pudo cerrar");
  }, [recargar]);

  const handleEliminar = useCallback(async (id: string) => {
    const v = vacantes.find((x) => x.id === id);
    const titulo = v?.puesto ?? "esta vacante";
    if (!window.confirm(`¿Eliminar definitivamente la vacante "${titulo}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    const res = await deleteVacante(id);
    if (res.ok) {
      toast.success("Vacante eliminada");
      recargar();
    } else {
      toast.error(("error" in res && res.error) || "No se pudo eliminar");
    }
  }, [recargar, vacantes]);

  const handleToggleVisible = useCallback(async (id: string, visible: boolean) => {
    const res = await toggleVisibilidadVacante(id, visible);
    if (res.ok) {
      toast.success(visible ? "Visible públicamente" : "Oculta del portal");
      recargar();
    } else toast.error("No se pudo cambiar la visibilidad");
  }, [recargar]);

  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);

  const [selectedVacante, setSelectedVacante] = useState<Vacante | null>(null);
  const [selectedFase, setSelectedFase] = useState<FaseReclutamiento | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "tabla">("kanban");

  // Dialogs (creación/edición + share)
  const [nuevaOfertaOpen, setNuevaOfertaOpen] = useState(false);
  const [ofertaEditando, setOfertaEditando] = useState<Vacante | null>(null);
  const [snippetVacante, setSnippetVacante] = useState<Vacante | null>(null);
  const [snippetGlobalOpen, setSnippetGlobalOpen] = useState(false);

  // Selector de área (vacantes operativas vs. administrativas)
  const [areaFiltro, setAreaFiltro] = useState<"operativa" | "administrativa">("operativa");
  const [showConfig, setShowConfig] = useState(false);

  const categorias = useMemo(() => [...new Set(vacantes.map((v) => v.categoria))], [vacantes]);

  const acceso = (v: Vacante, campo: string): unknown => {
    if (campo === "estadoPublicacion") return ESTADO_PUBLICACION_LABELS[v.estadoPublicacion];
    if (campo === "categoria") return v.categoria;
    if (campo === "tipoJornada") return TIPO_JORNADA_LABELS[v.tipoJornada];
    if (campo === "favorita") return v.favorita;
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
                  if (!res.ok && "error" in res && res.error === "OFFBOARDING_REQUIRED") {
                    toast.error("Este candidato ya es empleado. Inicia el offboarding desde la pestaña Candidatos.");
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
        <CandidatosView vacante={selectedVacante} faseInicial={selectedFase} onBack={() => setSelectedVacante(null)} />
      </div>
    );
  }

  const totalCandidatos = vacantes.reduce((a, v) => a + v.candidatos.length, 0);
  const vacantesAbiertas = vacantes.filter((v) => v.estadoPublicacion === "publicada").length;

  return (
    <div className="px-4 md:px-6 pt-2 pb-6 max-w-[1400px] mx-auto space-y-2">
      <Tabs defaultValue="vacantes">
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <TabsList className="h-9">
              <TabsTrigger value="vacantes" className="text-xs">Vacantes</TabsTrigger>
              <TabsTrigger value="candidatos" className="text-xs">Candidatos</TabsTrigger>
              <TabsTrigger value="config" className="text-xs">Configuración</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="vacantes" className="space-y-3 mt-2">
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
            extraDerecha={
              <>
                {empresaActual.id ? (
                  <Button variant="outline" size="sm" onClick={() => setSnippetGlobalOpen(true)} className="gap-1.5">
                    <Share2 className="h-3.5 w-3.5" /> Compartir portal
                  </Button>
                ) : null}
                <Button
                  size="icon"
                  variant={showConfig ? "default" : "outline"}
                  className="h-9 w-9"
                  onClick={() => setShowConfig((v) => !v)}
                  title="Configuración"
                  aria-label="Configuración"
                >
                  <Settings className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </>
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
            {!loading && filtered.map((v) => (
              <VacanteCard
                key={v.id}
                vacante={v as Vacante & { visiblePublicamente?: boolean }}
                onSelectFase={handleSelectFase}
                onPublicar={handlePublicar}
                onCerrar={handleCerrar}
                onEliminar={handleEliminar}
                onToggleVisible={handleToggleVisible}
                onCompartir={(vc) => setSnippetVacante(vc)}
                onEditar={(vc) => { setOfertaEditando(vc); setNuevaOfertaOpen(true); }}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="candidatos" className="mt-4">
          <CandidatosRealesTab />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <ReclutamientoConfigView />
        </TabsContent>
      </Tabs>

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

      {/* ── Snippet de share por oferta ────────────── */}
      {empresaActual.id && snippetVacante && (
        <DialogSnippetEmbed
          open={!!snippetVacante}
          onOpenChange={(o) => !o && setSnippetVacante(null)}
          empresaSlug={empresaActual.id}
          empresaNombre={empresaActual.nombre}
          ofertaId={snippetVacante.id}
          ofertaTitulo={snippetVacante.puesto}
        />
      )}

      {/* ── Snippet de share del portal completo ────── */}
      {empresaActual.id && (
        <DialogSnippetEmbed
          open={snippetGlobalOpen}
          onOpenChange={setSnippetGlobalOpen}
          empresaSlug={empresaActual.id}
          empresaNombre={empresaActual.nombre}
        />
      )}
    </div>
  );
}
