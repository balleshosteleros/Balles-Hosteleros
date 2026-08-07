import "server-only";

/**
 * Núcleo de emparejado + volcado de nóminas leídas por IA a `rrhh_pagos`.
 *
 * Usa SOLO el cliente admin y un `empresaId` explícito (sin `getAppContext`), por
 * lo que sirve tanto para el flujo autenticado (subida manual desde Pagos) como
 * para el enlace PÚBLICO de la gestoría (`/api/gestoria/nominas/[token]`).
 *
 * Empareja por DNI/NIE (inequívoco) y, como respaldo, por nombre (tokens). Cada
 * nómina DEBE ser del mes solicitado (`periodoDefecto`): si la IA lee un periodo
 * DISTINTO, la nómina se RECHAZA (no se vuelca) y se informa a quien la sube para
 * que la anule y no la vuelva a adjuntar. Si la IA no logra leer el mes, se acepta
 * como del mes solicitado. No regraba si el empleado ya tiene nómina ese mes;
 * respeta el bloqueo de liquidaciones ya enviadas.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarDniNie } from "@/features/rrhh/lib/documentacion-validacion";

/** Bucket privado donde vive el PDF/imagen original de cada nómina. */
export const BUCKET_NOMINAS = "rrhh-nominas";

export const EXT_POR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Una nómina leída por la IA lista para emparejar y guardar. */
export interface NominaLeida {
  dniNie: string;
  nombre: string;
  ssEmpleado: number;
  ssEmpresa: number;
  neto: number;
  irpf: number;
  periodo: string; // AAAA-MM leído de la nómina, o "" si no se leyó
  mimeType: string;
  archivoBase64: string;
}

/** Empleado ya de baja al subir su nómina. Se admite; solo se avisa. */
export interface NominaEmpleadoInactivo {
  nombre: string;
  /** Fin de contrato (AAAA-MM-DD), o null si no consta. */
  fechaBaja: string | null;
}

/** Una nómina rechazada por pertenecer a un mes distinto al solicitado. */
export interface NominaMesIncorrecto {
  etiqueta: string; // empleado (o nombre/DNI leído) para identificarla
  periodoLeido: string; // AAAA-MM que la IA leyó en la nómina
}

export interface ResultadoProceso {
  leidas: number; // nº de nóminas que leyó la IA (total del archivo)
  guardadas: number;
  yaExistian: number;
  sinEmpleado: string[]; // etiquetas (nombre/dni) de las no emparejadas (NO dadas de alta)
  duplicadas: string[]; // nombres de empleados que ya tenían nómina ese mes
  mesIncorrecto: NominaMesIncorrecto[]; // rechazadas por ser de OTRO mes
  conIncidencia: number; // volcadas pero marcadas para revisión (p.ej. neto 0)
  // Empleados que YA constaban de baja el día de subir su nómina. NO es un error y
  // NO bloquea: es lo normal cuando la baja es a fin de mes y la nómina llega el
  // día 1. Se listan con su FECHA DE FIN DE CONTRATO para que quien la sube pueda
  // comprobar de un vistazo que el periodo cobrado cuadra con lo trabajado.
  inactivos: NominaEmpleadoInactivo[];
  meses: string[]; // periodos AAAA-MM tocados
  // Si el archivo tiene ALGUNA nómina con error (otro mes o empleado no dado de
  // alta), se rechaza ENTERO: no se guarda ninguna. La gestoría debe corregir el
  // archivo y volver a subirlo completo.
  rechazadoTodo: boolean;
}

export async function procesarNominasConAdmin(
  admin: SupabaseClient,
  empresaId: string,
  nominas: NominaLeida[],
  periodoDefecto: string,
): Promise<ResultadoProceso> {
  const vacio: ResultadoProceso = { leidas: nominas.length, guardadas: 0, yaExistian: 0, sinEmpleado: [], duplicadas: [], mesIncorrecto: [], conIncidencia: 0, inactivos: [], meses: [], rechazadoTodo: false };
  try {
    // TODOS los empleados de la empresa, ACTIVOS E INACTIVOS (fuente fresca).
    // Los inactivos SÍ entran: el mes de la baja se cobra igual (finiquito y/o
    // nómina del periodo trabajado), y filtrarlos hacía que su nómina se tomara
    // por "empleado no dado de alta" y se RECHAZARA EL ARCHIVO ENTERO.
    // Se guarda el estado para sellarlo en la nómina y avisar en Pagos.
    const { data: emps } = await admin
      .from("empleados")
      .select("id, nombre, apellidos, dni_nie, estado, fecha_baja")
      .eq("empresa_id", empresaId);

    const norm = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const tokens = (s: string) =>
      new Set(norm(s).split(" ").filter((w) => w.length >= 3 && !["del", "las", "los"].includes(w)));

    type Emp = { id: string; nombre: string; inactivo: boolean; fechaBaja: string | null };
    const porDni = new Map<string, Emp>();
    const porNombre = new Map<string, Emp>();
    for (const e of emps ?? []) {
      const full = `${e.nombre ?? ""} ${e.apellidos ?? ""}`.trim();
      const emp: Emp = {
        id: e.id as string,
        nombre: full,
        inactivo: (e.estado as string | null) !== "Activo",
        fechaBaja: (e.fecha_baja as string | null) ?? null,
      };
      if (e.dni_nie) porDni.set(normalizarDniNie(e.dni_nie as string), emp);
      porNombre.set(norm(full), emp);
    }

    const emparejar = (n: NominaLeida): Emp | undefined => {
      const dni = n.dniNie ? normalizarDniNie(n.dniNie) : "";
      if (dni && porDni.has(dni)) return porDni.get(dni);
      const nombreIa = norm(n.nombre || "");
      if (!nombreIa) return undefined;
      if (porNombre.has(nombreIa)) return porNombre.get(nombreIa);
      const setIa = tokens(nombreIa);
      if (setIa.size === 0) return undefined;
      let mejor: Emp | undefined;
      let mejorComunes = 0;
      for (const [k, v] of porNombre) {
        const setEmp = tokens(k);
        let comunes = 0;
        for (const w of setIa) if (setEmp.has(w)) comunes++;
        const req = Math.min(2, setIa.size, setEmp.size);
        if (comunes >= req && comunes > mejorComunes) { mejor = v; mejorComunes = comunes; }
      }
      return mejor;
    };

    const res: ResultadoProceso = { leidas: nominas.length, guardadas: 0, yaExistian: 0, sinEmpleado: [], duplicadas: [], mesIncorrecto: [], conIncidencia: 0, inactivos: [], meses: [], rechazadoTodo: false };
    const meses = new Set<string>();

    // ── FASE 1: VALIDACIÓN PREVIA (sin tocar BD ni bucket) ────────────────────
    // Comprobamos TODO el archivo antes de guardar nada. Si ALGUNA nómina es de
    // otro mes o de un empleado NO dado de alta, se rechaza el archivo ENTERO:
    // no se vuelca ninguna. La gestoría corrige el archivo y lo vuelve a subir.
    // (Si la IA no lee el mes, se acepta como del mes solicitado: no bloquea.)
    type Emparejada = { n: NominaLeida; emp: Emp };
    const validas: Emparejada[] = [];
    for (const n of nominas) {
      const emp = emparejar(n);
      if (!emp) {
        const etiq = [n.nombre?.trim(), n.dniNie ? `(${n.dniNie})` : ""].filter(Boolean).join(" ");
        res.sinEmpleado.push(etiq || "nómina sin identificar");
        continue;
      }
      const periodoLeido = /^\d{4}-\d{2}$/.test(n.periodo) ? n.periodo : "";
      if (periodoLeido && periodoLeido !== periodoDefecto) {
        res.mesIncorrecto.push({ etiqueta: emp.nombre, periodoLeido });
        continue;
      }
      validas.push({ n, emp });
    }

    // ¿Hay errores? → NO se guarda nada. Se devuelve el detalle para la gestoría.
    if (res.mesIncorrecto.length > 0 || res.sinEmpleado.length > 0) {
      res.rechazadoTodo = true;
      return res;
    }

    // ── FASE 2: VOLCADO (solo si el archivo está 100% correcto) ───────────────
    for (const { n, emp } of validas) {
      const periodo = periodoDefecto;
      const ext = EXT_POR_MIME[n.mimeType];
      if (!ext) continue;

      // Estado actual del pago de ese empleado/mes.
      const { data: ex } = await admin
        .from("rrhh_pagos")
        .select("id, confirmacion_enviada_at")
        .eq("empresa_id", empresaId).eq("empleado_id", emp.id).eq("periodo", periodo)
        .maybeSingle();
      if (ex?.confirmacion_enviada_at) { continue; } // liquidación enviada: intocable

      // ¿Ya está ESTE MISMO documento cargado? (evita duplicar al re-subir el
      // mismo PDF). Se identifica por la HUELLA del archivo, no por los importes:
      // un finiquito puede coincidir en neto/ss/irpf con la nómina normal del mes
      // — el caso que esta tabla existe para soportar — y compararlo por importes
      // lo descartaba como "duplicado", con lo que el empleado cobraba de menos.
      const sha256 = createHash("sha256").update(Buffer.from(n.archivoBase64, "base64")).digest("hex");
      const { data: yaMismas } = await admin
        .from("rrhh_pagos_nominas")
        .select("id")
        .eq("empresa_id", empresaId).eq("empleado_id", emp.id).eq("periodo", periodo)
        .eq("sha256", sha256);
      if (yaMismas && yaMismas.length > 0) { res.yaExistian++; res.duplicadas.push(emp.nombre); continue; }

      // Nº de nóminas ya existentes de este empleado/mes (para ordenar y nombrar el
      // documento sin pisar los anteriores).
      const { count: nPrevias } = await admin
        .from("rrhh_pagos_nominas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId).eq("empleado_id", emp.id).eq("periodo", periodo);
      const orden = nPrevias ?? 0;

      // Subir el documento de ESTA nómina. El path lleva la huella del archivo, no
      // el `orden`: con `orden` dos volcados simultáneos calculan el mismo número
      // y, al ir con `upsert: true`, el segundo pisaba el PDF del primero.
      const path = `${empresaId}/${periodo}/${emp.id}-${orden}-${sha256.slice(0, 12)}.${ext}`;
      const up = await admin.storage.from(BUCKET_NOMINAS)
        .upload(path, Buffer.from(n.archivoBase64, "base64"), { upsert: true, contentType: n.mimeType });
      if (up.error) continue;

      // Incidencia detectable en el volcado: el neto (líquido a percibir) no se
      // pudo leer o es 0. Se vuelca igual, pero marcada para que RRHH la revise.
      const incidencia = (n.neto || 0) <= 0 ? "Importe neto no leído o a 0 €. Revisar el documento." : null;
      const revisionEstado = incidencia ? "con_incidencia" : "correcta";
      if (incidencia) res.conIncidencia++;

      // 1) Guardar la nómina INDIVIDUAL.
      await admin.from("rrhh_pagos_nominas").insert({
        empresa_id: empresaId, empleado_id: emp.id, periodo, orden,
        ss_empleado: n.ssEmpleado || 0, ss_empresa: n.ssEmpresa || 0,
        irpf: n.irpf || 0, neto: n.neto || 0, nomina_path: path, sha256,
        revision_estado: revisionEstado, incidencia,
        // SELLO del estado del empleado EN ESTE INSTANTE. El aviso de "cobra
        // alguien ya dado de baja" depende de si estaba inactivo AL SUBIR la
        // nómina; si se le da de baja DESPUÉS, no debe marcarse. Por eso se
        // congela aquí y no se recalcula leyendo `empleados.estado` al pintar.
        empleado_inactivo_al_subir: emp.inactivo,
      });

      // 2) Recalcular la SUMA de todas las nóminas de ese empleado/mes y volcarla
      //    a rrhh_pagos (fuente de la tabla). Path principal = el de la 1ª nómina.
      const { data: todas } = await admin
        .from("rrhh_pagos_nominas")
        .select("ss_empleado, ss_empresa, irpf, neto, nomina_path, orden")
        .eq("empresa_id", empresaId).eq("empleado_id", emp.id).eq("periodo", periodo)
        .neq("revision_estado", "denegada") // las denegadas no cuentan en la suma
        .order("orden", { ascending: true });
      const lista = todas ?? [];
      const suma = lista.reduce(
        (a, r) => ({
          ss_empleado: a.ss_empleado + Number(r.ss_empleado),
          ss_empresa: a.ss_empresa + Number(r.ss_empresa),
          irpf: a.irpf + Number(r.irpf),
          nomina: a.nomina + Number(r.neto),
        }),
        { ss_empleado: 0, ss_empresa: 0, irpf: 0, nomina: 0 },
      );
      const campos = { ...suma, nomina_path: lista[0]?.nomina_path ?? path };
      if (ex?.id) {
        // El volcado cambia `nomina`, que es un sumando del total a percibir. Hay
        // que recalcular `total` con el resto del desglose ya guardado; si no, la
        // fila queda con el total anterior a la nómina y el empleado cobraría un
        // importe distinto al que muestra su liquidación.
        const { data: prev } = await admin
          .from("rrhh_pagos")
          .select("pago, propina, horas_extras, bonus, propina_mes_anterior, ajuste")
          .eq("id", ex.id)
          .maybeSingle();
        const total =
          Number(prev?.pago ?? 0) +
          suma.nomina +
          Number(prev?.propina ?? 0) +
          Number(prev?.horas_extras ?? 0) +
          Number(prev?.bonus ?? 0) +
          Number(prev?.propina_mes_anterior ?? 0) +
          Number(prev?.ajuste ?? 0);
        await admin
          .from("rrhh_pagos")
          .update({ ...campos, total: Math.round(total * 100) / 100 })
          .eq("id", ex.id);
      } else {
        // Fila nueva: el único importe conocido es la nómina, así que el total
        // arranca igual a la suma de netos volcada.
        await admin.from("rrhh_pagos").insert({
          empresa_id: empresaId, empleado_id: emp.id, empleado_nombre: emp.nombre, periodo, ...campos,
          total: Math.round(suma.nomina * 100) / 100,
        });
      }
      res.guardadas++;
      // Aviso de precaución (NO error): la nómina es de alguien que ya constaba de
      // baja al subirla. Es lo esperable si la baja fue a fin de mes y la nómina
      // llega el día 1; la gestoría solo tiene que confirmar que es correcta.
      if (emp.inactivo && !res.inactivos.some((x) => x.nombre === emp.nombre)) {
        res.inactivos.push({ nombre: emp.nombre, fechaBaja: emp.fechaBaja });
      }
      meses.add(periodo);
    }
    res.meses = [...meses].sort();
    return res;
  } catch (err) {
    console.error("[rrhh] procesarNominasConAdmin:", err);
    return vacio;
  }
}
