"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  copiarEmpleadoAEmpresa,
  getDatosCopiaEmpleado,
} from "@/features/rrhh/actions/empleados-actions";
import type { EmpresaAccesible } from "@/features/empresa/actions/empresas-accesibles-actions";

interface DatosDestino {
  bloqueado: boolean;
  motivos: string[];
  departamento: { nombre: string; existe: boolean } | null;
  puestos: { nombre: string; esPrincipal: boolean; existe: boolean }[];
  calendarios: { id: string; nombre: string }[];
  locales: { id: string; nombre: string }[];
}

interface Props {
  empleadoId: string;
  empleadoNombre: string;
  empresasDisponibles: EmpresaAccesible[];
  empresasActuales: string[];
}

export function CopiarEmpleadoDialog({
  empleadoId,
  empleadoNombre,
  empresasDisponibles,
  empresasActuales,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [destino, setDestino] = useState("");
  const [datos, setDatos] = useState<DatosDestino | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Campos obligatorios de la empresa destino.
  const [emailEmpresa, setEmailEmpresa] = useState("");
  const [calendarioId, setCalendarioId] = useState("");
  const [localIds, setLocalIds] = useState<string[]>([]);

  const opciones = useMemo(
    () => empresasDisponibles.filter((e) => !empresasActuales.includes(e.id)),
    [empresasDisponibles, empresasActuales],
  );

  // Al elegir empresa destino, carga el emparejado y las listas.
  useEffect(() => {
    if (!open || !destino) {
      setDatos(null);
      return;
    }
    let activo = true;
    setCargando(true);
    setCalendarioId("");
    setLocalIds([]);
    getDatosCopiaEmpleado({ empleadoId, empresaDestinoId: destino }).then((res) => {
      if (!activo) return;
      setDatos(res.ok ? (res.data as DatosDestino) : null);
      if (!res.ok) toast.error(res.error ?? "No se pudieron cargar los datos de la empresa.");
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [open, destino, empleadoId]);

  function toggleLocal(id: string, checked: boolean) {
    setLocalIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  }

  const puedeCopiar =
    !!datos &&
    !datos.bloqueado &&
    emailEmpresa.trim().length > 0 &&
    !!calendarioId &&
    localIds.length > 0;

  async function copiar() {
    if (!puedeCopiar) return;
    setGuardando(true);
    const res = await copiarEmpleadoAEmpresa({
      empleadoId,
      empresaDestinoId: destino,
      emailEmpresa: emailEmpresa.trim(),
      calendarioId,
      localIds,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo copiar el empleado.");
      return;
    }
    const nombreEmpresa = opciones.find((e) => e.id === destino)?.nombre ?? "la otra empresa";
    toast.success(`${empleadoNombre} copiado a ${nombreEmpresa}. Asígnale sus turnos allí.`);
    setOpen(false);
    setDestino("");
    setEmailEmpresa("");
    setCalendarioId("");
    setLocalIds([]);
    router.refresh();
  }

  if (opciones.length === 0) return null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Copy className="h-4 w-4" />
        Copiar empleado en otra empresa
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Copiar empleado en otra empresa</DialogTitle>
            <DialogDescription>
              Crea la ficha de {empleadoNombre} en otra empresa reutilizando sus datos personales.
              El departamento y el puesto se emparejan por nombre; lo obligatorio de la empresa se
              rellena aquí. Los turnos se asignan después, en la nueva empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Empresa destino</label>
              <select
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecciona una empresa…</option>
                {opciones.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </div>

            {cargando && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Comprobando la empresa destino…
              </p>
            )}

            {datos && !cargando && (
              <>
                {/* Bloqueos (departamento/puesto que no existen en destino) */}
                {datos.bloqueado && (
                  <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5" /> No se puede copiar todavía
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {datos.motivos.map((m) => (
                        <li key={m} className="text-[11px] leading-snug text-red-700">• {m}</li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Crea el departamento/puesto con el mismo nombre en la empresa destino y vuelve a intentarlo.
                    </p>
                  </div>
                )}

                {/* Emparejado por nombre */}
                {!datos.bloqueado && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
                    {datos.departamento && (
                      <p className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Departamento <strong className="text-foreground">{datos.departamento.nombre}</strong> encontrado en destino.
                      </p>
                    )}
                    {datos.puestos.filter((p) => p.existe).map((p) => (
                      <p key={p.nombre} className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Puesto <strong className="text-foreground">{p.nombre}</strong> emparejado (con su salario de esa empresa).
                      </p>
                    ))}
                    {datos.puestos.filter((p) => !p.existe).map((p) => (
                      <p key={p.nombre} className="flex items-center gap-1.5 text-amber-700">
                        <X className="h-3.5 w-3.5" /> Puesto {p.nombre} no existe en destino: se omite.
                      </p>
                    ))}
                  </div>
                )}

                {/* Campos obligatorios */}
                {!datos.bloqueado && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Email de empresa <span className="text-red-600">*</span></label>
                      <input
                        type="email"
                        value={emailEmpresa}
                        onChange={(e) => setEmailEmpresa(e.target.value)}
                        placeholder="correo@empresa.com"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Calendario de vacaciones <span className="text-red-600">*</span></label>
                      <select
                        value={calendarioId}
                        onChange={(e) => setCalendarioId(e.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Selecciona un calendario…</option>
                        {datos.calendarios.map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                      {datos.calendarios.length === 0 && (
                        <p className="text-[11px] text-amber-700">No hay calendarios en la empresa destino. Crea uno antes de copiar.</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Local(es) de fichaje <span className="text-red-600">*</span></label>
                      <div className="space-y-1.5 rounded-md border p-2">
                        {datos.locales.length === 0 && (
                          <p className="text-[11px] text-amber-700">No hay locales en la empresa destino. Crea uno antes de copiar.</p>
                        )}
                        {datos.locales.map((l) => (
                          <label key={l.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={localIds.includes(l.id)}
                              onCheckedChange={(c) => toggleLocal(l.id, c === true)}
                            />
                            <span>{l.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="button" onClick={copiar} disabled={guardando || !puedeCopiar} className="gap-2">
              {guardando ? <><Loader2 className="h-4 w-4 animate-spin" />Copiando…</> : <><Copy className="h-4 w-4" />Copiar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
