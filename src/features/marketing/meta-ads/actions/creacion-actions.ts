"use server";

import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPermisos } from "@/features/auth/actions/permisos-actions";
import { puedeVerModulo } from "@/features/auth/lib/permisos";
import {
  getMetaCredenciales,
  type MetaCredenciales,
} from "@/features/marketing/meta-ads/services/meta-credenciales";
import { getGastoDelMes } from "@/features/marketing/meta-ads/services/meta-insights";
import {
  crearAnuncio,
  crearCampana,
  crearConjunto,
  cambiarEstado,
  OBJETIVOS,
  BOTONES,
} from "@/features/marketing/meta-ads/services/meta-escritura";
import { getEstadoVideo, subirMiniaturaDeVideo } from "@/features/marketing/meta-ads/services/meta-medios";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { MetaApiError, centimosAEuros, eurosACentimos } from "@/features/marketing/meta-ads/lib/meta-api";

/**
 * PRP-087 · Fases 5 y 7 — Crear una campaña completa y publicarla o programarla.
 *
 * Se crean los tres niveles de una pasada y SIEMPRE en pausa. Después:
 *   - "Publicar ahora" activa, con su confirmación y su tope de gasto.
 *   - "Programar" la deja creada y en pausa, y un cron la arranca a su hora,
 *     que es la del reloj de la EMPRESA, no la del navegador de quien la creó.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

interface Contexto {
  empresaId: string;
  userId: string;
  cred: MetaCredenciales;
  admin: ReturnType<typeof createAdminClient>;
}

async function contexto(): Promise<{ ok: true; ctx: Contexto } | { ok: false; error: string }> {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return fallo("Sesión no válida.");
  if (!empresaId) return fallo("Sin empresa activa.");

  const { permisos } = await getUserPermisos();
  if (!puedeVerModulo(permisos, "MARKETING")) {
    return fallo("No tienes permiso para crear campañas de Meta.");
  }

  const admin = createAdminClient();
  const cred = await getMetaCredenciales(admin, empresaId);
  if (!cred) return fallo("Esta empresa no tiene Meta conectado. Ve a Ajustes → Integraciones.");

  return { ok: true, ctx: { empresaId, userId, cred, admin } };
}

const tarjetaSchema = z.object({
  imageHash: z.string().trim().min(1),
  titular: z.string().trim().min(1, "Cada tarjeta necesita un título.").max(120),
  descripcion: z.string().trim().max(200).optional(),
  enlace: z.string().trim().url("El enlace de la tarjeta no es válido.").optional(),
});

const crearSchema = z
  .object({
    // Nivel 1
    nombre: z.string().trim().min(1, "Ponle nombre a la campaña.").max(200),
    objetivo: z.enum(Object.keys(OBJETIVOS) as [string, ...string[]]),

    // Nivel 2
    presupuestoDiarioEuros: z
      .number({ message: "Pon un presupuesto al día." })
      .positive("El presupuesto tiene que ser mayor que cero.")
      .max(10_000, "Ese presupuesto diario es demasiado alto, revísalo."),
    edadMin: z.number().int().min(13).max(65),
    edadMax: z.number().int().min(13).max(65),
    genero: z.enum(["todos", "hombres", "mujeres"]),
    ciudades: z.array(z.string().trim().min(1)).max(50).default([]),
    paises: z.array(z.string().trim().length(2)).max(25).default([]),
    intereses: z
      .array(z.object({ id: z.string().trim().min(1), name: z.string().trim().min(1) }))
      .max(25)
      .default([]),
    plataformas: z
      .array(z.enum(["facebook", "instagram"]))
      .min(1, "Elige al menos dónde quieres que salga: Facebook o Instagram."),
    inicioIso: z.string().trim().optional(),
    finIso: z.string().trim().optional(),

    // Nivel 3
    formato: z.enum(["imagen", "video", "carrusel"]),
    texto: z.string().trim().min(1, "Escribe el texto del anuncio.").max(2000),
    titular: z.string().trim().min(1, "Escribe un título.").max(120),
    descripcionAnuncio: z.string().trim().max(200).optional(),
    enlace: z.string().trim().url("El enlace de destino no es válido."),
    boton: z.enum(Object.keys(BOTONES) as [string, ...string[]]),
    imageHash: z.string().trim().optional(),
    videoId: z.string().trim().optional(),
    tarjetas: z.array(tarjetaSchema).max(10).optional(),

    // Publicación
    publicacion: z.enum(["borrador", "ahora", "programar"]),
    programarPara: z.string().trim().optional(), // "aaaa-mm-ddThh:mm" en hora de la EMPRESA
    confirmado: z.boolean().optional(),
  })
  .refine((d) => d.edadMin <= d.edadMax, {
    message: "La edad mínima no puede ser mayor que la máxima.",
    path: ["edadMin"],
  })
  .refine((d) => d.formato !== "imagen" || Boolean(d.imageHash), {
    message: "Falta la imagen del anuncio.",
    path: ["imageHash"],
  })
  .refine((d) => d.formato !== "video" || Boolean(d.videoId), {
    message: "Falta el vídeo del anuncio.",
    path: ["videoId"],
  })
  .refine((d) => d.formato !== "carrusel" || (d.tarjetas?.length ?? 0) >= 2, {
    message: "Un carrusel necesita al menos 2 imágenes.",
    path: ["tarjetas"],
  })
  .refine((d) => d.publicacion !== "programar" || Boolean(d.programarPara), {
    message: "Dime el día y la hora a la que quieres que arranque.",
    path: ["programarPara"],
  });

export type CrearCampanaCompletaInput = z.input<typeof crearSchema>;

export interface ResultadoCreacion {
  campanaId: string;
  conjuntoId: string;
  anuncioId: string;
  estado: "borrador" | "activa" | "programada";
  programadaPara: string | null;
  avisoGasto: string | null;
}

/**
 * Crea campaña + conjunto + anuncio y aplica lo que se haya pedido al final.
 *
 * Si algo falla a mitad, lo ya creado se queda EN PAUSA en Meta y se dice
 * exactamente por dónde se quedó. No se borra nada por nuestra cuenta: borrar
 * en Meta lo que quizá alguien quiera aprovechar es peor que dejarlo parado.
 */
export async function crearCampanaCompletaAction(
  input: CrearCampanaCompletaInput,
): Promise<Resultado<ResultadoCreacion>> {
  const parsed = crearSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  const d = parsed.data;

  const c = await contexto();
  if (!c.ok) return c;
  const { ctx } = c;

  const presupuestoCent = eurosACentimos(d.presupuestoDiarioEuros);

  // Antes de crear nada: si va a activarse, que quepa en el tope del mes.
  let avisoGasto: string | null = null;
  if (d.publicacion === "ahora") {
    if (!d.confirmado) return fallo("Publicar ahora gasta dinero real: hay que confirmarlo.");

    let gasto;
    try {
      gasto = await getGastoDelMes(ctx.admin, ctx.empresaId, ctx.cred.topeGastoMensualCent);
    } catch (err) {
      return fallo(
        `No se ha podido comprobar el gasto del mes, así que no se publica nada: ${
          err instanceof Error ? err.message : "error desconocido"
        }`,
      );
    }
    if (gasto.bloqueado) {
      return fallo(
        `Tope de gasto alcanzado: llevas ${centimosAEuros(gasto.gastadoCent)} € de ${centimosAEuros(
          gasto.topeCent,
        )} € este mes. Puedes dejarla en borrador y activarla cuando subas el tope.`,
      );
    }
    if (gasto.topeCent != null && gasto.gastadoCent > gasto.topeCent * 0.8) {
      avisoGasto = `Ojo: llevas ${centimosAEuros(gasto.gastadoCent)} € de ${centimosAEuros(gasto.topeCent)} € este mes.`;
    }
  }

  // Un vídeo a medio procesar hace que Meta rechace el anuncio.
  if (d.formato === "video" && d.videoId) {
    try {
      const estado = await getEstadoVideo(ctx.cred, d.videoId);
      if (estado.estado === "error") {
        return fallo("Meta no ha podido procesar el vídeo. Prueba a subirlo otra vez.");
      }
      if (estado.estado !== "listo") {
        return fallo(
          `El vídeo todavía se está procesando en Meta (${estado.progreso}%). Espera a que termine y vuelve a intentarlo.`,
        );
      }
    } catch {
      return fallo("No se ha podido comprobar si el vídeo está listo.");
    }
  }

  const objetivo = d.objetivo as keyof typeof OBJETIVOS;
  let campanaId = "";
  let conjuntoId = "";

  try {
    campanaId = await crearCampana(ctx.cred, { nombre: d.nombre, objetivo });

    conjuntoId = await crearConjunto(ctx.cred, {
      nombre: `${d.nombre} — público`,
      campanaMetaId: campanaId,
      objetivo,
      presupuestoDiarioCent: presupuestoCent,
      edadMin: d.edadMin,
      edadMax: d.edadMax,
      genero: d.genero,
      ciudades: d.ciudades,
      paises: d.paises,
      intereses: d.intereses,
      plataformas: d.plataformas,
      inicioIso: d.inicioIso,
      finIso: d.finIso,
    });

    // La miniatura del vídeo la exige Meta; se coge la que él mismo genera.
    let miniaturaHash: string | undefined;
    if (d.formato === "video" && d.videoId) {
      const estado = await getEstadoVideo(ctx.cred, d.videoId);
      if (estado.miniatura) {
        miniaturaHash = (await subirMiniaturaDeVideo(ctx.cred, estado.miniatura, d.nombre)) ?? undefined;
      }
    }

    const { anuncioId } = await crearAnuncio(ctx.cred, {
      nombre: `${d.nombre} — anuncio`,
      conjuntoMetaId: conjuntoId,
      texto: d.texto,
      titular: d.titular,
      descripcion: d.descripcionAnuncio,
      enlace: d.enlace,
      boton: d.boton as keyof typeof BOTONES,
      formato: d.formato,
      imageHash: d.imageHash,
      videoId: d.videoId,
      miniaturaHash,
      tarjetas: d.tarjetas?.map((t) => ({
        imageHash: t.imageHash,
        titular: t.titular,
        descripcion: t.descripcion,
        enlace: t.enlace || d.enlace,
      })),
    });

    // Queda en el espejo marcada como creada aquí, sin esperar al cron.
    await ctx.admin.from("meta_campanas").upsert(
      {
        empresa_id: ctx.empresaId,
        meta_id: campanaId,
        nombre: d.nombre,
        objetivo: OBJETIVOS[objetivo].metaObjective,
        estado: "PAUSED",
        estado_efectivo: "PAUSED",
        presupuesto_diario_cent: presupuestoCent,
        creada_en_software: true,
      },
      { onConflict: "empresa_id,meta_id" },
    );

    await registrar(ctx, campanaId, "crear", {
      objetivo,
      formato: d.formato,
      presupuestoCent,
      plataformas: d.plataformas,
    });

    // ─── Qué hacer con ella ───────────────────────────────────
    if (d.publicacion === "ahora") {
      await cambiarEstado(ctx.cred, campanaId, "ACTIVE");
      await cambiarEstado(ctx.cred, conjuntoId, "ACTIVE");
      await cambiarEstado(ctx.cred, anuncioId, "ACTIVE");
      await ctx.admin
        .from("meta_campanas")
        .update({ estado: "ACTIVE" })
        .eq("empresa_id", ctx.empresaId)
        .eq("meta_id", campanaId);
      await registrar(ctx, campanaId, "activar", { desde: "creacion" });

      return {
        ok: true,
        data: { campanaId, conjuntoId, anuncioId, estado: "activa", programadaPara: null, avisoGasto },
      };
    }

    if (d.publicacion === "programar" && d.programarPara) {
      const zona = await getZonaHorariaEmpresa(ctx.admin, ctx.empresaId);
      const arrancarAt = horaEmpresaAUtc(d.programarPara, zona);
      if (!arrancarAt) return fallo("La fecha y hora no se han entendido.");
      if (new Date(arrancarAt).getTime() <= Date.now()) {
        return fallo("Esa hora ya ha pasado. Elige una futura o publícala ahora.");
      }

      const { error } = await ctx.admin.from("meta_programaciones").insert({
        empresa_id: ctx.empresaId,
        campana_meta_id: campanaId,
        arrancar_at: arrancarAt,
        zona_horaria: zona,
        creada_por: ctx.userId,
      });
      if (error) return fallo(`La campaña se ha creado pero no se ha podido programar: ${error.message}`);

      await registrar(ctx, campanaId, "programar", { arrancarAt, zona });

      return {
        ok: true,
        data: { campanaId, conjuntoId, anuncioId, estado: "programada", programadaPara: arrancarAt, avisoGasto },
      };
    }

    return {
      ok: true,
      data: { campanaId, conjuntoId, anuncioId, estado: "borrador", programadaPara: null, avisoGasto },
    };
  } catch (err) {
    const motivo = err instanceof MetaApiError ? err.message : err instanceof Error ? err.message : "Error";
    // Se dice hasta dónde llegó: lo creado queda en pausa, sin gastar.
    const hasta = !campanaId
      ? "No se ha llegado a crear nada."
      : !conjuntoId
        ? "La campaña se ha creado y está en pausa; falló al crear el público."
        : "La campaña y el público están creados y en pausa; falló al crear el anuncio.";
    return fallo(`${motivo} ${hasta}`);
  }
}

async function registrar(
  ctx: Contexto,
  metaId: string,
  accion: string,
  detalle: Record<string, unknown>,
): Promise<void> {
  const { data: usuario } = await ctx.admin
    .from("usuarios")
    .select("nombre, apellidos")
    .eq("id", ctx.userId)
    .maybeSingle<{ nombre: string | null; apellidos: string | null }>();

  const nombre = [usuario?.nombre, usuario?.apellidos].filter((x) => x && x.trim()).join(" ").trim();

  await ctx.admin.from("meta_acciones").insert({
    empresa_id: ctx.empresaId,
    usuario_id: ctx.userId,
    usuario_nombre: nombre || null,
    nivel: "campana",
    meta_id: metaId,
    accion,
    detalle,
  });
}

/**
 * "2026-09-20T18:00" en la zona de la empresa → instante real en UTC.
 *
 * Sin esto, programar a las seis de la tarde saldría a la hora del navegador de
 * quien la creó. Iván trabaja desde Indonesia: sus seis de la tarde son las
 * once de la mañana en Madrid, y el anuncio arrancaría con siete horas de
 * adelanto sobre lo que quería.
 */
function horaEmpresaAUtc(local: string, zona: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, a, mes, dia, h, min] = m;

  // Se parte de la hora tratada como UTC y se corrige por lo que esa zona
  // desviaba en ese preciso instante — así el horario de verano sale bien.
  const comoUtc = Date.parse(`${a}-${mes}-${dia}T${h}:${min}:00Z`);
  if (Number.isNaN(comoUtc)) return null;

  const desfase = desfaseZonaMs(new Date(comoUtc), zona);
  return new Date(comoUtc - desfase).toISOString();
}

/** Cuántos milisegundos va esa zona por delante de UTC en ese momento. */
function desfaseZonaMs(instante: Date, zona: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const parte of fmt.formatToParts(instante)) {
    if (parte.type !== "literal") p[parte.type] = parte.value;
  }
  const comoSiFueraUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour === "24" ? "00" : p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return comoSiFueraUtc - instante.getTime();
}
