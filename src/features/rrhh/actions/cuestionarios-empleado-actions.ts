"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { sendEmail } from "@/lib/email/send";
import { cuestionarioRecordatorioEmail } from "@/lib/email/templates/cuestionario-recordatorio";
import type {
  BloqueCuestionario,
  PreguntaCuestionario,
} from "@/features/calidad/data/cuestionarios";

export interface CuestionarioEmpleadoItem {
  id: string;
  plantillaNombre: string;
  periodo: string;
  respondido: boolean;
  respondidoAt: string | null;
  puntuacion: number | null;
  notaSobre: number | null;
  aprobado: boolean | null;
  reunionEstado: "pendiente" | "realizada" | "cancelada" | "no_aplica";
}

export interface CuestionarioEmpleadoRespuesta {
  preguntaId: string;
  bloqueTitulo: string;
  enunciado: string;
  tipo: string;
  respuesta: string;
  correcta: boolean | null;
}

export interface CuestionarioEmpleadoDetalle extends CuestionarioEmpleadoItem {
  descripcion: string;
  respuestas: CuestionarioEmpleadoRespuesta[];
  reunionNotas: string | null;
  reunionFecha: string | null;
}

async function empleadoIdsEspejo(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empleadoId: string,
): Promise<string[] | null> {
  const { data: emp } = await supabase
    .from("empleados")
    .select("id, user_id")
    .eq("id", empleadoId)
    .maybeSingle();
  if (!emp) return null;
  let ids = [emp.id];
  if (emp.user_id) {
    const { data: espejos } = await supabase
      .from("empleados")
      .select("id")
      .eq("user_id", emp.user_id);
    const extra = (espejos ?? []).map((e) => e.id);
    if (extra.length > 0) ids = Array.from(new Set([emp.id, ...extra]));
  }
  return ids;
}

function rel<T>(r: unknown): T | null {
  if (Array.isArray(r)) return (r[0] as T) ?? null;
  return (r as T) ?? null;
}

/**
 * Lista los cuestionarios (envíos de campaña) de un empleado en modo SOLO
 * LECTURA, para verlos desde la ficha de RRHH sin acceder al módulo de
 * Calidad. Alcance por empresa vía RLS de `cuestionario_envios`.
 */
export async function listCuestionariosEmpleado(empleadoId: string) {
  try {
    const { supabase } = await getAppContext();
    const ids = await empleadoIdsEspejo(supabase, empleadoId);
    if (!ids) return { ok: false as const, error: "Empleado no encontrado" };

    const { data, error } = await supabase
      .from("cuestionario_envios")
      .select(
        "id, respondido_at, puntuacion, nota_sobre, aprobado, reunion_estado, campana:cuestionario_campanas(periodo, plantilla:cuestionario_plantillas(nombre))",
      )
      .in("empleado_id", ids)
      .order("respondido_at", { ascending: false, nullsFirst: false });
    if (error) throw error;

    const items: CuestionarioEmpleadoItem[] = (data ?? []).map((e) => {
      const campana = rel<{ periodo: string; plantilla?: unknown }>(e.campana);
      const plantilla = rel<{ nombre: string }>(campana?.plantilla);
      return {
        id: e.id,
        plantillaNombre: plantilla?.nombre ?? "(sin plantilla)",
        periodo: campana?.periodo ?? "—",
        respondido: !!e.respondido_at,
        respondidoAt: e.respondido_at ?? null,
        puntuacion: e.puntuacion != null ? Number(e.puntuacion) : null,
        notaSobre: e.nota_sobre != null ? Number(e.nota_sobre) : null,
        aprobado: e.aprobado,
        reunionEstado: e.reunion_estado,
      };
    });

    return { ok: true as const, data: items };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error cargando cuestionarios";
    console.error("[rrhh] listCuestionariosEmpleado:", msg);
    return { ok: false as const, error: msg };
  }
}

function resolverRespuesta(
  pregunta: PreguntaCuestionario,
  valor: string | string[] | undefined,
): { texto: string; correcta: boolean | null } {
  if (valor == null) return { texto: "—", correcta: null };

  if (pregunta.tipo === "texto") {
    const t = Array.isArray(valor) ? valor.join(", ") : valor;
    return { texto: t.trim() || "—", correcta: null };
  }

  const seleccion = Array.isArray(valor) ? valor : [valor];
  const opciones = pregunta.opciones.filter((o) => seleccion.includes(o.id));
  const textos = opciones.map((o) => o.texto);
  // Correcto si las opciones elegidas coinciden exactamente con las correctas.
  const correctasIds = pregunta.opciones.filter((o) => o.correcta).map((o) => o.id);
  const tieneCorrectas = correctasIds.length > 0;
  const correcta = tieneCorrectas
    ? seleccion.length === correctasIds.length &&
      seleccion.every((s) => correctasIds.includes(s))
    : null;

  return {
    texto: textos.length > 0 ? textos.join(", ") : "—",
    correcta,
  };
}

/**
 * Detalle SOLO LECTURA de un envío de cuestionario: respuestas del empleado
 * mapeadas contra las preguntas de la plantilla. Sin acciones de edición.
 */
export async function getCuestionarioEnvioEmpleadoDetalle(envioId: string) {
  try {
    const { supabase } = await getAppContext();

    const { data: envio, error } = await supabase
      .from("cuestionario_envios")
      .select(
        "id, respuestas, respondido_at, puntuacion, nota_sobre, aprobado, reunion_estado, reunion_notas, reunion_fecha, campana:cuestionario_campanas(periodo, plantilla:cuestionario_plantillas(nombre, descripcion, bloques))",
      )
      .eq("id", envioId)
      .maybeSingle();
    if (error) throw error;
    if (!envio) return { ok: false as const, error: "Cuestionario no encontrado" };

    const campana = rel<{
      periodo: string;
      plantilla?: unknown;
    }>(envio.campana);
    const plantilla = rel<{
      nombre: string;
      descripcion: string | null;
      bloques: BloqueCuestionario[];
    }>(campana?.plantilla);

    const respuestasMap = (envio.respuestas ?? {}) as Record<string, string | string[]>;
    const bloques = plantilla?.bloques ?? [];

    const respuestas: CuestionarioEmpleadoRespuesta[] = [];
    for (const bloque of bloques) {
      for (const pregunta of bloque.preguntas) {
        const { texto, correcta } = resolverRespuesta(pregunta, respuestasMap[pregunta.id]);
        respuestas.push({
          preguntaId: pregunta.id,
          bloqueTitulo: bloque.titulo,
          enunciado: pregunta.titulo,
          tipo: pregunta.tipo,
          respuesta: texto,
          correcta,
        });
      }
    }

    const detalle: CuestionarioEmpleadoDetalle = {
      id: envio.id,
      plantillaNombre: plantilla?.nombre ?? "(sin plantilla)",
      descripcion: plantilla?.descripcion ?? "",
      periodo: campana?.periodo ?? "—",
      respondido: !!envio.respondido_at,
      respondidoAt: envio.respondido_at ?? null,
      puntuacion: envio.puntuacion != null ? Number(envio.puntuacion) : null,
      notaSobre: envio.nota_sobre != null ? Number(envio.nota_sobre) : null,
      aprobado: envio.aprobado,
      reunionEstado: envio.reunion_estado,
      reunionNotas: envio.reunion_notas ?? null,
      reunionFecha: envio.reunion_fecha ?? null,
      respuestas,
    };

    return { ok: true as const, data: detalle };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error cargando el cuestionario";
    console.error("[rrhh] getCuestionarioEnvioEmpleadoDetalle:", msg);
    return { ok: false as const, error: msg };
  }
}

/**
 * Envía un recordatorio por email al empleado para que rellene un cuestionario
 * que tiene PENDIENTE. Acción manual bajo demanda; solo se permite mientras el
 * envío sigue sin rellenar (`respondido_at` nulo). No reabre ni edita nada: si
 * el cuestionario ya está respondido, se rechaza. No persiste estado en BD.
 */
export async function enviarRecordatorioCuestionario(envioId: string) {
  try {
    const { supabase } = await getAppContext();

    const { data: envio, error } = await supabase
      .from("cuestionario_envios")
      .select(
        "id, respondido_at, empresa_id, empleado:empleados(nombre, apellidos, email_empresa, email_personal), campana:cuestionario_campanas(plantilla:cuestionario_plantillas(nombre)), empresa:empresas(nombre)",
      )
      .eq("id", envioId)
      .maybeSingle();
    if (error) throw error;
    if (!envio) return { ok: false as const, error: "Cuestionario no encontrado" };
    if (envio.respondido_at) {
      return {
        ok: false as const,
        error: "El cuestionario ya está rellenado: no se puede recordar.",
      };
    }

    const empleado = rel<{
      nombre: string;
      apellidos: string | null;
      email_empresa: string | null;
      email_personal: string | null;
    }>(envio.empleado);
    const email = empleado?.email_empresa || empleado?.email_personal || null;
    if (!email) {
      return {
        ok: false as const,
        error: "El empleado no tiene email para enviarle el recordatorio.",
      };
    }

    const campana = rel<{ plantilla?: unknown }>(envio.campana);
    const plantilla = rel<{ nombre: string }>(campana?.plantilla);
    const empresa = rel<{ nombre: string }>(envio.empresa);

    const siteUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : null) ??
      "http://localhost:3000";
    const actionUrl = `${siteUrl.replace(/\/$/, "")}/mi-panel/cuestionarios`;

    const nombre = `${empleado?.nombre ?? ""}${empleado?.apellidos ? " " + empleado.apellidos : ""}`.trim() || "compañero/a";

    const { subject, html, text } = cuestionarioRecordatorioEmail({
      recipientName: nombre,
      cuestionarioNombre: plantilla?.nombre ?? "cuestionario",
      actionUrl,
      empresaNombre: empresa?.nombre ?? "tu empresa",
    });

    const res = await sendEmail({
      to: email,
      subject,
      html,
      text,
      // Correo interno a empleado → no-reply: no se responde al software.
    });

    if (!res.ok) {
      const motivo = !res.configured
        ? "El envío de correos no está configurado."
        : res.error;
      return { ok: false as const, error: motivo };
    }

    return { ok: true as const, email };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error enviando el recordatorio";
    console.error("[rrhh] enviarRecordatorioCuestionario:", msg);
    return { ok: false as const, error: msg };
  }
}
