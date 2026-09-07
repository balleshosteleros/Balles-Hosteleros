/**
 * El concurso del mes: abrir la edición, corregir y repartir las tres plazas.
 *
 * Todo vive en el servidor. La landing nunca ve la respuesta correcta —solo los
 * enunciados y las opciones—, manda lo que ha marcado el cliente y recibe de
 * vuelta cuántas acertó y si ha llegado a tiempo. Corregir en el navegador sería
 * regalar el premio a quien abra la consola.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarPreguntasDeLaCarta } from "./concurso-preguntas";
import { PREMIO_CONCURSO } from "./campanas-anuales";
import { enviarCorreoPremio } from "@/lib/email/marketing/premio-concurso";

type Admin = SupabaseClient;

export interface PreguntaPublica {
  orden: number;
  enunciado: string;
  opciones: string[];
}

export interface EdicionPublica {
  id: string;
  empresaId: string;
  empresaNombre: string;
  color: string | null;
  colorSecundario: string | null;
  isotipoUrl: string | null;
  logoUrl: string | null;
  clave: string;
  premio: string;
  plazas: number;
  /** Plazas que quedan. 0 = ya no hay premio, pero se puede seguir jugando. */
  plazasLibres: number;
  abierta: boolean;
  preguntas: PreguntaPublica[];
}

/** Código del vale que se lleva el ganador. Corto, legible y dictable. */
function codigoPremio(): string {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

/**
 * Abre la edición del mes: la crea si no existe, le genera las preguntas de la
 * carta de ese día y la marca abierta.
 *
 * Se llama al enviar el correo del mes, no antes: hasta que el correo sale, la
 * edición existe cerrada y quien adivine la dirección no puede jugar.
 */
export async function abrirEdicion(
  admin: Admin,
  empresaId: string,
  clave: string,
  mes: number,
  opciones?: { premio?: string; plazas?: number; cierraEn?: Date },
): Promise<{ ok: true; edicionId: string } | { ok: false; error: string }> {
  const anio = new Date().getFullYear();

  const { data: existente } = await admin
    .from("concurso_ediciones")
    .select("id, abierta")
    .eq("empresa_id", empresaId)
    .eq("clave", clave)
    .eq("anio", anio)
    .maybeSingle();

  let edicionId = existente?.id as string | undefined;

  if (!edicionId) {
    const { data: creada, error } = await admin
      .from("concurso_ediciones")
      .insert({
        empresa_id: empresaId,
        clave,
        mes,
        anio,
        premio: opciones?.premio ?? PREMIO_CONCURSO,
        plazas: opciones?.plazas ?? 3,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    edicionId = creada.id as string;
  }

  // Las preguntas se generan una sola vez por edición: regenerarlas con gente ya
  // jugando cambiaría el examen a mitad de partida.
  const { count } = await admin
    .from("concurso_preguntas")
    .select("id", { count: "exact", head: true })
    .eq("edicion_id", edicionId);

  if (!count) {
    const preguntas = await generarPreguntasDeLaCarta(admin, empresaId);
    if (preguntas.length < 5) {
      return {
        ok: false,
        error: "La carta digital no tiene platos suficientes para montar las cinco preguntas",
      };
    }
    const { error } = await admin.from("concurso_preguntas").insert(
      preguntas.map((p) => ({
        edicion_id: edicionId,
        orden: p.orden,
        enunciado: p.enunciado,
        opciones: p.opciones,
        respuesta: p.respuesta,
      })),
    );
    if (error) return { ok: false, error: error.message };
  }

  const cierra =
    opciones?.cierraEn ?? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  const { error: errAbrir } = await admin
    .from("concurso_ediciones")
    .update({ abierta: true, abierta_en: new Date().toISOString(), cierra_en: cierra.toISOString() })
    .eq("id", edicionId);
  if (errAbrir) return { ok: false, error: errAbrir.message };

  return { ok: true, edicionId };
}

/** Lo que puede ver el navegador: enunciados y opciones, nunca la respuesta. */
export async function getEdicionPublica(
  empresaSlug: string,
  clave: string,
): Promise<EdicionPublica | null> {
  const admin = createAdminClient();

  const { data: empresa } = await admin
    .from("empresas")
    .select("id, nombre, color, color_secundario, isotipo_url, logo_url")
    .eq("slug", empresaSlug)
    .maybeSingle();
  if (!empresa) return null;

  const { data: edicion } = await admin
    .from("concurso_ediciones")
    .select("id, clave, premio, plazas, abierta, cierra_en")
    .eq("empresa_id", empresa.id)
    .eq("clave", clave.toUpperCase())
    .eq("anio", new Date().getFullYear())
    .maybeSingle();
  if (!edicion) return null;

  const { data: preguntas } = await admin
    .from("concurso_preguntas")
    .select("orden, enunciado, opciones")
    .eq("edicion_id", edicion.id)
    .order("orden");

  const { count: dadas } = await admin
    .from("concurso_participaciones")
    .select("id", { count: "exact", head: true })
    .eq("edicion_id", edicion.id)
    .not("posicion", "is", null);

  const cerradaPorFecha =
    !!edicion.cierra_en && new Date(edicion.cierra_en as string) < new Date();

  return {
    id: edicion.id as string,
    empresaId: empresa.id as string,
    empresaNombre: (empresa.nombre as string) ?? "",
    color: (empresa.color as string | null) ?? null,
    colorSecundario: (empresa.color_secundario as string | null) ?? null,
    isotipoUrl: (empresa.isotipo_url as string | null) ?? null,
    logoUrl: (empresa.logo_url as string | null) ?? null,
    clave: edicion.clave as string,
    premio: (edicion.premio as string) ?? PREMIO_CONCURSO,
    plazas: Number(edicion.plazas ?? 3),
    plazasLibres: Math.max(0, Number(edicion.plazas ?? 3) - (dadas ?? 0)),
    abierta: !!edicion.abierta && !cerradaPorFecha,
    preguntas: (preguntas ?? []).map((p) => ({
      orden: Number(p.orden),
      enunciado: String(p.enunciado),
      opciones: (p.opciones as string[]) ?? [],
    })),
  };
}

export type ResultadoParticipacion =
  | { ok: true; aciertos: number; total: number; pleno: boolean; posicion: number | null; codigo: string | null }
  | { ok: false; error: string; yaJugado?: boolean };

/**
 * Corrige el intento y, si es pleno, pelea por una de las plazas.
 *
 * El reparto lo hace `concurso_asignar_plaza` en la base de datos, con un
 * bloqueo por edición: dos personas que envían a la vez no pueden llevarse las
 * dos la misma plaza.
 */
export async function participar(input: {
  empresaSlug: string;
  clave: string;
  email: string;
  nombre?: string;
  telefono?: string;
  /** Índice marcado en cada pregunta, por orden de pregunta. */
  respuestas: Record<number, number>;
}): Promise<ResultadoParticipacion> {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();

  const edicion = await getEdicionPublica(input.empresaSlug, input.clave);
  if (!edicion) return { ok: false, error: "Este concurso no existe" };
  if (!edicion.abierta) return { ok: false, error: "Este concurso ya está cerrado" };

  const { data: yaJugo } = await admin
    .from("concurso_participaciones")
    .select("id")
    .eq("edicion_id", edicion.id)
    .eq("email", email)
    .maybeSingle();
  if (yaJugo) {
    return { ok: false, error: "Con este correo ya se ha jugado a este concurso", yaJugado: true };
  }

  const { data: correctas } = await admin
    .from("concurso_preguntas")
    .select("orden, respuesta")
    .eq("edicion_id", edicion.id);
  if (!correctas?.length) return { ok: false, error: "Este concurso no tiene preguntas" };

  let aciertos = 0;
  for (const p of correctas) {
    if (input.respuestas[Number(p.orden)] === Number(p.respuesta)) aciertos++;
  }
  const pleno = aciertos === correctas.length;

  // Si el correo es de un cliente nuestro, se enlaza: así el premio se ve luego
  // en su ficha y no hay que cruzarlo a mano.
  const { data: cliente } = await admin
    .from("clientes_sala")
    .select("id")
    .eq("empresa_id", edicion.empresaId)
    .ilike("email", email)
    .maybeSingle();

  const { data: participacion, error } = await admin
    .from("concurso_participaciones")
    .insert({
      edicion_id: edicion.id,
      empresa_id: edicion.empresaId,
      cliente_id: cliente?.id ?? null,
      email,
      nombre: input.nombre?.trim() || null,
      telefono: input.telefono?.trim() || null,
      aciertos,
      pleno,
    })
    .select("id")
    .single();
  if (error) {
    // La restricción única salta si dos pestañas envían a la vez.
    return { ok: false, error: "Con este correo ya se ha jugado a este concurso", yaJugado: true };
  }

  let posicion: number | null = null;
  let codigo: string | null = null;

  if (pleno) {
    const { data: plaza } = await admin.rpc("concurso_asignar_plaza", {
      p_participacion: participacion.id,
    });
    posicion = plaza == null ? null : Number(plaza);
    if (posicion) {
      codigo = codigoPremio();
      await admin
        .from("concurso_participaciones")
        .update({ codigo_premio: codigo })
        .eq("id", participacion.id);

      // El código ya se le enseña en pantalla; el correo es la copia que le
      // queda cuando cierra la pestaña. Si el envío falla, el premio sigue
      // siendo suyo: está guardado en su participación.
      try {
        await enviarCorreoPremio({
          empresaId: edicion.empresaId,
          email,
          nombre: input.nombre,
          premio: edicion.premio,
          codigo,
          posicion,
        });
      } catch (err) {
        console.error("[concurso] correo de premio:", err);
      }
    }
  }

  return { ok: true, aciertos, total: correctas.length, pleno, posicion, codigo };
}
