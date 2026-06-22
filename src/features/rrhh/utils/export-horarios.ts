import { jsPDF } from "jspdf";
import autoTable, { type CellDef, type RowInput } from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DIAS_SEMANA } from "@/features/rrhh/data/horarios";
import type {
  Planificacion,
  PlanEmpleado,
  PlanTurno,
} from "@/features/rrhh/actions/planificacion-actions";
import type { Agrupacion } from "@/features/rrhh/components/horarios/CuadranteGrid";

const SIN_DEPTO = "Sin departamento";

type RGB = [number, number, number];

/** "#rrggbb" → RGB. Cae a un gris neutro si el hex no es válido. */
function hexToRgb(hex?: string | null): RGB {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex ?? "").trim());
  if (!m) return [107, 114, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Color hex del departamento → relleno tenue + texto del color, replicando el
 * pastel de la rejilla (fondo = 15 % del color sobre blanco).
 */
function pdfTonoDeHex(hex?: string | null): { fill: RGB; text: RGB } {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.85);
  return { fill: [mix(r), mix(g), mix(b)], text: [r, g, b] };
}

const MUTED: [number, number, number] = [241, 245, 249]; // slate-100 (cabeceras de grupo)
const HEAD: [number, number, number] = [226, 232, 240]; // slate-200 (cabecera de tabla)

interface DiaCol {
  iso: string;
  date: Date;
}

export interface ExportCuadranteOpts {
  planificacion: Planificacion;
  dias: DiaCol[];
  agrupacion: Agrupacion;
  hoyISO: string;
  compacto: boolean;
  empresaNombre: string;
  rangoLabel: string;
  areaLabel?: string;
  departamentoNombre?: string;
  cuadranteNombre?: string;
}

/** Prefijo común (a nivel de palabra) de un conjunto de nombres. */
function prefijoComun(nombres: string[]): string {
  if (nombres.length === 0) return "";
  if (nombres.length === 1) return nombres[0];
  let pref = nombres[0];
  for (const n of nombres.slice(1)) {
    let i = 0;
    while (i < pref.length && i < n.length && pref[i] === n[i]) i += 1;
    pref = pref.slice(0, i);
  }
  // Recorta a la última palabra completa para no cortar a media palabra.
  const trimmed = pref.replace(/\s+\S*$/, "").trim();
  return trimmed || nombres[0];
}

/** Texto de horario de un turno: tramos "HH:MM-HH:MM" o "Flexible". */
function horarioDeTurno(t: PlanTurno): string {
  if (t.tipoJornada === "flexible") {
    return t.flexHorasDia != null ? `Flexible · ${t.flexHorasDia} h/día` : "Flexible";
  }
  if (t.tramos.length === 0) return "—";
  return t.tramos.map((tr) => `${tr.inicio}-${tr.fin}`).join(", ");
}

interface LeyendaEntry {
  codigo: string;
  nombre: string;
  departamento: string;
  horarios: string;
  fill: RGB;
  text: RGB;
}

/**
 * Índice del cuadrante: una fila por CÓDIGO (no por turno) con su rol y los
 * horarios que abarca. Solo incluye los códigos realmente presentes en el
 * export para que la leyenda explique justo lo que se ve.
 */
function construirLeyenda(turnos: PlanTurno[], codigosUsados: Set<string>): LeyendaEntry[] {
  const porCodigo = new Map<string, PlanTurno[]>();
  for (const t of turnos) {
    const cod = (t.codigo ?? "").trim().toUpperCase();
    if (!cod || !codigosUsados.has(cod)) continue;
    const arr = porCodigo.get(cod) ?? [];
    arr.push(t);
    porCodigo.set(cod, arr);
  }
  const entries: LeyendaEntry[] = [];
  for (const [codigo, ts] of porCodigo) {
    const nombre = prefijoComun(ts.map((t) => t.nombre));
    const depto = ts[0].departamento ?? SIN_DEPTO;
    const horarios = Array.from(new Set(ts.map(horarioDeTurno))).join("  ·  ");
    const tono = pdfTonoDeHex(ts[0].colorHex);
    entries.push({ codigo, nombre, departamento: depto, horarios, fill: tono.fill, text: tono.text });
  }
  return entries.sort(
    (a, b) =>
      a.departamento.localeCompare(b.departamento, "es") ||
      a.codigo.localeCompare(b.codigo, "es"),
  );
}

/** Réplica del agrupamiento por departamento de la rejilla. */
function agruparDepartamentos(empleados: PlanEmpleado[]): [string, PlanEmpleado[]][] {
  const map = new Map<string, PlanEmpleado[]>();
  for (const e of empleados) {
    const dep = e.departamento ?? SIN_DEPTO;
    const arr = map.get(dep) ?? [];
    arr.push(e);
    map.set(dep, arr);
  }
  return Array.from(map.entries()).sort((a, b) => {
    if (a[0] === SIN_DEPTO) return 1;
    if (b[0] === SIN_DEPTO) return -1;
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return a[0].localeCompare(b[0], "es");
  });
}

/** Genera y descarga el PDF del cuadrante con lo que se ve en pantalla. */
export function exportarCuadrantePDF(opts: ExportCuadranteOpts) {
  const {
    planificacion,
    dias,
    agrupacion,
    rangoLabel,
    empresaNombre,
    areaLabel,
    departamentoNombre,
    cuadranteNombre,
    compacto,
  } = opts;
  const { empleados, turnos, celdas } = planificacion;
  const turnoById = new Map(turnos.map((t) => [t.id, t]));

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 10;

  // ── Cabecera del documento ──────────────────────────────────────────────
  doc.setFontSize(15);
  doc.setTextColor(30);
  doc.text("Cuadrante de horarios", margin, 14);

  doc.setFontSize(9.5);
  doc.setTextColor(110);
  const sub = [empresaNombre, rangoLabel].filter(Boolean).join("  ·  ");
  doc.text(sub, margin, 20);

  const agrupLabel =
    agrupacion === "departamentos"
      ? "Departamentos"
      : agrupacion === "empleados"
        ? "Empleados"
        : "Turnos";
  const meta = [
    `Vista: ${agrupLabel}`,
    cuadranteNombre ? `Cuadrante: ${cuadranteNombre}` : null,
    areaLabel ? `Área: ${areaLabel}` : null,
    departamentoNombre ? `Departamento: ${departamentoNombre}` : null,
    `Generado: ${format(new Date(), "d MMM yyyy HH:mm", { locale: es })}`,
  ]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(meta, margin, 25.5);

  // ── Cabecera de la tabla (día de semana + nº + recuento de empleados) ────
  const empleadosPorDia = new Map<string, number>();
  for (const d of dias) {
    let n = 0;
    for (const e of empleados) {
      if ((celdas[e.empleadoId]?.[d.iso]?.length ?? 0) > 0) n += 1;
    }
    empleadosPorDia.set(d.iso, n);
  }

  const primeraCol =
    agrupacion === "turnos" ? "Turno" : agrupacion === "departamentos" ? "Departamento" : "Empleado";
  const head: CellDef[] = [
    { content: primeraCol, styles: { halign: "left" } },
    ...dias.map((d) => ({
      content:
        `${format(d.date, compacto ? "EEEEE" : "EEE", { locale: es })} ${format(d.date, "d")}` +
        `  (${empleadosPorDia.get(d.iso) ?? 0})`,
      styles: { halign: "center" as const },
    })),
  ];

  // ── Cuerpo ───────────────────────────────────────────────────────────────
  const numCols = 1 + dias.length;
  const body: RowInput[] = [];

  const celdaDia = (empId: string, iso: string): CellDef => {
    const items = (celdas[empId]?.[iso] ?? [])
      .map((c) => turnoById.get(c.turnoId))
      .filter(Boolean) as PlanTurno[];
    if (items.length === 0) return { content: "" };
    const content = items
      .map((t) => {
        const tramo = t.tramos[0];
        return compacto || !tramo
          ? t.codigo
          : `${t.codigo}\n${tramo.inicio}-${tramo.fin}`;
      })
      .join("\n");
    const tono = pdfTonoDeHex(items[0].colorHex);
    return {
      content,
      styles: { fillColor: tono.fill, textColor: tono.text, fontStyle: "bold" },
    };
  };

  if (agrupacion === "turnos") {
    const ordenados = [...turnos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    // Recuento de empleados por turno y día.
    const conteo = new Map<string, Map<string, number>>();
    for (const t of ordenados) conteo.set(t.id, new Map());
    for (const e of empleados) {
      for (const [iso, cs] of Object.entries(celdas[e.empleadoId] ?? {})) {
        for (const c of cs) conteo.get(c.turnoId)?.set(iso, (conteo.get(c.turnoId)?.get(iso) ?? 0) + 1);
      }
    }
    for (const t of ordenados) {
      const tono = pdfTonoDeHex(t.colorHex);
      const fila: CellDef[] = [
        {
          content: `${t.codigo}  ${t.nombre}`,
          styles: { fillColor: tono.fill, textColor: tono.text, fontStyle: "bold", halign: "left" },
        },
      ];
      for (const d of dias) {
        const weekday = (d.date.getDay() + 6) % 7;
        const n = conteo.get(t.id)?.get(d.iso) ?? 0;
        const aplica = t.dias.length === 0 ? n > 0 : t.dias.includes(DIAS_SEMANA[weekday]);
        if (!aplica) {
          fila.push({ content: "·", styles: { textColor: [203, 213, 225] } });
        } else {
          const tramo = t.tramos[0];
          fila.push({
            content: compacto || !tramo ? `${n}` : `${tramo.inicio}-${tramo.fin}\n${n}`,
          });
        }
      }
      body.push(fila);
    }
  } else {
    const ordenados = [...empleados].sort((a, b) =>
      a.nombreCompleto.localeCompare(b.nombreCompleto, "es"),
    );
    const filaEmpleado = (e: PlanEmpleado): CellDef[] => {
      // Solo el puesto real bajo el nombre (nunca el departamento), y nada en
      // vista mes (compacto) — igual que la rejilla en pantalla.
      const subtitulo = !compacto ? e.puesto : null;
      const nombre = subtitulo ? `${e.nombreCompleto}\n${subtitulo}` : e.nombreCompleto;
      return [
        { content: nombre, styles: { halign: "left", fontStyle: "bold" } },
        ...dias.map((d) => celdaDia(e.empleadoId, d.iso)),
      ];
    };

    if (agrupacion === "departamentos") {
      for (const [dep, emps] of agruparDepartamentos(ordenados)) {
        body.push([
          {
            content: `${dep}  ·  ${emps.length}`,
            colSpan: numCols,
            styles: { fillColor: MUTED, textColor: [51, 65, 85], fontStyle: "bold", halign: "left" },
          },
        ]);
        for (const e of emps) body.push(filaEmpleado(e));
      }
    } else {
      for (const e of ordenados) body.push(filaEmpleado(e));
    }
  }

  if (body.length === 0) {
    body.push([
      {
        content: "Sin datos en este ámbito.",
        colSpan: numCols,
        styles: { halign: "center", textColor: [120, 120, 120] },
      },
    ]);
  }

  autoTable(doc, {
    startY: 30,
    head: [head],
    body,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: {
      fontSize: compacto ? 6 : 7,
      cellPadding: 1,
      halign: "center",
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: HEAD,
      textColor: [30, 41, 59],
      fontStyle: "bold",
      fontSize: compacto ? 6 : 7,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: compacto ? 32 : 42, halign: "left" },
    },
  });

  // ── Índice de códigos (qué horario es cada código) ───────────────────────
  const codigosUsados = new Set<string>();
  for (const e of empleados) {
    for (const cs of Object.values(celdas[e.empleadoId] ?? {})) {
      for (const c of cs) {
        const t = turnoById.get(c.turnoId);
        if (t?.codigo) codigosUsados.add(t.codigo.trim().toUpperCase());
      }
    }
  }
  // En vista por turnos se muestran todos los turnos del ámbito como filas.
  if (agrupacion === "turnos") {
    for (const t of turnos) if (t.codigo) codigosUsados.add(t.codigo.trim().toUpperCase());
  }

  const leyenda = construirLeyenda(turnos, codigosUsados);
  if (leyenda.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 30;
    doc.setFontSize(9.5);
    doc.setTextColor(30);
    doc.text("Índice de códigos", margin, finalY + 7);
    autoTable(doc, {
      startY: finalY + 9.5,
      head: [
        [
          { content: "Código y turno", styles: { halign: "left" } },
          { content: "Horario", styles: { halign: "left" } },
          { content: "Departamento", styles: { halign: "left" } },
        ],
      ],
      body: leyenda.map((l) => [
        {
          content: `${l.codigo}   ${l.nombre}`,
          styles: { fillColor: l.fill, textColor: l.text, fontStyle: "bold" as const },
        },
        { content: l.horarios },
        { content: l.departamento },
      ]),
      theme: "grid",
      margin: { left: margin, right: margin },
      tableWidth: "wrap",
      styles: {
        fontSize: compacto ? 6 : 7,
        cellPadding: 1.2,
        halign: "left",
        valign: "middle",
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: HEAD,
        textColor: [30, 41, 59],
        fontStyle: "bold",
        fontSize: compacto ? 6 : 7,
        halign: "left",
      },
      columnStyles: {
        0: { cellWidth: compacto ? 48 : 60 },
        1: { cellWidth: compacto ? 42 : 52 },
        2: { cellWidth: "auto" },
      },
    });
  }

  const slug = rangoLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  doc.save(`cuadrante-horarios-${slug || "export"}.pdf`);
}
