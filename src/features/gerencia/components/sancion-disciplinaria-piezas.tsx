"use client";

/**
 * Piezas de la SANCIÓN DISCIPLINARIA.
 *
 * La sanción ya no tiene pantalla propia: es un TIPO de comunicado (Iván,
 * 12-09-2026). Se escribe en la misma ficha que cualquier otro comunicado y,
 * al elegir el tipo «Sanción», la ficha cambia por dentro y pide lo que exige
 * la ley: a quién, qué falta, qué hechos, cuándo y en cuántos días la firma.
 *
 * Aquí vive todo lo que es propio de la sanción y nada más: las tres
 * calificaciones con su plazo de prescripción, el aviso de qué es esto, el
 * documento tal y como lo va a ver el trabajador, y el estado de su firma.
 */

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldAlert, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { EmpleadoSelector } from "@/features/gerencia/actions/comunicados-actions";
import type { GravedadSancion } from "@/features/gerencia/services/sancion-disciplinaria-pdf";

/**
 * Las tres calificaciones que admite la ley, cada una con su plazo de
 * prescripción (art. 60.2 del Estatuto de los Trabajadores): la falta prescribe
 * a esos días DESDE QUE LA EMPRESA TUVO CONOCIMIENTO de ella y, en todo caso, a
 * los seis meses de haberse cometido.
 */
export const GRAVEDAD_OPCIONES: { value: GravedadSancion; label: string; className: string; prescribeDias: number }[] = [
  { value: "leve", label: "Falta leve", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", prescribeDias: 10 },
  { value: "grave", label: "Falta grave", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", prescribeDias: 20 },
  { value: "muy_grave", label: "Falta muy grave", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", prescribeDias: 60 },
];

const GRAVEDAD_BARRA: Record<GravedadSancion, string> = {
  leve: "#d98c0d",
  grave: "#dc4d15",
  muy_grave: "#c71c1c",
};

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fecha siempre en día/mes/año, la regla del software. */
export function fmtFechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const ESTADO_CFG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pendiente: { label: "Pendiente de firma", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Clock },
  firmado: { label: "Firmada", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: CheckCircle2 },
  // Se negó a firmarla: queda informado, con día y hora, y el documento se
  // archiva marcado NO FIRMADO. Se lee en rojo, no como un «leído» cualquiera.
  leido: { label: "No firmada", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
  rechazado: { label: "Rechazada", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
  expirado: { label: "Expirada", className: "bg-muted text-muted-foreground", icon: XCircle },
};

export function estadoFirmaLabel(estado: string): string {
  return ESTADO_CFG[estado]?.label ?? estado;
}

export function EstadoFirmaBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado] ?? { label: estado, className: "bg-muted text-muted-foreground", icon: Clock };
  const Icon = cfg.icon;
  // El estado se lee de una sola vez: "No firmada" y "Pendiente de firma" se
  // partían en dos líneas cuando la columna venía estrecha (Iván, 12-09-2026).
  return (
    <Badge className={`${cfg.className} border-0 font-medium gap-1 whitespace-nowrap`}>
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
    </Badge>
  );
}

export function gravedadLabel(g: GravedadSancion | null): string {
  return GRAVEDAD_OPCIONES.find(o => o.value === g)?.label ?? "—";
}

/** La empresa tal y como se imprime en la sanción (Ajustes → Empresa). */
export interface EmpresaSancion {
  nombre: string;
  razonSocial: string;
  cif: string | null;
  domicilio: string | null;
}

/** Lo que la sanción pide de más respecto de un comunicado normal. */
export interface DatosSancion {
  /** A QUIÉN. Una sanción va a UNA sola persona: nunca se manda en bloque. */
  empleadoId: string;
  gravedad: GravedadSancion;
  fechaHechos: string;
  /**
   * El día que se emite. No se escribe: es el día en que sale, en la hora de la
   * empresa, y lo pone el servidor. Aquí solo vale para la previsualización.
   */
  fechaEmision: string;
  /** Hora a la que sale, en la hora de la empresa. Solo para la previsualización. */
  horaEmision: string;
  /** Días de plazo para firmar el acuse de recibo. */
  plazoDias: number;
}

export const datosSancionVacios: DatosSancion = {
  empleadoId: "",
  gravedad: "grave",
  fechaHechos: "",
  fechaEmision: hoyISO(),
  horaEmision: "",
  plazoDias: 15,
};

/**
 * Aviso de PRESCRIPCIÓN (art. 60.2 ET). No bloquea: el plazo corre desde que la
 * empresa tuvo conocimiento de los hechos, y eso solo lo sabe quien la emite.
 * Pero si la fecha que ha puesto ya se pasa de plazo, tiene que verlo antes de
 * mandarla. Devuelve null cuando no hay nada que avisar.
 */
export function avisoPrescripcion(fechaHechos: string, gravedad: GravedadSancion): string | null {
  if (!fechaHechos) return null;
  const opcion = GRAVEDAD_OPCIONES.find(g => g.value === gravedad);
  if (!opcion) return null;
  const hechos = new Date(`${fechaHechos}T00:00:00`);
  const dias = Math.floor((Date.now() - hechos.getTime()) / 86_400_000);
  if (Number.isNaN(dias) || dias < 0) return null;
  if (dias > 180) {
    return `Han pasado ${dias} días desde los hechos. Pasados seis meses la falta prescribe en todo caso (art. 60.2 del Estatuto de los Trabajadores).`;
  }
  if (dias > opcion.prescribeDias) {
    return `Han pasado ${dias} días desde los hechos. Una ${opcion.label.toLowerCase()} prescribe a los ${opcion.prescribeDias} días desde que la empresa tuvo conocimiento de ella (art. 60.2 del Estatuto de los Trabajadores).`;
  }
  return null;
}

/** Aviso de qué es esto: el mismo texto en el listado y al redactarla. */
export function AvisoAcuseRecibo() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex gap-2">
      <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
        La sanción se envía al trabajador para que la firme como <strong>acuse de recibo (leído/informado)</strong>.
        No requiere su conformidad. Le sale <strong>en sus comunicados</strong>, marcada como sanción, y además le llega
        por correo y aviso para firmarla dentro del software. Aparece en RRHH → Firmas y, una vez firmada, queda guardada
        para siempre en su carpeta «Sanciones» de documentos.
      </p>
    </div>
  );
}

/** Prototipo visual de la sanción — refleja el PDF que firmará el trabajador. */
export function PrototipoSancion({ datos, hechos, empleado, empresa }: {
  datos: DatosSancion;
  /** Los hechos se escriben en el cuerpo del comunicado, como el mensaje. */
  hechos: string;
  empleado: EmpleadoSelector | null;
  empresa: EmpresaSancion | null;
}) {
  const gravLabel = GRAVEDAD_OPCIONES.find(g => g.value === datos.gravedad)?.label ?? "";
  const barra = GRAVEDAD_BARRA[datos.gravedad];
  const nombre = empleado ? `${empleado.nombre} ${empleado.apellidos}`.trim() : "—";
  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden text-zinc-900 dark:text-zinc-100">
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block h-4 w-11 rounded-sm" style={{ background: barra }} />
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: barra }}>{gravLabel}</span>
        </div>
        <h1 className="text-lg font-bold leading-tight">COMUNICACIÓN DE SANCIÓN DISCIPLINARIA</h1>
        {/* Quien sanciona es la SOCIEDAD, no el rótulo del local: es lo que sale
            impreso, tal cual está en Ajustes → Empresa. */}
        <p className="text-xs text-muted-foreground mt-1">
          {empresa ? `${empresa.razonSocial}${empresa.cif ? ` · NIF ${empresa.cif}` : ""}` : "—"}
        </p>
        {empresa?.domicilio && <p className="text-[11px] text-muted-foreground">{empresa.domicilio}</p>}
      </div>
      <Separator />
      <div className="px-6 py-4 space-y-3 text-sm">
        <Campo label="Trabajador/a" value={`${nombre}${(empleado?.puesto ?? empleado?.rolLabel) ? ` · ${empleado?.puesto ?? empleado?.rolLabel}` : ""}`} />
        <Campo label="Departamento" value={empleado?.departamento || "—"} />
        <Campo label="Calificación de la falta" value={gravLabel} />
        <Campo label="Fecha de los hechos" value={fmtFechaCorta(datos.fechaHechos || null)} />
        <CampoParrafo label="Hechos que motivan la sanción" value={hechos} />
        <Separator />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Mediante la firma de este documento, el trabajador/a declara haber sido <strong>informado/a</strong> y
          haber recibido la presente comunicación. La firma constituye únicamente <strong>acuse de recibo y de
          lectura</strong>; NO implica conformidad ni aceptación de los hechos. El
          trabajador/a puede impugnar esta sanción ante el Juzgado de lo Social en el plazo de veinte días
          hábiles desde su notificación (art. 114 de la Ley Reguladora de la Jurisdicción Social), previa
          presentación de la papeleta de conciliación cuando proceda.
        </p>
        {/* Quién la impone ya está arriba, en la cabecera: aquí va cuándo sale. */}
        <Campo
          label="Emitido el"
          value={
            datos.horaEmision
              ? `${fmtFechaCorta(datos.fechaEmision || null)} a las ${datos.horaEmision}`
              : fmtFechaCorta(datos.fechaEmision || null)
          }
        />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Firma del trabajador/a (leído y recibido)</p>
          <div className="h-16 rounded-md border border-dashed flex items-center justify-center text-[11px] text-muted-foreground">
            Firma manuscrita en el momento de la lectura
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

function CampoParrafo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{value || <span className="text-muted-foreground italic">Pendiente de redactar…</span>}</p>
    </div>
  );
}
