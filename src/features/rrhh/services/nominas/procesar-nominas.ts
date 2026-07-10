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
  meses: string[]; // periodos AAAA-MM tocados
}

export async function procesarNominasConAdmin(
  admin: SupabaseClient,
  empresaId: string,
  nominas: NominaLeida[],
  periodoDefecto: string,
): Promise<ResultadoProceso> {
  const vacio: ResultadoProceso = { leidas: nominas.length, guardadas: 0, yaExistian: 0, sinEmpleado: [], duplicadas: [], mesIncorrecto: [], conIncidencia: 0, meses: [] };
  try {
    // TODOS los empleados activos de la empresa (fuente fresca).
    const { data: emps } = await admin
      .from("empleados")
      .select("id, nombre, apellidos, dni_nie")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo");

    const norm = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const tokens = (s: string) =>
      new Set(norm(s).split(" ").filter((w) => w.length >= 3 && !["del", "las", "los"].includes(w)));

    type Emp = { id: string; nombre: string };
    const porDni = new Map<string, Emp>();
    const porNombre = new Map<string, Emp>();
    for (const e of emps ?? []) {
      const full = `${e.nombre ?? ""} ${e.apellidos ?? ""}`.trim();
      const emp: Emp = { id: e.id as string, nombre: full };
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

    const res: ResultadoProceso = { leidas: nominas.length, guardadas: 0, yaExistian: 0, sinEmpleado: [], duplicadas: [], mesIncorrecto: [], conIncidencia: 0, meses: [] };
    const meses = new Set<string>();

    for (const n of nominas) {
      const emp = emparejar(n);
      if (!emp) {
        // Mostrar lo que leyó la IA (nombre + DNI) para diagnosticar por qué no
        // cuadró (DNI mal leído, nombre distinto, o EMPLEADO NO DADO DE ALTA).
        const etiq = [n.nombre?.trim(), n.dniNie ? `(${n.dniNie})` : ""].filter(Boolean).join(" ");
        res.sinEmpleado.push(etiq || "nómina sin identificar");
        continue;
      }

      // VALIDACIÓN DE MES: la nómina debe ser del mes solicitado. Si la IA leyó un
      // periodo válido y NO coincide, se DESCARTA por completo: el `continue` es
      // ANTES de subir el PDF al bucket y de insertar en BD, así que la nómina de
      // otro mes no deja ningún rastro (no se guarda ni el documento ni la fila).
      // Solo se registra para avisar a la gestoría de que la anule por su lado.
      // Si no se pudo leer el mes, se acepta como del mes solicitado (no bloquear
      // por un OCR ilegible).
      const periodoLeido = /^\d{4}-\d{2}$/.test(n.periodo) ? n.periodo : "";
      if (periodoLeido && periodoLeido !== periodoDefecto) {
        res.mesIncorrecto.push({ etiqueta: emp.nombre, periodoLeido });
        continue;
      }
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

      // ¿Ya está ESTA MISMA nómina cargada? (evita duplicar al re-subir el mismo
      // PDF). Se identifica por empleado+mes+importes. Si coincide, se salta.
      const { data: yaMismas } = await admin
        .from("rrhh_pagos_nominas")
        .select("id")
        .eq("empresa_id", empresaId).eq("empleado_id", emp.id).eq("periodo", periodo)
        .eq("neto", n.neto || 0).eq("ss_empleado", n.ssEmpleado || 0).eq("irpf", n.irpf || 0);
      if (yaMismas && yaMismas.length > 0) { res.yaExistian++; res.duplicadas.push(emp.nombre); continue; }

      // Nº de nóminas ya existentes de este empleado/mes (para ordenar y nombrar el
      // documento sin pisar los anteriores).
      const { count: nPrevias } = await admin
        .from("rrhh_pagos_nominas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId).eq("empleado_id", emp.id).eq("periodo", periodo);
      const orden = nPrevias ?? 0;

      // Subir el documento de ESTA nómina (path único por orden: no pisa las otras).
      const path = `${empresaId}/${periodo}/${emp.id}-${orden}.${ext}`;
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
        irpf: n.irpf || 0, neto: n.neto || 0, nomina_path: path,
        revision_estado: revisionEstado, incidencia,
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
        await admin.from("rrhh_pagos").update(campos).eq("id", ex.id);
      } else {
        await admin.from("rrhh_pagos").insert({
          empresa_id: empresaId, empleado_id: emp.id, empleado_nombre: emp.nombre, periodo, ...campos,
        });
      }
      res.guardadas++;
      meses.add(periodo);
    }
    res.meses = [...meses].sort();
    return res;
  } catch (err) {
    console.error("[rrhh] procesarNominasConAdmin:", err);
    return vacio;
  }
}
