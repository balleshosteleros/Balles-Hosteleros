"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UserCheck, AlertTriangle, Mail, Send, ArrowLeft, Building2, User } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { listPuestosCatalogo, listDepartamentosCatalogo } from "@/features/rrhh/actions/vacantes-actions";
import { listLocales } from "@/features/ajustes/actions/locales-actions";
import { contratarCandidato } from "@/features/rrhh/actions/contratacion-actions";
import {
  iniciarContratacion,
  previewContratacionEmails,
  type EmailContratacionPreview,
} from "@/features/rrhh/actions/contratacion-fase-actions";

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
  /**
   * "final": contratación definitiva (comportamiento por defecto).
   * "iniciar": entrada en la fase Contratación (PRP-070): crea el empleado,
   *   envía el alta a la gestoría y el contrato interno a firmar.
   */
  variante?: "final" | "iniciar";
}

const hoy = () => new Date().toISOString().slice(0, 10);

export function ContratarDialog({ open, onOpenChange, candidato, onDone, variante = "final" }: Props) {
  const esIniciar = variante === "iniciar";
  const [puestos, setPuestos] = useState<PuestoRef[]>([]);
  const [departamentos, setDepartamentos] = useState<DeptoRef[]>([]);
  const [locales, setLocales] = useState<LocalRef[]>([]);

  const [puestoId, setPuestoId] = useState("");
  const [primerDia, setPrimerDia] = useState(hoy());
  const [localId, setLocalId] = useState("");
  const [emailEmpresa, setEmailEmpresa] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Wizard de «iniciar contratación»: paso 1 = datos, paso 2 = confirmar correos.
  const [paso, setPaso] = useState<"datos" | "emails">("datos");
  const [emails, setEmails] = useState<EmailContratacionPreview[] | null>(null);
  const [enviarFlags, setEnviarFlags] = useState<Record<string, boolean>>({});
  const [cargandoPreview, setCargandoPreview] = useState(false);

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
    setErrorMsg(null);
    setPaso("datos");
    setEmails(null);
    setEnviarFlags({});
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

  // Valida los datos y, en la variante «iniciar», avanza al paso de confirmar los
  // correos (carga la vista previa de cada email con su destinatario real).
  function irAConfirmarEmails() {
    if (!candidato) return;
    if (!puestoId) { toast.error("Selecciona el puesto"); return; }
    if (!primerDia) { toast.error("Indica el primer día de trabajo"); return; }
    if (!localId) { toast.error("Selecciona el local"); return; }
    if (esAdministrativo && !emailEmpresa.trim()) { toast.error("Los puestos administrativos requieren email de empresa"); return; }
    setErrorMsg(null);
    setCargandoPreview(true);
    startTransition(async () => {
      const res = await previewContratacionEmails(candidato.id);
      setCargandoPreview(false);
      if (!res.ok || !res.emails) {
        toast.error(res.error ?? "No se pudo preparar la vista previa de correos");
        return;
      }
      setEmails(res.emails);
      // Por defecto, marcar para enviar los que están disponibles.
      setEnviarFlags(Object.fromEntries(res.emails.map((e) => [e.clave, e.disponible])));
      setPaso("emails");
    });
  }

  // Ejecuta la contratación respetando qué correos confirmó el usuario.
  function confirmarYEnviar() {
    if (!candidato) return;
    startTransition(async () => {
      try {
        const res = await iniciarContratacion({
          candidatoId: candidato.id,
          puestoId,
          primerDia,
          localId,
          emailEmpresa: esAdministrativo ? emailEmpresa.trim() : null,
          enviarGestoria: enviarFlags["gestoria_alta"] ?? false,
          enviarContratoInterno: enviarFlags["contrato_interno"] ?? false,
        });
        if (res.ok && res.empleadoId) {
          const partes: string[] = [];
          if (res.gestoriaEnviada) partes.push("alta a gestoría");
          if (res.contratoInternoEnviado) partes.push("contrato interno");
          const description = partes.length
            ? `${partes.join(" y ").charAt(0).toUpperCase()}${partes.join(" y ").slice(1)} enviados`
            : "Empleado creado (sin correos)";
          toast.success("Contratación iniciada", { description });
          setErrorMsg(null);
          onDone();
          onOpenChange(false);
        } else {
          const msg = res.error ?? "No se pudo iniciar la contratación";
          setErrorMsg(msg);
          toast.error(msg, { description: "Pulsa «Confirmar y enviar» de nuevo para reintentar." });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error inesperado al contratar";
        setErrorMsg(msg);
        toast.error("No se pudo completar la contratación", { description: msg });
      }
    });
  }

  function contratar() {
    if (!candidato) return;
    if (!puestoId) { toast.error("Selecciona el puesto"); return; }
    if (!primerDia) { toast.error("Indica el primer día de trabajo"); return; }
    if (!localId) { toast.error("Selecciona el local"); return; }
    if (esAdministrativo && !emailEmpresa.trim()) { toast.error("Los puestos administrativos requieren email de empresa"); return; }
    startTransition(async () => {
      try {
      const res = await contratarCandidato({
        candidatoId: candidato.id,
        puestoId,
        nivel: 1,
        primerDia,
        localId,
        emailEmpresa: esAdministrativo ? emailEmpresa.trim() : null,
      });
      if (res.ok && res.empleadoId) {
        // Cierra el diálogo y vuelve a la vacante: la contratación queda hecha y
        // el alta a la gestoría se envía automáticamente en el mismo paso.
        const base = res.reactivado ? "Empleado reactivado (re-contratación)" : "Empleado contratado";
        if (res.gestoriaEnviada) {
          toast.success(base, { description: "Alta enviada a la gestoría" });
        } else {
          toast.success(base);
          toast.warning("No se envió el alta a la gestoría", {
            description: "Revisa el correo de la gestoría en Ajustes → RRHH → Reclutamiento.",
          });
        }
        setErrorMsg(null);
        onDone();
        onOpenChange(false);
      } else {
        // El diálogo NO se cierra: los datos siguen rellenos y basta con volver a
        // pulsar «Contratar» para reintentar en un solo paso. El error se muestra
        // en un banner visible dentro del diálogo (no solo un toast efímero).
        const msg = res.error ?? "No se pudo contratar";
        setErrorMsg(msg);
        toast.error(msg, {
          description: "Los datos siguen aquí. Pulsa «Contratar» de nuevo para reintentar.",
        });
      }
      } catch (e) {
        // Fallo inesperado (red, timeout, crash del servidor): avisa SIEMPRE en el
        // momento y deja el diálogo abierto para reintentar. La reversión del
        // candidato la hace el servidor; si no llegó a ejecutarse, el reintento
        // vuelve a lanzarla.
        const msg = e instanceof Error ? e.message : "Error inesperado al contratar";
        setErrorMsg(msg);
        toast.error("No se pudo completar la contratación", {
          description: `${msg}. Vuelve a intentarlo; si persiste, avisa a soporte.`,
        });
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
            <UserCheck className="h-5 w-5" />{" "}
            {esIniciar ? `Iniciar contratación de ${nombreCand}` : `Contratar a ${nombreCand}`}
          </DialogTitle>
          <DialogDescription>
            {esIniciar
              ? (paso === "datos"
                  ? "Se creará el empleado. En el siguiente paso confirmarás qué correos enviar."
                  : "Confirma qué correos quieres enviar. Puedes activar o desactivar cada uno.")
              : "Confirma el puesto. Se creará el empleado y su usuario heredando las condiciones."}
          </DialogDescription>
        </DialogHeader>

        {/* PASO 2 (solo variante iniciar): confirmar los correos a enviar. */}
        {esIniciar && paso === "emails" ? (
          <div className="space-y-3 py-2">
            {errorMsg && (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs text-destructive/90">{errorMsg}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Al iniciar la contratación de <span className="font-medium text-foreground">{nombreCand}</span> se pueden enviar estos correos:
            </p>
            {(emails ?? []).map((em) => {
              const marcado = enviarFlags[em.clave] ?? false;
              return (
                <div
                  key={em.clave}
                  className={`rounded-lg border p-3 space-y-2 ${em.disponible ? "border-border bg-muted/20" : "border-amber-200 bg-amber-50"}`}
                >
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id={`em-${em.clave}`}
                      checked={marcado}
                      disabled={!em.disponible}
                      onCheckedChange={(v) =>
                        setEnviarFlags((f) => ({ ...f, [em.clave]: v === true }))
                      }
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor={`em-${em.clave}`} className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {em.titulo}
                      </Label>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {em.clave === "gestoria_alta" ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        <span className="font-medium">{em.destinatarioLabel}:</span>{" "}
                        {em.para || <span className="italic">sin destinatario</span>}
                      </p>
                      {em.disponible ? (
                        <>
                          <p className="text-xs text-muted-foreground"><span className="font-medium">Asunto:</span> {em.asunto}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-[22vh] overflow-y-auto pr-1">{em.cuerpo}</p>
                        </>
                      ) : (
                        <p className="text-xs text-amber-700">{em.motivoNoDisponible}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        <div className="space-y-4 py-2">
            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-medium">La contratación no se completó y se ha revertido.</p>
                  <p className="text-xs text-destructive/90">
                    {errorMsg}. Los datos siguen aquí: pulsa «{esIniciar ? "Iniciar contratación" : "Contratar"}» de nuevo para reintentarlo.
                  </p>
                </div>
              </div>
            )}
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
        )}

        <DialogFooter>
          {esIniciar && paso === "emails" ? (
            <>
              <Button variant="outline" onClick={() => { setPaso("datos"); setErrorMsg(null); }} disabled={pending} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Atrás
              </Button>
              <Button onClick={confirmarYEnviar} disabled={pending} className="gap-1.5">
                {pending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Iniciando…</>
                  : <><Send className="h-4 w-4" /> Confirmar y enviar</>}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending || cargandoPreview}>Cancelar</Button>
              <Button onClick={esIniciar ? irAConfirmarEmails : contratar} disabled={pending || cargandoPreview}>
                {(pending || cargandoPreview)
                  ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {esIniciar ? "Preparando…" : "Contratando…"}</>
                  : (esIniciar ? "Continuar" : "Contratar")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
