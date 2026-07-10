import { useEffect, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getConfigCalendario } from "@/features/rrhh/data/calendarios";
import {
  getFestivos,
  regenerarFestivos,
  addFestivoLocal,
  deleteFestivo,
  COMUNIDADES_AUTONOMAS,
  type FestivoBD,
} from "@/features/rrhh/actions/festivos-actions";
import { saveEmpresaAjustes } from "@/features/empresa/actions/empresas-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, AlertCircle, Globe2, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MODALIDAD_LABELS: Record<string, string> = {
  laboral: "Laboral",
  vacaciones: "Vacaciones",
  festivos: "Festivos",
  bajas: "Bajas médicas",
  justificadas: "Justificadas",
};

const AMBITO_LABEL: Record<FestivoBD["ambito"], string> = {
  nacional: "Nacional",
  autonomico: "Autonómico",
  local: "Local",
};
const AMBITO_BADGE: Record<FestivoBD["ambito"], string> = {
  nacional: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  autonomico: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  local: "bg-violet-500/10 text-violet-700 border-violet-500/20",
};

export function CalendarioConfig({ modalidad, onBack }: { modalidad: string; onBack: () => void }) {
  const config = getConfigCalendario(modalidad);
  const { empresaActual, ajustes, setAjustes } = useEmpresa();

  const esFestivos = modalidad === "festivos";
  const [anio] = useState<number>(() => new Date().getFullYear());
  const comunidad = ajustes.configOperativa.comunidadAutonoma ?? "";

  const [festivos, setFestivos] = useState<FestivoBD[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardandoCom, setGuardandoCom] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaFecha, setNuevaFecha] = useState("");

  const recargar = async () => {
    setCargando(true);
    const r = await getFestivos(anio);
    if (r.ok) setFestivos([...r.data].sort((a, b) => a.fecha.localeCompare(b.fecha)));
    setCargando(false);
  };

  useEffect(() => {
    if (!esFestivos) return;
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esFestivos, anio, empresaActual.dbId]);

  // Cambiar la comunidad autónoma: guarda en config_operativa y regenera los
  // festivos nacionales+autonómicos del año (conserva los locales manuales).
  const cambiarComunidad = async (nueva: string) => {
    if (!empresaActual.dbId) {
      toast.error("Empresa no disponible");
      return;
    }
    setGuardandoCom(true);
    const nuevoConfig = { ...ajustes.configOperativa, comunidadAutonoma: nueva };
    setAjustes((prev) => ({ ...prev, configOperativa: { ...prev.configOperativa, comunidadAutonoma: nueva } }));
    const res = await saveEmpresaAjustes({ id: empresaActual.dbId, configOperativa: nuevoConfig });
    if (!res.ok) {
      toast.error("No se pudo guardar la comunidad autónoma");
      setGuardandoCom(false);
      return;
    }
    const reg = await regenerarFestivos(anio);
    setGuardandoCom(false);
    if (!reg.ok) {
      toast.error("Comunidad guardada, pero fallo al regenerar festivos");
      return;
    }
    toast.success(`Festivos de ${nueva} aplicados al calendario`);
    await recargar();
  };

  const agregarFestivoLocal = async () => {
    if (!nuevoNombre.trim() || !nuevaFecha) return;
    const r = await addFestivoLocal({ anio, fecha: nuevaFecha, nombre: nuevoNombre.trim() });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setNuevoNombre("");
    setNuevaFecha("");
    toast.success("Festivo local añadido");
    await recargar();
  };

  const eliminarFestivo = async (id: string) => {
    const r = await deleteFestivo(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    await recargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1" onClick={onBack}><ArrowLeft className="h-4 w-4" />Volver</Button>
        <h3 className="text-lg font-semibold">Configuración — {MODALIDAD_LABELS[modalidad]}</h3>
      </div>

      {esFestivos && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              Festivos oficiales {anio}
            </CardTitle>
            <CardDescription className="text-xs">
              Elige la comunidad autónoma: los festivos nacionales y autonómicos se generan
              automáticamente cada año. Solo tienes que añadir a mano los 2 festivos locales de tu municipio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm min-w-[140px]">Comunidad autónoma</span>
                <Select value={comunidad} onValueChange={cambiarComunidad} disabled={guardandoCom}>
                  <SelectTrigger className="w-[240px] h-9">
                    <SelectValue placeholder="Selecciona una comunidad…" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMUNIDADES_AUTONOMAS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                {guardandoCom && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <span className="text-xs text-muted-foreground">
                {festivos.length} festivo(s) en {anio}
              </span>
            </div>

            <div className="rounded-md border divide-y">
              {cargando && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Cargando festivos…</div>
              )}
              {!cargando && festivos.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Sin festivos. Selecciona una comunidad autónoma para generarlos.
                </div>
              )}
              {!cargando && festivos.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="text-xs font-mono text-muted-foreground w-24 shrink-0">{f.fecha}</div>
                  <div className="flex-1 text-sm font-medium truncate">{f.nombre}</div>
                  <Badge variant="outline" className={`text-[10px] ${AMBITO_BADGE[f.ambito]}`}>
                    {f.ambito === "nacional" ? <Globe2 className="h-2.5 w-2.5 mr-1" /> : <MapPin className="h-2.5 w-2.5 mr-1" />}
                    {AMBITO_LABEL[f.ambito]}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => eliminarFestivo(f.id)}
                    disabled={f.origen !== "manual"}
                    title={f.origen !== "manual" ? "Los festivos nacionales y autonómicos se generan automáticamente" : "Eliminar"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="text-xs font-semibold flex items-center gap-1">
                <Plus className="h-3 w-3" /> Añadir festivo local
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="date"
                  value={nuevaFecha}
                  onChange={e => setNuevaFecha(e.target.value)}
                  className="w-[160px] h-9"
                />
                <Input
                  placeholder="Nombre del festivo local"
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                  className="flex-1 min-w-[200px] h-9"
                />
                <Button size="sm" className="h-9 gap-1" onClick={agregarFestivoLocal} disabled={!nuevoNombre.trim() || !nuevaFecha}>
                  <Plus className="h-3.5 w-3.5" />Añadir
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Cada municipio fija 2 festivos locales. La víspera se marca automáticamente en el calendario.
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
