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
  cambiarEstado,
  cambiarPresupuesto,
  renombrar,
  type EstadoMeta,
  type NivelEscritura,
} from "@/features/marketing/meta-ads/services/meta-escritura";
import { MetaApiError, centimosAEuros, eurosACentimos } from "@/features/marketing/meta-ads/lib/meta-api";

/**
 * PRP-087 · Fase 4 — Mandar sobre lo que ya existe en Meta.
 *
 * Todo lo que gasta dinero pasa por dos puertas, las dos EN EL SERVIDOR:
 *   1. el permiso del módulo (sin bypass de administrador), y
 *   2. el tope de gasto del mes.
 * Esconder un botón no protege nada: la acción se puede llamar igual.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const TABLA_POR_NIVEL: Record<NivelEscritura, string> = {
  campana: "meta_campanas",
  conjunto: "meta_conjuntos",
  anuncio: "meta_anuncios",
};

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
    return fallo("No tienes permiso para gestionar la publicidad de Meta.");
  }

  const admin = createAdminClient();
  const cred = await getMetaCredenciales(admin, empresaId);
  if (!cred) return fallo("Esta empresa no tiene Meta conectado. Ve a Ajustes → Integraciones.");

  return { ok: true, ctx: { empresaId, userId, cred, admin } };
}

/**
 * Deja constancia de qué empleado hizo qué. Nunca tumba la operación si falla:
 * no poder escribir el registro no puede impedir pausar una campaña.
 *
 * Se guarda el NOMBRE además del id. Si esa persona causa baja y su usuario se
 * borra, el id queda a NULL y sin el nombre no habría forma de saber quién
 * activó el gasto.
 */
async function registrarAccion(
  ctx: Contexto,
  nivel: NivelEscritura,
  metaId: string,
  accion: string,
  detalle: Record<string, unknown> = {},
): Promise<void> {
  const { data: usuario } = await ctx.admin
    .from("usuarios")
    .select("nombre, apellidos")
    .eq("id", ctx.userId)
    .maybeSingle<{ nombre: string | null; apellidos: string | null }>();

  const nombre = [usuario?.nombre, usuario?.apellidos]
    .filter((x) => x && x.trim())
    .join(" ")
    .trim();

  const { error } = await ctx.admin.from("meta_acciones").insert({
    empresa_id: ctx.empresaId,
    usuario_id: ctx.userId,
    usuario_nombre: nombre || null,
    nivel,
    meta_id: metaId,
    accion,
    detalle,
  });
  if (error) console.error("[meta] no se pudo registrar la acción:", error.message);
}

const estadoSchema = z.object({
  nivel: z.enum(["campana", "conjunto", "anuncio"]),
  metaId: z.string().trim().min(1),
  estado: z.enum(["ACTIVE", "PAUSED"]),
  /**
   * Activar gasta dinero: la pantalla tiene que haberlo preguntado y mandar
   * este sí explícito. Sin él, el servidor no activa aunque se le pida.
   */
  confirmado: z.boolean().optional(),
});

export type CambiarEstadoInput = z.input<typeof estadoSchema>;

/**
 * Activa o pausa un elemento de cualquiera de los tres niveles.
 *
 * Pausar nunca se bloquea: parar de gastar tiene que poder hacerse siempre,
 * incluso con el tope alcanzado o con la conexión medio rota.
 */
export async function cambiarEstadoMetaAction(
  input: CambiarEstadoInput,
): Promise<Resultado<{ estado: EstadoMeta; avisoGasto?: string }>> {
  const parsed = estadoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  const { nivel, metaId, estado, confirmado } = parsed.data;

  const c = await contexto();
  if (!c.ok) return c;
  const { ctx } = c;

  let avisoGasto: string | undefined;

  if (estado === "ACTIVE") {
    if (!confirmado) {
      return fallo("Activar gasta dinero real: hay que confirmarlo.");
    }

    // El tope de gasto del mes BLOQUEA, no avisa.
    let gasto;
    try {
      gasto = await getGastoDelMes(ctx.admin, ctx.empresaId, ctx.cred.topeGastoMensualCent);
    } catch (err) {
      return fallo(
        `No se ha podido comprobar el gasto del mes, así que no se activa nada: ${
          err instanceof Error ? err.message : "error desconocido"
        }`,
      );
    }

    if (gasto.bloqueado) {
      return fallo(
        `Tope de gasto alcanzado: llevas ${centimosAEuros(gasto.gastadoCent)} € de ${centimosAEuros(
          gasto.topeCent,
        )} € este mes. Para activar más, sube el tope en Ajustes → Integraciones → Meta.`,
      );
    }

    if (gasto.topeCent != null && gasto.gastadoCent > gasto.topeCent * 0.8) {
      avisoGasto = `Ojo: llevas ${centimosAEuros(gasto.gastadoCent)} € de ${centimosAEuros(
        gasto.topeCent,
      )} € este mes.`;
    }
  }

  try {
    await cambiarEstado(ctx.cred, metaId, estado);
  } catch (err) {
    if (err instanceof MetaApiError) return fallo(err.message);
    return fallo(err instanceof Error ? err.message : "Meta no ha aceptado el cambio.");
  }

  // El espejo se actualiza al momento para que la pantalla no mienta hasta el
  // siguiente refresco. La verdad sigue siendo Meta: el cron lo confirmará.
  await ctx.admin
    .from(TABLA_POR_NIVEL[nivel])
    .update({ estado })
    .eq("empresa_id", ctx.empresaId)
    .eq("meta_id", metaId);

  await registrarAccion(ctx, nivel, metaId, estado === "ACTIVE" ? "activar" : "pausar");

  return { ok: true, data: { estado, avisoGasto } };
}

const renombrarSchema = z.object({
  nivel: z.enum(["campana", "conjunto", "anuncio"]),
  metaId: z.string().trim().min(1),
  nombre: z.string().trim().min(1, "El nombre no puede estar vacío.").max(400),
});

export async function renombrarMetaAction(
  input: z.input<typeof renombrarSchema>,
): Promise<Resultado<{ nombre: string }>> {
  const parsed = renombrarSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  const { nivel, metaId, nombre } = parsed.data;

  const c = await contexto();
  if (!c.ok) return c;
  const { ctx } = c;

  try {
    await renombrar(ctx.cred, metaId, nombre);
  } catch (err) {
    if (err instanceof MetaApiError) return fallo(err.message);
    return fallo("Meta no ha aceptado el nuevo nombre.");
  }

  await ctx.admin
    .from(TABLA_POR_NIVEL[nivel])
    .update({ nombre })
    .eq("empresa_id", ctx.empresaId)
    .eq("meta_id", metaId);

  await registrarAccion(ctx, nivel, metaId, "renombrar", { nombre });
  return { ok: true, data: { nombre } };
}

const presupuestoSchema = z.object({
  nivel: z.enum(["campana", "conjunto"]),
  metaId: z.string().trim().min(1),
  tipo: z.enum(["diario", "total"]),
  euros: z
    .number({ message: "Pon un importe." })
    .positive("El presupuesto tiene que ser mayor que cero.")
    .max(100_000, "Ese presupuesto es demasiado alto, revísalo."),
});

/**
 * Cambia el presupuesto. Subirlo no activa nada por sí solo, pero sí puede
 * hacer que se gaste más rápido, así que se comprueba el tope igualmente
 * cuando el elemento está activo.
 */
export async function cambiarPresupuestoMetaAction(
  input: z.input<typeof presupuestoSchema>,
): Promise<Resultado<{ centimos: number }>> {
  const parsed = presupuestoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  const { nivel, metaId, tipo, euros } = parsed.data;

  const c = await contexto();
  if (!c.ok) return c;
  const { ctx } = c;

  const centimos = eurosACentimos(euros);

  try {
    await cambiarPresupuesto(ctx.cred, metaId, tipo, centimos);
  } catch (err) {
    if (err instanceof MetaApiError) return fallo(err.message);
    return fallo("Meta no ha aceptado el nuevo presupuesto.");
  }

  await ctx.admin
    .from(TABLA_POR_NIVEL[nivel])
    .update(
      tipo === "diario"
        ? { presupuesto_diario_cent: centimos }
        : { presupuesto_total_cent: centimos },
    )
    .eq("empresa_id", ctx.empresaId)
    .eq("meta_id", metaId);

  await registrarAccion(ctx, nivel, metaId, "presupuesto", { tipo, centimos });
  return { ok: true, data: { centimos } };
}
