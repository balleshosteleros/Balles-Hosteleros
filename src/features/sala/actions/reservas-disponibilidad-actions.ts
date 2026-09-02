"use server";

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getReservasConfig } from "@/features/sala/actions/reservas-config-actions";
import { listHorariosExcepciones } from "@/features/sala/actions/reservas-horarios-excepciones-actions";
import { resolveHorarioReservas } from "@/features/sala/lib/horario-resolver";
import { getMesasBloqueadas } from "@/features/sala/bloqueos/lib/mesas-bloqueadas";
import {
  ESTADOS_NO_OCUPANTES,
  horaAMinutos,
  horaAMinutosJornada,
} from "@/features/sala/lib/reserva-conflicto";
import {
  DURACION_RESERVA_DEFAULT_MINUTOS,
  RESERVA_SLOT_MIN,
  type TurnoKey,
  type TurnoReserva,
} from "@/features/sala/data/reservas";

/**
 * Reserva que ya ocupa una mesa en la franja de un slot. Es lo que se le
 * enseña al usuario en el aviso de solape: con quién se va a pisar, cuánta
 * gente y hasta qué hora se queda.
 */
export interface ChoqueReserva {
  reservaId: string;
  /** Código de mesa tal cual está en BD ("R3" o "M1+M2" si es unión). */
  mesa: string;
  cliente: string;
  personas: number;
  /** HH:MM */
  horaInicio: string;
  /** HH:MM — inicio + duración real de ESA reserva. */
  horaFin: string;
}

/** Estado de una hora concreta para el grupo y la zona pedidos. */
export interface SlotDisponibilidad {
  /** HH:MM */
  hora: string;
  /**
   * true  → queda al menos una mesa de la zona, con capacidad para el grupo, libre.
   * false → todas las mesas capaces están ocupadas: reservar aquí PISA otra reserva.
   */
  hayMesaLibre: boolean;
  /** Códigos de las mesas capaces que están libres a esta hora. */
  mesasLibres: string[];
  /**
   * Códigos (en MAYÚSCULAS) de TODAS las mesas de la zona que están ocupadas a
   * esta hora, sean o no capaces para el grupo.
   *
   * `hayMesaLibre` solo mira las mesas capaces, pero el selector de mesa deja
   * elegir cualquiera de la zona: una mesa de 3 se puede dar a 2 comensales.
   * Sin esta lista, elegir esa mesa "no capaz" ya ocupada no marcaba peligro en
   * la hora, y se podía pisar una reserva sin ningún aviso.
   */
  mesasOcupadas: string[];
  /**
   * Reservas que se pisarían al reservar a esta hora, una por cada mesa capaz
   * ya ocupada. Solo se rellena cuando `hayMesaLibre` es false, que es cuando
   * el usuario necesita el detalle para decidir.
   */
  choques: ChoqueReserva[];
}

/** Reserva viva que ocupa una mesa física en una franja concreta. */
interface Ocupacion {
  reservaId: string;
  mesa: string;
  cliente: string;
  personas: number;
  inicioMin: number;
  finMin: number;
}

export interface DisponibilidadTurno {
  /** Slots del horario real del turno, en orden. Vacío si el turno está cerrado. */
  slots: SlotDisponibilidad[];
  /** true si ese día/turno el restaurante está cerrado. */
  cerrado: boolean;
  /** Motivo del cierre (excepción de horario), si lo hay. */
  motivo: string | null;
  /** Duración en minutos aplicada al calcular los solapes. */
  duracionMin: number;
}

const VACIO: DisponibilidadTurno = {
  slots: [],
  cerrado: false,
  motivo: null,
  duracionMin: DURACION_RESERVA_DEFAULT_MINUTOS,
};

/**
 * Minutos → "HH:MM" en reloj de 24h. Los minutos de jornada pueden pasar de
 * 1440 (01:30 de la madrugada = 1530), así que se normaliza siempre: lo que se
 * enseña al usuario es la hora del reloj, no el desplazamiento interno.
 */
function minutosAHHMM(min: number): string {
  const norm = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Genera las horas del turno en la granularidad configurada por la empresa. */
function generarSlots(inicio: string, fin: string): string[] {
  const ini = horaAMinutos(inicio);
  let end = horaAMinutos(fin);
  // Cierre pasada medianoche (p.ej. 20:00 → 01:00): se extiende al día siguiente.
  if (end <= ini) end += 24 * 60;
  const out: string[] = [];
  // Los huecos van siempre en 00, 15, 30 y 45: si la apertura cae a media hora
  // rara (p. ej. 13:05) el primer pase se sube al siguiente cuarto.
  const primero = Math.ceil(ini / RESERVA_SLOT_MIN) * RESERVA_SLOT_MIN;
  // El último slot es la hora de cierre EXCLUIDA: no se sienta a nadie al cerrar.
  for (let m = primero; m < end; m += RESERVA_SLOT_MIN) out.push(minutosAHHMM(m % (24 * 60)));
  return out;
}

/**
 * Disponibilidad real hora a hora para (fecha, turno, zona, personas) en el
 * formulario interno de nueva reserva.
 *
 * A diferencia del motor público, aquí NO se esconde nada: el back-office puede
 * reservar encima de otra reserva (overbooking deliberado). Lo que se devuelve
 * es la información para que el usuario lo haga sabiendo lo que pisa.
 *
 * Una hora se marca sin mesa libre cuando TODAS las mesas de la zona con
 * capacidad para el grupo tienen ya una reserva viva que solapa con la franja
 * [hora, hora + duración).
 *
 * El cruce de medianoche está contemplado: los solapes se miden en minutos de
 * JORNADA (ver `horaAMinutosJornada`), así que la madrugada se trata como
 * continuación de la noche anterior y una cena de 23:30 protege su mesa hasta
 * la 01:30 igual que cualquier otra.
 */
export async function getDisponibilidadTurno(input: {
  fecha: string;
  turno: TurnoReserva;
  personas: number;
  /** Nombre de zona en mayúsculas ("TERRAZA EXTERIOR"). Vacío = todas. */
  zona?: string | null;
  localId?: string | null;
  /** Al editar, la propia reserva no debe contar como choque. */
  ignoreReservaId?: string | null;
  /**
   * Duración de LA reserva que se está creando, en minutos. Si falta se usa la
   * de la empresa.
   *
   * Es lo que decide hasta cuándo ocupa la mesa el grupo nuevo: una comida de
   * 3 h choca con reservas que una de 1 h no rozaría, así que la disponibilidad
   * tiene que recalcularse cuando el usuario cambia la duración en el
   * formulario, no solo con la duración por defecto de la configuración.
   */
  duracionMin?: number | null;
}): Promise<{ ok: true; data: DisponibilidadTurno } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const user = await getUsuarioActual();
    if (!user) return { ok: false, error: "Sesión no válida" };
    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    const [cfgRes, excRes] = await Promise.all([
      getReservasConfig(),
      listHorariosExcepciones(),
    ]);
    if (!cfgRes.ok || !cfgRes.data) return { ok: true, data: VACIO };
    const cfg = cfgRes.data;
    // Manda la duración pedida (la que el usuario ve en el formulario); la de
    // la empresa solo es el respaldo cuando no viene ninguna.
    const duracionPedida = Number(input.duracionMin);
    const duracionMin =
      Number.isFinite(duracionPedida) && duracionPedida > 0
        ? duracionPedida
        : cfg.duracionReservaMin > 0
          ? cfg.duracionReservaMin
          : DURACION_RESERVA_DEFAULT_MINUTOS;

    // 1. Horario real del día/turno (excepciones → semanal → general).
    const turnoKey: TurnoKey = input.turno === "CENA" ? "cena" : "comida";
    const horario = resolveHorarioReservas(
      input.fecha,
      turnoKey,
      cfg,
      excRes.ok ? excRes.data : [],
    );
    if (horario.cerrado) {
      return {
        ok: true,
        data: { slots: [], cerrado: true, motivo: horario.motivo, duracionMin },
      };
    }
    if (!horario.inicio || !horario.fin) {
      // Horario sin definir: no inventamos franja.
      return { ok: true, data: { ...VACIO, duracionMin } };
    }

    // Slots inactivos: horas que la empresa ha apagado a mano en Configuración.
    const inactivos = new Set(
      (turnoKey === "cena"
        ? cfg.generalSlotsInactivosCena
        : cfg.generalSlotsInactivosComida
      ).map((s) => s.slice(0, 5)),
    );
    const horas = generarSlots(horario.inicio, horario.fin)
      .filter((h) => !inactivos.has(h));
    if (horas.length === 0) return { ok: true, data: { ...VACIO, duracionMin } };

    // 2. TODAS las mesas activas de la zona (no solo las capaces): el selector
    // de mesa las ofrece todas, así que hay que saber la ocupación de todas
    // para poder marcar peligro en la que el usuario acabe eligiendo.
    let mesasQuery = supabase
      .from("mesas")
      .select("id, codigo, capacidad_min, capacidad_max, activa, zonas!inner(nombre)")
      .eq("activa", true);
    if (input.localId) mesasQuery = mesasQuery.eq("local_id", input.localId);
    const { data: mesasRows, error: errMesas } = await mesasQuery;
    if (errMesas) throw errMesas;

    const zonaFiltro = (input.zona ?? "").trim().toUpperCase();
    const mesasDelLocal = (mesasRows ?? [])
      .map((m) => {
        const z = m.zonas as unknown as { nombre?: string } | { nombre?: string }[] | null;
        const nombre = Array.isArray(z) ? (z[0]?.nombre ?? "") : (z?.nombre ?? "");
        const min = Number(m.capacidad_min);
        const max = Number(m.capacidad_max);
        return {
          id: m.id as string,
          codigo: (m.codigo as string) ?? "",
          zona: nombre.toUpperCase(),
          // "Capaz" = la mesa admite exactamente a este grupo por catálogo.
          capaz: min <= input.personas && max >= input.personas,
        };
      })
      .filter((m) => m.codigo);

    const mesasZona = mesasDelLocal.filter(
      (m) => !zonaFiltro || m.zona === zonaFiltro,
    );

    const capaces = mesasZona.filter((m) => m.capaz);

    // Bloqueos manuales: una mesa bloqueada no es "ocupada por otra reserva",
    // simplemente no está disponible, así que se saca de las capaces.
    let bloqueadas = new Set<string>();
    if (input.localId) {
      bloqueadas = await getMesasBloqueadas(supabase as unknown as SupabaseClient, {
        empresaId,
        localId: input.localId,
        fechaISO: input.fecha,
        turno: input.turno,
      });
    }
    const mesasSueltas = capaces.filter((m) => !bloqueadas.has(m.id));

    // Uniones de mesas ("M1+M2"): para grupos grandes puede que ninguna mesa
    // suelta valga y sí una unión (misma regla que `asignarMesaAutomatica`).
    // Sin esto, un grupo de 8 marcaría TODAS las horas con ⚠ aunque la unión
    // estuviera libre. Una unión solo cuenta si TODAS sus mesas están libres,
    // así que se representa como el conjunto de códigos que la componen.
    const uniones: Array<{ codigo: string; componentes: string[] }> = [];
    if (input.localId) {
      const combiQuery = supabase
        .from("mesa_combinaciones")
        .select("id, codigo, zona_id, activa, zonas(nombre)")
        .eq("local_id", input.localId)
        .eq("activa", true)
        .lte("capacidad_min", input.personas)
        .gte("capacidad_max", input.personas)
        .order("capacidad_max", { ascending: true });
      const { data: combis } = await combiQuery;
      const combisFiltradas = (combis ?? []).filter((c) => {
        if (!zonaFiltro) return true;
        const z = c.zonas as unknown as { nombre?: string } | { nombre?: string }[] | null;
        const nombre = Array.isArray(z) ? (z[0]?.nombre ?? "") : (z?.nombre ?? "");
        return nombre.toUpperCase() === zonaFiltro;
      });
      if (combisFiltradas.length > 0) {
        const { data: comps } = await supabase
          .from("mesa_combinacion_componentes")
          .select("combinacion_id, mesas!inner(id, codigo, activa)")
          .in("combinacion_id", combisFiltradas.map((c) => c.id as string));
        const porCombi = new Map<string, { codigos: string[]; usable: boolean }>();
        for (const c of comps ?? []) {
          const m = c.mesas as unknown as { id: string; codigo: string; activa: boolean } | null;
          if (!m) continue;
          const key = c.combinacion_id as string;
          const acc = porCombi.get(key) ?? { codigos: [], usable: true };
          acc.codigos.push(m.codigo);
          // Mesa inactiva o bloqueada invalida la unión entera.
          if (!m.activa || bloqueadas.has(m.id)) acc.usable = false;
          porCombi.set(key, acc);
        }
        for (const c of combisFiltradas) {
          const acc = porCombi.get(c.id as string);
          if (!acc || !acc.usable || acc.codigos.length < 2) continue;
          uniones.push({ codigo: (c.codigo as string) ?? acc.codigos.join("+"), componentes: acc.codigos });
        }
      }
    }

    // Candidatas unificadas: una mesa suelta es una "unión" de un solo código.
    const candidatas: Array<{ etiqueta: string; componentes: string[] }> = [
      ...mesasSueltas.map((m) => ({ etiqueta: m.codigo, componentes: [m.codigo] })),
      ...uniones.map((u) => ({ etiqueta: u.codigo, componentes: u.componentes })),
    ];

    // OJO: aunque `candidatas` esté vacío (ninguna mesa admite exactamente a
    // este grupo) NO se corta aquí. El selector de mesa sigue ofreciendo las
    // mesas de la zona, así que hay que calcular igualmente qué está ocupado
    // para poder marcar peligro en la mesa que se elija.

    // 3. Reservas vivas del día, con su duración real y sus datos de cliente.
    let resQuery = supabase
      .from("reservas")
      .select("id, mesa, hora, personas, cliente_nombre, cliente_apellidos, duracion_minutos")
      .eq("empresa_id", empresaId)
      .eq("fecha", input.fecha)
      .not("mesa", "is", null)
      .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
    if (input.ignoreReservaId) resQuery = resQuery.neq("id", input.ignoreReservaId);
    const { data: reservasRows, error: errRes } = await resQuery;
    if (errRes) throw errRes;

    // Códigos de mesa que existen EN ESTE LOCAL.
    //
    // `reservas` no guarda el local: solo el CÓDIGO de la mesa como texto. Y el
    // mismo código se repite entre locales (hay un "R1" en el restaurante y
    // otro "R1" en la coctelería), así que una reserva del R1 de otro local
    // marcaba ocupado el R1 de este y el diálogo avisaba de que se iba a pisar
    // una reserva que aquí no existe. Solo cuentan las mesas de este local.
    const codigosDeEsteLocal = new Set(
      mesasDelLocal.map((m) => m.codigo.toUpperCase()),
    );

    // Una reserva sobre una unión guarda "M1+M2": ocupa AMBAS mesas por
    // separado, así que se indexa por cada mesa física implicada.
    const ocupacionesPorCodigo = new Map<string, Ocupacion[]>();
    for (const r of reservasRows ?? []) {
      const codigoRaw = ((r.mesa as string) ?? "").trim();
      if (!codigoRaw) continue;
      // Minutos de JORNADA: la madrugada cuenta como continuación de la noche
      // anterior, así que 00:30 = 1470 min y no 30 (ver horaAMinutosJornada).
      const inicioMin = horaAMinutosJornada((r.hora as string) ?? "");
      const dur = Number(r.duracion_minutos);
      const finMin =
        inicioMin + Math.max(1, Number.isFinite(dur) && dur > 0 ? dur : duracionMin);
      const nombre = [
        (r.cliente_nombre as string | null) ?? "",
        (r.cliente_apellidos as string | null) ?? "",
      ]
        .join(" ")
        .trim();
      const ocupacion: Ocupacion = {
        reservaId: r.id as string,
        mesa: codigoRaw,
        cliente: nombre,
        personas: Number(r.personas) || 0,
        inicioMin,
        finMin,
      };
      for (const parte of codigoRaw.split("+")) {
        const key = parte.trim().toUpperCase();
        if (!key) continue;
        // Mesa de otro local con el mismo código: no ocupa nada de aquí.
        if (!codigosDeEsteLocal.has(key)) continue;
        const arr = ocupacionesPorCodigo.get(key);
        if (arr) arr.push(ocupacion);
        else ocupacionesPorCodigo.set(key, [ocupacion]);
      }
    }

    // 4. Resolver cada hora contra las candidatas (mesas sueltas + uniones).
    const slots: SlotDisponibilidad[] = horas.map((hora) => {
      // Misma recta de jornada que las ocupaciones: un slot de 01:30 se compara
      // como 25:30, así que choca con la cena de 23:30 que dura hasta esa hora.
      const inicioMin = horaAMinutosJornada(hora);
      const finMin = inicioMin + duracionMin;
      const mesasLibres: string[] = [];
      const choques: ChoqueReserva[] = [];
      const yaVista = new Set<string>();

      for (const cand of candidatas) {
        // Una unión solo está libre si TODAS sus mesas lo están; basta un
        // componente ocupado para descartarla (regla del dueño).
        let solapa: Ocupacion | undefined;
        for (const codigo of cand.componentes) {
          const ocupaciones = ocupacionesPorCodigo.get(codigo.toUpperCase()) ?? [];
          solapa = ocupaciones.find((o) => o.inicioMin < finMin && inicioMin < o.finMin);
          if (solapa) break;
        }
        if (!solapa) {
          mesasLibres.push(cand.etiqueta);
          continue;
        }
        // Una misma reserva puede ocupar varias mesas capaces (unión): se
        // enseña una sola vez para no repetir el mismo aviso.
        if (yaVista.has(solapa.reservaId)) continue;
        yaVista.add(solapa.reservaId);
        choques.push({
          reservaId: solapa.reservaId,
          mesa: solapa.mesa,
          cliente: solapa.cliente,
          personas: solapa.personas,
          horaInicio: minutosAHHMM(solapa.inicioMin % (24 * 60)),
          horaFin: minutosAHHMM(solapa.finMin % (24 * 60)),
        });
      }

      // Ocupación de TODA la zona, capaz o no para este grupo: es lo que
      // permite marcar peligro en una mesa de 3 elegida para 2 comensales.
      const mesasOcupadas = mesasZona
        .filter((m) => {
          const ocupaciones = ocupacionesPorCodigo.get(m.codigo.toUpperCase()) ?? [];
          return ocupaciones.some((o) => o.inicioMin < finMin && inicioMin < o.finMin);
        })
        .map((m) => m.codigo.toUpperCase());

      return {
        hora,
        hayMesaLibre: mesasLibres.length > 0,
        mesasLibres,
        mesasOcupadas,
        // El detalle de choques solo importa cuando no queda hueco limpio.
        choques: mesasLibres.length > 0 ? [] : choques,
      };
    });

    return { ok: true, data: { slots, cerrado: false, motivo: null, duracionMin } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas-disponibilidad] getDisponibilidadTurno:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Reservas que se pisarían al poner una reserva de `personas` en `mesa` a esa
 * hora. Se usa al confirmar el guardado, cuando ya hay MESA concreta elegida
 * (el cálculo por zona de `getDisponibilidadTurno` mira el conjunto).
 */
export async function getChoquesMesa(input: {
  fecha: string;
  hora: string;
  /** Código de mesa ("R3" o "M1+M2"). */
  mesa: string;
  /** Override de duración; si falta se usa la de la empresa. */
  duracionMin?: number | null;
  ignoreReservaId?: string | null;
}): Promise<{ ok: true; data: ChoqueReserva[] } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const user = await getUsuarioActual();
    if (!user) return { ok: false, error: "Sesión no válida" };
    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    const mesasPedidas = new Set(
      input.mesa.split("+").map((m) => m.trim().toUpperCase()).filter(Boolean),
    );
    if (mesasPedidas.size === 0) return { ok: true, data: [] };

    let duracionMin = input.duracionMin ?? 0;
    if (!(duracionMin > 0)) {
      const cfgRes = await getReservasConfig();
      duracionMin =
        cfgRes.ok && cfgRes.data && cfgRes.data.duracionReservaMin > 0
          ? cfgRes.data.duracionReservaMin
          : DURACION_RESERVA_DEFAULT_MINUTOS;
    }

    const inicioMin = horaAMinutosJornada(input.hora);
    const finMin = inicioMin + Math.max(1, duracionMin);

    let query = supabase
      .from("reservas")
      .select("id, mesa, hora, personas, cliente_nombre, cliente_apellidos, duracion_minutos")
      .eq("empresa_id", empresaId)
      .eq("fecha", input.fecha)
      .not("mesa", "is", null)
      .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
    if (input.ignoreReservaId) query = query.neq("id", input.ignoreReservaId);
    const { data, error } = await query;
    if (error) throw error;

    const out: ChoqueReserva[] = [];
    for (const r of data ?? []) {
      const codigoRaw = ((r.mesa as string) ?? "").trim();
      if (!codigoRaw) continue;
      const mesasOtra = codigoRaw.split("+").map((m) => m.trim().toUpperCase()).filter(Boolean);
      if (!mesasOtra.some((m) => mesasPedidas.has(m))) continue;

      const otroInicio = horaAMinutosJornada((r.hora as string) ?? "");
      const dur = Number(r.duracion_minutos);
      const otroFin =
        otroInicio + Math.max(1, Number.isFinite(dur) && dur > 0 ? dur : duracionMin);
      if (!(otroInicio < finMin && inicioMin < otroFin)) continue;

      out.push({
        reservaId: r.id as string,
        mesa: codigoRaw,
        cliente: [
          (r.cliente_nombre as string | null) ?? "",
          (r.cliente_apellidos as string | null) ?? "",
        ]
          .join(" ")
          .trim(),
        personas: Number(r.personas) || 0,
        horaInicio: minutosAHHMM(otroInicio % (24 * 60)),
        horaFin: minutosAHHMM(otroFin % (24 * 60)),
      });
    }
    out.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    return { ok: true, data: out };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas-disponibilidad] getChoquesMesa:", msg);
    return { ok: false, error: msg };
  }
}
