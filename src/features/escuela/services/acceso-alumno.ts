import "server-only";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { compararCodigo, generarCodigoAcceso, hashCodigo } from "../lib/sesion-alumno";
import { getMarcaEscuela } from "./portal-alumno";

/**
 * Acceso del alumno: código de un solo uso enviado a su correo.
 *
 * Sin contraseñas. El alumno escribe su correo, recibe seis cifras y entra —
 * que es lo más sencillo que puede pedírsele a alguien que entra a ver una
 * clase. Nunca se le dice si el correo existe o no: quien pregunta por un correo
 * ajeno recibe siempre la misma respuesta.
 */

/** Ventana del código. Corta a propósito: es una llave, no un enlace. */
const MINUTOS_VALIDEZ = 15;
/** Intentos antes de invalidar el código. */
const MAX_INTENTOS = 5;

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function buscarAlumnoPorEmail(email: string) {
  const marca = await getMarcaEscuela();
  if (!marca) return null;
  const { data } = await db()
    .from("escuela_alumnos")
    .select("id, nombre, email, estado")
    .eq("empresa_id", marca.empresaId)
    .ilike("email", email.trim())
    .maybeSingle();
  if (!data || data.estado !== "ACTIVO") return null;
  return { id: data.id as string, nombre: (data.nombre as string) ?? "", email: data.email as string, marca };
}

/** Envía el código. Devuelve siempre lo mismo, exista o no el alumno. */
export async function enviarCodigo(email: string): Promise<void> {
  const alumno = await buscarAlumnoPorEmail(email);
  if (!alumno) return;

  const codigo = generarCodigoAcceso();
  const expira = new Date(Date.now() + MINUTOS_VALIDEZ * 60 * 1000).toISOString();

  const supa = db();
  // Un código nuevo anula los anteriores: si no, quedarían varias llaves vivas.
  await supa.from("escuela_accesos").delete().eq("alumno_id", alumno.id).is("usado_at", null);
  await supa.from("escuela_accesos").insert({
    alumno_id: alumno.id,
    codigo_hash: hashCodigo(alumno.id, codigo),
    expira_en: expira,
  });

  const color = alumno.marca.color;
  await sendEmail({
    to: alumno.email,
    subject: `Tu código para entrar: ${codigo}`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#111">
        <p>Hola${alumno.nombre ? ` ${alumno.nombre}` : ""},</p>
        <p>Este es tu código para entrar en la escuela:</p>
        <p style="font-size:34px;font-weight:700;letter-spacing:8px;color:${color};margin:22px 0">${codigo}</p>
        <p style="color:#666;font-size:13px">Caduca en ${MINUTOS_VALIDEZ} minutos. Si no lo has pedido tú, ignora este correo.</p>
      </div>`,
    text: `Tu código para entrar en la escuela: ${codigo} (caduca en ${MINUTOS_VALIDEZ} minutos).`,
    empresaId: alumno.marca.empresaId,
  });
}

export type ResultadoCodigo = { ok: true; alumnoId: string } | { ok: false; error: string };

export async function comprobarCodigo(email: string, codigo: string): Promise<ResultadoCodigo> {
  const generico = { ok: false as const, error: "El código no es correcto o ha caducado." };
  const alumno = await buscarAlumnoPorEmail(email);
  if (!alumno) return generico;

  const supa = db();
  const { data: acceso } = await supa
    .from("escuela_accesos")
    .select("id, codigo_hash, expira_en, usado_at, intentos")
    .eq("alumno_id", alumno.id)
    .is("usado_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!acceso) return generico;

  if (new Date(acceso.expira_en as string).getTime() < Date.now()) return generico;
  if ((acceso.intentos as number) >= MAX_INTENTOS) return generico;

  if (!compararCodigo(alumno.id, codigo.trim(), acceso.codigo_hash as string)) {
    await supa
      .from("escuela_accesos")
      .update({ intentos: (acceso.intentos as number) + 1 })
      .eq("id", acceso.id as string);
    return generico;
  }

  await supa
    .from("escuela_accesos")
    .update({ usado_at: new Date().toISOString() })
    .eq("id", acceso.id as string);
  return { ok: true, alumnoId: alumno.id };
}

/**
 * Entrada desde DENTRO del software, sin claves.
 *
 * Quien ya ha entrado en el software con su usuario no tiene por qué volver a
 * identificarse para ver un curso: se le reconoce por el correo de su usuario.
 * Si aún no era alumno, se le da de alta en ese momento — la escuela va incluida
 * con el software, así que no hay nada que autorizar.
 */
export async function alumnoDesdeUsuario(input: {
  email: string;
  nombre?: string | null;
  userId: string;
  empresaClienteId?: string | null;
}): Promise<string | null> {
  const marca = await getMarcaEscuela();
  if (!marca) return null;
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const supa = db();
  const { data: existente } = await supa
    .from("escuela_alumnos")
    .select("id, estado")
    .eq("empresa_id", marca.empresaId)
    .ilike("email", email)
    .maybeSingle();

  if (existente) {
    if (existente.estado !== "ACTIVO") return null;
    // Se guarda el usuario con el que ha entrado para poder cruzarlo después.
    await supa.from("escuela_alumnos").update({ usuario_id: input.userId }).eq("id", existente.id as string);
    return existente.id as string;
  }

  const { data: creado, error } = await supa
    .from("escuela_alumnos")
    .insert({
      empresa_id: marca.empresaId,
      email,
      nombre: input.nombre ?? "",
      empresa_cliente_id: input.empresaClienteId ?? null,
      usuario_id: input.userId,
      origen: "DESDE_EL_SOFTWARE",
    })
    .select("id")
    .single();
  if (error) return null;
  return creado?.id as string;
}
