import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ProcesoJuridico } from "../data/procesos-juridicos";

export const generarReportePDF = (proceso: ProcesoJuridico) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("REPORTE DE EXPEDIENTE JURÍDICO", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`ID: ${proceso.id}`, 14, 28);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 34);
    doc.line(14, 36, pageWidth - 14, 36);

    // General Info Section
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Información General", 14, 45);

    const generalData = [
      ["Título", proceso.titulo || "Sin título"],
      ["Empresa", proceso.empresa || "Sin empresa"],
      ["Tipo", proceso.tipo || "Otro"],
      ["Estado", proceso.estado || "PENDIENTE"],
      ["Gravedad", proceso.gravedad || "MEDIA"],
      ["Jurídico Responsable", proceso.juridico || "No asignado"],
      ["Fecha de Apertura", proceso.fecha || "-"],
    ];

    autoTable(doc, {
      startY: 50,
      head: [["Campo", "Valor"]],
      body: generalData,
      theme: "striped",
      headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 3 },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 12;

    // Description Section
    if (proceso.descripcion) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text("Descripción", 14, currentY);
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const splitDesc = doc.splitTextToSize(proceso.descripcion, pageWidth - 28);
      doc.text(splitDesc, 14, currentY + 7);
      currentY += (splitDesc.length * 5) + 15;
    } else {
      currentY += 5;
    }

    // Updates Section
    if (proceso.actualizaciones && proceso.actualizaciones.length > 0) {
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("Historial de Actualizaciones", 14, currentY);

      const updatesData = proceso.actualizaciones.map(act => [
        act.fecha || "-",
        act.apuntadoPor || "-",
        act.texto || "-",
        act.documentos?.map(d => d.nombre).join(", ") || "-"
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [["Fecha", "Responsable", "Detalle", "Documentos"]],
        body: updatesData,
        theme: "grid",
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          2: { cellWidth: 80 }, // Wide column for detail
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${i} de ${pageCount} - Balles Hostelero Software de Gestión Jurídica`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    doc.save(`Expediente_${proceso.titulo.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
  } catch (error) {
    console.error("Error al generar PDF:", error);
    throw new Error("No se pudo generar el reporte PDF. Verifique los datos del expediente.");
  }
};

export const descargarDocumentoReal = async (url: string, nombre: string) => {
  // Si es un documento de referencia (mock) sin URL real
  if (!url || url === "#") {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("DOCUMENTO DE REFERENCIA", 14, 22);
      doc.setFontSize(12);
      doc.text(`Nombre: ${nombre}`, 14, 35);
      doc.text("Este es un documento de muestra del sistema.", 14, 45);
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 55);
      doc.save(`${nombre.replace(/\.[^/.]+$/, "")}_MOCK.pdf`);
      return;
    } catch (err) {
      console.error("Error al generar PDF de muestra:", err);
      throw new Error("No se pudo generar el documento de muestra");
    }
  }

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = nombre.endsWith(".pdf") ? nombre : `${nombre}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("Error al descargar:", error);
    // Fallback simple link download if fetch fails (e.g. CORS)
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.download = nombre;
    link.click();
  }
};
