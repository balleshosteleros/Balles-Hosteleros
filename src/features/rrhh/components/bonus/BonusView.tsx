"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  type Bonus, type TablaTramos, type TramoBonus, type ReglaBonus,
  type EstadoBonus, type PeriodicidadBonus, type TipoDestinatario,
  getBonusPorEmpresa, getConfigBonusEmpresa, getResultadosPorBonus, crearBonusVacio,
  ESTADO_BONUS_LABEL, ESTADO_BONUS_COLOR, PERIODICIDAD_LABEL,
  ESTADO_RESULTADO_LABEL, ESTADO_RESULTADO_COLOR,
} from "@/features/rrhh/data/bonus";
import { DEPARTAMENTOS } from "@/features/rrhh/data/rrhh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, MoreHorizontal, ArrowLeft, Trash2, TrendingUp, Package, ClipboardCheck,
  Heart, Coins, Gift, AlertTriangle, CreditCard, ShieldCheck, Users, Settings2, FileText,
  BarChart3, Eye, Calendar, CheckCircle2, Info,
} from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp, Package, ClipboardCheck, Heart, Coins, Gift, BarChart3,
};
function BonusIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] || Gift;
  return <Icon className={className} />;
}

function ListadoBonus({ bonus, onSelect, onCrear }: {
  bonus: Bonus[];
  onSelect: (b: Bonus, tab?: string) => void;
  onCrear: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);

  const tiposUsados = useMemo(
    () => [...new Set(bonus.map((b) => b.tipo))].sort(),
    [bonus],
  );

  const acceso = (b: Bonus, campo: string): unknown => {
    if (campo === "estado") return ESTADO_BONUS_LABEL[b.estado];
    if (campo === "tipo") return b.tipo;
    if (campo === "periodicidad") return b.periodicidad;
    if (campo === "nombre") return b.nombre;
    return (b as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let list = bonus.filter((b) => {
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!b.nombre.toLowerCase().includes(q) && !b.tipo.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    list = aplicarFiltrosToolbar(list, filtros, acceso);
    list = aplicarOrdenToolbar(list, orden, acceso);
    return list;
  }, [bonus, busqueda, filtros, orden]);

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar bonus..."
        onNuevo={onCrear}
        campos={[
          {
            campo: "estado",
            label: "Estado",
            tipo: "lista",
            opciones: (Object.keys(ESTADO_BONUS_LABEL) as EstadoBonus[]).map((k) => ESTADO_BONUS_LABEL[k]),
          },
          { campo: "tipo", label: "Tipo", tipo: "lista", opciones: tiposUsados },
          {
            campo: "periodicidad",
            label: "Periodicidad",
            tipo: "lista",
            opciones: [...new Set(bonus.map((b) => b.periodicidad))],
          },
        ]}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        ordenOpciones={[
          { campo: "nombre", label: "Nombre" },
          { campo: "tipo", label: "Tipo" },
          { campo: "estado", label: "Estado" },
        ]}
        orden={orden}
        onOrdenChange={setOrden}
      />

      <div className="grid gap-4">
        {filtered.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No hay bonus configurados</CardContent></Card>
        )}
        {filtered.map((b) => (
          <Card key={b.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelect(b, "detalles")}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BonusIcon name={b.icono} className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{b.nombre}</span>
                    <Badge className={`${ESTADO_BONUS_COLOR[b.estado]} text-[10px]`}>{ESTADO_BONUS_LABEL[b.estado]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{b.tipo}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{b.descripcion}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{b.destinatariosTexto}</span>
                    <span>{PERIODICIDAD_LABEL[b.periodicidad]}</span>
                    {b.tablas.length > 0 && <span>{b.tablas.reduce((s, t) => s + t.tramos.length, 0)} tramos</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onSelect(b, "detalles"); }}>
                    <FileText className="h-3.5 w-3.5 mr-1" />Ver detalles
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onSelect(b, "resultados"); }}>
                    <BarChart3 className="h-3.5 w-3.5 mr-1" />Ver resultados
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(b, "config"); }}>
                        <Settings2 className="h-4 w-4 mr-2" />Configuración
                      </DropdownMenuItem>
                      <DropdownMenuItem>Duplicar</DropdownMenuItem>
                      <DropdownMenuItem>Desactivar</DropdownMenuItem>
                      <DropdownMenuItem>Archivar</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TabDetalles({ bonus, config }: { bonus: Bonus; config: ReturnType<typeof getConfigBonusEmpresa> }) {
  const b = bonus;
  return (
    <div className="space-y-6 mt-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4 text-primary" />Información general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><span className="text-xs font-medium text-muted-foreground">Descripción</span><p className="text-sm mt-0.5">{b.descripcion || "—"}</p></div>
            <Separator />
            <div><span className="text-xs font-medium text-muted-foreground">Objetivo</span><p className="text-sm mt-0.5">{b.objetivo || "—"}</p></div>
            <Separator />
            <div className="flex gap-6">
              <div><span className="text-xs font-medium text-muted-foreground">Tipo</span><p className="text-sm mt-0.5">{b.tipo}</p></div>
              <div><span className="text-xs font-medium text-muted-foreground">Periodicidad</span><p className="text-sm mt-0.5">{PERIODICIDAD_LABEL[b.periodicidad]}</p></div>
              <div><span className="text-xs font-medium text-muted-foreground">Estado</span><div className="mt-0.5"><Badge className={`${ESTADO_BONUS_COLOR[b.estado]} text-[10px]`}>{ESTADO_BONUS_LABEL[b.estado]}</Badge></div></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Cómo funciona este bonus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-line">{b.explicacion || "Sin explicación configurada."}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />¿A quién aplica?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{b.destinatariosTexto}</p>
          {b.destinatarios.ids.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {b.destinatarios.ids.map((id) => <Badge key={id} variant="secondary" className="text-xs">{id}</Badge>)}
            </div>
          )}
        </CardContent>
      </Card>

      {b.premio && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <Gift className="h-5 w-5 text-primary shrink-0" />
            <div><div className="text-sm font-medium text-foreground">Premio</div><div className="text-sm text-muted-foreground">{b.premio}</div></div>
          </CardContent>
        </Card>
      )}

      {b.tablas.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Tablas de tramos y comisiones</h3>
          {b.tablas.map((tabla) => (
            <Card key={tabla.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{tabla.titulo}</CardTitle>
                {tabla.descripcion && <CardDescription className="text-xs">{tabla.descripcion}</CardDescription>}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Condición</TableHead>
                      <TableHead>Comisión</TableHead>
                      <TableHead>Observaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tabla.tramos.map((tr) => (
                      <TableRow key={tr.id}>
                        <TableCell className="font-medium">{tr.condicion}</TableCell>
                        <TableCell className="font-semibold text-primary">{tr.comision}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{tr.observaciones || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {b.reglas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Reglas y condiciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {b.reglas.map((r) => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div><p className="text-sm font-medium">{r.titulo}</p><p className="text-sm text-muted-foreground">{r.descripcion}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {b.formaPago && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />Forma de pago</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{b.formaPago}</p>
          </CardContent>
        </Card>
      )}

      {config.normas.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Normas y cláusulas generales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {config.normas.map((n, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-destructive font-bold mt-0.5">·</span>
                <span className="text-foreground/80">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TabResultados({ bonus, empresaId }: { bonus: Bonus; empresaId: string }) {
  const resultados = getResultadosPorBonus(empresaId, bonus.id);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (resultados.length === 0) {
    return (
      <div className="mt-4">
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">Sin resultados registrados</p>
            <p className="text-xs text-muted-foreground mt-1">Los resultados aparecerán aquí cuando se calculen los periodos correspondientes</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>Periodicidad: <span className="font-medium text-foreground">{PERIODICIDAD_LABEL[bonus.periodicidad]}</span></span>
        <span className="text-muted-foreground/50">·</span>
        <span>{resultados.length} resultado{resultados.length !== 1 ? "s" : ""} registrado{resultados.length !== 1 ? "s" : ""}</span>
      </div>

      {resultados.map((r) => {
        const isExpanded = expandedId === r.id;
        return (
          <Card key={r.id} className={`transition-shadow ${isExpanded ? "shadow-md ring-1 ring-primary/20" : "hover:shadow-sm"}`}>
            <CardContent className="p-0">
              <button
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors rounded-lg"
                onClick={() => setExpandedId(isExpanded ? null : r.id)}
              >
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-foreground">{r.periodo}</span>
                    <Badge className={`${ESTADO_RESULTADO_COLOR[r.estado]} text-[10px]`}>{ESTADO_RESULTADO_LABEL[r.estado]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{r.resumen}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-foreground">{r.importe}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Importe</p>
                </div>
                <Eye className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? "text-primary rotate-90" : "text-muted-foreground"}`} />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4">
                  <Separator className="mb-4" />
                  <div className="bg-muted/40 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Desglose del resultado</h4>
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
                      {Object.entries(r.detalles).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                          <span className="text-sm text-muted-foreground">{key}</span>
                          <span className="text-sm font-medium text-foreground">{val as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TabConfiguracion({ bonus, config, onChange }: {
  bonus: Bonus;
  config: ReturnType<typeof getConfigBonusEmpresa>;
  onChange: (p: Partial<Bonus>) => void;
}) {
  const b = bonus;

  const addTabla = () => {
    const t: TablaTramos = { id: `t-${Date.now()}`, titulo: "", descripcion: "", tramos: [] };
    onChange({ tablas: [...b.tablas, t] });
  };
  const updateTabla = (idx: number, p: Partial<TablaTramos>) => {
    const ts = [...b.tablas]; ts[idx] = { ...ts[idx], ...p }; onChange({ tablas: ts });
  };
  const removeTabla = (idx: number) => onChange({ tablas: b.tablas.filter((_, i) => i !== idx) });
  const addTramo = (tIdx: number) => {
    const tr: TramoBonus = { id: `tr-${Date.now()}`, condicion: "", comision: "", observaciones: "" };
    const ts = [...b.tablas]; ts[tIdx] = { ...ts[tIdx], tramos: [...ts[tIdx].tramos, tr] }; onChange({ tablas: ts });
  };
  const updateTramo = (tIdx: number, trIdx: number, p: Partial<TramoBonus>) => {
    const ts = [...b.tablas]; const trs = [...ts[tIdx].tramos]; trs[trIdx] = { ...trs[trIdx], ...p };
    ts[tIdx] = { ...ts[tIdx], tramos: trs }; onChange({ tablas: ts });
  };
  const removeTramo = (tIdx: number, trIdx: number) => {
    const ts = [...b.tablas]; ts[tIdx] = { ...ts[tIdx], tramos: ts[tIdx].tramos.filter((_, i) => i !== trIdx) }; onChange({ tablas: ts });
  };
  const addRegla = () => {
    const r: ReglaBonus = { id: `r-${Date.now()}`, titulo: "", descripcion: "" };
    onChange({ reglas: [...b.reglas, r] });
  };
  const updateRegla = (idx: number, p: Partial<ReglaBonus>) => {
    const rs = [...b.reglas]; rs[idx] = { ...rs[idx], ...p }; onChange({ reglas: rs });
  };
  const removeRegla = (idx: number) => onChange({ reglas: b.reglas.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-6 mt-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Información general</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>Nombre</Label><Input value={b.nombre} onChange={(e) => onChange({ nombre: e.target.value })} /></div>
            <div className="space-y-1"><Label>Descripción</Label><Textarea value={b.descripcion} onChange={(e) => onChange({ descripcion: e.target.value })} rows={2} /></div>
            <div className="space-y-1"><Label>Objetivo</Label><Textarea value={b.objetivo} onChange={(e) => onChange({ objetivo: e.target.value })} rows={2} /></div>
            <div className="space-y-1"><Label>Tipo</Label><Input value={b.tipo} onChange={(e) => onChange({ tipo: e.target.value })} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Explicación del cálculo</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={b.explicacion} onChange={(e) => onChange({ explicacion: e.target.value })} rows={8} placeholder="Explica cómo funciona este bonus..." />
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Estado</CardTitle></CardHeader>
          <CardContent>
            <Select value={b.estado} onValueChange={(v) => onChange({ estado: v as EstadoBonus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ESTADO_BONUS_LABEL) as EstadoBonus[]).map((s) => (
                  <SelectItem key={s} value={s}>{ESTADO_BONUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Periodicidad</CardTitle></CardHeader>
          <CardContent>
            <Select value={b.periodicidad} onValueChange={(v) => onChange({ periodicidad: v as PeriodicidadBonus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIODICIDAD_LABEL) as PeriodicidadBonus[]).map((p) => (
                  <SelectItem key={p} value={p}>{PERIODICIDAD_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Premio (si aplica)</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={b.premio} onChange={(e) => onChange({ premio: e.target.value })} rows={2} placeholder="Describe el premio..." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Destinatarios</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Select value={b.destinatarios.tipo} onValueChange={(v) => onChange({ destinatarios: { tipo: v as TipoDestinatario, ids: [] } })}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo el equipo</SelectItem>
                <SelectItem value="roles">Por roles</SelectItem>
                <SelectItem value="departamentos">Por departamento</SelectItem>
              </SelectContent>
            </Select>
            <Input value={b.destinatariosTexto} onChange={(e) => onChange({ destinatariosTexto: e.target.value })} placeholder="Texto de destinatarios" className="flex-1" />
          </div>
          {b.destinatarios.tipo === "departamentos" && (
            <div className="flex flex-wrap gap-2">
              {DEPARTAMENTOS.map((d) => (
                <Badge key={d} variant={b.destinatarios.ids.includes(d) ? "default" : "outline"} className="cursor-pointer"
                  onClick={() => {
                    const ids = b.destinatarios.ids.includes(d) ? b.destinatarios.ids.filter((x) => x !== d) : [...b.destinatarios.ids, d];
                    onChange({ destinatarios: { ...b.destinatarios, ids } });
                  }}>{d}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" />Tablas de tramos</h3>
        {b.tablas.map((tabla, tIdx) => (
          <Card key={tabla.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <Input value={tabla.titulo} onChange={(e) => updateTabla(tIdx, { titulo: e.target.value })} placeholder="Título" className="font-semibold" />
                  <Input value={tabla.descripcion} onChange={(e) => updateTabla(tIdx, { descripcion: e.target.value })} placeholder="Descripción (opcional)" className="text-sm" />
                </div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeTabla(tIdx)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Condición</TableHead><TableHead>Comisión</TableHead><TableHead>Observaciones</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {tabla.tramos.map((tr, trIdx) => (
                    <TableRow key={tr.id}>
                      <TableCell><Input value={tr.condicion} onChange={(e) => updateTramo(tIdx, trIdx, { condicion: e.target.value })} className="h-8" /></TableCell>
                      <TableCell><Input value={tr.comision} onChange={(e) => updateTramo(tIdx, trIdx, { comision: e.target.value })} className="h-8 w-[120px] font-semibold" /></TableCell>
                      <TableCell><Input value={tr.observaciones} onChange={(e) => updateTramo(tIdx, trIdx, { observaciones: e.target.value })} className="h-8" /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeTramo(tIdx, trIdx)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => addTramo(tIdx)}><Plus className="h-3.5 w-3.5 mr-1" />Añadir tramo</Button>
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" className="w-full" onClick={addTabla}><Plus className="h-4 w-4 mr-1" />Añadir tabla</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Reglas y condiciones</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {b.reglas.map((r, idx) => (
            <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <ShieldCheck className="h-4 w-4 text-primary mt-1 shrink-0" />
              <div className="flex-1 space-y-1">
                <Input value={r.titulo} onChange={(e) => updateRegla(idx, { titulo: e.target.value })} placeholder="Título" className="h-8 font-medium" />
                <Textarea value={r.descripcion} onChange={(e) => updateRegla(idx, { descripcion: e.target.value })} rows={2} placeholder="Descripción" className="text-sm" />
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRegla(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={addRegla}><Plus className="h-3.5 w-3.5 mr-1" />Añadir regla</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" />Forma de pago</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={b.formaPago} onChange={(e) => onChange({ formaPago: e.target.value })} rows={4} placeholder="Describe cómo y cuándo se liquida..." />
        </CardContent>
      </Card>

      {config.normas.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Normas y cláusulas generales</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {config.normas.map((n, i) => (
              <div key={i} className="flex items-start gap-2 text-sm"><span className="text-destructive font-bold mt-0.5">·</span><span className="text-foreground/80">{n}</span></div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetalleBonus({ bonus: initial, config, empresaId, onBack, initialTab = "detalles" }: {
  bonus: Bonus;
  config: ReturnType<typeof getConfigBonusEmpresa>;
  empresaId: string;
  onBack: () => void;
  initialTab?: string;
}) {
  const [b, setB] = useState<Bonus>(JSON.parse(JSON.stringify(initial)));
  const [tab, setTab] = useState(initialTab);
  const update = (p: Partial<Bonus>) => setB((prev) => ({ ...prev, ...p }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BonusIcon name={b.icono} className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground">{b.nombre || "Nuevo bonus"}</h2>
            <Badge className={`${ESTADO_BONUS_COLOR[b.estado]} text-[10px]`}>{ESTADO_BONUS_LABEL[b.estado]}</Badge>
            <Badge variant="outline" className="text-[10px]">{PERIODICIDAD_LABEL[b.periodicidad]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{b.destinatariosTexto}</p>
        </div>
        {tab === "config" && (
          <div className="flex gap-2">
            <Button variant="outline">Guardar borrador</Button>
            <Button>Guardar</Button>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="detalles" className="gap-1.5"><FileText className="h-4 w-4" />Ver detalles</TabsTrigger>
          <TabsTrigger value="resultados" className="gap-1.5"><BarChart3 className="h-4 w-4" />Ver resultados</TabsTrigger>
          <TabsTrigger value="config" aria-label="Configuración" className="ml-auto"><Settings2 className="h-4 w-4" strokeWidth={1.75} /></TabsTrigger>
        </TabsList>

        <TabsContent value="detalles">
          <TabDetalles bonus={b} config={config} />
        </TabsContent>
        <TabsContent value="resultados">
          <TabResultados bonus={b} empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="config">
          <TabConfiguracion bonus={b} config={config} onChange={update} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function BonusView() {
  const { empresaActual } = useEmpresa();
  const eId = empresaActual.id;
  const [bonusList, setBonusList] = useState<Bonus[]>(() => getBonusPorEmpresa(eId));
  const config = getConfigBonusEmpresa(eId);
  const [selected, setSelected] = useState<{ bonus: Bonus; tab: string } | null>(null);

  const [prevEmpresa, setPrevEmpresa] = useState(eId);
  if (prevEmpresa !== eId) {
    setPrevEmpresa(eId);
    setBonusList(getBonusPorEmpresa(eId));
    setSelected(null);
  }

  const handleCrear = () => {
    const nuevo = crearBonusVacio(eId);
    setBonusList((prev) => [nuevo, ...prev]);
    setSelected({ bonus: nuevo, tab: "config" });
  };

  const handleSelect = (b: Bonus, tab = "detalles") => {
    setSelected({ bonus: b, tab });
  };

  if (selected) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <DetalleBonus bonus={selected.bonus} config={config} empresaId={eId} onBack={() => setSelected(null)} initialTab={selected.tab} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <ListadoBonus bonus={bonusList} onSelect={handleSelect} onCrear={handleCrear} />
    </div>
  );
}
