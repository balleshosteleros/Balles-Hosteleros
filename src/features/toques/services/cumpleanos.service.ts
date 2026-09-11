/**
 * El cumpleaños del trabajador: felicitación y points de regalo.
 *
 * ── El interruptor es uno solo ─────────────────────────────────────────────
 * Manda la regla «Cumpleaños» de Points (RRHH → Points → Configuración →
 * Reglas). Si está apagada no sale nada: ni el mensaje ni los points. Y los
 * points que se regalan son los de esa casilla, no un número escondido aquí.
 * Se decidió así para que el cumpleaños se encienda y se apague en el mismo
 * sitio que el resto del juego, y no en dos pantallas distintas.
 *
 * ── Las reglas que sostienen esto ──────────────────────────────────────────
 *
 *  1. **El día es el de la empresa, no el del servidor.** Vercel corre en UTC.
 *     Calculando el día allí, a quien cumple años el 1 se le felicita el 31 del
 *     mes anterior, o directamente nunca. La fecha sale siempre de la zona
 *     horaria de la empresa.
 *
 *  2. **No se mira la hora local, solo el día.** Otros crons de la casa exigen
 *     una ventana horaria local y se quedan mudos en silencio si alguien mueve
 *     el `schedule` de `vercel.json` (le pasó a las bajas: meses sin tramitar
 *     ninguna). Aquí la hora del cron se puede cambiar sin romper nada.
 *
 *  3. **Una felicitación por persona y año.** Los points los protege el índice
 *     único de la regla diaria; el mensaje, su `dedupeKey` con el año. Un
 *     redespliegue a la hora justa no felicita dos veces.
 *
 *  4. **Se felicita a todo el mundo; los points, no a todo el mundo.** Quien
 *     está en periodo de prueba todavía no juega a Points — es la regla del
 *     módulo entero, no un invento de aquí. Pero se le felicita igual: un
 *     cumpleaños no es un premio que haya que ganarse. En su mensaje sencillamente
 *     no aparece la línea de los points.
 *
 *  5. **Primero los points, después el mensaje.** Si se mandara antes el
 *     mensaje y fallara el apunte, el trabajador leería que tiene 10 points que
 *     no existen. Al revés lo peor que pasa es un apunte sin felicitación, que
 *     se arregla solo al día siguiente.
 *
 *  6. **Un cumpleaños por PERSONA, no por ficha.** Quien trabaja en dos empresas
 *     tiene una ficha en cada una (Iván y Alejandro, hoy mismo). Sin esto
 *     recibirían dos felicitaciones y cobrarían los points dos veces. Se cumplen
 *     años una vez, así que se comprueba por usuario y se atiende en la primera
 *     empresa que pasa por aquí; en la otra ya se le encuentra atendido.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";

/** Código de la regla de Points que manda sobre el cumpleaños. */
export const REGLA_CUMPLEANOS = "cumpleanos_propio";

export interface ResumenCumpleanosEmpleados {
  empresaId: string;
  /** false = la regla de Points está apagada (o no existe): no se hace nada. */
  encendida: boolean;
  /** El día, en la zona de la empresa, que se ha atendido. */
  fecha: string;
  /** Cuántos cumplen años hoy. */
  cumplen: number;
  /** Felicitaciones que han salido (las repetidas no cuentan). */
  felicitados: number;
  /** A cuántos se les han apuntado los points. */
  conPoints: number;
  /** Cuántos ya venían atendidos (otra empresa suya, o una pasada anterior). */
  yaAtendidos: number;
  /** Points que regala la regla ahora mismo. */
  pointsPorCabeza: number;
  errores: string[];
}

interface Cumpleanero {
  empleadoId: string;
  userId: string;
  nombre: string;
  nombreCompleto: string;
  fechaNacimiento: string;
}

/**
 * Felicitaciones. Se van turnando para que el mensaje no sea el mismo ladrillo
 * cada año, pero la elección es estable (sale del empleado y del año): volver a
 * pasar el cron no cambia el texto de una felicitación ya enviada.
 *
 * `{nombre}` se sustituye por el nombre de pila.
 */
const FELICITACIONES: string[] = [
  "Un año más aguantándonos, {nombre}. Eso, en hostelería, son dos. Que lo celebres a lo grande.",
  "Hoy la casa invita a felicitarte. Que cumplas muchos más y que hoy no se te caiga ni un plato.",
  "Se ha detectado un cumpleaños. Protocolo activado: tarta, abrazos y cero broncas por hoy.",
  "Dicen que la edad es solo un número. El tuyo acaba de subir uno, así que aprovéchalo. ¡Felicidades!",
  "Sopla las velas con ganas, {nombre}, que hoy la campana extractora está de tu parte.",
  "Hoy es tu día y el único en el que nadie te va a discutir el descanso. ¡Que lo disfrutes!",
  "Felicidades, {nombre}. Que te traten hoy la mitad de bien de lo que tú tratas a la gente cada día.",
  "Cumples años y aquí seguimos, sin mesa libre para la tarta pero con ganas de felicitarte.",
];

/** Elige felicitación de forma estable a partir del empleado y el año. */
function felicitacionDe(empleadoId: string, ano: number, nombre: string): string {
  let suma = ano;
  for (const c of empleadoId) suma += c.charCodeAt(0);
  const texto = FELICITACIONES[suma % FELICITACIONES.length];
  return texto.replaceAll("{nombre}", nombre);
}

/** El primer nombre de pila, que es como se felicita a alguien. */
function nombreDePila(nombre: string): string {
  const limpio = (nombre ?? "").trim();
  if (!limpio) return "";
  return limpio.split(/\s+/)[0];
}

/**
 * ¿Cumple años hoy?
 *
 * El 29 de febrero se celebra el 28 los años que no son bisiestos: si no, quien
 * nació ese día se quedaría sin felicitación tres de cada cuatro años.
 */
function cumpleHoy(fechaNacimiento: string, hoy: string): boolean {
  const nac = fechaNacimiento.slice(5, 10); // MM-DD
  const dia = hoy.slice(5, 10);
  if (nac === dia) return true;
  if (nac !== "02-29" || dia !== "02-28") return false;
  const ano = Number(hoy.slice(0, 4));
  const bisiesto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  return !bisiesto;
}

/**
 * De una lista de user_ids, cuáles están en periodo de prueba ABIERTO.
 *
 * Mismo criterio que el motor de reglas de Points: el periodo cuelga de la ficha
 * de empleado, no del usuario de acceso. Ante un fallo de consulta no se excluye
 * a nadie — es preferible regalar points de más que castigar a alguien el día de
 * su cumpleaños por una avería.
 */
async function enPeriodoPrueba(
  admin: SupabaseClient,
  empleadoIds: string[],
): Promise<Set<string>> {
  const vacio = new Set<string>();
  if (empleadoIds.length === 0) return vacio;
  try {
    const { data } = await admin
      .from("empleado_periodo_prueba")
      .select("empleado_id")
      .eq("decision", "pendiente")
      .in("empleado_id", empleadoIds);
    return new Set(((data ?? []) as Array<{ empleado_id: string }>).map((r) => r.empleado_id));
  } catch (e) {
    console.warn("[points:cumpleanos] periodo de prueba:", e instanceof Error ? e.message : e);
    return vacio;
  }
}

/** La clave que marca a una persona como felicitada este año, mire quien mire. */
function claveFelicitacion(userId: string, ano: number): string {
  return `cumpleanos:${userId}:${ano}`;
}

/**
 * Quiénes de estos ya tienen su cumpleaños atendido, sin importar por qué
 * empresa. Se mira por partida doble porque las dos cosas pueden haber salido
 * por separado si una pasada anterior se cortó a la mitad:
 *
 *  - la felicitación, por su clave de este año;
 *  - los points, por si hay apunte de hoy de cualquier regla de cumpleaños.
 *
 * Ante un fallo de consulta se devuelve vacío: es preferible una felicitación
 * repetida que ninguna.
 */
async function yaAtendidosEsteAno(
  admin: SupabaseClient,
  userIds: string[],
  hoy: string,
  ano: number,
): Promise<Set<string>> {
  const out = new Set<string>();
  if (userIds.length === 0) return out;
  try {
    const { data: notifs } = await admin
      .from("notificaciones")
      .select("usuario_id")
      .in("usuario_id", userIds)
      .in(
        "dedupe_key",
        userIds.map((u) => claveFelicitacion(u, ano)),
      );
    for (const n of (notifs ?? []) as Array<{ usuario_id: string }>) out.add(n.usuario_id);

    const { data: reglas } = await admin
      .from("toques_reglas")
      .select("id")
      .eq("codigo", REGLA_CUMPLEANOS);
    const reglaIds = ((reglas ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (reglaIds.length > 0) {
      const { data: movs } = await admin
        .from("toques_movimientos")
        .select("user_id")
        .eq("fecha", hoy)
        .in("user_id", userIds)
        .in("regla_id", reglaIds);
      for (const m of (movs ?? []) as Array<{ user_id: string }>) out.add(m.user_id);
    }
  } catch (e) {
    console.warn("[points:cumpleanos] ya atendidos:", e instanceof Error ? e.message : e);
    return new Set<string>();
  }
  return out;
}

/** Una pasada de cumpleaños para una empresa. */
export async function procesarCumpleanosDeEmpresa(
  admin: SupabaseClient,
  empresaId: string,
): Promise<ResumenCumpleanosEmpleados> {
  const resumen: ResumenCumpleanosEmpleados = {
    empresaId,
    encendida: false,
    fecha: "",
    cumplen: 0,
    felicitados: 0,
    conPoints: 0,
    yaAtendidos: 0,
    pointsPorCabeza: 0,
    errores: [],
  };

  // ── El interruptor: la regla de Points ──────────────────────────────────
  const { data: regla, error: errRegla } = await admin
    .from("toques_reglas")
    .select("id, toques, activa")
    .eq("empresa_id", empresaId)
    .eq("codigo", REGLA_CUMPLEANOS)
    .maybeSingle();
  if (errRegla) {
    resumen.errores.push(`regla: ${errRegla.message}`);
    return resumen;
  }
  if (!regla || !regla.activa) return resumen;
  resumen.encendida = true;
  resumen.pointsPorCabeza = Number(regla.toques ?? 0);

  const tz = await getZonaHorariaEmpresa(admin, empresaId);
  const hoy = hoyEnZona(tz);
  resumen.fecha = hoy;

  // ── Quién cumple años hoy ───────────────────────────────────────────────
  const { data: fichas, error: errFichas } = await admin
    .from("empleados")
    .select("id, user_id, nombre, apellidos, fecha_nacimiento")
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo")
    .not("fecha_nacimiento", "is", null)
    .not("user_id", "is", null);
  if (errFichas) {
    resumen.errores.push(`empleados: ${errFichas.message}`);
    return resumen;
  }

  const cumpleaneros: Cumpleanero[] = [];
  for (const f of (fichas ?? []) as Array<Record<string, unknown>>) {
    const nacimiento = String(f.fecha_nacimiento ?? "").slice(0, 10);
    if (nacimiento.length !== 10 || !cumpleHoy(nacimiento, hoy)) continue;
    const nombre = String(f.nombre ?? "").trim();
    const apellidos = String(f.apellidos ?? "").trim();
    cumpleaneros.push({
      empleadoId: String(f.id),
      userId: String(f.user_id),
      nombre: nombreDePila(nombre),
      nombreCompleto: [nombre, apellidos].filter(Boolean).join(" "),
      fechaNacimiento: nacimiento,
    });
  }
  resumen.cumplen = cumpleaneros.length;
  if (cumpleaneros.length === 0) return resumen;

  const enPrueba = await enPeriodoPrueba(
    admin,
    cumpleaneros.map((c) => c.empleadoId),
  );
  const ano = Number(hoy.slice(0, 4));
  const atendidos = await yaAtendidosEsteAno(
    admin,
    cumpleaneros.map((c) => c.userId),
    hoy,
    ano,
  );

  for (const c of cumpleaneros) {
    // Su otra empresa ya le felicitó (o ya lo hizo una pasada anterior de hoy).
    if (atendidos.has(c.userId)) {
      resumen.yaAtendidos += 1;
      continue;
    }
    atendidos.add(c.userId);

    // ── 1. Los points, antes que el mensaje ───────────────────────────────
    let pointsDados = 0;
    if (resumen.pointsPorCabeza > 0 && !enPrueba.has(c.empleadoId)) {
      const { error } = await admin.from("toques_movimientos").insert({
        empresa_id: empresaId,
        user_id: c.userId,
        empleado_nombre: c.nombreCompleto,
        toques: resumen.pointsPorCabeza,
        origen: "regla",
        regla_id: regla.id,
        fecha: hoy,
        motivo: "Cumpleaños",
        contexto: { fecha_nacimiento: c.fechaNacimiento, ano },
      });
      if (!error) {
        pointsDados = resumen.pointsPorCabeza;
        resumen.conPoints += 1;
      } else if (error.code === "23505") {
        // Ya los tenía de una pasada anterior de hoy: el mensaje también estará
        // deduplicado, así que se sigue como si nada.
        pointsDados = resumen.pointsPorCabeza;
      } else {
        resumen.errores.push(`points@${c.empleadoId}: ${error.message}`);
      }
    }

    // ── 2. La felicitación ────────────────────────────────────────────────
    const saludo = c.nombre ? `¡Feliz cumpleaños, ${c.nombre}! 🎉` : "¡Feliz cumpleaños! 🎉";
    const texto = felicitacionDe(c.empleadoId, ano, c.nombre || "crack");
    const conPoints =
      pointsDados > 0
        ? `${texto} Ah, y te dejamos ${pointsDados} points en el bolsillo, por la cara. 🎂`
        : `${texto} 🎂`;

    const res = await emitirNotificacion({
      empresaId,
      system: true,
      tipo: "cumpleanos",
      titulo: saludo,
      mensaje: conPoints,
      segmento: { tipo: "empleados", empleadoIds: [c.empleadoId] },
      refTabla: "empleados",
      refId: c.empleadoId,
      accionUrl: pointsDados > 0 ? "/mi-panel/points" : null,
      dedupeKey: claveFelicitacion(c.userId, ano),
      payload: { points: pointsDados, fecha: hoy },
    });
    resumen.felicitados += res.creadas;
  }

  return resumen;
}
