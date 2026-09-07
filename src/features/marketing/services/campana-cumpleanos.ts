/**
 * Siembra de la CAMPAÑA DE CUMPLEAÑOS en una empresa.
 *
 * Deja tres campañas —correo, WhatsApp y SMS— con el texto escrito para cada
 * canal, la marca de esta empresa y su enlace de reserva propio. Las tres nacen
 * en BORRADOR: el motor diario solo mira las que alguien haya puesto en marcha,
 * así que sembrar no envía nada a nadie.
 *
 * Son tres campañas y no una porque en Marketing cada canal tiene su pantalla y
 * su texto editable. Lo que NO son es tres mensajes: a cada cliente le llega uno
 * solo, y el motor elige por cuál (ver `cumpleanos-runner.ts`).
 *
 * ADITIVO, como todos los seeds: solo crea el canal que aún no existe. Si el
 * restaurante reescribió su correo de cumpleaños, no se toca nunca más.
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
  fotoDeLaCarta,
  urlBajaDeEmpresa,
  type Admin,
  type EmpresaMarca,
} from "./campanas-anuales";

/** Cron de la campaña: una pasada al día. La hora la fija `vercel.json`. */
const CRON_DIARIO = "0 8 * * *";

/** Lo que el motor necesita saber de la campaña, guardado con ella. */
export interface ReglasCumpleanos {
  diasAntes: number;
  diasValidezDespues: number;
  minimoPersonas: number;
}

export function reglasDe(payload: Record<string, unknown> | null): ReglasCumpleanos {
  const s = CAMPANA_CUMPLEANOS_SEED;
  const p = payload ?? {};
  const num = (v: unknown, porDefecto: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : porDefecto;
  };
  return {
    diasAntes: num(p.diasAntes, s.diasAntes),
    diasValidezDespues: num(p.diasValidezDespues, s.diasValidezDespues),
    minimoPersonas: num(p.minimoPersonas, s.minimoPersonas),
  };
}

/**
 * El correo de cumpleaños con la marca de la empresa y los marcadores dentro.
 *
 * El código del cupón NO se resuelve aquí: se guarda como `{{CODIGO}}` y lo
 * sustituye el motor el día que le toca a cada cliente. Así el texto se puede
 * editar en Marketing sin que el cupón deje de funcionar.
 */
export async function construirCorreoCumpleanos(
  admin: Admin,
  empresa: EmpresaMarca,
  seed: CampanaCumpleanosSeed,
  dominio: string | null,
): Promise<{ html: string; ctaUrl: string; reservaLinkId: string; fotoUrl: string | null }> {
  const foto = await fotoDeLaCarta(admin, empresa.id, seed.email.fotoPistas, new Set());
  const enlace = await enlaceReservaConPalabra(admin, empresa, seed.palabraClave, dominio);

  const html = renderCampanaEmail({
    empresa,
    badge: seed.email.badge,
    titular: seed.email.titular,
    subtitulo: seed.email.subtitulo,
    entradilla: seed.email.entradilla,
    cuerpo: seed.email.cuerpo,
    fotoUrl: foto?.url ?? null,
    fotoAlt: foto?.alt,
    ctaTexto: seed.email.ctaTexto,
    ctaUrl: enlace.url,
    cupon: {
      codigo: M.codigo,
      concepto: "Tu comida corre de nuestra cuenta",
      condiciones: `Mesa de ${M.minimo} personas contándote a ti · un solo uso`,
      caducidad: `Válido hasta el ${M.caducidad}`,
    },
    // El cumpleaños no lleva concurso: ya trae su propio regalo, y dos ganchos
    // en el mismo correo se hacen sombra.
    concursoPremio: null,
    concursoUrl: null,
    urlBaja: urlBajaDeEmpresa(dominio, empresa.slug),
  });

  return { html, ctaUrl: enlace.url, reservaLinkId: enlace.id, fotoUrl: foto?.url ?? null };
}

/**
 * Siembra los tres canales en una empresa. Devuelve cuántos se crearon.
 */
export async function sembrarCampanaCumpleanosAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creadas: number }> {
  const empresa = await cargarEmpresaMarca(admin, empresaId);
  if (!empresa) return { creadas: 0 };

  const seed = CAMPANA_CUMPLEANOS_SEED;

  // Se mira canal a canal: si alguien borró la de SMS pero conserva la de
  // correo, se repone solo la que falta.
  const { data: existentes } = await admin
    .from("campanas_marketing")
    .select("canal, payload")
    .eq("empresa_id", empresaId)
    .in("canal", ["email", "whatsapp", "sms"]);
  const yaSembrados = new Set(
    (existentes ?? [])
      .filter((r) => (r.payload as Record<string, unknown> | null)?.claveSeed === seed.clave)
      .map((r) => r.canal as string),
  );
  if (yaSembrados.size === 3) return { creadas: 0 };

  const dominio = await dominioPropioDeEmpresa(admin, empresaId);
  const correo = await construirCorreoCumpleanos(admin, empresa, seed, dominio);

  const reglas: ReglasCumpleanos = {
    diasAntes: seed.diasAntes,
    diasValidezDespues: seed.diasValidezDespues,
    minimoPersonas: seed.minimoPersonas,
  };

  const comun = {
    empresa_id: empresaId,
    estado: "borrador",
    segmento: "cumpleaneros",
    reserva_link_id: correo.reservaLinkId,
    recurrencia_cron: CRON_DIARIO,
    // El segmento no se resuelve con el constructor de segmentos: quién cumple
    // años hoy no es un filtro de la ficha, es una cuenta de días. La hace el
    // motor.
    segmento_json: { operador: "AND", condiciones: [] },
    demo_mode: true,
  };

  const filas: Record<string, unknown>[] = [];

  if (!yaSembrados.has("email")) {
    filas.push({
      ...comun,
      canal: "email",
      nombre: seed.email.nombre,
      media_urls: correo.fotoUrl ? [correo.fotoUrl] : [],
      payload: {
        claveSeed: seed.clave,
        ...reglas,
        asunto: seed.email.asunto,
        preheader: seed.email.preheader,
        remitenteNombre: empresa.nombre,
        remitenteEmail: "",
        cuerpoHtml: correo.html,
      },
    });
  }

  if (!yaSembrados.has("whatsapp")) {
    filas.push({
      ...comun,
      canal: "whatsapp",
      nombre: seed.whatsapp.nombre,
      media_urls: [],
      payload: {
        claveSeed: seed.clave,
        ...reglas,
        plantilla: seed.whatsapp.plantilla,
        idioma: seed.whatsapp.idioma,
        cuerpo: seed.whatsapp.cuerpo,
        variables: {},
      },
    });
  }

  if (!yaSembrados.has("sms")) {
    filas.push({
      ...comun,
      canal: "sms",
      nombre: seed.sms.nombre,
      media_urls: [],
      payload: {
        claveSeed: seed.clave,
        ...reglas,
        cuerpo: seed.sms.cuerpo,
        remitente: "",
      },
    });
  }

  if (!filas.length) return { creadas: 0 };
  const { error } = await admin.from("campanas_marketing").insert(filas);
  if (error) throw error;
  return { creadas: filas.length };
}
