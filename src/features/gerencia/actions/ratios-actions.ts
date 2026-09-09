"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import {
  costeHoraSegunModo,
  SS_EMPRESA_PCT_DEFECTO,
  type ModoPago,
} from "@/features/rrhh/lib/coste-hora";
import type {
  AreaRatios,
  CosteAusencia,
  ModoCoste,
  Proyeccion,
  FilaRatio,
  PeriodoRatios,
  PuntoRatio,
  RatiosDashboard,
  TipoAusencia,
} from "@/features/gerencia/types/ratios";

/**
 * Días con los que se reparte el sueldo del mes para valorar una ausencia.
 * Es como se paga de verdad: la nómina de agosto es la misma se trabaje o se
 * descanse, así que un día de vacaciones vale el bruto mensual entre 30.
 */
const DIAS_MES_NOMINA = 30;



function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function céntimos(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Agrupación temporal ────────────────────────────────────────────────────
// La clave se calcula sobre la CADENA de la fecha, sin convertir a Date: así el
// día no se desplaza por la zona horaria de quien mire la pantalla.

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Lunes de la semana a la que pertenece una fecha (ISO: la semana empieza el lunes). */
function lunesDe(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  // getUTCDay(): 0 = domingo. Se convierte a 0 = lunes.
  const diaSemana = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - diaSemana);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Los días naturales entre dos fechas, ambas incluidas.
 *
 * Se avanza en UTC a propósito: son días de calendario, no instantes, así que
 * ningún cambio de hora puede saltarse ni repetir un día.
 */
function diasEntre(desde: string, hasta: string): string[] {
  const salida: string[] = [];
  if (desde > hasta) return salida;
  const [a1, m1, d1] = desde.split("-").map(Number);
  const cursor = new Date(Date.UTC(a1, m1 - 1, d1));
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  // Tope de seguridad: un año de días por ausencia es más que de sobra.
  for (let i = 0; cursor.getTime() <= fin && i < 400; i += 1) {
    salida.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return salida;
}

/** Los periodos "AAAA-MM" que toca un rango de fechas. */
function mesesEntre(desde: string, hasta: string): string[] {
  const salida: string[] = [];
  let [a, m] = [Number(desde.slice(0, 4)), Number(desde.slice(5, 7))];
  const finA = Number(hasta.slice(0, 4));
  const finM = Number(hasta.slice(5, 7));
  for (let i = 0; (a < finA || (a === finA && m <= finM)) && i < 120; i += 1) {
    salida.push(`${a}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; a += 1; }
  }
  return salida;
}

/** Clave y etiqueta de un día según cómo se esté agrupando. */
function agrupar(iso: string, periodo: PeriodoRatios): { clave: string; etiqueta: string } {
  const [a, m, d] = iso.split("-");
  const mesIdx = Number(m) - 1;

  switch (periodo) {
    case "DIARIO":
      // Norma del proyecto: toda fecha en pantalla va en día/mes/año.
      return { clave: iso, etiqueta: `${d}/${m}/${a}` };
    case "SEMANAL": {
      const lunes = lunesDe(iso);
      const [la, lm, ld] = lunes.split("-");
      return { clave: lunes, etiqueta: `Semana del ${ld}/${lm}/${la}` };
    }
    case "MENSUAL":
      return { clave: `${a}-${m}`, etiqueta: `${MESES_CORTOS[mesIdx]} ${a}` };
    case "TRIMESTRAL": {
      const t = Math.floor(mesIdx / 3) + 1;
      return { clave: `${a}-T${t}`, etiqueta: `T${t} ${a}` };
    }
    case "ANUAL":
      return { clave: a, etiqueta: a };
  }
}

// ─── Coste por hora de cada persona ─────────────────────────────────────────

interface CosteEmpleado {
  nombre: string;
  /** Sueldo fijo al mes, o precio por hora trabajada. */
  modoPago: ModoPago;
  costeHora: number;
  /** Lo que cuesta un día sin trabajar: el sueldo del mes repartido en 30 días. */
  costeDia: number;
  /** false cuando no se le puede poner precio a la hora: falta salario u horas. */
  tieneCoste: boolean;
  /** true si el salario sale del PUESTO por no tener condiciones propias en su ficha. */
  salarioDelPuesto: boolean;
  puesto: string;
  departamento: string;
  area: AreaRatios | null;
}

/**
 * Precio de la hora de cada empleado, indexado por su id de USUARIO.
 *
 * Se indexa por usuario porque los fichajes guardan el id de acceso, no el de la
 * ficha del trabajador: son cosas distintas y no coinciden nunca.
 *
 * El salario sale de las condiciones propias de la ficha; cuando no las tiene
 * (hoy es lo normal), se recurre al salario del puesto y se deja constancia,
 * porque no es lo mismo un dato pactado que la plantilla del puesto.
 */
async function construirCostes(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
  factorSS: number,
): Promise<Map<string, CosteEmpleado>> {
  const mapa = new Map<string, CosteEmpleado>();

  const { data: empleados, error } = await supabase
    .from("empleados")
    .select(`
      id, user_id, nombre, apellidos,
      departamentos!empleados_departamento_id_fkey ( nombre, area ),
      empleado_puestos ( puesto_id, es_principal, puestos ( nombre, departamentos ( nombre, area ) ) )
    `)
    .eq("empresa_id", empresaId);
  if (error) throw error;

  const filas = (empleados ?? []) as unknown as Array<{
    id: string;
    user_id: string | null;
    nombre: string | null;
    apellidos: string | null;
    departamentos: { nombre: string | null; area: string | null } | null;
    empleado_puestos: Array<{
      puesto_id: string | null;
      es_principal: boolean | null;
      puestos: { nombre: string | null; departamentos: { nombre: string | null; area: string | null } | null } | null;
    }> | null;
  }>;

  const fichaIds = filas.map((e) => e.id);
  const puestoIds = Array.from(
    new Set(
      filas.flatMap((e) => (e.empleado_puestos ?? []).map((p) => p.puesto_id)).filter((x): x is string => !!x),
    ),
  );

  // Condiciones propias vigentes (`vigente_hasta` a nulo): son la fuente buena.
  const condiciones = new Map<string, { bruto: number; horas: number; costeHora: number | null; modoPago: ModoPago }>();
  if (fichaIds.length > 0) {
    const { data } = await supabase
      .from("empleado_condiciones")
      .select("empleado_id, salario_bruto, horas_semanales, coste_hora, modo_pago")
      .eq("empresa_id", empresaId)
      .in("empleado_id", fichaIds)
      .is("vigente_hasta", null);
    for (const c of data ?? []) {
      condiciones.set(c.empleado_id as string, {
        bruto: toNum(c.salario_bruto),
        horas: toNum(c.horas_semanales),
        costeHora: c.coste_hora == null ? null : toNum(c.coste_hora),
        modoPago: c.modo_pago === "HORAS" ? "HORAS" : "MENSUAL",
      });
    }
  }

  // Salario del puesto: plantilla de la que se tira cuando la ficha no lo tiene.
  const salarioPuesto = new Map<string, { bruto: number; horas: number; costeHora: number | null; modoPago: ModoPago }>();
  if (puestoIds.length > 0) {
    const { data } = await supabase
      .from("puesto_salarios")
      .select("puesto_id, salario_bruto, horas_semanales, coste_hora, modo_pago")
      .eq("empresa_id", empresaId)
      .in("puesto_id", puestoIds);
    for (const p of data ?? []) {
      salarioPuesto.set(p.puesto_id as string, {
        bruto: toNum(p.salario_bruto),
        horas: toNum(p.horas_semanales),
        costeHora: p.coste_hora == null ? null : toNum(p.coste_hora),
        modoPago: p.modo_pago === "HORAS" ? "HORAS" : "MENSUAL",
      });
    }
  }

  for (const e of filas) {
    if (!e.user_id) continue;

    // El puesto principal manda; si no hay ninguno marcado, el primero que tenga.
    const asignaciones = e.empleado_puestos ?? [];
    const principal = asignaciones.find((p) => p.es_principal) ?? asignaciones[0] ?? null;

    // El departamento del PUESTO es el bueno; el de la ficha queda de respaldo.
    const deptoPuesto = principal?.puestos?.departamentos ?? null;
    const depto = deptoPuesto ?? e.departamentos ?? null;
    const areaTexto = (depto?.area ?? "").toUpperCase();
    const area: AreaRatios | null =
      areaTexto === "OPERATIVA" ? "OPERATIVA" : areaTexto === "ADMINISTRATIVA" ? "ADMINISTRATIVA" : null;

    const propias = condiciones.get(e.id);
    const dePuesto = principal?.puesto_id ? salarioPuesto.get(principal.puesto_id) : undefined;

    // Precio de la hora: manda el guardado en las condiciones y, si no lo hay,
    // se deduce del sueldo. Así un coste corregido a mano se respeta siempre.
    const horaDe = (c?: { bruto: number; horas: number; costeHora: number | null; modoPago: ModoPago }) =>
      c
        ? c.costeHora && c.costeHora > 0
          ? c.costeHora
          : costeHoraSegunModo(c.modoPago, c.bruto, c.horas)
        : null;

    const horaPropia = horaDe(propias);
    const horaPuesto = horaDe(dePuesto);

    const usaPropias = horaPropia !== null && horaPropia > 0;
    const costeHora = usaPropias ? horaPropia : horaPuesto;
    const tieneCoste = costeHora !== null && costeHora > 0;

    const origen = usaPropias ? propias : dePuesto;
    const modoPago: ModoPago = origen?.modoPago === "HORAS" ? "HORAS" : "MENSUAL";
    const brutoOrigen = origen?.bruto ?? 0;

    mapa.set(e.user_id, {
      nombre: `${e.nombre ?? ""} ${e.apellidos ?? ""}`.trim() || "Sin nombre",
      modoPago,
      // Coste REAL de empresa: el bruto más la Seguridad Social que paga la
      // empresa por encima. El bruto solo es lo que cobra el trabajador.
      costeHora: tieneCoste ? costeHora! * factorSS : 0,
      // Quien cobra POR HORA no cobra los días que no trabaja: su día de
      // ausencia no cuesta nada. Solo el sueldo mensual se sigue pagando.
      costeDia:
        modoPago === "HORAS" || brutoOrigen <= 0
          ? 0
          : (brutoOrigen / DIAS_MES_NOMINA) * factorSS,
      tieneCoste,
      salarioDelPuesto: tieneCoste && !usaPropias,
      puesto: principal?.puestos?.nombre ?? "Sin puesto",
      departamento: depto?.nombre ?? "Sin departamento",
      area,
    });
  }

  return mapa;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

/** Acumulador reutilizable para agrupar por área, departamento o puesto. */
interface Acumulado {
  nombre: string;
  area: AreaRatios | null;
  departamento: string | null;
  horas: number;
  coste: number;
  personas: Set<string>;
}

function sumarEn(
  mapa: Map<string, Acumulado>,
  clave: string,
  base: { nombre: string; area: AreaRatios | null; departamento: string | null },
  horas: number,
  coste: number,
  persona: string,
) {
  const actual = mapa.get(clave) ?? { ...base, horas: 0, coste: 0, personas: new Set<string>() };
  actual.horas += horas;
  actual.coste += coste;
  actual.personas.add(persona);
  mapa.set(clave, actual);
}

/**
 * Convierte los acumulados en filas de tabla.
 *
 * `costeReal` permite repartir un total distinto al calculado por horas: en modo
 * NÓMINA el total lo manda la gestoría, y las horas solo dicen en qué proporción
 * se reparte entre áreas, departamentos y puestos.
 */
function aFilas(
  mapa: Map<string, Acumulado>,
  costeCalculado: number,
  facturacion: number,
  costeReal?: number,
): FilaRatio[] {
  const factor = costeReal !== undefined && costeCalculado > 0 ? costeReal / costeCalculado : 1;
  const total = costeReal ?? costeCalculado;
  return [...mapa.entries()]
    .map(([clave, v]) => {
      const coste = v.coste * factor;
      return {
        clave,
        nombre: v.nombre,
        area: v.area,
        departamento: v.departamento,
        horas: céntimos(v.horas),
        coste: céntimos(coste),
        personas: v.personas.size,
        pctSobreCoste: total > 0 ? (coste / total) * 100 : 0,
        pctSobreFacturacion: facturacion > 0 ? (coste / facturacion) * 100 : 0,
      };
    })
    .sort((a, b) => b.coste - a.coste);
}

/**
 * Cómo puede acabar el mes si sigue como va.
 *
 * La facturación pendiente NO se estima con una media plana: un sábado factura
 * varias veces más que un lunes, así que se proyecta con la media de cada día de
 * la semana sacada del histórico real. El coste se proyecta al mismo ritmo que
 * lleva, porque la plantilla no cambia de un día para otro.
 *
 * Devuelve null si el rango no es un mes en curso: proyectar un mes ya cerrado
 * no aporta nada.
 */
async function calcularProyeccion(args: {
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"];
  empresaId: string;
  fromIso: string;
  toIso: string;
  facturacionReal: number;
  costeHastaHoy: number;
  facturacionPorDia: Map<string, number>;
}): Promise<Proyeccion | null> {
  const { supabase, empresaId, fromIso, toIso, facturacionReal, costeHastaHoy } = args;

  // Solo para un mes natural que todavía no ha terminado.
  const hoy = new Date().toISOString().slice(0, 10);
  const mismoMes = fromIso.slice(0, 7) === toIso.slice(0, 7);
  if (!mismoMes || toIso <= hoy || fromIso > hoy) return null;

  const diasDelMes = diasEntre(fromIso, toIso);
  const transcurridos = diasDelMes.filter((d) => d <= hoy);
  const restantes = diasDelMes.filter((d) => d > hoy);
  if (restantes.length === 0 || transcurridos.length === 0) return null;

  // Histórico: los 90 días anteriores al mes que se está mirando.
  const desdeHist = new Date(Date.parse(`${fromIso}T00:00:00Z`) - 90 * 86400000)
    .toISOString()
    .slice(0, 10);
  const { data: hist } = await supabase
    .from("pos_tickets")
    .select("total, cerrado_at")
    .eq("empresa_id", empresaId)
    .eq("estado", "COBRADO")
    .gte("cerrado_at", `${desdeHist}T00:00:00`)
    .lt("cerrado_at", `${fromIso}T00:00:00`);

  // Facturación por día del histórico, agrupada por día de la semana.
  const porDiaHist = new Map<string, number>();
  for (const t of hist ?? []) {
    const cerrado = t.cerrado_at as string | null;
    if (!cerrado) continue;
    const dia = String(cerrado).slice(0, 10);
    porDiaHist.set(dia, (porDiaHist.get(dia) ?? 0) + toNum(t.total));
  }

  const porDiaSemana = new Map<number, number[]>();
  for (const [dia, importe] of porDiaHist) {
    const dow = new Date(`${dia}T00:00:00Z`).getUTCDay();
    const lista = porDiaSemana.get(dow) ?? [];
    lista.push(importe);
    porDiaSemana.set(dow, lista);
  }

  // Sin histórico suficiente no se inventa una previsión.
  const diasHistorico = porDiaHist.size;
  if (diasHistorico < 14) return null;

  const mediaGlobal =
    [...porDiaHist.values()].reduce((s, v) => s + v, 0) / Math.max(1, porDiaHist.size);

  let facturacionEstimadaRestante = 0;
  for (const dia of restantes) {
    const dow = new Date(`${dia}T00:00:00Z`).getUTCDay();
    const muestras = porDiaSemana.get(dow) ?? [];
    const media =
      muestras.length > 0 ? muestras.reduce((s, v) => s + v, 0) / muestras.length : mediaGlobal;
    facturacionEstimadaRestante += media;
  }

  // El coste sigue el ritmo que lleva el mes: plantilla estable.
  const costePorDia = costeHastaHoy / transcurridos.length;
  const costeProyectado = costeHastaHoy + costePorDia * restantes.length;
  const facturacionProyectada = facturacionReal + facturacionEstimadaRestante;

  return {
    diasTranscurridos: transcurridos.length,
    diasRestantes: restantes.length,
    facturacionReal: céntimos(facturacionReal),
    facturacionEstimadaRestante: céntimos(facturacionEstimadaRestante),
    facturacionProyectada: céntimos(facturacionProyectada),
    costeProyectado: céntimos(costeProyectado),
    pctProyectado:
      facturacionProyectada > 0 ? (costeProyectado / facturacionProyectada) * 100 : null,
    diasHistorico,
  };
}

/**
 * Coste de personal de un rango, agrupado como se pida, y comparado con lo que
 * se facturó en ese mismo periodo.
 */
export async function getRatiosDashboard(
  fromIso: string,
  toIso: string,
  periodo: PeriodoRatios,
  modoSolicitado: ModoCoste = "ESTIMACION",
): Promise<{ ok: true; data: RatiosDashboard } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Seguridad Social a cargo de la empresa (Ajustes → RRHH). Se suma al coste
    // por hora y al día de ausencia: sin ella el coste de personal sale corto.
    const { data: cfgRrhh } = await supabase
      .from("empresa_rrhh_config")
      .select("seguridad_social_empresa_pct")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    const ssPct = Number(cfgRrhh?.seguridad_social_empresa_pct ?? SS_EMPRESA_PCT_DEFECTO);
    const seguridadSocialPct = Number.isFinite(ssPct) && ssPct >= 0 ? ssPct : SS_EMPRESA_PCT_DEFECTO;
    const factorSS = 1 + seguridadSocialPct / 100;

    const costes = await construirCostes(supabase, empresaId, factorSS);

    // ── Horas fichadas del rango ──
    // `horas_totales` ya viene calculado y con la pausa descontada, y `fecha` es
    // el día al que pertenece el turno aunque cruce la medianoche.
    const { data: fichajes, error: errFich } = await supabase
      .from("fichajes")
      .select("empleado_id, empleado_nombre, fecha, horas_totales")
      .eq("empresa_id", empresaId)
      .gte("fecha", fromIso)
      .lte("fecha", toIso);
    if (errFich) throw errFich;

    // ── Facturación del rango ──
    const { data: tickets, error: errTick } = await supabase
      .from("pos_tickets")
      .select("total, cerrado_at")
      .eq("empresa_id", empresaId)
      .eq("estado", "COBRADO")
      .gte("cerrado_at", `${fromIso}T00:00:00`)
      .lte("cerrado_at", `${toIso}T23:59:59`);
    if (errTick) throw errTick;

    // Facturación por día natural, para luego agruparla igual que las horas.
    const facturacionPorDia = new Map<string, number>();
    for (const t of tickets ?? []) {
      const cerrado = t.cerrado_at as string | null;
      if (!cerrado) continue;
      const dia = String(cerrado).slice(0, 10);
      facturacionPorDia.set(dia, (facturacionPorDia.get(dia) ?? 0) + toNum(t.total));
    }

    const porArea = new Map<string, Acumulado>();
    const porDepartamento = new Map<string, Acumulado>();
    const porPuesto = new Map<string, Acumulado>();
    const serieMap = new Map<string, PuntoRatio>();

    let horasTotal = 0;
    let costeTotal = 0;
    const personasTotal = new Set<string>();

    // Quien ficha pero no tiene precio de hora: sus horas cuentan y su coste no,
    // así que el total sale corto y hay que decirlo en pantalla.
    const sinCoste = new Map<string, number>();
    const conSalarioDePuesto = new Set<string>();

    for (const f of fichajes ?? []) {
      const userId = f.empleado_id as string;
      const fecha = String(f.fecha).slice(0, 10);
      const horas = toNum(f.horas_totales);
      if (horas <= 0) continue;

      const info = costes.get(userId);
      const coste = info?.tieneCoste ? horas * info.costeHora : 0;

      horasTotal += horas;
      costeTotal += coste;
      personasTotal.add(userId);

      if (!info || !info.tieneCoste) {
        const nombre = info?.nombre || (f.empleado_nombre as string) || "Sin nombre";
        sinCoste.set(nombre, (sinCoste.get(nombre) ?? 0) + horas);
      } else if (info.salarioDelPuesto) {
        conSalarioDePuesto.add(userId);
      }

      const area = info?.area ?? null;
      const departamento = info?.departamento ?? "Sin departamento";
      const puesto = info?.puesto ?? "Sin puesto";

      sumarEn(porArea, area ?? "SIN_AREA", { nombre: area ?? "Sin área", area, departamento: null }, horas, coste, userId);
      sumarEn(porDepartamento, departamento, { nombre: departamento, area, departamento: null }, horas, coste, userId);
      sumarEn(porPuesto, `${departamento}||${puesto}`, { nombre: puesto, area, departamento }, horas, coste, userId);

      const { clave, etiqueta } = agrupar(fecha, periodo);
      const punto: PuntoRatio = serieMap.get(clave) ?? {
        clave,
        etiqueta,
        horas: 0,
        coste: 0,
        costeAusencias: 0,
        costeTotal: 0,
        facturacion: 0,
        pctCostePersonal: null,
      };
      punto.horas += horas;
      punto.coste += coste;
      serieMap.set(clave, punto);
    }

    // La facturación se agrupa igual que las horas, para que el porcentaje
    // compare siempre el mismo periodo en ambos lados.
    for (const [dia, importe] of facturacionPorDia) {
      const { clave, etiqueta } = agrupar(dia, periodo);
      const punto: PuntoRatio = serieMap.get(clave) ?? {
        clave,
        etiqueta,
        horas: 0,
        coste: 0,
        costeAusencias: 0,
        costeTotal: 0,
        facturacion: 0,
        pctCostePersonal: null,
      };
      punto.facturacion += importe;
      serieMap.set(clave, punto);
    }

    // ── Ausencias pagadas del rango ──
    // Vacaciones, permisos y bajas: no se ficha, pero la nómina llega igual. Se
    // reparten por sus DÍAS REALES, así que el coste cae en los días en que cada
    // persona los disfruta, no promediado por todo el año.
    const { data: ausencias, error: errAus } = await supabase
      .from("solicitudes_personal")
      .select("user_id, subtipo, fecha_inicio, fecha_fin")
      .eq("empresa_id", empresaId)
      .eq("tipo", "ausencia")
      .eq("estado", "aprobada")
      .lte("fecha_inicio", toIso)
      .gte("fecha_fin", fromIso);
    if (errAus) throw errAus;

    const ausenciasMap = new Map<TipoAusencia, { dias: number; coste: number; personas: Set<string> }>();
    let costeAusenciasTotal = 0;

    for (const a of ausencias ?? []) {
      const userId = a.user_id as string | null;
      if (!userId) continue;
      const info = costes.get(userId);
      // Quien cobra POR HORA no cobra lo que no trabaja: su ausencia no genera
      // coste, así que no entra en este apartado (que es de coste, no de días
      // libres). Contarla a 0 € solo ensuciaría el recuento.
      if (info?.modoPago === "HORAS") continue;
      // Sin precio para su día no se puede valorar: se deja fuera y ya se avisa
      // en el aviso de cobertura.
      const costeDia = info?.costeDia ?? 0;

      const subtipo = String(a.subtipo ?? "");
      const tipo: TipoAusencia =
        subtipo === "vacaciones" || subtipo === "permiso" || subtipo === "baja_medica" ? subtipo : "otra";

      // Solo los días que caen DENTRO del rango que se está mirando.
      const ini = String(a.fecha_inicio).slice(0, 10);
      const fin = String(a.fecha_fin ?? a.fecha_inicio).slice(0, 10);
      const desde = ini > fromIso ? ini : fromIso;
      const hasta = fin < toIso ? fin : toIso;

      for (const dia of diasEntre(desde, hasta)) {
        const acc = ausenciasMap.get(tipo) ?? { dias: 0, coste: 0, personas: new Set<string>() };
        acc.dias += 1;
        acc.coste += costeDia;
        acc.personas.add(userId);
        ausenciasMap.set(tipo, acc);
        costeAusenciasTotal += costeDia;

        // El coste del día de ausencia entra en la serie igual que las horas.
        const { clave, etiqueta } = agrupar(dia, periodo);
        const punto: PuntoRatio = serieMap.get(clave) ?? {
          clave,
          etiqueta,
          horas: 0,
          coste: 0,
          costeAusencias: 0,
          costeTotal: 0,
          facturacion: 0,
          pctCostePersonal: null,
        };
        punto.costeAusencias += costeDia;
        serieMap.set(clave, punto);
      }
    }

    const listaAusencias: CosteAusencia[] = [...ausenciasMap.entries()]
      .map(([tipo, v]) => ({
        tipo,
        dias: v.dias,
        personas: v.personas.size,
        coste: céntimos(v.coste),
      }))
      .sort((a, b) => b.coste - a.coste);

    const facturacionTotal = [...facturacionPorDia.values()].reduce((s, v) => s + v, 0);

    // ── Coste por PAGOS REALES ──
    // Lo que consta en nómina más la Seguridad Social. Es el dato exacto, pero
    // solo existe una vez cerrado el mes y subidos los pagos. Si se pide y no
    // hay nada cargado, se cae a la estimación y se avisa en pantalla.
    let modo: ModoCoste = "ESTIMACION";
    let costeNomina = 0;
    if (modoSolicitado === "NOMINA") {
      const periodosDelRango = mesesEntre(fromIso, toIso);
      const { data: pagos, error: errPagos } = await supabase
        .from("rrhh_pagos")
        .select("total, nomina, ss_empresa, periodo")
        .eq("empresa_id", empresaId)
        .in("periodo", periodosDelRango);
      if (errPagos) throw errPagos;

      const filas = pagos ?? [];
      if (filas.length > 0) {
        modo = "NOMINA";
        for (const pago of filas) {
          // `total` = nómina + complementos + horas extras + bonus + ajustes. Es lo
          // que se le paga de verdad a la persona. Usar solo `nomina` dejaba fuera
          // complementos y extras: en agosto, 1.655 € de BACANAL y 2.155 € de HABANA.
          const cobrado = toNum(pago.total);
          // La Seguridad Social viene de la gestoría; si esa fila no la trae, se
          // completa con el % configurado sobre lo cobrado.
          const ss =
            pago.ss_empresa != null ? toNum(pago.ss_empresa) : cobrado * (seguridadSocialPct / 100);
          costeNomina += cobrado + ss;
        }
      }
    }

    const serie = [...serieMap.values()]
      .map((p) => {
        const total = p.coste + p.costeAusencias;
        return {
          ...p,
          horas: céntimos(p.horas),
          coste: céntimos(p.coste),
          costeAusencias: céntimos(p.costeAusencias),
          costeTotal: céntimos(total),
          facturacion: céntimos(p.facturacion),
          // Sin facturación no hay porcentaje que dar: null, nunca 0.
          pctCostePersonal: p.facturacion > 0 ? (total / p.facturacion) * 100 : null,
        };
      })
      .sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0));

    // En modo NÓMINA el coste ya lo dice la gestoría; en estimación se calcula
    // desde las horas. Las ausencias SOLO suman en estimación: dentro de la
    // nómina ya están pagadas, y contarlas otra vez sería duplicarlas.
    const costeTrabajado = modo === "NOMINA" ? costeNomina : costeTotal;
    const costeAusenciasFinal = modo === "NOMINA" ? 0 : costeAusenciasTotal;
    const costeFinal = costeTrabajado + costeAusenciasFinal;

    // ── Proyección a fin de mes ──
    // Solo tiene sentido sobre un mes que aún está corriendo.
    const proyeccion = await calcularProyeccion({
      supabase,
      empresaId,
      fromIso,
      toIso,
      facturacionReal: facturacionTotal,
      costeHastaHoy: costeFinal,
      facturacionPorDia,
    });

    return {
      ok: true,
      data: {
        rango: { from: fromIso, to: toIso },
        periodo,
        modo,
        modoSolicitado,
        proyeccion,
        resumen: {
          horas: céntimos(horasTotal),
          coste: céntimos(costeTrabajado),
          costeAusencias: céntimos(costeAusenciasFinal),
          costeTotal: céntimos(costeFinal),
          facturacion: céntimos(facturacionTotal),
          pctCostePersonal: facturacionTotal > 0 ? (costeFinal / facturacionTotal) * 100 : null,
          personas: personasTotal.size,
          costeHoraMedio: horasTotal > 0 ? costeTrabajado / horasTotal : 0,
          seguridadSocialPct,
        },
        serie,
        // En modo NÓMINA las horas fichadas REPARTEN el coste real entre áreas,
        // departamentos y puestos: el total lo manda la nómina, y las horas dicen
        // dónde se fue. Así el desglose siempre suma lo que de verdad se pagó.
        porArea: aFilas(porArea, costeTotal, facturacionTotal, costeTrabajado),
        porDepartamento: aFilas(porDepartamento, costeTotal, facturacionTotal, costeTrabajado),
        porPuesto: aFilas(porPuesto, costeTotal, facturacionTotal, costeTrabajado),
        ausencias: listaAusencias,
        cobertura: {
          empleadosSinCoste: sinCoste.size,
          horasSinCoste: céntimos([...sinCoste.values()].reduce((s, v) => s + v, 0)),
          nombresSinCoste: [...sinCoste.keys()].sort(),
          empleadosConSalarioDePuesto: conSalarioDePuesto.size,
        },
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[ratios] getRatiosDashboard:", msg);
    return { ok: false, error: msg };
  }
}
