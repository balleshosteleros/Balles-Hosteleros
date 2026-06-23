"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2, FileText, ArrowRight, Sparkles,
  AlertTriangle, Inbox, Copy, Check, KeyRound, Trash2,
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CandidatoDetailModal } from "@/features/rrhh/components/reclutamiento/CandidatoDetailModal";
import {
  ESTADOS_CONFIG,
  type Candidato, type Vacante, type EstadoReclutamiento, type OrigenCandidatura,
} from "@/features/rrhh/data/reclutamiento";
import {
  listCandidatosReales,
  moverCandidatoFase,
  iniciarOffboarding,
  eliminarCandidato,
} from "@/features/rrhh/actions/candidatos-actions";
import { promoverCandidato } from "@/features/rrhh/actions/promocion-actions";
import {
  listPuestosCatalogo, listDepartamentosCatalogo,
} from "@/features/rrhh/actions/vacantes-actions";
import { listLocales } from "@/features/ajustes/actions/locales-actions";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

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
  origen: string | null;
  puntuacion: number | null;
  fase: Fase;
  estado: Estado;
  promovido_at: string | null;
  empleado_id: string | null;
  vacante_id: string | null;
  vacantes?: { id: string; titulo: string; departamento_id: string | null; puesto_id: string | null } | null;
  created_at: string;
}

const ESTADOS_POR_FASE: Record<Fase, Estado[]> = {
  nuevo: ["nuevo"],
  en_progreso: ["elegido", "papelera"],
  oferta: ["entrevista"],
  seleccionado: ["teorica", "practica", "prueba", "empleado"],
  descartado: ["no_se_presenta", "suspenso_formacion"],
};

interface PuestoRef { id: string; nombre: string; departamento_id?: string | null }
interface DepartamentoRef { id: string; nombre: string }

function fmtFecha(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

const ORIGENES_VALIDOS = new Set<OrigenCandidatura>([
  "web", "formulario", "redes_sociales", "recomendacion", "base_datos", "portal_empleo", "otros",
]);

/** Mapea la fila real de BD a la forma `Candidato` que consume la ficha modal. */
function toCandidato(c: CandidatoReal): Candidato {
  const origen = (c.origen && ORIGENES_VALIDOS.has(c.origen as OrigenCandidatura)
    ? c.origen
    : "otros") as OrigenCandidatura;
  return {
    id: c.id,
    nombre: c.nombre,
    apellidos: c.apellidos ?? "",
    telefono: c.telefono ?? "",
    email: c.email,
    cvAdjunto: c.cv_url ?? undefined,
    fechaInscripcion: c.created_at?.slice(0, 10) ?? "",
    origen,
    notasInternas: "",
    fase: c.estado as EstadoReclutamiento,
    vacanteId: c.vacante_id ?? "",
    reclutadorAsignado: "",
    historial: [],
  };
}

/** Vacante mínima para la cabecera/cuestionario de la ficha. */
function vacanteParaModal(c: CandidatoReal | null): Vacante {
  return {
    id: c?.vacante_id ?? "",
    puesto: c?.vacantes?.titulo ?? "Candidatura",
    categoria: "",
    ubicacion: "",
    tipoJornada: "completa",
    estadoPublicacion: "publicada",
    fechaCreacion: "",
    cuestionario: true,
    reclutadores: [],
    favorita: false,
    candidatos: [],
    empresaId: "",
  };
}

export function CandidatosRealesTab() {
  const [items, setItems] = useState<CandidatoReal[]>([]);
  const [puestos, setPuestos] = useState<PuestoRef[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoRef[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);
  const [pending, startTransition] = useTransition();
  const { confirm, dialog: confirmDialog } = useConfirmDelete();

  // Dialog promoción
  const [promoverCand, setPromoverCand] = useState<CandidatoReal | null>(null);
  const [promoverDepto, setPromoverDepto] = useState<string>("");
  const [promoverPuesto, setPromoverPuesto] = useState<string>("");
  const [promoverLocal, setPromoverLocal] = useState<string>("");
  const [locales, setLocales] = useState<Array<{ id: string; nombre: string }>>([]);

  // Credenciales temporales tras alta nueva (no reactivación)
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Aviso post-promoción → offboarding
  const [offboardingDe, setOffboardingDe] = useState<{ empleadoId: string; nombre: string } | null>(null);

  // Ficha del candidato (modal completo: actividad, notas, reseñas, cuestionario, CV).
  const [selected, setSelected] = useState<CandidatoReal | null>(null);

  // Toast informativo de "ya es empleado, movimiento solo organizativo"
  const cargar = useCallback(async () => {
    setLoading(true);
    const [c, p, d, l] = await Promise.all([
      listCandidatosReales(),
      listPuestosCatalogo(),
      listDepartamentosCatalogo(),
      listLocales(),
    ]);
    setItems(((c.data ?? []) as unknown) as CandidatoReal[]);
    setPuestos((p.data ?? []) as PuestoRef[]);
    setDepartamentos((d.data ?? []) as DepartamentoRef[]);
    setLocales(
      ((l.data ?? []) as Array<{ id: string; nombre: string }>).map((x) => ({
        id: x.id,
        nombre: x.nombre,
      })),
    );
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
        setSelected((prev) => (prev && prev.id === c.id ? { ...prev, fase, estado: nuevoEstado } : prev));
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

  function handleEliminar(c: CandidatoReal) {
    void (async () => {
      const nombre = `${c.nombre} ${c.apellidos ?? ""}`.trim();
      const ok = await confirm({
        title: "Borrar candidato",
        description: c.promovido_at
          ? `Se eliminará la candidatura de ${nombre} (notas, reseñas y actividad). Su ficha de empleado NO se borra. Esta acción no se puede deshacer.`
          : `Se eliminará a ${nombre} junto con sus notas, reseñas y actividad. Esta acción no se puede deshacer.`,
        confirmLabel: "Borrar candidato",
      });
      if (!ok) return;
      startTransition(async () => {
        const res = await eliminarCandidato(c.id);
        if (res.ok) {
          setItems((prev) => prev.filter((x) => x.id !== c.id));
          setSelected((prev) => (prev && prev.id === c.id ? null : prev));
          toast.success("Candidato borrado");
        } else {
          toast.error(("error" in res && res.error) || "No se pudo borrar el candidato");
        }
      });
    })();
  }

  function abrirPromover(c: CandidatoReal) {
    setPromoverCand(c);
    setPromoverDepto(c.vacantes?.departamento_id ?? "");
    setPromoverPuesto(c.vacantes?.puesto_id ?? "");
    // Si solo hay un local, lo pre-seleccionamos.
    setPromoverLocal(locales.length === 1 ? locales[0].id : "");
  }

  function ejecutarPromover() {
    if (!promoverCand) return;
    if (!promoverLocal) {
      toast.error("Selecciona el local del nuevo empleado");
      return;
    }
    const emailCand = promoverCand.email;
    startTransition(async () => {
      const res = await promoverCandidato({
        candidatoId: promoverCand.id,
        departamentoId: promoverDepto || null,
        puestoId: promoverPuesto || null,
        localId: promoverLocal,
      });
      if (res.ok) {
        setPromoverCand(null);
        if (res.tempPassword) {
          // Alta nueva: mostramos credenciales temporales para el primer acceso.
          setCredenciales({ email: emailCand, password: res.tempPassword });
        } else {
          toast.success(
            res.reactivado
              ? "Empleado reactivado (re-contratación)"
              : "Empleado creado",
          );
        }
        void cargar();
      } else {
        toast.error(res.error ?? "Error al promover");
      }
    });
  }

  async function copiarCredenciales() {
    if (!credenciales) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${credenciales.email}\nContraseña: ${credenciales.password}`,
      );
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
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
        <h2 className="text-lg font-semibold">Candidatos</h2>
        <p className="text-sm text-muted-foreground">
          Pulsa un candidato para abrir su ficha (actividad, notas, reseñas, cuestionario y CV). Al llegar a <b>Prueba</b> aparece el botón para crearlo en el sistema.
        </p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidato</TableHead>
              <TableHead>Vacante</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-center">Cuestionario</TableHead>
              <TableHead>CV</TableHead>
              <TableHead>Perfil creado</TableHead>
              <TableHead className="text-right">Opciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => {
              const cfgEstado = ESTADOS_CONFIG[c.estado as EstadoReclutamiento];
              const mostrarBoton =
                c.fase === "seleccionado" && c.estado === "prueba" && c.promovido_at === null;
              const yaPromovido = !!c.promovido_at;
              return (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelected(c)}
                >
                  <TableCell>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{c.nombre} {c.apellidos}</span>
                        {yaPromovido && (
                          <Badge variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-700 shrink-0">
                            Empleado
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{c.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.vacantes?.titulo ?? "—"}</TableCell>
                  <TableCell>
                    {cfgEstado ? (
                      <Badge variant="outline" className="text-[11px]" style={{ borderColor: cfgEstado.color, color: cfgEstado.color }}>
                        {cfgEstado.label}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{c.telefono ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    {c.puntuacion == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={`font-semibold tabular-nums ${c.puntuacion >= 5 ? "text-emerald-600" : "text-rose-600"}`}>
                        {c.puntuacion}/10
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.cv_url ? (
                      <a
                        href={`/api/empleo/cv?path=${encodeURIComponent(c.cv_url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> Ver CV
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{fmtFecha(c.created_at)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {mostrarBoton ? (
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => abrirPromover(c)}
                          disabled={pending}
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Crear en sistema
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelected(c)}>
                          Ver ficha
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleEliminar(c)}
                        disabled={pending}
                        title="Borrar candidato"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* ── Ficha del candidato ──────────────────── */}
      <CandidatoDetailModal
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        candidato={selected ? toCandidato(selected) : null}
        candidatos={items.map(toCandidato)}
        vacante={vacanteParaModal(selected)}
        onSelectCandidato={(c) => setSelected(c ? items.find((x) => x.id === c.id) ?? null : null)}
        onUpdateCandidato={() => { /* ediciones de sidebar no persisten aquí */ }}
        onMoverEstado={(c, estado) => {
          const real = items.find((x) => x.id === c.id);
          if (real) moverEstado(real, estado as Estado);
        }}
        onEliminar={(c) => {
          const real = items.find((x) => x.id === c.id);
          if (real) handleEliminar(real);
        }}
      />

      {/* ── Dialog Promover ──────────────────── */}
      <Dialog open={!!promoverCand} onOpenChange={(o) => !o && setPromoverCand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Crear empleado en el sistema
            </DialogTitle>
            <DialogDescription>
              Vas a contratar a <b>{promoverCand?.nombre} {promoverCand?.apellidos}</b>. Se creará su cuenta y se te mostrará una <b>contraseña temporal</b> para el primer acceso. Si hay SMTP configurado, además recibirá un enlace por email.
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

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Local <span className="text-rose-500">*</span>
              </label>
              <Select value={promoverLocal} onValueChange={setPromoverLocal}>
                <SelectTrigger>
                  <SelectValue placeholder={locales.length === 0 ? "Sin locales disponibles" : "Selecciona…"} />
                </SelectTrigger>
                <SelectContent>
                  {locales.length === 0 ? (
                    <SelectItem value="__none__" disabled>Esta empresa no tiene locales</SelectItem>
                  ) : (
                    locales.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
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

      {/* ── Credenciales temporales (alta nueva) ──────────────────── */}
      <Dialog open={credenciales !== null} onOpenChange={(o) => { if (!o) setCredenciales(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-emerald-600" />
              Empleado creado
            </DialogTitle>
            <DialogDescription>
              Credenciales temporales para el primer acceso al portal. Se le pedirá cambiar la contraseña al iniciar sesión. Entrégaselas tú: el email solo sale si hay SMTP configurado.
            </DialogDescription>
          </DialogHeader>
          {credenciales && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 font-mono text-sm">
              <div><span className="text-muted-foreground">Email: </span>{credenciales.email}</div>
              <div><span className="text-muted-foreground">Contraseña: </span>{credenciales.password}</div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={copiarCredenciales} className="gap-2">
              {copiado ? <><Check className="h-4 w-4" />Copiado</> : <><Copy className="h-4 w-4" />Copiar</>}
            </Button>
            <Button onClick={() => setCredenciales(null)}>Hecho</Button>
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

      {/* ── Confirmación de borrado de candidato ──────────────────── */}
      {confirmDialog}
    </div>
  );
}
