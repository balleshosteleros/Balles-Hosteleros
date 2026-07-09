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
  tieneCondicionesUtiles,
  escribirCondicionesVigentes,
} from "@/features/rrhh/services/condiciones-puesto";
import { asignarPlantillaPuestoAEmpleado } from "@/features/rrhh/actions/puesto-horario-actions";
import { crearFirmaInterno } from "@/features/rrhh/services/firmas/crear-firma";
import { generarAnexoPromocionPDF } from "@/features/rrhh/services/firmas/anexo-promocion-pdf";
import { enviarCambioPuestoGestoria } from "@/features/rrhh/actions/gestoria-actions";
import { revalidatePath } from "next/cache";

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
  if ((emp.estado as string) !== "Activo") {
    return { ok: false, error: "Solo se puede promocionar a un empleado activo." };
  }

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
    .select("id, nombre, departamento_id")
    .eq("id", input.puestoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!puesto) return { ok: false, error: "Puesto de destino no encontrado." };
  if ((puesto.id as string) === puestoOrigenId) {
    return { ok: false, error: "El empleado ya ocupa ese puesto." };
  }

  const cond = await leerCondicionesPuesto(admin, input.puestoId);
  if (!tieneCondicionesUtiles(cond)) {
    return {
      ok: false,
      error:
        `El puesto «${puesto.nombre}» no tiene condiciones configuradas (salario, jornada…). ` +
        `Configúralas en RRHH → Puestos antes de promocionar.`,
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
    .update({ puesto: puesto.nombre, departamento_id: puesto.departamento_id })
    .eq("id", input.empleadoId)
    .eq("empresa_id", empresaId);

  // 4. Copiar condiciones del nuevo puesto al HISTÓRICO (cierra la vigente).
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
      const pdf = await generarAnexoPromocionPDF({
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
        salarioNeto: cond?.salario_neto ?? null,
      });
      const firma = await crearFirmaInterno({
        empresaId,
        empleadoId: input.empleadoId,
        pdf,
        titulo: "Anexo de cambio de puesto",
        tipo: "anexo_promocion",
        modalidad: "manuscrita_digital",
        validez: "eidas_simple",
        plazoDias: 14,
        observaciones: `Promoción interna: ${puestoOrigenNombre ?? "—"} → ${puesto.nombre}.`,
        enviadoPorUserId: user.id,
        enviadoPorNombre: "RRHH",
        preferirEmailPersonal: true,
        posicionFirmaDefault: { pagina: 1, xPct: 0.1, yPct: 0.82, anchoPct: 0.32 },
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
  salarioNeto: number | null;
  jornada: string | null;
  horasSemanales: number | null;
  tipoContrato: string | null;
  nivel: number | null;
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
    .select("puesto, departamentos(nombre)")
    .eq("id", empleadoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  // El puesto actual REAL es el principal de `empleado_puestos` (empleados.puesto
  // —texto legacy— puede estar vacío en empleados antiguos). Fallback al texto.
  const { data: principal } = await admin
    .from("empleado_puestos")
    .select("puesto_nombre, puestos(nombre)")
    .eq("empleado_id", empleadoId)
    .eq("es_principal", true)
    .maybeSingle();
  const puestoActual =
    ((principal?.puestos as { nombre?: string } | null)?.nombre) ??
    (principal?.puesto_nombre as string | null) ??
    (emp?.puesto as string | null) ??
    null;

  const { data: rows } = await admin
    .from("empleado_condiciones")
    .select("nivel, salario_neto, jornada_contrato, horas_semanales, tipo_contrato, vigente_hasta, vigente_desde")
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
      salarioNeto: (cond?.salario_neto as number | null) ?? null,
      jornada: (cond?.jornada_contrato as string | null) ?? null,
      horasSemanales: (cond?.horas_semanales as number | null) ?? null,
      tipoContrato: (cond?.tipo_contrato as string | null) ?? null,
      nivel: (cond?.nivel as number | null) ?? null,
    },
  };
}
