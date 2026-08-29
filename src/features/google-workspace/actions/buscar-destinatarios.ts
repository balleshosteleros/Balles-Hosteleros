"use server";

/**
 * Búsqueda de destinatarios ya guardados en el software, para autocompletar el
 * campo "Para" del compositor de correo.
 *
 * Reúne las agendas donde de verdad hay correos: la agenda de contactos y la
 * plantilla (empleados). Todo acotado a la EMPRESA ACTIVA — nunca se sugiere el
 * correo de otra empresa.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { googleFetchAuto, getGoogleTokens } from "@/lib/google/api";
import { friendlyError } from "@/shared/lib/friendly-errors";

export interface Destinatario {
  nombre: string;
  email: string;
  /** De dónde sale, para que el usuario sepa a quién está escribiendo. */
  origen: "Agenda" | "Empleado" | "Gmail";
  /** Cargo, empresa o departamento; ayuda a desambiguar homónimos. */
  detalle?: string;
  /** Foto de perfil de Google, cuando el contacto la tiene guardada. */
  foto?: string;
}

const MAX = 8;

type PeopleResp = {
  results?: Array<{
    person?: {
      names?: Array<{ displayName?: string }>;
      emailAddresses?: Array<{ value?: string }>;
      organizations?: Array<{ name?: string; title?: string }>;
      photos?: Array<{ url?: string; default?: boolean }>;
    };
  }>;
};

/**
 * Contactos de la cuenta de Google ya vinculada. Cubre DOS fuentes:
 *  · `people:searchContacts`  → la agenda de Google del usuario.
 *  · `otherContacts:search`   → direcciones con las que ha intercambiado
 *    correo aunque nunca las guardara. Aquí es donde aparece, por ejemplo, la
 *    gestoría a la que se escribe cada trimestre.
 *
 * Esto es lo que hace que una empresa nueva tenga sus contactos disponibles en
 * cuanto vincula el correo, SIN que nadie tenga que importar nada a mano.
 */
type EndpointPeople = "people:searchContacts" | "otherContacts:search";

function urlPeople(ep: EndpointPeople, q: string): string {
  const url = new URL(`https://people.googleapis.com/v1/${ep}`);
  url.searchParams.set("query", q);
  url.searchParams.set("pageSize", "10");
  // `otherContacts` no admite `organizations` en el readMask.
  url.searchParams.set(
    "readMask",
    ep === "otherContacts:search"
      ? "names,emailAddresses,photos"
      : "names,emailAddresses,organizations,photos",
  );
  return url.toString();
}

/**
 * Cuentas cuya caché de búsqueda ya se ha calentado en este proceso.
 *
 * La búsqueda de People usa una caché PEREZOSA: Google documenta que hay que
 * mandar una petición de calentamiento con la consulta vacía, o las primeras
 * búsquedas devuelven vacío. Sin esto, el primer usuario de una empresa recién
 * vinculada no vería ninguna sugerencia — justo el trámite que se quiere evitar.
 */
const cacheCalentada = new Set<string>();

async function calentarCache(cuenta: string): Promise<void> {
  if (cacheCalentada.has(cuenta)) return;
  cacheCalentada.add(cuenta);
  await Promise.allSettled([
    googleFetchAuto(urlPeople("people:searchContacts", "")),
    googleFetchAuto(urlPeople("otherContacts:search", "")),
  ]);
}

async function buscarEnGoogle(q: string, cuenta: string): Promise<Destinatario[]> {
  const out: Destinatario[] = [];
  await calentarCache(cuenta);

  const endpoints: EndpointPeople[] = ["people:searchContacts", "otherContacts:search"];
  for (const ep of endpoints) {
    try {
      const { data, needsReauth } = await googleFetchAuto<PeopleResp>(urlPeople(ep, q));
      if (needsReauth) return out;

      for (const r of data?.results ?? []) {
        const email = r.person?.emailAddresses?.[0]?.value;
        if (!email) continue;
        const org = r.person?.organizations?.[0];
        // `default: true` es el avatar genérico de Google (la silueta gris): no
        // aporta nada, así que se ignora y se cae en la inicial del nombre.
        const foto = r.person?.photos?.find((f) => f.url && !f.default)?.url;
        out.push({
          nombre: r.person?.names?.[0]?.displayName ?? email,
          email,
          origen: "Gmail",
          detalle: [org?.title, org?.name].filter(Boolean).join(" · ") || undefined,
          foto,
        });
      }
    } catch (err) {
      // Sin cuenta vinculada o sin permisos: no es un error, simplemente no hay
      // sugerencias de Google. Las de agenda y empleados siguen funcionando.
      console.error(`[correo] buscarEnGoogle(${ep}):`, err);
    }
  }
  return out;
}

type GmailListaMensajes = { messages?: { id: string }[] };
type GmailMensajeMeta = {
  payload?: { headers?: { name: string; value: string }[] };
};

/** "Nombre Apellido <a@b.com>" → sus partes; admite varias direcciones. */
function partirDirecciones(cabecera: string): { nombre: string; email: string }[] {
  return cabecera
    .split(",")
    .map((trozo) => {
      const m = trozo.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
      if (m) return { nombre: m[1].replace(/["']/g, "").trim(), email: m[2].trim() };
      const suelto = trozo.trim();
      return suelto ? { nombre: suelto, email: suelto } : null;
    })
    .filter((d): d is { nombre: string; email: string } => !!d && d.email.includes("@"));
}

/**
 * LIBRETA DE DIRECCIONES DEL BUZÓN: con quién se ha intercambiado correo de
 * verdad, sacado de las cabeceras de los últimos mensajes.
 *
 * Es lo que hace Gmail al escribir en "Para": no mira solo la agenda, sino a
 * quién has escrito y quién te ha escrito.
 *
 * Va aparte de People a propósito. `otherContacts` cubre en teoría lo mismo,
 * pero depende de que la People API esté habilitada en el proyecto de Google
 * (si no lo está, responde 403 a todo y el campo "Para" se queda mudo sin que
 * nada lo indique). Esta libreta usa el mismo permiso de Gmail que ya necesita
 * la bandeja, así que funciona siempre que el correo se vea.
 *
 * Se barre el buzón UNA vez y se filtra en memoria, en lugar de preguntar a
 * Gmail por cada término. El motivo es que los operadores `to:`/`from:` casan
 * palabras COMPLETAS: buscando "iber" Gmail no devuelve nada, y el
 * autocompletado no aparecía hasta tener el nombre casi escrito — justo cuando
 * ya no hace falta. Filtrando por subcadena, "iber" encuentra a Iberdrola y
 * "bel" a Belén, como en Gmail.
 */
const MENSAJES_A_BARRER = 50;

/** Una entrada de la libreta. */
type EntradaLibreta = { nombre: string; email: string; detalle: string };

/**
 * Libreta ya calculada, por cuenta de Google. El barrido son ~100 peticiones a
 * Gmail: hacerlo en cada tecla dejaría el campo inservible. Se guarda en el
 * proceso con caducidad corta; un contacto nuevo aparece en el siguiente ciclo.
 */
const libretaCache = new Map<string, { libreta: EntradaLibreta[]; expira: number }>();
const LIBRETA_TTL_MS = 10 * 60 * 1000;

async function obtenerLibreta(cuenta: string): Promise<EntradaLibreta[]> {
  const cacheada = libretaCache.get(cuenta);
  if (cacheada && cacheada.expira > Date.now()) return cacheada.libreta;

  const porEmail = new Map<string, EntradaLibreta>();

  // Enviados y recibidos por separado: en los enviados interesan `To`/`Cc`
  // (a quién escribes) y en el resto `From` (quién te escribe).
  const barridos: Array<{ consulta: string; cabeceras: string[]; detalle: string }> = [
    { consulta: "in:sent", cabeceras: ["To", "Cc"], detalle: "Le has escrito" },
    {
      consulta: "in:anywhere -in:spam -in:trash",
      cabeceras: ["From"],
      detalle: "Te ha escrito",
    },
  ];

  for (const barrido of barridos) {
    const params = new URLSearchParams({
      q: barrido.consulta,
      maxResults: String(MENSAJES_A_BARRER),
    });
    const lista = await googleFetchAuto<GmailListaMensajes>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    );
    // Sin cuenta válida no hay libreta: se devuelve lo reunido hasta ahora sin
    // cachear, para reintentar cuando el token vuelva a servir.
    if (lista.needsReauth) return Array.from(porEmail.values());

    const cabecerasUrl = barrido.cabeceras
      .map((h) => `metadataHeaders=${h}`)
      .join("&");

    const metas = await Promise.all(
      (lista.data?.messages ?? []).map((m) =>
        googleFetchAuto<GmailMensajeMeta>(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&${cabecerasUrl}`,
        ).then((r) => r.data),
      ),
    );

    for (const meta of metas) {
      for (const h of meta?.payload?.headers ?? []) {
        for (const d of partirDirecciones(h.value)) {
          const clave = d.email.toLowerCase();
          // Uno mismo no es un destinatario: la propia cuenta aparece en el
          // `To` de los hilos donde te has puesto en copia y en el `From` de
          // los correos que te mandas. Gmail tampoco se autosugiere.
          if (clave === cuenta.toLowerCase()) continue;
          // La primera vez manda: los enviados van antes porque escribir a
          // alguien es mejor señal que recibir su publicidad.
          if (porEmail.has(clave)) continue;
          porEmail.set(clave, {
            nombre: d.nombre || d.email,
            email: d.email,
            detalle: barrido.detalle,
          });
        }
      }
    }
  }

  const libreta = Array.from(porEmail.values());
  libretaCache.set(cuenta, { libreta, expira: Date.now() + LIBRETA_TTL_MS });
  return libreta;
}

async function buscarEnHistorial(q: string, cuenta: string): Promise<Destinatario[]> {
  const termino = q.toLowerCase();
  const libreta = await obtenerLibreta(cuenta);
  return libreta
    .filter(
      (e) =>
        e.email.toLowerCase().includes(termino) ||
        e.nombre.toLowerCase().includes(termino),
    )
    .map((e) => ({
      nombre: e.nombre,
      email: e.email,
      origen: "Gmail" as const,
      detalle: e.detalle,
    }));
}

/**
 * Completa las fotos que faltan preguntando a People por cada dirección.
 *
 * Las sugerencias que salen de la libreta del buzón o de la agenda del software
 * no traen foto: se busca aquí, una vez ya recortada la lista a las que se van a
 * pintar, para no gastar peticiones en contactos que nadie va a ver.
 */
async function completarFotos(lista: Destinatario[]): Promise<Destinatario[]> {
  const pendientes = lista.filter((d) => !d.foto);
  if (pendientes.length === 0) return lista;

  const encontradas = new Map<string, string>();
  await Promise.all(
    pendientes.map(async (d) => {
      for (const ep of ["people:searchContacts", "otherContacts:search"] as const) {
        try {
          const { data } = await googleFetchAuto<PeopleResp>(urlPeople(ep, d.email));
          for (const r of data?.results ?? []) {
            const coincide = (r.person?.emailAddresses ?? []).some(
              (e) => e.value?.toLowerCase() === d.email.toLowerCase(),
            );
            if (!coincide) continue;
            const foto = r.person?.photos?.find((f) => f.url && !f.default)?.url;
            if (foto) {
              encontradas.set(d.email.toLowerCase(), foto);
              return;
            }
          }
        } catch {
          /* sin People no hay foto: se pinta la inicial */
        }
      }
    }),
  );

  if (encontradas.size === 0) return lista;
  return lista.map((d) =>
    d.foto ? d : { ...d, foto: encontradas.get(d.email.toLowerCase()) },
  );
}

export async function buscarDestinatarios(
  termino: string,
): Promise<{ ok: boolean; data: Destinatario[]; error?: string }> {
  try {
    const q = termino.trim();
    if (q.length < 2) return { ok: true, data: [] };

    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };

    const patron = `%${q}%`;
    const resultados: Destinatario[] = [];

    // Agenda de contactos.
    const { data: agenda } = await supabase
      .from("contactos_agenda")
      .select("nombre, email, empresa_contacto, categoria")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .not("email", "is", null)
      .or(`nombre.ilike.${patron},email.ilike.${patron},empresa_contacto.ilike.${patron}`)
      .limit(MAX);

    for (const c of (agenda ?? []) as Array<{
      nombre: string | null;
      email: string | null;
      empresa_contacto: string | null;
      categoria: string | null;
    }>) {
      if (!c.email) continue;
      resultados.push({
        nombre: c.nombre ?? c.email,
        email: c.email,
        origen: "Agenda",
        detalle: [c.empresa_contacto, c.categoria].filter(Boolean).join(" · ") || undefined,
      });
    }

    // Empleados: se prefiere el correo de empresa sobre el personal.
    // Solo ACTIVOS: no se sugiere escribir a un ex-empleado.
    const { data: empleados } = await supabase
      .from("empleados")
      .select("nombre, apellidos, email_empresa, email_personal, puesto")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo")
      .or(
        `nombre.ilike.${patron},apellidos.ilike.${patron},email_empresa.ilike.${patron},email_personal.ilike.${patron}`,
      )
      .limit(MAX);

    for (const e of (empleados ?? []) as Array<{
      nombre: string | null;
      apellidos: string | null;
      email_empresa: string | null;
      email_personal: string | null;
      puesto: string | null;
    }>) {
      const email = e.email_empresa || e.email_personal;
      if (!email) continue;
      resultados.push({
        nombre: [e.nombre, e.apellidos].filter(Boolean).join(" ") || email,
        email,
        origen: "Empleado",
        detalle: e.puesto ?? undefined,
      });
    }

    // Contactos de la cuenta de Google vinculada (agenda + con quien se ha
    // intercambiado correo). Van DESPUÉS para que, ante el mismo correo, gane
    // la ficha propia del software, que trae puesto/empresa.
    //
    // Se consulta la cuenta ACTIVA: cada empresa vincula la suya, así que al
    // cambiar de empresa cambian también las sugerencias de Gmail y nunca se
    // ofrecen los contactos de otra.
    const { email: cuentaGoogle } = await getGoogleTokens();
    if (cuentaGoogle) {
      // Las dos fuentes de Google en paralelo: la agenda (People) y el
      // historial de correo. Se lanzan juntas porque el campo "Para" espera
      // por ellas mientras el usuario teclea.
      const [deAgendaGoogle, deHistorial] = await Promise.all([
        buscarEnGoogle(q, cuentaGoogle),
        buscarEnHistorial(q, cuentaGoogle),
      ]);
      resultados.push(...deAgendaGoogle, ...deHistorial);
    }

    // Un mismo correo puede estar en varias fuentes: se deja la primera.
    const vistos = new Set<string>();
    const unicos = resultados.filter((r) => {
      const clave = r.email.toLowerCase();
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });

    const finales = unicos.slice(0, MAX);
    return {
      ok: true,
      data: cuentaGoogle ? await completarFotos(finales) : finales,
    };
  } catch (err) {
    console.error("[correo] buscarDestinatarios:", err);
    return { ok: false, data: [], error: friendlyError(err, "buscarDestinatarios") };
  }
}
