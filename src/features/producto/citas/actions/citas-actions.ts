"use server";

/**
 * Citas comerciales (PRP-088) — lectura y escritura desde el software.
 *
 * Lo que se reserva desde fuera (el embudo) entra por el endpoint público; aquí
 * está lo que hace el equipo: mirar la agenda, configurar los calendarios de
 * cada estrategia y mover el estado de una cita.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { cancelarCitaEnGoogle } from "../services/google-calendar";
import type {
  Cita,
  CitaCalendario,
  CuentaGoogleElegible,
  CitaConDetalle,
  CitaDisponibilidad,
  CitaEstado,
  EmpleadoDeCalendario,
} from "../types";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

function revalidar() {
  revalidatePath("/producto/citas");
}

// ─────────────────────────── Calendarios ───────────────────────────

export async function listarCalendarios(): Promise<ActionResult<CitaCalendario[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data, error } = await supabase
      .from("citas_calendarios")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre");

    if (error) {
      console.error("[citas][listarCalendarios]", error.message);
      return { ok: false, error: "No se pudieron cargar los calendarios." };
    }
    return { ok: true, data: (data ?? []) as CitaCalendario[] };
  } catch (err) {
    console.error("[citas][listarCalendarios] fatal:", err);
    return { ok: false, error: friendlyError(err, "listarCalendarios") };
  }
}

const calendarioSchema = z.object({
  id: z.string().guid().optional(),
  nombre: z.string().trim().min(1, "Ponle nombre al calendario").max(80),
  descripcion: z.string().trim().max(500).nullable().optional(),
  duracion_min: z.number().int().min(5).max(480),
  paso_min: z.number().int().min(5).max(240),
  antelacion_min_horas: z.number().int().min(0).max(720),
  dias_vista: z.number().int().min(1).max(365),
  color: z.string().trim().max(20).nullable().optional(),
  activo: z.boolean(),
  /** Cuenta de Google elegida en el engranaje. null = el calendario vive solo dentro del software. */
  google_cuenta_email: z.string().trim().email().max(200).nullable().optional(),
});

export type CalendarioInput = z.infer<typeof calendarioSchema>;

export async function guardarCalendario(input: CalendarioInput): Promise<ActionResult<string>> {
  try {
    const parsed = calendarioSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    // Quién presta el permiso de Google. Los tokens de cada cuenta viven en la
    // fila de SU usuario (`google_cuentas_usuario`, RLS: cada uno ve la suya),
    // así que solo se puede designar una cuenta que uno mismo tenga conectada.
    // Si el calendario ya apuntaba a la cuenta de otra persona y no se toca, se
    // respeta tal cual: cambiarla a ciegas dejaría las citas sin apuntar.
    const emailElegido = parsed.data.google_cuenta_email?.trim().toLowerCase() || null;
    let googleUserId: string | null = null;
    if (emailElegido) {
      const { readAccounts } = await import("@/lib/google/accounts");
      const propias = await readAccounts();
      const mia = propias.find((c) => c.email?.toLowerCase() === emailElegido);
      if (mia) {
        googleUserId = userId;
      } else {
        const { data: previo } = parsed.data.id
          ? await supabase
              .from("citas_calendarios")
              .select("google_cuenta_email, google_user_id")
              .eq("id", parsed.data.id)
              .eq("empresa_id", empresaId)
              .maybeSingle()
          : { data: null };
        const fila = previo as
          | { google_cuenta_email?: string | null; google_user_id?: string | null }
          | null;
        if (fila?.google_cuenta_email?.toLowerCase() === emailElegido && fila.google_user_id) {
          googleUserId = fila.google_user_id;
        } else {
          return {
            ok: false,
            error: "Esa cuenta de Google no está conectada aquí. Conéctala arriba y vuelve a elegirla.",
          };
        }
      }
    }

    const fila = {
      ...parsed.data,
      google_cuenta_email: emailElegido,
      google_user_id: googleUserId,
      empresa_id: empresaId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = parsed.data.id
      ? await supabase
          .from("citas_calendarios")
          .update(fila)
          .eq("id", parsed.data.id)
          .eq("empresa_id", empresaId)
          .select("id")
          .single()
      : await supabase.from("citas_calendarios").insert(fila).select("id").single();

    if (error) {
      console.error("[citas][guardarCalendario]", error.message);
      return { ok: false, error: "No se pudo guardar el calendario." };
    }
    revalidar();
    return { ok: true, data: (data as { id: string }).id };
  } catch (err) {
    console.error("[citas][guardarCalendario] fatal:", err);
    return { ok: false, error: friendlyError(err, "guardarCalendario") };
  }
}

export async function borrarCalendario(id: string): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    // Un calendario con citas NO se borra: se desactiva. Borrarlo se llevaría
    // por delante el historial de reuniones que ya se han celebrado.
    const { count } = await supabase
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq("calendario_id", id);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: "Este calendario tiene citas. Desactívalo en vez de borrarlo, para no perder el historial.",
      };
    }

    const { error } = await supabase
      .from("citas_calendarios")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[citas][borrarCalendario]", error.message);
      return { ok: false, error: "No se pudo borrar el calendario." };
    }
    revalidar();
    return { ok: true };
  } catch (err) {
    console.error("[citas][borrarCalendario] fatal:", err);
    return { ok: false, error: friendlyError(err, "borrarCalendario") };
  }
}

// ─────────────────────── Disponibilidad y equipo ───────────────────────

export async function listarDisponibilidad(
  calendarioId: string,
): Promise<ActionResult<CitaDisponibilidad[]>> {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = await supabase
      .from("citas_disponibilidad")
      .select("*")
      .eq("calendario_id", calendarioId)
      .order("dia_semana")
      .order("hora_inicio");

    if (error) {
      console.error("[citas][listarDisponibilidad]", error.message);
      return { ok: false, error: "No se pudo cargar el horario." };
    }
    return { ok: true, data: (data ?? []) as CitaDisponibilidad[] };
  } catch (err) {
    console.error("[citas][listarDisponibilidad] fatal:", err);
    return { ok: false, error: friendlyError(err, "listarDisponibilidad") };
  }
}

/**
 * Cuentas de Google que se pueden poner en un calendario: las que tiene
 * conectadas quien está mirando. Nunca sale de aquí el `refreshToken`.
 *
 * Si el calendario ya apunta a una cuenta que la conectó otra persona, se
 * añade a la lista marcada como ajena, para que al guardar no se pierda.
 */
export async function cuentasGoogleElegibles(
  calendarioId?: string,
): Promise<ActionResult<CuentaGoogleElegible[]>> {
  try {
    const { readAccounts } = await import("@/lib/google/accounts");
    const propias = await readAccounts();
    const lista: CuentaGoogleElegible[] = propias
      .filter((c) => c.email)
      .map((c) => ({ email: c.email, nombre: c.name || c.email, propia: true }));

    if (calendarioId) {
      const { supabase, empresaId } = await getAppContext();
      if (empresaId) {
        const { data } = await supabase
          .from("citas_calendarios")
          .select("google_cuenta_email")
          .eq("id", calendarioId)
          .eq("empresa_id", empresaId)
          .maybeSingle();
        const puesta = (data as { google_cuenta_email?: string | null } | null)?.google_cuenta_email;
        if (puesta && !lista.some((c) => c.email.toLowerCase() === puesta.toLowerCase())) {
          lista.push({ email: puesta, nombre: puesta, propia: false });
        }
      }
    }
    return { ok: true, data: lista };
  } catch (err) {
    console.error("[citas][cuentasGoogleElegibles] fatal:", err);
    return { ok: false, error: friendlyError(err, "cuentasGoogleElegibles") };
  }
}

const franjaSchema = z.object({
  empleado_id: z.string().guid().nullable(),
  dia_semana: z.number().int().min(1).max(7),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/),
});

/** Sustituye TODO el horario del calendario: es más simple de entender que ir franja a franja. */
export async function guardarDisponibilidad(
  calendarioId: string,
  franjas: z.infer<typeof franjaSchema>[],
): Promise<ActionResult> {
  try {
    const parsed = z.array(franjaSchema).safeParse(franjas);
    if (!parsed.success) return { ok: false, error: "Horario inválido." };
    for (const f of parsed.data) {
      if (f.hora_fin <= f.hora_inicio) {
        return { ok: false, error: "La hora de fin tiene que ser posterior a la de inicio." };
      }
    }

    const { supabase } = await getAppContext();
    const { error: errDel } = await supabase
      .from("citas_disponibilidad")
      .delete()
      .eq("calendario_id", calendarioId);
    if (errDel) {
      console.error("[citas][guardarDisponibilidad] borrado:", errDel.message);
      return { ok: false, error: "No se pudo guardar el horario." };
    }

    if (parsed.data.length > 0) {
      const { error } = await supabase
        .from("citas_disponibilidad")
        .insert(parsed.data.map((f) => ({ ...f, calendario_id: calendarioId })));
      if (error) {
        console.error("[citas][guardarDisponibilidad]", error.message);
        return { ok: false, error: "No se pudo guardar el horario." };
      }
    }
    revalidar();
    return { ok: true };
  } catch (err) {
    console.error("[citas][guardarDisponibilidad] fatal:", err);
    return { ok: false, error: friendlyError(err, "guardarDisponibilidad") };
  }
}

export async function empleadosDelCalendario(
  calendarioId: string,
): Promise<ActionResult<string[]>> {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = await supabase
      .from("citas_calendario_empleados")
      .select("empleado_id")
      .eq("calendario_id", calendarioId);

    if (error) {
      console.error("[citas][empleadosDelCalendario]", error.message);
      return { ok: false, error: "No se pudo cargar el equipo." };
    }
    return { ok: true, data: (data ?? []).map((f) => (f as { empleado_id: string }).empleado_id) };
  } catch (err) {
    console.error("[citas][empleadosDelCalendario] fatal:", err);
    return { ok: false, error: friendlyError(err, "empleadosDelCalendario") };
  }
}

export async function asignarEmpleados(
  calendarioId: string,
  empleadoIds: string[],
): Promise<ActionResult> {
  try {
    const parsed = z.array(z.string().guid()).safeParse(empleadoIds);
    if (!parsed.success) return { ok: false, error: "Empleados inválidos." };

    const { supabase } = await getAppContext();
    const { error: errDel } = await supabase
      .from("citas_calendario_empleados")
      .delete()
      .eq("calendario_id", calendarioId);
    if (errDel) {
      console.error("[citas][asignarEmpleados] borrado:", errDel.message);
      return { ok: false, error: "No se pudo guardar el equipo." };
    }

    if (parsed.data.length > 0) {
      const { error } = await supabase
        .from("citas_calendario_empleados")
        .insert(parsed.data.map((empleado_id) => ({ calendario_id: calendarioId, empleado_id })));
      if (error) {
        console.error("[citas][asignarEmpleados]", error.message);
        return { ok: false, error: "No se pudo guardar el equipo." };
      }
    }
    revalidar();
    return { ok: true };
  } catch (err) {
    console.error("[citas][asignarEmpleados] fatal:", err);
    return { ok: false, error: friendlyError(err, "asignarEmpleados") };
  }
}

/** Empleados activos de la empresa, para el lateral y para asignar equipo. */
export async function listarEmpleados(): Promise<ActionResult<EmpleadoDeCalendario[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data, error } = await supabase
      .from("empleados")
      .select("id, nombre, apellidos")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo")
      .order("nombre");

    if (error) {
      console.error("[citas][listarEmpleados]", error.message);
      return { ok: false, error: "No se pudieron cargar los empleados." };
    }
    return {
      ok: true,
      data: (data ?? []).map((e) => {
        const f = e as { id: string; nombre: string | null; apellidos: string | null };
        return { id: f.id, nombre: [f.nombre, f.apellidos].filter(Boolean).join(" ").trim() || "Sin nombre" };
      }),
    };
  } catch (err) {
    console.error("[citas][listarEmpleados] fatal:", err);
    return { ok: false, error: friendlyError(err, "listarEmpleados") };
  }
}

// ────────────────────────────── Citas ──────────────────────────────

/**
 * Citas dentro de un rango. El rango lo decide la vista: un mes o un año
 * entero. Se piden solo las columnas que se pintan.
 */
export async function listarCitas(
  desdeISO: string,
  hastaISO: string,
): Promise<ActionResult<CitaConDetalle[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data, error } = await supabase
      .from("citas")
      .select(
        `id, empresa_id, calendario_id, empleado_id, cliente_id, inicio, fin, estado,
         pagina_id, origen, notas, google_event_id, google_cuenta_email, google_meet_url,
         created_at, updated_at,
         citas_calendarios(nombre, color),
         empleados(nombre, apellidos),
         clientes_sala(nombre, apellidos, email, telefono)`,
      )
      .eq("empresa_id", empresaId)
      .gte("inicio", desdeISO)
      .lt("inicio", hastaISO)
      .order("inicio");

    if (error) {
      console.error("[citas][listarCitas]", error.message);
      return { ok: false, error: "No se pudieron cargar las citas." };
    }

    const citas = (data ?? []).map((fila) => {
      const f = fila as Record<string, unknown>;
      const cal = f.citas_calendarios as { nombre?: string; color?: string } | null;
      const emp = f.empleados as { nombre?: string; apellidos?: string } | null;
      const cli = f.clientes_sala as
        | { nombre?: string; apellidos?: string; email?: string; telefono?: string }
        | null;
      return {
        ...(f as unknown as Cita),
        calendario_nombre: cal?.nombre ?? null,
        calendario_color: cal?.color ?? null,
        empleado_nombre: emp ? [emp.nombre, emp.apellidos].filter(Boolean).join(" ").trim() : null,
        cliente_nombre: cli ? [cli.nombre, cli.apellidos].filter(Boolean).join(" ").trim() || null : null,
        cliente_email: cli?.email ?? null,
        cliente_telefono: cli?.telefono ?? null,
      } as CitaConDetalle;
    });

    return { ok: true, data: citas };
  } catch (err) {
    console.error("[citas][listarCitas] fatal:", err);
    return { ok: false, error: friendlyError(err, "listarCitas") };
  }
}

export async function cambiarEstadoCita(id: string, estado: CitaEstado): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { error } = await supabase
      .from("citas")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[citas][cambiarEstadoCita]", error.message);
      return { ok: false, error: "No se pudo cambiar el estado." };
    }

    // Cancelar aquí y dejar el hueco ocupado en Google sería peor que no
    // sincronizar: el comercial vería una reunión que ya no existe.
    if (estado === "CANCELADA") {
      void cancelarCitaEnGoogle(id).catch((e) =>
        console.error("[citas][cambiarEstadoCita] google:", e),
      );
    }

    revalidar();
    return { ok: true };
  } catch (err) {
    console.error("[citas][cambiarEstadoCita] fatal:", err);
    return { ok: false, error: friendlyError(err, "cambiarEstadoCita") };
  }
}
