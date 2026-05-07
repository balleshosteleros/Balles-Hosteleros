import type { AltaInput, BajaInput, EmpleadoActivo, ModificacionInput } from "@/features/gestoria/contrataciones/types";
import { DIAS_SEMANA } from "@/features/gestoria/contrataciones/data/constants";

const trim = (v: string | null | undefined) => (v ?? "").trim();

function fmtFechaES(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function altaEmailContent(input: AltaInput, empresa: string) {
  const nomina = trim(input.nomina) || "Según convenio";
  const horario = DIAS_SEMANA.map((d) => {
    const v = trim((input as Record<string, unknown>)[`horario_${d.key}`] as string | undefined);
    return ` -${d.label.toUpperCase()}: ${v || "—"}`;
  }).join("\n");

  const text =
`ALTA CONTRATO GESTORÍA
NOMBRE Y APELLIDOS: ${trim(input.nombre)} ${trim(input.apellidos)}
DNI: ${trim(input.dni)}
SEGURIDAD SOCIAL: ${trim(input.numero_ss)}
DÍA COMIENZO: ${fmtFechaES(input.fecha_comienzo)}
NÓMINA: ${nomina}
PUESTO: ${trim(input.puesto)}
JORNADA: ${input.jornada_horas} h/semana
HORAS DE CONTRATO:
${horario}`;

  const subject = `Alta contrato — ${trim(input.nombre)} ${trim(input.apellidos)} — ${empresa}`.trim();

  const html = `<pre style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; white-space:pre-wrap;">${escapeHtml(text)}</pre>`;

  return { subject, text, html };
}

export function bajaEmailContent(input: BajaInput, empleado: EmpleadoActivo, empresa: string) {
  const nombre = `${trim(empleado.nombre)} ${trim(empleado.apellidos)}`.trim();
  const motivo = input.motivo === "Otro"
    ? `Otro — ${trim(input.motivo_otro)}`
    : input.motivo;
  const liquidar = input.liquidar_vacaciones
    ? `Sí (${input.dias_vacaciones ?? 0} días)`
    : "No";
  const preaviso = input.descontar_preaviso
    ? `Sí (${input.dias_preaviso ?? 0} días)`
    : "No";

  const text =
`BAJA CONTRATO GESTORÍA
NOMBRE Y APELLIDO: ${nombre}
DÍA FINALIZACIÓN: ${fmtFechaES(input.fecha_finalizacion)}
MOTIVO DE BAJA: ${motivo}
LIQUIDAR VACACIONES: ${liquidar}
DESCONTAR PREAVISO: ${preaviso}`;

  const subject = `Baja contrato — ${nombre} — ${empresa}`.trim();

  const html = `<pre style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; white-space:pre-wrap;">${escapeHtml(text)}</pre>`;

  return { subject, text, html };
}

export function modificacionEmailContent(input: ModificacionInput, empleado: EmpleadoActivo, empresa: string) {
  const nombre = `${trim(empleado.nombre)} ${trim(empleado.apellidos)}`.trim();
  const detalleLineas: string[] = [];
  if (input.modificacion_tipo === "Puesto" && trim(input.nuevo_puesto)) {
    detalleLineas.push(`PUESTO ANTERIOR: ${trim(empleado.puesto) || "—"}`);
    detalleLineas.push(`PUESTO NUEVO: ${trim(input.nuevo_puesto)}`);
  }
  if (trim(input.modificacion_detalle)) {
    detalleLineas.push(`DETALLE: ${trim(input.modificacion_detalle)}`);
  }

  const text =
`MODIFICACIÓN CONTRATO GESTORÍA
NOMBRE Y APELLIDO: ${nombre}
FECHA DEL CAMBIO: ${fmtFechaES(input.fecha_cambio)}
TIPO DE MODIFICACIÓN: ${input.modificacion_tipo}
${detalleLineas.join("\n")}`.trim();

  const subject = `Modificación contrato — ${nombre} — ${empresa}`.trim();
  const html = `<pre style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; white-space:pre-wrap;">${escapeHtml(text)}</pre>`;
  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
