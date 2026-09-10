import type { Metadata } from "next";
import { cargarPortal } from "@/features/escuela/services/sesion-portal";
import { getPerfil } from "@/features/escuela/services/portal-alumno";
import { AccesoAlumno } from "@/features/escuela/components/portal/AccesoAlumno";
import { PortalShell } from "@/features/escuela/components/portal/PortalShell";
import { PerfilAlumnoVista } from "@/features/escuela/components/portal/PerfilAlumnoVista";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function EscuelaPerfilPage() {
  const { marca, alumno } = await cargarPortal();
  if (!marca) return null;
  if (!alumno) return <AccesoAlumno />;

  const perfil = await getPerfil(alumno);

  return (
    <PortalShell marca={marca} activa="perfil" nombreAlumno={alumno.nombre}>
      <h1 className="mb-4 text-xl font-semibold">Mi perfil</h1>
      <PerfilAlumnoVista perfil={perfil} />
    </PortalShell>
  );
}
