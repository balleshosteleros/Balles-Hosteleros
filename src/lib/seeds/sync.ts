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
import { DEPARTAMENTOS_SEED, normalizeDeptoNombre } from "./departamentos";
import { ROLES_SEED, normalizeRolNombre } from "./roles";
import { ORGANIGRAMA_SEED } from "./organigrama";
import { INSPECTOR_EMAIL_PLANTILLAS_SEED } from "./inspector-email-plantillas";
import { INSPECCION_PRESENTACION_SEED } from "./inspeccion-presentacion";
import { RESERVA_TIPOS_SEED, normalizeTipoNombre } from "./reserva-tipos";
import { SALA_ETIQUETAS_SEED, normalizeEtiquetaNombre } from "./sala-etiquetas";

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
 * Siembra vacantes en borrador a partir de los nodos del organigrama de la
 * empresa (aditivo: solo crea vacantes cuyo título no exista ya).
 */
export async function syncVacantesAEmpresa(
  admin: Admin,
  empresaId: string,
  empresaSlug: string,
): Promise<{ creadas: number }> {
  const { data: org } = await admin
    .from("organigramas")
    .select("nodes")
    .eq("empresa_slug", empresaSlug)
    .maybeSingle();
  const nodos = ((org?.nodes ?? []) as Array<{ label: string }>) ?? [];
  if (nodos.length === 0) return { creadas: 0 };

  const { data: vacExistentes } = await admin
    .from("vacantes")
    .select("titulo")
    .eq("empresa_id", empresaId);
  const setExistentes = new Set(
    (vacExistentes ?? []).map((v) => (v.titulo as string).trim().toLowerCase()),
  );

  const vistos = new Set<string>();
  const aCrear = nodos
    .filter((n) => {
      const key = (n.label ?? "").trim().toLowerCase();
      if (!key || vistos.has(key) || setExistentes.has(key)) return false;
      vistos.add(key);
      return true;
    })
    .map((n) => ({
      empresa_id: empresaId,
      titulo: n.label,
      tipo_jornada: "completa",
      estado_publicacion: "borrador",
      visible_publicamente: false,
      cuestionario: false,
      favorita: false,
    }));

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
 * Sincroniza los tipos canónicos de reserva a una empresa (aditivo).
 * Solo inserta los nombres del seed que aún no existen; respeta cualquier
 * tipo personalizado por el cliente.
 */
export async function syncReservaTiposAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creados: number }> {
  const { data: existentes } = await admin
    .from("empresa_reserva_tipos")
    .select("nombre")
    .eq("empresa_id", empresaId);
  const setExistentes = new Set(
    (existentes ?? []).map((t) => normalizeTipoNombre(t.nombre as string)),
  );

  const aCrear = RESERVA_TIPOS_SEED
    .filter((t) => !setExistentes.has(normalizeTipoNombre(t.nombre)))
    .map((t) => ({
      empresa_id: empresaId,
      nombre: t.nombre,
      emoji: t.emoji,
      color: t.color,
      orden: t.orden,
      activo: true,
    }));

  if (aCrear.length === 0) return { creados: 0 };
  const { error } = await admin.from("empresa_reserva_tipos").insert(aCrear);
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
  await syncOrganigramaAEmpresa(admin, empresaSlug);
  await syncVacantesAEmpresa(admin, empresaId, empresaSlug);
  await syncInspectorEmailPlantillasAEmpresa(admin, empresaId);
  await syncInspeccionPresentacionAEmpresa(admin, empresaId);
  await syncReservaTiposAEmpresa(admin, empresaId);
  await syncSalaEtiquetasAEmpresa(admin, empresaId);
  await ensureReservasConfigEmpresa(admin, empresaId);
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
    reservaTiposCreados: number;
    reservasConfigCreada: boolean;
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
      reservaTiposCreados: number;
      salaEtiquetasCategoriasCreadas: number;
      salaEtiquetasCreadas: number;
      reservasConfigCreada: boolean;
    }> = [];

    for (const e of empresas ?? []) {
      const empresaId = e.id as string;
      const empresaSlug = e.slug as string;
      const empresaNombre = (e.nombre as string) ?? empresaSlug;
      const d = await syncDepartamentosAEmpresa(admin, empresaId);
      const r = await syncRolesAEmpresa(admin, empresaId);
      const o = await syncOrganigramaAEmpresa(admin, empresaSlug);
      const v = await syncVacantesAEmpresa(admin, empresaId, empresaSlug);
      const iep = await syncInspectorEmailPlantillasAEmpresa(admin, empresaId);
      const ipres = await syncInspeccionPresentacionAEmpresa(admin, empresaId);
      const rt = await syncReservaTiposAEmpresa(admin, empresaId);
      const se = await syncSalaEtiquetasAEmpresa(admin, empresaId);
      const rcfg = await ensureReservasConfigEmpresa(admin, empresaId);
      resumen.push({
        empresa: empresaNombre,
        deptosCreados: d.creados,
        rolesCreados: r.creados,
        organigramaCreado: o.creado,
        vacantesCreadas: v.creadas,
        inspectorEmailsCreadas: iep.creadas,
        inspeccionPresentacionCreada: ipres.creada,
        reservaTiposCreados: rt.creados,
        salaEtiquetasCategoriasCreadas: se.categoriasCreadas,
        salaEtiquetasCreadas: se.etiquetasCreadas,
        reservasConfigCreada: rcfg.creada,
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
