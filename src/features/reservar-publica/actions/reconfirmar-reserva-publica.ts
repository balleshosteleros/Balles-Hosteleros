"use server";

/**
 * Reconfirmación de una reserva por el propio cliente, desde el enlace del correo.
 *
 * Existe porque el circuito estaba a medias: el correo de reconfirmación salía
 * diciendo "nos has confirmado que vienes", pero no llevaba ningún botón con el
 * que confirmarlo — solo el de cancelar. El estado RECONFIRMADA existía en la
 * base de datos y nada lo activaba nunca.
 *
 * El acceso va por `reconfirmacion_token`, un secreto por reserva: con el id no
 * basta, así nadie puede tocar reservas ajenas probando identificadores.
 *
 * Dos respuestas posibles:
 *   · "Sí, confirmo que voy"  → estado RECONFIRMADA.
 *   · "No podré ir"           → cancela, con el mismo circuito que la página de
 *     cancelar (libera la mesa, avisa a Google, manda el correo y deja
 *     constancia si incumple la política).
 */

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ZONA_HORARIA_FALLBACK,
  zonaLocalAUtcISO,
} from "@/features/empresa/lib/zona-horaria";

/**
 * Zona horaria de los ajustes de la empresa. Igual que en la cancelación
 * pública: esta acción va con el cliente admin y sin sesión, así que se lee el
 * campo de la fila ya cargada en vez de usar `getZonaHorariaEmpresa()`.
 */
function tzDeEmpresa(configOperativa: unknown): string {
  const cfg = (configOperativa as Record<string, unknown> | null) ?? null;
  const tz = cfg && typeof cfg.zonaHoraria === "string" ? cfg.zonaHoraria.trim() : "";
  return tz || ZONA_HORARIA_FALLBACK;
}

// El token se genera con `crypto.randomUUID()` SIN guiones (mismo formato que
// `valoracion_token`), así que aquí no vale un `.guid()`: rechazaría todos.
const tokenSchema = z.string().regex(/^[0-9a-f]{32}$/);

export interface ReservaReconfirmable {
  estado: string;
  fecha: string;
  hora: string;
  personas: number;
  clienteNombre: string | null;
  empresaNombre: string;
  /** Para resolver el favicon: el icono es el del restaurante, no el del software. */
  empresaId: string;
  /** true si ya no admite respuesta (ya pasó, cancelada, sentada…). */
  bloqueada: boolean;
  motivoBloqueo: string | null;
  /** true si el cliente ya había respondido que sí. */
  yaReconfirmada: boolean;
  /** Aviso de cargo si dice que no viene fuera del plazo de la política. */
  avisoPolitica: { horas: number; importe: number } | null;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Datos de la reserva para pintar la pantalla de confirmación. */
export async function obtenerReservaPorTokenReconfirmacion(
  token: string,
): Promise<Result<ReservaReconfirmable>> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Enlace no válido." };

  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select(
        "id, empresa_id, estado, fecha, hora, personas, cliente_nombre, tiene_cancelacion, cancelacion_importe",
      )
      .eq("reconfirmacion_token", parsed.data)
      .maybeSingle();
    if (!r) return { ok: false, error: "No encontramos esa reserva." };

    const { data: emp } = await admin
      .from("empresas")
      .select("nombre, config_operativa")
      .eq("id", r.empresa_id as string)
      .maybeSingle();

    const { data: cfg } = await admin
      .from("empresa_reservas_config")
      .select("cancelacion_horas_antes")
      .eq("empresa_id", r.empresa_id as string)
      .maybeSingle();

    const tz = tzDeEmpresa(emp?.config_operativa);
    const estado = r.estado as string;

    return {
      ok: true,
      data: {
        estado,
        fecha: r.fecha as string,
        hora: (r.hora as string).slice(0, 5),
        personas: (r.personas as number) ?? 1,
        clienteNombre: (r.cliente_nombre as string | null) ?? null,
        empresaNombre: (emp?.nombre as string | undefined) ?? "el restaurante",
        empresaId: r.empresa_id as string,
        bloqueada:
          motivoNoReconfirmable(estado, r.fecha as string, r.hora as string, tz) !==
          null,
        motivoBloqueo: motivoNoReconfirmable(
          estado,
          r.fecha as string,
          r.hora as string,
          tz,
        ),
        yaReconfirmada: estado === "RECONFIRMADA",
        avisoPolitica: calcularAvisoPolitica(
          cfg,
          {
            tieneCancelacion: r.tiene_cancelacion === true,
            importe: Number(r.cancelacion_importe ?? 0),
          },
          r.fecha as string,
          r.hora as string,
          tz,
        ),
      },
    };
  } catch (err) {
    console.error("[reconfirmar-publica][obtener]", err);
    return { ok: false, error: "No pudimos cargar la reserva." };
  }
}

/** "Sí, confirmo que voy" → la reserva pasa a RECONFIRMADA. */
export async function reconfirmarReservaPorToken(
  token: string,
): Promise<Result<{ reconfirmada: true }>> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Enlace no válido." };

  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select("id, empresa_id, estado, fecha, hora")
      .eq("reconfirmacion_token", parsed.data)
      .maybeSingle();
    if (!r) return { ok: false, error: "No encontramos esa reserva." };

    const estado = r.estado as string;
    if (estado === "RECONFIRMADA") {
      // Ya estaba: para el cliente no es un error, es lo que quería. Pulsar dos
      // veces el botón del correo no puede dar pantalla de fallo.
      return { ok: true, data: { reconfirmada: true } };
    }

    const { data: empTz } = await admin
      .from("empresas")
      .select("config_operativa")
      .eq("id", r.empresa_id as string)
      .maybeSingle();

    // Se revalida en servidor con el MISMO criterio que la pantalla: entre que
    // el cliente abre el enlace y pulsa, la reserva puede haber cambiado.
    const motivo = motivoNoReconfirmable(
      estado,
      r.fecha as string,
      r.hora as string,
      tzDeEmpresa(empTz?.config_operativa),
    );
    if (motivo) return { ok: false, error: motivo };

    const { error } = await admin
      .from("reservas")
      // `reconfirmada_at` es lo que Sala usa para saber CUÁNDO confirmó el
      // cliente, no solo que lo hizo. Se rellena aquí igual que cuando la
      // reconfirma un empleado a mano.
      .update({
        estado: "RECONFIRMADA",
        reconfirmada_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id as string);
    if (error) {
      console.error("[reconfirmar-publica][update]", error);
      return { ok: false, error: "No pudimos confirmar la reserva." };
    }

    // Sin correo de vuelta: el cliente está viendo la confirmación en pantalla
    // y acaba de recibir el correo que le trajo aquí. Otro más, para decirle lo
    // que acaba de hacer, solo llena su bandeja.
    return { ok: true, data: { reconfirmada: true } };
  } catch (err) {
    console.error("[reconfirmar-publica][reconfirmar]", err);
    return { ok: false, error: "No pudimos confirmar la reserva." };
  }
}

/**
 * "No podré ir" → cancela.
 *
 * No reimplementa la cancelación: traduce el token de reconfirmación al de
 * cancelación y delega en `cancelarReservaPorToken`, que ya libera la mesa,
 * devuelve el cupo a Google, manda el correo y deja constancia si se incumple
 * la política. Duplicar ese circuito aquí habría sido la forma segura de que
 * los dos caminos acabaran comportándose distinto.
 */
export async function rechazarReservaPorToken(
  token: string,
): Promise<Result<{ cancelada: true }>> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Enlace no válido." };

  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select("cancelacion_token")
      .eq("reconfirmacion_token", parsed.data)
      .maybeSingle();
    if (!r) return { ok: false, error: "No encontramos esa reserva." };

    const tokenCancelar = (r.cancelacion_token as string | null) ?? null;
    if (!tokenCancelar) {
      // Sin token de cancelación no hay forma seria de cancelar por la vía
      // pública. Es un caso que no debería darse (toda reserva lo estrena al
      // crearse), así que se dice y se traza en vez de fallar en silencio.
      console.error("[reconfirmar-publica] reserva sin cancelacion_token");
      return {
        ok: false,
        error: "No pudimos cancelar la reserva. Llama al restaurante, por favor.",
      };
    }

    const { cancelarReservaPorToken } = await import(
      "./cancelar-reserva-publica"
    );
    return await cancelarReservaPorToken(tokenCancelar);
  } catch (err) {
    console.error("[reconfirmar-publica][rechazar]", err);
    return { ok: false, error: "No pudimos cancelar la reserva." };
  }
}

/**
 * ¿La reserva ya pasó, en la hora REAL del restaurante?
 *
 * `fecha`/`hora` son hora local de la empresa. `new Date("2026-08-19T21:00")`
 * las interpretaría en la zona del proceso (UTC en Vercel), desplazando la
 * comparación 1-2 h.
 */
function esPasada(fecha: string, hora: string, tz: string): boolean {
  const ts = Date.parse(zonaLocalAUtcISO(fecha, hora.slice(0, 5), tz));
  if (Number.isNaN(ts)) return false;
  return ts < Date.now();
}

/**
 * Por qué NO admite respuesta, con el motivo CONCRETO. Un "no se puede"
 * genérico deja al cliente sin saber si ha fallado la web o pasa algo con su
 * reserva, y acaba llamando igualmente al restaurante.
 *
 * Devuelve null si la reserva SÍ admite respuesta. RECONFIRMADA no se bloquea
 * aquí: es un estado válido de llegada, y quien vuelve a pulsar el enlace debe
 * ver su reserva confirmada, no un error.
 */
function motivoNoReconfirmable(
  estado: string,
  fecha: string,
  hora: string,
  tz: string,
): string | null {
  switch (estado) {
    case "CANCELADA":
      return "Esta reserva está cancelada. Si quieres volver a reservar, hazlo desde nuestra web.";
    case "NO_SHOW":
      return "Esta reserva se marcó como no presentada. Si crees que es un error, llama al restaurante.";
    case "SENTADA":
    case "TERMINANDO":
      return "Tu mesa ya está sentada, no hace falta que confirmes nada.";
    case "LIBERADA":
      return "Esta reserva ya no está activa. Si necesitas algo, llama al restaurante.";
  }
  if (esPasada(fecha, hora, tz)) {
    return "Tu reserva ya está en curso. Si necesitas algo, llama al restaurante.";
  }
  return null;
}

/**
 * Aviso de cargo antes de confirmar que NO viene. No cobramos aquí: solo
 * informamos de lo que el cliente aceptó al reservar.
 *
 * Mismo criterio que en la cancelación pública: el aviso sale SOLO si ESTA
 * reserva lleva política, no si la empresa la tiene activa — las condiciones se
 * evalúan al crear la reserva y quedan congeladas en `tiene_cancelacion` /
 * `cancelacion_importe`.
 */
function calcularAvisoPolitica(
  config: Record<string, unknown> | null,
  reserva: { tieneCancelacion: boolean; importe: number },
  fecha: string,
  hora: string,
  tz: string,
): { horas: number; importe: number } | null {
  if (!reserva.tieneCancelacion) return null;
  const importe = Number(reserva.importe ?? 0);
  if (!(importe > 0)) return null;

  const horas = Number(config?.cancelacion_horas_antes ?? 0);
  if (!(horas > 0)) return null;

  const ts = Date.parse(zonaLocalAUtcISO(fecha, hora.slice(0, 5), tz));
  if (Number.isNaN(ts)) return null;
  const faltanHoras = (ts - Date.now()) / 3_600_000;
  return faltanHoras < horas ? { horas, importe } : null;
}
