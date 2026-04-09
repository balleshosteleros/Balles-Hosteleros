import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Plus, TrendingUp, TrendingDown, BarChart3, FileText, Calculator, ArrowLeft, Landmark, Target, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import {
  SAMPLE_ESTUDIOS, ESCENARIOS, EstudioApertura, DatosProyecto, EstructuraCostes,
  calcularEscenario, calcularPilar, CostePilar,
} from "@/data/aperturas";
import { ProcedenciaTab } from "@/components/aperturas/ProcedenciaTab";
import { DestinoTab } from "@/components/aperturas/DestinoTab";
import { AmortizacionTab } from "@/components/aperturas/AmortizacionTab";

const COLORS = ["hsl(var(--primary))", "hsl(210 70% 50%)", "hsl(150 60% 45%)", "hsl(40 90% 55%)", "hsl(340 70% 50%)"];
const PILAR_COLORS = ["hsl(210 70% 55%)", "hsl(340 65% 55%)", "hsl(150 60% 45%)", "hsl(40 90% 55%)"];
const PILAR_NAMES = ["Generales", "Personal", "Producto", "Marketing"];

function fmt(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

export default function DireccionAperturas() {
  const { empresaActual } = useEmpresa();
  const [estudios, setEstudios] = useState<EstudioApertura[]>(SAMPLE_ESTUDIOS);
  const [selected, setSelected] = useState<EstudioApertura | null>(null);
  const [showNew, setShowNew] = useState(false);

  if (selected) {
    return <DetalleEstudio estudio={selected} onBack={() => setSelected(null)} onUpdate={(e) => { setEstudios(prev => prev.map(x => x.id === e.id ? e : x)); setSelected(e); }} />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">APERTURAS</h1>
          <p className="text-muted-foreground text-sm">{empresaActual.nombre} — Estudios de viabilidad de nuevas aperturas</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nuevo estudio</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuevo estudio de apertura</DialogTitle></DialogHeader>
            <NuevoEstudioForm onSave={(e) => { setEstudios(prev => [...prev, e]); setShowNew(false); }} onClose={() => setShowNew(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {estudios.map(e => {
          const esc = calcularEscenario(e.datos.ventasEstimadas, 1, e.costes);
          const viable = esc.beneficio > 0;
          return (
            <Card key={e.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(e)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{e.datos.nombre}</CardTitle>
                  <Badge variant={viable ? "default" : "destructive"}>{viable ? "Viable" : "No viable"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{e.datos.ciudad} — {e.datos.zona}</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span>Facturación est.: <strong>{fmt(e.datos.ventasEstimadas)}€</strong></span>
                  <span>Beneficio est.: <strong className={viable ? "text-green-600" : "text-red-600"}>{fmt(esc.beneficio)}€</strong></span>
                  <span>Plazas: {e.datos.plazas}</span>
                  <span>Margen: {esc.margen.toFixed(1)}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Creado: {e.creado}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ── Detalle completo del estudio ── */
function DetalleEstudio({ estudio, onBack, onUpdate }: { estudio: EstudioApertura; onBack: () => void; onUpdate: (e: EstudioApertura) => void }) {
  const [costes, setCostes] = useState<EstructuraCostes>(estudio.costes);
  const ventas = estudio.datos.ventasEstimadas;

  const updatePilar = (key: keyof EstructuraCostes, field: keyof CostePilar, val: number) => {
    const next = { ...costes, [key]: { ...costes[key], [field]: val } };
    setCostes(next);
    onUpdate({ ...estudio, costes: next });
  };

  const escenarios = ESCENARIOS.map(e => {
    const r = calcularEscenario(ventas, e.factor, costes);
    return { ...e, ...r };
  });

  const medio = escenarios[2];
  const fijoTotal = costes.generales.fijo + costes.personal.fijo + costes.producto.fijo + costes.marketing.fijo;

  const pieData = [
    { name: "Generales", value: calcularPilar(ventas, costes.generales) },
    { name: "Personal", value: calcularPilar(ventas, costes.personal) },
    { name: "Producto", value: calcularPilar(ventas, costes.producto) },
    { name: "Marketing", value: calcularPilar(ventas, costes.marketing) },
  ];

  const sensibilidadData = Array.from({ length: 9 }, (_, i) => {
    const f = 0.6 + i * 0.1;
    const r = calcularEscenario(ventas, f, costes);
    return { facturacion: fmt(r.facturacion), beneficio: r.beneficio, margen: parseFloat(r.margen.toFixed(1)) };
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{estudio.datos.nombre}</h1>
          <p className="text-muted-foreground text-sm">{estudio.datos.ciudad} — {estudio.datos.zona}</p>
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumen"><BarChart3 className="h-4 w-4 mr-1" />Resumen</TabsTrigger>
          <TabsTrigger value="datos"><FileText className="h-4 w-4 mr-1" />Datos</TabsTrigger>
          <TabsTrigger value="costes"><Calculator className="h-4 w-4 mr-1" />Costes</TabsTrigger>
          <TabsTrigger value="escenarios"><TrendingUp className="h-4 w-4 mr-1" />Escenarios</TabsTrigger>
          <TabsTrigger value="procedencia"><Landmark className="h-4 w-4 mr-1" />Procedencia</TabsTrigger>
          <TabsTrigger value="destino"><Target className="h-4 w-4 mr-1" />Destino</TabsTrigger>
          <TabsTrigger value="amortizacion"><Clock className="h-4 w-4 mr-1" />Amortización</TabsTrigger>
          <TabsTrigger value="graficas"><BarChart3 className="h-4 w-4 mr-1" />Gráficas</TabsTrigger>
        </TabsList>

        {/* ── RESUMEN EJECUTIVO ── */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{fmt(medio.facturacion)}€</p><p className="text-xs text-muted-foreground">Facturación estimada</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{fmt(medio.costeTotal)}€</p><p className="text-xs text-muted-foreground">Coste total</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className={`text-2xl font-bold ${medio.beneficio >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(medio.beneficio)}€</p><p className="text-xs text-muted-foreground">Beneficio estimado</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className={`text-2xl font-bold ${medio.margen >= 0 ? "text-green-600" : "text-red-600"}`}>{medio.margen.toFixed(1)}%</p><p className="text-xs text-muted-foreground">Margen</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Lectura de viabilidad</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                {medio.beneficio >= 0 ? <TrendingUp className="h-6 w-6 text-green-600" /> : <TrendingDown className="h-6 w-6 text-red-600" />}
                <div>
                  <p className="font-semibold text-lg">{medio.beneficio >= 0 ? "Proyecto viable en escenario medio" : "Proyecto no viable en escenario medio"}</p>
                  <p className="text-sm text-muted-foreground">
                    {escenarios.filter(e => e.beneficio > 0).length} de 5 escenarios son rentables.
                    {" "}Punto de equilibrio: {fmt(fijoTotal / (1 - (costes.generales.variablePct + costes.personal.variablePct + costes.producto.variablePct + costes.marketing.variablePct) / 100))}€/mes
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 pt-2">
                {pieData.map((p, i) => (
                  <div key={p.name} className="text-center">
                    <p className="text-lg font-bold">{fmt(p.value)}€</p>
                    <p className="text-xs text-muted-foreground">{p.name} ({((p.value / medio.costeTotal) * 100).toFixed(0)}%)</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── DATOS DEL PROYECTO ── */}
        <TabsContent value="datos">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {([
                  ["Nombre", estudio.datos.nombre], ["Ciudad", estudio.datos.ciudad], ["Zona", estudio.datos.zona],
                  ["Población", fmt(estudio.datos.poblacion)], ["Afluencia", estudio.datos.afluencia], ["Tipo de local", estudio.datos.tipoLocal],
                  ["m²", estudio.datos.metrosCuadrados], ["Plazas", estudio.datos.plazas], ["Ventas estimadas", `${fmt(estudio.datos.ventasEstimadas)}€/mes`],
                  ["Ticket medio", `${estudio.datos.ticketMedio}€`], ["Clientes estimados", `${fmt(estudio.datos.clientesEstimados)}/mes`],
                  ["Estacionalidad", estudio.datos.estacionalidad], ["Competencia", estudio.datos.competencia],
                ] as [string, string | number][]).map(([label, val]) => (
                  <div key={label}><Label className="text-muted-foreground text-xs">{label}</Label><p className="font-medium">{val}</p></div>
                ))}
              </div>
              {estudio.datos.observaciones && <div className="mt-4"><Label className="text-muted-foreground text-xs">Observaciones</Label><p className="text-sm">{estudio.datos.observaciones}</p></div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── COSTES ── */}
        <TabsContent value="costes">
          <Card>
            <CardHeader><CardTitle className="text-base">Estructura de costes por pilares</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium">Pilar</th>
                  <th className="text-left p-3 font-medium">Coste fijo (€/mes)</th>
                  <th className="text-left p-3 font-medium">Variable (%)</th>
                  <th className="text-left p-3 font-medium">Coste variable (esc. medio)</th>
                  <th className="text-left p-3 font-medium">Total pilar</th>
                </tr></thead>
                <tbody>
                  {(["generales", "personal", "producto", "marketing"] as (keyof EstructuraCostes)[]).map((key, i) => {
                    const pilar = costes[key];
                    const total = calcularPilar(ventas, pilar);
                    return (
                      <tr key={key} className="border-b">
                        <td className="p-3 font-medium capitalize">{PILAR_NAMES[i]}</td>
                        <td className="p-3"><Input type="number" className="w-28" value={pilar.fijo} onChange={e => updatePilar(key, "fijo", Number(e.target.value))} /></td>
                        <td className="p-3"><Input type="number" className="w-20" step={0.5} value={pilar.variablePct} onChange={e => updatePilar(key, "variablePct", Number(e.target.value))} /></td>
                        <td className="p-3">{fmt(ventas * pilar.variablePct / 100)}€</td>
                        <td className="p-3 font-semibold">{fmt(total)}€</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="p-3">TOTAL</td>
                    <td className="p-3">{fmt(fijoTotal)}€</td>
                    <td className="p-3">{(costes.generales.variablePct + costes.personal.variablePct + costes.producto.variablePct + costes.marketing.variablePct).toFixed(1)}%</td>
                    <td className="p-3">{fmt(medio.varTotal)}€</td>
                    <td className="p-3">{fmt(medio.costeTotal)}€</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ESCENARIOS ── */}
        <TabsContent value="escenarios">
          <Card>
            <CardHeader><CardTitle className="text-base">5 escenarios de facturación</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium">Escenario</th>
                  <th className="text-right p-3 font-medium">Facturación</th>
                  <th className="text-right p-3 font-medium">Costes fijos</th>
                  <th className="text-right p-3 font-medium">Costes variables</th>
                  <th className="text-right p-3 font-medium">Coste total</th>
                  <th className="text-right p-3 font-medium">Beneficio</th>
                  <th className="text-right p-3 font-medium">Margen</th>
                </tr></thead>
                <tbody>
                  {escenarios.map((e, i) => (
                    <tr key={e.nombre} className={`border-b ${e.nombre === "Medio" ? "bg-primary/5" : ""}`}>
                      <td className="p-3 font-medium">{e.nombre}</td>
                      <td className="p-3 text-right">{fmt(e.facturacion)}€</td>
                      <td className="p-3 text-right">{fmt(e.fijoTotal)}€</td>
                      <td className="p-3 text-right">{fmt(e.varTotal)}€</td>
                      <td className="p-3 text-right">{fmt(e.costeTotal)}€</td>
                      <td className={`p-3 text-right font-semibold ${e.beneficio >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(e.beneficio)}€</td>
                      <td className={`p-3 text-right ${e.margen >= 0 ? "text-green-600" : "text-red-600"}`}>{e.margen.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── GRÁFICAS ── */}
        <TabsContent value="graficas" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Facturación y beneficio por escenario */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Facturación y beneficio por escenario</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={escenarios.map(e => ({ name: e.nombre, Facturación: e.facturacion, Beneficio: e.beneficio }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                    <Legend />
                    <Bar dataKey="Facturación" fill="hsl(210 70% 55%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Beneficio" fill="hsl(150 60% 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Peso de cada pilar */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Peso de cada pilar de coste</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={PILAR_COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Margen por escenario */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Margen estimado por escenario</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={escenarios.map(e => ({ name: e.nombre, Margen: parseFloat(e.margen.toFixed(1)) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="Margen" radius={[4, 4, 0, 0]}>
                      {escenarios.map((e, i) => <Cell key={i} fill={e.margen >= 0 ? "hsl(150 60% 45%)" : "hsl(0 70% 55%)"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Sensibilidad */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Sensibilidad — beneficio vs facturación</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={sensibilidadData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="facturacion" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                    <Line type="monotone" dataKey="beneficio" stroke="hsl(150 60% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* ── PROCEDENCIA ── */}
        <TabsContent value="procedencia">
          <ProcedenciaTab
            lineas={estudio.procedencia}
            onChange={(p) => onUpdate({ ...estudio, procedencia: p })}
          />
        </TabsContent>

        {/* ── DESTINO ── */}
        <TabsContent value="destino">
          <DestinoTab
            lineas={estudio.destinos}
            onChange={(d) => onUpdate({ ...estudio, destinos: d })}
            totalCapital={estudio.procedencia.reduce((s, l) => s + l.total, 0)}
          />
        </TabsContent>

        {/* ── AMORTIZACIÓN ── */}
        <TabsContent value="amortizacion">
          <AmortizacionTab
            lineas={estudio.amortizacion}
            onChange={(a) => onUpdate({ ...estudio, amortizacion: a })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Formulario nuevo estudio ── */
function NuevoEstudioForm({ onSave, onClose }: { onSave: (e: EstudioApertura) => void; onClose: () => void }) {
  const [datos, setDatos] = useState<DatosProyecto>({
    nombre: "", ciudad: "", zona: "", poblacion: 0, afluencia: "", tipoLocal: "",
    metrosCuadrados: 0, plazas: 0, ventasEstimadas: 0, ticketMedio: 0, clientesEstimados: 0,
    estacionalidad: "", competencia: "", observaciones: "",
  });
  const d = (key: keyof DatosProyecto, val: string | number) => setDatos(p => ({ ...p, [key]: val }));

  const handleSave = () => {
    if (!datos.nombre) return;
    onSave({
      id: `ap-${Date.now()}`,
      datos,
      costes: { generales: { fijo: 0, variablePct: 0 }, personal: { fijo: 0, variablePct: 0 }, producto: { fijo: 0, variablePct: 0 }, marketing: { fijo: 0, variablePct: 0 } },
      procedencia: [],
      destinos: [],
      amortizacion: [],
      creado: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nombre del proyecto *</Label><Input value={datos.nombre} onChange={e => d("nombre", e.target.value)} /></div>
        <div><Label>Ciudad</Label><Input value={datos.ciudad} onChange={e => d("ciudad", e.target.value)} /></div>
        <div><Label>Zona</Label><Input value={datos.zona} onChange={e => d("zona", e.target.value)} /></div>
        <div><Label>Población</Label><Input type="number" value={datos.poblacion || ""} onChange={e => d("poblacion", Number(e.target.value))} /></div>
        <div><Label>Tipo de local</Label><Input value={datos.tipoLocal} onChange={e => d("tipoLocal", e.target.value)} /></div>
        <div><Label>m²</Label><Input type="number" value={datos.metrosCuadrados || ""} onChange={e => d("metrosCuadrados", Number(e.target.value))} /></div>
        <div><Label>Plazas</Label><Input type="number" value={datos.plazas || ""} onChange={e => d("plazas", Number(e.target.value))} /></div>
        <div><Label>Ventas estimadas (€/mes)</Label><Input type="number" value={datos.ventasEstimadas || ""} onChange={e => d("ventasEstimadas", Number(e.target.value))} /></div>
        <div><Label>Ticket medio (€)</Label><Input type="number" value={datos.ticketMedio || ""} onChange={e => d("ticketMedio", Number(e.target.value))} /></div>
        <div><Label>Clientes estimados/mes</Label><Input type="number" value={datos.clientesEstimados || ""} onChange={e => d("clientesEstimados", Number(e.target.value))} /></div>
        <div><Label>Afluencia</Label><Input value={datos.afluencia} onChange={e => d("afluencia", e.target.value)} /></div>
        <div><Label>Estacionalidad</Label><Input value={datos.estacionalidad} onChange={e => d("estacionalidad", e.target.value)} /></div>
      </div>
      <div><Label>Competencia</Label><Input value={datos.competencia} onChange={e => d("competencia", e.target.value)} /></div>
      <div><Label>Observaciones</Label><Textarea value={datos.observaciones} onChange={e => d("observaciones", e.target.value)} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave}>Crear estudio</Button>
      </div>
    </div>
  );
}
