import { useState, useEffect } from "react";
import {
  type Incidencia,
  type ResultadoActualizacion,
  MINUTOS_OPCIONES,
  MIN_TEXTO_ACTUALIZACION,
  formatearDuracion,
} from "@/features/empresa/data/mantenimiento";
import { getEmpleadosActivos, type EmpleadoActivo } from "@/features/rrhh/actions/empleados-actions";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  item: Incidencia;
  onGuardar: (datos: {
    texto: string;
    fecha: string;
    apuntadoPor: string;
    resultado: ResultadoActualizacion;
    minutos: number;
  }) => void;
}

export function ActualizarIncidenciaDialog({ open, onClose, item, onGuardar }: Props) {
  const hoy = new Date().toISOString().slice(0, 10);
  const { empresaActual } = useEmpresa();
  const { user } = useAuth();

  const [resultado, setResultado] = useState<ResultadoActualizacion | null>(null);
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [minutos, setMinutos] = useState<number | null>(null);
  const [apuntadoPor, setApuntadoPor] = useState("");
  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    getEmpleadosActivos(empresaActual.dbId).then((r) => {
      if (!alive) return;
      const lista = r.ok ? r.data : [];
      setEmpleados(lista);
      // Preseleccionar al empleado de la sesión por userId, usando su
      // nombreCompleto de la lista para que case exacto con una opción.
      const yo = lista.find((e) => e.userId && e.userId === user?.id);
      if (yo) setApuntadoPor((p) => (p ? p : yo.nombreCompleto));
    });
    return () => { alive = false; };
  }, [empresaActual.dbId, user?.id]);

  // Al cerrar se limpia, para que la siguiente actualización empiece en blanco.
  useEffect(() => {
    if (open) return;
    setResultado(null);
    setTexto("");
    setFecha(hoy);
    setMinutos(null);
    setErrores({});
  }, [open, hoy]);

  const limpiarError = (campo: string) =>
    setErrores((p) => {
      if (!p[campo]) return p;
      const { [campo]: _quitado, ...resto } = p;
      return resto;
    });

  const validar = () => {
    const faltan: Record<string, string> = {};
    if (!resultado) faltan.resultado = "Elige cómo queda el desperfecto";
    const t = texto.trim();
    if (!t) faltan.texto = "Escribe qué se ha hecho";
    else if (t.length < MIN_TEXTO_ACTUALIZACION)
      faltan.texto = `Describe el trabajo con al menos ${MIN_TEXTO_ACTUALIZACION} caracteres (llevas ${t.length})`;
    if (!fecha) faltan.fecha = "Indica la fecha";
    if (!minutos) faltan.minutos = "Indica el tiempo dedicado";
    if (!apuntadoPor) faltan.apuntadoPor = "Elige quién lo apunta";
    setErrores(faltan);
    return Object.keys(faltan).length === 0;
  };

  const handleGuardar = () => {
    if (!validar()) return;
    onGuardar({
      texto: texto.trim(),
      fecha,
      apuntadoPor,
      resultado: resultado as ResultadoActualizacion,
      minutos: minutos as number,
    });
    onClose();
  };

  const MsgError = ({ campo }: { campo: string }) =>
    errores[campo] ? <p className="text-xs text-destructive mt-1">{errores[campo]}</p> : null;

  // Las dos salidas: terminado o sigue en progreso.
  const salidas: { valor: ResultadoActualizacion; titulo: string; ayuda: string; icono: typeof CheckCircle2; activo: string }[] = [
    {
      valor: "TERMINADO",
      titulo: "Terminado",
      ayuda: "El desperfecto queda resuelto",
      icono: CheckCircle2,
      activo: "border-status-done bg-status-done/10 text-status-done",
    },
    {
      valor: "EN PROGRESO",
      titulo: "En progreso",
      ayuda: "Sigue abierto, falta trabajo",
      icono: Loader2,
      activo: "border-status-progress bg-status-progress/10 text-status-progress",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Actualizar desperfecto</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">{item.desperfecto}</p>

        <div className="space-y-4 mt-3">
          <div>
            <Label>¿Cómo queda?</Label>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              {salidas.map((s) => {
                const Icono = s.icono;
                const elegido = resultado === s.valor;
                return (
                  <button
                    key={s.valor}
                    type="button"
                    onClick={() => { setResultado(s.valor); limpiarError("resultado"); }}
                    className={cn(
                      "rounded-lg border-2 p-3 text-left transition-colors",
                      elegido ? s.activo : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="flex items-center gap-2 font-bold text-sm">
                      <Icono className="h-4 w-4 shrink-0" />
                      {s.titulo}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-1">{s.ayuda}</span>
                  </button>
                );
              })}
            </div>
            <MsgError campo="resultado" />
          </div>

          <div>
            <Label>Observaciones</Label>
            <Textarea
              value={texto}
              onChange={(e) => { setTexto(e.target.value); limpiarError("texto"); }}
              rows={3}
              placeholder={
                resultado === "TERMINADO"
                  ? "Qué se ha hecho para resolverlo..."
                  : "Qué se ha hecho y qué falta por hacer..."
              }
            />
            {!errores.texto && (
              <p className="text-xs text-muted-foreground mt-1">
                Mínimo {MIN_TEXTO_ACTUALIZACION} caracteres para describirlo
              </p>
            )}
            <MsgError campo="texto" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => { setFecha(e.target.value); limpiarError("fecha"); }}
              />
              <MsgError campo="fecha" />
            </div>
            <div>
              <Label>Tiempo dedicado</Label>
              <Select
                value={minutos ? String(minutos) : ""}
                onValueChange={(v) => { setMinutos(Number(v)); limpiarError("minutos"); }}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {MINUTOS_OPCIONES.map((m) => (
                    <SelectItem key={m} value={String(m)}>{formatearDuracion(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <MsgError campo="minutos" />
            </div>
          </div>

          <div>
            <Label>Apuntado por</Label>
            <Select
              value={apuntadoPor}
              onValueChange={(v) => { setApuntadoPor(v); limpiarError("apuntadoPor"); }}
            >
              <SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger>
              <SelectContent>
                {apuntadoPor && !empleados.some((e) => e.nombreCompleto === apuntadoPor) && (
                  <SelectItem value={apuntadoPor}>{apuntadoPor}</SelectItem>
                )}
                {empleados.map((e) => (
                  <SelectItem key={e.empleadoId} value={e.nombreCompleto}>
                    {e.nombreCompleto}
                    {(e.puesto || e.departamento) && (
                      <span className="text-muted-foreground">
                        {" — "}{[e.puesto, e.departamento].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <MsgError campo="apuntadoPor" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGuardar}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
