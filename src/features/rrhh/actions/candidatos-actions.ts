"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  normalizarNombre,
  normalizarNombreOrNull,
} from "@/shared/lib/normalizar-nombre";
import { ESTADOS_CONFIG, type FasePrincipal } from "@/features/rrhh/data/reclutamiento";
import { etiquetaTipoBajaEmpresa, type TipoBajaContrato } from "@/features/rrhh/data/campos-gestoria";
import { friendlyError } from "@/shared/lib/friendly-errors";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/**
 * Mensaje legible de un error. Los errores de Supabase (`PostgrestError`) NO
 * son instancias de `Error`, sino objetos `{ message, details, hint, code }`,
 * por lo que `err instanceof Error` los descartaba y se mostraba el genérico
 * "Error desconocido", ocultando la causa real (p.ej. violación de un CHECK).
 */
function mensajeError(err: unknown): string {
  let raw = "";
  if (err instanceof Error) raw = err.message;
  else if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") raw = m;
  }
  if (!raw) return "No se pudo completar la acción. Inténtalo de nuevo.";
  // Nunca mostramos errores técnicos de la base de datos (en inglés) al usuario.
  if (/violates check constraint|check constraint/i.test(raw))
    return "No se pudo mover el candidato a esa fase. Avisa a soporte si continúa.";
  if (/violates foreign key|foreign key constraint/i.test(raw))
    return "Falta un dato relacionado para completar la acción.";
  if (/duplicate key|already exists|unique constraint/i.test(raw))
    return "Ya existe un registro con esos datos.";
  if (/permission denied|row-level security|rls/i.test(raw))
    return "No tienes permiso para esta acción.";
  // Si el mensaje ya está en español (nuestro), se muestra tal cual.
  if (/[áéíóúñ¿¡]/i.test(raw) || /^[^\x00-\x7F]*[a-z]/i.test(raw) === false) return raw;
  return "No se pudo completar la acción. Inténtalo de nuevo.";
}

/** Nombre legible del usuario (nombre+apellidos → full_name → email). */
async function nombreUsuarioActual(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("usuarios")
    .select("nombre, apellidos, full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return "Usuario";
  const completo = [data.nombre, data.apellidos].filter(Boolean).join(" ").trim();
  return completo || (data.full_name as string | null) || (data.email as string | null) || "Usuario";
}

/**
 * Devuelve el enlace personal de documentación del candidato (lo genera de
 * forma perezosa si aún no existe). Lo usa la pestaña «Documentación» de la
 * ficha para mostrar/copiar el enlace y reenviarlo, sin tener que mover de fase.
 */
export async function getEnlaceDocumentacionCandidato(
  candidatoId: string,
): Promise<{ ok: true; enlace: string } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { asegurarTokenDocumentacion, enlaceDocumentacion } = await import(
      "@/features/rrhh/lib/documentacion-candidato"
    );
    const token = await asegurarTokenDocumentacion(supabase, candidatoId, empresaId);
    if (!token) return { ok: false, error: "No se pudo generar el enlace" };
    return { ok: true, enlace: enlaceDocumentacion(token) };
  } catch (err: unknown) {
    return { ok: false, error: mensajeError(err) };
  }
}

export async function listCandidatosReales() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("candidatos")
      .select(`
        id, empresa_id, vacante_id, empleado_id, nombre, apellidos, email,
        telefono, dni_nie, cv_url, origen, fase, estado, puntuacion, notas,
        genero, ubicacion, disponibilidad, experiencia_previa, carta_presentacion,
        como_nos_conocio,
        promovido_at, activo, created_at,
        vacantes(id, titulo, departamento_id, puesto_id, local_id),
        candidato_resenas(puntuaciones)
      `)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    // Nota final de las reseñas = media (0–5) de TODAS las estrellas de TODAS
    // las reseñas del candidato. Misma fórmula que la ficha (CandidatoDetailModal).
    const rows = (data ?? []).map((c) => {
      const resenas = (c as { candidato_resenas?: { puntuaciones?: { estrellas?: number }[] }[] }).candidato_resenas ?? [];
      const estrellas = resenas
        .flatMap((r) => r.puntuaciones ?? [])
        .map((p) => p.estrellas ?? 0)
        .filter((n) => n > 0);
      const nota_resenas = estrellas.length
        ? estrellas.reduce((a, b) => a + b, 0) / estrellas.length
        : null;
      const { candidato_resenas: _omit, ...resto } = c as Record<string, unknown>;
      void _omit;
      return { ...resto, nota_resenas };
    });
    return { ok: true, data: rows };
  } catch (err) {
    console.error("[rrhh] listCandidatosReales:", err);
    return { ok: false, data: [], error: friendlyError(err, "resenas") };
  }
}

export async function createCandidato(input: {
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  vacante_id: string | null;
  origen: string;
  notas: string;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" } as const;

    const { error } = await supabase.from("candidatos").insert({
      empresa_id: empresaId,
      vacante_id: input.vacante_id,
      nombre: normalizarNombre(input.nombre),
      apellidos: normalizarNombreOrNull(input.apellidos),
      email: input.email.trim(),
      telefono: input.telefono.trim() || null,
      origen: input.origen,
      notas: input.notas.trim() || null,
      fase: "seleccion",
      estado: "nuevo",
    });

    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true } as const;
  } catch (err: unknown) {
    const msg = mensajeError(err);
    return { ok: false, error: msg } as const;
  }
}

// ── Orden del pipeline ───────────────────────────────────────────────────────
// El recorrido completo de una persona, de la candidatura a la salida. Se hace
// en orden y sin atajos: cada casilla deja algo hecho que la siguiente da por
// hecho —la entrevista valorada, la documentación entregada, el alta cursada,
// la baja comunicada, el material recogido, el finiquito pagado—. Saltarse una
// es cerrar el paso anterior a medias, y volver atrás es peor: la tarjeta diría
// una cosa y la Seguridad Social otra.
const ORDEN_PIPELINE = [
  "nuevo",
  "elegido",
  "entrevista",
  "documentacion",
  "formacion",
  "contratacion",
  "prueba",
  "empleado",
  "preaviso",
  "baja_contrato",
  "entregas",
  "finiquito",
] as const;

// Cada descarte tiene sus propias puertas de entrada, y no son las mismas:
//   · PAPELERA — solo antes de pedirle la documentación. A partir de ahí ya hay
//     un expediente suyo abierto y tirarlo a la papelera borraría ese rastro.
//   · NO SE PRESENTA — también desde Documentación: plantarse a mitad del
//     papeleo es justamente uno de los casos que hay que poder registrar.
const ORIGENES_PAPELERA = ["nuevo", "elegido", "entrevista"];
const ORIGENES_NO_SE_PRESENTA = ["nuevo", "elegido", "entrevista", "documentacion"];

/** Descartes: fuera del recorrido, se entra en ellos por la puerta de al lado. */
const ESTADOS_DESCARTE = ["papelera", "no_se_presenta", "descartado"];

/** Posición en el recorrido (-1 si el estado no forma parte de él). */
function pasoOffboarding(estado: string | null | undefined): number {
  return ORDEN_PIPELINE.indexOf((estado ?? "") as (typeof ORDEN_PIPELINE)[number]);
}

/** Nombre de la casilla tal y como se lee en el tablero. */
function etiquetaEstado(estado: string): string {
  const cfg = (ESTADOS_CONFIG as Record<string, { label: string } | undefined>)[estado];
  return cfg?.label ?? estado;
}

/**
 * A dónde SÍ puede ir esta ficha desde donde está.
 *
 * Se le dice siempre que se rechaza un movimiento: un «no se puede» a secas deja
 * a quien lo intenta probando casillas a ver cuál traga.
 */
function destinosPermitidos(origen: string): string[] {
  const permitidos: string[] = [];
  const desde = pasoOffboarding(origen);

  // La siguiente casilla del recorrido.
  if (desde >= 0 && desde + 1 < ORDEN_PIPELINE.length) permitidos.push(ORDEN_PIPELINE[desde + 1]);
  // Finiquito es la última del recorrido: su continuación es el cierre.
  if (origen === "finiquito") permitidos.push("ex_empleado");
  // Atajos y vueltas atrás con nombre propio.
  // Desde PRUEBA también se puede dar de baja: es justo donde se decide si
  // alguien se queda, y no superar el periodo de prueba es una baja como otra.
  if (origen === "empleado" || origen === "prueba") permitidos.push("baja_contrato");
  if (origen === "preaviso") permitidos.push("empleado");
  // Descartes, cada uno por su puerta.
  if (ORIGENES_PAPELERA.includes(origen)) permitidos.push("papelera");
  if (ORIGENES_NO_SE_PRESENTA.includes(origen)) permitidos.push("no_se_presenta");
  if (origen === "formacion") permitidos.push("suspenso_formacion");
  // Recuperar a alguien descartado le devuelve al principio.
  if (ESTADOS_DESCARTE.includes(origen) || origen === "suspenso_formacion") permitidos.push("nuevo");

  return [...new Set(permitidos)];
}

/**
 * El aviso ENTERO cuando un movimiento no vale.
 *
 * Una sola frase, y solo con lo que SÍ se puede hacer. Explicar por qué no vale
 * cada combinación no ayuda a nadie: quien arrastra una ficha quiere saber a
 * dónde llevarla, no una clase sobre el proceso.
 */
function avisoDestinos(origen: string): string {
  const opciones = destinosPermitidos(origen).map(etiquetaEstado);
  const desde = etiquetaEstado(origen);
  if (opciones.length === 0) return `«${desde}» es la última casilla: esta ficha ya no se mueve.`;
  if (opciones.length === 1) return `Desde «${desde}» solo puedes moverla a «${opciones[0]}».`;
  const ultima = opciones.pop() as string;
  return `Desde «${desde}» puedes moverla a ${opciones.map((o) => `«${o}»`).join(", ")} o «${ultima}».`;
}

/**
 * ¿Se puede mover de `origen` a `destino`?
 *
 * El recorrido va en orden y sin atajos, con cuatro salidas laterales:
 *   · «Baja contrato» también se alcanza desde «Empleado» (la baja que causa la
 *     empresa no tiene preaviso que respetar).
 *   · «Preaviso» vuelve a «Empleado» si se le convence de que se quede. Es la
 *     ÚNICA marcha atrás de todo el tablero.
 *   · Papelera desde Nuevo, Elegido o Entrevista; «No se presenta» también desde
 *     Documentación; «Suspenso formación» solo desde Formación.
 *   · Recuperar a alguien descartado le devuelve a «Nuevo».
 *
 * DIRECCIÓN se salta todo esto (se lo permite el rol, no un permiso suelto).
 */
function revisarOrdenOffboarding(
  origen: string | null | undefined,
  destino: string,
): { ok: true } | { ok: false; error: string } {
  const org = (origen ?? "").trim();
  const desde = pasoOffboarding(org);
  const hasta = pasoOffboarding(destino);

  if (org === destino) return { ok: true };

  const permitido = destinosPermitidos(org).includes(destino);
  if (permitido) return { ok: true };

  // Estado antiguo que ya no existe en el tablero: no se le pone puerta, porque
  // no sabríamos ni a dónde mandarle.
  const conocido =
    desde >= 0 ||
    ESTADOS_DESCARTE.includes(org) ||
    org === "suspenso_formacion" ||
    org === "ex_empleado";
  if (!conocido) return { ok: true };

  // Avanzar a la casilla siguiente siempre vale; lo demás, no.
  if (hasta === desde + 1 && desde >= 0) return { ok: true };

  return { ok: false, error: avisoDestinos(org) };
}

export async function moverCandidatoFase(
  id: string,
  fase: FasePrincipal,
  estado: string,
) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Bloquear movimiento si ya fue promovido (gestionar como "ya es empleado")
    const { data: cand } = await supabase
      .from("candidatos")
      .select("promovido_at, empleado_id, fase, estado")
      .eq("id", id)
      .single();

    if (cand?.promovido_at && fase === "descartado") {
      return {
        ok: false,
        error: "YA_EMPLEADO",
        empleadoId: cand.empleado_id,
      } as const;
    }

    // ORDEN DE LA SALIDA: ni saltos ni marcha atrás (salvo desde Preaviso).
    // DIRECCIÓN es la excepción: se le permite corregir un movimiento mal dado,
    // que si no obligaría a rehacer la ficha entera.
    {
      const orden = revisarOrdenOffboarding(cand?.estado as string | null, estado);
      if (!orden.ok) {
        const { getRolContext } = await import(
          "@/features/auth/actions/permisos-actions"
        );
        const { esDirector } = await getRolContext();
        if (!esDirector) {
          return { ok: false, error: orden.error } as const;
        }
      }
    }

    // ENTREGAS → FINIQUITO: no se pasa mientras quede una sola entrega sin cerrar.
    // El acta firmada es lo que acredita que el uniforme y las llaves han vuelto;
    // pagar el finiquito antes es despedirse sin haber recogido. Quien no tenga
    // nada a su nombre pasa de largo, sin trámite.
    if (
      cand?.estado === "entregas" &&
      estado !== "entregas" &&
      pasoOffboarding(estado) > pasoOffboarding("entregas") &&
      cand?.empleado_id
    ) {
      // Lectura con cliente admin: si la RLS del usuario tapara alguna fila, la
      // comprobación diría «no debe nada» y le dejaría pasar. La regla tiene que
      // ver todas las entregas, las vea quien las vea.
      const { createAdminClient: adminEntregas } = await import("@/lib/supabase/admin");
      const { data: abiertas } = await adminEntregas()
        .from("entregas_material")
        .select("id, devolucion_estado, entregas_material_items!inner(requiere_devolucion)")
        .eq("empresa_id", empresaId)
        .eq("empleado_id", cand.empleado_id as string)
        .eq("estado", "firmada")
        .eq("entregas_material_items.requiere_devolucion", true)
        .not("devolucion_estado", "in", '("devuelta","merma")');

      const filas = (abiertas ?? []) as Array<{ id: string; devolucion_estado: string | null }>;
      // Una entrega aparece una vez por pieza pendiente: se agrupa por entrega.
      const porEntrega = new Map<string, string | null>();
      for (const f of filas) porEntrega.set(f.id, f.devolucion_estado);

      if (porEntrega.size > 0) {
        const esperandoFirma = [...porEntrega.values()].filter(
          (e) => e === "pendiente_firma" || e === "merma_pendiente_firma",
        ).length;
        const sinPedir = porEntrega.size - esperandoFirma;

        // El motivo, dicho para que RRHH sepa qué le toca hacer: pedir la
        // devolución de lo que aún no se ha pedido, o esperar/recordar la firma.
        const partes: string[] = [];
        if (sinPedir > 0) {
          partes.push(
            sinPedir === 1
              ? "1 sin devolver todavía (pídesela desde Entregas)"
              : `${sinPedir} sin devolver todavía (pídeselas desde Entregas)`,
          );
        }
        if (esperandoFirma > 0) {
          partes.push(
            esperandoFirma === 1
              ? "1 esperando su firma"
              : `${esperandoFirma} esperando su firma`,
          );
        }

        const { getRolContext } = await import(
          "@/features/auth/actions/permisos-actions"
        );
        const { esDirector } = await getRolContext();
        if (!esDirector) {
          return {
            ok: false,
            error:
              `Le ${porEntrega.size === 1 ? "queda 1 entrega" : `quedan ${porEntrega.size} entregas`} sin firmar ` +
              `(${partes.join(" y ")}). Cuando estén todas firmadas, pasa a «Finiquito».`,
          } as const;
        }
      }
    }

    // FINIQUITO → EX-EMPLEADOS: no se cierra a nadie a quien todavía se le debe
    // dinero. Se mira el mes de su ÚLTIMO DÍA de contrato (el mes en el que se
    // le liquida) y ese mes tiene que estar en Pagos y marcado como PAGADO por
    // RRHH. Sin eso, cerrar la ficha sería dar por terminada una relación
    // laboral con la última nómina sin abonar.
    if (estado === "ex_empleado" && cand?.estado !== "ex_empleado" && cand?.empleado_id) {
      const empleadoId = cand.empleado_id as string;

      // Último día trabajado: el comunicado a la gestoría manda; si no consta,
      // se deduce de la fecha de baja de la ficha (el día oficial es el siguiente).
      // Con cliente admin por el mismo motivo, pero al revés: si la RLS tapara
      // la línea de Pagos, la comprobación diría «no está pagado» y bloquearía
      // un cierre correcto.
      const { createAdminClient: adminPagos } = await import("@/lib/supabase/admin");
      const admin = adminPagos();
      const { data: bajaRow } = await admin
        .from("gestoria_bajas")
        .select("ultimo_dia")
        .eq("empresa_id", empresaId)
        .eq("empleado_id", empleadoId)
        .order("ultimo_dia", { ascending: false })
        .limit(1)
        .maybeSingle();
      let ultimoDia = (bajaRow?.ultimo_dia as string | null) ?? null;
      if (!ultimoDia) {
        const { data: empRow } = await admin
          .from("empleados")
          .select("fecha_baja")
          .eq("id", empleadoId)
          .maybeSingle();
        const fechaBaja = (empRow?.fecha_baja as string | null) ?? null;
        if (fechaBaja) {
          const t = new Date(`${fechaBaja}T00:00:00Z`);
          if (!Number.isNaN(t.getTime())) {
            t.setUTCDate(t.getUTCDate() - 1);
            ultimoDia = t.toISOString().slice(0, 10);
          }
        }
      }

      if (ultimoDia) {
        const periodo = ultimoDia.slice(0, 7); // YYYY-MM
        const { data: pagos } = await admin
          .from("rrhh_pagos")
          .select("pagado")
          .eq("empresa_id", empresaId)
          .eq("empleado_id", empleadoId)
          .eq("periodo", periodo);

        const lineas = (pagos ?? []) as Array<{ pagado: boolean | null }>;
        const sinPagar = lineas.filter((l) => !l.pagado).length;
        const motivo =
          lineas.length === 0
            ? `Su último mes (${periodo}) todavía no está en Pagos. Ciérralo y márcalo como pagado, y ya podrás pasarle a «Ex-empleados».`
            : sinPagar > 0
              ? `Su último mes (${periodo}) sigue sin marcar como pagado en Pagos. Márcalo como pagado y ya podrás pasarle a «Ex-empleados».`
              : null;

        if (motivo) {
          const { getRolContext } = await import(
            "@/features/auth/actions/permisos-actions"
          );
          const { esDirector } = await getRolContext();
          if (!esDirector) {
            return { ok: false, error: motivo } as const;
          }
        }
      }
    }

    // A EX-EMPLEADO solo pueden llegar quienes FUERON empleados reales (vienen de
    // la casilla «empleado»): tienen un empleado vinculado. Un candidato que nunca
    // llegó a ser empleado NO puede pasar a ex-empleado.
    if (estado === "ex_empleado" && cand?.estado !== "ex_empleado" && !cand?.empleado_id) {
      return {
        ok: false,
        error: "NO_FUE_EMPLEADO",
      } as const;
    }

    // Cada cambio de fase/estado reinicia el contador de «días en la fase actual».
    const faseCambia = !!cand && (cand.fase !== fase || cand.estado !== estado);
    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("candidatos")
      .update({
        fase,
        estado,
        updated_at: ahora,
        ...(faseCambia ? { fase_actualizada_at: ahora } : {}),
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) throw error;

    // PRP-070: al ENTRAR en la fase Prueba, el empleado (creado en Contratación)
    // recibe el email de acceso (elige contraseña), diferido hasta este momento.
    if (estado === "prueba" && cand?.estado !== "prueba" && cand?.empleado_id) {
      try {
        const { enviarAccesoEmpleadoPorId } = await import(
          "@/features/rrhh/actions/contratacion-actions"
        );
        await enviarAccesoEmpleadoPorId(cand.empleado_id as string);
      } catch (e) {
        console.error("[candidatos] acceso al pasar a prueba:", e);
      }
    }

    // Al ENTRAR en Prueba se abre su periodo con los hitos de validación ya
    // repartidos. Idempotente: si vuelve a entrar en la fase no se duplica.
    // No exige `empleado_id`: el periodo puede colgar solo del candidato.
    if (estado === "prueba" && cand?.estado !== "prueba") {
      try {
        const { abrirPeriodoPrueba } = await import(
          "@/features/rrhh/actions/periodo-prueba-actions"
        );
        await abrirPeriodoPrueba({
          empleadoId: (cand?.empleado_id as string | null) ?? null,
          candidatoId: id,
        });
      } catch (e) {
        console.error("[candidatos] periodo de prueba al pasar a prueba:", e);
      }
    }

    // ENTREGAS: al entrar en la casilla se le avisa de lo que tiene a su nombre
    // (correo + campana) y de que sin devolverlo no se cierra su finiquito. A
    // quien no deba nada no se le escribe. Best-effort: no bloquea el movimiento.
    if (estado === "entregas" && cand?.estado !== "entregas" && cand?.empleado_id) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const { avisarDevolucionSalida } = await import(
          "@/features/rrhh/services/entregas/avisar-devolucion-salida"
        );
        await avisarDevolucionSalida(createAdminClient(), {
          empresaId,
          empleadoId: cand.empleado_id as string,
        });
      } catch (e) {
        console.error("[candidatos] aviso de devolución al pasar a entregas:", e);
      }
    }

    // Offboarding cerrado: al pasar a EX-EMPLEADO, el empleado queda Inactivo HOY
    // (el día en que se le pasa a ex-empleado) y su usuario pierde el acceso (el
    // trigger empleados_sync_estado_acceso pone usuarios.estado_acceso = 'Inactivo'
    // → login bloqueado). La baja también recorta su horario futuro
    // (setEmpleadoEstado → recortarHorarioFuturoPorBaja). Un ex-empleado NUNCA
    // queda Activo ni con usuario funcionando: esta es la garantía de esa regla.
    if (estado === "ex_empleado" && cand?.estado !== "ex_empleado" && cand?.empleado_id) {
      try {
        const empleadoId = cand.empleado_id as string;
        // Si el cron ya lo desactivó al llegar su día oficial, NO se vuelve a
        // tocar: su `fecha_baja` es la PACTADA con la gestoría y machacarla con
        // la de hoy dejaría a la empresa y a la gestoría contando días distintos.
        const { data: empActual } = await supabase
          .from("empleados")
          .select("estado")
          .eq("id", empleadoId)
          .maybeSingle();
        if ((empActual?.estado as string | null) === "Activo") {
          const fechaBaja = ahora.slice(0, 10); // HOY
          const { setEmpleadoEstado } = await import(
            "@/features/rrhh/actions/empleados-actions"
          );
          await setEmpleadoEstado({ id: empleadoId, estado: "Inactivo", fechaBaja });
        }

        // CIERRE TOTAL del acceso. Desde su último día entraba en modo
        // «Offboarding» (solo sus documentos, para poder firmar la devolución y el
        // finiquito). Ex-empleados es el final del camino: ya no hay nada que
        // firmar, así que se le cierra la puerta del todo. Solo se toca a quien
        // NO siga activo en otra empresa del grupo.
        const { data: empUser } = await supabase
          .from("empleados")
          .select("user_id")
          .eq("id", empleadoId)
          .maybeSingle();
        const userIdEmpleado = (empUser?.user_id as string | null) ?? null;
        if (userIdEmpleado) {
          await supabase
            .from("usuarios")
            .update({ estado_acceso: "Inactivo" })
            .eq("user_id", userIdEmpleado)
            .eq("estado_acceso", "Offboarding");
        }
      } catch (e) {
        console.error("[candidatos] baja al pasar a ex_empleado:", e);
      }
    }

    // Registra la actividad (apartado "Actividad" de la ficha): quién, cuándo y
    // de qué estado a cuál. El flag email_enviado lo marca después el envío del
    // correo de fase, si lo hubo. No bloquea el movimiento si fallara.
    if (user && cand && (cand.fase !== fase || cand.estado !== estado)) {
      const usuarioNombre = await nombreUsuarioActual(supabase, user.id);
      const { error: histErr } = await supabase.from("candidato_historial").insert({
        empresa_id: empresaId,
        candidato_id: id,
        fase_anterior: cand.fase ?? null,
        estado_anterior: cand.estado ?? null,
        fase_nueva: fase,
        estado_nuevo: estado,
        usuario_id: user.id,
        usuario_nombre: usuarioNombre,
        email_enviado: false,
      });
      if (histErr) console.error("[candidatos] historial:", histErr.message);
    }

    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, empleadoYaContratado: !!cand?.promovido_at };
  } catch (err: unknown) {
    const msg = mensajeError(err);
    return { ok: false, error: msg };
  }
}

/**
 * Mueve un candidato a OTRA vacante (corrección cuando se inscribió en la
 * vacante equivocada). Permite indicar también la fase/estado de destino dentro
 * de esa vacante. Registra la actividad. No permite mover candidatos ya
 * promovidos a empleado.
 */
export async function moverCandidatoAVacante(
  id: string,
  vacanteId: string,
  fase: FasePrincipal,
  estado: string,
) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: cand } = await supabase
      .from("candidatos")
      .select("promovido_at, vacante_id, fase, estado")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();

    if (cand?.promovido_at) {
      return { ok: false, error: "Este candidato ya es empleado; no se puede cambiar de vacante." };
    }

    // Verifica que la vacante destino pertenece a la empresa.
    const { data: vac } = await supabase
      .from("vacantes")
      .select("id, titulo")
      .eq("id", vacanteId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!vac) return { ok: false, error: "La vacante de destino no existe" };

    // Título de la vacante de origen (para mostrar el movimiento en la actividad).
    let vacanteAnteriorNombre: string | null = null;
    if (cand?.vacante_id) {
      const { data: vacOrigen } = await supabase
        .from("vacantes")
        .select("titulo")
        .eq("id", cand.vacante_id)
        .maybeSingle();
      vacanteAnteriorNombre = (vacOrigen?.titulo as string | null) ?? null;
    }

    // Mover de vacante reinicia siempre el contador de «días en la fase actual».
    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("candidatos")
      .update({
        vacante_id: vacanteId,
        fase,
        estado,
        updated_at: ahora,
        fase_actualizada_at: ahora,
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    // Registra el MOVIMIENTO DE VACANTE como evento propio de la actividad: se
    // guardan los títulos de origen y destino. La fase/estado se conservan como
    // contexto, pero la presencia de vacante_nueva_nombre marca la fila como un
    // movimiento de vacante (no un cambio de fase) al renderizar la pestaña.
    if (user && cand) {
      const usuarioNombre = await nombreUsuarioActual(supabase, user.id);
      const { error: histErr } = await supabase.from("candidato_historial").insert({
        empresa_id: empresaId,
        candidato_id: id,
        fase_anterior: cand.fase ?? null,
        estado_anterior: cand.estado ?? null,
        fase_nueva: fase,
        estado_nuevo: estado,
        vacante_anterior_nombre: vacanteAnteriorNombre,
        vacante_nueva_nombre: (vac.titulo as string | null) ?? null,
        usuario_id: user.id,
        usuario_nombre: usuarioNombre,
        email_enviado: false,
      });
      if (histErr) console.error("[candidatos] historial vacante:", histErr.message);
    }

    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: mensajeError(err) };
  }
}

/**
 * Activa/desactiva un candidato. Inactivo = se conserva todo en BD y sigue en el
 * listado de Candidatos, pero desaparece del pipeline (kanban) de su vacante.
 */
export async function setCandidatoActivo(id: string, activo: boolean) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("candidatos")
      .update({ activo, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: mensajeError(err) };
  }
}

/**
 * Marca/desmarca al candidato como «visto» (revisado). visto = true sella la
 * fecha de revisión (`visto_at`); visto = false la borra (vuelve a pendiente).
 * Se llama automáticamente al abrir la ficha y, manualmente, desde el botón
 * «Candidato visto» del pie del modal. Idempotente: si ya estaba visto, no
 * reescribe la fecha (conserva la primera revisión).
 */
export async function setCandidatoVisto(id: string, visto: boolean) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    if (visto) {
      // Solo sella la fecha si aún no estaba visto (no pisar la primera revisión).
      const { data: cand } = await supabase
        .from("candidatos")
        .select("visto_at")
        .eq("id", id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (cand?.visto_at) return { ok: true, vistoAt: cand.visto_at as string };
      const ahora = new Date().toISOString();
      const { error } = await supabase
        .from("candidatos")
        .update({ visto_at: ahora, updated_at: ahora })
        .eq("id", id)
        .eq("empresa_id", empresaId);
      if (error) throw error;
      revalidatePath("/rrhh/reclutamiento");
      return { ok: true, vistoAt: ahora };
    }

    const { error } = await supabase
      .from("candidatos")
      .update({ visto_at: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, vistoAt: null };
  } catch (err: unknown) {
    return { ok: false, error: mensajeError(err) };
  }
}

/**
 * Persiste los datos editables de la ficha del candidato (género, ubicación y
 * disponibilidad de incorporación). Solo actualiza los campos presentes en
 * `input`. Best-effort sobre la empresa activa.
 */
export async function actualizarDatosCandidato(
  id: string,
  input: {
    genero?: "masculino" | "femenino" | null;
    ubicacion?: string | null;
    disponibilidad?: "inmediato" | "15_dias" | null;
    experiencia_previa?: "sin_experiencia" | "menos_1" | "de_1_a_5" | "mas_5" | null;
    como_nos_conocio?: string | null;
    carta_presentacion?: string | null;
  },
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Un candidato ya contratado es INMUTABLE, igual que en `eliminarCandidato`
    // y `moverCandidatoAVacante`: su ficha es el histórico de la relación
    // laboral y sus datos se gestionan desde la ficha de empleado.
    const { data: cand } = await supabase
      .from("candidatos")
      .select("promovido_at, empleado_id")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!cand) return { ok: false, error: "Candidato no encontrado" };
    if (cand.promovido_at || cand.empleado_id) {
      return {
        ok: false,
        error: "Este candidato ya es empleado: edita sus datos desde su ficha de empleado.",
      };
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("genero" in input) patch.genero = input.genero || null;
    if ("ubicacion" in input) patch.ubicacion = input.ubicacion?.trim() || null;
    if ("disponibilidad" in input) patch.disponibilidad = input.disponibilidad || null;
    if ("experiencia_previa" in input) patch.experiencia_previa = input.experiencia_previa || null;
    if ("como_nos_conocio" in input) patch.como_nos_conocio = input.como_nos_conocio?.trim() || null;
    if ("carta_presentacion" in input) patch.carta_presentacion = input.carta_presentacion?.trim() || null;

    const { error } = await supabase
      .from("candidatos")
      .update(patch)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: mensajeError(err) };
  }
}

/**
 * ARCHIVA una candidatura moviéndola a «Papelera».
 *
 * Un CV no se borra nunca: se queda en la base de datos como historial (la BD
 * lo impide con el trigger `candidatos_no_delete`). «Borrar» en la interfaz
 * significa retirarlo de la vista, no destruirlo — así no se puede perder el
 * rastro de una persona ni el vínculo que sostiene su offboarding.
 */
export async function eliminarCandidato(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: cand } = await supabase
      .from("candidatos")
      .select("promovido_at, empleado_id, fase")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();
    if (!cand) return { ok: false, error: "Candidato no encontrado" };

    // Quien ya es (o fue) empleado no se archiva: su tarjeta es la que sostiene
    // el offboarding y el histórico de la relación laboral.
    if (cand.promovido_at || cand.empleado_id) {
      return {
        ok: false,
        error: "Este candidato ya es empleado; su candidatura no se puede archivar.",
      };
    }
    if (cand.fase === "descartado") return { ok: true };

    // «Papelera» es un ESTADO dentro de la fase «descartado» (ver OFFBOARDING/
    // DESCARTADO_CONFIG en data/reclutamiento.ts).
    const mov = await moverCandidatoFase(id, "descartado", "papelera");
    if (!mov.ok) {
      return { ok: false, error: ("error" in mov && mov.error) || "No se pudo archivar" };
    }

    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    const msg = mensajeError(err);
    return { ok: false, error: msg };
  }
}

/**
 * Guarda lo que RRHH decidió al cerrar el preaviso.
 *
 * Dos destinos distintos a propósito:
 *   · «¿Nos interesa que se vaya?» va a una COLUMNA de la tarjeta, porque es lo
 *     único que luego se cuenta (de los que se fueron, a cuántos queríamos
 *     retener).
 *   · Lo que se hizo y se habló va como NOTA de texto a su ficha: se lee, no se
 *     cuenta, y encajonarlo en categorías solo lo empobrecería.
 *
 * Best-effort: no puede tumbar la baja ni la vuelta al equipo.
 */
async function guardarDecisionPreaviso(
  supabase: Awaited<ReturnType<typeof getContext>>["supabase"],
  args: {
    candidatoId: string;
    empresaId: string;
    userId: string | null;
    interesaQueSeVaya: boolean;
    notas: string;
    titulo: string;
  },
): Promise<void> {
  try {
    await supabase
      .from("candidatos")
      .update({
        interesa_que_se_vaya: args.interesaQueSeVaya,
        interesa_que_se_vaya_at: new Date().toISOString(),
        interesa_que_se_vaya_por: args.userId,
      })
      .eq("id", args.candidatoId)
      .eq("empresa_id", args.empresaId);
  } catch (e) {
    console.error("[rrhh] guardarDecisionPreaviso → columna:", e);
  }

  try {
    const { addNotaCandidato } = await import(
      "@/features/rrhh/actions/candidato-ficha-actions"
    );
    const interes = args.interesaQueSeVaya
      ? "Nos conviene que se vaya."
      : "Queríamos retenerle.";
    await addNotaCandidato(args.candidatoId, `${args.titulo}\n${interes}\n${args.notas}`);
  } catch (e) {
    console.error("[rrhh] guardarDecisionPreaviso → nota:", e);
  }
}

/**
 * TRAMITA la baja del trabajador que ya está en PREAVISO, al pasarlo a la
 * columna «Baja contrato».
 *
 * Aprobar la solicitud en Mi Panel no tramita nada: solo abre el preaviso, en el
 * que todavía cabe convencerle de que se quede, y por eso hasta aquí no se le ha
 * tocado ni un turno. Es ESTE paso el que hace la baja firme:
 *
 *   1. Comunica la baja a la gestoría con la ficha completa del trabajador.
 *      BLOQUEANTE: si le faltan datos obligatorios no se mueve nada.
 *   2. Recorta su horario a partir de su último día, para que el cuadrante deje
 *      de contar con él (queda «sin horario asignado», que no es «libre»).
 *   3. Mueve la tarjeta a «Baja contrato».
 *
 * Solo sirve para bajas que el trabajador pidió y RRHH aprobó. Si no hay
 * solicitud aprobada, devuelve `SIN_SOLICITUD`: esa baja la causa la empresa y
 * hay que tramitarla con el botón «Baja contrato» de su ficha, que pregunta el
 * tipo de baja y los hechos.
 */
export async function tramitarBajaDesdePreaviso(
  candidatoId: string,
  decision: {
    /** true = nos conviene que se vaya. Es el ÚNICO dato que se guarda como tal. */
    interesaQueSeVaya: boolean;
    /** Qué se hizo en el preaviso. Obligatorio, y va a su ficha como nota. */
    notas: string;
  },
) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    if (typeof decision?.interesaQueSeVaya !== "boolean") {
      return { ok: false as const, error: "Indica si nos interesa que se vaya." };
    }
    const notas = (decision.notas ?? "").trim();
    if (notas.length < 10) {
      return {
        ok: false as const,
        error: "Cuenta en dos líneas qué ha pasado durante el preaviso.",
      };
    }

    const { data: cand } = await supabase
      .from("candidatos")
      .select("empleado_id, fase, estado")
      .eq("id", candidatoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!cand) return { ok: false as const, error: "Candidato no encontrado" };
    if (!cand.empleado_id) {
      return { ok: false as const, error: "SIN_EMPLEADO" };
    }

    // La solicitud de baja que el propio trabajador pidió y RRHH aprobó: de ahí
    // salen su último día y el motivo que él escribió.
    const { data: emp } = await supabase
      .from("empleados")
      .select("user_id")
      .eq("id", cand.empleado_id as string)
      .maybeSingle();
    const userId = (emp?.user_id as string | null) ?? null;
    if (!userId) return { ok: false as const, error: "SIN_SOLICITUD" };

    const { data: sol } = await supabase
      .from("solicitudes_personal")
      .select("id, fecha_fin, motivo")
      .eq("empresa_id", empresaId)
      .eq("user_id", userId)
      .eq("subtipo", "baja_contrato")
      .eq("estado", "aprobada")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ultimoDiaIso = (sol?.fecha_fin as string | null) ?? null;
    if (!sol || !ultimoDiaIso) return { ok: false as const, error: "SIN_SOLICITUD" };

    // 0) La decisión de RRHH queda registrada ANTES de tramitar nada: si la
    //    gestoría falla y hay que reintentar, lo que se decidió no se pierde.
    await guardarDecisionPreaviso(supabase, {
      candidatoId,
      empresaId,
      userId: user?.id ?? null,
      interesaQueSeVaya: decision.interesaQueSeVaya,
      notas,
      titulo: "Cierre del preaviso · se le da de baja",
    });

    // 1) Gestoría. Bloqueante si faltan datos: no dejamos la baja a medias.
    const { enviarBajaGestoria } = await import(
      "@/features/rrhh/actions/gestoria-actions"
    );
    const aviso = await enviarBajaGestoria(cand.empleado_id as string, {
      ultimoDiaIso,
      tipoBaja: "voluntaria",
      motivo: (sol.motivo as string | null) ?? null,
      origen: "mi_panel",
    });
    if (!aviso.ok && aviso.datosIncompletos) {
      return { ok: false as const, error: aviso.error ?? "Faltan datos para avisar a la gestoría." };
    }

    // 2) Horario: desde su último día deja de tener turnos asignados.
    try {
      const { recortarHorarioFuturoPorBaja } = await import(
        "@/features/rrhh/services/baja-horario"
      );
      await recortarHorarioFuturoPorBaja(supabase, {
        empleadoId: cand.empleado_id as string,
        empresaId,
        fechaBaja: ultimoDiaIso,
      });
    } catch (e) {
      console.error("[rrhh] tramitarBajaDesdePreaviso → recorte horario:", e);
    }

    // 3) La tarjeta avanza a «Baja contrato».
    const mov = await moverCandidatoFase(candidatoId, "offboarding", "baja_contrato");
    if (!mov.ok) {
      return {
        ok: false as const,
        error: ("error" in mov && mov.error) || "No se pudo mover a Baja contrato",
      };
    }

    revalidatePath("/rrhh/reclutamiento");
    revalidatePath("/rrhh/horarios");
    return {
      ok: true as const,
      gestoriaAvisada: aviso.ok,
      gestoriaDestino: aviso.ok ? aviso.destino ?? null : null,
      gestoriaError: aviso.ok ? null : (aviso.error ?? "No se pudo avisar a la gestoría"),
      ultimoDiaIso,
    };
  } catch (err: unknown) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/**
 * VUELTA AL EQUIPO: se negoció durante el preaviso y el trabajador se queda.
 *
 * Se dispara al mover su tarjeta de «Preaviso» a «Empleado». Como en el preaviso
 * no se le tocó nada (ni horario, ni gestoría, ni estado), no hay nada que
 * deshacer: sigue exactamente igual. Lo único que hay que cerrar es el papel.
 *
 *   1. Su solicitud de baja aprobada queda ANULADA. Si no, seguiría contando
 *      como una baja en curso: no podría volver a pedir otra, y al pasarlo un
 *      día a «Baja contrato» se tramitaría la vieja con su fecha antigua.
 *   2. Se le manda a firmar la ANULACIÓN DEL PREAVISO. Hasta que la firme no
 *      puede fichar: sin ese papel, la empresa tiene a alguien trabajando con
 *      una baja voluntaria suya en vigor.
 *   3. La tarjeta vuelve a «Empleado».
 */
export async function recuperarDePreaviso(
  candidatoId: string,
  decision: {
    /** true = nos conviene que se vaya (aunque al final se quede). */
    interesaQueSeVaya: boolean;
    /** Qué se negoció. Obligatorio, va a su ficha como nota. */
    notas: string;
  },
) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    if (typeof decision?.interesaQueSeVaya !== "boolean") {
      return { ok: false as const, error: "Indica si nos interesa que se vaya." };
    }
    const notas = (decision.notas ?? "").trim();
    if (notas.length < 10) {
      return {
        ok: false as const,
        error: "Cuenta en dos líneas qué se ha negociado con él.",
      };
    }

    const { data: cand } = await supabase
      .from("candidatos")
      .select("empleado_id")
      .eq("id", candidatoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!cand) return { ok: false as const, error: "Candidato no encontrado" };
    if (!cand.empleado_id) return { ok: false as const, error: "SIN_EMPLEADO" };

    await guardarDecisionPreaviso(supabase, {
      candidatoId,
      empresaId,
      userId: user?.id ?? null,
      interesaQueSeVaya: decision.interesaQueSeVaya,
      notas,
      titulo: "Cierre del preaviso · se queda en el equipo",
    });

    // Su solicitud de baja aprobada: la que hay que anular.
    const { data: emp } = await supabase
      .from("empleados")
      .select("user_id")
      .eq("id", cand.empleado_id as string)
      .maybeSingle();
    const userIdEmpleado = (emp?.user_id as string | null) ?? null;

    let bajaPrevistaIso: string | null = null;
    let fechaSolicitudIso: string | null = null;
    if (userIdEmpleado) {
      const { data: sol } = await supabase
        .from("solicitudes_personal")
        .select("id, fecha_inicio, fecha_fin")
        .eq("empresa_id", empresaId)
        .eq("user_id", userIdEmpleado)
        .eq("subtipo", "baja_contrato")
        .eq("estado", "aprobada")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sol?.id) {
        bajaPrevistaIso = (sol.fecha_fin as string | null) ?? null;
        fechaSolicitudIso = (sol.fecha_inicio as string | null) ?? null;
        const { error: anulErr } = await supabase
          .from("solicitudes_personal")
          .update({
            estado: "anulada",
            revisado_por: user?.id ?? null,
            revisado_at: new Date().toISOString(),
            notas_revision: `Preaviso anulado: continúa en la empresa. ${notas}`,
          })
          .eq("id", sol.id as string);
        if (anulErr) console.error("[rrhh] recuperarDePreaviso → anular solicitud:", anulErr.message);
      }
    }

    // Documento a firmar. Sin la fecha que figuraba en el preaviso no se puede
    // redactar (diría «tu baja del —»), así que en ese caso se avisa y no se
    // manda: la tarjeta vuelve igual, pero RRHH sabe que falta el papel.
    let firmaEnviada = false;
    let firmaError: string | null = null;
    if (bajaPrevistaIso) {
      try {
        const { data: quien } = user
          ? await supabase.from("usuarios").select("full_name").eq("user_id", user.id).maybeSingle()
          : { data: null };
        const { enviarAnulacionPreaviso } = await import(
          "@/features/rrhh/services/firmas/enviar-anulacion-preaviso"
        );
        const res = await enviarAnulacionPreaviso({
          empresaId,
          empleadoId: cand.empleado_id as string,
          bajaPrevistaIso,
          fechaSolicitudIso,
          enviadoPorUserId: user?.id ?? "",
          enviadoPorNombre: (quien?.full_name as string | null) ?? "Recursos Humanos",
        });
        firmaEnviada = res.ok;
        if (!res.ok) firmaError = res.error;
      } catch (e) {
        firmaError = e instanceof Error ? e.message : "No se pudo enviar el documento";
        console.error("[rrhh] recuperarDePreaviso → firma:", firmaError);
      }
    } else {
      firmaError = "No consta la fecha de su baja: no se ha podido generar la anulación.";
    }

    const mov = await moverCandidatoFase(candidatoId, "onboarding", "empleado");
    if (!mov.ok) {
      return {
        ok: false as const,
        error: ("error" in mov && mov.error) || "No se pudo devolverle a Empleado",
      };
    }

    revalidatePath("/rrhh/reclutamiento");
    return { ok: true as const, firmaEnviada, firmaError };
  } catch (err: unknown) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/**
 * BAJA DE CONTRATO iniciada POR LA EMPRESA (no por el trabajador). Se dispara
 * desde la ficha del empleado en el reclutamiento (botón «BAJA CONTRATO»). A
 * diferencia de la baja voluntaria (que solicita el propio empleado desde Mi
 * Panel → Solicitudes), aquí es RRHH quien la causa e indica el TIPO de baja
 * (disciplinaria, fin de contrato, etc.) y el último día de trabajo.
 *
 * Efectos: avisa a la gestoría con los datos del trabajador + tipo de baja +
 * último día + día oficial de la baja (último + 1), y mueve al candidato a la
 * fase de offboarding «Baja contrato». NO marca todavía al empleado como
 * Inactivo: eso ocurre al final del offboarding, al pasarlo a «Ex-empleados».
 */
export async function darBajaContratoEmpresa(
  candidatoId: string,
  input: {
    tipoBaja: TipoBajaContrato;
    ultimoDiaIso: string;
    motivo?: string | null;
    /**
     * Hechos que motivan la baja, redactados por RRHH (opcionalmente pulidos
     * con IA). Van en la carta que se comunica al trabajador.
     */
    hechos?: string | null;
  },
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    if (!input.ultimoDiaIso || !/^\d{4}-\d{2}-\d{2}$/.test(input.ultimoDiaIso)) {
      return { ok: false, error: "Indica el último día de trabajo." };
    }
    // La carta que recibe el trabajador NO puede salir sin la descripción de la
    // situación: sea cual sea el tipo de baja, es lo primero que se mira si esto
    // acaba discutiéndose, y una comunicación sin motivo se defiende sola... en
    // contra de la empresa.
    if ((input.hechos ?? "").trim().length < 15) {
      return {
        ok: false,
        error: "Describe la situación por la que se le da de baja: va en la carta que recibe.",
      };
    }

    const { data: cand } = await supabase
      .from("candidatos")
      .select("empleado_id, fase, estado")
      .eq("id", candidatoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!cand) return { ok: false, error: "Candidato no encontrado" };
    if (!cand.empleado_id) {
      return { ok: false, error: "Este candidato no es un empleado; no se le puede dar de baja." };
    }

    // 1) Aviso a la gestoría (datos del trabajador + fechas + tipo de baja).
    //    BLOQUEANTE: si faltan datos obligatorios del trabajador, la baja NO se
    //    tramita (no se mueve de fase). Como `enviarBajaGestoria` valida ANTES de
    //    provocar efectos, un fallo por datos incompletos aborta aquí sin dejar el
    //    proceso a medias. Un fallo de ENVÍO (SMTP) sí deja seguir (ver más abajo).
    const { enviarBajaGestoria } = await import(
      "@/features/rrhh/actions/gestoria-actions"
    );
    const avisoGestoria = await enviarBajaGestoria(cand.empleado_id as string, {
      ultimoDiaIso: input.ultimoDiaIso,
      tipoBaja: input.tipoBaja,
      // La causa la empresa: la voluntaria se etiqueta «Voluntaria forzosa».
      tipoBajaLabel: etiquetaTipoBajaEmpresa(input.tipoBaja),
      motivo: input.motivo ?? null,
      origen: "reclutamiento",
    });
    if (!avisoGestoria.ok && avisoGestoria.datosIncompletos) {
      // Datos incompletos → baja bloqueada. No se ha movido nada todavía.
      return { ok: false, error: avisoGestoria.error ?? "Faltan datos para avisar a la gestoría." };
    }

    // 2) Horario: desde su último día deja de tener turnos asignados, para que
    //    el cuadrante no siga contando con alguien que ya no viene. No bloquea la
    //    baja si falla: la comunicación a la gestoría ya salió.
    try {
      const { recortarHorarioFuturoPorBaja } = await import(
        "@/features/rrhh/services/baja-horario"
      );
      await recortarHorarioFuturoPorBaja(supabase, {
        empleadoId: cand.empleado_id as string,
        empresaId,
        fechaBaja: input.ultimoDiaIso,
      });
    } catch (e) {
      console.error("[rrhh] darBajaContratoEmpresa → recorte horario:", e);
    }

    // 3) Mueve el candidato a la fase de offboarding «Baja contrato». Reutiliza
    //    moverCandidatoFase para que registre la actividad igual que un arrastre.
    const mov = await moverCandidatoFase(candidatoId, "offboarding", "baja_contrato");
    if (!mov.ok) {
      return { ok: false, error: ("error" in mov && mov.error) || "No se pudo mover a Baja contrato" };
    }

    // 4) Carta de comunicación al TRABAJADOR, a firmar como acuse de recibo.
    //    NO BLOQUEANTE: la baja ya está tramitada. Si el trabajador no firma —o
    //    ni siquiera abre el enlace— la baja sigue siendo válida; lo que queda
    //    en el acta eIDAS es la constancia de si lo leyó y cuándo.
    let cartaEnviada = false;
    let cartaError: string | null = null;
    try {
      const { enviarCartaBajaEmpresa } = await import(
        "@/features/rrhh/services/firmas/enviar-baja-empresa"
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: quien } = user
        ? await supabase.from("usuarios").select("full_name").eq("user_id", user.id).maybeSingle()
        : { data: null };

      const carta = await enviarCartaBajaEmpresa({
        empresaId,
        empleadoId: cand.empleado_id as string,
        ultimoDiaIso: input.ultimoDiaIso,
        tipoBajaLabel: etiquetaTipoBajaEmpresa(input.tipoBaja),
        tipoBaja: input.tipoBaja,
        hechos: input.hechos?.trim() || null,
        enviadoPorUserId: user?.id ?? "",
        enviadoPorNombre: (quien?.full_name as string | null) ?? "Recursos Humanos",
      });
      cartaEnviada = carta.ok;
      if (!carta.ok) cartaError = carta.error;
    } catch (e) {
      cartaError = e instanceof Error ? e.message : "No se pudo enviar la carta";
      console.error("[rrhh] darBajaContratoEmpresa → carta:", cartaError);
    }

    revalidatePath("/rrhh/reclutamiento");
    revalidatePath("/rrhh/horarios");
    // Un fallo de ENVÍO (no de datos) no bloquea la baja: la baja se registró
    // igual y se informa para que RRHH pueda reenviarlo.
    return {
      ok: true as const,
      gestoriaAvisada: avisoGestoria.ok,
      gestoriaDestino: avisoGestoria.ok ? avisoGestoria.destino ?? null : null,
      gestoriaError: avisoGestoria.ok ? null : (avisoGestoria.error ?? "No se pudo avisar a la gestoría"),
      cartaEnviada,
      cartaError,
    };
  } catch (err: unknown) {
    return { ok: false, error: mensajeError(err) };
  }
}

