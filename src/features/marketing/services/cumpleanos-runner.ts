/**
 * Motor diario de la campaña de cumpleaños.
 *
 * Una pasada al día por empresa. Busca a quién le falta una semana para su
 * cumpleaños, le fabrica SU cupón y le manda UNA felicitación.
 *
 * ── Las cuatro reglas que sostienen esto ───────────────────────────────────
 *
 *  1. **Un mensaje por persona, no tres.** Se prueba WhatsApp, si no SMS, y si
 *     no, correo. Tres felicitaciones idénticas el mismo día no son tres
 *     oportunidades: son una baja.
 *
 *  2. **Una vez al año.** Antes de escribir se mira si a esa persona ya se le
 *     escribió este año. Sin eso, un cron que se ejecuta dos veces —o un
 *     redespliegue a la hora justa— felicita dos veces y regala dos comidas.
 *
 *  3. **El día es el de la empresa, no el del servidor.** Vercel corre en UTC;
 *     a las 23:30 de Madrid allí ya es mañana, y el cumpleaños de alguien se
 *     saltaría un día entero. La fecha se calcula siempre en la zona de la
 *     empresa.
 *
 *  4. **El cupón se crea ANTES de enviar.** Si se enviara primero y el cupón
 *     fallara, el cliente tendría un correo con un código que no existe. Al
 *     revés lo peor que pasa es un cupón sin usar, que no molesta a nadie.
 *
 * ── Lo que NO hace ─────────────────────────────────────────────────────────
 * No manda nada si la campaña está en borrador. Sembrarla no la enciende: hace
 * falta que una persona la ponga en marcha desde Marketing.
 */
import "server-only";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { enviarMensaje } from "@/lib/mensajeria/enviar";
import { tokenDeBaja } from "./baja-marketing";
import { enviarCorreoMarketing } from "./resend-service";
import { reglasDe, type ReglasCumpleanos } from "./campana-cumpleanos";
import { CAMPANA_CUMPLEANOS_SEED } from "@/lib/seeds/campana-cumpleanos";
import type { Admin } from "./campanas-anuales";

const CLAVE = CAMPANA_CUMPLEANOS_SEED.clave;
/** Marcador del enlace de baja que la plantilla deja escrito en el HTML. */
const MARCADOR_BAJA = "{{TOKEN_BAJA}}";
/** Tope por empresa y pasada. Con 13.000 fichas salen ~35 al día; 300 es techo de avería. */
const TOPE_POR_PASADA = 300;

export interface ResumenCumpleanos {
  empresaId: string;
  /** false = la campaña está en borrador o no existe: no se hace nada. */
  encendida: boolean;
  /** Fecha (en la zona de la empresa) de los cumpleaños atendidos. */
  fechaObjetivo?: string;
  candidatos: number;
  enviados: number;
  omitidos: number;
  fallidos: number;
  errores: string[];
}

interface CampanaCanal {
  id: string;
  canal: "email" | "whatsapp" | "sms";
  payload: Record<string, unknown>;
}

interface ClienteCumple {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  fecha_nacimiento: string;
  acepta_marketing_email: boolean;
  acepta_marketing_sms: boolean;
  acepta_marketing_whatsapp: boolean;
}

// ── Fechas ────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" del instante dado, leído en la zona de la empresa. */
function fechaEnZona(instante: Date, zona: string): string {
  // `en-CA` da directamente el formato ISO, que es el que habla la base de datos.
  return instante.toLocaleDateString("en-CA", { timeZone: zona });
}

/** Suma días a una fecha "YYYY-MM-DD" sin pasar por husos horarios. */
function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** "2026-09-21" → "21/09/2026". Como se escriben las fechas en toda la casa. */
function fechaES(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// ── Piezas del envío ──────────────────────────────────────────────────────

/** Sustituye los marcadores del texto por los datos de esta persona. */
function rellenar(
  texto: string,
  datos: { nombre: string; empresa: string; codigo: string; caducidad: string; minimo: number; url: string },
): string {
  return texto
    .split("{{NOMBRE}}").join(datos.nombre)
    .split("{{EMPRESA}}").join(datos.empresa)
    .split("{{CODIGO}}").join(datos.codigo)
    .split("{{CADUCIDAD}}").join(datos.caducidad)
    .split("{{MINIMO}}").join(String(datos.minimo))
    .split("{{URL}}").join(datos.url);
}

/** El nombre de pila, que es como se felicita. "MARÍA JOSÉ PÉREZ" → "María José". */
function nombreDePila(nombre: string): string {
  const limpio = (nombre ?? "").trim().split(/\s+/).slice(0, 2).join(" ");
  if (!limpio) return "";
  return limpio
    .toLocaleLowerCase("es-ES")
    .replace(/(^|\s)\p{L}/gu, (c) => c.toLocaleUpperCase("es-ES"));
}

/**
 * Crea el cupón personal del cumpleañero.
 *
 * Un solo uso, con su mínimo de comensales y con fecha de caducidad: un regalo
 * sin caducidad se guarda "para otro día" y no llena ninguna mesa.
 */
async function crearCuponCumpleanos(
  admin: Admin,
  args: {
    empresaId: string;
    cliente: ClienteCumple;
    fechaCumple: string;
    reglas: ReglasCumpleanos;
  },
): Promise<{ id: string; codigo: string; caducidad: string } | null> {
  const { data: codigo, error: errCodigo } = await admin.rpc("generar_codigo_cupon", {
    p_empresa_id: args.empresaId,
  });
  if (errCodigo || !codigo) return null;

  const caducidad = sumarDias(args.fechaCumple, args.reglas.diasValidezDespues);
  const anio = args.fechaCumple.slice(0, 4);
  // Hay fichas sin nombre (las que entraron por WhatsApp con un emoji por
  // nombre). Interpolar directo escribía "null" en el título del cupón.
  const nombre =
    [args.cliente.nombre, args.cliente.apellidos].filter(Boolean).join(" ").trim() ||
    "Cliente";

  const { data, error } = await admin
    .from("reserva_codigos")
    .insert({
      empresa_id: args.empresaId,
      codigo: codigo as string,
      // El título interno es lo que ve sala: tiene que decir de quién es sin
      // abrir nada.
      titulo_interno: `Cumpleaños · ${nombre} · ${anio}`.slice(0, 120),
      titulo_cliente: "Tu cumpleaños lo invita la casa",
      beneficio_tipo: "producto_gratis",
      producto_descripcion:
        `Comida del cumpleañero gratis (mesa de ${args.reglas.minimoPersonas} o más)`.slice(0, 200),
      unidad_stock: "reservas",
      stock_total: 1,
      fecha_caducidad: caducidad,
      minimo_personas: args.reglas.minimoPersonas,
      cliente_id: args.cliente.id,
      origen: "CUMPLEANOS",
      activo: true,
    })
    .select("id, codigo")
    .single();

  if (error || !data) return null;
  return { id: data.id as string, codigo: data.codigo as string, caducidad };
}

/** A quién ya se le escribió este año, para no felicitar dos veces. */
async function yaFelicitadosEsteAnio(
  admin: Admin,
  campanaIds: string[],
  anio: string,
): Promise<Set<string>> {
  const { data } = await admin
    .from("campanas_envios")
    .select("cliente_id")
    .in("campana_id", campanaIds)
    .gte("created_at", `${anio}-01-01T00:00:00Z`)
    .not("cliente_id", "is", null);
  return new Set((data ?? []).map((r) => r.cliente_id as string));
}

// ── Motor ─────────────────────────────────────────────────────────────────

export async function procesarCumpleanosDeEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<ResumenCumpleanos> {
  const resumen: ResumenCumpleanos = {
    empresaId,
    encendida: false,
    candidatos: 0,
    enviados: 0,
    omitidos: 0,
    fallidos: 0,
    errores: [],
  };

  const { data: filas } = await admin
    .from("campanas_marketing")
    .select("id, canal, estado, payload")
    .eq("empresa_id", empresaId)
    .in("canal", ["email", "whatsapp", "sms"]);

  const campanas = (filas ?? [])
    .filter((r) => (r.payload as Record<string, unknown> | null)?.claveSeed === CLAVE)
    .filter((r) => r.estado === "activa")
    .map(
      (r): CampanaCanal => ({
        id: r.id as string,
        canal: r.canal as CampanaCanal["canal"],
        payload: (r.payload as Record<string, unknown>) ?? {},
      }),
    );
  if (!campanas.length) return resumen;
  resumen.encendida = true;

  const porCanal = new Map(campanas.map((c) => [c.canal, c]));
  const reglas = reglasDe(campanas[0].payload);

  const { data: empresaRow } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", empresaId)
    .maybeSingle();
  const empresaNombre = (empresaRow?.nombre as string) ?? "";

  const zona = await getZonaHorariaEmpresa(admin, empresaId);
  const hoy = fechaEnZona(new Date(), zona);
  const objetivo = sumarDias(hoy, reglas.diasAntes);
  resumen.fechaObjetivo = objetivo;

  const { data: clientesRaw, error: errClientes } = await admin.rpc("clientes_sala_cumpleanos", {
    p_empresa_id: empresaId,
    p_fecha: objetivo,
  });
  if (errClientes) {
    resumen.errores.push(`No se pudo leer quién cumple años: ${errClientes.message}`);
    return resumen;
  }

  const clientes = (clientesRaw ?? []) as ClienteCumple[];
  resumen.candidatos = clientes.length;
  if (!clientes.length) return resumen;

  const yaFelicitados = await yaFelicitadosEsteAnio(
    admin,
    campanas.map((c) => c.id),
    objetivo.slice(0, 4),
  );

  const urlReserva = await urlDeReserva(admin, campanas, empresaId);
  const ahora = new Date().toISOString();
  let procesados = 0;

  for (const cliente of clientes) {
    if (procesados >= TOPE_POR_PASADA) {
      resumen.errores.push(
        `Tope de ${TOPE_POR_PASADA} felicitaciones alcanzado; el resto queda sin enviar`,
      );
      break;
    }
    if (yaFelicitados.has(cliente.id)) {
      resumen.omitidos++;
      continue;
    }

    const telefono = telefonoE164(cliente);
    const puedeWhatsapp = cliente.acepta_marketing_whatsapp && !!telefono && porCanal.has("whatsapp");
    const puedeSms = cliente.acepta_marketing_sms && !!telefono && porCanal.has("sms");
    const puedeEmail = cliente.acepta_marketing_email && !!cliente.email && porCanal.has("email");
    if (!puedeWhatsapp && !puedeSms && !puedeEmail) {
      resumen.omitidos++;
      continue;
    }
    procesados++;

    const cupon = await crearCuponCumpleanos(admin, {
      empresaId,
      cliente,
      fechaCumple: objetivo,
      reglas,
    });
    if (!cupon) {
      resumen.fallidos++;
      resumen.errores.push(`No se pudo crear el cupón de ${cliente.nombre}`);
      continue;
    }

    const datos = {
      nombre: nombreDePila(cliente.nombre),
      empresa: empresaNombre,
      codigo: cupon.codigo,
      caducidad: fechaES(cupon.caducidad),
      minimo: reglas.minimoPersonas,
      url: urlReserva,
    };

    // ── 1. WhatsApp, y SMS de respaldo ──────────────────────────────────
    //
    // Los dos van en la MISMA llamada: el orquestador ya sabe caer de uno al
    // otro, cobrar el saldo y devolverlo si el mensaje no sale.
    let enviadoPor: CampanaCanal | null = null;
    let referencia: string | null = null;
    let ultimoError = "";

    if (puedeWhatsapp || puedeSms) {
      const wa = porCanal.get("whatsapp");
      const sms = porCanal.get("sms");
      const r = await enviarMensaje({
        empresaId,
        tipo: "CAMPANA",
        telefono,
        plantillaWhatsapp: puedeWhatsapp ? (wa?.payload.plantilla as string) : undefined,
        variables: puedeWhatsapp
          ? [datos.nombre, datos.empresa, String(datos.minimo), datos.codigo, datos.caducidad, datos.url]
          : undefined,
        textoSms: puedeSms ? rellenar((sms?.payload.cuerpo as string) ?? "", datos) : undefined,
        actor: { origen: "AUTOMATICO" },
      });
      if (r.ok) {
        enviadoPor = (r.canal === "WHATSAPP" ? wa : sms) ?? null;
        referencia = r.envioId;
      } else {
        ultimoError = r.motivo;
      }
    }

    // ── 2. Correo ───────────────────────────────────────────────────────
    if (!enviadoPor && puedeEmail) {
      const email = porCanal.get("email")!;
      const html = rellenar((email.payload.cuerpoHtml as string) ?? "", datos)
        .split(MARCADOR_BAJA)
        .join(tokenDeBaja(cliente.id));
      const r = await enviarCorreoMarketing({
        empresaNombre,
        para: cliente.email!,
        asunto: (email.payload.asunto as string) ?? "Tu cumpleaños lo invitamos nosotros",
        html,
      });
      if (r.ok) {
        enviadoPor = email;
        referencia = r.proveedorId;
      } else {
        ultimoError = r.error;
      }
    }

    // ── 3. Registro ─────────────────────────────────────────────────────
    const destino =
      enviadoPor?.canal === "email" ? cliente.email : (telefono ?? cliente.email);

    if (enviadoPor) {
      resumen.enviados++;
      await admin.from("campanas_envios").insert({
        campana_id: enviadoPor.id,
        empresa_id: empresaId,
        cliente_id: cliente.id,
        destinatario: destino,
        estado: "enviado",
        enviado_en: ahora,
        proveedor_id: referencia,
      });
    } else {
      resumen.fallidos++;
      // El cupón se desactiva: nadie recibió el código, así que dejarlo vivo
      // solo ensucia el listado de cupones de sala.
      await admin.from("reserva_codigos").update({ activo: false }).eq("id", cupon.id);
      await admin.from("campanas_envios").insert({
        campana_id: (porCanal.get("email") ?? campanas[0]).id,
        empresa_id: empresaId,
        cliente_id: cliente.id,
        destinatario: destino,
        estado: "fallido",
        error: ultimoError.slice(0, 500),
      });
    }
  }

  // La marca de ejecución va en las tres: las tres han corrido, aunque solo una
  // haya escrito a cada persona.
  await admin
    .from("campanas_marketing")
    .update({ ultima_ejecucion: ahora })
    .in("id", campanas.map((c) => c.id));

  return resumen;
}

/** Enlace de reserva de la campaña, para el SMS y el WhatsApp. */
async function urlDeReserva(
  admin: Admin,
  campanas: CampanaCanal[],
  empresaId: string,
): Promise<string> {
  const { data } = await admin
    .from("campanas_marketing")
    .select("reserva_link_id")
    .in("id", campanas.map((c) => c.id))
    .not("reserva_link_id", "is", null)
    .limit(1)
    .maybeSingle();

  const linkId = data?.reserva_link_id as string | undefined;
  if (linkId) {
    const { data: link } = await admin
      .from("reserva_links")
      .select("url_generada")
      .eq("id", linkId)
      .maybeSingle();
    if (link?.url_generada) return link.url_generada as string;
  }

  const { data: empresa } = await admin
    .from("empresas")
    .select("slug")
    .eq("id", empresaId)
    .maybeSingle();
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com").replace(/\/$/, "");
  return `${base}/reservar/${(empresa?.slug as string) ?? ""}`;
}

/**
 * Teléfono listo para el proveedor.
 *
 * En la ficha el número ya viene COMPLETO con su prefijo ("+34 612345678"): no
 * hay columna de prefijo aparte desde que se unificaron los dos campos. Aquí
 * solo se limpian los espacios; el resto —los números viejos que se guardaron
 * sin prefijo— lo resuelve `normalizarTelefono` del orquestador, que sabe
 * anteponer el de España a los nacionales de nueve dígitos.
 */
function telefonoE164(cliente: ClienteCumple): string | null {
  const bruto = (cliente.telefono ?? "").trim();
  return bruto || null;
}
