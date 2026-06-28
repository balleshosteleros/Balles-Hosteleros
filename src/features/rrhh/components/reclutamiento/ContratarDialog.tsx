"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UserCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPuestosCatalogo, listDepartamentosCatalogo } from "@/features/rrhh/actions/vacantes-actions";
import { listLocales } from "@/features/ajustes/actions/locales-actions";
import { contratarCandidato } from "@/features/rrhh/actions/contratacion-actions";

interface PuestoRef { id: string; nombre: string; departamento_id?: string | null }
interface DeptoRef { id: string; nombre: string; area?: string | null }
interface LocalRef { id: string; nombre: string }

export interface ContratarCandidatoLite {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  vacantePuestoId: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidato: ContratarCandidatoLite | null;
  onDone: () => void;
}

const hoy = () => new Date().toISOString().slice(0, 10);

export function ContratarDialog({ open, onOpenChange, candidato, onDone }: Props) {
  const [puestos, setPuestos] = useState<PuestoRef[]>([]);
  const [departamentos, setDepartamentos] = useState<DeptoRef[]>([]);
  const [locales, setLocales] = useState<LocalRef[]>([]);

  const [puestoId, setPuestoId] = useState("");
  const [primerDia, setPrimerDia] = useState(hoy());
  const [localId, setLocalId] = useState("");
  const [emailEmpresa, setEmailEmpresa] = useState("");

  const [pending, startTransition] = useTransition();

  const puestoSel = puestos.find((p) => p.id === puestoId) ?? null;
  const deptoSel = departamentos.find((d) => d.id === puestoSel?.departamento_id) ?? null;
  const esAdministrativo = (deptoSel?.area ?? "OPERATIVA").toUpperCase() === "ADMINISTRATIVA";

  // Reinicia el wizard y precarga catálogos cada vez que se abre con OTRO
  // candidato. Depende de primitivas estables (id + puesto de la vacante), no
  // del objeto `candidato` —que el padre recrea en cada render—, para no pisar
  // un cambio manual de puesto con el valor por defecto en re-renders.
  const candidatoId = candidato?.id ?? null;
  const vacantePuestoId = candidato?.vacantePuestoId ?? null;
  useEffect(() => {
    if (!open || !candidatoId) return;
    setPrimerDia(hoy());
    setEmailEmpresa("");
    // Default inmediato: el puesto de la vacante sale ya seleccionado aunque el
    // catálogo aún esté cargando (sin esperar al fetch).
    setPuestoId(vacantePuestoId ?? "");
    void Promise.all([listPuestosCatalogo(), listDepartamentosCatalogo(), listLocales()]).then(
      ([p, d, l]) => {
        setPuestos((p.data ?? []) as PuestoRef[]);
        setDepartamentos((d.data ?? []) as DeptoRef[]);
        const locs = (l.data ?? []) as LocalRef[];
        setLocales(locs);
        setLocalId(locs.length === 1 ? locs[0].id : "");
      },
    );
  }, [open, candidatoId, vacantePuestoId]);

  function contratar() {
    if (!candidato) return;
    if (!puestoId) { toast.error("Selecciona el puesto"); return; }
    if (!primerDia) { toast.error("Indica el primer día de trabajo"); return; }
    if (!localId) { toast.error("Selecciona el local"); return; }
    if (esAdministrativo && !emailEmpresa.trim()) { toast.error("Los puestos administrativos requieren email de empresa"); return; }
    startTransition(async () => {
      const res = await contratarCandidato({
        candidatoId: candidato.id,
        puestoId,
        nivel: 1,
        primerDia,
        localId,
        emailEmpresa: esAdministrativo ? emailEmpresa.trim() : null,
      });
      if (res.ok && res.empleadoId) {
        toast.success(res.reactivado ? "Empleado reactivado (re-contratación)" : "Empleado contratado");
        // Cierra el diálogo y vuelve a la vacante: la contratación queda hecha.
        // El alta a la gestoría se gestiona después desde la ficha del empleado.
        onDone();
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "No se pudo contratar");
      }
    });
  }

  if (!candidato) return null;
  const nombreCand = `${candidato.nombre} ${candidato.apellidos ?? ""}`.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" /> Contratar a {nombreCand}
          </DialogTitle>
          <DialogDescription>
            Confirma el puesto. Se creará el empleado y su usuario heredando las condiciones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ct-puesto">Puesto</Label>
              <select
                id="ct-puesto"
                value={puestoId}
                onChange={(e) => setPuestoId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Selecciona…</option>
                {puestos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                {/* El puesto de la vacante puede no estar en el catálogo activo
                    (p. ej. desactivado): lo añadimos para que el default sea visible. */}
                {puestoId && !puestos.some((p) => p.id === puestoId) && (
                  <option value={puestoId}>Puesto de la vacante</option>
                )}
              </select>
              {deptoSel && (
                <p className="text-xs text-muted-foreground">
                  Departamento: {deptoSel.nombre} · Área {esAdministrativo ? "administrativa" : "operativa"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ct-fecha">Primer día de trabajo</Label>
                <Input id="ct-fecha" type="date" value={primerDia} onChange={(e) => setPrimerDia(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-local">Local</Label>
                <select
                  id="ct-local"
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">Selecciona…</option>
                  {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
            </div>

            {esAdministrativo ? (
              <div className="space-y-1.5">
                <Label htmlFor="ct-emailempresa">Email de empresa (acceso)</Label>
                <Input id="ct-emailempresa" type="email" value={emailEmpresa} onChange={(e) => setEmailEmpresa(e.target.value)} placeholder="nombre@empresa.com" />
                <p className="text-xs text-muted-foreground">Puesto administrativo: el acceso usa el correo de empresa.</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Acceso con su email personal: <span className="font-medium">{candidato.email}</span>
              </p>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
          <Button onClick={contratar} disabled={pending}>
            {pending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Contratando…</> : "Contratar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
