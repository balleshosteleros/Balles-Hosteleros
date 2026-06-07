import { jsPDF } from "jspdf";
import autoTable, { type CellDef, type RowInput } from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DIAS_SEMANA, type TurnoTono } from "@/features/rrhh/data/horarios";
import type {
  Planificacion,
  PlanEmpleado,
  PlanTurno,
} from "@/features/rrhh/actions/planificacion-actions";
import type { Agrupacion } from "@/features/rrhh/components/horarios/CuadranteGrid";

const SIN_DEPTO = "Sin departamento";

// Paleta de turnos → RGB del PDF (réplica de TURNO_TONOS de la rejilla).
const TONO_PDF: Record<TurnoTono, { fill: [number, number, number]; text: [number, number, number] }> = {
  stone: { fill: [231, 229, 228], text: [68, 64, 60] },
  emerald: { fill: [167, 243, 208], text: [6, 95, 70] },
  violet: { fill: [221, 214, 254], text: [91, 33, 182] },
  rose: { fill: [254, 205, 211], text: [159, 18, 57] },
  teal: { fill: [204, 251, 241], text: [17, 94, 89] },
  sky: { fill: [224, 242, 254], text: [7, 89, 133] },
  amber: { fill: [254, 243, 199], text: [146, 64, 14] },
};

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
    const tono = TONO_PDF[items[0].color] ?? TONO_PDF.stone;
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
      const tono = TONO_PDF[t.color] ?? TONO_PDF.stone;
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

  const slug = rangoLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  doc.save(`cuadrante-horarios-${slug || "export"}.pdf`);
}
