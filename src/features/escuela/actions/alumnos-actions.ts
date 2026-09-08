"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { getSiteUrl } from "@/lib/site-url";
import { sendEmail } from "@/lib/email/send";
import type { AlumnoEscuela } from "../types";

/**
 * ALUMNOS de la escuela: alta, baja, matrícula y correo de bienvenida.
 *
 * Nadie se registra solo: el alta la hace BALLES desde PRODUCTO → ESCUELA. Por
 * eso aquí no hay ningún registro público, solo gestión desde dentro.
 */

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const empresaId = user ? await getEmpresaActivaForUser(supabase, user.id) : null;
  return { supabase, userId: user?.id ?? null, empresaId };
}

type AlumnoRow = {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  empresa_cliente_id: string | null;
  acceso_total: boolean;
  estado: string;
  origen: string;
  ultimo_acceso_at: string | null;
  created_at: string;
};

export async function listAlumnos(): Promise<{ ok: boolean; data: AlumnoEscuela[]; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: true, data: [] };

    const [alumnosR, matriculasR, progresoR, empresasR] = await Promise.all([
      supabase
        .from("escuela_alumnos")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false }),
      supabase.from("escuela_matriculas").select("alumno_id, curso_id").eq("empresa_id", empresaId),
      supabase.from("escuela_progreso").select("alumno_id").eq("empresa_id", empresaId),
      supabase.from("empresas").select("id, nombre"),
    ]);

    const matriculas = new Map<string, string[]>();
    for (const m of (matriculasR.data ?? []) as { alumno_id: string; curso_id: string }[]) {
      matriculas.set(m.alumno_id, [...(matriculas.get(m.alumno_id) ?? []), m.curso_id]);
    }
    const completadas = new Map<string, number>();
    for (const p of (progresoR.data ?? []) as { alumno_id: string }[]) {
      completadas.set(p.alumno_id, (completadas.get(p.alumno_id) ?? 0) + 1);
    }
    const nombreEmpresa = new Map(
      ((empresasR.data ?? []) as { id: string; nombre: string }[]).map((e) => [e.id, e.nombre]),
    );

    const data = ((alumnosR.data ?? []) as AlumnoRow[]).map((r) => ({
      id: r.id,
      email: r.email,
      nombre: r.nombre ?? "",
      telefono: r.telefono ?? undefined,
      empresaClienteId: r.empresa_cliente_id ?? undefined,
      empresaClienteNombre: r.empresa_cliente_id
        ? nombreEmpresa.get(r.empresa_cliente_id) ?? undefined
        : undefined,
      accesoTotal: r.acceso_total ?? true,
      estado: (r.estado as AlumnoEscuela["estado"]) ?? "ACTIVO",
      origen: r.origen ?? "ALTA_MANUAL",
      ultimoAccesoAt: r.ultimo_acceso_at ?? undefined,
      createdAt: r.created_at,
      cursosMatriculados: matriculas.get(r.id) ?? [],
      leccionesCompletadas: completadas.get(r.id) ?? 0,
    }));
    return { ok: true, data };
  } catch (e) {
    console.error("[escuela] listAlumnos:", e);
    return { ok: false, data: [], error: friendlyError(e, "listAlumnos") };
  }
}

const esquemaAlumno = z.object({
  nombre: z.string().trim().min(1, "El alumno necesita un nombre").max(200),
  email: z.string().trim().toLowerCase().email("El correo no es válido"),
  telefono: z.string().trim().max(40).optional().or(z.literal("")),
  empresaClienteId: z.string().uuid().optional().or(z.literal("")),
  accesoTotal: z.boolean().default(true),
  estado: z.enum(["ACTIVO", "INACTIVO"]).default("ACTIVO"),
});

export type EntradaAlumno = z.input<typeof esquemaAlumno>;

export async function crearAlumno(
  entrada: EntradaAlumno,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const parsed = esquemaAlumno.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  try {
    const { supabase, empresaId, userId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const v = parsed.data;
    const { data, error } = await supabase
      .from("escuela_alumnos")
      .insert({
        empresa_id: empresaId,
        nombre: v.nombre,
        email: v.email,
        telefono: v.telefono || null,
        empresa_cliente_id: v.empresaClienteId || null,
        acceso_total: v.accesoTotal,
        estado: v.estado,
        origen: "ALTA_MANUAL",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) {
      // El índice único por correo es la protección real contra el alta doble.
      if ((error as { code?: string }).code === "23505") {
        return { ok: false, error: "Ya hay un alumno con ese correo." };
      }
      throw error;
    }
    return { ok: true, id: data?.id as string };
  } catch (e) {
    console.error("[escuela] crearAlumno:", e);
    return { ok: false, error: friendlyError(e, "crearAlumno") };
  }
}

export async function actualizarAlumno(
  id: string,
  entrada: EntradaAlumno,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = esquemaAlumno.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const v = parsed.data;
    const { error } = await supabase
      .from("escuela_alumnos")
      .update({
        nombre: v.nombre,
        email: v.email,
        telefono: v.telefono || null,
        empresa_cliente_id: v.empresaClienteId || null,
        acceso_total: v.accesoTotal,
        estado: v.estado,
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("[escuela] actualizarAlumno:", e);
    return { ok: false, error: friendlyError(e, "actualizarAlumno") };
  }
}

export async function borrarAlumno(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("escuela_alumnos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("[escuela] borrarAlumno:", e);
    return { ok: false, error: friendlyError(e, "borrarAlumno") };
  }
}

/** Matrícula fina: solo cuenta para los alumnos SIN acceso total. */
export async function guardarMatriculas(
  alumnoId: string,
  cursoIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error: errBorrar } = await supabase
      .from("escuela_matriculas")
      .delete()
      .eq("alumno_id", alumnoId)
      .eq("empresa_id", empresaId);
    if (errBorrar) throw errBorrar;
    if (cursoIds.length) {
      const { error } = await supabase.from("escuela_matriculas").insert(
        cursoIds.map((curso_id) => ({ empresa_id: empresaId, alumno_id: alumnoId, curso_id })),
      );
      if (error) throw error;
    }
    return { ok: true };
  } catch (e) {
    console.error("[escuela] guardarMatriculas:", e);
    return { ok: false, error: friendlyError(e, "guardarMatriculas") };
  }
}

/**
 * Correo de bienvenida con el enlace del portal.
 *
 * No lleva contraseña ni código dentro: el alumno entra escribiendo su correo y
 * recibiendo un código en el momento. Así el correo de bienvenida no caduca ni
 * sirve de llave si alguien lo reenvía.
 */
export async function enviarBienvenida(
  alumnoId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { data: alumno } = await supabase
      .from("escuela_alumnos")
      .select("email, nombre, estado")
      .eq("id", alumnoId)
      .eq("empresa_id", empresaId)
      .single();
    if (!alumno) return { ok: false, error: "Alumno no encontrado" };
    if (alumno.estado !== "ACTIVO") return { ok: false, error: "El alumno está inactivo." };

    const admin = createAdminClient();
    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre, color")
      .eq("id", empresaId)
      .single();

    const url = `${getSiteUrl()}/escuela`;
    const color = (empresa?.color as string) || "#1e3a8a";
    const nombre = (alumno.nombre as string) || "";
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#111">
        <p>Hola${nombre ? ` ${nombre}` : ""},</p>
        <p>Ya tienes acceso a la escuela de ${empresa?.nombre ?? "Balles Hosteleros"}.</p>
        <p>Entra con este botón y escribe tu correo (<strong>${alumno.email}</strong>): te llegará un código para acceder. No hay contraseñas que recordar.</p>
        <p style="margin:28px 0">
          <a href="${url}" style="background:${color};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;display:inline-block;font-weight:600">Entrar en la escuela</a>
        </p>
        <p style="color:#666;font-size:13px">Si el botón no funciona, copia esta dirección: ${url}</p>
      </div>`;
    const text = `Ya tienes acceso a la escuela. Entra en ${url} y escribe tu correo (${alumno.email}) para recibir el código de acceso.`;

    const res = await sendEmail({
      to: alumno.email as string,
      subject: `Tu acceso a la escuela de ${empresa?.nombre ?? "Balles Hosteleros"}`,
      html,
      text,
      empresaId,
    });
    if (!res.ok) return { ok: false, error: "No se pudo enviar el correo (revisa el SMTP)." };
    return { ok: true };
  } catch (e) {
    console.error("[escuela] enviarBienvenida:", e);
    return { ok: false, error: friendlyError(e, "enviarBienvenida") };
  }
}
