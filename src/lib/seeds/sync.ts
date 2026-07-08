"use server";

/**
 * Sincronizador de seeds canónicos → BD.
 *
 * Estrategia: ADITIVA — solo inserta lo que falta. NUNCA borra, renombra ni
 * sobreescribe registros existentes en las empresas. Si un cliente personalizó
 * un departamento o rol, su personalización se respeta.
 *
 * - `seedEmpresaDefaults(empresaId, empresaSlug)`: siembra una empresa nueva.
 * - `syncSeedsToAllEmpresas()`: propaga los seeds a TODAS las empresas existentes.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizarDestinoDepartamento,
  type DestinoPlantilla,
} from "@/features/rrhh/lib/plantillas-onboarding";
import { DEPARTAMENTOS_SEED, normalizeDeptoNombre } from "./departamentos";
import { ROLES_SEED, normalizeRolNombre } from "./roles";
import { PUESTOS_SEED, normalizePuestoNombre } from "./puestos";
import { ORGANIGRAMA_SEED } from "./organigrama";
import { INSPECTOR_EMAIL_PLANTILLAS_SEED } from "./inspector-email-plantillas";
import { INSPECCION_PRESENTACION_SEED } from "./inspeccion-presentacion";
import { RESERVA_ETIQUETAS_SEED, normalizeReservaEtiquetaNombre } from "./reserva-etiquetas";
import { SALA_ETIQUETAS_SEED, normalizeEtiquetaNombre } from "./sala-etiquetas";
import { RESERVA_EMAIL_PLANTILLAS_SEED } from "./reserva-email-plantillas";
import { RECLUTAMIENTO_EMAIL_PLANTILLAS_SEED } from "./reclutamiento-email-plantillas";
import { RECLUTAMIENTO_PLANTILLA_ESTADOS_SEED } from "./reclutamiento-plantilla-estados";
import { RECLUTAMIENTO_CUESTIONARIO_DEFAULT_SEED } from "./reclutamiento-cuestionario-default";
import {
  CATEGORIAS_PRODUCTO_SEED,
  normalizeCategoriaProductoNombre,
} from "./categorias-producto";

type Admin = ReturnType<typeof createAdminClient>;

/** Devuelve el id del departamento de una empresa por nombre, o null si no existe. */
async function getDeptoIdByNombre(
  admin: Admin,
  empresaId: string,
  nombre: string,
): Promise<string | null> {
  const { data } = await admin
    .from("departamentos")
    .select("id, nombre")
    .eq("empresa_id", empresaId);
  const target = normalizeDeptoNombre(nombre);
  const match = (data ?? []).find(
    (d) => normalizeDeptoNombre(d.nombre as string) === target,
  );
  return (match?.id as string) ?? null;
}

/**
 * Sincroniza departamentos canónicos a una empresa concreta (aditivo).
 * Inserta los departamentos del seed que aún no existen en la empresa.
 * Si ya existen (por nombre, case-insensitive), respeta lo que hay.
 */
export async function syncDepartamentosAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creados: number }> {
  const { data: existentes } = await admin
    .from("departamentos")
    .select("nombre")
    .eq("empresa_id", empresaId);
  const setExistentes = new Set(
    (existentes ?? []).map((d) => normalizeDeptoNombre(d.nombre as string)),
  );

  const aCrear = DEPARTAMENTOS_SEED
    .filter((d) => !setExistentes.has(normalizeDeptoNombre(d.nombre)))
    .map((d) => ({
      empresa_id: empresaId,
      nombre: d.nombre,
      descripcion: d.descripcion,
      area: d.area,
      estado: d.estado,
      color: d.color,
    }));

  if (aCrear.length === 0) return { creados: 0 };
  const { error } = await admin.from("departamentos").insert(aCrear);
  if (error) throw error;
  return { creados: aCrear.length };
}

/**
 * Sincroniza roles canónicos a una empresa concreta (aditivo).
 * Resuelve `departamento_id` por nombre dentro de la empresa.
 */
export async function syncRolesAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creados: number }> {
  const { data: deptos } = await admin
    .from("departamentos")
    .select("id, nombre")
    .eq("empresa_id", empresaId);
  const deptoIdPorNombre = new Map(
    ((deptos ?? []) as Array<{ id: string; nombre: string }>).map((d) => [
      normalizeDeptoNombre(d.nombre),
      d.id,
    ]),
  );

  const { data: existentes } = await admin
    .from("empresa_roles")
    .select("nombre")
    .eq("empresa_id", empresaId);
  const setExistentes = new Set(
    (existentes ?? []).map((r) => normalizeRolNombre(r.nombre as string)),
  );

  const aCrear = ROLES_SEED
    .filter((r) => !setExistentes.has(normalizeRolNombre(r.nombre)))
    .map((r) => ({
      empresa_id: empresaId,
      nombre: r.nombre,
      descripcion: r.descripcion,
      permisos: r.permisos,
      protected: r.protected,
      es_admin_plataforma: r.esAdminPlataforma ?? false,
      departamento_id: r.departamento
        ? deptoIdPorNombre.get(normalizeDeptoNombre(r.departamento)) ?? null
        : null,
    }));

  if (aCrear.length === 0) return { creados: 0 };
  const { error } = await admin.from("empresa_roles").insert(aCrear);
  if (error) throw error;
  return { creados: aCrear.length };
}

/**
 * Sincroniza puestos canónicos a una empresa concreta (aditivo).
 * Resuelve `departamento_id` por nombre dentro de la empresa; omite los puestos
 * cuyo departamento no exista. Idempotente por (departamento, nombre).
 */
export async function syncPuestosAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creados: number }> {
  const { data: deptos } = await admin
    .from("departamentos")
    .select("id, nombre")
    .eq("empresa_id", empresaId);
  const deptoIdPorNombre = new Map(
    ((deptos ?? []) as Array<{ id: string; nombre: string }>).map((d) => [
      normalizeDeptoNombre(d.nombre),
      d.id,
    ]),
  );

  const { data: existentes } = await admin
    .from("puestos")
    .select("nombre, departamento_id")
    .eq("empresa_id", empresaId);
  // Clave existente = departamento_id|nombre normalizado.
  const setExistentes = new Set(
    ((existentes ?? []) as Array<{ nombre: string; departamento_id: string }>).map(
      (p) => `${p.departamento_id}|${normalizePuestoNombre(p.nombre)}`,
    ),
  );

  const aCrear: Array<Record<string, unknown>> = [];
  for (const p of PUESTOS_SEED) {
    const deptoId = deptoIdPorNombre.get(normalizeDeptoNombre(p.departamento));
    if (!deptoId) continue; // el departamento del seed no existe en la empresa
    const key = `${deptoId}|${normalizePuestoNombre(p.nombre)}`;
    if (setExistentes.has(key)) continue;
    setExistentes.add(key);
    aCrear.push({
      empresa_id: empresaId,
      departamento_id: deptoId,
      nombre: p.nombre,
      estado: "activo",
    });
  }

  if (aCrear.length === 0) return { creados: 0 };
  const { error } = await admin.from("puestos").insert(aCrear);
  if (error) throw error;
  return { creados: aCrear.length };
}

/**
 * Siembra el organigrama base SOLO si la empresa no tiene uno aún.
 * Si ya existe (incluso personalizado), no se toca.
 */
export async function syncOrganigramaAEmpresa(
  admin: Admin,
  empresaSlug: string,
): Promise<{ creado: boolean }> {
  const { data: existente } = await admin
    .from("organigramas")
    .select("empresa_slug")
    .eq("empresa_slug", empresaSlug)
    .maybeSingle();
  if (existente) return { creado: false };

  const { error } = await admin.from("organigramas").insert({
    empresa_slug: empresaSlug,
    nodes: ORGANIGRAMA_SEED.nodes,
    edges: ORGANIGRAMA_SEED.edges,
    zones: ORGANIGRAMA_SEED.zones,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { creado: true };
}

/**
 * Siembra una vacante en borrador por cada PUESTO de la empresa, enlazada
 * (puesto_id + departamento_id) con jornada y contrato canónicos.
 * Aditivo e idempotente: no duplica un puesto que ya tenga vacante y enlaza
 * vacantes homónimas sueltas a su puesto. Mismo criterio que
 * `asegurarVacantesPorPuesto` (acción de UI).
 */
export async function syncVacantesAEmpresa(
  admin: Admin,
  empresaId: string,
  _empresaSlug?: string,
): Promise<{ creadas: number }> {
  const [puestosRes, vacantesRes] = await Promise.all([
    admin
      .from("puestos")
      .select("id, nombre, departamento_id")
      .eq("empresa_id", empresaId)
      .eq("estado", "activo"),
    admin
      .from("vacantes")
      .select("id, titulo, puesto_id")
      .eq("empresa_id", empresaId),
  ]);

  const puestos = (puestosRes.data ?? []) as Array<{
    id: string; nombre: string; departamento_id: string | null;
  }>;
  const vacantes = (vacantesRes.data ?? []) as Array<{
    id: string; titulo: string | null; puesto_id: string | null;
  }>;
  if (puestos.length === 0) return { creadas: 0 };

  const norm = (s: string) => s.trim().toLowerCase();
  const puestoIdConVacante = new Set(
    vacantes.map((v) => v.puesto_id).filter(Boolean) as string[],
  );
  const vacantePorNombre = new Map<string, { id: string; puesto_id: string | null }>();
  for (const v of vacantes) vacantePorNombre.set(norm(v.titulo ?? ""), v);

  const aCrear: Array<Record<string, unknown>> = [];
  for (const p of puestos) {
    if (puestoIdConVacante.has(p.id)) continue; // ya tiene su vacante
    const homonima = vacantePorNombre.get(norm(p.nombre));
    if (homonima) {
      // Vacante con el mismo nombre pero sin enlazar → enlazar al puesto.
      if (!homonima.puesto_id) {
        await admin
          .from("vacantes")
          .update({ puesto_id: p.id, departamento_id: p.departamento_id })
          .eq("id", homonima.id);
      }
      continue;
    }
    aCrear.push({
      empresa_id: empresaId,
      titulo: p.nombre,
      puesto_id: p.id,
      departamento_id: p.departamento_id,
      tipo_jornada: "Jornada completa",
      tipo_contrato: "Indefinido",
      estado_publicacion: "borrador",
      visible_publicamente: false,
      cuestionario: false,
      favorita: false,
    });
  }

  if (aCrear.length === 0) return { creadas: 0 };
  const { error } = await admin.from("vacantes").insert(aCrear);
  if (error) throw error;
  return { creadas: aCrear.length };
}

/**
 * Sincroniza plantillas de email del pipeline de inspectores (aditivo).
 * Solo crea las fases que aún no existen en la empresa; NUNCA sobreescribe
 * personalizaciones del cliente.
 */
export async function syncInspectorEmailPlantillasAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creadas: number }> {
  const { data: existentes } = await admin
    .from("inspector_email_plantillas")
    .select("fase")
    .eq("empresa_id", empresaId);
  const setExistentes = new Set(
    (existentes ?? []).map((r) => r.fase as string),
  );

  const aCrear = INSPECTOR_EMAIL_PLANTILLAS_SEED
    .filter((p) => !setExistentes.has(p.fase))
    .map((p) => ({
      empresa_id: empresaId,
      fase: p.fase,
      asunto: p.asunto,
      cuerpo: p.cuerpo,
      activa: p.activa,
    }));

  if (aCrear.length === 0) return { creadas: 0 };
  const { error } = await admin
    .from("inspector_email_plantillas")
    .insert(aCrear);
  if (error) throw error;
  return { creadas: aCrear.length };
}

/**
 * Sincroniza plantillas de email de RESERVAS a una empresa (aditivo).
 * Solo crea los tipos que aún no existen; respeta personalizaciones del cliente.
 * Inserta con asunto_personalizado=null y mensaje_personalizado=null para que
 * el mailer use los textos de fábrica (definidos en el seed).
 */
export async function syncReservaEmailPlantillasAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creadas: number }> {
  const { data: existentes } = await admin
    .from("reserva_email_plantillas")
    .select("tipo")
    .eq("empresa_id", empresaId);
  const setExistentes = new Set(
    (existentes ?? []).map((r) => r.tipo as string),
  );

  const aCrear = RESERVA_EMAIL_PLANTILLAS_SEED
    .filter((p) => !setExistentes.has(p.tipo))
    .map((p) => ({
      empresa_id: empresaId,
      tipo: p.tipo,
      activa: true,
      asunto_personalizado: null,
      mensaje_personalizado: null,
    }));

  if (aCrear.length === 0) return { creadas: 0 };
  const { error } = await admin
    .from("reserva_email_plantillas")
    .insert(aCrear);
  if (error) throw error;
  return { creadas: aCrear.length };
}

/**
 * Sincroniza plantillas de email del pipeline de RECLUTAMIENTO (aditivo).
 * Solo crea los estados que aún no existen en la empresa; NUNCA sobreescribe
 * personalizaciones del cliente.
 */
export async function syncReclutamientoEmailPlantillasAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creadas: number }> {
  const { data: existentes } = await admin
    .from("reclutamiento_email_plantillas")
    .select("nombre, clave")
    .eq("empresa_id", empresaId);
  // Dedup por NOMBRE (plantillas libres) y por CLAVE (plantillas del sistema): una
  // del sistema renombrada por el cliente sigue existiendo por su clave y NO se
  // vuelve a sembrar como duplicado.
  const nombresExistentes = new Set((existentes ?? []).map((r) => r.nombre as string));
  const clavesExistentes = new Set(
    (existentes ?? []).map((r) => r.clave as string | null).filter(Boolean) as string[],
  );

  const aCrear = RECLUTAMIENTO_EMAIL_PLANTILLAS_SEED
    .filter((p) =>
      p.clave ? !clavesExistentes.has(p.clave) : !nombresExistentes.has(p.nombre),
    )
    .map((p) => {
      // Normaliza el destino heredado del seed (gestoria/rrhh/candidato) al modelo
      // actual: departamento + clave de correo (p. ej. correoGestoria), resuelto
      // desde Ajustes → Empresa. `candidato`/`personalizado` quedan igual.
      const norm = normalizarDestinoDepartamento(
        (p.destino ?? "candidato") as DestinoPlantilla,
        null,
      );
      return {
        empresa_id: empresaId,
        nombre: p.nombre,
        asunto: p.asunto,
        cuerpo: p.cuerpo,
        activa: p.activa,
        clave: p.clave ?? null,
        destino: norm.destino,
        destino_email: norm.destinoEmail,
      };
    });

  if (aCrear.length === 0) return { creadas: 0 };
  const { error } = await admin
    .from("reclutamiento_email_plantillas")
    .insert(aCrear);
  if (error) throw error;
  return { creadas: aCrear.length };
}

/**
 * Siembra la plantilla de ESTADOS por defecto (consecución del pipeline) SOLO
 * si la empresa todavía no tiene ninguna plantilla de estados. No pisa al cliente.
 */
export async function syncReclutamientoPlantillaEstadoAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creadas: number }> {
  // Resuelve los emails por defecto (biblioteca suelta) a sus ids en esta empresa.
  // El sync de emails se ejecuta antes que el de estados (ver seedEmpresaDefaults).
  const { data: emails } = await admin
    .from("reclutamiento_email_plantillas")
    .select("id, nombre")
    .eq("empresa_id", empresaId);
  const emailIdPorNombre = new Map(
    (emails ?? []).map((e) => [e.nombre as string, e.id as string]),
  );

  const seed = RECLUTAMIENTO_PLANTILLA_ESTADOS_SEED;
  const seedEstados = seed.estados.map((e) => {
    const { defaultEmailNombre, ...resto } = e;
    return {
      ...resto,
      email_plantilla_id: defaultEmailNombre
        ? emailIdPorNombre.get(defaultEmailNombre) ?? null
        : null,
    };
  });

  const { data: existentes } = await admin
    .from("reclutamiento_plantillas_estado")
    .select("id, estados")
    .eq("empresa_id", empresaId);

  // Caso 1 — empresa sin plantilla: sembrar la plantilla estándar completa.
  if ((existentes ?? []).length === 0) {
    const { error } = await admin
      .from("reclutamiento_plantillas_estado")
      .insert({
        empresa_id: empresaId,
        nombre: seed.nombre,
        es_predeterminada: seed.esPredeterminada,
        estados: seedEstados,
        activa: true,
      });
    if (error) throw error;
    return { creadas: 1 };
  }

  // Caso 2 — empresa con plantillas: ADITIVO. En cada plantilla existente:
  //  a) Inserta los estados del seed que aún no existan (por `key`).
  //  b) BACKFILL del email por defecto: rellena `email_plantilla_id` en los
  //     estados que hoy no lo tienen (campo ausente o null), resolviendo el
  //     `defaultEmailNombre` del seed a la plantilla de email de la empresa. NO
  //     pisa una elección previa del cliente (si ya hay un id, se respeta).
  // Sin (b), las empresas que ya tenían la plantilla de estados cuando aún no
  // existían las plantillas de email suelta quedaban sin email por estado para
  // siempre → el correo «Nuevo» (y el resto de fases) nunca se enviaba.
  const emailDefaultPorKey = new Map(
    seedEstados.map((e) => [e.key, e.email_plantilla_id]),
  );
  let actualizadas = 0;
  for (const plantilla of existentes ?? []) {
    const estadosActuales = Array.isArray(plantilla.estados)
      ? (plantilla.estados as Array<Record<string, unknown>>)
      : [];
    const keysActuales = new Set(estadosActuales.map((e) => e.key as string));
    const faltantes = seedEstados.filter((e) => !keysActuales.has(e.key));

    // (b) Backfill del email por defecto en los estados existentes sin id.
    let backfilled = false;
    const conEmail = estadosActuales.map((e) => {
      const tieneId = e.email_plantilla_id != null;
      if (tieneId) return e;
      const defId = emailDefaultPorKey.get(e.key as string) ?? null;
      if (!defId) return e;
      backfilled = true;
      return { ...e, email_plantilla_id: defId };
    });

    if (faltantes.length === 0 && !backfilled) continue;

    // Mezcla y reordena por el `orden` canónico del seed para que los estados
    // nuevos queden en su posición (p. ej. documentacion antes de teorica).
    const ordenSeed = new Map(seedEstados.map((e) => [e.key, e.orden]));
    const merged = [...conEmail, ...faltantes].sort((a, b) => {
      const oa = (ordenSeed.get(a.key as string) ?? (a.orden as number) ?? 0) as number;
      const ob = (ordenSeed.get(b.key as string) ?? (b.orden as number) ?? 0) as number;
      return oa - ob;
    });

    const { error } = await admin
      .from("reclutamiento_plantillas_estado")
      .update({ estados: merged })
      .eq("id", plantilla.id as string);
    if (error) throw error;
    actualizadas++;
  }
  return { creadas: actualizadas };
}

/**
 * Siembra el cuestionario GENÉRICO por defecto del reclutamiento y lo asigna a
 * todas las vacantes de la empresa que aún no tengan cuestionario. Aditivo:
 * - Crea el cuestionario `es_default` solo si no existe (no pisa ediciones).
 * - Asigna `cuestionario_plantilla_id` solo donde es NULL (respeta asignaciones
 *   manuales por vacante).
 */
export async function syncReclutamientoCuestionarioDefaultAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creado: boolean; vacantesAsignadas: number }> {
  // 1) ¿Ya tiene cuestionario por defecto?
  const { data: existente } = await admin
    .from("reclutamiento_plantillas_cuestionario")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("es_default", true)
    .maybeSingle();

  let defaultId = existente?.id as string | undefined;
  let creado = false;

  if (!defaultId) {
    const seed = RECLUTAMIENTO_CUESTIONARIO_DEFAULT_SEED;
    const { data: insertado, error } = await admin
      .from("reclutamiento_plantillas_cuestionario")
      .insert({
        empresa_id: empresaId,
        nombre: seed.nombre,
        descripcion: seed.descripcion,
        preguntas: seed.preguntas,
        es_default: true,
        activa: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    defaultId = insertado.id as string;
    creado = true;
  }

  // 2) Asignar a todas las vacantes sin cuestionario.
  const { data: asignadas, error: upErr } = await admin
    .from("vacantes")
    .update({ cuestionario_plantilla_id: defaultId, cuestionario: true })
    .eq("empresa_id", empresaId)
    .is("cuestionario_plantilla_id", null)
    .select("id");
  if (upErr) throw upErr;

  return { creado, vacantesAsignadas: asignadas?.length ?? 0 };
}

/**
 * Siembra la presentación canónica de inspecciones SOLO si la empresa no
 * tiene una aún (o la tiene vacía). No sobreescribe ediciones del cliente.
 */
export async function syncInspeccionPresentacionAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creada: boolean }> {
  const { data: existente } = await admin
    .from("inspeccion_presentaciones")
    .select("slides")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const slidesActuales = (existente?.slides as unknown[] | null) ?? null;
  const tienePresentacion =
    Array.isArray(slidesActuales) && slidesActuales.length > 0;
  if (tienePresentacion) return { creada: false };

  const { error } = await admin
    .from("inspeccion_presentaciones")
    .upsert(
      { empresa_id: empresaId, slides: INSPECCION_PRESENTACION_SEED },
      { onConflict: "empresa_id" },
    );
  if (error) throw error;
  return { creada: true };
}

/**
 * Sincroniza las etiquetas canónicas de reserva a una empresa (aditivo).
 * Solo inserta los nombres del seed que aún no existen; respeta cualquier
 * etiqueta personalizada por el cliente.
 */
export async function syncReservaEtiquetasAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creados: number }> {
  const { data: existentes } = await admin
    .from("empresa_reserva_etiquetas")
    .select("nombre")
    .eq("empresa_id", empresaId);
  const setExistentes = new Set(
    (existentes ?? []).map((t) => normalizeReservaEtiquetaNombre(t.nombre as string)),
  );

  const aCrear = RESERVA_ETIQUETAS_SEED
    .filter((t) => !setExistentes.has(normalizeReservaEtiquetaNombre(t.nombre)))
    .map((t) => ({
      empresa_id: empresaId,
      nombre: t.nombre,
      emoji: t.emoji,
      color: t.color,
      orden: t.orden,
      activo: true,
    }));

  if (aCrear.length === 0) return { creados: 0 };
  const { error } = await admin.from("empresa_reserva_etiquetas").insert(aCrear);
  if (error) throw error;
  return { creados: aCrear.length };
}

/**
 * Sincroniza categorías + etiquetas canónicas de Sala (Reservas y Clientes)
 * a una empresa concreta. Aditivo: solo crea categorías y etiquetas (por
 * nombre dentro de su scope) que aún no existan; nunca renombra ni borra.
 * Las creadas por seed quedan marcadas con `sistema=true` para que la UI
 * impida borrarlas.
 */
export async function syncSalaEtiquetasAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ categoriasCreadas: number; etiquetasCreadas: number }> {
  // 1) Categorías existentes (clave: scope|nombre normalizado).
  const { data: catsExistentes } = await admin
    .from("sala_etiqueta_categorias")
    .select("id, scope, nombre")
    .eq("empresa_id", empresaId);
  const catIdPorClave = new Map<string, string>();
  for (const c of catsExistentes ?? []) {
    const key = `${c.scope as string}|${normalizeEtiquetaNombre(c.nombre as string)}`;
    catIdPorClave.set(key, c.id as string);
  }

  // 2) Crear categorías que falten.
  const catsACrear = SALA_ETIQUETAS_SEED.filter(
    (c) => !catIdPorClave.has(`${c.scope}|${normalizeEtiquetaNombre(c.nombre)}`),
  ).map((c) => ({
    empresa_id: empresaId,
    scope: c.scope,
    nombre: c.nombre,
    orden: c.orden,
    sistema: true,
    activo: true,
  }));

  let categoriasCreadas = 0;
  if (catsACrear.length > 0) {
    const { data: insertadas, error } = await admin
      .from("sala_etiqueta_categorias")
      .insert(catsACrear)
      .select("id, scope, nombre");
    if (error) throw error;
    categoriasCreadas = insertadas?.length ?? 0;
    for (const c of insertadas ?? []) {
      const key = `${c.scope as string}|${normalizeEtiquetaNombre(c.nombre as string)}`;
      catIdPorClave.set(key, c.id as string);
    }
  }

  // 3) Etiquetas existentes (clave: scope|nombre).
  const { data: etiqExistentes } = await admin
    .from("sala_etiquetas")
    .select("scope, nombre")
    .eq("empresa_id", empresaId);
  const setEtiqExistentes = new Set(
    (etiqExistentes ?? []).map(
      (e) => `${e.scope as string}|${normalizeEtiquetaNombre(e.nombre as string)}`,
    ),
  );

  // 4) Construir filas de etiquetas a crear (resolviendo categoria_id).
  const etiqACrear: Array<Record<string, unknown>> = [];
  for (const cat of SALA_ETIQUETAS_SEED) {
    const catKey = `${cat.scope}|${normalizeEtiquetaNombre(cat.nombre)}`;
    const categoriaId = catIdPorClave.get(catKey);
    if (!categoriaId) continue;
    cat.etiquetas.forEach((e, idx) => {
      const etiqKey = `${cat.scope}|${normalizeEtiquetaNombre(e.nombre)}`;
      if (setEtiqExistentes.has(etiqKey)) return;
      etiqACrear.push({
        empresa_id: empresaId,
        categoria_id: categoriaId,
        scope: cat.scope,
        nombre: e.nombre,
        emoji: e.emoji ?? null,
        color: e.color ?? "#64748b",
        orden: idx + 1,
        sistema: true,
        activo: true,
      });
    });
  }

  let etiquetasCreadas = 0;
  if (etiqACrear.length > 0) {
    const { error } = await admin.from("sala_etiquetas").insert(etiqACrear);
    if (error) throw error;
    etiquetasCreadas = etiqACrear.length;
  }

  return { categoriasCreadas, etiquetasCreadas };
}

/**
 * Asegura que existe la fila base de `empresa_reservas_config` para la
 * empresa (1 fila por empresa). No establece valores numéricos — el dueño
 * los configura desde el Sheet ⚙️ → Reservas.
 */
export async function ensureReservasConfigEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creada: boolean }> {
  const { data: existente } = await admin
    .from("empresa_reservas_config")
    .select("empresa_id")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (existente) return { creada: false };

  const { error } = await admin
    .from("empresa_reservas_config")
    .insert({ empresa_id: empresaId });
  if (error) throw error;
  return { creada: true };
}

/**
 * Asegura la fila de `empresa_rrhh_config` con los defaults de validadores por
 * área: operativa→RECURSOS HUMANOS, administrativa→DIRECCIÓN (resueltos por
 * nombre dentro de la empresa). Debe llamarse DESPUÉS de sembrar los
 * departamentos. El dueño puede cambiarlo en Ajustes → RRHH.
 */
export async function ensureRrhhConfigEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creada: boolean }> {
  const { data: existente } = await admin
    .from("empresa_rrhh_config")
    .select("empresa_id")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (existente) return { creada: false };

  const deptoIdPorNombre = async (nombre: string) => {
    const { data } = await admin
      .from("departamentos")
      .select("id")
      .eq("empresa_id", empresaId)
      .ilike("nombre", nombre)
      .maybeSingle();
    return (data?.id as string | null) ?? null;
  };

  const { error } = await admin.from("empresa_rrhh_config").insert({
    empresa_id: empresaId,
    validador_depto_operativa_id: await deptoIdPorNombre("RECURSOS HUMANOS"),
    validador_depto_administrativa_id: await deptoIdPorNombre("DIRECCIÓN"),
  });
  if (error) throw error;
  return { creada: true };
}

/**
 * Sincroniza las categorías de producto canónicas (tipo "compra") a una
 * empresa (aditivo). Solo crea las categorías cuyo nombre aún no exista
 * (case-insensitive, por tipo); nunca renombra ni borra. Las categorías de
 * nicho (Vapers/Shishas) NO están en el seed, así que no se propagan.
 */
export async function syncCategoriasProductoAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creadas: number }> {
  const { data: existentes } = await admin
    .from("categorias_producto")
    .select("tipo, nombre")
    .eq("empresa_id", empresaId);
  const setExistentes = new Set(
    (existentes ?? []).map(
      (c) => `${c.tipo as string}|${normalizeCategoriaProductoNombre(c.nombre as string)}`,
    ),
  );

  const aCrear = CATEGORIAS_PRODUCTO_SEED.filter(
    (c) => !setExistentes.has(`${c.tipo}|${normalizeCategoriaProductoNombre(c.nombre)}`),
  ).map((c) => ({
    empresa_id: empresaId,
    tipo: c.tipo,
    nombre: c.nombre,
    orden: c.orden,
    activa: true,
  }));

  if (aCrear.length === 0) return { creadas: 0 };
  const { error } = await admin.from("categorias_producto").insert(aCrear);
  if (error) throw error;
  return { creadas: aCrear.length };
}

/** Catálogos canónicos de vacantes (mismos valores que las migraciones). */
const JORNADAS_SEED = [
  { nombre: "Jornada completa", orden: 1 },
  { nombre: "Jornada reducida", orden: 2 },
];
const TIPOS_CONTRATO_SEED = [
  { nombre: "Indefinido", orden: 1 },
  { nombre: "Temporal", orden: 2 },
  { nombre: "Prácticas", orden: 3 },
];

/**
 * Siembra los catálogos de jornadas y tipos de contrato de una empresa.
 * Aditivo e idempotente: solo crea los que falten (por nombre, case-insensitive).
 */
export async function syncCatalogosVacanteAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ jornadasCreadas: number; contratosCreados: number }> {
  const seedCatalogo = async (
    tabla: "jornadas" | "tipos_contrato",
    seed: Array<{ nombre: string; orden: number }>,
  ): Promise<number> => {
    const { data: existentes } = await admin
      .from(tabla)
      .select("nombre")
      .eq("empresa_id", empresaId);
    const set = new Set((existentes ?? []).map((x) => (x.nombre as string).toLowerCase()));
    const aCrear = seed
      .filter((x) => !set.has(x.nombre.toLowerCase()))
      .map((x) => ({ empresa_id: empresaId, nombre: x.nombre, orden: x.orden, activo: true }));
    if (aCrear.length === 0) return 0;
    const { error } = await admin.from(tabla).insert(aCrear);
    if (error) throw error;
    return aCrear.length;
  };

  const jornadasCreadas = await seedCatalogo("jornadas", JORNADAS_SEED);
  const contratosCreados = await seedCatalogo("tipos_contrato", TIPOS_CONTRATO_SEED);
  return { jornadasCreadas, contratosCreados };
}

/**
 * Siembra una empresa nueva con todos los pilares canónicos.
 * Llamar desde `createEmpresa()` justo después del INSERT en `empresas`.
 */
export async function seedEmpresaDefaults(
  empresaId: string,
  empresaSlug: string,
): Promise<void> {
  const admin = createAdminClient();
  await syncDepartamentosAEmpresa(admin, empresaId);
  await syncRolesAEmpresa(admin, empresaId);
  await syncPuestosAEmpresa(admin, empresaId);
  await syncOrganigramaAEmpresa(admin, empresaSlug);
  await syncCatalogosVacanteAEmpresa(admin, empresaId);
  await syncVacantesAEmpresa(admin, empresaId, empresaSlug);
  await syncInspectorEmailPlantillasAEmpresa(admin, empresaId);
  await syncInspeccionPresentacionAEmpresa(admin, empresaId);
  await syncReservaEtiquetasAEmpresa(admin, empresaId);
  await syncSalaEtiquetasAEmpresa(admin, empresaId);
  await syncCategoriasProductoAEmpresa(admin, empresaId);
  await ensureReservasConfigEmpresa(admin, empresaId);
  await ensureRrhhConfigEmpresa(admin, empresaId);
  await syncReservaEmailPlantillasAEmpresa(admin, empresaId);
  await syncReclutamientoEmailPlantillasAEmpresa(admin, empresaId);
  await syncReclutamientoPlantillaEstadoAEmpresa(admin, empresaId);
  await syncReclutamientoCuestionarioDefaultAEmpresa(admin, empresaId);
}

/**
 * Propaga los seeds canónicos a TODAS las empresas existentes (aditivo).
 * Llamar cuando se edita un seed para alinear el universo.
 * Devuelve un resumen por empresa.
 */
export async function syncSeedsToAllEmpresas(): Promise<{
  ok: boolean;
  resumen: Array<{
    empresa: string;
    deptosCreados: number;
    rolesCreados: number;
    organigramaCreado: boolean;
    vacantesCreadas: number;
    inspectorEmailsCreadas: number;
    inspeccionPresentacionCreada: boolean;
    reservaEtiquetasCreadas: number;
    reservasConfigCreada: boolean;
    reservaEmailsCreadas: number;
    reclutamientoEmailsCreadas: number;
    reclutamientoEstadosCreadas: number;
  }>;
  error?: string;
}> {
  try {
    const admin = createAdminClient();
    const { data: empresas, error } = await admin
      .from("empresas")
      .select("id, slug, nombre")
      .eq("is_demo", false);
    if (error) throw error;

    const resumen: Array<{
      empresa: string;
      deptosCreados: number;
      rolesCreados: number;
      organigramaCreado: boolean;
      vacantesCreadas: number;
      inspectorEmailsCreadas: number;
      inspeccionPresentacionCreada: boolean;
      reservaEtiquetasCreadas: number;
      salaEtiquetasCategoriasCreadas: number;
      salaEtiquetasCreadas: number;
      categoriasProductoCreadas: number;
      reservasConfigCreada: boolean;
      reservaEmailsCreadas: number;
      reclutamientoEmailsCreadas: number;
    reclutamientoEstadosCreadas: number;
    }> = [];

    for (const e of empresas ?? []) {
      const empresaId = e.id as string;
      const empresaSlug = e.slug as string;
      const empresaNombre = (e.nombre as string) ?? empresaSlug;
      const d = await syncDepartamentosAEmpresa(admin, empresaId);
      const r = await syncRolesAEmpresa(admin, empresaId);
      await syncPuestosAEmpresa(admin, empresaId);
      const o = await syncOrganigramaAEmpresa(admin, empresaSlug);
      await syncCatalogosVacanteAEmpresa(admin, empresaId);
      const v = await syncVacantesAEmpresa(admin, empresaId, empresaSlug);
      const iep = await syncInspectorEmailPlantillasAEmpresa(admin, empresaId);
      const ipres = await syncInspeccionPresentacionAEmpresa(admin, empresaId);
      const re = await syncReservaEtiquetasAEmpresa(admin, empresaId);
      const se = await syncSalaEtiquetasAEmpresa(admin, empresaId);
      const cp = await syncCategoriasProductoAEmpresa(admin, empresaId);
      const rcfg = await ensureReservasConfigEmpresa(admin, empresaId);
      await ensureRrhhConfigEmpresa(admin, empresaId);
      const rep = await syncReservaEmailPlantillasAEmpresa(admin, empresaId);
      const rclep = await syncReclutamientoEmailPlantillasAEmpresa(admin, empresaId);
      const rclpe = await syncReclutamientoPlantillaEstadoAEmpresa(admin, empresaId);
      await syncReclutamientoCuestionarioDefaultAEmpresa(admin, empresaId);
      resumen.push({
        empresa: empresaNombre,
        deptosCreados: d.creados,
        rolesCreados: r.creados,
        organigramaCreado: o.creado,
        vacantesCreadas: v.creadas,
        inspectorEmailsCreadas: iep.creadas,
        inspeccionPresentacionCreada: ipres.creada,
        reservaEtiquetasCreadas: re.creados,
        salaEtiquetasCategoriasCreadas: se.categoriasCreadas,
        salaEtiquetasCreadas: se.etiquetasCreadas,
        categoriasProductoCreadas: cp.creadas,
        reservasConfigCreada: rcfg.creada,
        reservaEmailsCreadas: rep.creadas,
        reclutamientoEmailsCreadas: rclep.creadas,
        reclutamientoEstadosCreadas: rclpe.creadas,
      });
    }

    return { ok: true, resumen };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[seeds] syncSeedsToAllEmpresas:", msg);
    return { ok: false, resumen: [], error: msg };
  }
}

// Re-export del helper (lo necesita pagos-actions u otros lugares).
export { getDeptoIdByNombre };
