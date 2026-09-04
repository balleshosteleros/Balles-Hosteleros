"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { registrarCambioDatosCliente } from "@/features/sala/lib/cliente-actividad";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarNombre, normalizarNombreOrNull } from "@/shared/lib/normalizar-nombre";

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

/**
 * Cierra las revisiones pendientes de OTRAS reservas del mismo cliente cuyos
 * datos declarados ya coinciden con la ficha.
 *
 * Se llama después de actualizar una ficha: lo que esas reservas pedían revisar
 * es exactamente lo que se acaba de aplicar, así que el aviso se quedaría
 * comparando un dato consigo mismo. Las que declaren algo distinto (otra
 * persona con este teléfono) siguen pendientes, que para eso está la revisión.
 *
 * No lanza: es una limpieza. Si falla, el único efecto es que queda un aviso de
 * más, y eso no debe tumbar la resolución que el usuario ya ha confirmado.
 */
async function cerrarRevisionesSinDiferencias(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  clienteId: string,
  reservaYaResuelta: string,
): Promise<void> {
  try {
    const { data: fila } = await supabase
      .from("clientes_sala")
      .select("nombre, apellidos, email, telefono")
      .eq("id", clienteId)
      .maybeSingle();
    if (!fila) return;

    const { data: pendientes } = await supabase
      .from("reservas")
      .select("id, datos_declarados")
      .eq("cliente_id", clienteId)
      .eq("empresa_id", empresaId)
      .eq("vinculacion_estado", "PENDIENTE")
      .neq("id", reservaYaResuelta);
    if (!pendientes?.length) return;

    const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
    const ficha = fila as Record<string, unknown>;
    const CAMPOS = ["nombre", "apellidos", "email", "telefono"] as const;

    const resueltas = pendientes
      .filter((p) => {
        const d = (p.datos_declarados as DatosDeclaradosReserva | null) ?? {};
        // Sin nada declarado no hay nada que revisar; con algo declarado, basta
        // una diferencia real para que siga haciendo falta la revisión humana.
        return CAMPOS.every((c) => !d[c] || norm(d[c]) === norm(ficha[c]));
      })
      .map((p) => p.id as string);
    if (!resueltas.length) return;

    await supabase
      .from("reservas")
      .update({ vinculacion_estado: "ACTUALIZADA", datos_declarados: null })
      .in("id", resueltas)
      .eq("empresa_id", empresaId);
  } catch (err) {
    console.error("[reservas] cerrarRevisionesSinDiferencias:", err);
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
      if (declarados.nombre) patch.nombre = normalizarNombre(declarados.nombre);
      if (declarados.apellidos) patch.apellidos = normalizarNombre(declarados.apellidos);
      if (declarados.email) patch.email = declarados.email;
      if (declarados.telefono) patch.telefono = declarados.telefono;

      const { error: errC } = await supabase
        .from("clientes_sala")
        .update(patch)
        .eq("id", clienteId);
      if (errC) throw errC;

      // Las reservas van asociadas a una FICHA: si la ficha cambia de nombre,
      // cambian todas sus reservas. Si no, el mismo cliente aparecía con dos
      // nombres distintos en la misma lista según la reserva que se mirase.
      //
      // Actualizar solo ésta sería lo correcto si la reserva fuese de otra
      // persona que usó este teléfono, pero ese caso tiene su propia salida:
      // SEPARAR, que le hace ficha propia.
      //
      // Mismo criterio que `guardarDatosClienteReserva()` al editar desde la
      // ficha: todas las reservas del cliente, pasadas y futuras.
      const datosFicha = {
        cliente_nombre: declarados.nombre ?? r.cliente_nombre,
        cliente_apellidos: declarados.apellidos ?? r.cliente_apellidos,
        cliente_email: declarados.email ?? r.cliente_email,
        cliente_telefono: declarados.telefono ?? r.cliente_telefono,
      };

      const { error: errTodas } = await supabase
        .from("reservas")
        .update({ ...datosFicha, updated_at: new Date().toISOString() })
        .eq("cliente_id", clienteId)
        .eq("empresa_id", empresaId);
      if (errTodas) throw errTodas;

      const { error: errR2 } = await supabase
        .from("reservas")
        .update({
          vinculacion_estado: "ACTUALIZADA",
          datos_declarados: null,
        })
        .eq("id", reservaId)
        .eq("empresa_id", empresaId);
      if (errR2) throw errR2;

      // Otras reservas del cliente pendientes de revisar: la ficha acaba de
      // ponerse al día, así que las que declaraban justo estos datos ya no
      // tienen nada que revisar. Dejarlas pendientes obligaría a resolver a
      // mano el mismo caso una y otra vez, con un aviso que enfrenta un dato
      // consigo mismo. Las que declaren OTRA cosa siguen pendientes.
      await cerrarRevisionesSinDiferencias(supabase, empresaId, clienteId, reservaId);

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

    const nuevoNombre = normalizarNombre(declarados.nombre ?? (r.cliente_nombre as string));
    const { data: nuevo, error: errN } = await supabase
      .from("clientes_sala")
      .insert({
        empresa_id: empresaId,
        nombre: nuevoNombre,
        apellidos: normalizarNombreOrNull(declarados.apellidos),
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
