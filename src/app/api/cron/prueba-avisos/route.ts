import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Aviso automático a RRHH durante el periodo de prueba (PRP-070).
 *
 * Los días se cuentan desde el PRIMER DÍA DE CONTRATO: la `fecha_inicio` del
 * periodo abierto en `empleado_periodo_prueba` manda, y solo si no hay periodo
 * se recurre a `fase_actualizada_at` del candidato.
 *
 * Para cada candidato en estado `prueba` emite, según `prueba_aviso_canal`
 * (notificación in-app y/o email):
 *
 *  - Un RECORDATORIO cada `prueba_aviso_dias` días (7 por defecto → días 7, 14,
 *    21 y 28 de un periodo de 30), con días transcurridos y restantes.
 *  - Una ÚLTIMA LLAMADA la víspera del fin (día 29 de 30): es el último día para
 *    desistir del periodo de prueba antes de que el contrato se consolide.
 *
 * El día del fin no se avisa aquí; lo cubre `prueba_cierre` en
 * `avisarHitosYCierre`, para no solapar dos correos casi iguales.
 *
 * Idempotente: la `dedupeKey` incluye el hito, así que cada aviso se emite una
 * sola vez aunque el cron corra varias veces el mismo día.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Config por empresa (solo las que tienen el aviso activo).
  const { data: cfgs } = await admin
    .from("reclutamiento_config")
    .select("empresa_id, prueba_duracion_dias, prueba_aviso_dias, prueba_aviso_canal, prueba_aviso_activo");

  const porEmpresa = new Map<
    string,
    { duracion: number; avisoDias: number; canal: string }
  >();
  for (const c of cfgs ?? []) {
    if (c.prueba_aviso_activo === false) continue;
    porEmpresa.set(c.empresa_id as string, {
      duracion: (c.prueba_duracion_dias as number) ?? 30,
      avisoDias: (c.prueba_aviso_dias as number) ?? 7,
      canal: (c.prueba_aviso_canal as string) ?? "ambos",
    });
  }
  if (porEmpresa.size === 0) {
    return NextResponse.json({ ok: true, ejecutadoEn: new Date().toISOString(), avisos: 0 });
  }

  // Candidatos actualmente en periodo de prueba.
  const { data: enPrueba } = await admin
    .from("candidatos")
    .select("id, empresa_id, nombre, apellidos, empleado_id, fase_actualizada_at")
    .eq("estado", "prueba");

  // El periodo de prueba REAL manda: su `fecha_inicio` es el primer día de
  // contrato, que es desde donde se cuentan los días. `fase_actualizada_at`
  // (cuándo se movió la ficha de fase) solo se usa si no hay periodo abierto,
  // porque puede ser muy posterior al alta y falsearía la cuenta.
  const idsCand = (enPrueba ?? []).map((c) => c.id as string);
  const inicioPorCandidato = new Map<string, { inicio: string; duracion: number }>();
  if (idsCand.length > 0) {
    const { data: periodos } = await admin
      .from("empleado_periodo_prueba")
      .select("candidato_id, fecha_inicio, duracion_dias")
      .eq("decision", "pendiente")
      .in("candidato_id", idsCand);
    for (const p of (periodos ?? []) as Array<{
      candidato_id: string | null;
      fecha_inicio: string;
      duracion_dias: number | null;
    }>) {
      if (!p.candidato_id) continue;
      inicioPorCandidato.set(p.candidato_id, {
        inicio: p.fecha_inicio,
        duracion: Number(p.duracion_dias ?? 0),
      });
    }
  }

  const ahora = Date.now();
  let avisos = 0;

  for (const cand of enPrueba ?? []) {
    const empresaId = cand.empresa_id as string;
    const cfg = porEmpresa.get(empresaId);
    if (!cfg) continue;

    // Fecha de contrato del periodo abierto; si no lo hay, el cambio de fase.
    const periodo = inicioPorCandidato.get(cand.id as string);
    const inicioIso = periodo?.inicio ?? (cand.fase_actualizada_at as string | null);
    if (!inicioIso) continue;
    // Las fechas del periodo son DATE (sin hora): se anclan a mediodía para que
    // el cálculo de días no baile por zona horaria ni por el cambio de hora.
    const inicio = new Date(
      inicioIso.length === 10 ? `${inicioIso}T12:00:00Z` : inicioIso,
    ).getTime();
    // La duración del periodo abierto prevalece sobre la config actual: si
    // alguien cambia el ajuste a mitad, el trabajador conserva la suya.
    const duracion = periodo?.duracion && periodo.duracion > 0 ? periodo.duracion : cfg.duracion;
    const diasTranscurridos = Math.floor((ahora - inicio) / 86_400_000);
    // Dos avisos distintos salen de aquí:
    //
    //  1. RECORDATORIO periódico, cada `avisoDias` días (con umbral 7 y periodo
    //     de 30 → días 7, 14, 21 y 28). No se emite en el último día ni después:
    //     el cierre lo cubre `prueba_cierre` y no queremos correos solapados.
    //  2. ÚLTIMA LLAMADA, la víspera del fin (día 29 de 30). Es el último día
    //     hábil para desistir del periodo de prueba: si se deja pasar, el
    //     contrato queda consolidado. Por eso va aparte del recordatorio.
    //
    // La víspera manda: si un hito cayera ese mismo día, se emite solo la
    // última llamada, que es la que exige acción inmediata.
    //
    // El hito NO se compara con el día exacto de hoy sino con el último múltiplo
    // ya vencido: si el cron no corrió el día justo (caída, deploy, timeout), el
    // aviso se recupera al día siguiente en vez de perderse para siempre. La
    // `dedupeKey` lleva ese número de hito, así que sigue emitiéndose una sola
    // vez y no se reenvía en los días intermedios.
    const esUltimaLlamada = diasTranscurridos === duracion - 1;
    const hitoVencido =
      diasTranscurridos > 0
        ? Math.min(
            Math.floor(diasTranscurridos / cfg.avisoDias) * cfg.avisoDias,
            // Nunca un hito que pise la víspera ni el cierre.
            Math.floor((duracion - 2) / cfg.avisoDias) * cfg.avisoDias,
          )
        : 0;
    const esHito = !esUltimaLlamada && hitoVencido > 0 && diasTranscurridos < duracion - 1;
    if (!esUltimaLlamada && !esHito) continue;

    // Los textos del recordatorio hablan del hito alcanzado, no del día suelto
    // en que el cron logró emitirlo (que puede ser uno o dos días más tarde).
    const diasHito = esUltimaLlamada ? diasTranscurridos : hitoVencido;
    const diasRestantes = Math.max(0, duracion - diasHito);
    const nombre = `${cand.nombre ?? ""} ${cand.apellidos ?? ""}`.trim() || "El trabajador";
    const fechaInicio = new Date(inicio).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric" });
    const fechaFin = new Date(inicio + duracion * 86_400_000).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric" });
    // Una sola alerta por candidato, periodo y HITO: los días transcurridos
    // entran en la clave para que el aviso del día 14 no se descarte como
    // duplicado del día 7, y a la vez el cron pueda correr varias veces el
    // mismo día sin repetir el mismo hito.
    const dedupeKey = esUltimaLlamada
      ? `prueba_ultima_llamada:${cand.id}:${inicioIso.slice(0, 10)}`
      : `prueba_aviso:${cand.id}:${inicioIso.slice(0, 10)}:${diasHito}`;

    const titulo = esUltimaLlamada
      ? `Último día para desistir: ${nombre}`
      : `Periodo de prueba: ${nombre} (${diasHito} días)`;

    const mensaje = esUltimaLlamada
      ? `Hoy es el ÚLTIMO día para dar de baja a ${nombre} dentro del periodo de prueba, ` +
        `que termina mañana ${fechaFin} (${duracion} días desde el ${fechaInicio}). ` +
        `Si no se comunica el desistimiento hoy, el contrato queda consolidado. ` +
        `Decide su continuidad desde su ficha.`
      : `${nombre} lleva ${diasHito} días en periodo de prueba. ` +
        `Le quedan ${diasRestantes} días para finalizar el periodo configurado (${duracion} días, ` +
        `inicio ${fechaInicio}, fin previsto ${fechaFin}). Revisa su evolución antes de confirmar su continuidad.`;

    const canal = cfg.canal;

    // La notificación in-app es también el REGISTRO del hito: su `dedupe_key`
    // tiene índice único, así que `creadas > 0` solo la primera vez que se emite
    // este hito. El email se cuelga de ese resultado para no reenviarse a diario
    // (antes se mandaba sin comprobar nada, y de ahí el correo repetido).
    // Se emite siempre, incluso con canal "email": ahí no se notifica a nadie
    // (`push: false` y sin destinatarios visibles no aplica), pero deja la marca
    // que hace idempotente al correo.
    let primeraVez = false;
    try {
      const res = await emitirNotificacion({
        empresaId,
        system: true,
        tipo: esUltimaLlamada ? "prueba_ultima_llamada" : "prueba_aviso",
        titulo,
        mensaje,
        segmento: { tipo: "area", area: "ADMINISTRATIVA" },
        refTabla: cand.empleado_id ? "empleados" : "candidatos",
        refId: (cand.empleado_id as string | null) ?? (cand.id as string),
        accionUrl: "/rrhh/reclutamiento",
        dedupeKey,
        // Con canal "email" el aviso viaja por correo: no se duplica en el móvil.
        push: canal !== "email",
      });
      primeraVez = res.creadas > 0;
      if (primeraVez && canal !== "email") avisos++;
    } catch (e) {
      console.error("[cron/prueba-avisos] notificacion:", e);
    }

    // Hito ya avisado en una ejecución anterior: nada que reenviar.
    if (!primeraVez) continue;

    // Email a RRHH (canal "email" o "ambos").
    if (canal === "email" || canal === "ambos") {
      const { data: empresa } = await admin
        .from("empresas")
        .select("nombre, email_contacto, datos_generales")
        .eq("id", empresaId)
        .maybeSingle();
      const dg = (empresa?.datos_generales as Record<string, unknown> | null) ?? {};
      const correoRrhh =
        (typeof dg.correoRrhh === "string" ? dg.correoRrhh : "") ||
        ((empresa?.email_contacto as string | null) ?? "");
      const empresaNombre = (empresa?.nombre as string) ?? "la empresa";

      {
        // Plantilla editable del aviso de prueba (UI «Plantillas de email»).
        const { resolverPlantillaOnboarding, resolverDestinatario, cuerpoOnboardingAHtml, PLANTILLAS_ONBOARDING } =
          await import("@/features/rrhh/services/email-plantillas/resolver");
        const vars: Record<string, string> = {
          candidato_nombre_completo: nombre,
          empresa_nombre: empresaNombre,
          prueba_dias_transcurridos: String(diasHito),
          prueba_dias_restantes: String(diasRestantes),
          prueba_duracion_dias: String(duracion),
          prueba_fecha_inicio: fechaInicio,
          prueba_fecha_fin: fechaFin,
        };
        const tpl = await resolverPlantillaOnboarding(
          admin,
          empresaId,
          PLANTILLAS_ONBOARDING.pruebaAviso,
          vars,
        );

        // Destinatario configurable (por defecto: RRHH). Sin plantilla, a RRHH.
        const dst = tpl
          ? await resolverDestinatario(admin, empresaId, tpl.destino, tpl.destinoEmail, null)
          : { to: correoRrhh, cc: null };
        const to = dst.to || correoRrhh;
        if (!to) continue;

        let subject: string;
        let html: string;
        let text: string;
        if (esUltimaLlamada) {
          // La última llamada NO usa la plantilla editable del recordatorio: su
          // texto es otro (urgencia y consecuencia legal) y no debe poder
          // suavizarse sin querer editando la plantilla del aviso periódico.
          subject = `Último día para desistir del periodo de prueba de ${nombre} · ${empresaNombre}`;
          html = `
          <p>${mensaje}</p>
          <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
          text = mensaje;
        } else if (tpl) {
          subject = tpl.asunto;
          html = cuerpoOnboardingAHtml(tpl.cuerpo);
          text = tpl.cuerpo;
        } else {
          subject = `Periodo de prueba de ${nombre}: revisa su evolución · ${empresaNombre}`;
          html = `
          <p>${mensaje}</p>
          <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
          text = mensaje;
        }
        const res = await sendEmail({ to, subject, html, text, empresaId });
        if (res.ok && canal === "email") avisos++;
      }
    }
  }

  // ─── Validaciones vencidas y cierre del periodo ─────────────
  // Además del aviso general de arriba, RRHH recibe un recordatorio por cada
  // validación que llega a su fecha sin estar puntuada, y otro cuando el
  // periodo termina y hay que decidir la continuidad. Cada uno con su propia
  // dedupeKey, así que se emite una sola vez por hito.
  const avisosHitos = await avisarHitosYCierre(admin);

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    avisos,
    avisosHitos,
  });
}

/** Fecha de calendario YYYY-MM-DD → DD/MM/AAAA. */
function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

interface FilaAviso {
  id: string;
  empresa_id: string;
  empleado_id: string | null;
  candidato_id: string | null;
  fecha_fin: string;
  nota_final: number | null;
  nota_corte: number;
  empleados?: { nombre: string | null; apellidos: string | null } | null;
  candidatos?: { nombre: string | null; apellidos: string | null } | null;
}

function nombreDe(p: FilaAviso): string {
  const emp = `${p.empleados?.nombre ?? ""} ${p.empleados?.apellidos ?? ""}`.trim();
  if (emp) return emp;
  const cand = `${p.candidatos?.nombre ?? ""} ${p.candidatos?.apellidos ?? ""}`.trim();
  return cand || "El trabajador";
}

async function avisarHitosYCierre(
  admin: ReturnType<typeof createAdminClient>,
): Promise<number> {
  // Fecha de HOY en Madrid, no en UTC: las fechas del periodo son días de
  // calendario español y `toISOString()` daría el día equivocado si el cron se
  // adelantara a la medianoche local.
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  let emitidos = 0;

  const { data: periodos } = await admin
    .from("empleado_periodo_prueba")
    .select(
      `id, empresa_id, empleado_id, candidato_id, fecha_fin, nota_final, nota_corte,
       empleados ( nombre, apellidos ),
       candidatos ( nombre, apellidos )`,
    )
    .eq("decision", "pendiente");

  for (const raw of (periodos ?? []) as unknown as FilaAviso[]) {
    const nombre = nombreDe(raw);
    const refTabla = raw.empleado_id ? "empleados" : "candidatos";
    const refId = raw.empleado_id ?? raw.candidato_id;
    if (!refId) continue;

    // 1. Validaciones que ya tocaban y siguen sin nota.
    const { data: hitos } = await admin
      .from("empleado_prueba_evaluaciones")
      .select("id, numero, fecha_prevista")
      .eq("periodo_id", raw.id)
      .eq("estado", "pendiente")
      .lte("fecha_prevista", hoy);

    for (const h of (hitos ?? []) as Array<{
      id: string;
      numero: number;
      fecha_prevista: string;
    }>) {
      try {
        await emitirNotificacion({
          empresaId: raw.empresa_id,
          system: true,
          tipo: "prueba_evaluacion",
          titulo: `Validación ${h.numero} pendiente: ${nombre}`,
          mensaje:
            `Toca validar a ${nombre} (validación ${h.numero}, prevista el ` +
            `${fechaCorta(h.fecha_prevista)}) y aún no tiene nota. ` +
            `Puntúala del 0 al 10 en su ficha para poder decidir su continuidad.`,
          segmento: { tipo: "area", area: "ADMINISTRATIVA" },
          refTabla,
          refId,
          accionUrl: "/rrhh/reclutamiento",
          dedupeKey: `prueba_hito:${h.id}`,
        });
        emitidos++;
      } catch (e) {
        console.error("[cron/prueba-avisos] hito:", e);
      }
    }

    // 2. Periodo terminado: hay que decidir.
    if (raw.fecha_fin <= hoy) {
      const nota = raw.nota_final === null ? null : Number(raw.nota_final);
      const corte = Number(raw.nota_corte);
      const veredicto =
        nota === null
          ? "todavía sin validaciones puntuadas"
          : nota >= corte
            ? `nota ${nota.toFixed(1).replace(".", ",")} sobre un corte de ${corte
                .toFixed(1)
                .replace(".", ",")} (apto)`
            : `nota ${nota.toFixed(1).replace(".", ",")} sobre un corte de ${corte
                .toFixed(1)
                .replace(".", ",")} (no apto)`;
      try {
        await emitirNotificacion({
          empresaId: raw.empresa_id,
          system: true,
          tipo: "prueba_cierre",
          titulo: `Periodo de prueba finalizado: ${nombre}`,
          mensaje:
            `El periodo de prueba de ${nombre} terminó el ${fechaCorta(raw.fecha_fin)} ` +
            `con ${veredicto}. Decide si continúa en la empresa desde su ficha.`,
          segmento: { tipo: "area", area: "ADMINISTRATIVA" },
          refTabla,
          refId,
          accionUrl: "/rrhh/reclutamiento",
          dedupeKey: `prueba_cierre:${raw.id}`,
        });
        emitidos++;
      } catch (e) {
        console.error("[cron/prueba-avisos] cierre:", e);
      }
    }
  }

  return emitidos;
}
