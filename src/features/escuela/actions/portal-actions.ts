"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  alumnoIdPorCualquierCorreo,
  comprobarCodigo,
  enviarCodigo,
} from "../services/acceso-alumno";
import { identidadDesdeTokenGoogle } from "../services/acceso-google";
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

/**
 * Entrar con la cuenta de Google, como se entraba en el portal de antes.
 *
 * Google prueba quién es; nosotros solo miramos si ese correo está dado de alta
 * como alumno. Aquí SÍ se dice claramente que no lo está: quien llega ya ha
 * demostrado que el correo es suyo, así que no se le descubre nada y, si no, se
 * queda mirando una pantalla que no reacciona.
 *
 * Nadie se da de alta solo, tampoco por aquí.
 */
export async function entrarConGoogle(
  token: string,
  nonce: string,
): Promise<{ ok: boolean; error?: string }> {
  const identidad = await identidadDesdeTokenGoogle(token, nonce);
  if (!identidad) return { ok: false, error: "No se pudo comprobar tu cuenta de Google." };

  const alumno = await alumnoIdPorCualquierCorreo(identidad.email);
  if (!alumno) {
    return {
      ok: false,
      error: `${identidad.email} no está dado de alta en la escuela. Prueba con el otro correo o escríbenos.`,
    };
  }
  if (!alumno.activo) return { ok: false, error: "Tu acceso está desactivado." };

  await crearSesionAlumno(alumno.id);
  await registrarAcceso(alumno.id);
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
