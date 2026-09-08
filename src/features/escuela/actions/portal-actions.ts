"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { comprobarCodigo, enviarCodigo } from "../services/acceso-alumno";
import { crearSesionAlumno, cerrarSesionAlumno, leerSesionAlumno } from "../lib/sesion-alumno";
import { getAlumno, marcarLeccion, registrarAcceso } from "../services/portal-alumno";

/**
 * Acciones del PORTAL DEL ALUMNO (lado público, sin sesión de Supabase).
 *
 * Son las tres únicas cosas que el alumno puede hacer: pedir su código, entrar
 * con él y marcar una lección como vista. Todo lo demás es lectura.
 */

const esquemaEmail = z.object({ email: z.string().trim().toLowerCase().email() });

export async function pedirCodigo(email: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = esquemaEmail.safeParse({ email });
  if (!parsed.success) return { ok: false, error: "Escribe un correo válido." };
  await enviarCodigo(parsed.data.email);
  // Respuesta idéntica exista o no el alumno: el portal no confirma correos.
  return { ok: true };
}

export async function entrarConCodigo(
  email: string,
  codigo: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = esquemaEmail.safeParse({ email });
  if (!parsed.success) return { ok: false, error: "Escribe un correo válido." };
  if (!/^\d{6}$/.test(codigo.trim())) return { ok: false, error: "El código son seis cifras." };

  const res = await comprobarCodigo(parsed.data.email, codigo);
  if (!res.ok) return { ok: false, error: res.error };

  await crearSesionAlumno(res.alumnoId);
  await registrarAcceso(res.alumnoId);
  return { ok: true };
}

export async function salirDeLaEscuela(): Promise<void> {
  await cerrarSesionAlumno();
  redirect("/escuela");
}

export async function marcarLeccionVista(
  leccionId: string,
  completada: boolean,
): Promise<{ ok: boolean }> {
  const alumnoId = await leerSesionAlumno();
  if (!alumnoId) return { ok: false };
  const alumno = await getAlumno(alumnoId);
  if (!alumno) return { ok: false };
  const ok = await marcarLeccion(alumno, leccionId, completada);
  if (ok) revalidatePath("/escuela", "layout");
  return { ok };
}
