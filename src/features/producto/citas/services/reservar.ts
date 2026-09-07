/**
 * Reservar una cita desde fuera (PRP-088).
 *
 * Lo hace un visitante anónimo que viene de un embudo, así que se ejecuta con
 * cliente de servicio y **nunca** se fía de lo que llega: la hora se vuelve a
 * comprobar contra los huecos reales antes de guardar nada.
 *
 * Quien reserva queda como CLIENTE del software (la misma ficha que Producto →
 * Clientes): es una persona a la que hay que seguir la pista, no una fila
 * suelta en un formulario.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { zonaHorariaDeConfig } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona, zonaLocalAUtcISO } from "@/features/empresa/lib/zona-horaria";
import { normalizarTelefono, validarTelefono, validarEmail } from "@/shared/lib/validar-contacto";
import { huecosLibres } from "./huecos";

export interface DatosReserva {
  calendarioId: string;
  /** "AAAA-MM-DD" en la hora de la empresa. */
  fecha: string;
  /** "HH:MM" en la hora de la empresa. */
  hora: string;
  nombre: string;
  email: string;
  telefono: string;
  notas?: string | null;
  paginaId?: string | null;
  origen?: string | null;
}

export type ResultadoReserva =
  | { ok: true; citaId: string; inicioISO: string; zonaHoraria: string }
  | { ok: false; error: string };

export async function reservarCita(datos: DatosReserva): Promise<ResultadoReserva> {
  const supabase = createAdminClient();

  const nombre = datos.nombre.trim();
  const email = datos.email.trim().toLowerCase();
  const telefono = datos.telefono.trim();

  if (!nombre) return { ok: false, error: "Falta el nombre." };
  const okEmail = validarEmail(email, true);
  if (!okEmail.ok) return { ok: false, error: okEmail.error };
  // El teléfono tiene que llevar país: es la norma del software para cualquier
  // vía de alta, y sin ella se repite el destrozo de los datos importados.
  const okTel = validarTelefono(telefono, true);
  if (!okTel.ok) return { ok: false, error: okTel.error };

  const { data: calRow } = await supabase
    .from("citas_calendarios")
    .select("id, empresa_id, nombre, duracion_min, activo, google_cuenta_email, google_user_id")
    .eq("id", datos.calendarioId)
    .maybeSingle();
  if (!calRow) return { ok: false, error: "Calendario no encontrado." };
  const calendario = calRow as {
    id: string;
    empresa_id: string;
    nombre: string;
    duracion_min: number;
    activo: boolean;
    google_cuenta_email: string | null;
    google_user_id: string | null;
  };
  if (!calendario.activo) return { ok: false, error: "Este calendario no admite reservas." };

  const { data: empRow } = await supabase
    .from("empresas")
    .select("id, datos_generales")
    .eq("id", calendario.empresa_id)
    .maybeSingle();
  const zonaHoraria = zonaHorariaDeConfig((empRow as { datos_generales?: unknown } | null)?.datos_generales);

  // El hueco se recalcula aquí: el navegador pudo enseñar una lista de hace
  // diez minutos, o alguien pudo mandar una hora a mano.
  const disponibles = await huecosLibres(
    supabase,
    calendario.id,
    zonaHoraria,
    hoyEnZona(zonaHoraria),
  );
  if (!disponibles.ok) return { ok: false, error: disponibles.error };
  const delDia = disponibles.dias.find((d) => d.fecha === datos.fecha);
  if (!delDia?.horas.includes(datos.hora)) {
    return { ok: false, error: "Esa hora ya no está libre. Elige otra, por favor." };
  }

  const inicioISO = zonaLocalAUtcISO(datos.fecha, datos.hora, zonaHoraria);
  const finISO = new Date(new Date(inicioISO).getTime() + calendario.duracion_min * 60_000).toISOString();

  // ── El cliente: si ya existe por correo o teléfono, se reutiliza su ficha ──
  const telNormalizado = normalizarTelefono(telefono);
  const filtros = [`email_normalizado.eq.${email}`];
  if (telNormalizado) filtros.push(`telefono_normalizado.eq.${telNormalizado}`);

  const { data: existente } = await supabase
    .from("clientes_sala")
    .select("id")
    .eq("empresa_id", calendario.empresa_id)
    .or(filtros.join(","))
    .limit(1)
    .maybeSingle();

  let clienteId = (existente as { id?: string } | null)?.id ?? null;

  if (!clienteId) {
    const { data: creado, error: errCliente } = await supabase
      .from("clientes_sala")
      .insert({
        empresa_id: calendario.empresa_id,
        nombre,
        email,
        telefono,
        origen: datos.origen ?? "Web",
      })
      .select("id")
      .single();
    if (errCliente || !creado) {
      console.error("[citas][reservar] cliente:", errCliente?.message);
      return { ok: false, error: "No se pudo guardar tus datos." };
    }
    clienteId = (creado as { id: string }).id;
  }

  // ── Quién atiende: el primero del equipo del calendario ──
  const { data: equipo } = await supabase
    .from("citas_calendario_empleados")
    .select("empleado_id")
    .eq("calendario_id", calendario.id)
    .limit(1);
  const empleadoId = ((equipo ?? [])[0] as { empleado_id?: string } | undefined)?.empleado_id ?? null;

  const { data: cita, error: errCita } = await supabase
    .from("citas")
    .insert({
      empresa_id: calendario.empresa_id,
      calendario_id: calendario.id,
      empleado_id: empleadoId,
      cliente_id: clienteId,
      inicio: inicioISO,
      fin: finISO,
      estado: "CONFIRMADA",
      pagina_id: datos.paginaId ?? null,
      origen: datos.origen ?? null,
      notas: datos.notas ?? null,
    })
    .select("id")
    .single();

  if (errCita || !cita) {
    // El índice único salta si dos personas cogen el mismo hueco a la vez: eso
    // no es un error del sistema, es que llegó tarde.
    const chocaron = errCita?.code === "23505";
    console.error("[citas][reservar] cita:", errCita?.message);
    return {
      ok: false,
      error: chocaron
        ? "Justo han cogido esa hora. Elige otra, por favor."
        : "No se pudo guardar la cita.",
    };
  }

  return {
    ok: true,
    citaId: (cita as { id: string }).id,
    inicioISO,
    zonaHoraria,
  };
}
