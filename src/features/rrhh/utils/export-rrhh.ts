import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { type Vacante, FASES_CONFIG, ORIGEN_LABELS } from "../data/reclutamiento";
import type { EstadoReclutamiento, OrigenCandidatura } from "../data/reclutamiento";

/**
 * Genera un archivo CSV a partir de un array de objetos
 */
export function descargarCSV(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add headers
  csvRows.push(headers.join(","));

  // Add rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const escaped = ('' + val).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Genera un informe PDF de los candidatos
 */
type CandidatoExport = {
  nombre: string;
  apellidos: string;
  puesto?: string;
  vacanteId?: string;
  fase: string;
  email: string;
  telefono: string;
  origen: string;
  fechaInscripcion: string;
};

export function generarInformeCandidatosPDF(candidatos: CandidatoExport[], titulo: string = "Informe de Candidatos") {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text(titulo, 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 30);

  const tableData = candidatos.map(c => [
    `${c.nombre} ${c.apellidos}`,
    c.puesto || c.vacanteId || "N/A",
    FASES_CONFIG[c.fase as EstadoReclutamiento]?.label || c.fase,
    c.email,
    c.telefono,
    ORIGEN_LABELS[c.origen as OrigenCandidatura] || c.origen,
    c.fechaInscripcion
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["Nombre", "Puesto", "Fase", "Email", "Teléfono", "Origen", "Fecha"]],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] }, // Indigo primary color
  });

  doc.save(`${titulo.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

/**
 * Genera un informe PDF de las vacantes
 */
export function generarInformeVacantesPDF(vacantes: Vacante[]) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text("Informe de Vacantes", 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 30);

  const tableData = vacantes.map(v => [
    v.puesto,
    v.categoria,
    v.ubicacion,
    v.estadoPublicacion.toUpperCase(),
    v.candidatos.length.toString(),
    v.fechaCreacion
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["Puesto", "Categoría", "Ubicación", "Estado", "Candidatos", "Fecha"]],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] },
  });

  doc.save(`informe-vacantes.pdf`);
}
