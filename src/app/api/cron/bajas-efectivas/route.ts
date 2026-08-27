/**
 * Cron endpoint: aplica las BAJAS DE CONTRATO cuando llega su fecha.
 *
 * El problema que resuelve: tramitar una baja (avisar a la gestoría, recortar
 * horarios, firmar la carta) NO desactivaba al trabajador. Eso solo ocurría
 * cuando alguien arrastraba a mano su tarjeta a «Ex-empleados» en el Kanban.
 * Si nadie lo hacía, el trabajador conservaba acceso completo a la app
 * indefinidamente, aunque su último día hubiera pasado meses atrás.
 *
 * Cómo funciona: cada día busca las bajas comunicadas a la gestoría
 * (`gestoria_bajas.ultimo_dia`) cuyo día oficial —el siguiente al último
 * trabajado— ya ha llegado, y mueve la tarjeta a «Ex-empleados». Ese movimiento
 * es el que marca `empleados.estado = 'Inactivo'`, y el trigger de BD propaga a
 * `usuarios.estado_acceso`, que el proxy consulta en cada petición para cortar
 * la sesión.
 *
 * A LAS 6:00 DE LA MAÑANA, hora de cada empresa (no UTC): un turno de noche
 * puede empezar el último día y terminar de madrugada del siguiente. Cortando a
 * medianoche se le quitaría el acceso a mitad del turno, sin poder fichar la
 * salida. A las 6:00 el turno ya cerró.
 *
 * Corre a las 05:00 UTC y cada empresa se procesa solo si en SU hora local son
 * las 6:00 o más (y aún no es mediodía, para no repetir con otra ejecución).
 * Idempotente: quien ya está en «Ex-empleados» se ignora.
 *
 * Solo acepta llamadas con header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Hora local de la empresa a partir de la cual se aplican las bajas. */
const HORA_CORTE_MIN = 6 * 60;
/** Tope para no re-ejecutar en la misma jornada si el cron corre dos veces. */
const HORA_TOPE_MIN = 12 * 60;

/** Día siguiente a un ISO YYYY-MM-DD. */
function diaSiguiente(iso: string): string {
  const t = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return iso;
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/bajas-efectivas] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: empresas, error: empErr } = await supabase.from("empresas").select("id");
  if (empErr) {
    console.error("[cron/bajas-efectivas]", empErr.message);
    return NextResponse.json({ ok: false, error: empErr.message }, { status: 500 });
  }

  let desactivados = 0;
  let omitidasPorHora = 0;
  const detalle: { empleadoId: string; empresaId: string; ultimoDia: string; via: string }[] = [];
  const incidencias: { empleadoId: string; empresaId: string; motivo: string }[] = [];

  for (const e of empresas ?? []) {
    const empresaId = e.id as string;
    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    const { fecha: hoyLocal, minutos } = ahoraEnZona(tz);

    // Antes de las 6:00 locales no se toca a nadie: puede haber un turno de
    // noche del último día todavía abierto.
    if (minutos < HORA_CORTE_MIN || minutos >= HORA_TOPE_MIN) {
      omitidasPorHora++;
      continue;
    }

    // Bajas comunicadas cuyo ÚLTIMO DÍA ya pasó (el día oficial es el siguiente,
    // así que `ultimo_dia < hoy` equivale a «el día oficial ya llegó»).
    const { data: bajas, error } = await supabase
      .from("gestoria_bajas")
      .select("empleado_id, ultimo_dia")
      .eq("empresa_id", empresaId)
      .lt("ultimo_dia", hoyLocal)
      .order("ultimo_dia", { ascending: true });
    if (error) {
      console.error("[cron/bajas-efectivas]", empresaId, error.message);
      continue;
    }

    // Un mismo trabajador puede tener varias filas (rectificaciones): nos vale
    // con procesarlo una vez.
    const vistos = new Set<string>();

    for (const b of bajas ?? []) {
      const empleadoId = b.empleado_id as string | null;
      const ultimoDia = b.ultimo_dia as string;
      if (!empleadoId || vistos.has(empleadoId)) continue;
      vistos.add(empleadoId);

      // ¿Sigue activo? Si ya está Inactivo no hay nada que hacer (idempotencia).
      const { data: emp } = await supabase
        .from("empleados")
        .select("id, estado")
        .eq("id", empleadoId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (!emp || emp.estado !== "Activo") continue;

      // El Kanban debe quedar coherente: si el trabajador tiene tarjeta, pasa a
      // «Ex-empleados». Se escribe directamente y no con `moverCandidatoFase`
      // porque esa action resuelve la empresa desde la SESIÓN del usuario, y en
      // un cron no hay sesión: devolvería «No autenticado» siempre.
      const { data: cand } = await supabase
        .from("candidatos")
        .select("id, estado")
        .eq("empresa_id", empresaId)
        .eq("empleado_id", empleadoId)
        .maybeSingle();

      let viaKanban = false;
      if (cand?.id && cand.estado !== "ex_empleado") {
        const { error: candErr } = await supabase
          .from("candidatos")
          .update({
            fase: "descartado",
            estado: "ex_empleado",
            fase_actualizada_at: new Date().toISOString(),
          })
          .eq("id", cand.id as string)
          .eq("empresa_id", empresaId);
        if (candErr) {
          console.error(
            "[cron/bajas-efectivas] mover a ex_empleado falló:",
            empleadoId,
            candErr.message,
          );
        } else {
          viaKanban = true;
        }
      }

      // RED DE SEGURIDAD: sin tarjeta (o si el movimiento falló) se desactiva
      // igualmente. Nadie puede quedarse con acceso solo por no tener ficha en
      // el Kanban — que es justo el fallo que este cron viene a cerrar.
      //
      // Se escribe con el cliente ADMIN, no con `setEmpleadoEstado`: esa action
      // resuelve el contexto desde la SESIÓN del usuario, y en un cron no hay
      // sesión, así que la RLS bloqueaba el UPDATE sin devolver error — el cron
      // informaba de bajas aplicadas que en realidad nunca se escribieron.
      // La fecha de baja es la PACTADA (día oficial = último + 1), no la del día
      // en que corre el cron, para que el histórico cuadre con la gestoría.
      const fechaBajaOficial = diaSiguiente(ultimoDia);
      const { error: upErr } = await supabase
        .from("empleados")
        .update({ estado: "Inactivo", fecha_baja: fechaBajaOficial })
        .eq("id", empleadoId)
        .eq("empresa_id", empresaId);

      if (upErr) {
        incidencias.push({ empleadoId, empresaId, motivo: upErr.message });
        console.error("[cron/bajas-efectivas] desactivar falló:", empleadoId, upErr.message);
        continue;
      }

      // Rastro del movimiento, igual que una baja hecha a mano desde la ficha.
      const { error: histErr } = await supabase.from("empleado_estado_historial").insert({
        empresa_id: empresaId,
        empleado_id: empleadoId,
        accion: "Baja",
        estado_anterior: "Activo",
        estado_nuevo: "Inactivo",
        fecha_efectiva: fechaBajaOficial,
        motivo: "Baja efectiva aplicada automáticamente al llegar su fecha.",
        origen: "cron",
      });
      if (histErr) {
        console.error("[cron/bajas-efectivas] historial:", empleadoId, histErr.message);
      }

      // Recorte de turnos futuros, como en cualquier otra baja.
      try {
        const { recortarHorarioFuturoPorBaja } = await import(
          "@/features/rrhh/services/baja-horario"
        );
        await recortarHorarioFuturoPorBaja(supabase, {
          empleadoId,
          empresaId,
          fechaBaja: fechaBajaOficial,
        });
      } catch (e) {
        console.error(
          "[cron/bajas-efectivas] recorte horario:",
          empleadoId,
          e instanceof Error ? e.message : e,
        );
      }

      desactivados++;
      detalle.push({
        empleadoId,
        empresaId,
        ultimoDia,
        via: viaKanban ? "kanban+estado" : "directo",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    empresas: empresas?.length ?? 0,
    omitidasPorHora,
    desactivados,
    detalle,
    incidencias,
  });
}
