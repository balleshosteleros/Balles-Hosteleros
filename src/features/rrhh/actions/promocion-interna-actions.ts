"use server";

/**
 * Promoción interna — un EMPLEADO ya dentro de la empresa cambia de puesto.
 *
 * A diferencia de la contratación (candidato → empleado), aquí el empleado ya
 * existe; solo cambian su puesto principal y las condiciones que conlleva.
 *
 * Al promocionar, en orden:
 *   1. Valida empleado activo + puesto destino con condiciones configuradas.
 *   2. Cambia el PUESTO PRINCIPAL (empleado_puestos) y propaga puesto/departamento
 *      a `empleados`.
 *   3. Copia las condiciones del nuevo puesto al HISTÓRICO (empleado_condiciones):
 *      cierra la fila vigente e inserta la nueva (motivo 'promocion').
 *   4. Reasigna el PATRÓN DE HORARIO del nuevo puesto (rrhh_patron_empleados).
 *   5. Registra la promoción (empleado_promociones) — memoria del cambio.
 *   6. Genera un ANEXO de novación y lo envía a firmar (manuscrita + OTP).
 *   7. Avisa a la GESTORÍA con una plantilla específica (gestoria_cambio_puesto).
 *
 * Las condiciones se copian AUTOMÁTICAMENTE del nuevo puesto (sin diálogo de
 * revisión), por decisión de producto.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/features/rrhh/services/empleados-core";
import {
  leerCondicionesPuesto,
  escribirCondicionesVigentes,
} from "@/features/rrhh/services/condiciones-puesto";
import { asignarPlantillaPuestoAEmpleado } from "@/features/rrhh/actions/puesto-horario-actions";
import { crearFirmaInterno } from "@/features/rrhh/services/firmas/crear-firma";
import { generarAnexoPromocionPDF } from "@/features/rrhh/services/firmas/anexo-promocion-pdf";
import { enviarCambioPuestoGestoria } from "@/features/rrhh/actions/gestoria-actions";
import { revalidatePath } from "next/cache";
import { getMarcaEmpresa } from "@/lib/pdf/cabecera-documento";

type Admin = ReturnType<typeof createAdminClient>;

function fechaEs(d: Date): string {
  return d.toLocaleDateString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function getActor() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, empresaId: null as string | null, nombre: "" };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  const nombre =
    (user.user_metadata?.nombre as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    "RRHH";
  return { user, empresaId, nombre };
}

export interface PromocionarEmpleadoInput {
  empleadoId: string;
  /** Puesto destino (plantilla). */
  puestoId: string;
  /** Primer día en el nuevo puesto ('YYYY-MM-DD'). */
  primerDia: string;
  /** Vacante destino (opcional; solo para trazabilidad). */
  vacanteDestinoId?: string | null;
  /** Enviar el anexo a firmar. Default true. */
  enviarAnexo?: boolean;
  /** Avisar a la gestoría. Default true. */
  avisarGestoria?: boolean;
}

export interface PromocionarEmpleadoResult {
  ok: boolean;
  error?: string;
  anexoEnviado?: boolean;
  gestoriaAvisada?: boolean;
}

export async function promocionarEmpleado(
  input: PromocionarEmpleadoInput,
): Promise<PromocionarEmpleadoResult> {
  const { user, empresaId, nombre: actorNombre } = await getActor();
  if (!user || !empresaId) return { ok: false, error: "No autenticado" };

  try {
    await requireAdminUser({ empresaIds: [empresaId] });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sin permisos" };
  }

  if (!input.empleadoId) return { ok: false, error: "Selecciona el empleado." };
  if (!input.puestoId) return { ok: false, error: "Selecciona el puesto de destino." };
  if (!input.primerDia) return { ok: false, error: "Indica el primer día en el nuevo puesto." };

  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Supabase admin no configurado (falta SUPABASE_SERVICE_ROLE_KEY)." };
  }

  // 1. Empleado (debe existir, pertenecer a la empresa y estar activo).
  const { data: emp } = await admin
    .from("empleados")
    .select("id, nombre, apellidos, dni_nie, estado, puesto, departamento_id")
    .eq("id", input.empleadoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!emp) return { ok: false, error: "Empleado no encontrado." };
  // Se permite sobre un empleado Inactivo a propósito: al reactivar a alguien hay
  // que devolverle puesto, horario y condiciones, y esa asignación es justo el
  // paso que lo hace. El selector de la promoción interna sigue ofreciendo solo
  // activos; aquí se llega desde la ficha, donde el caso existe.

  // Puesto de ORIGEN = el principal actual (para la memoria del cambio).
  const { data: principalActual } = await admin
    .from("empleado_puestos")
    .select("puesto_id, puesto_nombre")
    .eq("empleado_id", input.empleadoId)
    .eq("es_principal", true)
    .maybeSingle();
  const puestoOrigenId = (principalActual?.puesto_id as string | null) ?? null;
  const puestoOrigenNombre =
    (principalActual?.puesto_nombre as string | null) ?? (emp.puesto as string | null) ?? null;

  // 2. Puesto destino + condiciones + departamento.
  const { data: puesto } = await admin
    .from("puestos")
    .select("id, nombre, departamento_id, validador_departamento_id")
    .eq("id", input.puestoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!puesto) return { ok: false, error: "Puesto de destino no encontrado." };
  if ((puesto.id as string) === puestoOrigenId) {
    return { ok: false, error: "El empleado ya ocupa ese puesto." };
  }

  const cond = await leerCondicionesPuesto(admin, input.puestoId);
  // La promoción exige que el puesto destino tenga TODAS las condiciones esenciales
  // rellenas (no basta salario o jornada como en la contratación). Se valida en el
  // servidor para que sea imposible saltarse el bloqueo del diálogo.
  const faltan: string[] = [];
  // El salario del puesto es BRUTO: `salario_neto` está siempre a null desde la
  // migración que lo separó del bruto, así que validar contra él hacía imposible
  // promocionar a nadie (y mandaba a rellenar un campo que no existe en el
  // formulario de Puestos).
  if (!cond || !((cond.salario_bruto ?? 0) > 0)) faltan.push("salario");
  if (!cond?.jornada_contrato?.trim()) faltan.push("jornada");
  if (!((cond?.horas_semanales ?? 0) > 0)) faltan.push("horas semanales");
  // El tipo de contrato del puesto vive en `puestos.tipo_contrato_defecto`.
  {
    const { data: pTipo } = await admin
      .from("puestos")
      .select("tipo_contrato_defecto")
      .eq("id", input.puestoId)
      .maybeSingle();
    if (!(pTipo?.tipo_contrato_defecto as string | null)?.trim()) faltan.push("tipo de contrato");
  }
  if (faltan.length > 0) {
    return {
      ok: false,
      error:
        `No se puede promocionar a «${puesto.nombre}»: faltan ${faltan.join(", ")} en las condiciones del puesto. ` +
        `Complétalas en RRHH → Puestos antes de promocionar.`,
    };
  }

  // Tipo de contrato: fuente única = vacante destino si se indicó; si no, se
  // conserva el tipo de contrato vigente del empleado.
  let tipoContrato: string | null = null;
  if (input.vacanteDestinoId) {
    const { data: vac } = await admin
      .from("vacantes")
      .select("tipo_contrato")
      .eq("id", input.vacanteDestinoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    tipoContrato = (vac?.tipo_contrato as string | null) ?? null;
  }
  if (!tipoContrato) {
    const { data: condVig } = await admin
      .from("empleado_condiciones")
      .select("tipo_contrato")
      .eq("empleado_id", input.empleadoId)
      .is("vigente_hasta", null)
      .maybeSingle();
    tipoContrato = (condVig?.tipo_contrato as string | null) ?? null;
  }

  // 3. Cambiar el PUESTO PRINCIPAL (empleado_puestos) + propagar a `empleados`.
  //    Se limpia el principal previo y se marca/inserta el nuevo.
  await admin.from("empleado_puestos").update({ es_principal: false }).eq("empleado_id", input.empleadoId);
  const { data: yaVinculado } = await admin
    .from("empleado_puestos")
    .select("id")
    .eq("empleado_id", input.empleadoId)
    .eq("puesto_id", input.puestoId)
    .maybeSingle();
  if (yaVinculado?.id) {
    await admin
      .from("empleado_puestos")
      .update({ es_principal: true, puesto_nombre: puesto.nombre })
      .eq("id", yaVinculado.id);
  } else {
    await admin.from("empleado_puestos").insert({
      empleado_id: input.empleadoId,
      puesto_id: input.puestoId,
      puesto_nombre: puesto.nombre,
      es_principal: true,
      vigente_desde: input.primerDia,
    });
  }
  await admin
    .from("empleados")
    .update({
      puesto: puesto.nombre,
      departamento_id: puesto.departamento_id,
      // Quién valida sus solicitudes lo define el puesto. Si el destino no lo
      // tiene configurado se conserva el anterior, para no dejarle sin validador.
      ...(puesto.validador_departamento_id
        ? { validador_departamento_id: puesto.validador_departamento_id }
        : {}),
    })
    .eq("id", input.empleadoId)
    .eq("empresa_id", empresaId);

  // 4. Copiar condiciones del nuevo puesto al HISTÓRICO (cierra la vigente).
  //
  // Es el paso que fija el SALARIO del puesto nuevo. Si falla aquí, el empleado ya
  // tiene el puesto cambiado (paso 3) pero seguiría con las condiciones del puesto
  // anterior: ascendido y cobrando lo de antes. Se deshace el cambio de puesto y
  // se aborta con un mensaje claro, en vez de dejarlo a medias en silencio.
  try {
    await escribirCondicionesVigentes(admin, {
      empresaId,
      empleadoId: input.empleadoId,
      puestoId: input.puestoId,
      puestoNombre: puesto.nombre as string,
      primerDia: input.primerDia,
      tipoContrato,
      cond,
      motivo: "promocion",
    });
  } catch (err) {
    console.error("[promocion] condiciones:", err);
    // Revertir el paso 3: devolver el puesto principal y los datos del empleado.
    await admin.from("empleado_puestos").update({ es_principal: false }).eq("empleado_id", input.empleadoId);
    if (puestoOrigenId) {
      await admin
        .from("empleado_puestos")
        .update({ es_principal: true })
        .eq("empleado_id", input.empleadoId)
        .eq("puesto_id", puestoOrigenId);
      const { data: pOrig } = await admin
        .from("puestos")
        .select("nombre, departamento_id")
        .eq("id", puestoOrigenId)
        .maybeSingle();
      if (pOrig) {
        await admin
          .from("empleados")
          .update({ puesto: pOrig.nombre as string, departamento_id: pOrig.departamento_id as string | null })
          .eq("id", input.empleadoId)
          .eq("empresa_id", empresaId);
      }
    }
    return {
      ok: false as const,
      error:
        "No se pudieron guardar las condiciones del nuevo puesto, así que la promoción se ha deshecho. " +
        "Revisa que el puesto tenga salario y jornada configurados e inténtalo de nuevo.",
    };
  }

  // 5. Reasignar el PATRÓN DE HORARIO del nuevo puesto (best-effort).
  try {
    await asignarPlantillaPuestoAEmpleado(input.empleadoId, input.puestoId, input.primerDia);
  } catch (err) {
    console.error("[promocion] patrón horario:", err);
  }

  // 6. Registrar la promoción (memoria del cambio).
  const { data: promoRow } = await admin
    .from("empleado_promociones")
    .insert({
      empresa_id: empresaId,
      empleado_id: input.empleadoId,
      puesto_origen_id: puestoOrigenId,
      puesto_origen_nombre: puestoOrigenNombre,
      puesto_destino_id: input.puestoId,
      puesto_destino_nombre: puesto.nombre,
      vacante_destino_id: input.vacanteDestinoId ?? null,
      primer_dia: input.primerDia,
      tipo_contrato: tipoContrato,
      condiciones: cond ?? {},
      creado_por: user.id,
      creado_por_nombre: actorNombre,
    })
    .select("id")
    .single();
  const promocionId = (promoRow?.id as string | undefined) ?? null;

  // 7. Anexo de novación a firmar (manuscrita + OTP), best-effort.
  let anexoEnviado = false;
  if (input.enviarAnexo !== false) {
    try {
      const { data: empresa } = await admin
        .from("empresas")
        .select("nombre, nif")
        .eq("id", empresaId)
        .maybeSingle();
      const empleadoNombre = `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() || "Trabajador";
      const anexo = await generarAnexoPromocionPDF({
        empleadoNombre,
        empleadoDni: (emp.dni_nie as string | null) ?? null,
        empresaNombre: (empresa?.nombre as string) ?? "La empresa",
        empresaCif: (empresa?.nif as string | null) ?? null,
        ciudad: null,
        puestoAnterior: puestoOrigenNombre,
        puestoNuevo: puesto.nombre as string,
        fechaEfecto: fechaEs(new Date(`${input.primerDia}T00:00:00`)),
        fecha: fechaEs(new Date()),
        tipoContrato,
        jornada: cond?.jornada_contrato ?? null,
        horasSemanales: cond?.horas_semanales ?? null,
        salarioBruto: cond?.salario_bruto ?? null,
        marca: await getMarcaEmpresa(empresaId),
      });
      const firma = await crearFirmaInterno({
        empresaId,
        empleadoId: input.empleadoId,
        pdf: anexo.buffer,
        titulo: "Anexo de cambio de puesto",
        tipo: "anexo_promocion",
        modalidad: "manuscrita_digital",
        validez: "eidas_simple",
        plazoDias: 14,
        observaciones: `Promoción interna: ${puestoOrigenNombre ?? "—"} → ${puesto.nombre}.`,
        enviadoPorUserId: user.id,
        enviadoPorNombre: "RRHH",
        preferirEmailPersonal: true,
        // Hueco medido por el propio generador: el anexo puede ocupar más de una
        // página según las condiciones, así que no se asume la 1.
        posicionFirmaDefault: anexo.posicionFirma,
      });
      anexoEnviado = firma.ok;
      if (firma.ok && promocionId) {
        await admin
          .from("empleado_promociones")
          .update({ firma_id: firma.documentoId })
          .eq("id", promocionId);
      }
    } catch (err) {
      console.error("[promocion] anexo firma:", err);
    }
  }

  // 8. Avisar a la GESTORÍA (plantilla gestoria_cambio_puesto), best-effort.
  let gestoriaAvisada = false;
  if (input.avisarGestoria !== false) {
    try {
      const res = await enviarCambioPuestoGestoria(input.empleadoId, {
        puestoAnterior: puestoOrigenNombre,
        puestoNuevo: puesto.nombre as string,
        primerDia: input.primerDia,
      });
      gestoriaAvisada = res.ok === true;
      if (gestoriaAvisada && promocionId) {
        await admin
          .from("empleado_promociones")
          .update({ gestoria_enviado_at: new Date().toISOString(), gestoria_email: res.destino ?? null })
          .eq("id", promocionId);
      }
    } catch (err) {
      console.error("[promocion] aviso gestoría:", err);
    }
  }

  revalidatePath("/rrhh/reclutamiento");
  revalidatePath("/rrhh/empleados");
  return { ok: true, anexoEnviado, gestoriaAvisada };
}

/**
 * Mapa empleadoId → nombre del puesto PRINCIPAL, para el selector de empleados
 * del diálogo (empleados.puesto —texto legacy— suele estar vacío). Solo lectura.
 */
export async function getPuestosPrincipalesEmpleados(): Promise<Record<string, string>> {
  const { user, empresaId } = await getActor();
  if (!user || !empresaId) return {};
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return {};
  }
  const { data } = await admin
    .from("empleado_puestos")
    .select("empleado_id, puesto_nombre, puestos(nombre), empleados!inner(empresa_id)")
    .eq("es_principal", true)
    .eq("empleados.empresa_id", empresaId);
  const map: Record<string, string> = {};
  for (const r of data ?? []) {
    const nombre =
      ((r.puestos as { nombre?: string } | null)?.nombre) ??
      (r.puesto_nombre as string | null) ??
      "";
    if (nombre) map[r.empleado_id as string] = nombre;
  }
  return map;
}

export interface CondicionesActualesEmpleado {
  puesto: string | null;
  departamento: string | null;
  /** BRUTO vigente. El neto no se calcula, así que no se compara. */
  salarioBruto: number | null;
  jornada: string | null;
  horasSemanales: number | null;
  tipoContrato: string | null;
  nivel: number | null;
  /** Nombre del patrón de horario que tiene vigente hoy. */
  horarioNombre: string | null;
  /** Departamento que valida sus solicitudes. */
  validadorNombre: string | null;
  /** Nº de tareas del cronograma de su puesto actual (null = sin puesto). */
  cronogramaTareas: number | null;
}

/** Nombre del patrón de horario vigente HOY del empleado. */
async function leerHorarioVigente(
  admin: Admin,
  empleadoId: string,
  empresaId: string,
): Promise<string | null> {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("rrhh_patron_empleados")
    .select("vigente_desde, rrhh_patrones!inner(nombre, empresa_id, activo)")
    .eq("empleado_id", empleadoId)
    .eq("rrhh_patrones.empresa_id", empresaId)
    .eq("rrhh_patrones.activo", true)
    .lte("vigente_desde", hoy)
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data?.rrhh_patrones as { nombre?: string } | null)?.nombre) ?? null;
}

/** Nº de tareas del cronograma de un puesto (1:1 puesto ↔ cronograma). */
async function contarTareasCronograma(
  admin: Admin,
  puestoId: string,
  empresaId: string,
): Promise<number> {
  const { count } = await admin
    .from("cronogramas_operativos")
    .select("id", { count: "exact", head: true })
    .eq("puesto_id", puestoId)
    .eq("empresa_id", empresaId);
  return count ?? 0;
}

/**
 * Devuelve las condiciones VIGENTES de un empleado (fila con vigente_hasta IS
 * NULL de `empleado_condiciones`) + su puesto/departamento actual, para pintar la
 * columna «Actualmente» del diálogo de promoción. Solo lectura.
 */
export async function getCondicionesVigentesEmpleado(
  empleadoId: string,
): Promise<{ ok: boolean; data: CondicionesActualesEmpleado | null }> {
  const { user, empresaId } = await getActor();
  if (!user || !empresaId) return { ok: false, data: null };
  try {
    await requireAdminUser({ empresaIds: [empresaId] });
  } catch {
    return { ok: false, data: null };
  }
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, data: null };
  }

  const { data: emp } = await admin
    .from("empleados")
    .select("puesto, validador_departamento_id, departamentos!empleados_departamento_id_fkey(nombre)")
    .eq("id", empleadoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  // El puesto actual REAL es el principal de `empleado_puestos` (empleados.puesto
  // —texto legacy— puede estar vacío en empleados antiguos). Fallback al texto.
  const { data: principal } = await admin
    .from("empleado_puestos")
    .select("puesto_id, puesto_nombre, puestos(nombre)")
    .eq("empleado_id", empleadoId)
    .eq("es_principal", true)
    .maybeSingle();
  const puestoActual =
    ((principal?.puestos as { nombre?: string } | null)?.nombre) ??
    (principal?.puesto_nombre as string | null) ??
    (emp?.puesto as string | null) ??
    null;

  const puestoActualId = (principal?.puesto_id as string | null) ?? null;
  const validadorId = (emp?.validador_departamento_id as string | null) ?? null;

  const [horarioNombre, cronogramaTareas, validadorNombre] = await Promise.all([
    leerHorarioVigente(admin, empleadoId, empresaId),
    puestoActualId ? contarTareasCronograma(admin, puestoActualId, empresaId) : Promise.resolve(null),
    validadorId
      ? admin
          .from("departamentos")
          .select("nombre")
          .eq("id", validadorId)
          .maybeSingle()
          .then((r: { data: { nombre?: string } | null }) => r.data?.nombre ?? null)
      : Promise.resolve(null),
  ]);

  const { data: rows } = await admin
    .from("empleado_condiciones")
    .select("nivel, salario_bruto, jornada_contrato, horas_semanales, tipo_contrato, vigente_hasta, vigente_desde")
    .eq("empleado_id", empleadoId)
    .order("vigente_desde", { ascending: false, nullsFirst: false })
    .limit(20);
  const cond = (rows ?? []).find((r) => r.vigente_hasta == null) ?? rows?.[0] ?? null;

  const depto = emp?.departamentos as { nombre?: string } | null;
  return {
    ok: true,
    data: {
      puesto: puestoActual,
      departamento: depto?.nombre ?? null,
      salarioBruto: (cond?.salario_bruto as number | null) ?? null,
      jornada: (cond?.jornada_contrato as string | null) ?? null,
      horasSemanales: (cond?.horas_semanales as number | null) ?? null,
      tipoContrato: (cond?.tipo_contrato as string | null) ?? null,
      nivel: (cond?.nivel as number | null) ?? null,
      horarioNombre,
      validadorNombre,
      cronogramaTareas,
    },
  };
}

/** Lo que el empleado heredará del puesto destino, para la columna «Después». */
export interface PreviewPuestoDestino {
  horarioNombre: string | null;
  validadorNombre: string | null;
  cronogramaTareas: number;
}

/**
 * Lee del puesto destino lo que NO viene en `PuestoSalarial`: nombre del patrón
 * de horario oficial, departamento validador y nº de tareas de su cronograma.
 * Alimenta la comparativa «antes → después» antes de aplicar el puesto.
 */
export async function getPreviewPuestoDestino(
  puestoId: string,
): Promise<{ ok: boolean; data: PreviewPuestoDestino | null }> {
  const { user, empresaId } = await getActor();
  if (!user || !empresaId) return { ok: false, data: null };
  try {
    await requireAdminUser({ empresaIds: [empresaId] });
  } catch {
    return { ok: false, data: null };
  }
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, data: null };
  }

  const { data: puesto } = await admin
    .from("puestos")
    .select("validador_departamento_id")
    .eq("id", puestoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const validadorId = (puesto?.validador_departamento_id as string | null) ?? null;

  const [horarioNombre, cronogramaTareas, validadorNombre] = await Promise.all([
    leerHorarioOficialPuesto(admin, puestoId, empresaId),
    contarTareasCronograma(admin, puestoId, empresaId),
    validadorId
      ? admin
          .from("departamentos")
          .select("nombre")
          .eq("id", validadorId)
          .maybeSingle()
          .then((r: { data: { nombre?: string } | null }) => r.data?.nombre ?? null)
      : Promise.resolve(null),
  ]);

  return { ok: true, data: { horarioNombre, validadorNombre, cronogramaTareas } };
}

/**
 * Nombre del patrón de horario oficial del puesto: el elegido en Horarios
 * (familia en `puesto_salarios`) y, si no lo hay, la plantilla legacy propia del
 * puesto. Mismo orden de resolución que `asignarPlantillaPuestoAEmpleado`.
 */
async function leerHorarioOficialPuesto(
  admin: Admin,
  puestoId: string,
  empresaId: string,
): Promise<string | null> {
  const { data: salario } = await admin
    .from("puesto_salarios")
    .select("patron_familia_id")
    .eq("puesto_id", puestoId)
    .maybeSingle();

  const familiaId = (salario?.patron_familia_id as string | null) ?? null;
  if (familiaId) {
    const { data } = await admin
      .from("rrhh_patrones")
      .select("nombre")
      .eq("empresa_id", empresaId)
      .eq("familia_id", familiaId)
      .eq("es_oficial", true)
      .maybeSingle();
    if (data?.nombre) return data.nombre as string;
  }

  const { data: propio } = await admin
    .from("rrhh_patrones")
    .select("nombre")
    .eq("puesto_id", puestoId)
    .eq("es_oficial", true)
    .maybeSingle();
  return (propio?.nombre as string | null) ?? null;
}

/** Una fila del histórico de puestos/condiciones del empleado. */
export interface CondicionHistorica {
  puesto: string | null;
  nivel: number | null;
  /** BRUTO. El neto quedó vacío al separarse del bruto. */
  salarioBruto: number | null;
  jornada: string | null;
  horasSemanales: number | null;
  tipoContrato: string | null;
  motivo: string | null;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
  vigente: boolean;
}

/**
 * Histórico COMPLETO de condiciones/puesto de un empleado (todas las filas de
 * `empleado_condiciones`), la vigente primero. Solo lectura — el histórico solo
 * se escribe al contratar (motivo 'alta') o al cambiar de puesto (motivo
 * 'promocion') desde el módulo Puestos.
 */
export async function getHistorialCondicionesEmpleado(
  empleadoId: string,
): Promise<{ ok: boolean; data: CondicionHistorica[] }> {
  const { user, empresaId } = await getActor();
  if (!user || !empresaId) return { ok: false, data: [] };
  try {
    await requireAdminUser({ empresaIds: [empresaId] });
  } catch {
    return { ok: false, data: [] };
  }
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, data: [] };
  }

  const { data: rows } = await admin
    .from("empleado_condiciones")
    .select(
      "puesto_nombre, nivel, salario_bruto, jornada_contrato, horas_semanales, tipo_contrato, motivo, vigente_desde, vigente_hasta",
    )
    .eq("empleado_id", empleadoId)
    .eq("empresa_id", empresaId)
    .order("vigente_desde", { ascending: false, nullsFirst: false });

  const data: CondicionHistorica[] = (rows ?? []).map((r) => ({
    puesto: (r.puesto_nombre as string | null) ?? null,
    nivel: (r.nivel as number | null) ?? null,
    salarioBruto: (r.salario_bruto as number | null) ?? null,
    jornada: (r.jornada_contrato as string | null) ?? null,
    horasSemanales: (r.horas_semanales as number | null) ?? null,
    tipoContrato: (r.tipo_contrato as string | null) ?? null,
    motivo: (r.motivo as string | null) ?? null,
    vigenteDesde: (r.vigente_desde as string | null) ?? null,
    vigenteHasta: (r.vigente_hasta as string | null) ?? null,
    vigente: r.vigente_hasta == null,
  }));
  // La fila vigente (vigente_hasta null) siempre primero.
  data.sort((a, b) => Number(b.vigente) - Number(a.vigente));
  return { ok: true, data };
}
