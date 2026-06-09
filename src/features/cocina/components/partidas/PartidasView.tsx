"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useTabQuery } from "@/shared/hooks/use-tab-query";
import { Partida, ProductoPartida, MisePlaceItem, ESTADO_PARTIDA_LABELS, EstadoPartida, type ConfigPartidas, type AreaPrincipal, getConfigPartidas } from "@/features/cocina/data/partidas";
import { listPartidas, createPartida, updatePartida, deletePartida, type PartidaRow } from "@/features/cocina/actions/partidas-actions";
import { getEmpleadosActivos, type EmpleadoActivo } from "@/features/rrhh/actions/empleados-actions";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ArrowLeft, Pencil, Trash2, ChefHat, Settings } from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
  type ToolbarFiltroActivo,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";

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
  empleados: EmpleadoActivo[];
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

  const creadorName = empleados.find(e => e.empleadoId === partida.creador);

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
        {/* MISE EN PLACE — Antes del servicio */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div className="space-y-0.5">
              <CardTitle className="text-lg">Mise en Place</CardTitle>
              <p className="text-xs font-medium text-muted-foreground">Antes del servicio</p>
            </div>
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

        {/* CATEGORÍAS Y PRODUCTOS — Durante el servicio */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div className="space-y-0.5">
              <CardTitle className="text-lg">Categorías y Productos</CardTitle>
              <p className="text-xs font-medium text-muted-foreground">Durante el servicio</p>
            </div>
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

function mapRowToPartida(r: PartidaRow): Partida {
  return {
    id: r.id,
    nombre: r.nombre,
    area: (r.area as AreaPrincipal) ?? "COCINA",
    estado: (r.estado as EstadoPartida) ?? "activa",
    creador: r.responsable ?? "",
    fechaActualizacion: (r.created_at ?? "").slice(0, 10),
    productos: [],
    misEnPlace: [],
  };
}

// ─── Main page ──────────────────────────────────────────────────
export function PartidasView() {
  const { empresaActual } = useEmpresa();
  const empresaId = empresaActual?.id || "habana";
  // OLA2-01: empleados reales (fuente única) para resolver el nombre del creador.
  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  useEffect(() => {
    let alive = true;
    getEmpleadosActivos(empresaActual?.dbId).then((r) => {
      if (alive) setEmpleados(r.ok ? r.data : []);
    });
    return () => {
      alive = false;
    };
  }, [empresaActual?.dbId]);
  const config = useMemo(() => getConfigPartidas(empresaId), [empresaId]);

  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const res = await listPartidas();
    if (res.ok) {
      setPartidas(res.data.map(mapRowToPartida));
    } else {
      toast.error("Error al cargar partidas");
      setPartidas([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar, empresaId]);

  const [tab, setTab] = useTabQuery(["lista", "config"] as const, "lista");
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
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

  const guardar = async () => {
    const nombre = form.nombre.trim();
    if (!nombre) return;
    const res = editingId
      ? await updatePartida(editingId, { nombre, area: form.area, estado: form.estado })
      : await createPartida({ nombre, area: form.area, estado: form.estado });
    if (!res.ok) {
      toast.error(("error" in res && res.error) || "No se pudo guardar la partida");
      return;
    }
    toast.success(editingId ? "Partida actualizada" : "Partida creada");
    setEditorOpen(false);
    await recargar();
  };

  const eliminar = async (id: string) => {
    const res = await deletePartida(id);
    if (!res.ok) {
      toast.error(("error" in res && res.error) || "No se pudo eliminar la partida");
      return;
    }
    await recargar();
  };

  // Config state
  const [cfgAreas, setCfgAreas] = useState(config.areas);
  const [cfgPartidas, setCfgPartidas] = useState(config.partidas);
  const [cfgCategorias, setCfgCategorias] = useState(config.categorias);
  const [cfgGruposMise, setCfgGruposMise] = useState(config.gruposMise);

  const filtered = useMemo(() => {
    let list = partidas;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p) => p.nombre.toLowerCase().includes(s));
    }
    list = aplicarFiltrosToolbar(list, filtros, (p, campo) => {
      if (campo === "estado") return ESTADO_PARTIDA_LABELS[p.estado];
      if (campo === "area") return p.area;
      return (p as unknown as Record<string, unknown>)[campo];
    });
    return list;
  }, [partidas, search, filtros]);

  if (selectedPartida) {
    return <PartidaDetail partida={selectedPartida} onBack={() => setSelectedPartida(null)} empleados={empleados} config={config} />;
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "partida", label: "Partida", bloqueada: true },
    { campo: "area", label: "Área" },
    { campo: "estado", label: "Estado" },
    { campo: "productos", label: "Productos" },
    { campo: "mise", label: "Mise en Place" },
    { campo: "creador", label: "Creador" },
    { campo: "actualizacion", label: "Actualización" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (p: Partida) => ReactNode }> = {
    partida: {
      th: <TableHead key="partida" className="text-xs min-w-[200px]">Partida</TableHead>,
      td: (p) => <TableCell key="partida" className="font-semibold">{p.nombre}</TableCell>,
    },
    area: {
      th: (
        <TableColumnHeader
          key="area"
          label="Área"
          campo="area"
          filtroTipo="lista"
          opciones={config.areas}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (p) => <TableCell key="area"><Badge variant="outline" className="text-[10px]">{p.area}</Badge></TableCell>,
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
          label="Estado"
          campo="estado"
          filtroTipo="lista"
          opciones={(Object.keys(ESTADO_PARTIDA_LABELS) as EstadoPartida[]).map((e) => ESTADO_PARTIDA_LABELS[e])}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (p) => <TableCell key="estado"><EstadoBadge estado={p.estado} /></TableCell>,
    },
    productos: {
      th: <TableHead key="productos" className="text-xs text-center">Productos</TableHead>,
      td: (p) => <TableCell key="productos" className="text-center text-sm">{p.productos.length}</TableCell>,
    },
    mise: {
      th: <TableHead key="mise" className="text-xs text-center">Mise en Place</TableHead>,
      td: (p) => <TableCell key="mise" className="text-center text-sm">{p.misEnPlace.length}</TableCell>,
    },
    creador: {
      th: <TableHead key="creador" className="text-xs">Creador</TableHead>,
      td: (p) => {
        const emp = empleados.find((e) => e.empleadoId === p.creador);
        return <TableCell key="creador" className="text-sm text-muted-foreground">{emp ? `${emp.nombre} ${emp.apellidos}` : "—"}</TableCell>;
      },
    },
    actualizacion: {
      th: <TableHead key="actualizacion" className="text-xs">Actualización</TableHead>,
      td: (p) => <TableCell key="actualizacion" className="text-sm text-muted-foreground">{p.fechaActualizacion}</TableCell>,
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Toolbar estándar (BARRA HORIZONTAL 1) */}
      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        textoNuevo="Nueva"
        onNuevo={abrirNuevo}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <Button
            size="icon"
            variant={tab === "config" ? "default" : "outline"}
            className="h-9 w-9"
            onClick={() => setTab(tab === "config" ? "lista" : "config")}
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "lista" | "config")}>
        <TabsContent value="lista" className="space-y-4 mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                  <TableHead className="text-xs w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-12 text-muted-foreground">
                      {loading ? "Cargando partidas..." : "No se encontraron partidas."}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedPartida(p)}>
                    {columnasRender.map((c) => columnDefs[c.campo]?.td(p))}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditar(p)} aria-label="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => eliminar(p.id)} aria-label="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-4">
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
