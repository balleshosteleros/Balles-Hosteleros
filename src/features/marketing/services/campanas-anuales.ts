/**
 * Siembra el calendario anual de campañas de email en una empresa.
 *
 * Coge los doce meses del seed canónico (`lib/seeds/campanas-anuales`) y los
 * convierte en doce campañas reales de esa empresa: con SU color, SU isotipo, SU
 * dominio de reservas y una foto de SU carta. El texto es el mismo para todas
 * —está escrito para cualquier restaurante—, pero el correo que sale por la
 * puerta es distinto en cada una porque la marca la pone la empresa.
 *
 * ADITIVO, como todos los seeds: solo crea los meses que aún no existen. Si el
 * cliente reescribió el correo de mayo, mayo no se toca nunca más.
 *
 * Se identifica cada campaña por `payload.claveSeed`, no por el nombre: el
 * cliente puede renombrarla en el listado y aun así no se duplicará.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CAMPANAS_ANUALES_SEED, type CampanaAnualSeed } from "@/lib/seeds/campanas-anuales";
import { renderCampanaEmail } from "@/lib/email/marketing/plantilla-campana";
import { buildReservaUrl } from "@/features/sala/data/reserva-links";
import type { MarcaEmpresa } from "@/lib/email/reservas/estilo";

export type Admin = SupabaseClient;

/** Lo que se sortea cada mes. Tres cenas para dos, a los tres primeros. */
export const PREMIO_CONCURSO = "una cena para dos";

export interface EmpresaMarca extends MarcaEmpresa {
  id: string;
  slug: string;
}

/**
 * Dominio propio verificado de la empresa, para que el botón de reservar lleve a
 * `bacanalmadrid.com` y no al dominio del software. Mismo criterio que
 * `dominioPublicoDeEmpresa`, resuelto aquí con el cliente admin que ya tenemos.
 */
export async function dominioPropioDeEmpresa(admin: Admin, empresaId: string): Promise<string | null> {
  const { data } = await admin
    .from("paginas_web_dominios")
    .select("hostname")
    .eq("empresa_id", empresaId)
    .eq("estado", "VERIFICADO")
    .eq("ssl_activo", true);

  const propios = (data ?? [])
    .map((d) => String(d.hostname ?? "").trim().toLowerCase())
    .filter(Boolean)
    .filter((h) => !h.endsWith(".balleshosteleros.com"));
  if (!propios.length) return null;

  const sinWww = propios.find((h) => !h.startsWith("www."));
  return `https://${sinWww ?? propios[0]}`;
}

/**
 * Elige la foto del mes dentro de la carta de la empresa.
 *
 * Tres reglas, por orden:
 *  1. Se prueban las pistas del mes en orden —"torrija" antes que "ensaladilla"
 *     en el correo de Semana Santa— y gana la primera que exista.
 *  2. No se repite una foto ya usada por otro mes. Un calendario en el que cinco
 *     correos enseñan el mismo plato se lee como plantilla rellenada, que es
 *     justo lo que queremos evitar.
 *  3. Si ninguna pista aparece, se coge cualquier plato con foto que no sea
 *     bebida embotellada, shisha ni vaper —una foto de una botella de ginebra no
 *     vende una cena— y se descartan las versiones "sin alcohol", que son la
 *     misma copa fotografiada dos veces.
 *
 * Si la empresa no tiene ninguna foto se devuelve `null`: el correo sale sin
 * imagen, nunca con un hueco roto.
 */
export async function fotoDeLaCarta(
  admin: Admin,
  empresaId: string,
  pistas: string[],
  yaUsadas: Set<string>,
): Promise<{ url: string; alt: string } | null> {
  const { data } = await admin
    .from("carta_items")
    .select("nombre, foto_url")
    .eq("empresa_id", empresaId)
    .not("foto_url", "is", null);

  const items = (data ?? [])
    .map((r) => ({ nombre: String(r.nombre ?? ""), url: String(r.foto_url ?? "") }))
    .filter((i) => i.url.startsWith("http"))
    .filter((i) => !/bottle-|shisha-|vaper-/.test(i.url))
    .filter((i) => !/\bsin\b/i.test(i.nombre));
  if (!items.length) return null;

  const libres = items.filter((i) => !yaUsadas.has(i.url));
  const donde = libres.length ? libres : items;

  for (const pista of pistas) {
    const p = pista.toLowerCase();
    const hit = donde.find((i) => i.nombre.toLowerCase().includes(p));
    if (hit) return { url: hit.url, alt: hit.nombre };
  }
  return { url: donde[0].url, alt: donde[0].nombre };
}

/**
 * Enlace de reserva propio de cada mes. Uno por campaña —EMAIL_ENERO,
 * EMAIL_FEBRERO…— para poder mirar en enero cuántas mesas trajo el correo de
 * enero. Sin un enlace por mes, todas las reservas caerían en el mismo saco y el
 * calendario no se podría evaluar.
 */
export async function enlaceReservaConPalabra(
  admin: Admin,
  empresa: EmpresaMarca,
  palabraClave: string,
  dominio: string | null,
): Promise<{ id: string; url: string }> {
  const { data: existente } = await admin
    .from("reserva_links")
    .select("id, url_generada")
    .eq("empresa_id", empresa.id)
    .eq("palabra_clave", palabraClave)
    .maybeSingle();

  if (existente) {
    return { id: existente.id as string, url: existente.url_generada as string };
  }

  const url = buildReservaUrl(empresa.slug, palabraClave, dominio);
  const { data: creado, error } = await admin
    .from("reserva_links")
    .insert({
      empresa_id: empresa.id,
      palabra_clave: palabraClave,
      url_generada: url,
      activo: true,
      nombre: `Campaña de email · ${palabraClave.replace("EMAIL_", "").toLowerCase()}`,
    })
    .select("id, url_generada")
    .single();
  if (error) throw error;
  return { id: creado.id as string, url: creado.url_generada as string };
}

/**
 * URL del concurso del mes. Es la misma landing para los doce; el mes lo dice la
 * campaña que la abre, para no obligar al cliente a recordar en qué mes está.
 */
function urlConcurso(clave: string, dominio: string | null, slug: string): string {
  const base =
    dominio ??
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com").replace(/\/$/, "");
  const ruta = dominio ? "/concurso" : `/concurso/${slug}`;
  return `${base}${ruta}/${clave.toLowerCase()}`;
}

/** Enlace de baja. El token real lo firma el envío; aquí queda el marcador. */
export function urlBajaDeEmpresa(dominio: string | null, slug: string): string {
  const base =
    dominio ??
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com").replace(/\/$/, "");
  return dominio ? `${base}/baja/{{TOKEN_BAJA}}` : `${base}/baja/${slug}/{{TOKEN_BAJA}}`;
}

/** Monta el HTML de un mes con la marca de la empresa. */
export async function construirCorreoDelMes(
  admin: Admin,
  empresa: EmpresaMarca,
  seed: CampanaAnualSeed,
  dominio: string | null,
  fotosUsadas: Set<string> = new Set(),
): Promise<{ html: string; ctaUrl: string; reservaLinkId: string; fotoUrl: string | null }> {
  const foto = await fotoDeLaCarta(admin, empresa.id, seed.fotoPistas, fotosUsadas);
  if (foto) fotosUsadas.add(foto.url);
  const enlace = await enlaceReservaConPalabra(admin, empresa, seed.palabraClave, dominio);

  const html = renderCampanaEmail({
    empresa,
    badge: seed.badge,
    titular: seed.titular,
    subtitulo: seed.subtitulo,
    entradilla: seed.entradilla,
    cuerpo: seed.cuerpo,
    fotoUrl: foto?.url ?? null,
    fotoAlt: foto?.alt,
    ctaTexto: seed.ctaTexto,
    ctaUrl: enlace.url,
    concursoPremio: PREMIO_CONCURSO,
    concursoUrl: urlConcurso(seed.clave, dominio, empresa.slug),
    urlBaja: urlBajaDeEmpresa(dominio, empresa.slug),
  });

  return { html, ctaUrl: enlace.url, reservaLinkId: enlace.id, fotoUrl: foto?.url ?? null };
}

/**
 * Marca de la empresa: color, isotipo y slug. La campaña es la misma para todas,
 * pero el correo que sale por la puerta tiene que ser el de ESTE restaurante.
 */
export async function cargarEmpresaMarca(
  admin: Admin,
  empresaId: string,
): Promise<EmpresaMarca | null> {
  const { data: emp } = await admin
    .from("empresas")
    .select("id, nombre, slug, color, color_secundario, logo_url, isotipo_url")
    .eq("id", empresaId)
    .maybeSingle();
  if (!emp) return null;
  return {
    id: emp.id as string,
    slug: (emp.slug as string) ?? "",
    nombre: (emp.nombre as string) ?? "",
    color: (emp.color as string | null) ?? null,
    color_secundario: (emp.color_secundario as string | null) ?? null,
    logo_url: (emp.logo_url as string | null) ?? null,
    isotipo_url: (emp.isotipo_url as string | null) ?? null,
  };
}

/**
 * Siembra los doce meses en una empresa. Devuelve cuántos se crearon.
 * Las campañas quedan en BORRADOR: nadie envía nada hasta que un humano lo diga.
 */
export async function sembrarCampanasAnualesAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creadas: number }> {
  const empresa = await cargarEmpresaMarca(admin, empresaId);
  if (!empresa) return { creadas: 0 };

  const { data: existentes } = await admin
    .from("campanas_marketing")
    .select("payload, media_urls")
    .eq("empresa_id", empresaId)
    .eq("canal", "email");
  const yaSembradas = new Set(
    (existentes ?? [])
      .map((r) => (r.payload as Record<string, unknown> | null)?.claveSeed)
      .filter(Boolean) as string[],
  );

  const dominio = await dominioPropioDeEmpresa(admin, empresaId);
  const filas: Record<string, unknown>[] = [];
  // Memoria de fotos ya repartidas, para que ningún mes repita la del anterior.
  const fotosUsadas = new Set<string>(
    (existentes ?? []).flatMap((r) => ((r.media_urls as string[] | null) ?? [])),
  );

  for (const seed of CAMPANAS_ANUALES_SEED) {
    if (yaSembradas.has(seed.clave)) continue;
    const correo = await construirCorreoDelMes(admin, empresa, seed, dominio, fotosUsadas);

    filas.push({
      empresa_id: empresaId,
      canal: "email",
      nombre: seed.nombre,
      estado: "borrador",
      segmento: "todos",
      reserva_link_id: correo.reservaLinkId,
      // Un envío al mes, el día 1 a las 11:00. La hora exacta la decide quien
      // lo envía: el día sorpresa del concurso es parte del juego.
      recurrencia_cron: `0 11 1 ${seed.mes} *`,
      segmento_json: { operador: "AND", condiciones: [] },
      media_urls: correo.fotoUrl ? [correo.fotoUrl] : [],
      payload: {
        claveSeed: seed.clave,
        mes: seed.mes,
        asunto: seed.asunto,
        preheader: seed.preheader,
        remitenteNombre: empresa.nombre,
        remitenteEmail: "",
        cuerpoHtml: correo.html,
      },
    });
  }

  if (!filas.length) return { creadas: 0 };
  const { error } = await admin.from("campanas_marketing").insert(filas);
  if (error) throw error;
  return { creadas: filas.length };
}
