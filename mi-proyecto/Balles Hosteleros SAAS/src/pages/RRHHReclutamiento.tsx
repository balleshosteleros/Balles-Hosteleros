import { useState, useMemo } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
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
} from "@/data/reclutamiento";
import {
  getVacantesDesdeRoles,
  getRolesPorEmpresa,
} from "@/data/roles-empresa";
import { KanbanPipeline } from "@/components/reclutamiento/KanbanPipeline";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, Star, MoreHorizontal, MapPin, Clock, CalendarDays,
  FileText, Users, Send, ChevronRight, ArrowLeft, User, Phone, Mail, Tag, Kanban, List,
  Briefcase, Building2, Settings, Info,
} from "lucide-react";
import { ReclutamientoConfigView } from "@/components/reclutamiento/config/ReclutamientoConfigView";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

// ─── Vacancy Card ────────────────────────────────────────────────
function VacanteCard({ vacante, onSelectFase }: { vacante: Vacante; onSelectFase: (v: Vacante, f: FaseReclutamiento | null) => void }) {
  const counts = contarCandidatosPorFase(vacante.candidatos);
  const total = vacante.candidatos.length;
  const estadoColor: Record<string, string> = {
    publicada: "bg-emerald-100 text-emerald-700",
    borrador: "bg-amber-100 text-amber-700",
    cerrada: "bg-muted text-muted-foreground",
    archivada: "bg-muted text-muted-foreground",
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
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
          <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
            <Briefcase className="h-3 w-3" /> Rol vinculado
          </Badge>
          <Badge variant="secondary" className="text-xs font-normal">{total} candidatos</Badge>
          <Badge className={`text-[11px] font-medium border-0 ${estadoColor[vacante.estadoPublicacion] || ""}`}>
            {ESTADO_PUBLICACION_LABELS[vacante.estadoPublicacion]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={vacante.estadoPublicacion === "publicada" ? "secondary" : "default"} className="text-xs h-8 gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {vacante.estadoPublicacion === "publicada" ? "Publicada" : "Publicar"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Duplicar</DropdownMenuItem>
              <DropdownMenuItem>Ver candidatos</DropdownMenuItem>
              <DropdownMenuItem>Archivar</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Cerrar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Pipeline phases grouped */}
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

      {/* Footer info */}
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

// ─── Main Page ──────────────────────────────────────────────────
export default function RRHHReclutamiento() {
  const { empresaActual } = useEmpresa();
  const navigate = useNavigate();
  const roles = useMemo(() => getRolesPorEmpresa(empresaActual.id), [empresaActual.id]);
  const vacantes = useMemo(() => getVacantesDesdeRoles(empresaActual.id), [empresaActual.id]);

  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [soloFavoritas, setSoloFavoritas] = useState(false);

  // Drill-down state
  const [selectedVacante, setSelectedVacante] = useState<Vacante | null>(null);
  const [selectedFase, setSelectedFase] = useState<FaseReclutamiento | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "tabla">("kanban");

  const categorias = useMemo(() => [...new Set(vacantes.map((v) => v.categoria))], [vacantes]);

  const filtered = useMemo(() => {
    let list = vacantes;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((v) => v.puesto.toLowerCase().includes(s) || v.ubicacion.toLowerCase().includes(s));
    }
    if (filtroEstado !== "todos") list = list.filter((v) => v.estadoPublicacion === filtroEstado);
    if (filtroCategoria !== "todas") list = list.filter((v) => v.categoria === filtroCategoria);
    if (soloFavoritas) list = list.filter((v) => v.favorita);
    return list;
  }, [vacantes, search, filtroEstado, filtroCategoria, soloFavoritas]);

  const handleSelectFase = (v: Vacante, f: FaseReclutamiento | null) => {
    setSelectedVacante(v);
    setSelectedFase(f);
  };

  // If viewing a specific vacancy
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
              onUpdateCandidatos={(updated) => {
                setSelectedVacante({ ...selectedVacante, candidatos: updated });
              }}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-end mb-4">{viewToggle}</div>
        <CandidatosView vacante={selectedVacante} faseInicial={selectedFase} onBack={() => setSelectedVacante(null)} />
      </div>
    );
  }

  const totalCandidatos = vacantes.reduce((a, v) => a + v.candidatos.length, 0);
  const vacantesAbiertas = vacantes.filter((v) => v.estadoPublicacion === "publicada").length;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <Tabs defaultValue="vacantes">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reclutamiento</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {vacantesAbiertas} vacantes abiertas · {totalCandidatos} candidatos totales
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TabsList className="h-9">
              <TabsTrigger value="vacantes" className="text-xs">Vacantes</TabsTrigger>
              <TabsTrigger value="candidatos" className="text-xs">Candidatos</TabsTrigger>
              <TabsTrigger value="config" className="text-xs">Configuración</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-primary/20 bg-primary/5 mt-2">
          <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Las vacantes se generan automáticamente a partir de los roles creados en Ajustes</p>
            <p className="text-xs text-muted-foreground">
              Para crear una nueva vacante, primero debes crear un nuevo rol desde{" "}
              <button onClick={() => navigate("/ajustes")} className="text-primary font-medium hover:underline">
                Ajustes → Puestos de empresa
              </button>.
              Cada rol genera automáticamente su vacante asociada.
            </p>
          </div>
        </div>

        {/* ── Tab: Vacantes ────────────────────────────── */}
        <TabsContent value="vacantes" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar vacante..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="publicada">Publicada</SelectItem>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="cerrada">Cerrada</SelectItem>
                <SelectItem value="archivada">Archivada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={soloFavoritas ? "default" : "outline"} size="sm" className="h-9 gap-1.5" onClick={() => setSoloFavoritas(!soloFavoritas)}>
              <Star className={`h-3.5 w-3.5 ${soloFavoritas ? "fill-current" : ""}`} />
              Favoritas
            </Button>
          </div>

          {/* Vacancy cards */}
          <div className="space-y-4">
            {filtered.length === 0 && (
              <Card><CardContent className="py-16 text-center text-muted-foreground">No se encontraron vacantes con los filtros seleccionados</CardContent></Card>
            )}
            {filtered.map((v) => (
              <VacanteCard key={v.id} vacante={v} onSelectFase={handleSelectFase} />
            ))}
          </div>
        </TabsContent>

        {/* ── Tab: Todos los candidatos ──────────────── */}
        <TabsContent value="candidatos" className="mt-4">
          <AllCandidatosView vacantes={vacantes} />
        </TabsContent>

        {/* ── Tab: Configuración ─────────────────────── */}
        <TabsContent value="config" className="mt-4">
          <ReclutamientoConfigView />
        </TabsContent>
      </Tabs>
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
                <TableCell className="font-medium">{(c as any).puesto}</TableCell>
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
