"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MOTIVOS_BAJA,
  DIAS_SEMANA,
  TIPOS_MODIFICACION,
  PUESTO_OTRO_VALUE,
} from "@/features/gestoria/contrataciones/data/constants";
import {
  crearAlta,
  crearBaja,
  crearModificacion,
  listEmpleadosActivos,
  listPuestos,
} from "@/features/gestoria/contrataciones/actions/contrataciones-actions";
import type {
  AltaInput,
  BajaInput,
  EmpleadoActivo,
  ModificacionInput,
  TipoContratacion,
} from "@/features/gestoria/contrataciones/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialTipo?: TipoContratacion;
}

const TIPO_LABEL: Record<TipoContratacion, string> = {
  alta: "ALTA",
  baja: "BAJA",
  modificacion: "MODIFICACIÓN",
};

export function ContratacionModal({ open, onClose, onSaved, initialTipo = "alta" }: Props) {
  const [tipo, setTipo] = useState<TipoContratacion>(initialTipo);
  const [submitting, setSubmitting] = useState(false);
  const [empresaCorreoExtra, setEmpresaCorreoExtra] = useState("");
  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  const [empleadosLoading, setEmpleadosLoading] = useState(false);
  const [puestos, setPuestos] = useState<string[]>([]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [alta, setAlta] = useState<AltaInput>(() => emptyAlta(todayISO));
  const [jornadaCustom, setJornadaCustom] = useState<boolean>(false);
  const [puestoSelect, setPuestoSelect] = useState<string>("");
  const [puestoLibre, setPuestoLibre] = useState<string>("");

  const [baja, setBaja] = useState<BajaInput>(() => emptyBaja(todayISO));

  const [modi, setModi] = useState<ModificacionInput>(() => emptyModi(todayISO));
  const [modiPuestoSelect, setModiPuestoSelect] = useState<string>("");
  const [modiPuestoLibre, setModiPuestoLibre] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setTipo(initialTipo);
    setEmpresaCorreoExtra("");
    setAlta(emptyAlta(todayISO));
    setJornadaCustom(false);
    setPuestoSelect("");
    setPuestoLibre("");
    setBaja(emptyBaja(todayISO));
    setModi(emptyModi(todayISO));
    setModiPuestoSelect("");
    setModiPuestoLibre("");
  }, [open, todayISO, initialTipo]);

  useEffect(() => {
    if (!open) return;
    if (tipo === "baja" || tipo === "modificacion") {
      setEmpleadosLoading(true);
      listEmpleadosActivos()
        .then((r) => {
          if (r.ok) setEmpleados(r.data);
          else toast.error(r.error ?? "Error al cargar empleados");
        })
        .finally(() => setEmpleadosLoading(false));
    }
    if (tipo === "alta" || tipo === "modificacion") {
      listPuestos().then((r) => {
        if (r.ok) setPuestos(r.data);
      });
    }
  }, [open, tipo]);

  const puestoFinal = puestoSelect === PUESTO_OTRO_VALUE ? puestoLibre.trim() : puestoSelect;
  const modiPuestoFinal = modiPuestoSelect === PUESTO_OTRO_VALUE ? modiPuestoLibre.trim() : modiPuestoSelect;

  const altaValid =
    alta.nombre.trim() !== "" &&
    puestoFinal !== "" &&
    alta.fecha_comienzo.trim() !== "";

  const bajaValid =
    baja.empleado_id !== "" &&
    baja.fecha_finalizacion.trim() !== "" &&
    baja.motivo.trim() !== "" &&
    (baja.motivo !== "Otro" || (baja.motivo_otro ?? "").trim() !== "");

  const modiValid =
    modi.empleado_id !== "" &&
    modi.fecha_cambio.trim() !== "" &&
    modi.modificacion_tipo.trim() !== "" &&
    (modi.modificacion_tipo !== "Puesto" || modiPuestoFinal !== "") &&
    (modi.modificacion_tipo === "Puesto" || modi.modificacion_detalle.trim() !== "");

  const handleSave = async () => {
    setSubmitting(true);
    try {
      if (tipo === "alta") {
        if (!altaValid) {
          toast.error("Completa nombre, puesto y fecha de comienzo");
          return;
        }
        const r = await crearAlta({ ...alta, puesto: puestoFinal }, empresaCorreoExtra || null);
        if (!r.ok) return toast.error(r.error ?? "Error al crear alta");
        if (r.emailOk === false) toast.warning(`Alta guardada, pero el email falló: ${r.emailError ?? ""}`);
        else toast.success("Alta enviada a gestoría");
        onSaved();
        onClose();
        return;
      }
      if (tipo === "baja") {
        if (!bajaValid) {
          toast.error("Selecciona empleado y completa los campos requeridos");
          return;
        }
        const r = await crearBaja(baja, empresaCorreoExtra || null);
        if (!r.ok) return toast.error(r.error ?? "Error al crear baja");
        if (r.emailOk === false) toast.warning(`Baja guardada, pero el email falló: ${r.emailError ?? ""}`);
        else toast.success("Baja enviada a gestoría");
        onSaved();
        onClose();
        return;
      }
      if (!modiValid) {
        toast.error("Completa empleado, fecha, tipo y detalle");
        return;
      }
      const r = await crearModificacion(
        {
          ...modi,
          nuevo_puesto: modi.modificacion_tipo === "Puesto" ? modiPuestoFinal : undefined,
        },
        empresaCorreoExtra || null,
      );
      if (!r.ok) return toast.error(r.error ?? "Error al crear modificación");
      if (r.emailOk === false) toast.warning(`Modificación guardada, pero el email falló: ${r.emailError ?? ""}`);
      else toast.success("Modificación enviada a gestoría");
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const setAltaField = <K extends keyof AltaInput>(k: K, v: AltaInput[K]) =>
    setAlta((p) => ({ ...p, [k]: v }));
  const setBajaField = <K extends keyof BajaInput>(k: K, v: BajaInput[K]) =>
    setBaja((p) => ({ ...p, [k]: v }));
  const setModiField = <K extends keyof ModificacionInput>(k: K, v: ModificacionInput[K]) =>
    setModi((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">NUEVA {TIPO_LABEL[tipo]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>TIPO</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoContratacion)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta de empleado</SelectItem>
                <SelectItem value="baja">Baja de empleado</SelectItem>
                <SelectItem value="modificacion">Modificación de contrato</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === "alta" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>NOMBRE *</Label>
                <Input value={alta.nombre} onChange={(e) => setAltaField("nombre", e.target.value)} />
              </div>
              <div>
                <Label>APELLIDOS</Label>
                <Input value={alta.apellidos ?? ""} onChange={(e) => setAltaField("apellidos", e.target.value)} />
              </div>
              <div>
                <Label>DNI / NIE</Label>
                <Input value={alta.dni ?? ""} onChange={(e) => setAltaField("dni", e.target.value)} />
              </div>
              <div>
                <Label>SEGURIDAD SOCIAL</Label>
                <Input value={alta.numero_ss ?? ""} onChange={(e) => setAltaField("numero_ss", e.target.value)} />
              </div>
              <div>
                <Label>DÍA COMIENZO *</Label>
                <Input
                  type="date"
                  value={alta.fecha_comienzo}
                  onChange={(e) => setAltaField("fecha_comienzo", e.target.value)}
                />
              </div>
              <div>
                <Label>NÓMINA</Label>
                <Input value={alta.nomina ?? ""} onChange={(e) => setAltaField("nomina", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>PUESTO *</Label>
                <PuestoSelector
                  puestos={puestos}
                  value={puestoSelect}
                  libre={puestoLibre}
                  onChange={setPuestoSelect}
                  onLibreChange={setPuestoLibre}
                />
              </div>
              <div className="col-span-2">
                <Label>JORNADA (HORAS / SEMANA) *</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={!jornadaCustom && alta.jornada_horas === 20 ? "default" : "outline"}
                    onClick={() => { setJornadaCustom(false); setAltaField("jornada_horas", 20); }}
                  >
                    20 h
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!jornadaCustom && alta.jornada_horas === 40 ? "default" : "outline"}
                    onClick={() => { setJornadaCustom(false); setAltaField("jornada_horas", 40); }}
                  >
                    40 h
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={jornadaCustom ? "default" : "outline"}
                    onClick={() => setJornadaCustom(true)}
                  >
                    Otra…
                  </Button>
                  {jornadaCustom && (
                    <Select
                      value={String(alta.jornada_horas)}
                      onValueChange={(v) => setAltaField("jornada_horas", Number(v))}
                    >
                      <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {Array.from({ length: 40 }, (_, i) => i + 1).map((h) => (
                          <SelectItem key={h} value={String(h)}>{h} h</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">Actual: {alta.jornada_horas} h/semana</span>
                </div>
              </div>
              <div className="col-span-2">
                <Label>HORARIO SEMANAL</Label>
                <div className="space-y-2 mt-1.5 border rounded-md p-3 bg-muted/20">
                  {DIAS_SEMANA.map((d) => {
                    const key = `horario_${d.key}` as keyof AltaInput;
                    return (
                      <div key={d.key} className="flex items-center gap-3">
                        <span className="text-xs font-medium w-24 uppercase text-muted-foreground">{d.label}</span>
                        <Input
                          className="h-8 text-sm"
                          placeholder='Ej: "Libre" o "18:00 a 02:30"'
                          value={(alta[key] as string | undefined) ?? ""}
                          onChange={(e) => setAltaField(key, e.target.value as AltaInput[typeof key])}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tipo === "baja" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>EMPLEADO *</Label>
                <EmpleadoSelector
                  empleados={empleados}
                  loading={empleadosLoading}
                  value={baja.empleado_id}
                  onChange={(v) => setBajaField("empleado_id", v)}
                />
              </div>
              <div>
                <Label>DÍA FINALIZACIÓN *</Label>
                <Input
                  type="date"
                  value={baja.fecha_finalizacion}
                  onChange={(e) => setBajaField("fecha_finalizacion", e.target.value)}
                />
              </div>
              <div>
                <Label>MOTIVO *</Label>
                <Select value={baja.motivo} onValueChange={(v) => setBajaField("motivo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_BAJA.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {baja.motivo === "Otro" && (
                <div className="col-span-2">
                  <Label>MOTIVO (DETALLE) *</Label>
                  <Input
                    value={baja.motivo_otro ?? ""}
                    onChange={(e) => setBajaField("motivo_otro", e.target.value)}
                    placeholder="Indica el motivo"
                  />
                </div>
              )}
              <div>
                <Label>LIQUIDAR VACACIONES</Label>
                <Select
                  value={baja.liquidar_vacaciones ? "si" : "no"}
                  onValueChange={(v) =>
                    setBaja((p) => ({
                      ...p,
                      liquidar_vacaciones: v === "si",
                      dias_vacaciones: v === "si" ? p.dias_vacaciones : undefined,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="si">Sí</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {baja.liquidar_vacaciones && (
                <div>
                  <Label>DÍAS VACACIONES</Label>
                  <Input
                    type="number"
                    min={0}
                    value={baja.dias_vacaciones ?? ""}
                    onChange={(e) =>
                      setBajaField("dias_vacaciones", e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </div>
              )}
              <div>
                <Label>DESCONTAR PREAVISO</Label>
                <Select
                  value={baja.descontar_preaviso ? "si" : "no"}
                  onValueChange={(v) =>
                    setBaja((p) => ({
                      ...p,
                      descontar_preaviso: v === "si",
                      dias_preaviso: v === "si" ? p.dias_preaviso : undefined,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="si">Sí</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {baja.descontar_preaviso && (
                <div>
                  <Label>DÍAS PREAVISO</Label>
                  <Input
                    type="number"
                    min={0}
                    value={baja.dias_preaviso ?? ""}
                    onChange={(e) =>
                      setBajaField("dias_preaviso", e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </div>
              )}
            </div>
          )}

          {tipo === "modificacion" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>EMPLEADO *</Label>
                <EmpleadoSelector
                  empleados={empleados}
                  loading={empleadosLoading}
                  value={modi.empleado_id}
                  onChange={(v) => setModiField("empleado_id", v)}
                />
              </div>
              <div>
                <Label>FECHA DEL CAMBIO *</Label>
                <Input
                  type="date"
                  value={modi.fecha_cambio}
                  onChange={(e) => setModiField("fecha_cambio", e.target.value)}
                />
              </div>
              <div>
                <Label>TIPO DE MODIFICACIÓN *</Label>
                <Select
                  value={modi.modificacion_tipo}
                  onValueChange={(v) => setModiField("modificacion_tipo", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_MODIFICACION.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {modi.modificacion_tipo === "Puesto" && (
                <div className="col-span-2">
                  <Label>NUEVO PUESTO *</Label>
                  <PuestoSelector
                    puestos={puestos}
                    value={modiPuestoSelect}
                    libre={modiPuestoLibre}
                    onChange={setModiPuestoSelect}
                    onLibreChange={setModiPuestoLibre}
                  />
                </div>
              )}
              <div className="col-span-2">
                <Label>DETALLE DEL CAMBIO {modi.modificacion_tipo !== "Puesto" && "*"}</Label>
                <Textarea
                  rows={3}
                  value={modi.modificacion_detalle}
                  onChange={(e) => setModiField("modificacion_detalle", e.target.value)}
                  placeholder='Ej: "30h → 40h", "1.500€ → 1.700€", anotaciones complementarias…'
                />
              </div>
            </div>
          )}

          <div className="border-t pt-3">
            <Label>EMAIL ADICIONAL (OTRO DEPARTAMENTO)</Label>
            <Input
              type="email"
              placeholder="opcional@empresa.com"
              value={empresaCorreoExtra}
              onChange={(e) => setEmpresaCorreoExtra(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Si lo rellenas, también se enviará una copia a este correo. El email principal de gestoría se configura desde el icono de Ajustes.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>CANCELAR</Button>
          <Button
            onClick={handleSave}
            disabled={
              submitting ||
              (tipo === "alta" && !altaValid) ||
              (tipo === "baja" && !bajaValid) ||
              (tipo === "modificacion" && !modiValid)
            }
          >
            {submitting ? "ENVIANDO…" : "ENVIAR A GESTORÍA"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function emptyAlta(todayISO: string): AltaInput {
  return {
    nombre: "",
    apellidos: "",
    dni: "",
    numero_ss: "",
    fecha_comienzo: todayISO,
    nomina: "Según convenio",
    puesto: "",
    jornada_horas: 40,
    horario_lunes: "",
    horario_martes: "",
    horario_miercoles: "",
    horario_jueves: "",
    horario_viernes: "",
    horario_sabado: "",
    horario_domingo: "",
  };
}

function emptyBaja(todayISO: string): BajaInput {
  return {
    empleado_id: "",
    fecha_finalizacion: todayISO,
    motivo: MOTIVOS_BAJA[0],
    motivo_otro: "",
    liquidar_vacaciones: false,
    dias_vacaciones: undefined,
    descontar_preaviso: false,
    dias_preaviso: undefined,
  };
}

function emptyModi(todayISO: string): ModificacionInput {
  return {
    empleado_id: "",
    fecha_cambio: todayISO,
    modificacion_tipo: "",
    modificacion_detalle: "",
    nuevo_puesto: "",
  };
}

function PuestoSelector({
  puestos,
  value,
  libre,
  onChange,
  onLibreChange,
}: {
  puestos: string[];
  value: string;
  libre: string;
  onChange: (v: string) => void;
  onLibreChange: (v: string) => void;
}) {
  return (
    <>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={puestos.length === 0 ? "Sin puestos guardados — escribe uno" : "Selecciona un puesto"} />
        </SelectTrigger>
        <SelectContent>
          {puestos.map((p) => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
          <SelectItem value={PUESTO_OTRO_VALUE}>Otro (escribir manualmente)</SelectItem>
        </SelectContent>
      </Select>
      {value === PUESTO_OTRO_VALUE && (
        <Input
          className="mt-2"
          placeholder="Escribe el puesto"
          value={libre}
          onChange={(e) => onLibreChange(e.target.value)}
        />
      )}
    </>
  );
}

function EmpleadoSelector({
  empleados,
  loading,
  value,
  onChange,
}: {
  empleados: EmpleadoActivo[];
  loading: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={loading}>
      <SelectTrigger>
        <SelectValue placeholder={loading ? "Cargando…" : "Selecciona un empleado"} />
      </SelectTrigger>
      <SelectContent>
        {empleados.length === 0 ? (
          <SelectItem value="__none__" disabled>
            Sin empleados activos
          </SelectItem>
        ) : (
          empleados.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.nombre} {e.apellidos ?? ""} {e.puesto ? `· ${e.puesto}` : ""}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
