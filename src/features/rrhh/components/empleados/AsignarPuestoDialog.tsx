"use client";

/**
 * Asignar un puesto a un empleado desde su ficha.
 *
 * Mismo motor que la promoción interna (`promocionarEmpleado`), pero con el
 * empleado ya fijado: aquí se entra desde su ficha, no desde el módulo Puestos.
 *
 * Antes de aplicar nada enseña la comparativa completa campo por campo — lo que
 * tiene ahora y lo que pasará a tener — para aprobar o denegar con todo a la vista.
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
import { listPuestosEmpresa } from "@/features/rrhh/actions/puestos-actions";
import type { PuestoSalarial } from "@/features/rrhh/data/puestos";
import {
  promocionarEmpleado,
  getCondicionesVigentesEmpleado,
  getPreviewPuestoDestino,
  type CondicionesActualesEmpleado,
  type PreviewPuestoDestino,
} from "@/features/rrhh/actions/promocion-interna-actions";

function fmtEur(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(n);
}

function hoyIso(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function AsignarPuestoDialog({
  open,
  onOpenChange,
  empleadoId,
  empleadoNombre,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empleadoId: string;
  empleadoNombre: string;
  onDone?: () => void;
}) {
  const [puestos, setPuestos] = useState<PuestoSalarial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [actuales, setActuales] = useState<CondicionesActualesEmpleado | null>(null);
  const [destino, setDestino] = useState<PreviewPuestoDestino | null>(null);
  const [puestoId, setPuestoId] = useState("");
  const [primerDia, setPrimerDia] = useState(hoyIso());
  const [enviarAnexo, setEnviarAnexo] = useState(true);
  const [avisarGestoria, setAvisarGestoria] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPuestoId("");
    setDestino(null);
    setPrimerDia(hoyIso());
    setEnviarAnexo(true);
    setAvisarGestoria(true);
    setCargando(true);
    Promise.all([listPuestosEmpresa(), getCondicionesVigentesEmpleado(empleadoId)])
      .then(([pts, cond]) => {
        setPuestos(pts.puestos);
        setActuales(cond.ok ? cond.data : null);
      })
      .catch(() => toast.error("No se pudieron cargar los datos"))
      .finally(() => setCargando(false));
  }, [open, empleadoId]);

  useEffect(() => {
    if (!puestoId) {
      setDestino(null);
      return;
    }
    let vigente = true;
    setDestino(null);
    getPreviewPuestoDestino(puestoId)
      .then((r) => {
        if (vigente) setDestino(r.ok ? r.data : null);
      })
      .catch(() => {
        if (vigente) setDestino(null);
      });
    return () => {
      vigente = false;
    };
  }, [puestoId]);

  const puesto = useMemo(
    () => puestos.find((p) => p.id === puestoId) ?? null,
    [puestos, puestoId],
  );

  // Un puesto solo es destino válido si tiene todas las condiciones esenciales.
  const camposQueFaltan = (p: PuestoSalarial): string[] => {
    const faltan: string[] = [];
    if (!((p.salarioBruto ?? 0) > 0)) faltan.push("salario");
    if (!p.jornadaContrato?.trim()) faltan.push("jornada");
    if (!((p.horasSemanales ?? 0) > 0)) faltan.push("horas/semana");
    if (!p.tipoContratoDefecto?.trim()) faltan.push("tipo de contrato");
    return faltan;
  };
  const tieneCondiciones = (p: PuestoSalarial) => camposQueFaltan(p).length === 0;

  const puestosPorDepto = useMemo(() => {
    const map = new Map<string, PuestoSalarial[]>();
    for (const p of puestos) {
      const arr = map.get(p.departamento) ?? [];
      arr.push(p);
      map.set(p.departamento, arr);
    }
    return [...map.entries()]
      .map(([depto, lista]) =>
        [depto, [...lista].sort((a, b) => a.puesto.localeCompare(b.puesto))] as const,
      )
      .sort(([a], [b]) => a.localeCompare(b));
  }, [puestos]);

  const mismoPuesto = !!(puesto && actuales?.puesto && actuales.puesto === puesto.puesto);
  const puedeConfirmar =
    !!puestoId && !!primerDia && !mismoPuesto && !!puesto && tieneCondiciones(puesto) && !guardando;

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
      toast.error(res.error ?? "No se pudo asignar el puesto");
      return;
    }
    const extras = [
      res.anexoEnviado ? "anexo enviado a firmar" : null,
      res.gestoriaAvisada ? "gestoría avisada" : null,
    ].filter(Boolean);
    toast.success(`Puesto asignado${extras.length ? ` · ${extras.join(" · ")}` : ""}`);
    onOpenChange(false);
    onDone?.();
  };

  const filas = puesto
    ? [
        { campo: "Puesto", antes: actuales?.puesto ?? "—", despues: puesto.puesto },
        { campo: "Departamento", antes: actuales?.departamento ?? "—", despues: puesto.departamento },
        {
          campo: "Salario",
          antes: fmtEur(actuales?.salarioNeto ?? null),
          despues: fmtEur(puesto.salarioBruto),
        },
        { campo: "Jornada", antes: actuales?.jornada || "—", despues: puesto.jornadaContrato || "—" },
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
        {
          campo: "Horario",
          antes: actuales?.horarioNombre || "Sin horario",
          despues: destino ? destino.horarioNombre || "Sin horario" : "…",
        },
        {
          campo: "Cronograma",
          antes: actuales?.puesto
            ? `Cronograma de ${actuales.puesto}${
                actuales.cronogramaTareas != null ? ` (${actuales.cronogramaTareas} tareas)` : ""
              }`
            : "Sin cronograma",
          despues: destino
            ? `Cronograma de ${puesto.puesto} (${destino.cronogramaTareas} tareas)`
            : "…",
        },
        {
          campo: "Valida sus solicitudes",
          antes: actuales?.validadorNombre || "—",
          // Si el puesto destino no define validador, se conserva el actual.
          despues: destino
            ? destino.validadorNombre || actuales?.validadorNombre || "—"
            : "…",
        },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-600" />
            Asignar puesto
          </DialogTitle>
          <DialogDescription>
            {empleadoNombre} pasará a tener todo lo que define el puesto: salario, jornada, horario,
            cronograma y validador. Revisa el cambio antes de confirmarlo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-6 py-1 overflow-y-auto">
          <div className="grid gap-1.5">
            <Label>Puesto</Label>
            <Select value={puestoId} onValueChange={setPuestoId} disabled={cargando}>
              <SelectTrigger>
                <SelectValue placeholder={cargando ? "Cargando…" : "Selecciona el puesto"} />
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
                No se puede asignar «{puesto.puesto}»: faltan {camposQueFaltan(puesto).join(", ")} en
                las condiciones del puesto. Complétalas en RRHH → Puestos y vuelve a intentarlo.
              </p>
            )}
          </div>

          {puesto && !mismoPuesto && (
            <div className="rounded-lg border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Actualmente</span>
                <span className="px-2" />
                <span className="text-blue-600">Tras el cambio</span>
              </div>
              {filas.map((fila) => {
                const cambia = String(fila.antes) !== String(fila.despues);
                return (
                  <div key={fila.campo} className="border-t border-border">
                    <div className="px-3 pt-1.5 text-[11px] text-muted-foreground">{fila.campo}</div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 pb-1.5 gap-1">
                      <span className="text-muted-foreground truncate">{fila.antes}</span>
                      <ArrowRight
                        className={`h-3.5 w-3.5 shrink-0 ${cambia ? "text-blue-600" : "text-muted-foreground/40"}`}
                      />
                      <span
                        className={`text-right truncate ${cambia ? "font-semibold text-blue-600" : "text-foreground"}`}
                      >
                        {fila.despues}
                      </span>
                    </div>
                  </div>
                );
              })}
              <p className="border-t border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                El salario actual se muestra en neto (lo guardado) y el nuevo en bruto del puesto. El
                horario antiguo se cierra el día antes, así que desde el primer día solo rige el
                nuevo, y las tareas del puesto anterior dejan de aparecerle. Queda todo en su
                histórico de puestos.
              </p>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Primer día en el nuevo puesto
            </Label>
            <Input
              type="date"
              value={primerDia}
              onChange={(e) => setPrimerDia(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={enviarAnexo}
                onCheckedChange={(v) => setEnviarAnexo(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                Enviar el <span className="font-medium">anexo de cambio de puesto</span> al empleado
                para su firma (manuscrita + código por email).
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={avisarGestoria}
                onCheckedChange={(v) => setAvisarGestoria(v === true)}
                className="mt-0.5"
              />
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
            {guardando ? "Procesando…" : "Aprobar y aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
