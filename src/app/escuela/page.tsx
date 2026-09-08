import type { Metadata } from "next";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { cargarPortal } from "@/features/escuela/services/sesion-portal";
import { getClasesAlumno } from "@/features/escuela/services/portal-alumno";
import { AccesoAlumno } from "@/features/escuela/components/portal/AccesoAlumno";
import { PortalShell } from "@/features/escuela/components/portal/PortalShell";
import { CalendarioClases } from "@/features/escuela/components/portal/CalendarioClases";

export const metadata: Metadata = { title: "Clases" };

export default async function EscuelaClasesPage() {
  const { marca, alumno } = await cargarPortal();
  if (!marca) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-sm text-muted-foreground">
        La escuela todavía no está configurada.
      </div>
    );
  }
  if (!alumno) return <AccesoAlumno marca={marca} />;

  const clases = await getClasesAlumno(alumno);
  // El día de hoy es el del reloj de la ESCUELA, no el del navegador del alumno:
  // si no, quien mire desde otro huso vería la clase de hoy como la de ayer.
  const hoy = hoyEnZona(marca.zonaHoraria);

  return (
    <PortalShell marca={marca} activa="clases" nombreAlumno={alumno.nombre}>
      <h1 className="mb-4 text-xl font-semibold">Clases</h1>
      <CalendarioClases clases={clases} hoy={hoy} isotipoUrl={marca.isotipoUrl ?? marca.logoUrl} />
    </PortalShell>
  );
}
