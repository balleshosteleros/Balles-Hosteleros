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
 *  3. **Los points son de cada empresa; la felicitación, de la persona.**
 *     Points es un juego por empresa: cada una tiene su regla, su saldo y sus
 *     recompensas, igual que el puesto no se comparte entre empresas. Así que
 *     quien trabaja en dos cobra en las dos, cada una con los suyos. El mensaje,
 *     en cambio, sale UNA vez: la bandeja de avisos es de la persona y no filtra
 *     por empresa, así que dos felicitaciones idénticas serían dos veces el
 *     mismo aviso. Cuando hay varias empresas, el mensaje las desglosa.
 *
 *  4. **Una felicitación por persona y año.** Los points los protege el índice
 *     único de la regla diaria (una regla por empresa, así que cada una apunta
 *     los suyos); el mensaje, su `dedupeKey` con el año. Un redespliegue a la
 *     hora justa no felicita dos veces.
 *
 *  5. **Se felicita a todo el mundo; los points, no a todo el mundo.** Quien
 *     está en periodo de prueba todavía no juega a Points — es la regla del
 *     módulo entero, no un invento de aquí. Pero se le felicita igual: un
 *     cumpleaños no es un premio que haya que ganarse. En su mensaje sencillamente
 *     no aparece la línea de los points.
 *
 *  6. **Primero los points, después el mensaje.** Si se mandara antes el
 *     mensaje y fallara el apunte, el trabajador leería que tiene 10 points que
 *     no existen. Al revés lo peor que pasa es un apunte sin felicitación, que
 *     se arregla solo al día siguiente.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";

/** Código de la regla de Points que manda sobre el cumpleaños. */
export const REGLA_CUMPLEANOS = "cumpleanos_propio";

export interface OpcionesPasada {
  /** Forzar el día (YYYY-MM-DD) en vez del de hoy en cada empresa. Pruebas y repesca. */
  fecha?: string;
  /** Calcular y enseñar los mensajes, sin escribir ni avisar a nadie. */
  dry?: boolean;
  /** Limitar la pasada a una sola empresa. */
  empresaId?: string;
}

export interface ResumenCumpleanos {
  /** Empresas con la regla encendida que se han mirado. */
  empresas: Array<{ nombre: string; fecha: string; points: number }>;
  /** Personas que cumplen años hoy. */
  cumplen: number;
  /** Felicitaciones que han salido (las repetidas no cuentan). */
  felicitados: number;
  /** Apuntes de points hechos. Quien trabaja en dos empresas suma dos. */
  apuntes: number;
  /** Points regalados en total, sumando todas las empresas. */
  pointsTotales: number;
  /** Solo en modo prueba: los mensajes tal cual saldrían. */
  previsualizacion: Array<{ nombre: string; titulo: string; mensaje: string }>;
  errores: string[];
}

/** Lo que una empresa concreta le regala a esta persona. */
interface RegaloDeEmpresa {
  empresaId: string;
  empresaNombre: string;
  empleadoId: string;
  reglaId: string;
  /** 0 si está en periodo de prueba: se le felicita, pero no cobra. */
  points: number;
  fecha: string;
}

interface PersonaCumple {
  userId: string;
  /** Nombre de pila, que es como se felicita a alguien. */
  nombre: string;
  nombreCompleto: string;
  fechaNacimiento: string;
  regalos: RegaloDeEmpresa[];
}

/**
 * Felicitaciones. Se van turnando para que el mensaje no sea el mismo ladrillo
 * cada año, pero la elección es estable (sale de la persona y del año): volver a
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

/** Elige felicitación de forma estable a partir de la persona y el año. */
function felicitacionDe(userId: string, ano: number, nombre: string): string {
  let suma = ano;
  for (const c of userId) suma += c.charCodeAt(0);
  const texto = FELICITACIONES[suma % FELICITACIONES.length];
  return texto.replaceAll("{nombre}", nombre);
}

/** El primer nombre de pila. */
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
 * De unas fichas, cuáles están en periodo de prueba ABIERTO.
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
 * Quiénes de estos ya tienen su felicitación de este año, por cualquier empresa.
 *
 * Ante un fallo de consulta se devuelve vacío: es preferible una felicitación
 * repetida que ninguna.
 */
async function yaFelicitados(
  admin: SupabaseClient,
  userIds: string[],
  ano: number,
): Promise<Set<string>> {
  const out = new Set<string>();
  if (userIds.length === 0) return out;
  try {
    const { data } = await admin
      .from("notificaciones")
      .select("usuario_id")
      .in("usuario_id", userIds)
      .in(
        "dedupe_key",
        userIds.map((u) => claveFelicitacion(u, ano)),
      );
    for (const n of (data ?? []) as Array<{ usuario_id: string }>) out.add(n.usuario_id);
  } catch (e) {
    console.warn("[points:cumpleanos] ya felicitados:", e instanceof Error ? e.message : e);
    return new Set<string>();
  }
  return out;
}

/** Cómo se cuentan los points en el mensaje: «10 points» o el desglose por empresa. */
function fraseDePoints(regalos: RegaloDeEmpresa[]): string {
  const conPoints = regalos.filter((r) => r.points > 0);
  if (conPoints.length === 0) return "";
  if (conPoints.length === 1) {
    return ` Ah, y te dejamos ${conPoints[0].points} points en el bolsillo, por la cara.`;
  }
  const trozos = conPoints.map((r) => `${r.points} en ${r.empresaNombre}`);
  const ultimo = trozos.pop();
  return ` Ah, y te dejamos points en el bolsillo, por la cara: ${trozos.join(", ")} y ${ultimo}.`;
}

/**
 * La pasada del día: recorre las empresas, junta a quien cumple años y reparte.
 *
 * Se hace en una sola pasada global (y no empresa por empresa) justamente para
 * poder darle sus points en cada empresa y felicitarle una sola vez.
 */
export async function procesarCumpleanosDelDia(
  admin: SupabaseClient,
  opciones: OpcionesPasada = {},
): Promise<ResumenCumpleanos> {
  const resumen: ResumenCumpleanos = {
    empresas: [],
    cumplen: 0,
    felicitados: 0,
    apuntes: 0,
    pointsTotales: 0,
    previsualizacion: [],
    errores: [],
  };

  let queryEmpresas = admin
    .from("empresas")
    .select("id, nombre")
    .eq("estado", "Activa")
    .order("id", { ascending: true }); // orden estable: decide en qué empresa cuelga el aviso
  if (opciones.empresaId) queryEmpresas = queryEmpresas.eq("id", opciones.empresaId);
  const { data: empresas, error: errEmpresas } = await queryEmpresas;
  if (errEmpresas) {
    resumen.errores.push(`empresas: ${errEmpresas.message}`);
    return resumen;
  }

  const porPersona = new Map<string, PersonaCumple>();

  for (const empresa of (empresas ?? []) as Array<{ id: string; nombre: string }>) {
    try {
      // ── El interruptor: la regla de Points de ESTA empresa ──────────────
      const { data: regla, error: errRegla } = await admin
        .from("toques_reglas")
        .select("id, toques, activa")
        .eq("empresa_id", empresa.id)
        .eq("codigo", REGLA_CUMPLEANOS)
        .maybeSingle();
      if (errRegla) throw new Error(errRegla.message);
      if (!regla || !regla.activa) continue;

      const tz = await getZonaHorariaEmpresa(admin, empresa.id);
      const hoy = opciones.fecha ?? hoyEnZona(tz);
      const points = Number(regla.toques ?? 0);
      resumen.empresas.push({ nombre: empresa.nombre, fecha: hoy, points });

      const { data: fichas, error: errFichas } = await admin
        .from("empleados")
        .select("id, user_id, nombre, apellidos, fecha_nacimiento")
        .eq("empresa_id", empresa.id)
        .eq("estado", "Activo")
        .not("fecha_nacimiento", "is", null)
        .not("user_id", "is", null);
      if (errFichas) throw new Error(errFichas.message);

      const delDia = ((fichas ?? []) as Array<Record<string, unknown>>).filter((f) => {
        const nac = String(f.fecha_nacimiento ?? "").slice(0, 10);
        return nac.length === 10 && cumpleHoy(nac, hoy);
      });
      if (delDia.length === 0) continue;

      const enPrueba = await enPeriodoPrueba(
        admin,
        delDia.map((f) => String(f.id)),
      );

      for (const f of delDia) {
        const userId = String(f.user_id);
        const nombre = String(f.nombre ?? "").trim();
        const apellidos = String(f.apellidos ?? "").trim();
        const persona = porPersona.get(userId) ?? {
          userId,
          nombre: nombreDePila(nombre),
          nombreCompleto: [nombre, apellidos].filter(Boolean).join(" "),
          fechaNacimiento: String(f.fecha_nacimiento ?? "").slice(0, 10),
          regalos: [],
        };
        persona.regalos.push({
          empresaId: empresa.id,
          empresaNombre: empresa.nombre,
          empleadoId: String(f.id),
          reglaId: String(regla.id),
          points: enPrueba.has(String(f.id)) ? 0 : points,
          fecha: hoy,
        });
        porPersona.set(userId, persona);
      }
    } catch (e) {
      // Una empresa que falla no puede dejar sin felicitación a las demás.
      resumen.errores.push(`${empresa.nombre}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  resumen.cumplen = porPersona.size;
  if (porPersona.size === 0) return resumen;

  const personas = Array.from(porPersona.values());
  const ano = Number(personas[0].regalos[0].fecha.slice(0, 4));
  const felicitadas = opciones.dry
    ? new Set<string>()
    : await yaFelicitados(
        admin,
        personas.map((p) => p.userId),
        ano,
      );

  for (const p of personas) {
    // ── 1. Los points, en cada una de sus empresas ────────────────────────
    for (const r of p.regalos) {
      if (r.points <= 0) continue;
      if (opciones.dry) {
        resumen.apuntes += 1;
        resumen.pointsTotales += r.points;
        continue;
      }
      const { error } = await admin.from("toques_movimientos").insert({
        empresa_id: r.empresaId,
        user_id: p.userId,
        empleado_nombre: p.nombreCompleto,
        toques: r.points,
        origen: "regla",
        regla_id: r.reglaId,
        fecha: r.fecha,
        motivo: "Cumpleaños",
        contexto: { fecha_nacimiento: p.fechaNacimiento, ano },
      });
      if (!error) {
        resumen.apuntes += 1;
        resumen.pointsTotales += r.points;
      } else if (error.code !== "23505") {
        // 23505 = ya los tenía de una pasada anterior de hoy. Idempotencia OK.
        resumen.errores.push(`points@${r.empresaNombre}/${r.empleadoId}: ${error.message}`);
      }
    }

    // ── 2. La felicitación, una sola ──────────────────────────────────────
    if (felicitadas.has(p.userId)) continue;

    const saludo = p.nombre ? `¡Feliz cumpleaños, ${p.nombre}! 🎉` : "¡Feliz cumpleaños! 🎉";
    const mensaje = `${felicitacionDe(p.userId, ano, p.nombre || "crack")}${fraseDePoints(
      p.regalos,
    )} 🎂`;

    if (opciones.dry) {
      resumen.felicitados += 1;
      resumen.previsualizacion.push({ nombre: p.nombreCompleto, titulo: saludo, mensaje });
      continue;
    }

    // Cuelga de la primera de sus empresas (orden estable por id), que es la que
    // la RLS del registro usará para enseñarla en Dirección.
    const principal = p.regalos[0];
    const res = await emitirNotificacion({
      empresaId: principal.empresaId,
      system: true,
      tipo: "cumpleanos",
      titulo: saludo,
      mensaje,
      segmento: { tipo: "empleados", empleadoIds: [principal.empleadoId] },
      refTabla: "empleados",
      refId: principal.empleadoId,
      accionUrl: p.regalos.some((r) => r.points > 0) ? "/mi-panel/points" : null,
      dedupeKey: claveFelicitacion(p.userId, ano),
      payload: {
        fecha: principal.fecha,
        points: p.regalos.map((r) => ({ empresa: r.empresaNombre, points: r.points })),
      },
    });
    resumen.felicitados += res.creadas;
  }

  return resumen;
}
