/**
 * Siembra de la CAMPAÑA DE CUMPLEAÑOS en una empresa.
 *
 * Deja cuatro campañas, en dos momentos:
 *
 *   **Diez días antes** — el aviso, en sus tres canales (correo, WhatsApp y
 *   SMS), con el descuento y su código personal. A cada persona le llega UNA
 *   sola vez, por el canal más directo que tenga permiso.
 *
 *   **El día** — la felicitación, solo por correo. No vende nada: felicidades y
 *   el botón de la web.
 *
 * Las cuatro nacen en BORRADOR: el motor diario solo mira las que alguien haya
 * puesto en marcha, así que sembrar no envía nada a nadie.
 *
 * ADITIVO, como todos los seeds: solo crea lo que aún no existe. Si el
 * restaurante reescribió su correo, no se toca nunca más. Para refrescar el
 * texto canónico de una campaña que aún no ha salido está
 * `refrescarTextosCumpleanos`.
 */
import "server-only";
import {
  CAMPANA_CUMPLEANOS_SEED,
  MARCADORES_CUMPLEANOS as M,
  type CampanaCumpleanosSeed,
} from "@/lib/seeds/campana-cumpleanos";
import { renderCampanaEmail } from "@/lib/email/marketing/plantilla-campana";
import {
  cargarEmpresaMarca,
  dominioPropioDeEmpresa,
  enlaceReservaConPalabra,
  urlConCampana,
  fotoDeLaCarta,
  urlBajaDeEmpresa,
  type Admin,
  type EmpresaMarca,
} from "./campanas-anuales";

/** Cron de la campaña: una pasada al día. La hora la fija `vercel.json`. */
const CRON_DIARIO = "0 8 * * *";

/** Lo que el motor necesita saber, guardado con la campaña. */
export interface ReglasCumpleanos {
  diasAntes: number;
  diasValidezDespues: number;
  descuentoPorcentaje: number;
  amigosParaGratis: number;
  /** Comensales para que la casa invite: los amigos MÁS quien cumple. */
  mesaParaGratis: number;
}

export function reglasDe(payload: Record<string, unknown> | null): ReglasCumpleanos {
  const s = CAMPANA_CUMPLEANOS_SEED;
  const p = payload ?? {};
  const num = (v: unknown, porDefecto: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : porDefecto;
  };
  const amigos = num(p.amigosParaGratis, s.amigosParaGratis);
  return {
    diasAntes: num(p.diasAntes, s.diasAntes),
    diasValidezDespues: num(p.diasValidezDespues, s.diasValidezDespues),
    descuentoPorcentaje: num(p.descuentoPorcentaje, s.descuentoPorcentaje),
    amigosParaGratis: amigos,
    mesaParaGratis: amigos + 1,
  };
}

/** La web pública de la empresa: su dominio propio, o su portal si no lo tiene. */
function urlWeb(dominio: string | null, slug: string): string {
  if (dominio) return dominio;
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com").replace(/\/$/, "");
  return `${base}/reservar/${slug}`;
}

/**
 * Palabra de la campaña de cumpleaños: `…/reservar/email?c=cumpleanos`.
 *
 * El canal es EMAIL como el resto de correos; esto solo dice que la mesa la
 * trajo el cumpleaños y no el correo del mes.
 */
export const PALABRA_CUMPLEANOS = "cumpleanos";

/**
 * El correo del AVISO, con la marca de la empresa y los marcadores dentro.
 *
 * El código del cupón NO se resuelve aquí: se guarda como `{{CODIGO}}` y lo
 * sustituye el motor el día que le toca a cada cliente. Así el texto se puede
 * editar en Marketing sin que el cupón deje de funcionar.
 */
export async function construirCorreoAviso(
  admin: Admin,
  empresa: EmpresaMarca,
  seed: CampanaCumpleanosSeed,
  dominio: string | null,
): Promise<{ html: string; reservaLinkId: string; fotoUrl: string | null }> {
  const foto = await fotoDeLaCarta(admin, empresa.id, seed.aviso.fotoPistas, new Set());
  const enlace = await enlaceReservaConPalabra(admin, empresa, seed.palabraClave, dominio, "Email");

  const html = renderCampanaEmail({
    empresa,
    badge: seed.aviso.badge,
    titular: seed.aviso.titular,
    subtitulo: seed.aviso.subtitulo,
    entradilla: seed.aviso.entradilla,
    cuerpo: seed.aviso.cuerpo,
    fotoUrl: foto?.url ?? null,
    fotoAlt: foto?.alt,
    ctaTexto: seed.aviso.ctaTexto,
    ctaUrl: urlConCampana(enlace.url, PALABRA_CUMPLEANOS),
    cupon: {
      codigo: M.codigo,
      concepto: `${M.descuento}% de descuento en tu mesa`,
      condiciones: `Un solo uso · ven con ${M.amigos} amigos y te invitamos`,
      caducidad: `Válido hasta el ${M.caducidad}`,
    },
    // El cumpleaños no lleva concurso: ya trae su propio regalo, y dos ganchos
    // en el mismo correo se hacen sombra.
    concursoPremio: null,
    concursoUrl: null,
    urlBaja: urlBajaDeEmpresa(dominio, empresa.slug),
  });

  return { html, reservaLinkId: enlace.id, fotoUrl: foto?.url ?? null };
}

/**
 * El correo del DÍA. Felicidades y nada más.
 *
 * Sin cupón, sin foto de plato y sin botón de reservar: el único enlace es la
 * web. Un cliente distingue perfectamente una felicitación de un anuncio
 * disfrazado de felicitación, y colar aquí una oferta quema la marca el día que
 * peor sienta.
 */
export function construirCorreoFelicitacion(
  empresa: EmpresaMarca,
  seed: CampanaCumpleanosSeed,
  dominio: string | null,
): string {
  return renderCampanaEmail({
    empresa,
    badge: seed.felicitacion.badge,
    titular: seed.felicitacion.titular,
    subtitulo: seed.felicitacion.subtitulo,
    entradilla: seed.felicitacion.entradilla,
    cuerpo: seed.felicitacion.cuerpo,
    fotoUrl: null,
    ctaTexto: seed.felicitacion.ctaTexto,
    ctaUrl: urlWeb(dominio, empresa.slug),
    cupon: null,
    concursoPremio: null,
    concursoUrl: null,
    urlBaja: urlBajaDeEmpresa(dominio, empresa.slug),
    // Ni un "te esperamos": hoy no se le pide que venga.
    pie: "Felicidades.",
  });
}

/** El payload de cada canal, ya con las reglas dentro. */
function payloads(
  seed: CampanaCumpleanosSeed,
  reglas: ReglasCumpleanos,
  empresaNombre: string,
  htmlAviso: string,
  htmlFelicitacion: string,
) {
  const sello = { ...reglas, claveSeed: seed.clave };
  return {
    email: {
      ...sello,
      asunto: seed.aviso.asunto,
      preheader: seed.aviso.preheader,
      remitenteNombre: empresaNombre,
      remitenteEmail: "",
      cuerpoHtml: htmlAviso,
    },
    whatsapp: {
      ...sello,
      plantilla: seed.whatsapp.plantilla,
      idioma: seed.whatsapp.idioma,
      cuerpo: seed.whatsapp.cuerpo,
      variables: {},
    },
    sms: { ...sello, cuerpo: seed.sms.cuerpo, remitente: "" },
    felicitacion: {
      ...reglas,
      claveSeed: seed.claveFelicitacion,
      asunto: seed.felicitacion.asunto,
      preheader: seed.felicitacion.preheader,
      remitenteNombre: empresaNombre,
      remitenteEmail: "",
      cuerpoHtml: htmlFelicitacion,
    },
  };
}

/** Segmento que describe a quién alcanza cada momento. */
function segmentoDe(dias: number) {
  return {
    operador: "AND",
    condiciones: [{ tipo: "cumple_en_dias", dias }],
    soloConPermiso: true,
  };
}

/** Siembra los dos momentos en una empresa. Devuelve cuántas campañas creó. */
export async function sembrarCampanaCumpleanosAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creadas: number }> {
  const empresa = await cargarEmpresaMarca(admin, empresaId);
  if (!empresa) return { creadas: 0 };

  const seed = CAMPANA_CUMPLEANOS_SEED;
  const reglas = reglasDe(null);

  const { data: existentes } = await admin
    .from("campanas_marketing")
    .select("canal, payload")
    .eq("empresa_id", empresaId)
    .in("canal", ["email", "whatsapp", "sms"]);

  // Se mira canal a canal y momento a momento: si alguien borró la de SMS pero
  // conserva la de correo, se repone solo la que falta.
  const yaSembrados = new Set(
    (existentes ?? [])
      .map((r) => {
        const clave = (r.payload as Record<string, unknown> | null)?.claveSeed;
        return clave === seed.clave || clave === seed.claveFelicitacion
          ? `${clave}:${r.canal}`
          : null;
      })
      .filter(Boolean) as string[],
  );
  if (yaSembrados.size === 4) return { creadas: 0 };

  const dominio = await dominioPropioDeEmpresa(admin, empresaId);
  const aviso = await construirCorreoAviso(admin, empresa, seed, dominio);
  const felicitacion = construirCorreoFelicitacion(empresa, seed, dominio);
  const p = payloads(seed, reglas, empresa.nombre, aviso.html, felicitacion);

  const comun = {
    empresa_id: empresaId,
    estado: "borrador",
    recurrencia_cron: CRON_DIARIO,
  };

  const filas: Record<string, unknown>[] = [];

  if (!yaSembrados.has(`${seed.clave}:email`)) {
    filas.push({
      ...comun,
      canal: "email",
      nombre: seed.aviso.nombre,
      reserva_link_id: aviso.reservaLinkId,
      palabra: PALABRA_CUMPLEANOS,
      segmento_json: segmentoDe(reglas.diasAntes),
      media_urls: aviso.fotoUrl ? [aviso.fotoUrl] : [],
      payload: p.email,
    });
  }
  if (!yaSembrados.has(`${seed.clave}:whatsapp`)) {
    filas.push({
      ...comun,
      canal: "whatsapp",
      nombre: seed.whatsapp.nombre,
      reserva_link_id: aviso.reservaLinkId,
      segmento_json: segmentoDe(reglas.diasAntes),
      media_urls: [],
      payload: p.whatsapp,
    });
  }
  if (!yaSembrados.has(`${seed.clave}:sms`)) {
    filas.push({
      ...comun,
      canal: "sms",
      nombre: seed.sms.nombre,
      reserva_link_id: aviso.reservaLinkId,
      segmento_json: segmentoDe(reglas.diasAntes),
      media_urls: [],
      payload: p.sms,
    });
  }
  if (!yaSembrados.has(`${seed.claveFelicitacion}:email`)) {
    filas.push({
      ...comun,
      canal: "email",
      nombre: seed.felicitacion.nombre,
      // La felicitación no lleva enlace de reserva: no pide mesa, así que no hay
      // nada que atribuir.
      reserva_link_id: null,
      segmento_json: segmentoDe(0),
      media_urls: [],
      payload: p.felicitacion,
    });
  }

  if (!filas.length) return { creadas: 0 };
  const { error } = await admin.from("campanas_marketing").insert(filas);
  if (error) throw error;
  return { creadas: filas.length };
}

/**
 * Reescribe el texto canónico de las campañas de cumpleaños de una empresa.
 *
 * Solo toca las que NUNCA han salido (`ultima_ejecucion` vacía): una campaña que
 * ya escribió a alguien es historia y no se reescribe. Se usa cuando cambia el
 * seed —otro texto, otro descuento, otra antelación— y las campañas sembradas
 * antes se quedarían con la versión vieja para siempre.
 */
export async function refrescarTextosCumpleanos(
  admin: Admin,
  empresaId: string,
): Promise<{ actualizadas: number }> {
  const empresa = await cargarEmpresaMarca(admin, empresaId);
  if (!empresa) return { actualizadas: 0 };

  const seed = CAMPANA_CUMPLEANOS_SEED;
  const reglas = reglasDe(null);
  const dominio = await dominioPropioDeEmpresa(admin, empresaId);
  const aviso = await construirCorreoAviso(admin, empresa, seed, dominio);
  const felicitacion = construirCorreoFelicitacion(empresa, seed, dominio);
  const p = payloads(seed, reglas, empresa.nombre, aviso.html, felicitacion);

  const { data: filas } = await admin
    .from("campanas_marketing")
    .select("id, canal, payload, ultima_ejecucion")
    .eq("empresa_id", empresaId)
    .is("ultima_ejecucion", null);

  let actualizadas = 0;
  for (const fila of filas ?? []) {
    const clave = (fila.payload as Record<string, unknown> | null)?.claveSeed;
    const canal = fila.canal as string;

    let payload: Record<string, unknown> | null = null;
    let nombre = "";
    let segmento = segmentoDe(reglas.diasAntes);
    let reservaLinkId: string | null = aviso.reservaLinkId;

    if (clave === seed.clave && canal === "email") {
      payload = p.email;
      nombre = seed.aviso.nombre;
    } else if (clave === seed.clave && canal === "whatsapp") {
      payload = p.whatsapp;
      nombre = seed.whatsapp.nombre;
    } else if (clave === seed.clave && canal === "sms") {
      payload = p.sms;
      nombre = seed.sms.nombre;
    } else if (clave === seed.claveFelicitacion && canal === "email") {
      payload = p.felicitacion;
      nombre = seed.felicitacion.nombre;
      segmento = segmentoDe(0);
      reservaLinkId = null;
    }
    if (!payload) continue;

    await admin
      .from("campanas_marketing")
      .update({
        nombre,
        payload,
        segmento_json: segmento,
        reserva_link_id: reservaLinkId,
        media_urls: clave === seed.clave && canal === "email" && aviso.fotoUrl ? [aviso.fotoUrl] : [],
        recurrencia_cron: CRON_DIARIO,
      })
      .eq("id", fila.id as string);
    actualizadas++;
  }

  return { actualizadas };
}
