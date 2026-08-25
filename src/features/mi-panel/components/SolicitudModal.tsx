"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Loader2,
  ChevronLeft,
  AlertTriangle,
  Palmtree,
  CalendarOff,
  Paperclip,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  crearSolicitudPersonal,
  crearBajaMedicaConParte,
  getMiVacacionesInfo,
  getReglasPermiso,
  getMiBajaContratoEnCurso,
  getTiposAusenciaDisponibles,
  type MiVacacionesInfo,
  type TipoAusenciaDisponible,
} from "@/features/mi-panel/actions/mi-panel-actions";
import { bloqueoSolapaRango } from "@/features/rrhh/data/calendarios-vacaciones";
import { DesgloseVacaciones } from "@/features/rrhh/components/calendarios/DesgloseVacaciones";
import type {
  SolicitudSubtipo,
  SolicitudSubtipoAusencia,
  SolicitudSubtipoTrabajo,
  SolicitudTipo,
} from "@/features/mi-panel/types";
import { HORAS_EXTRAS_MOTIVO_MIN } from "@/features/mi-panel/types";
import { listTiposMaterialParaSolicitar } from "@/features/rrhh/actions/entregas-tipos-actions";
import { TALLAS_ROPA, type TipoMaterial } from "@/features/rrhh/data/entregas";
import { DiaTrabajadoAvisoDialog } from "@/features/mi-panel/components/DiaTrabajadoAvisoDialog";
import { MAX_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES } from "@/shared/lib/documentos";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SOLICITUD_HORAS_AVISO,
  SOLICITUD_HORAS_OPCIONES,
  minutosTramo,
  validarTramo,
} from "@/features/mi-panel/lib/solicitud-horas";
import {
  proximaFechaValida,
  resumenReglasVacaciones,
  validarRangoVacaciones,
  TEXTOS_PERMISO,
  type VacacionesReglas,
} from "@/features/mi-panel/lib/vacaciones-reglas";

interface SolicitudModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  /** Se llama al elegir "Queja o denuncia": abre el formulario del canal. */
  onElegirDenuncia?: () => void;
}

type Paso = "tipo" | "subtipo" | "detalle";

// Ventana de preaviso de la baja de contrato (días naturales). El mínimo se
// anuncia; el máximo NO se menciona por adelantado y solo salta como aviso si
// el empleado elige una fecha demasiado lejana.
const BAJA_CONTRATO_PREAVISO_MIN = 15;
const BAJA_CONTRATO_PREAVISO_MAX = 45;
// Vacaciones y permiso se piden con antelación para poder cuadrar el turno.
// La baja médica no: es imprevisible y se comunica en el momento.
const PREAVISO_MIN_DIAS = 30;

// Parte de baja médica: hasta 3 fotos o PDFs, 50 MB cada uno (tope de documentos).
const PARTE_BAJA_MAX = 3;
const PARTE_BAJA_MAX_BYTES = MAX_DOCUMENTO_BYTES;
const PARTE_BAJA_ACCEPT = "image/*,application/pdf";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addDaysISO(base: string, days: number): string {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function diasNaturales(desde: string, hasta: string): number {
  const a = new Date(desde + "T00:00:00Z");
  const b = new Date(hasta + "T00:00:00Z");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function formatFechaEs(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Para bloqueos recurrentes (calendario predeterminado) solo importan día y mes.
function fechaBloqueoLabel(iso: string, recurrente: boolean): string {
  const [y, m, d] = iso.split("-");
  return recurrente ? `${d}/${m}` : `${d}/${m}/${y}`;
}

export function SolicitudModal({ open, onOpenChange, onCreated, onElegirDenuncia }: SolicitudModalProps) {
  const [paso, setPaso] = useState<Paso>("tipo");
  const [tipo, setTipo] = useState<SolicitudTipo | null>(null);
  const [subtipo, setSubtipo] = useState<SolicitudSubtipo | null>(null);

  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFin, setFechaFin] = useState<string>("");
  const [horas, setHoras] = useState<string>("");
  // Tramo (entrada–salida) para solicitudes de trabajo: se materializa en el
  // fichaje al aprobar. Aplica a dia_trabajado y horas_extras.
  const [horaInicio, setHoraInicio] = useState<string>("");
  const [horaFin, setHoraFin] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");

  // Parte de baja médica (fotos/PDF). Solo se usa cuando subtipo === baja_medica.
  const [partes, setPartes] = useState<File[]>([]);

  // Pedir uniforme o material: catálogo de la empresa y qué elige el trabajador.
  // null mientras se carga (para distinguir "cargando" de "no hay ninguno").
  const [tiposMaterial, setTiposMaterial] = useState<TipoMaterial[] | null>(null);
  const [materialTipoId, setMaterialTipoId] = useState<string>("");
  const [materialTalla, setMaterialTalla] = useState<string>("");

  const [avisoOpen, setAvisoOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Baja de contrato: si ya hay una en curso, se bloquea el paso de detalle y
  // se avisa de que no es modificable. Se comprueba al elegir el subtipo.
  const [bajaEnCurso, setBajaEnCurso] = useState<{
    fechaFin: string | null;
    estado: string | null;
  } | null>(null);
  const [bajaComprobando, setBajaComprobando] = useState(false);
  // Confirmación de irreversibilidad antes de enviar la baja.
  const [confirmBajaOpen, setConfirmBajaOpen] = useState(false);

  // Info de vacaciones del empleado (saldo + periodos bloqueados). Se carga al
  // entrar en el detalle de una solicitud de vacaciones.
  const [vacInfo, setVacInfo] = useState<MiVacacionesInfo | null>(null);
  const [vacCargando, setVacCargando] = useState(false);

  // Reglas de permiso de la empresa (mín/máx de días por solicitud). Se cargan
  // al entrar en el detalle de un permiso; null mientras no se sepan.
  const [permisoReglas, setPermisoReglas] = useState<VacacionesReglas | null>(null);

  useEffect(() => {
    if (paso !== "detalle" || subtipo !== "vacaciones") return;
    let activo = true;
    setVacCargando(true);
    getMiVacacionesInfo().then((res) => {
      if (!activo) return;
      setVacInfo(res.ok ? res.data : null);
      setVacCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [paso, subtipo]);

  useEffect(() => {
    if (paso !== "detalle" || subtipo !== "permiso") return;
    let activo = true;
    getReglasPermiso().then((res) => {
      if (activo) setPermisoReglas(res.data);
    });
    return () => {
      activo = false;
    };
  }, [paso, subtipo]);

  // Tipos de ausencia ACTIVOS en la empresa (configuración de RRHH). La lista es
  // cerrada, pero cada empresa decide cuáles habilita y con qué nombre; antes
  // estaba cableada aquí y desactivar un tipo no lo quitaba de ningún sitio.
  const [tiposAusencia, setTiposAusencia] = useState<TipoAusenciaDisponible[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let activo = true;
    getTiposAusenciaDisponibles().then((res) => {
      if (!activo) return;
      setTiposAusencia(res.ok ? res.data : []);
    });
    return () => {
      activo = false;
    };
  }, [open]);

  // Catálogo de uniforme y material. Se carga al elegir «Entregas», no al abrir
  // el modal: la mayoría de solicitudes no lo necesitan.
  useEffect(() => {
    if (tipo !== "entrega") return;
    let activo = true;
    listTiposMaterialParaSolicitar().then((data) => {
      if (activo) setTiposMaterial(data);
    });
    return () => {
      activo = false;
    };
  }, [tipo]);

  // Guarda contra el "ghost click" táctil de iOS: al cambiar de paso el
  // contenido se re-renderiza y el click sintético que el navegador dispara
  // ~300 ms después caía sobre el nuevo elemento (o sobre el overlay, cerrando
  // el modal). Durante este bloqueo deshabilitamos los punteros y evitamos el
  // cierre por interacción externa.
  const [navLock, setNavLock] = useState(false);
  const navLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function lockNav() {
    setNavLock(true);
    if (navLockTimer.current) clearTimeout(navLockTimer.current);
    navLockTimer.current = setTimeout(() => setNavLock(false), 400);
  }

  function reset() {
    setPaso("tipo");
    setTipo(null);
    setSubtipo(null);
    setFechaInicio("");
    setFechaFin("");
    setHoras("");
    setHoraInicio("");
    setHoraFin("");
    setMotivo("");
    setPartes([]);
    setAvisoOpen(false);
    setEnviando(false);
    setNavLock(false);
    setVacInfo(null);
    setVacCargando(false);
    setBajaEnCurso(null);
    setBajaComprobando(false);
    setConfirmBajaOpen(false);
    setMaterialTipoId("");
    setMaterialTalla("");
    if (navLockTimer.current) clearTimeout(navLockTimer.current);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function elegirTipo(t: SolicitudTipo) {
    lockNav();
    setTipo(t);
    setSubtipo(null);
    // Entregas tiene un único subtipo, así que se salta el paso de elegirlo:
    // se va directo a decir qué prenda quiere.
    if (t === "entrega") {
      setSubtipo("entrega_material");
      setPaso("detalle");
      return;
    }
    setPaso("subtipo");
  }

  function elegirSubtipo(s: SolicitudSubtipo) {
    lockNav();
    if (s === "dia_trabajado") {
      setSubtipo(s);
      setAvisoOpen(true);
      return;
    }
    if (s === "baja_contrato") {
      // Antes de dejar continuar comprobamos que no haya ya una baja en curso:
      // es irreversible y no modificable, no puede crear una segunda.
      setSubtipo(s);
      setBajaEnCurso(null);
      setBajaComprobando(true);
      setPaso("detalle");
      getMiBajaContratoEnCurso().then((res) => {
        setBajaComprobando(false);
        if (res.ok && res.enCurso) {
          setBajaEnCurso({
            fechaFin: res.fechaFin ?? null,
            estado: res.estado ?? null,
          });
        }
      });
      return;
    }
    setSubtipo(s);
    setPaso("detalle");
  }

  function aceptarAvisoDia() {
    lockNav();
    setAvisoOpen(false);
    setPaso("detalle");
  }
  function cancelarAvisoDia() {
    setAvisoOpen(false);
    setSubtipo(null);
  }

  function anadirPartes(files: FileList | null) {
    if (!files || files.length === 0) return;
    const nuevos: File[] = [];
    for (const f of Array.from(files)) {
      if (f.size > PARTE_BAJA_MAX_BYTES) {
        toast.error(`"${f.name}" supera los ${MAX_DOCUMENTO_MB} MB.`);
        continue;
      }
      nuevos.push(f);
    }
    setPartes((prev) => {
      const total = [...prev, ...nuevos];
      if (total.length > PARTE_BAJA_MAX) {
        toast.error(`Máximo ${PARTE_BAJA_MAX} ficheros.`);
        return total.slice(0, PARTE_BAJA_MAX);
      }
      return total;
    });
  }

  function quitarParte(idx: number) {
    setPartes((prev) => prev.filter((_, i) => i !== idx));
  }

  async function enviar() {
    if (!tipo || !subtipo) return;
    if (subtipo === "baja_contrato") {
      if (!fechaFin) {
        toast.error("Indica el día que quieres que se haga efectiva tu baja");
        return;
      }
    } else if (subtipo === "entrega_material") {
      // Pedir material no tiene fechas: lo que hace falta es saber QUÉ pide.
      const elegido = (tiposMaterial ?? []).find((t) => t.id === materialTipoId);
      if (!elegido) {
        toast.error("Elige qué necesitas");
        return;
      }
      if (elegido.requiereTalla && !materialTalla) {
        toast.error("Elige tu talla");
        return;
      }
    } else if (!fechaInicio) {
      toast.error("Indica una fecha de inicio");
      return;
    }

    // Reglas de vacaciones de la empresa (día de inicio, mín/máx de días).
    if (subtipo === "vacaciones" && errorReglasVac) {
      toast.error(errorReglasVac);
      return;
    }

    // Reglas de permiso de la empresa (mín/máx de días por solicitud).
    if (subtipo === "permiso" && errorReglasPermiso) {
      toast.error(errorReglasPermiso);
      return;
    }

    // Baja médica: ruta propia con FormData (permite adjuntar hasta 3 partes).
    if (subtipo === "baja_medica") {
      setEnviando(true);
      const fd = new FormData();
      fd.set("fechaInicio", fechaInicio);
      if (fechaFin) fd.set("fechaFin", fechaFin);
      fd.set("motivo", motivo.trim());
      for (const f of partes) fd.append("partes", f);
      const res = await crearBajaMedicaConParte(fd);
      setEnviando(false);
      if (!res.ok) {
        toast.error(res.error || "No se pudo enviar la solicitud");
        return;
      }
      if (res.avisoParte) toast.warning(res.avisoParte, { duration: 7000 });
      toast.success(
        partes.length > 0
          ? "Baja médica enviada con el parte. Avisamos a la gestoría."
          : "Baja médica enviada. Avisamos a la gestoría.",
      );
      onCreated?.();
      handleClose(false);
      return;
    }
    // Trabajo (día trabajado / horas extras): exige el tramo entrada–salida.
    let horasTramo: number | null = null;
    if (subtipo === "horas_extras" || subtipo === "dia_trabajado") {
      if (!horaInicio || !horaFin) {
        toast.error("Indica la hora de entrada y de salida");
        return;
      }
      const errorTramo = validarTramo(horaInicio, horaFin);
      if (errorTramo) {
        toast.error(errorTramo);
        return;
      }
      horasTramo = Math.round((minutosTramo(horaInicio, horaFin) / 60) * 100) / 100;
    }
    // Horas extras: sin explicación no se envía; quien aprueba necesita el porqué.
    if (subtipo === "horas_extras" && motivo.trim().length < HORAS_EXTRAS_MOTIVO_MIN) {
      toast.error(
        `Explica por qué hiciste las horas extras (mínimo ${HORAS_EXTRAS_MOTIVO_MIN} caracteres)`,
      );
      return;
    }
    setEnviando(true);
    const materialElegido = (tiposMaterial ?? []).find((t) => t.id === materialTipoId);
    const res = await crearSolicitudPersonal({
      tipo,
      subtipo,
      // baja_contrato y entrega_material no tienen fecha propia: se registran hoy.
      fechaInicio:
        subtipo === "baja_contrato" || subtipo === "entrega_material"
          ? todayISO()
          : fechaInicio,
      fechaFin: fechaFin || null,
      horas: horasTramo,
      horaInicio: horasTramo != null ? horaInicio : null,
      horaFin: horasTramo != null ? horaFin : null,
      motivo: motivo.trim(),
      entregaTipoId: materialElegido?.id ?? null,
      entregaTipoNombre: materialElegido?.nombre ?? null,
      entregaTalla: materialTalla || null,
    });
    setEnviando(false);
    if (!res.ok) {
      toast.error(res.error || "No se pudo enviar la solicitud");
      return;
    }
    if (subtipo === "baja_contrato") {
      toast.success(
        "Solicitud enviada. Revisa tu email y firma la carta de baja en 1 hora; si no, el enlace caduca y no se confirma.",
        { duration: 8000 },
      );
    } else {
      toast.success("Solicitud enviada");
    }
    onCreated?.();
    handleClose(false);
  }

  // Etiquetas dinámicas
  const tipoLabel =
    tipo === "ausencia" ? "Ausencia" : tipo === "entrega" ? "Entregas" : "Trabajo realizado";
  const subtipoLabel: Record<SolicitudSubtipo, string> = {
    baja_medica: "Baja médica",
    vacaciones: "Vacaciones",
    permiso: "Permiso",
    baja_contrato: "Baja de contrato",
    horas_extras: "Horas extras",
    dia_trabajado: "Día trabajado",
    entrega_material: "Uniforme o material",
    // No se elige desde este modal (tiene el suyo), pero el tipo lo exige.
    denuncia: "Queja o denuncia",
  };

  // Sale de la configuración de RRHH (solo los ACTIVOS). Al nombre de cada tipo
  // le añadimos su plazo de aviso, que lo fija el sistema y no la configuración:
  // así el empleado sabe con cuánta antelación tiene que pedirlo antes de elegir.
  const PLAZO_POR_SUBTIPO: Partial<Record<SolicitudSubtipoAusencia, string>> = {
    vacaciones: `Preaviso mínimo de ${PREAVISO_MIN_DIAS} días`,
    permiso: `Preaviso mínimo de ${PREAVISO_MIN_DIAS} días`,
    baja_contrato: `Preaviso mínimo de ${BAJA_CONTRATO_PREAVISO_MIN} días`,
    baja_medica: "Instantánea",
  };

  const opcionesAusencia: { value: SolicitudSubtipoAusencia; label: string; desc: string }[] =
    (tiposAusencia ?? []).map((t) => ({
      value: t.subtipo,
      label: t.nombre,
      desc: PLAZO_POR_SUBTIPO[t.subtipo] ?? t.descripcion ?? "",
    }));

  const opcionesTrabajo: { value: SolicitudSubtipoTrabajo; label: string; desc: string }[] = [
    { value: "horas_extras", label: "Horas extras", desc: "Horas trabajadas fuera de tu jornada habitual" },
    { value: "dia_trabajado", label: "Día trabajado", desc: "Día de trabajo no fichado (excepcional)" },
  ];

  // Reglas de la empresa para vacaciones (día de inicio y mín/máx de días).
  // Solo se comprueba con fecha elegida: en blanco no se le riñe por nada.
  const errorReglasVac = (() => {
    if (subtipo !== "vacaciones" || !vacInfo || !fechaInicio) return null;
    const res = validarRangoVacaciones(vacInfo.reglas, fechaInicio, fechaFin || null);
    return res.ok ? null : res.error;
  })();

  // Reglas de la empresa para permisos (mín/máx de días por solicitud).
  // Solo se comprueba con fecha elegida: en blanco no se le riñe por nada.
  const errorReglasPermiso = (() => {
    if (subtipo !== "permiso" || !permisoReglas || !fechaInicio) return null;
    const res = validarRangoVacaciones(
      permisoReglas,
      fechaInicio,
      fechaFin || null,
      TEXTOS_PERMISO,
    );
    return res.ok ? null : res.error;
  })();

  // Resumen de las reglas de permiso, para enseñárselas antes de que se lleve
  // un error. null si la empresa no exige nada.
  const resumenReglasPermiso =
    subtipo === "permiso" && permisoReglas
      ? resumenReglasVacaciones(permisoReglas, TEXTOS_PERMISO)
      : null;

  // Bloqueo de envío en cliente para vacaciones: sin calendario, fechas en un
  // periodo bloqueado, más días de los que quedan, o incumplir las reglas de la
  // empresa. El servidor revalida igual.
  const vacEnvioBloqueado = (() => {
    if (subtipo !== "vacaciones" || !vacInfo) return false;
    if (!vacInfo.tieneCalendario) return true;
    if (errorReglasVac) return true;
    const inicio = fechaInicio;
    if (!inicio) return false;
    const fin = fechaFin || fechaInicio;
    const diasSel =
      fin >= inicio
        ? Math.floor(
            (Date.parse(fin + "T00:00:00Z") - Date.parse(inicio + "T00:00:00Z")) / 86400000,
          ) + 1
        : 0;
    const choque = vacInfo.bloqueos.some((b) =>
      bloqueoSolapaRango(b, inicio, fin, vacInfo.esPredeterminado),
    );
    const excede = diasSel > 0 && diasSel > vacInfo.diasRestantes;
    return choque || excede;
  })();

  // Horas extras: el motivo es obligatorio y con un mínimo de caracteres, para
  // que quien las aprueba sepa por qué se hicieron. El servidor revalida igual.
  const motivoCorto =
    subtipo === "horas_extras" && motivo.trim().length < HORAS_EXTRAS_MOTIVO_MIN;

  // Tramo inválido (mismo inicio y fin, o menos de media hora). Solo se
  // comprueba con las dos horas elegidas: a medio rellenar no se avisa de nada.
  const errorTramo =
    (subtipo === "horas_extras" || subtipo === "dia_trabajado") &&
    horaInicio &&
    horaFin
      ? validarTramo(horaInicio, horaFin)
      : null;

  // Preaviso de vacaciones y permiso: hay que pedirlos con antelación para que
  // se pueda cuadrar el turno. Se mide en días naturales desde hoy hasta el
  // primer día solicitado. El servidor revalida igual.
  const diasPreaviso =
    fechaInicio ? diasNaturales(todayISO(), fechaInicio) : null;
  const preavisoInsuficiente =
    (subtipo === "vacaciones" || subtipo === "permiso") &&
    diasPreaviso !== null &&
    diasPreaviso < PREAVISO_MIN_DIAS;

  // Bloqueo de envío en cliente para baja de contrato: exige que exista la
  // fecha efectiva y que caiga dentro de la ventana de preaviso legal.
  // El servidor revalida igual.
  const bajaEnvioBloqueado = (() => {
    if (subtipo !== "baja_contrato") return false;
    // Ya hay una baja en curso o aún estamos comprobándolo: no se puede enviar.
    if (bajaEnCurso || bajaComprobando) return true;
    if (!fechaFin) return true;
    const dias = diasNaturales(todayISO(), fechaFin);
    return dias < BAJA_CONTRATO_PREAVISO_MIN || dias > BAJA_CONTRATO_PREAVISO_MAX;
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className={cn("sm:max-w-lg", navLock && "[&_*]:pointer-events-none")}
          onPointerDownOutside={(e) => {
            if (navLock) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (navLock) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paso !== "tipo" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    lockNav();
                    if (paso === "detalle") {
                      setPaso("subtipo");
                    } else if (paso === "subtipo") {
                      setPaso("tipo");
                      setTipo(null);
                    }
                  }}
                  aria-label="Volver"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              Nueva solicitud
            </DialogTitle>
            <DialogDescription>
              {paso === "tipo" && "¿Qué tipo de solicitud quieres enviar?"}
              {paso === "subtipo" && tipo === "ausencia" && "Selecciona el tipo de ausencia."}
              {paso === "subtipo" && tipo === "trabajo" && "Selecciona qué quieres registrar."}
              {paso === "detalle" && tipo && subtipo && (
                <>
                  {tipoLabel} · <span className="font-medium text-foreground">{subtipoLabel[subtipo]}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* PASO 1: TIPO */}
          {paso === "tipo" && (
            <div className="grid gap-3 py-2">
              <button
                type="button"
                onClick={() => elegirTipo("ausencia")}
                className="text-left p-4 rounded-lg border transition-colors hover:border-primary hover:bg-primary/5 active:border-blue-600 active:bg-blue-50 active:text-blue-700"
              >
                <div className="font-semibold">Ausencia</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Baja médica, vacaciones, permiso o baja de contrato.
                </div>
              </button>
              <button
                type="button"
                onClick={() => elegirTipo("trabajo")}
                className="text-left p-4 rounded-lg border transition-colors hover:border-primary hover:bg-primary/5 active:border-blue-600 active:bg-blue-50 active:text-blue-700"
              >
                <div className="font-semibold">Trabajo realizado</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Registrar horas extras o un día trabajado no fichado.
                </div>
              </button>
              <button
                type="button"
                onClick={() => elegirTipo("entrega")}
                className="text-left p-4 rounded-lg border transition-colors hover:border-primary hover:bg-primary/5 active:border-blue-600 active:bg-blue-50 active:text-blue-700"
              >
                <div className="font-semibold">Entregas</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Pedir una prenda del uniforme o material de trabajo.
                </div>
              </button>
              {/* La denuncia es un tipo más de solicitud, pero sus datos van a
                  una tabla aparte con acceso restringido a RRHH: en
                  `solicitudes_personal` la leería toda la plantilla. */}
              <button
                type="button"
                onClick={() => { handleClose(false); onElegirDenuncia?.(); }}
                className="text-left p-4 rounded-lg border transition-colors hover:border-primary hover:bg-primary/5 active:border-blue-600 active:bg-blue-50 active:text-blue-700"
              >
                <div className="font-semibold">Queja o denuncia</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Acoso, discriminación, seguridad o cualquier otra queja. Es el
                  único canal válido y lo revisa Recursos Humanos.
                </div>
              </button>
            </div>
          )}

          {/* PASO 2: SUBTIPO */}
          {paso === "subtipo" && tipo === "ausencia" && tiposAusencia === null && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          )}
          {paso === "subtipo" && tipo === "ausencia" && tiposAusencia !== null && opcionesAusencia.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Tu empresa no tiene ningún tipo de ausencia disponible. Habla con RRHH.
            </div>
          )}
          {paso === "subtipo" && tipo === "ausencia" && (
            <div className="grid gap-2 py-2">
              {opcionesAusencia.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => elegirSubtipo(o.value)}
                  className="text-left p-3 rounded-lg border transition-colors hover:border-primary hover:bg-primary/5 active:border-blue-600 active:bg-blue-50 active:text-blue-700"
                >
                  <div className="font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          )}
          {paso === "subtipo" && tipo === "trabajo" && (
            <div className="grid gap-2 py-2">
              {opcionesTrabajo.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => elegirSubtipo(o.value)}
                  className="text-left p-3 rounded-lg border transition-colors hover:border-primary hover:bg-primary/5 active:border-blue-600 active:bg-blue-50 active:text-blue-700"
                >
                  <div className="font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* PASO 3: DETALLE */}
          {paso === "detalle" && subtipo && subtipo === "baja_contrato" && (() => {
            const hoy = todayISO();
            const minBaja = addDaysISO(hoy, BAJA_CONTRATO_PREAVISO_MIN);
            const maxBaja = addDaysISO(hoy, BAJA_CONTRATO_PREAVISO_MAX);
            const dias = fechaFin ? diasNaturales(hoy, fechaFin) : 0;
            // El mínimo se anuncia de antemano; el máximo solo se dice si lo pasa.
            const preavisoCorto = !!fechaFin && dias < BAJA_CONTRATO_PREAVISO_MIN;
            const preavisoLargo = !!fechaFin && dias > BAJA_CONTRATO_PREAVISO_MAX;
            const fueraDeRango = preavisoCorto || preavisoLargo;

            // Mientras comprobamos si ya hay una baja en curso.
            if (bajaComprobando) {
              return (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Comprobando…
                </div>
              );
            }

            // Ya hay una baja en curso: irreversible y no modificable.
            if (bajaEnCurso) {
              return (
                <div className="grid gap-4 py-2">
                  <div className="flex gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-900">
                    <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                    <div className="space-y-1 text-sm leading-relaxed">
                      <p className="font-semibold">
                        Ya has solicitado tu baja de contrato.
                      </p>
                      <p>
                        Una baja de contrato es irreversible y no se puede
                        modificar ni volver a solicitar.
                        {bajaEnCurso.fechaFin
                          ? ` Tu último día efectivo es el ${formatFechaEs(
                              bajaEnCurso.fechaFin,
                            )}.`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="grid gap-4 py-2">
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="text-xs leading-relaxed">
                    Al enviar esta solicitud arrancas hoy ({formatFechaEs(hoy)}) tu
                    periodo de preaviso, que debe ser de al menos{" "}
                    {BAJA_CONTRATO_PREAVISO_MIN} días naturales. Es{" "}
                    <strong>irreversible</strong>: recibirás al momento
                    un email con la carta de baja. La baja{" "}
                    <strong>no se confirma</strong> hasta que la firmes, y el enlace
                    de firma solo vale <strong>1 hora</strong>.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fechaBaja">
                    ¿Qué día quieres que sea efectiva tu baja?
                  </Label>
                  <Input
                    id="fechaBaja"
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    min={minBaja}
                  />
                  <p className="text-xs text-muted-foreground">
                    Primer día disponible: {formatFechaEs(minBaja)} (preaviso mínimo
                    de {BAJA_CONTRATO_PREAVISO_MIN} días naturales).
                  </p>
                  {fechaFin && !fueraDeRango && (
                    <p className="text-xs font-medium text-emerald-700">
                      Preaviso: {dias} días naturales.
                    </p>
                  )}
                  {preavisoCorto && (
                    <p className="text-xs font-medium text-rose-600">
                      El preaviso mínimo es de {BAJA_CONTRATO_PREAVISO_MIN} días
                      naturales.
                    </p>
                  )}
                  {/* El tope no se anuncia de antemano: solo aparece si lo pasa. */}
                  {preavisoLargo && (
                    <p className="text-xs font-medium text-rose-600 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        Has pedido {dias} días de preaviso y el máximo son{" "}
                        {BAJA_CONTRATO_PREAVISO_MAX} días naturales. Espera y solicita
                        tu baja como pronto el {formatFechaEs(
                          addDaysISO(fechaFin, -BAJA_CONTRATO_PREAVISO_MAX),
                        )}
                        , o elige una fecha no posterior al {formatFechaEs(maxBaja)}.
                      </span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="motivo">Motivo (opcional)</Label>
                  <Textarea
                    id="motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    placeholder="Si quieres, cuéntanos por qué te vas. Nos ayuda a mejorar."
                  />
                </div>
              </div>
            );
          })()}

          {/* PEDIR UNIFORME O MATERIAL. No lleva fechas: se pide una prenda, y
              es RRHH quien decide cuándo se la da al aprobarla. */}
          {paso === "detalle" && subtipo === "entrega_material" && (() => {
            const tipoElegido = (tiposMaterial ?? []).find((t) => t.id === materialTipoId);
            const uniformes = (tiposMaterial ?? []).filter((t) => t.categoria === "uniforme");
            const materiales = (tiposMaterial ?? []).filter((t) => t.categoria === "material");

            if (tiposMaterial === null) {
              return (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando…
                </div>
              );
            }
            if (tiposMaterial.length === 0) {
              return (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Tu empresa todavía no tiene uniforme ni material configurado.
                  Habla con RRHH.
                </div>
              );
            }

            return (
              <div className="grid gap-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="materialTipo">Qué necesitas</Label>
                  <Select
                    value={materialTipoId}
                    onValueChange={(v) => {
                      setMaterialTipoId(v);
                      setMaterialTalla("");
                    }}
                  >
                    <SelectTrigger id="materialTipo">
                      <SelectValue placeholder="Elige una prenda o material" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniformes.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Uniforme</SelectLabel>
                          {uniformes.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {materiales.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Material</SelectLabel>
                          {materiales.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {tipoElegido?.requiereTalla && (
                  <div className="space-y-1.5">
                    <Label htmlFor="materialTalla">Talla</Label>
                    <Select value={materialTalla} onValueChange={setMaterialTalla}>
                      <SelectTrigger id="materialTalla">
                        <SelectValue placeholder="Elige tu talla" />
                      </SelectTrigger>
                      <SelectContent>
                        {TALLAS_ROPA.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="motivoEntrega">Motivo (opcional)</Label>
                  <Textarea
                    id="motivoEntrega"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Por ejemplo: se me ha roto, o es mi primera semana."
                    rows={3}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Se pide una unidad. Si necesitas dos, envía dos solicitudes.
                </p>
              </div>
            );
          })()}

          {paso === "detalle" && subtipo && subtipo !== "baja_contrato" && subtipo !== "entrega_material" && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fechaInicio">
                    {subtipo === "horas_extras" || subtipo === "dia_trabajado"
                      ? "Fecha"
                      : "Desde"}
                  </Label>
                  <Input
                    id="fechaInicio"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => {
                      const desde = e.target.value;
                      setFechaInicio(desde);
                      // Si la empresa exige un mínimo de días, proponemos el
                      // "hasta" que lo cumple en vez de dejar que lo calcule él
                      // y se lleve un error al enviar. Solo si aún no ha tocado
                      // el "hasta": no le pisamos su elección.
                      const min =
                        subtipo === "vacaciones"
                          ? vacInfo?.reglas.diasMin ?? null
                          : subtipo === "permiso"
                            ? permisoReglas?.diasMin ?? null
                            : null;
                      if (desde && min && min > 1 && !fechaFin) {
                        setFechaFin(addDaysISO(desde, min - 1));
                      }
                    }}
                    min={
                      subtipo === "vacaciones" || subtipo === "permiso"
                        ? addDaysISO(todayISO(), PREAVISO_MIN_DIAS)
                        : undefined
                    }
                  />
                </div>
                {subtipo !== "horas_extras" && subtipo !== "dia_trabajado" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fechaFin">Hasta</Label>
                    <Input
                      id="fechaFin"
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      min={fechaInicio || undefined}
                    />
                  </div>
                )}
              </div>

              {preavisoInsuficiente && (
                <p className="text-xs font-medium text-rose-600">
                  Hay que pedirlo con {PREAVISO_MIN_DIAS} días de antelación como
                  mínimo. La fecha más cercana que puedes elegir es el{" "}
                  {formatFechaEs(addDaysISO(todayISO(), PREAVISO_MIN_DIAS))}.
                </p>
              )}

              {subtipo === "permiso" && permisoReglas && (
                errorReglasPermiso ? (
                  <p className="text-xs font-medium text-rose-600">{errorReglasPermiso}</p>
                ) : (
                  resumenReglasPermiso && (
                    <p className="text-xs text-muted-foreground">{resumenReglasPermiso}</p>
                  )
                )
              )}

              {/* Tramo (entrada–salida) para solicitudes de trabajo: al aprobar se
                  crea el fichaje con estas horas (dia_trabajado=normal, horas_extras=extra). */}
              {(subtipo === "horas_extras" || subtipo === "dia_trabajado") && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="horaInicio">Hora de entrada</Label>
                    <Select
                      value={horaInicio || undefined}
                      onValueChange={setHoraInicio}
                    >
                      <SelectTrigger id="horaInicio">
                        <SelectValue placeholder="Elige una hora" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {SOLICITUD_HORAS_OPCIONES.map((h) => (
                          <SelectItem key={h} value={h} className="tabular-nums">
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="horaFin">Hora de salida</Label>
                    <Select value={horaFin || undefined} onValueChange={setHoraFin}>
                      <SelectTrigger id="horaFin">
                        <SelectValue placeholder="Elige una hora" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {SOLICITUD_HORAS_OPCIONES.map((h) => (
                          <SelectItem key={h} value={h} className="tabular-nums">
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Regla fija: solo en punto o y media, por eso se elige de
                      una lista cerrada en vez de teclear la hora. */}
                  <p className="col-span-2 text-xs text-muted-foreground">
                    {SOLICITUD_HORAS_AVISO}
                  </p>
                  {errorTramo && (
                    <p className="col-span-2 text-xs font-medium text-rose-600 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {errorTramo}
                    </p>
                  )}
                  {horaInicio && horaFin && !errorTramo && (
                    <p className="col-span-2 text-xs text-muted-foreground">
                      Total: {(() => {
                        const min = minutosTramo(horaInicio, horaFin);
                        const h = Math.floor(min / 60);
                        const m = min % 60;
                        return m === 0 ? `${h}h` : `${h}h ${m}m`;
                      })()}
                    </p>
                  )}
                </div>
              )}

              {subtipo === "vacaciones" && (() => {
                if (vacCargando) {
                  return (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Comprobando tus días de vacaciones…
                    </p>
                  );
                }
                if (!vacInfo) return null;
                if (!vacInfo.tieneCalendario) {
                  return (
                    <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <p className="text-xs leading-relaxed">
                        Todavía no tienes un calendario de vacaciones asignado, así que
                        no puedes solicitar vacaciones. Habla con RRHH para que te asignen
                        uno.
                      </p>
                    </div>
                  );
                }
                const inicio = fechaInicio;
                const fin = fechaFin || fechaInicio;
                const diasSel =
                  inicio && fin >= inicio
                    ? Math.floor(
                        (new Date(fin + "T00:00:00Z").getTime() -
                          new Date(inicio + "T00:00:00Z").getTime()) /
                          86400000,
                      ) + 1
                    : 0;
                const choque = inicio
                  ? vacInfo.bloqueos.find((b) =>
                      bloqueoSolapaRango(b, inicio, fin, vacInfo.esPredeterminado),
                    )
                  : undefined;
                const excede = diasSel > 0 && diasSel > vacInfo.diasRestantes;
                // Las reglas se enseñan de entrada, no solo al equivocarse.
                const resumenReglas = resumenReglasVacaciones(vacInfo.reglas);
                const sugerida = inicio
                  ? proximaFechaValida(vacInfo.reglas, inicio)
                  : null;
                return (
                  <div className="space-y-2">
                    {resumenReglas && (
                      <p className="text-xs text-muted-foreground rounded-md border bg-muted/20 p-2.5 leading-relaxed">
                        {resumenReglas}
                      </p>
                    )}
                    {errorReglasVac && (
                      <p className="text-xs font-medium text-rose-600 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          {errorReglasVac}
                          {sugerida && sugerida !== inicio
                            ? ` El siguiente día válido es el ${formatFechaEs(sugerida)}.`
                            : ""}
                        </span>
                      </p>
                    )}
                    <DesgloseVacaciones
                      anio={vacInfo.anio}
                      esPredeterminado={vacInfo.esPredeterminado}
                      diasTotales={vacInfo.diasTotales}
                      diasDisfrutados={vacInfo.diasDisfrutados}
                      diasAprobadosPendientes={vacInfo.diasAprobadosPendientes}
                      diasPendientesAprobacion={vacInfo.diasPendientesAprobacion}
                      diasRestantes={vacInfo.diasRestantes}
                    />

                    {diasSel > 0 && !choque && !excede && (
                      <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                        <Palmtree className="h-3.5 w-3.5" />
                        Pides {diasSel} día{diasSel === 1 ? "" : "s"}. Te quedarían{" "}
                        {Math.max(0, vacInfo.diasRestantes - diasSel)}.
                      </p>
                    )}
                    {excede && (
                      <p className="text-xs font-medium text-rose-600 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Pides {diasSel} día{diasSel === 1 ? "" : "s"} pero solo te quedan{" "}
                        {vacInfo.diasRestantes}.
                      </p>
                    )}
                    {choque && (
                      <p className="text-xs font-medium text-rose-600 flex items-center gap-1.5">
                        <CalendarOff className="h-3.5 w-3.5" />
                        Esas fechas están bloqueadas
                        {choque.motivo ? ` (${choque.motivo})` : ""}: del{" "}
                        {fechaBloqueoLabel(choque.fechaInicio, vacInfo.esPredeterminado)} al{" "}
                        {fechaBloqueoLabel(choque.fechaFin, vacInfo.esPredeterminado)}
                        {vacInfo.esPredeterminado ? " (cada año)" : ""}.
                      </p>
                    )}
                    {vacInfo.bloqueos.length > 0 && !choque && (
                      <p className="text-[11px] text-muted-foreground">
                        Periodos bloqueados{vacInfo.esPredeterminado ? " (cada año)" : ""}:{" "}
                        {vacInfo.bloqueos
                          .map(
                            (b) =>
                              fechaBloqueoLabel(b.fechaInicio, vacInfo.esPredeterminado) +
                              (b.fechaFin !== b.fechaInicio
                                ? `–${fechaBloqueoLabel(b.fechaFin, vacInfo.esPredeterminado)}`
                                : ""),
                          )
                          .join(", ")}
                        .
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <Label htmlFor="motivo">
                  {subtipo === "horas_extras"
                    ? `Motivo o detalles (obligatorio, mínimo ${HORAS_EXTRAS_MOTIVO_MIN} caracteres)`
                    : "Motivo o detalles"}
                </Label>
                <Textarea
                  id="motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder={
                    subtipo === "baja_medica"
                      ? "Cuéntanos brevemente qué te pasa (opcional)…"
                      : subtipo === "horas_extras"
                        ? `¿Por qué? ¿En qué tarea? (mínimo ${HORAS_EXTRAS_MOTIVO_MIN} caracteres)`
                        : "Detalles para tu responsable"
                  }
                />
                {subtipo === "horas_extras" && (
                  motivoCorto ? (
                    <p className="text-xs font-medium text-rose-600">
                      Explica por qué hiciste las horas extras: faltan{" "}
                      {HORAS_EXTRAS_MOTIVO_MIN - motivo.trim().length} caracteres
                      para llegar al mínimo de {HORAS_EXTRAS_MOTIVO_MIN}.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {motivo.trim().length} caracteres (mínimo{" "}
                      {HORAS_EXTRAS_MOTIVO_MIN}).
                    </p>
                  )
                )}
              </div>

              {/* Parte de baja médica: hasta 3 fotos o PDFs, se envían a gestoría. */}
              {subtipo === "baja_medica" && (
                <div className="space-y-2">
                  <Label>Parte de baja (opcional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Adjunta una foto o PDF del parte médico. Puedes subir hasta{" "}
                    {PARTE_BAJA_MAX} y se enviarán juntos a la gestoría. Si aún no
                    lo tienes, envía la baja igualmente.
                  </p>

                  {partes.length > 0 && (
                    <ul className="space-y-1.5">
                      {partes.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                        >
                          <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate flex-1">{f.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {(f.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                          <button
                            type="button"
                            onClick={() => quitarParte(i)}
                            className="rounded p-0.5 text-muted-foreground hover:text-rose-600"
                            aria-label={`Quitar ${f.name}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {partes.length < PARTE_BAJA_MAX && (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                      <Paperclip className="h-4 w-4" />
                      {partes.length === 0 ? "Adjuntar parte (foto o PDF)" : "Añadir otro"}
                      <input
                        type="file"
                        accept={PARTE_BAJA_ACCEPT}
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          anadirPartes(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {/* Baja ya en curso: solo un botón para cerrar (no puede enviar). */}
            {paso === "detalle" && subtipo === "baja_contrato" && bajaEnCurso ? (
              <Button onClick={() => handleClose(false)} className="active:bg-blue-600">
                Entendido
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancelar
                </Button>
                {paso === "detalle" && (
                  <Button
                    onClick={
                      subtipo === "baja_contrato"
                        ? () => setConfirmBajaOpen(true)
                        : enviar
                    }
                    disabled={
                      enviando ||
                      vacEnvioBloqueado ||
                      bajaEnvioBloqueado ||
                      preavisoInsuficiente ||
                      !!errorReglasPermiso ||
                      motivoCorto ||
                      !!errorTramo
                    }
                    className="active:bg-blue-600"
                  >
                    {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar solicitud
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DiaTrabajadoAvisoDialog
        open={avisoOpen}
        onAceptar={aceptarAvisoDia}
        onCancelar={cancelarAvisoDia}
      />

      {/* Confirmación de irreversibilidad de la baja de contrato. */}
      <AlertDialog open={confirmBajaOpen} onOpenChange={setConfirmBajaOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmas tu baja de contrato?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Esta acción es <strong>irreversible</strong>. Al confirmar
                  comunicas formalmente tu decisión de causar baja voluntaria y
                  recibirás <strong>al momento</strong> un email con una carta de
                  baja para firmar.
                </p>
                <p>
                  La baja <strong>no se considera confirmada</strong> hasta que
                  firmes ese documento. El enlace de firma es válido{" "}
                  <strong>solo 1 hora</strong> desde ahora; si caduca, quedará
                  anulado y tendrás que volver a solicitarla.
                </p>
                <p>
                  {fechaFin
                    ? `Tu último día efectivo será el ${formatFechaEs(fechaFin)}.`
                    : ""}{" "}
                  Una vez enviada no podrás modificarla ni solicitar otra.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviando}>
              No, cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={enviando}
              onClick={(e) => {
                // Evitamos que el AlertDialog se cierre solo: lo cerramos al
                // terminar el envío (o en caso de error dejamos el modal abierto).
                e.preventDefault();
                setConfirmBajaOpen(false);
                enviar();
              }}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              Sí, solicitar mi baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
