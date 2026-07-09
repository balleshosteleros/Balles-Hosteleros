"use client";

/**
 * Ficha de PROMOCIÓN INTERNA — mover un empleado ya dentro de la empresa de un
 * puesto a otro. Recoge los datos ligados (empleado activo → puesto destino →
 * primer día) y muestra las condiciones que HEREDARÁ del nuevo puesto antes de
 * confirmar. Al confirmar dispara `promocionarEmpleado` (cambia el puesto
 * principal, copia las condiciones al histórico, reasigna horario, genera el
 * anexo a firmar y avisa a la gestoría).
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Briefcase, CalendarDays } from "lucide-react";
import { getEmpleadosActivos, type EmpleadoActivo } from "@/features/rrhh/actions/empleados-actions";
import { listPuestosEmpresa } from "@/features/rrhh/actions/puestos-actions";
import type { PuestoSalarial } from "@/features/rrhh/data/puestos";
import {
  promocionarEmpleado,
  getCondicionesVigentesEmpleado,
  getPuestosPrincipalesEmpleados,
  type CondicionesActualesEmpleado,
} from "@/features/rrhh/actions/promocion-interna-actions";

function fmtEur(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);
}

function hoyIso(): string {
  // Fecha local (zona del navegador) en formato YYYY-MM-DD para el input date.
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function PromocionInternaDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
}) {
  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  const [puestosPrincipales, setPuestosPrincipales] = useState<Record<string, string>>({});
  const [puestos, setPuestos] = useState<PuestoSalarial[]>([]);
  const [cargando, setCargando] = useState(false);

  const [empleadoId, setEmpleadoId] = useState<string>("");
  const [actuales, setActuales] = useState<CondicionesActualesEmpleado | null>(null);
  const [puestoId, setPuestoId] = useState<string>("");
  const [primerDia, setPrimerDia] = useState<string>(hoyIso());
  const [enviarAnexo, setEnviarAnexo] = useState(true);
  const [avisarGestoria, setAvisarGestoria] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset al abrir.
    setEmpleadoId("");
    setActuales(null);
    setPuestoId("");
    setPrimerDia(hoyIso());
    setEnviarAnexo(true);
    setAvisarGestoria(true);
    setCargando(true);
    Promise.all([getEmpleadosActivos(), listPuestosEmpresa(), getPuestosPrincipalesEmpleados()])
      .then(([emps, pts, principales]) => {
        setEmpleados(emps.ok ? emps.data : []);
        setPuestosPrincipales(principales ?? {});
        // Todos los puestos de la empresa son destino posible. Los que no tengan
        // condiciones configuradas se muestran deshabilitados (no se puede
        // promocionar a un puesto sin salario/jornada). No filtramos por «activo»
        // porque muchos puestos válidos aún no tienen su ficha salarial marcada.
        setPuestos(pts.puestos);
      })
      .catch(() => toast.error("No se pudieron cargar los datos"))
      .finally(() => setCargando(false));
  }, [open]);

  const empleado = useMemo(
    () => empleados.find((e) => e.empleadoId === empleadoId) ?? null,
    [empleados, empleadoId],
  );

  // Al elegir empleado, cargamos sus condiciones VIGENTES (columna «Actualmente»).
  const elegirEmpleado = (id: string) => {
    setEmpleadoId(id);
    setActuales(null);
    if (!id) return;
    getCondicionesVigentesEmpleado(id)
      .then((r) => setActuales(r.ok ? r.data : null))
      .catch(() => setActuales(null));
  };
  const puesto = useMemo(
    () => puestos.find((p) => p.id === puestoId) ?? null,
    [puestos, puestoId],
  );

  // Un puesto solo es DESTINO válido de promoción si tiene TODAS las condiciones
  // esenciales rellenas (salario, jornada, horas y tipo de contrato). Devuelve la
  // lista de campos que faltan (vacía = todo relleno).
  const camposQueFaltan = (p: PuestoSalarial): string[] => {
    const faltan: string[] = [];
    if (!((p.salarioBruto ?? 0) > 0)) faltan.push("salario");
    if (!(p.jornadaContrato && p.jornadaContrato.trim())) faltan.push("jornada");
    if (!((p.horasSemanales ?? 0) > 0)) faltan.push("horas/semana");
    if (!(p.tipoContratoDefecto && p.tipoContratoDefecto.trim())) faltan.push("tipo de contrato");
    return faltan;
  };
  const tieneCondiciones = (p: PuestoSalarial) => camposQueFaltan(p).length === 0;

  // Puestos agrupados por departamento (para el selector).
  const puestosPorDepto = useMemo(() => {
    const map = new Map<string, PuestoSalarial[]>();
    for (const p of puestos) {
      const arr = map.get(p.departamento) ?? [];
      arr.push(p);
      map.set(p.departamento, arr);
    }
    return [...map.entries()]
      .map(([depto, lista]) => [depto, [...lista].sort((a, b) => a.puesto.localeCompare(b.puesto))] as const)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [puestos]);

  const puestoActualNombre =
    actuales?.puesto ?? empleado?.puesto ?? (empleadoId ? puestosPrincipales[empleadoId] : "") ?? "";
  const mismoPuesto = !!(puesto && puestoActualNombre && puestoActualNombre === puesto.puesto);
  const destinoValido = !!puesto && tieneCondiciones(puesto);
  const puedeConfirmar =
    !!empleadoId && !!puestoId && !!primerDia && !mismoPuesto && destinoValido && !guardando;

  const confirmar = async () => {
    if (!puedeConfirmar) return;
    setGuardando(true);
    const res = await promocionarEmpleado({
      empleadoId,
      puestoId,
      primerDia,
      enviarAnexo,
      avisarGestoria,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo promocionar");
      return;
    }
    const extras = [
      res.anexoEnviado ? "anexo enviado a firmar" : null,
      res.gestoriaAvisada ? "gestoría avisada" : null,
    ].filter(Boolean);
    toast.success(`Promoción registrada${extras.length ? ` · ${extras.join(" · ")}` : ""}`);
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-600" />
            Promoción interna
          </DialogTitle>
          <DialogDescription>
            Mueve a un empleado de un puesto a otro. Heredará las condiciones del nuevo puesto y se
            dejará constancia del cambio.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-6 py-1 overflow-y-auto">
          {/* Empleado */}
          <div className="grid gap-1.5">
            <Label>Empleado</Label>
            <Select value={empleadoId} onValueChange={elegirEmpleado} disabled={cargando}>
              <SelectTrigger>
                <SelectValue placeholder={cargando ? "Cargando…" : "Selecciona un empleado"} />
              </SelectTrigger>
              <SelectContent>
                {empleados.map((e) => {
                  const puestoAct = e.puesto || puestosPrincipales[e.empleadoId] || "";
                  return (
                    <SelectItem key={e.empleadoId} value={e.empleadoId}>
                      {e.nombreCompleto}
                      {puestoAct ? ` · ${puestoAct}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Puesto actual → nuevo puesto */}
          <div className="grid gap-1.5">
            <Label>Nuevo puesto</Label>
            <Select value={puestoId} onValueChange={setPuestoId} disabled={cargando || !empleadoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el puesto de destino" />
              </SelectTrigger>
              <SelectContent>
                {puestosPorDepto.map(([depto, lista]) => (
                  <SelectGroup key={depto}>
                    <SelectLabel>{depto}</SelectLabel>
                    {lista.map((p) => {
                      const ok = tieneCondiciones(p);
                      return (
                        <SelectItem key={p.id} value={p.id} disabled={!ok}>
                          {p.puesto}
                          {!ok && <span className="text-muted-foreground"> · faltan datos</span>}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {mismoPuesto && (
              <p className="text-xs text-destructive">El empleado ya ocupa ese puesto.</p>
            )}
            {puesto && !mismoPuesto && !tieneCondiciones(puesto) && (
              <p className="text-xs text-destructive">
                No se puede promocionar a «{puesto.puesto}»: faltan {camposQueFaltan(puesto).join(", ")} en las
                condiciones del puesto. Complétalas en RRHH → Puestos y vuelve a intentarlo.
              </p>
            )}
          </div>

          {/* Comparativa ANTES → DESPUÉS de todos los campos que cambian */}
          {puesto && !mismoPuesto && (
            <div className="rounded-lg border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Actualmente</span>
                <span className="px-2" />
                <span className="text-blue-600">Tras la promoción</span>
              </div>
              {[
                {
                  campo: "Puesto",
                  antes: actuales?.puesto ?? empleado?.puesto ?? (empleadoId ? puestosPrincipales[empleadoId] : "") ?? "—",
                  despues: puesto.puesto,
                },
                {
                  campo: "Departamento",
                  antes: actuales?.departamento ?? empleado?.departamento ?? "—",
                  despues: puesto.departamento,
                },
                {
                  campo: "Salario",
                  // Actual: neto del snapshot (lo que hay guardado). Nuevo: bruto del puesto.
                  antes: fmtEur(actuales?.salarioNeto ?? null),
                  despues: fmtEur(puesto.salarioBruto),
                },
                {
                  campo: "Jornada",
                  antes: actuales?.jornada || "—",
                  despues: puesto.jornadaContrato || "—",
                },
                {
                  campo: "Horas/semana",
                  antes: actuales?.horasSemanales ? `${actuales.horasSemanales} h` : "—",
                  despues: puesto.horasSemanales ? `${puesto.horasSemanales} h` : "—",
                },
                {
                  campo: "Tipo de contrato",
                  antes: actuales?.tipoContrato || "—",
                  despues: puesto.tipoContratoDefecto || actuales?.tipoContrato || "—",
                },
              ].map((fila) => {
                const cambia = String(fila.antes) !== String(fila.despues);
                return (
                  <div key={fila.campo} className="border-t border-border">
                    <div className="px-3 pt-1.5 text-[11px] text-muted-foreground">{fila.campo}</div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 pb-1.5 gap-1">
                      <span className="text-muted-foreground truncate">{fila.antes}</span>
                      <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${cambia ? "text-blue-600" : "text-muted-foreground/40"}`} />
                      <span className={`text-right truncate ${cambia ? "font-semibold text-blue-600" : "text-foreground"}`}>
                        {fila.despues}
                      </span>
                    </div>
                  </div>
                );
              })}
              <p className="border-t border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                El salario actual se muestra en neto (lo guardado) y el nuevo en bruto del puesto. Al confirmar se copian
                las condiciones del nuevo puesto y se archiva el histórico anterior.
              </p>
            </div>
          )}

          {/* Primer día */}
          <div className="grid gap-1.5">
            <Label className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Primer día en el nuevo puesto
            </Label>
            <Input type="date" value={primerDia} onChange={(e) => setPrimerDia(e.target.value)} />
          </div>

          {/* Opciones */}
          <div className="grid gap-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={enviarAnexo} onCheckedChange={(v) => setEnviarAnexo(v === true)} className="mt-0.5" />
              <span className="text-sm">
                Enviar el <span className="font-medium">anexo de cambio de puesto</span> al empleado para su firma
                (manuscrita + código por email).
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={avisarGestoria} onCheckedChange={(v) => setAvisarGestoria(v === true)} className="mt-0.5" />
              <span className="text-sm">
                Avisar a la <span className="font-medium">gestoría</span> del cambio de puesto.
              </span>
            </label>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={!puedeConfirmar}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {guardando ? "Procesando…" : "Confirmar promoción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
