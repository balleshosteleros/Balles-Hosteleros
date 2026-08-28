"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { registrarCambioDatosCliente } from "@/features/sala/lib/cliente-actividad";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolución de una reserva vinculada a un cliente que ya existía.
 *
 * Una reserva engancha con una ficha cuando coincide el email O el teléfono
 * (nunca el nombre). Si el resto de datos no coinciden, la reserva queda
 * PENDIENTE: puede ser la misma persona con otro nombre, o alguien distinto
 * usando el móvil de un familiar. Eso lo decide el restaurante, no el sistema.
 *
 * Tres salidas:
 *   CONSERVAR  → manda la ficha; se descarta lo declarado.
 *   ACTUALIZAR → la ficha se queda con los datos nuevos.
 *   SEPARAR    → era otra persona; ficha propia y la reserva pasa a ella.
 */
export type ResolucionVinculacion = "CONSERVAR" | "ACTUALIZAR" | "SEPARAR";

export interface DatosDeclaradosReserva {
  nombre?: string;
  apellidos?: string;
  email?: string;
  telefono?: string;
}

/** Lo que necesita el panel de revisión para pintarse. */
export interface VinculacionPendiente {
  reservaId: string;
  motivo: "email" | "telefono";
  /** Datos vigentes de la ficha con la que enganchó. */
  ficha: {
    id: string;
    nombre: string;
    apellidos: string | null;
    email: string | null;
    telefono: string | null;
  };
  /** Lo que escribió quien reservó, sólo en los campos que difieren. */
  declarados: DatosDeclaradosReserva;
}

async function getCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, empresaId: null, usuarioId: null, nombre: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, apellidos")
    .eq("user_id", user.id)
    .single();
  return {
    supabase,
    empresaId,
    usuarioId: (data?.id as string | undefined) ?? null,
    nombre: data ? `${data.nombre} ${data.apellidos}` : null,
  };
}

/**
 * Datos del panel de revisión de una reserva. Devuelve `null` cuando no hay
 * nada pendiente, que es el caso normal.
 */
export async function getVinculacionPendiente(
  reservaId: string,
): Promise<{ ok: true; data: VinculacionPendiente | null } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    // El filtro por empresa va explícito: la RLS acota a las empresas DEL
    // usuario, no a la ACTIVA.
    const { data: r, error } = await supabase
      .from("reservas")
      .select("id, cliente_id, vinculacion_estado, vinculacion_motivo, datos_declarados")
      .eq("id", reservaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (!r || r.vinculacion_estado !== "PENDIENTE" || !r.cliente_id) {
      return { ok: true, data: null };
    }

    const { data: c } = await supabase
      .from("clientes_sala")
      .select("id, nombre, apellidos, email, telefono")
      .eq("id", r.cliente_id as string)
      .maybeSingle();
    if (!c) return { ok: true, data: null };

    return {
      ok: true,
      data: {
        reservaId: r.id as string,
        motivo: (r.vinculacion_motivo as "email" | "telefono" | null) ?? "telefono",
        ficha: {
          id: c.id as string,
          nombre: c.nombre as string,
          apellidos: (c.apellidos as string | null) ?? null,
          email: (c.email as string | null) ?? null,
          telefono: (c.telefono as string | null) ?? null,
        },
        declarados: (r.datos_declarados as DatosDeclaradosReserva | null) ?? {},
      },
    };
  } catch (err) {
    console.error("[reservas] getVinculacionPendiente:", err);
    return { ok: false, error: "No se pudo cargar la revisión" };
  }
}

/** Texto legible de lo declarado, para dejarlo escrito en la actividad. */
function resumirDeclarados(d: DatosDeclaradosReserva): string {
  const partes: string[] = [];
  const nombreCompleto = [d.nombre, d.apellidos].filter(Boolean).join(" ").trim();
  if (nombreCompleto) partes.push(nombreCompleto);
  if (d.email) partes.push(d.email);
  if (d.telefono) partes.push(d.telefono);
  return partes.join(" · ");
}

export async function resolverVinculacion(
  reservaId: string,
  resolucion: ResolucionVinculacion,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId, usuarioId, nombre } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    const { data: r, error: errR } = await supabase
      .from("reservas")
      .select(
        "id, cliente_id, fecha, vinculacion_estado, vinculacion_motivo, datos_declarados, cliente_nombre, cliente_apellidos, cliente_email, cliente_telefono",
      )
      .eq("id", reservaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (errR) throw errR;
    if (!r) return { ok: false, error: "Reserva no encontrada" };
    if (r.vinculacion_estado !== "PENDIENTE") {
      return { ok: false, error: "Esta reserva ya está revisada." };
    }

    const declarados = (r.datos_declarados as DatosDeclaradosReserva | null) ?? {};
    const motivo = (r.vinculacion_motivo as "email" | "telefono" | null) ?? "telefono";
    const motivoTxt = motivo === "email" ? "correo" : "teléfono";
    const clienteId = r.cliente_id as string | null;

    /** Una línea en la actividad de ESTA reserva. La actividad es inmutable. */
    const anotarReserva = async (campo: string, valor: string) => {
      const { error } = await supabase.from("reserva_historial").insert({
        empresa_id: empresaId,
        reserva_id: reservaId,
        campo,
        valor_anterior: null,
        valor_nuevo: valor,
        usuario_id: usuarioId,
        usuario_nombre: nombre,
        origen: "MANUAL",
      });
      if (error) console.error("[reservas] actividad vinculación:", error.message);
    };

    // ── CONSERVAR ─────────────────────────────────────────────────────────
    // La ficha manda. Se descarta lo declarado, pero queda escrito qué se
    // descartó: si mañana alguien pregunta por qué la reserva salió a otro
    // nombre, la respuesta está en la actividad.
    if (resolucion === "CONSERVAR") {
      const { error } = await supabase
        .from("reservas")
        .update({
          vinculacion_estado: "CONSERVADA",
          datos_declarados: null,
          // El correo vuelve al de la ficha: se ha decidido que es esa persona.
          cliente_email: r.cliente_email,
        })
        .eq("id", reservaId)
        .eq("empresa_id", empresaId);
      if (error) throw error;

      const resumen = resumirDeclarados(declarados);
      await anotarReserva(
        "vinculacion",
        `Se conservan los datos de la ficha. Coincidió por ${motivoTxt}.${resumen ? ` Se descartó: ${resumen}.` : ""}`,
      );
      revalidatePath("/sala/reservas");
      return { ok: true };
    }

    // ── ACTUALIZAR ────────────────────────────────────────────────────────
    // Es la misma persona y sus datos han cambiado: la ficha se pone al día y
    // la reserva pasa a verse con los datos nuevos.
    if (resolucion === "ACTUALIZAR") {
      if (!clienteId) return { ok: false, error: "La reserva no tiene ficha vinculada." };

      const { data: antes } = await supabase
        .from("clientes_sala")
        .select("nombre, apellidos, email, telefono")
        .eq("id", clienteId)
        .maybeSingle();

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (declarados.nombre) patch.nombre = declarados.nombre;
      if (declarados.apellidos) patch.apellidos = declarados.apellidos;
      if (declarados.email) patch.email = declarados.email;
      if (declarados.telefono) patch.telefono = declarados.telefono;

      const { error: errC } = await supabase
        .from("clientes_sala")
        .update(patch)
        .eq("id", clienteId);
      if (errC) throw errC;

      // El snapshot de ESTA reserva se realinea con la ficha ya actualizada.
      // Las reservas anteriores conservan el suyo: el histórico no se reescribe.
      const { error: errR2 } = await supabase
        .from("reservas")
        .update({
          cliente_nombre: declarados.nombre ?? r.cliente_nombre,
          cliente_apellidos: declarados.apellidos ?? r.cliente_apellidos,
          cliente_email: declarados.email ?? r.cliente_email,
          cliente_telefono: declarados.telefono ?? r.cliente_telefono,
          vinculacion_estado: "ACTUALIZADA",
          datos_declarados: null,
        })
        .eq("id", reservaId)
        .eq("empresa_id", empresaId);
      if (errR2) throw errR2;

      // Actividad del CLIENTE: una línea por campo. Cambiar un email no le
      // pasa a una reserva, le pasa a la persona.
      if (antes) {
        await registrarCambioDatosCliente(supabase as unknown as SupabaseClient, {
          empresaId,
          clienteId,
          antes: {
            nombre: (antes.nombre as string | null) ?? null,
            apellidos: (antes.apellidos as string | null) ?? null,
            email: (antes.email as string | null) ?? null,
            telefono: (antes.telefono as string | null) ?? null,
          },
          despues: {
            nombre: declarados.nombre ?? ((antes.nombre as string | null) ?? null),
            apellidos: declarados.apellidos ?? ((antes.apellidos as string | null) ?? null),
            email: declarados.email ?? ((antes.email as string | null) ?? null),
            telefono: declarados.telefono ?? ((antes.telefono as string | null) ?? null),
          },
          usuarioId,
          usuarioNombre: nombre,
          origen: "MANUAL",
        });
      }

      await anotarReserva(
        "vinculacion",
        `Se actualizó la ficha del cliente con los datos de esta reserva. Coincidió por ${motivoTxt}.`,
      );
      revalidatePath("/sala/reservas");
      revalidatePath("/sala/clientes");
      return { ok: true };
    }

    // ── SEPARAR ───────────────────────────────────────────────────────────
    // Son dos personas distintas (el caso del móvil compartido). Se crea ficha
    // propia y la reserva se pasa a ella. La ficha original no se toca.
    //
    // No se usa `find_or_link_cliente_sala` a propósito: esa RPC volvería a
    // engancharlas por el dato que comparten, que es justo lo que hay que
    // evitar aquí. El índice único es parcial por dato, así que dos fichas
    // pueden compartir teléfono mientras sus emails difieran.
    if (!declarados.nombre && !declarados.email && !declarados.telefono) {
      return { ok: false, error: "No hay datos nuevos con los que crear una ficha." };
    }

    const nuevoNombre = declarados.nombre ?? (r.cliente_nombre as string);
    const { data: nuevo, error: errN } = await supabase
      .from("clientes_sala")
      .insert({
        empresa_id: empresaId,
        nombre: nuevoNombre,
        apellidos: declarados.apellidos ?? null,
        email: declarados.email ?? null,
        // El teléfono sólo viaja a la ficha nueva si es distinto del que
        // provocó el enganche. Si el enganche FUE por teléfono, ese número es
        // del titular original y no puede duplicarse.
        telefono: motivo === "telefono" ? (declarados.telefono ?? null) : (r.cliente_telefono as string | null),
        clasificacion: "NUEVO",
        visitas: 0,
      })
      .select("id")
      .single();
    if (errN) {
      console.error("[reservas] separar cliente:", errN.message);
      return {
        ok: false,
        error: "No se pudo crear la ficha: alguno de los datos ya pertenece a otro cliente.",
      };
    }

    const { error: errR3 } = await supabase
      .from("reservas")
      .update({
        cliente_id: nuevo.id as string,
        cliente_nombre: nuevoNombre,
        cliente_apellidos: declarados.apellidos ?? null,
        cliente_email: declarados.email ?? null,
        cliente_telefono:
          motivo === "telefono"
            ? (declarados.telefono ?? null)
            : (r.cliente_telefono as string | null),
        vinculacion_estado: "SEPARADA",
        vinculacion_motivo: null,
        datos_declarados: null,
      })
      .eq("id", reservaId)
      .eq("empresa_id", empresaId);
    if (errR3) throw errR3;

    // La visita cambia de persona: se le cuenta a quien realmente vino.
    await supabase.rpc("registrar_visita_cliente_sala", {
      p_cliente_id: nuevo.id as string,
      p_fecha: r.fecha as string,
    });

    await anotarReserva(
      "vinculacion",
      `Era otro cliente: se creó ficha propia para ${resumirDeclarados(declarados) || nuevoNombre} y la reserva pasó a ella. Había coincidido por ${motivoTxt}.`,
    );
    revalidatePath("/sala/reservas");
    revalidatePath("/sala/clientes");
    return { ok: true };
  } catch (err) {
    console.error("[reservas] resolverVinculacion:", err);
    return { ok: false, error: "No se pudo resolver la vinculación" };
  }
}
