import "server-only";
import { leerSesionAlumno } from "../lib/sesion-alumno";
import { getAlumno, getMarcaEscuela, type AlumnoSesion, type MarcaEscuela } from "./portal-alumno";

/**
 * Lo que necesita CUALQUIER pantalla del portal antes de pintar nada: la marca
 * de la escuela y, si la hay, el alumno de la sesión. Sin alumno, la pantalla
 * enseña la entrada.
 */
export async function cargarPortal(): Promise<{
  marca: MarcaEscuela | null;
  alumno: AlumnoSesion | null;
}> {
  const marca = await getMarcaEscuela();
  const alumnoId = await leerSesionAlumno();
  const alumno = alumnoId ? await getAlumno(alumnoId) : null;
  return { marca, alumno };
}
