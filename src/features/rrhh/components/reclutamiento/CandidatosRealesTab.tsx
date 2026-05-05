"use client";

import { useEffect, useState, useTransition, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Loader2, Mail, Phone, FileText, ArrowRight, Sparkles,
  AlertTriangle, ExternalLink, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listCandidatosReales,
  moverCandidatoFase,
  iniciarOffboarding,
} from "@/features/rrhh/actions/candidatos-actions";
import { promoverCandidato } from "@/features/rrhh/actions/promocion-actions";
import {
  listPuestosCatalogo, listDepartamentosCatalogo,
} from "@/features/rrhh/actions/vacantes-actions";

type Fase = "nuevo" | "en_progreso" | "oferta" | "seleccionado" | "descartado";
type Estado =
  | "nuevo" | "elegido" | "papelera" | "entrevista" | "teorica"
  | "practica" | "prueba" | "empleado" | "no_se_presenta" | "suspenso_formacion";

interface CandidatoReal {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  telefono: string | null;
  cv_url: string | null;
  fase: Fase;
  estado: Estado;
  promovido_at: string | null;
  empleado_id: string | null;
  vacante_id: string | null;
  vacantes?: { id: string; titulo: string; departamento_id: string | null; puesto_id: string | null } | null;
  created_at: string;
}

const FASES_ORDER: Fase[] = ["nuevo", "en_progreso", "oferta", "seleccionado", "descartado"];

const FASE_LABEL: Record<Fase, string> = {
  nuevo: "Nuevo",
  en_progreso: "En progreso",
  oferta: "Oferta",
  seleccionado: "Seleccionado",
  descartado: "Descartado",
};

const FASE_COLOR: Record<Fase, string> = {
  nuevo: "from-blue-500/15 to-blue-500/5 border-blue-500/30",
  en_progreso: "from-sky-500/15 to-sky-500/5 border-sky-500/30",
  oferta: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30",
  seleccionado: "from-emerald-700/20 to-emerald-700/10 border-emerald-700/40",
  descartado: "from-rose-500/15 to-rose-500/5 border-rose-500/30",
};

const ESTADOS_POR_FASE: Record<Fase, Estado[]> = {
  nuevo: ["nuevo"],
  en_progreso: ["elegido", "papelera"],
  oferta: ["entrevista"],
  seleccionado: ["teorica", "practica", "prueba", "empleado"],
  descartado: ["no_se_presenta", "suspenso_formacion"],
};

const ESTADO_LABEL: Record<Estado, string> = {
  nuevo: "Nuevo",
  elegido: "Elegido",
  papelera: "Papelera",
  entrevista: "Entrevista",
  teorica: "Teórica",
  practica: "Práctica",
  prueba: "Prueba",
  empleado: "Empleado",
  no_se_presenta: "No presentado",
  suspenso_formacion: "Suspendió",
};

interface PuestoRef { id: string; nombre: string; departamento_id?: string | null }
interface DepartamentoRef { id: string; nombre: string }

export function CandidatosRealesTab() {
  const [items, setItems] = useState<CandidatoReal[]>([]);
  const [puestos, setPuestos] = useState<PuestoRef[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  // Dialog promoción
  const [promoverCand, setPromoverCand] = useState<CandidatoReal | null>(null);
  const [promoverDepto, setPromoverDepto] = useState<string>("");
  const [promoverPuesto, setPromoverPuesto] = useState<string>("");

  // Aviso post-promoción → offboarding
  const [offboardingDe, setOffboardingDe] = useState<{ empleadoId: string; nombre: string } | null>(null);

  // Toast informativo de "ya es empleado, movimiento solo organizativo"
  const cargar = useCallback(async () => {
    setLoading(true);
    const [c, p, d] = await Promise.all([
      listCandidatosReales(),
      listPuestosCatalogo(),
      listDepartamentosCatalogo(),
    ]);
    setItems(((c.data ?? []) as unknown) as CandidatoReal[]);
    setPuestos((p.data ?? []) as PuestoRef[]);
    setDepartamentos((d.data ?? []) as DepartamentoRef[]);
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  function moverEstado(c: CandidatoReal, nuevoEstado: Estado) {
    // Encontrar la fase principal a la que pertenece nuevoEstado
    const fase = (Object.entries(ESTADOS_POR_FASE) as Array<[Fase, Estado[]]>)
      .find(([, estados]) => estados.includes(nuevoEstado))?.[0];
    if (!fase) return;

    startTransition(async () => {
      const res = await moverCandidatoFase(c.id, fase, nuevoEstado);
      if (res.ok) {
        if (res.empleadoYaContratado) {
          toast.info("Este candidato ya es empleado. El movimiento es solo organizativo y no afecta a su contrato.");
        }
        setItems((prev) => prev.map((x) => x.id === c.id ? { ...x, fase, estado: nuevoEstado } : x));
      } else if ("error" in res && res.error === "OFFBOARDING_REQUIRED") {
        const empleadoId = (res as { empleadoId?: string }).empleadoId;
        if (empleadoId) {
          setOffboardingDe({
            empleadoId,
            nombre: `${c.nombre} ${c.apellidos ?? ""}`.trim(),
          });
        }
      } else {
        toast.error(("error" in res && res.error) || "Error al mover el candidato");
      }
    });
  }

  function abrirPromover(c: CandidatoReal) {
    setPromoverCand(c);
    setPromoverDepto(c.vacantes?.departamento_id ?? "");
    setPromoverPuesto(c.vacantes?.puesto_id ?? "");
  }

  function ejecutarPromover() {
    if (!promoverCand) return;
    startTransition(async () => {
      const res = await promoverCandidato({
        candidatoId: promoverCand.id,
        departamentoId: promoverDepto || null,
        puestoId: promoverPuesto || null,
      });
      if (res.ok) {
        toast.success(
          res.reactivado
            ? "Empleado reactivado (re-contratación)"
            : res.magicLinkSent
            ? "Empleado creado y enlace de acceso enviado por email"
            : "Empleado creado (sin email enviado — revisa configuración SMTP)"
        );
        setPromoverCand(null);
        void cargar();
      } else {
        toast.error(res.error ?? "Error al promover");
      }
    });
  }

  function ejecutarOffboarding() {
    if (!offboardingDe) return;
    startTransition(async () => {
      const res = await iniciarOffboarding(offboardingDe.empleadoId);
      if (res.ok) {
        toast.success("Proceso de offboarding iniciado");
        setOffboardingDe(null);
        // Tras iniciar offboarding, marcar candidato como descartado/no_se_presenta
        // (el original moverCandidatoFase fue rechazado)
        void cargar();
      } else {
        toast.error(res.error ?? "Error al iniciar offboarding");
      }
    });
  }

  const grupos = useMemo(() => {
    const m: Record<Fase, CandidatoReal[]> = {
      nuevo: [], en_progreso: [], oferta: [], seleccionado: [], descartado: [],
    };
    for (const c of items) m[c.fase]?.push(c);
    return m;
  }, [items]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Cargando candidatos…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground space-y-3">
          <Inbox className="h-10 w-10 mx-auto opacity-40" />
          <div>
            <p className="font-medium">Aún no hay candidaturas reales</p>
            <p className="text-sm">
              Las candidaturas aparecerán aquí cuando alguien postule a una de tus ofertas públicas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Pipeline de candidaturas</h2>
        <p className="text-sm text-muted-foreground">
          Mueve los candidatos por las fases. Al llegar a <b>Seleccionado · Prueba</b> aparece el botón para crearlos en el sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {FASES_ORDER.map((fase) => (
          <div key={fase} className={`rounded-lg border bg-gradient-to-b p-3 ${FASE_COLOR[fase]}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-foreground/80">
                {FASE_LABEL[fase]}
              </h3>
              <Badge variant="secondary" className="text-[10px]">{grupos[fase]?.length ?? 0}</Badge>
            </div>

            <div className="space-y-2">
              {(grupos[fase] ?? []).length === 0 && (
                <div className="text-[11px] text-muted-foreground/60 text-center py-4">Vacío</div>
              )}
              {(grupos[fase] ?? []).map((c) => {
                const mostrarBoton =
                  c.fase === "seleccionado" &&
                  c.estado === "prueba" &&
                  c.promovido_at === null;
                const yaPromovido = !!c.promovido_at;
                return (
                  <Card key={c.id} className="bg-card border shadow-sm">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {c.nombre} {c.apellidos}
                          </p>
                          {c.vacantes?.titulo && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {c.vacantes.titulo}
                            </p>
                          )}
                        </div>
                        {yaPromovido && (
                          <Badge variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-700 shrink-0">
                            Empleado
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                        {c.email && (
                          <span className="inline-flex items-center gap-0.5">
                            <Mail className="h-2.5 w-2.5" /> {c.email}
                          </span>
                        )}
                        {c.telefono && (
                          <span className="inline-flex items-center gap-0.5">
                            <Phone className="h-2.5 w-2.5" /> {c.telefono}
                          </span>
                        )}
                      </div>

                      {/* Estado dropdown */}
                      <Select
                        value={c.estado}
                        onValueChange={(v) => moverEstado(c, v as Estado)}
                        disabled={pending}
                      >
                        <SelectTrigger className="h-7 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ESTADOS_POR_FASE).map(([f, ests]) => (
                            <div key={f}>
                              <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase">
                                {FASE_LABEL[f as Fase]}
                              </div>
                              {ests.map((e) => (
                                <SelectItem key={e} value={e} className="text-[11px]">
                                  {ESTADO_LABEL[e]}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>

                      {c.cv_url && (
                        <a
                          href={`/api/empleo/cv?path=${encodeURIComponent(c.cv_url)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" /> Ver CV <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}

                      {mostrarBoton && (
                        <Button
                          size="sm"
                          className="w-full h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => abrirPromover(c)}
                          disabled={pending}
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Crear en sistema
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Dialog Promover ──────────────────── */}
      <Dialog open={!!promoverCand} onOpenChange={(o) => !o && setPromoverCand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Crear empleado en el sistema
            </DialogTitle>
            <DialogDescription>
              Vas a contratar a <b>{promoverCand?.nombre} {promoverCand?.apellidos}</b>. Se creará una cuenta y se enviará un enlace de acceso por email para que complete sus datos personales en el primer login.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Departamento</label>
              <Select value={promoverDepto} onValueChange={setPromoverDepto}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Puesto</label>
              <Select value={promoverPuesto} onValueChange={setPromoverPuesto}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {puestos.length === 0 ? (
                    <SelectItem value="__none__" disabled>Sin puestos creados</SelectItem>
                  ) : (
                    puestos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800 flex gap-2 items-start">
              <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Si esta persona ya estuvo contratada (mismo email o DNI), <b>se reactivará su ficha antigua</b> en lugar de crear una nueva.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoverCand(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={ejecutarPromover} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700">
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar y crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Aviso offboarding obligatorio ──────────────────── */}
      <AlertDialog open={!!offboardingDe} onOpenChange={(o) => !o && setOffboardingDe(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Este trabajador ya está contratado
            </AlertDialogTitle>
            <AlertDialogDescription>
              <b>{offboardingDe?.nombre}</b> ya es empleado. Para descartarlo o darlo de baja debes iniciar el proceso de <b>Offboarding</b> (Boarding &gt; OFF).
              Al confirmar se creará un proceso de offboarding usando la plantilla por defecto y podrás seguir los pasos de la baja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={ejecutarOffboarding}
              disabled={pending}
            >
              Iniciar offboarding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
