"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Copy, Check, Send, UserCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPuestosCatalogo, listDepartamentosCatalogo } from "@/features/rrhh/actions/vacantes-actions";
import { listNivelesDePuesto } from "@/features/rrhh/actions/salarios-actions";
import { listLocales } from "@/features/ajustes/actions/locales-actions";
import { contratarCandidato } from "@/features/rrhh/actions/contratacion-actions";
import { enviarAltaGestoria } from "@/features/rrhh/actions/gestoria-actions";
import type { NivelSalarial } from "@/features/rrhh/data/salarios";

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

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });
const hoy = () => new Date().toISOString().slice(0, 10);

export function ContratarDialog({ open, onOpenChange, candidato, onDone }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [puestos, setPuestos] = useState<PuestoRef[]>([]);
  const [departamentos, setDepartamentos] = useState<DeptoRef[]>([]);
  const [locales, setLocales] = useState<LocalRef[]>([]);
  const [niveles, setNiveles] = useState<NivelSalarial[]>([]);

  const [puestoId, setPuestoId] = useState("");
  const [nivel, setNivel] = useState(1);
  const [primerDia, setPrimerDia] = useState(hoy());
  const [localId, setLocalId] = useState("");
  const [emailEmpresa, setEmailEmpresa] = useState("");

  const [empleadoId, setEmpleadoId] = useState<string | null>(null);
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [gestoriaEnviada, setGestoriaEnviada] = useState(false);
  const [pending, startTransition] = useTransition();

  const puestoSel = puestos.find((p) => p.id === puestoId) ?? null;
  const deptoSel = departamentos.find((d) => d.id === puestoSel?.departamento_id) ?? null;
  const esAdministrativo = (deptoSel?.area ?? "OPERATIVA").toUpperCase() === "ADMINISTRATIVA";
  const nivelSel = niveles.find((n) => n.nivel === nivel) ?? niveles[0] ?? null;

  useEffect(() => {
    if (!open || !candidato) return;
    setStep(1);
    setEmpleadoId(null);
    setCredenciales(null);
    setGestoriaEnviada(false);
    setPrimerDia(hoy());
    setEmailEmpresa("");
    void Promise.all([listPuestosCatalogo(), listDepartamentosCatalogo(), listLocales()]).then(
      ([p, d, l]) => {
        setPuestos((p.data ?? []) as PuestoRef[]);
        setDepartamentos((d.data ?? []) as DeptoRef[]);
        const locs = (l.data ?? []) as LocalRef[];
        setLocales(locs);
        setLocalId(locs.length === 1 ? locs[0].id : "");
        setPuestoId(candidato.vacantePuestoId ?? "");
      },
    );
  }, [open, candidato]);

  // Cargar niveles del puesto elegido.
  useEffect(() => {
    if (!puestoId) { setNiveles([]); return; }
    void listNivelesDePuesto(puestoId).then((r) => {
      const ns = r.ok ? r.data : [];
      setNiveles(ns);
      setNivel(ns[0]?.nivel ?? 1);
    });
  }, [puestoId]);

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
        nivel,
        primerDia,
        localId,
        emailEmpresa: esAdministrativo ? emailEmpresa.trim() : null,
      });
      if (res.ok && res.empleadoId) {
        setEmpleadoId(res.empleadoId);
        if (res.tempPassword) {
          setCredenciales({ email: esAdministrativo ? emailEmpresa.trim() : candidato.email, password: res.tempPassword });
        }
        toast.success(res.reactivado ? "Empleado reactivado (re-contratación)" : "Empleado contratado");
        setStep(2);
        onDone();
      } else {
        toast.error(res.error ?? "No se pudo contratar");
      }
    });
  }

  function enviarGestoria() {
    if (!empleadoId) return;
    startTransition(async () => {
      const res = await enviarAltaGestoria(empleadoId);
      if (res.ok) {
        setGestoriaEnviada(true);
        toast.success("Alta enviada a la gestoría");
      } else {
        toast.error(res.error ?? "No se pudo enviar a la gestoría");
      }
    });
  }

  async function copiar() {
    if (!credenciales) return;
    try {
      await navigator.clipboard.writeText(`Email: ${credenciales.email}\nContraseña: ${credenciales.password}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { toast.error("No se pudo copiar"); }
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
            {step === 1
              ? "Confirma el puesto y el nivel. Se creará el empleado y su usuario heredando las condiciones."
              : "Empleado creado. Revisa y envía el alta a la gestoría."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
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
              </select>
              {deptoSel && (
                <p className="text-xs text-muted-foreground">
                  Departamento: {deptoSel.nombre} · Área {esAdministrativo ? "administrativa" : "operativa"}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ct-nivel">Nivel</Label>
              <select
                id="ct-nivel"
                value={nivel}
                onChange={(e) => setNivel(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                disabled={niveles.length === 0}
              >
                {niveles.length === 0 ? (
                  <option value={1}>Sin niveles definidos</option>
                ) : (
                  niveles.map((n) => (
                    <option key={n.nivel} value={n.nivel}>
                      Nivel {n.nivel} — {eur(n.salarioNeto)} · {n.jornadaContrato || "jornada s/d"}
                    </option>
                  ))
                )}
              </select>
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

            {nivelSel && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Salario neto</span><span className="font-semibold">{eur(nivelSel.salarioNeto)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Jornada</span><span>{nivelSel.jornadaContrato || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Horas/semana</span><span>{nivelSel.horasSemanales || 0}h</span></div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {credenciales && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 space-y-2">
                <p className="text-sm font-medium text-emerald-800">Credenciales de primer acceso</p>
                <div className="text-sm">
                  <p>Email: <span className="font-mono">{credenciales.email}</span></p>
                  <p>Contraseña: <span className="font-mono">{credenciales.password}</span></p>
                </div>
                <Button size="sm" variant="outline" onClick={copiar}>
                  {copiado ? <><Check className="h-4 w-4 mr-1" /> Copiado</> : <><Copy className="h-4 w-4 mr-1" /> Copiar</>}
                </Button>
              </div>
            )}
            <div className="rounded-md border border-border/60 p-3 text-sm space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Resumen para la gestoría</p>
              <div className="flex justify-between"><span className="text-muted-foreground">Empleado</span><span>{nombreCand}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Puesto</span><span>{puestoSel?.nombre ?? "—"} · Nivel {nivel}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Primer día</span><span>{primerDia}</span></div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
              <Button onClick={contratar} disabled={pending}>
                {pending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Contratando…</> : "Contratar"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cerrar</Button>
              <Button onClick={enviarGestoria} disabled={pending || gestoriaEnviada}>
                {gestoriaEnviada ? <><Check className="h-4 w-4 mr-1" /> Enviado</> : <><Send className="h-4 w-4 mr-1" /> Enviar a gestoría</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
