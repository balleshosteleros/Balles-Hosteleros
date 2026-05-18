"use client";

import { useState, useMemo, useEffect } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Partida, ProductoPartida, MisePlaceItem, ESTADO_PARTIDA_LABELS, EstadoPartida, type ConfigPartidas, type AreaPrincipal, getPartidasByEmpresa } from "@/features/cocina/data/partidas";
import { getEmpleadosPorEmpresa } from "@/features/rrhh/data/rrhh";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, List, LayoutGrid, ArrowLeft, Pencil, Trash2, ChefHat, Settings2 } from "lucide-react";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";

// ─── Config list editor (reused pattern) ────────────────────────
function ConfigListEditor({ title, items, onAdd, onRemove }: { title: string; items: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void }) {
  const [val, setVal] = useState("");
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder={`Nuevo ${title.toLowerCase()}...`} value={val} onChange={e => setVal(e.target.value)} className="flex-1" />
          <Button size="sm" onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}><Plus className="h-4 w-4 mr-1" />Añadir</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1">
              {item}
              <button onClick={() => onRemove(i)} className="ml-1 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Estado badge ───────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: EstadoPartida }) {
  const colors: Record<EstadoPartida, string> = {
    activa: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    inactiva: "bg-muted text-muted-foreground",
    en_revision: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };
  return <Badge className={`${colors[estado]} border-0 font-medium`}>{ESTADO_PARTIDA_LABELS[estado]}</Badge>;
}

// ─── Detail view ────────────────────────────────────────────────
function PartidaDetail({ partida, onBack, empleados, config }: {
  partida: Partida;
  onBack: () => void;
  empleados: { id: string; nombre: string; apellidos: string }[];
  config: ConfigPartidas;
}) {
  const [productos, setProductos] = useState<ProductoPartida[]>(partida.productos);
  const [mise, setMise] = useState<MisePlaceItem[]>(partida.misEnPlace);
  const [addProdOpen, setAddProdOpen] = useState(false);
  const [addMiseOpen, setAddMiseOpen] = useState(false);
  const [newProd, setNewProd] = useState({ nombre: "", categoria: config.categorias[0] || "" });
  const [newMise, setNewMise] = useState({ nombre: "", grupo: config.gruposMise[0] || "" });

  const productosByCategoria = useMemo(() => {
    const map: Record<string, ProductoPartida[]> = {};
    productos.forEach(p => {
      if (!map[p.categoria]) map[p.categoria] = [];
      map[p.categoria].push(p);
    });
    return map;
  }, [productos]);

  const miseByGrupo = useMemo(() => {
    const map: Record<string, MisePlaceItem[]> = {};
    mise.forEach(m => {
      if (!map[m.grupo]) map[m.grupo] = [];
      map[m.grupo].push(m);
    });
    return map;
  }, [mise]);

  const creadorName = empleados.find(e => e.id === partida.creador);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Volver</Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{partida.nombre}</h2>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>Área: <strong>{partida.area}</strong></span>
            <EstadoBadge estado={partida.estado} />
            {creadorName && <span>Creador: <strong>{creadorName.nombre} {creadorName.apellidos}</strong></span>}
            <span>Actualizado: {partida.fechaActualizacion}</span>
          </div>
        </div>
      </div>

      {/* Two main blocks */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* CATEGORÍAS Y PRODUCTOS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Categorías y Productos</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAddProdOpen(true)}><Plus className="h-4 w-4 mr-1" />Producto</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.categorias.map(cat => {
              const prods = productosByCategoria[cat];
              if (!prods || prods.length === 0) return null;
              return (
                <div key={cat} className="space-y-2">
                  <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">{cat}</h4>
                  <div className="grid gap-1.5">
                    {prods.map(p => (
                      <div key={p.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <ChefHat className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{p.nombre}</span>
                        </div>
                        <button onClick={() => setProductos(prev => prev.filter(x => x.id !== p.id))} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {productos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin productos asignados</p>}
          </CardContent>
        </Card>

        {/* MISE EN PLACE */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Mise en Place</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAddMiseOpen(true)}><Plus className="h-4 w-4 mr-1" />Elemento</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.gruposMise.map(grupo => {
              const items = miseByGrupo[grupo];
              if (!items || items.length === 0) return null;
              return (
                <div key={grupo} className="space-y-2">
                  <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">{grupo}</h4>
                  <div className="grid gap-1.5">
                    {items.map(m => (
                      <div key={m.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                        <span>{m.nombre}</span>
                        <button onClick={() => setMise(prev => prev.filter(x => x.id !== m.id))} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {mise.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin elementos de mise en place</p>}
          </CardContent>
        </Card>
      </div>

      {/* Add product dialog */}
      <Dialog open={addProdOpen} onOpenChange={setAddProdOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Añadir producto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre</Label><Input value={newProd.nombre} onChange={e => setNewProd(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div>
              <Label>Categoría</Label>
              <Select value={newProd.categoria} onValueChange={v => setNewProd(p => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{config.categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProdOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (newProd.nombre.trim()) {
                setProductos(prev => [...prev, { id: `new-${Date.now()}`, nombre: newProd.nombre.trim(), categoria: newProd.categoria }]);
                setNewProd({ nombre: "", categoria: config.categorias[0] || "" });
                setAddProdOpen(false);
              }
            }}>Añadir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add mise dialog */}
      <Dialog open={addMiseOpen} onOpenChange={setAddMiseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Añadir elemento de mise en place</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre</Label><Input value={newMise.nombre} onChange={e => setNewMise(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div>
              <Label>Grupo</Label>
              <Select value={newMise.grupo} onValueChange={v => setNewMise(p => ({ ...p, grupo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{config.gruposMise.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMiseOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (newMise.nombre.trim()) {
                setMise(prev => [...prev, { id: `new-${Date.now()}`, nombre: newMise.nombre.trim(), grupo: newMise.grupo }]);
                setNewMise({ nombre: "", grupo: config.gruposMise[0] || "" });
                setAddMiseOpen(false);
              }
            }}>Añadir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const defaultConfig: ConfigPartidas = {
  areas: ["COCINA", "BARRA"],
  partidas: ["FRIO + POSTRES", "FUEGOS + HORNO", "PLANCHA + FREIDORA"],
  categorias: [
    "PARA EMPEZAR", "ARROCES", "PRA VEGANOS", "DE LA MAR",
    "DE LA TIERRA", "MOMENTOS DULCES", "PARA NIÑOS",
  ],
  gruposMise: ["SECOS", "SALSAS", "FRESCOS", "CONGELADOS"],
  estados: ["activa", "inactiva", "en_revision"],
};

const SEED_PARTIDAS: { nombre: string; area: AreaPrincipal }[] = [
  { nombre: "FRIO + POSTRES", area: "COCINA" },
  { nombre: "FUEGOS + HORNO", area: "COCINA" },
  { nombre: "PLANCHA + FREIDORA", area: "COCINA" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildSeedPartidas(): Partida[] {
  return SEED_PARTIDAS.map((s, idx) => ({
    id: `seed-${idx}-${Date.now()}`,
    nombre: s.nombre,
    area: s.area,
    estado: "activa",
    creador: "",
    fechaActualizacion: todayISO(),
    productos: [],
    misEnPlace: [],
  }));
}

// ─── Main page ──────────────────────────────────────────────────
export function PartidasView() {
  const { empresaActual } = useEmpresa();
  const empresaId = empresaActual?.id || "habana";
  const empleados = getEmpleadosPorEmpresa(empresaId);
  const config = defaultConfig;

  const [partidas, setPartidas] = useState<Partida[]>([]);

  useEffect(() => {
    const existentes = getPartidasByEmpresa(empresaId);
    setPartidas(existentes.length > 0 ? existentes : buildSeedPartidas());
  }, [empresaId]);

  const [mainTab, setMainTab] = useState<"lista" | "pipeline" | "config">("lista");
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [selectedPartida, setSelectedPartida] = useState<Partida | null>(null);

  // Crear/editar partida
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ nombre: string; area: AreaPrincipal; estado: EstadoPartida }>({
    nombre: "",
    area: "COCINA",
    estado: "activa",
  });

  const abrirNuevo = () => {
    setEditingId(null);
    setForm({ nombre: "", area: "COCINA", estado: "activa" });
    setEditorOpen(true);
  };

  const abrirEditar = (p: Partida) => {
    setEditingId(p.id);
    setForm({ nombre: p.nombre, area: p.area, estado: p.estado });
    setEditorOpen(true);
  };

  const guardar = () => {
    const nombre = form.nombre.trim();
    if (!nombre) return;
    if (editingId) {
      setPartidas(prev => prev.map(p =>
        p.id === editingId
          ? { ...p, nombre, area: form.area, estado: form.estado, fechaActualizacion: todayISO() }
          : p,
      ));
    } else {
      setPartidas(prev => [
        ...prev,
        {
          id: `new-${Date.now()}`,
          nombre,
          area: form.area,
          estado: form.estado,
          creador: "",
          fechaActualizacion: todayISO(),
          productos: [],
          misEnPlace: [],
        },
      ]);
    }
    setEditorOpen(false);
  };

  const eliminar = (id: string) => {
    setPartidas(prev => prev.filter(p => p.id !== id));
  };

  // Config state
  const [cfgAreas, setCfgAreas] = useState(config.areas);
  const [cfgPartidas, setCfgPartidas] = useState(config.partidas);
  const [cfgCategorias, setCfgCategorias] = useState(config.categorias);
  const [cfgGruposMise, setCfgGruposMise] = useState(config.gruposMise);

  const filtered = partidas.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filtroEstado === "todos" || p.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  if (selectedPartida) {
    return <PartidaDetail partida={selectedPartida} onBack={() => setSelectedPartida(null)} empleados={empleados} config={config} />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{partidas.length}</p><p className="text-xs text-muted-foreground">Total partidas</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{partidas.filter(p => p.estado === "activa").length}</p><p className="text-xs text-muted-foreground">Activas</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{partidas.reduce((s, p) => s + p.productos.length, 0)}</p><p className="text-xs text-muted-foreground">Productos</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{partidas.reduce((s, p) => s + p.misEnPlace.length, 0)}</p><p className="text-xs text-muted-foreground">Mise en Place</p></CardContent></Card>
      </div>

      {/* Toolbar estándar (BARRA HORIZONTAL 1) */}
      {mainTab !== "config" && (
        <div className="space-y-3">
          <SubmoduleToolbar
            busqueda={search}
            onBusquedaChange={setSearch}
            placeholderBusqueda="Buscar"
            textoNuevo="Nueva partida"
            onNuevo={abrirNuevo}
          />
          {/* Filtro de estado (fuera de la toolbar) */}
          <div className="flex justify-end">
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="activa">Activa</SelectItem>
                <SelectItem value="inactiva">Inactiva</SelectItem>
                <SelectItem value="en_revision">En revisión</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={mainTab} onValueChange={v => setMainTab(v as typeof mainTab)}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList>
            <TabsTrigger value="lista"><List className="h-4 w-4 mr-1" />Lista</TabsTrigger>
            <TabsTrigger value="pipeline"><LayoutGrid className="h-4 w-4 mr-1" />Pipeline</TabsTrigger>
            <TabsTrigger value="config" aria-label="Configuración" className="ml-auto"><Settings2 className="h-4 w-4" strokeWidth={1.75} /></TabsTrigger>
          </TabsList>
        </div>

        {/* LIST VIEW */}
        <TabsContent value="lista">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partida</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Productos</TableHead>
                  <TableHead className="text-center">Mise en Place</TableHead>
                  <TableHead>Creador</TableHead>
                  <TableHead>Actualización</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => {
                  const emp = empleados.find((e) => e.id === p.creador);
                  return (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedPartida(p)}>
                      <TableCell className="font-semibold">{p.nombre}</TableCell>
                      <TableCell><Badge variant="outline">{p.area}</Badge></TableCell>
                      <TableCell><EstadoBadge estado={p.estado} /></TableCell>
                      <TableCell className="text-center">{p.productos.length}</TableCell>
                      <TableCell className="text-center">{p.misEnPlace.length}</TableCell>
                      <TableCell className="text-sm">{emp ? `${emp.nombre} ${emp.apellidos}` : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.fechaActualizacion}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => abrirEditar(p)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => eliminar(p.id)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No se encontraron partidas</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* PIPELINE VIEW */}
        <TabsContent value="pipeline">
          {/* Navigation tabs for quick access */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {filtered.map(p => (
              <Button key={p.id} variant="outline" size="sm" className="gap-1" onClick={() => setSelectedPartida(p)}>
                <ChefHat className="h-3.5 w-3.5" />{p.nombre}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => {
              const emp = empleados.find((e) => e.id === p.creador);
              return (
                <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPartida(p)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{p.nombre}</CardTitle>
                      <EstadoBadge estado={p.estado} />
                    </div>
                    <p className="text-xs text-muted-foreground">{p.area} · {emp ? `${emp.nombre} ${emp.apellidos}` : ""}</p>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">PRODUCTOS ({p.productos.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {p.productos.slice(0, 5).map(pr => (
                          <Badge key={pr.id} variant="secondary" className="text-[11px]">{pr.nombre}</Badge>
                        ))}
                        {p.productos.length > 5 && <Badge variant="outline" className="text-[11px]">+{p.productos.length - 5}</Badge>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">MISE EN PLACE ({p.misEnPlace.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {p.misEnPlace.slice(0, 4).map(m => (
                          <Badge key={m.id} variant="outline" className="text-[11px]">{m.nombre}</Badge>
                        ))}
                        {p.misEnPlace.length > 4 && <Badge variant="outline" className="text-[11px]">+{p.misEnPlace.length - 4}</Badge>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* CONFIG */}
        <TabsContent value="config">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigListEditor title="Áreas principales" items={cfgAreas} onAdd={v => setCfgAreas(p => [...p, v])} onRemove={i => setCfgAreas(p => p.filter((_, idx) => idx !== i))} />
            <ConfigListEditor title="Partidas" items={cfgPartidas} onAdd={v => setCfgPartidas(p => [...p, v])} onRemove={i => setCfgPartidas(p => p.filter((_, idx) => idx !== i))} />
            <ConfigListEditor title="Categorías de productos" items={cfgCategorias} onAdd={v => setCfgCategorias(p => [...p, v])} onRemove={i => setCfgCategorias(p => p.filter((_, idx) => idx !== i))} />
            <ConfigListEditor title="Grupos de Mise en Place" items={cfgGruposMise} onAdd={v => setCfgGruposMise(p => [...p, v])} onRemove={i => setCfgGruposMise(p => p.filter((_, idx) => idx !== i))} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Crear / editar partida */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar partida" : "Nueva partida"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. FRIO + POSTRES"
              />
            </div>
            <div>
              <Label>Área</Label>
              <Select value={form.area} onValueChange={v => setForm(f => ({ ...f, area: v as AreaPrincipal }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {config.areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v as EstadoPartida }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["activa", "inactiva", "en_revision"] as EstadoPartida[]).map(e => (
                    <SelectItem key={e} value={e}>{ESTADO_PARTIDA_LABELS[e]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={!form.nombre.trim()}>
              {editingId ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
