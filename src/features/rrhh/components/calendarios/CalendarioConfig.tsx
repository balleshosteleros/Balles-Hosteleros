import { useMemo, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getConfigCalendario, getFestivosPorEmpresa, REGIONES_ESPANA, type Festivo } from "@/features/rrhh/data/calendarios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, AlertCircle, Globe2, MapPin } from "lucide-react";

const MODALIDAD_LABELS: Record<string, string> = {
  laboral: "Laboral",
  vacaciones: "Vacaciones",
  festivos: "Festivos",
  bajas: "Bajas médicas",
  justificadas: "Justificadas",
};

export function CalendarioConfig({ modalidad, onBack }: { modalidad: string; onBack: () => void }) {
  const config = getConfigCalendario(modalidad);
  const { empresaActual } = useEmpresa();
  const festivosEmpresa = useMemo(() => getFestivosPorEmpresa(empresaActual.id), [empresaActual.id]);
  const regionInicial = festivosEmpresa.find(f => f.region)?.region ?? REGIONES_ESPANA[13];
  const [regionSel, setRegionSel] = useState<string>(regionInicial);
  const [festivos, setFestivos] = useState<Festivo[]>(festivosEmpresa);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<Festivo["tipo"]>("local");

  const festivosFiltrados = festivos.filter(f =>
    f.tipo === "nacional" || !f.region || f.region === regionSel
  );

  const eliminarFestivo = (id: string) => setFestivos(prev => prev.filter(f => f.id !== id));

  const agregarFestivo = () => {
    if (!nuevoNombre.trim() || !nuevaFecha) return;
    const nuevo: Festivo = {
      id: `new-${Date.now()}`,
      fecha: nuevaFecha,
      nombre: nuevoNombre.trim(),
      tipo: nuevoTipo,
      centro: empresaActual.id,
      region: nuevoTipo === "nacional" ? undefined : regionSel,
    };
    setFestivos(prev => [...prev, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha)));
    setNuevoNombre("");
    setNuevaFecha("");
  };

  const tipoLabel: Record<Festivo["tipo"], string> = {
    nacional: "Nacional",
    autonomico: "Autonómico",
    local: "Local",
  };
  const tipoBadge: Record<Festivo["tipo"], string> = {
    nacional: "bg-rose-500/10 text-rose-700 border-rose-500/20",
    autonomico: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    local: "bg-violet-500/10 text-violet-700 border-violet-500/20",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1" onClick={onBack}><ArrowLeft className="h-4 w-4" />Volver</Button>
        <h3 className="text-lg font-semibold">Configuración — {MODALIDAD_LABELS[modalidad]}</h3>
      </div>

      {modalidad === "festivos" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              Festivos por región
            </CardTitle>
            <CardDescription className="text-xs">
              Los nacionales son fijos para toda España. Los autonómicos y locales dependen de la región del centro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm min-w-[60px]">Región</span>
                <Select value={regionSel} onValueChange={setRegionSel}>
                  <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGIONES_ESPANA.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-muted-foreground">
                {festivosFiltrados.length} festivo(s) configurados
              </span>
            </div>

            <div className="rounded-md border divide-y">
              {festivosFiltrados.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Sin festivos para esta región</div>
              )}
              {festivosFiltrados.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="text-xs font-mono text-muted-foreground w-24 shrink-0">{f.fecha}</div>
                  <div className="flex-1 text-sm font-medium truncate">{f.nombre}</div>
                  <Badge variant="outline" className={`text-[10px] ${tipoBadge[f.tipo]}`}>
                    {f.tipo === "nacional" ? <Globe2 className="h-2.5 w-2.5 mr-1" /> : <MapPin className="h-2.5 w-2.5 mr-1" />}
                    {tipoLabel[f.tipo]}
                  </Badge>
                  {f.region && f.tipo !== "nacional" && (
                    <span className="text-[10px] text-muted-foreground">{f.region}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => eliminarFestivo(f.id)}
                    disabled={f.tipo === "nacional"}
                    title={f.tipo === "nacional" ? "Los festivos nacionales no se pueden eliminar" : "Eliminar"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="text-xs font-semibold flex items-center gap-1">
                <Plus className="h-3 w-3" /> Registrar festivo
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="date"
                  value={nuevaFecha}
                  onChange={e => setNuevaFecha(e.target.value)}
                  className="w-[160px] h-9"
                />
                <Input
                  placeholder="Nombre del festivo"
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                  className="flex-1 min-w-[200px] h-9"
                />
                <Select value={nuevoTipo} onValueChange={v => setNuevoTipo(v as Festivo["tipo"])}>
                  <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nacional">Nacional</SelectItem>
                    <SelectItem value="autonomico">Autonómico</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-9 gap-1" onClick={agregarFestivo} disabled={!nuevoNombre.trim() || !nuevaFecha}>
                  <Plus className="h-3.5 w-3.5" />Añadir
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Los festivos {nuevoTipo === "nacional" ? "nacionales aplican a todo el país" : `aplican a la región ${regionSel}`}. La víspera se marca automáticamente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tipos de solicitud</CardTitle>
            <CardDescription className="text-xs">Tipos disponibles para esta modalidad</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {config.tiposSolicitud.map(t => (
                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1 mt-2"><Plus className="h-3 w-3" />Añadir tipo</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Estados</CardTitle>
            <CardDescription className="text-xs">Flujo de estados de las solicitudes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {config.estados.map(e => (
                <Badge key={e} variant="outline" className="text-xs">{e.charAt(0).toUpperCase() + e.slice(1)}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Reglas de aprobación</CardTitle>
            <CardDescription className="text-xs">Configuración del flujo de aprobación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Requiere aprobación</span>
              <Switch defaultChecked={config.requiereAprobacion} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Requiere justificante</span>
              <Switch defaultChecked={config.requiereJustificante} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Observaciones obligatorias</span>
              <Switch defaultChecked={config.observacionesObligatorias} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Duración y restricciones</CardTitle>
            <CardDescription className="text-xs">Límites de duración de la solicitud</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm min-w-[120px]">Duración mín. (días)</span>
              <Input type="number" className="w-24" defaultValue={config.duracionMinDias ?? ""} placeholder="—" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm min-w-[120px]">Duración máx. (días)</span>
              <Input type="number" className="w-24" defaultValue={config.duracionMaxDias ?? ""} placeholder="—" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Visibilidad</CardTitle>
            <CardDescription className="text-xs">Quién puede ver estas ausencias</CardDescription>
          </CardHeader>
          <CardContent>
            <Select defaultValue={config.visibilidad}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los empleados</SelectItem>
                <SelectItem value="departamento">Solo su departamento</SelectItem>
                <SelectItem value="responsable">Solo responsable</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Avisos y notificaciones</CardTitle>
            <CardDescription className="text-xs">Alertas automáticas del sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Notificar al responsable</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Notificar al empleado</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Aviso de solapamiento</span>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
