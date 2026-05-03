import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FichaTecnica, CategoriaFicha } from "../data/fichas-tecnicas";
import { calcularMargen } from "../data/fichas-tecnicas";

export async function generarDossierPDF(fichas: FichaTecnica[], categorias: CategoriaFicha[], empresaNombre: string) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  fichas.forEach((ficha, index) => {
    if (index > 0) doc.addPage();

    // Header
    doc.setFillColor(31, 41, 55); // Slate 800
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(ficha.nombre.toUpperCase(), 15, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(empresaNombre.toUpperCase(), 15, 30);
    doc.text(`FECHA ACTUALIZACIÓN: ${ficha.fechaActualizacion || new Date().toISOString().slice(0, 10)}`, pageWidth - 15, 30, { align: "right" });

    // Main Content
    let currentY = 50;

    // Summary Table
    const catNombre = categorias.find(c => c.id === ficha.categoriaId)?.nombre || "—";
    const margen = calcularMargen(ficha.pvp, ficha.costeTotal);

    autoTable(doc, {
      startY: currentY,
      head: [["CATEGORÍA", "RESPONSABLE", "PVP", "COSTE TOTAL", "MARGEN %"]],
      body: [[
        catNombre,
        ficha.responsable || "—",
        `${ficha.pvp.toFixed(2)}€`,
        `${ficha.costeTotal.toFixed(2)}€`,
        `${margen}%`
      ]],
      theme: "striped",
      headStyles: { fillColor: [75, 85, 99], fontSize: 9 },
      styles: { fontSize: 10, cellPadding: 5 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Two Columns Layout
    const colWidth = (pageWidth - 40) / 2;

    // Left Column: Ingredientes
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 41, 55);
    doc.text("INGREDIENTES", 15, currentY);
    
    const ingredientesBody = ficha.ingredientes.map(i => [
      i.ingrediente,
      `${i.cantidad}${i.unidad}`
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      margin: { left: 15, right: pageWidth / 2 + 5 },
      head: [["INGREDIENTE", "CANTIDAD"]],
      body: ingredientesBody.length > 0 ? ingredientesBody : [["No especificados", ""]],
      theme: "plain",
      headStyles: { fillColor: [243, 244, 246], textColor: [75, 85, 99], fontSize: 8 },
      styles: { fontSize: 9 },
    });

    // Right Column: Alérgenos y Recomendaciones
    const rightColX = pageWidth / 2 + 5;
    doc.text("ALÉRGENOS", rightColX, currentY);
    
    let alergenosY = currentY + 10;
    if (ficha.alergenos.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(ficha.alergenos.join(", "), rightColX, alergenosY, { maxWidth: colWidth });
      alergenosY += (Math.ceil(ficha.alergenos.join(", ").length / 40) * 5) + 5;
    } else {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("Sin alérgenos conocidos", rightColX, alergenosY);
      alergenosY += 10;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RECOMENDACIONES", rightColX, alergenosY);
    
    let recoY = alergenosY + 10;
    if (ficha.recomendaciones.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(ficha.recomendaciones.join(", "), rightColX, recoY, { maxWidth: colWidth });
    } else {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("Sin recomendaciones específicas", rightColX, recoY);
    }

    // Elaboración (Full Width)
    const tableY = Math.max((doc as any).lastAutoTable.finalY + 10, recoY + 20);
    currentY = tableY;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ELABORACIÓN Y PRESENTACIÓN", 15, currentY);

    autoTable(doc, {
      startY: currentY + 5,
      head: [["PROCESO / RECETA"]],
      body: [[ficha.elaboracion || "No especificada"]],
      theme: "striped",
      headStyles: { fillColor: [243, 244, 246], textColor: [75, 85, 99], fontSize: 8 },
      styles: { fontSize: 10, cellPadding: 8 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Additional info
    const infoBody = [
      ["PARTIDA", ficha.partida || "—"],
      ["GUARNICIÓN", ficha.guarnicion || "—"],
      ["DECORACIÓN", ficha.decoracion || "—"],
      ["MENAJE", ficha.menaje || "—"],
      ["PRESENTACIÓN MESA", ficha.presentacionMesa || "—"],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [["CONCEPTO", "DETALLE"]],
      body: infoBody,
      theme: "grid",
      headStyles: { fillColor: [243, 244, 246], textColor: [75, 85, 99], fontSize: 8 },
      styles: { fontSize: 9 },
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Página ${index + 1} de ${fichas.length} | Generado por Balles Hosteleros`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  });

  const fileName = fichas.length === 1 
    ? `FICHA_${fichas[0].nombre.replace(/\s+/g, "_")}.pdf`
    : `DOSSIER_FICHAS_${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(fileName);
}
