"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getSalariosEmpresa, type PuestoSalarial, type NormaSalarial, DEPARTAMENTOS_DISPONIBLES } from "@/features/rrhh/data/salarios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfigButton } from "@/shared/components/config-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, Plus, Eye, Settings2, DollarSign, Clock, Calendar,
  Briefcase, ChevronDown, ChevronRight, Target, AlertTriangle, FileText,
} from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { salariosIO } from "@/features/rrhh/io/salarios.io";

const estadoBadge = (e: string) => {
  switch (e) {
    case "activo": return <Badge className="bg-emerald-100 text-emerald-700 border-0">Activo</Badge>;
    case "borrador": return <Badge className="bg-amber-100 text-amber-700 border-0">Borrador</Badge>;
    default: return <Badge variant="secondary">Inactivo</Badge>;
  }
};

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

export function SalariosView() {
  const { empresaActual } = useEmpresa();
  const data = useMemo(() => getSalariosEmpresa(empresaActual.id), [empresaActual.id]);

  type View = "list" | "detail" | "config" | "normas";
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = data.puestos.find((p) => p.id === selectedId) ?? null;

  if (view === "detail" && selected) return <DetalleView puesto={selected} onBack={() => setView("list")} />;
  if (view === "config") return <ConfigView puestos={data.puestos} normas={data.normas} onBack={() => setView("list")} />;
  if (view === "normas") return <NormasView normas={data.normas} onBack={() => setView("list")} />;

  return (
    <ListView
      puestos={data.puestos}
      onDetail={(id) => { setSelectedId(id); setView("detail"); }}
      onConfig={() => setView("config")}
      onNormas={() => setView("normas")}
      empresaId={empresaActual.id}
    />
  );
}

function ListView({
  puestos,
  onDetail,
  onConfig,
  onNormas,
  empresaId,
}: {
  puestos: PuestoSalarial[];
  onDetail: (id: string) => void;
  onConfig: () => void;
  onNormas: () => void;
  empresaId: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const deptos = useMemo(
    () => [...new Set(puestos.map((p) => p.departamento))].sort(),
    [puestos],
  );
  const jornadas = useMemo(
    () => [...new Set(puestos.map((p) => p.jornadaContrato))].sort(),
    [puestos],
  );

  const acceso = (p: PuestoSalarial, campo: string): unknown => {
    if (campo === "departamento") return p.departamento;
    if (campo === "jornada") return p.jornadaContrato;
    if (campo === "estado") return p.estado === "activo" ? "Activo" : p.estado === "borrador" ? "Borrador" : "Inactivo";
    if (campo === "salarioNeto") return p.salarioNeto;
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

  const grouped = useMemo(() => {
    const map: Record<string, PuestoSalarial[]> = {};
    filtered.forEach((p) => {
      (map[p.departamento] ??= []).push(p);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const toggle = (d: string) => setExpanded((prev) => ({ ...prev, [d]: !prev[d] }));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onNormas}>
            <AlertTriangle className="h-4 w-4 mr-1" /> Normas y cláusulas
          </Button>
          <ConfigButton onClick={onConfig} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Briefcase className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Puestos</p><p className="text-xl font-bold">{puestos.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-xs text-muted-foreground">Salario medio</p><p className="text-xl font-bold">{eur(Math.round(puestos.reduce((a, p) => a + p.salarioNeto, 0) / (puestos.filter(p => p.salarioNeto > 0).length || 1)))}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Clock className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Departamentos</p><p className="text-xl font-bold">{deptos.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Calendar className="h-5 w-5 text-amber-600" /></div>
            <div><p className="text-xs text-muted-foreground">Activos</p><p className="text-xl font-bold">{puestos.filter(p => p.estado === "activo").length}</p></div>
          </CardContent>
        </Card>
      </div>

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar puesto o departamento..."
        textoNuevo="Crear puesto"
        onNuevo={() => { /* TODO: abrir crear puesto */ }}
        campos={[
          { campo: "departamento", label: "Departamento", tipo: "lista", opciones: deptos },
          { campo: "jornada", label: "Jornada", tipo: "lista", opciones: jornadas },
          { campo: "estado", label: "Estado", tipo: "lista", opciones: ["Activo", "Borrador", "Inactivo"] },
          { campo: "salarioNeto", label: "Salario neto", tipo: "numero" },
          { campo: "horasSemanales", label: "Horas / semana", tipo: "numero" },
        ]}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        ordenOpciones={[
          { campo: "puesto", label: "Puesto" },
          { campo: "departamento", label: "Departamento" },
          { campo: "salarioNeto", label: "Salario neto" },
          { campo: "horasSemanales", label: "Horas / semana" },
        ]}
        orden={orden}
        onOrdenChange={setOrden}
        columnas={[
          { campo: "puesto", label: "Puesto" },
          { campo: "nominaNeta", label: "Nómina neta" },
          { campo: "efectivoExtra", label: "Efectivo extra" },
          { campo: "salarioNeto", label: "Salario neto" },
          { campo: "jornada", label: "Jornada" },
          { campo: "horasSemanales", label: "Horas/sem" },
          { campo: "diasLibres", label: "Días libres" },
          { campo: "estado", label: "Estado" },
        ]}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        extraDerecha={
          <IOActions
            config={salariosIO}
            context={{ empresaId }}
            onSuccess={() => window.location.reload()}
          />
        }
      />

      {grouped.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No se encontraron puestos con los filtros aplicados.</CardContent></Card>
      )}

      {grouped.map(([depto, items]) => {
        const open = expanded[depto] !== false;
        return (
          <Card key={depto}>
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              onClick={() => toggle(depto)}
            >
              <div className="flex items-center gap-3">
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <span className="font-semibold text-foreground">{depto}</span>
                <Badge variant="secondary" className="text-xs">{items.length} puesto{items.length !== 1 ? "s" : ""}</Badge>
              </div>
            </button>
            {open && (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Puesto</TableHead>
                      <TableHead className="text-right">Nómina neta</TableHead>
                      <TableHead className="text-right">Efectivo extra</TableHead>
                      <TableHead className="text-right">Salario neto</TableHead>
                      <TableHead className="text-center">Jornada</TableHead>
                      <TableHead className="text-center">Horas/sem</TableHead>
                      <TableHead className="text-center">Días libres</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{p.puesto}</TableCell>
                        <TableCell className="text-right">{eur(p.nominaNeta)}</TableCell>
                        <TableCell className="text-right">{p.efectivoExtra > 0 ? eur(p.efectivoExtra) : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{eur(p.salarioNeto)}</TableCell>
                        <TableCell className="text-center">{p.jornadaContrato}</TableCell>
                        <TableCell className="text-center">{p.horasSemanales}h</TableCell>
                        <TableCell className="text-center">{p.diasLibres}</TableCell>
                        <TableCell className="text-center">{estadoBadge(p.estado)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => onDetail(p.id)}>
                            <Eye className="h-4 w-4 mr-1" /> Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function DetalleView({ puesto, onBack }: { puesto: PuestoSalarial; onBack: () => void }) {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-base font-semibold text-foreground">{puesto.puesto}</h2>
          <p className="text-muted-foreground text-sm">Departamento: {puesto.departamento}</p>
        </div>
        <div className="ml-auto">{estadoBadge(puesto.estado)}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Vacaciones", value: puesto.vacaciones, icon: Calendar, color: "text-blue-600 bg-blue-500/10" },
          { label: "Nómina neta", value: eur(puesto.nominaNeta), icon: FileText, color: "text-emerald-600 bg-emerald-500/10" },
          { label: "Efectivo extra", value: puesto.efectivoExtra > 0 ? eur(puesto.efectivoExtra) : "—", icon: DollarSign, color: "text-amber-600 bg-amber-500/10" },
          { label: "Salario neto", value: eur(puesto.salarioNeto), icon: DollarSign, color: "text-primary bg-primary/10" },
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Condiciones del puesto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Horario semanal</p>
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
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Jornada de contrato</p>
                <p className="font-medium">{puesto.jornadaContrato}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Distribución semanal</CardTitle>
          <CardDescription>Horario de referencia por día de la semana</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {puesto.horarioSemanal.map((h) => (
                  <TableHead key={h.dia} className="text-center">{h.dia}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                {puesto.horarioSemanal.map((h) => (
                  <TableCell key={h.dia} className="text-center">
                    {h.turno === "LIBRE" ? (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">LIBRE</Badge>
                    ) : (
                      <span className="text-sm font-medium">{h.turno}</span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

      <p className="text-xs text-muted-foreground text-right">Última actualización: {puesto.updatedAt}</p>
    </div>
  );
}

function ConfigView({ puestos, normas, onBack }: { puestos: PuestoSalarial[]; normas: NormaSalarial[]; onBack: () => void }) {
  const [tab, setTab] = useState("puestos");

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-base font-semibold text-foreground">Configuración de salarios</h2>
          <p className="text-muted-foreground text-sm">Gestión de departamentos, puestos y condiciones</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
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
                    <TableHead className="text-right">Salario neto</TableHead>
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
                      <TableCell className="text-right">{eur(p.salarioNeto)}</TableCell>
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

function NormasView({ normas, onBack }: { normas: NormaSalarial[]; onBack: () => void }) {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-base font-semibold text-foreground">Normas y cláusulas salariales</h2>
          <p className="text-muted-foreground text-sm">Reglas aplicables a toda la estructura salarial de la empresa</p>
        </div>
      </div>

      <div className="space-y-4">
        {normas.map((n, i) => (
          <Card key={n.id}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{n.titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{n.descripcion}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
