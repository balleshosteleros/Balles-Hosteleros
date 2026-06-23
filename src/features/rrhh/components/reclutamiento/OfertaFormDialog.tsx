"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createVacante, updateVacante, getVacanteById,
  listPuestosCatalogo, listDepartamentosCatalogo,
} from "@/features/rrhh/actions/vacantes-actions";
import { listJornadas, type JornadaRow } from "@/features/rrhh/actions/jornadas-actions";
import { listTiposContrato, type TipoContratoRow } from "@/features/rrhh/actions/tipos-contrato-actions";
import { listCuestionariosVacante } from "@/features/rrhh/actions/cuestionarios-vacante-actions";
import type { CuestionarioVacante } from "@/features/rrhh/data/cuestionario-vacante";
import {
  listPlantillasEstado,
  type PlantillaEstadoRow,
} from "@/features/rrhh/actions/plantillas-reclutamiento-actions";
import {
  listReclutamientoEmailPlantillas,
  type ReclutamientoEmailPlantilla,
} from "@/features/rrhh/actions/reclutamiento-email-plantillas-actions";
import { FASES_PLANTILLA_ESTADO } from "@/lib/seeds/reclutamiento-plantilla-estados";
import { useReglasSubmodulo } from "@/features/ajustes/hooks/use-reglas-submodulo";
import { ValidacionFaltantesDialog } from "@/features/ajustes/components/ValidacionFaltantesDialog";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

type EstadoPub = "publicada" | "borrador" | "cerrada" | "archivada";

interface PuestoRef { id: string; nombre: string; departamento_id?: string | null }
interface DepartamentoRef { id: string; nombre: string }

interface FormState {
  titulo: string;
  descripcion: string;
  puesto_id: string;
  departamento_id: string;
  tipo_jornada: string;
  tipo_contrato: string;
  salario_rango: string;
  estado_publicacion: EstadoPub;
  visible_publicamente: boolean;
  cuestionario_plantilla_id: string;
  plantilla_estado_id: string;
  /** Map { estado_key: email_estado } — qué email se usa al pasar a cada estado. */
  email_plantillas: Record<string, string>;
}

const SIN_CUESTIONARIO = "__none__";
const SIN_EMAIL = "__no_email__";

const FORM_VACIO: FormState = {
  titulo: "",
  descripcion: "",
  puesto_id: "",
  departamento_id: "",
  tipo_jornada: "",
  tipo_contrato: "",
  salario_rango: "",
  estado_publicacion: "borrador",
  visible_publicamente: false,
  cuestionario_plantilla_id: "",
  plantilla_estado_id: "",
  email_plantillas: {},
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Si se proporciona, edita esa vacante; si no, crea nueva. */
  vacanteId?: string | null;
  /** Título inicial al crear desde un nodo del organigrama. */
  tituloPrefill?: string | null;
  onSaved?: () => void;
}

export function OfertaFormDialog({ open, onOpenChange, vacanteId, tituloPrefill, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [puestos, setPuestos] = useState<PuestoRef[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoRef[]>([]);
  const [jornadas, setJornadas] = useState<JornadaRow[]>([]);
  const [tiposContrato, setTiposContrato] = useState<TipoContratoRow[]>([]);
  const [cuestionarios, setCuestionarios] = useState<CuestionarioVacante[]>([]);
  const [plantillasEstado, setPlantillasEstado] = useState<PlantillaEstadoRow[]>([]);
  const [emailPlantillas, setEmailPlantillas] = useState<ReclutamientoEmailPlantilla[]>([]);
  const [pending, startTransition] = useTransition();
  const [loadingExisting, setLoadingExisting] = useState(false);
  useGlobalLoadingSync(loadingExisting);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const { validar } = useReglasSubmodulo("rrhh", "reclutamiento");

  const selectedEstadoTemplate = plantillasEstado.find((pe) => pe.id === form.plantilla_estado_id) ?? null;

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      listPuestosCatalogo(), listDepartamentosCatalogo(), listJornadas(), listCuestionariosVacante(),
      listPlantillasEstado(), listReclutamientoEmailPlantillas(), listTiposContrato(),
    ]).then(([p, d, j, c, pe, ep, tc]) => {
      setPuestos((p.data ?? []) as PuestoRef[]);
      setDepartamentos((d.data ?? []) as DepartamentoRef[]);
      setJornadas((j.data ?? []) as JornadaRow[]);
      setTiposContrato((tc.data ?? []) as TipoContratoRow[]);
      const cuests = (c.data ?? []) as CuestionarioVacante[];
      setCuestionarios(cuests);
      const plEstado = (pe.data ?? []) as PlantillaEstadoRow[];
      setPlantillasEstado(plEstado);
      setEmailPlantillas(ep as ReclutamientoEmailPlantilla[]);
      // Al crear una vacante nueva, preselecciona el cuestionario y la plantilla
      // de estados por defecto.
      if (!vacanteId) {
        const def = cuests.find((x) => x.esDefault);
        const predeterminada = plEstado.find((x) => x.es_predeterminada) ?? plEstado[0];
        setForm((f) => ({
          ...f,
          cuestionario_plantilla_id: f.cuestionario_plantilla_id || (def?.id ?? ""),
          plantilla_estado_id: f.plantilla_estado_id || (predeterminada?.id ?? ""),
        }));
      }
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!vacanteId) {
      setForm({ ...FORM_VACIO, titulo: tituloPrefill?.trim() ?? "" });
      return;
    }
    setLoadingExisting(true);
    void getVacanteById(vacanteId).then((res) => {
      const v = res.data as {
        titulo?: string; descripcion?: string | null;
        puesto_id?: string | null; departamento_id?: string | null;
        tipo_jornada?: string | null;
        tipo_contrato?: string | null;
        salario_rango?: string | null;
        estado_publicacion?: EstadoPub; visible_publicamente?: boolean;
        cuestionario_plantilla_id?: string | null;
        plantilla_estado_id?: string | null;
        email_plantillas?: Record<string, string> | null;
      } | null;
      if (v) {
        setForm({
          titulo: v.titulo ?? "",
          descripcion: v.descripcion ?? "",
          puesto_id: v.puesto_id ?? "",
          departamento_id: v.departamento_id ?? "",
          tipo_jornada: v.tipo_jornada ?? "",
          tipo_contrato: v.tipo_contrato ?? "",
          salario_rango: v.salario_rango ?? "",
          estado_publicacion: v.estado_publicacion ?? "borrador",
          visible_publicamente: !!v.visible_publicamente,
          cuestionario_plantilla_id: v.cuestionario_plantilla_id ?? "",
          plantilla_estado_id: v.plantilla_estado_id ?? "",
          email_plantillas: v.email_plantillas ?? {},
        });
      }
      setLoadingExisting(false);
    });
  }, [open, vacanteId, tituloPrefill]);

  function guardar() {
    // Jornada y tipo de contrato son obligatorios siempre (crear y editar).
    if (!form.tipo_jornada) {
      toast.error("La jornada es obligatoria");
      return;
    }
    if (!form.tipo_contrato) {
      toast.error("El tipo de contrato es obligatorio");
      return;
    }
    // Solo validamos reglas de submódulo al CREAR. Al editar dejamos pasar.
    if (!vacanteId) {
      const { labelsFaltantes } = validar({
        titulo: form.titulo,
        descripcion: form.descripcion,
        puesto_id: form.puesto_id,
        departamento_id: form.departamento_id,
        tipo_jornada: form.tipo_jornada,
        salario_rango: form.salario_rango,
        estado_publicacion: form.estado_publicacion,
      });
      if (labelsFaltantes.length > 0) {
        setFaltantes(labelsFaltantes);
        return;
      }
    }
    startTransition(async () => {
      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        puesto_id: form.puesto_id || null,
        departamento_id: form.departamento_id || null,
        tipo_jornada: form.tipo_jornada || null,
        tipo_contrato: form.tipo_contrato || null,
        salario_rango: form.salario_rango.trim() || null,
        estado_publicacion: form.estado_publicacion,
        visible_publicamente: form.visible_publicamente,
        cuestionario_plantilla_id: form.cuestionario_plantilla_id || null,
        cuestionario: !!form.cuestionario_plantilla_id,
        plantilla_estado_id: form.plantilla_estado_id || null,
        email_plantillas: form.email_plantillas ?? {},
      };
      const res = vacanteId
        ? await updateVacante(vacanteId, payload)
        : await createVacante(payload);
      if (res.ok) {
        toast.success(vacanteId ? "Oferta actualizada" : "Oferta creada");
        onOpenChange(false);
        onSaved?.();
      } else {
        toast.error(("error" in res && res.error) || "Error al guardar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{vacanteId ? "Editar oferta" : "Nueva oferta de empleo"}</DialogTitle>
          <DialogDescription>
            Las ofertas marcadas como visibles aparecen en el portal público de empleo de la empresa.
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Cargando…
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej. Camarero/a turno tarde"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Departamento</Label>
                <Select
                  value={form.departamento_id}
                  onValueChange={(v) => {
                    // Al cambiar de departamento, descartar el puesto si ya no pertenece a él.
                    const sigueValido = puestos.some((p) => p.id === form.puesto_id && p.departamento_id === v);
                    setForm({ ...form, departamento_id: v, puesto_id: sigueValido ? form.puesto_id : "" });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {departamentos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Puesto</Label>
                <Select value={form.puesto_id} onValueChange={(v) => setForm({ ...form, puesto_id: v })}>
                  <SelectTrigger><SelectValue placeholder={form.departamento_id ? "Selecciona…" : "Elige un departamento primero"} /></SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const puestosDelDepto = form.departamento_id
                        ? puestos.filter((p) => p.departamento_id === form.departamento_id)
                        : [];
                      if (!form.departamento_id) {
                        return <SelectItem value="__none__" disabled>Elige un departamento primero</SelectItem>;
                      }
                      if (puestosDelDepto.length === 0) {
                        return <SelectItem value="__none__" disabled>Sin puestos en este departamento</SelectItem>;
                      }
                      return puestosDelDepto.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jornada</Label>
                <Select value={form.tipo_jornada} onValueChange={(v) => setForm({ ...form, tipo_jornada: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {jornadas.length === 0 ? (
                      <SelectItem value="__none__" disabled>Sin jornadas (créalas en Ajustes → RRHH)</SelectItem>
                    ) : (
                      jornadas.map((j) => (
                        <SelectItem key={j.id} value={j.nombre}>{j.nombre}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rango salarial (opcional)</Label>
                <Input
                  value={form.salario_rango}
                  onChange={(e) => setForm({ ...form, salario_rango: e.target.value })}
                  placeholder="Ej. 18.000 - 22.000 € brutos/año"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={5}
                placeholder="Tareas, requisitos, beneficios…"
              />
            </div>

            {/* Plantilla de estados (consecución del pipeline) */}
            <div className="space-y-1.5">
              <Label>Plantilla de estados</Label>
              <Select
                value={form.plantilla_estado_id}
                onValueChange={(v) => setForm({ ...form, plantilla_estado_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {plantillasEstado.length === 0 ? (
                    <SelectItem value="__none__" disabled>Sin plantillas (créalas en Plantillas → Estados)</SelectItem>
                  ) : (
                    plantillasEstado.map((pe) => (
                      <SelectItem key={pe.id} value={pe.id}>
                        {pe.nombre}{pe.es_predeterminada ? " (predeterminada)" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Define la consecución de estados del proceso de selección de esta vacante.
              </p>
            </div>

            {/* Email por estado: qué plantilla de email se envía al pasar a cada estado */}
            {selectedEstadoTemplate && selectedEstadoTemplate.estados.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label className="text-xs">Email por estado</Label>
                <p className="text-[11px] text-muted-foreground -mt-1">
                  Para cada estado, elige qué plantilla de email se envía al candidato al pasar a ese estado.
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {[...selectedEstadoTemplate.estados]
                    .sort((a, b) => a.orden - b.orden)
                    .map((est) => {
                      const faseCfg = FASES_PLANTILLA_ESTADO[est.fase];
                      const current = form.email_plantillas[est.key]
                        ?? est.email_plantilla_id
                        ?? SIN_EMAIL;
                      return (
                        <div key={est.key} className="grid grid-cols-2 gap-2 items-center">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: est.color || faseCfg.color }} />
                            <span className="text-xs truncate">{est.label}</span>
                          </div>
                          <Select
                            value={current}
                            onValueChange={(v) =>
                              setForm((f) => {
                                const next = { ...f.email_plantillas };
                                if (v === SIN_EMAIL) delete next[est.key];
                                else next[est.key] = v;
                                return { ...f, email_plantillas: next };
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Email…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SIN_EMAIL}>Sin email</SelectItem>
                              {emailPlantillas.map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.nombre}{e.activa ? "" : " (inactiva)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Cuestionario para el candidato</Label>
              <Select
                value={form.cuestionario_plantilla_id || SIN_CUESTIONARIO}
                onValueChange={(v) =>
                  setForm({ ...form, cuestionario_plantilla_id: v === SIN_CUESTIONARIO ? "" : v })
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_CUESTIONARIO}>Sin cuestionario</SelectItem>
                  {cuestionarios.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}{c.esDefault ? " (por defecto)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                El candidato deberá responderlo antes de enviar su candidatura. Gestiona los cuestionarios en Configuración.
              </p>
            </div>

          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={pending || loadingExisting}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {vacanteId ? "Guardar cambios" : "Crear oferta"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ValidacionFaltantesDialog
        open={faltantes.length > 0}
        onClose={() => setFaltantes([])}
        campos={faltantes}
        submoduloLabel="Vacantes"
      />
    </Dialog>
  );
}
