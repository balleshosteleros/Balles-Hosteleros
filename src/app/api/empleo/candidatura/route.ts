import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import crypto from "node:crypto";
import { normalizarNombre } from "@/shared/lib/normalizar-nombre";
import { ensureWebLink } from "@/features/rrhh/lib/empleo-web-link";
import {
  calcularNotaCuestionario,
  type PreguntaCuestionario,
  type RespuestasCuestionario,
} from "@/features/rrhh/data/cuestionario-vacante";
import {
  normalizarCamposFormulario,
  type CampoCandidaturaClave,
} from "@/features/rrhh/data/campos-candidatura";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CV_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MIN = 15;
const RATE_LIMIT_MAX = 5;

const CandidaturaSchema = z.object({
  empresa_slug: z.string().min(1).max(80),
  empresa_id: z.string().guid(),
  oferta_id: z.string().guid(),
  // Campos FIJOS (siempre obligatorios): nombre, apellidos, email, teléfono.
  nombre: z.string().min(1).max(80),
  apellidos: z.string().min(1).max(120),
  email: z.string().email().max(180),
  telefono: z.string().min(5).max(30),
  // Campos CONFIGURABLES — opcionales a nivel de esquema (aceptan ""); su
  // obligatoriedad real se decide contra `campos_formulario` más abajo. Los que
  // tienen dominio cerrado aceptan "" o uno de sus valores.
  genero: z.enum(["masculino", "femenino"]).or(z.literal("")).optional().default(""),
  ubicacion: z.string().max(160).optional().default(""),
  disponibilidad: z.enum(["inmediato", "15_dias"]).or(z.literal("")).optional().default(""),
  experiencia_previa: z.enum(["sin_experiencia", "menos_1", "de_1_a_5", "mas_5"]).or(z.literal("")).optional().default(""),
  // «¿Por dónde nos has conocido?» — nombre del catálogo reclutamiento_origenes.
  como_nos_conocio: z.string().max(160).optional().default(""),
  carta_presentacion: z.string().max(5000).optional().default(""),
});

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function ipHash(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

async function checkRateLimit(supabase: ReturnType<typeof service>, ip: string, empresaId: string) {
  const windowAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();

  const { data: existing } = await supabase
    .from("candidaturas_rate_limit")
    .select("count, window_start")
    .eq("ip_hash", ip)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("candidaturas_rate_limit").insert({
      ip_hash: ip,
      empresa_id: empresaId,
      count: 1,
    });
    return { allowed: true };
  }

  if (existing.window_start < windowAgo) {
    await supabase
      .from("candidaturas_rate_limit")
      .update({ count: 1, window_start: new Date().toISOString() })
      .eq("ip_hash", ip)
      .eq("empresa_id", empresaId);
    return { allowed: true };
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return { allowed: false };
  }

  await supabase
    .from("candidaturas_rate_limit")
    .update({ count: existing.count + 1 })
    .eq("ip_hash", ip)
    .eq("empresa_id", empresaId);
  return { allowed: true };
}

async function verifyTurnstile(token: string | null): Promise<boolean> {
  // Si no hay TURNSTILE_SECRET configurado, captcha es opcional (dev/preview).
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json() as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const captchaToken = (fd.get("captcha_token") as string | null) ?? null;
    const canalCodigo = String(fd.get("canal_codigo") ?? "").trim().toUpperCase();
    const cv = fd.get("cv") as File | null;

    // Respuestas del cuestionario (mapa { preguntaId: opcionId }), si las hay.
    let respuestasCuestionario: RespuestasCuestionario = {};
    const respuestasRaw = String(fd.get("respuestas") ?? "").trim();
    if (respuestasRaw) {
      try {
        const parsedResp = JSON.parse(respuestasRaw);
        if (parsedResp && typeof parsedResp === "object") {
          respuestasCuestionario = parsedResp as RespuestasCuestionario;
        }
      } catch {
        return NextResponse.json({ ok: false, error: "Respuestas del cuestionario no válidas" }, { status: 400 });
      }
    }

    const parsed = CandidaturaSchema.safeParse({
      empresa_slug: String(fd.get("empresa_slug") ?? "").trim(),
      empresa_id: String(fd.get("empresa_id") ?? "").trim(),
      oferta_id: String(fd.get("oferta_id") ?? "").trim(),
      nombre: String(fd.get("nombre") ?? "").trim(),
      apellidos: String(fd.get("apellidos") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim().toLowerCase(),
      telefono: String(fd.get("telefono") ?? "").trim(),
      genero: String(fd.get("genero") ?? "").trim(),
      ubicacion: String(fd.get("ubicacion") ?? "").trim(),
      disponibilidad: String(fd.get("disponibilidad") ?? "").trim(),
      experiencia_previa: String(fd.get("experiencia_previa") ?? "").trim(),
      como_nos_conocio: String(fd.get("como_nos_conocio") ?? "").trim(),
      carta_presentacion: String(fd.get("carta_presentacion") ?? "").trim(),
    });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { ok: false, error: `Datos inválidos: ${firstIssue.path.join(".")} — ${firstIssue.message}` },
        { status: 400 },
      );
    }
    const { empresa_id: empresaId, oferta_id: ofertaId,
            nombre, apellidos, email, telefono, genero, ubicacion, disponibilidad,
            experiencia_previa: experienciaPrevia,
            como_nos_conocio: comoNosConocioRaw,
            carta_presentacion: cartaPresentacion } = parsed.data;

    // Validación de FORMATO del CV (si se adjunta). La obligatoriedad se decide
    // más abajo según la config de campos de la empresa.
    const tieneCv = !!cv && cv.size > 0;
    if (tieneCv && cv!.size > MAX_CV_BYTES) {
      return NextResponse.json({ ok: false, error: "El CV supera el tamaño máximo de 5MB" }, { status: 400 });
    }
    if (tieneCv && cv!.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "El CV debe ser un PDF" }, { status: 400 });
    }

    if (!(await verifyTurnstile(captchaToken))) {
      return NextResponse.json({ ok: false, error: "Captcha no válido" }, { status: 400 });
    }

    const supabase = service();
    const ip = ipHash(req);

    // Rate limit
    const rl = await checkRateLimit(supabase, ip, empresaId);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Demasiadas candidaturas recientes desde tu conexión. Inténtalo más tarde." },
        { status: 429 },
      );
    }

    // Verificar que la oferta existe y es pública
    const { data: vacante, error: vacErr } = await supabase
      .from("vacantes")
      .select("id, empresa_id, titulo, ubicacion, tipo_jornada, puesto_id, departamento_id, estado_publicacion, visible_publicamente, cuestionario_plantilla_id")
      .eq("id", ofertaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (vacErr || !vacante) {
      return NextResponse.json({ ok: false, error: "Oferta no encontrada" }, { status: 404 });
    }
    if (!vacante.visible_publicamente || vacante.estado_publicacion !== "publicada") {
      return NextResponse.json({ ok: false, error: "Esta oferta no está abierta" }, { status: 410 });
    }

    // Configuración general de reclutamiento (Ajustes → RRHH → Reclutamiento).
    // Gobierna si se avisa al equipo de una nueva candidatura. Los duplicados
    // (email/teléfono) se rechazan SIEMPRE más abajo, no dependen de la config.
    const { data: cfgRow } = await supabase
      .from("reclutamiento_config")
      .select("notificar_reclutador_nueva_candidatura, campos_formulario")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    const notificarNuevaCandidatura = cfgRow?.notificar_reclutador_nueva_candidatura ?? true;

    // Config de campos del formulario (activo/obligatorio). El servidor NO se fía
    // del navegador: revalida que los campos marcados como obligatorios vengan
    // rellenos, e ignora los que están desactivados (se descartan al guardar).
    const campos = normalizarCamposFormulario(cfgRow?.campos_formulario);
    const activo = (k: CampoCandidaturaClave) => campos[k].activo;
    const exigido = (k: CampoCandidaturaClave) => campos[k].activo && campos[k].obligatorio;
    {
      const faltaCampo =
        (exigido("genero") && !genero) ? "el género" :
        (exigido("ubicacion") && !ubicacion.trim()) ? "la ubicación" :
        (exigido("disponibilidad") && !disponibilidad) ? "la disponibilidad" :
        (exigido("experiencia_previa") && !experienciaPrevia) ? "la experiencia previa" :
        (exigido("carta_presentacion") && !cartaPresentacion.trim()) ? "la carta de presentación" :
        (exigido("cv") && !tieneCv) ? "el currículum" :
        null;
      if (faltaCampo) {
        return NextResponse.json(
          { ok: false, error: `Falta un campo obligatorio: ${faltaCampo}` },
          { status: 400 },
        );
      }
    }

    // One-candidate-per-company: el mismo email o teléfono no puede tener dos
    // candidaturas en la empresa (en NINGUNA vacante). Se rechaza siempre —no
    // depende de "permitir candidaturas duplicadas"— y se avisa del motivo
    // concreto al candidato (email, teléfono o ambos).
    {
      const { data: dup } = await supabase
        .rpc("candidato_duplicado_check", {
          p_empresa_id: empresaId,
          p_email: email || null,
          p_telefono: telefono || null,
        })
        .maybeSingle<{ email_existe: boolean; telefono_existe: boolean }>();
      const emailDup = !!dup?.email_existe;
      const telDup = !!dup?.telefono_existe;
      if (emailDup || telDup) {
        const motivo =
          emailDup && telDup
            ? "Este correo y este teléfono ya están registrados en una candidatura."
            : emailDup
              ? "Este correo ya está registrado en una candidatura."
              : "Este teléfono ya está registrado en una candidatura.";
        return NextResponse.json({ ok: false, error: motivo }, { status: 409 });
      }
    }

    // Cuestionario obligatorio: si la vacante lo tiene asignado, validamos y
    // calculamos la nota EN SERVIDOR (no nos fiamos del navegador).
    let cuestionarioCalc: {
      plantillaId: string;
      nombre: string;
      preguntas: PreguntaCuestionario[];
      aciertos: number;
      total: number;
      nota: number;
    } | null = null;
    if (vacante.cuestionario_plantilla_id) {
      const { data: plantilla } = await supabase
        .from("reclutamiento_plantillas_cuestionario")
        .select("id, nombre, preguntas, activa")
        .eq("id", vacante.cuestionario_plantilla_id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      const preguntas = (Array.isArray(plantilla?.preguntas) ? plantilla?.preguntas : []) as PreguntaCuestionario[];
      if (plantilla && plantilla.activa && preguntas.length > 0) {
        const faltaObligatoria = preguntas.some(
          (p) => p.obligatoria && !respuestasCuestionario[p.id],
        );
        if (faltaObligatoria) {
          return NextResponse.json(
            { ok: false, error: "Debes responder todas las preguntas del cuestionario" },
            { status: 400 },
          );
        }
        const { aciertos, total, nota } = calcularNotaCuestionario(preguntas, respuestasCuestionario);
        cuestionarioCalc = {
          plantillaId: plantilla.id as string,
          nombre: plantilla.nombre as string,
          preguntas,
          aciertos,
          total,
          nota,
        };
      }
    }

    // Atribución de canal: si la candidatura llega por un enlace ?o=<codigo>,
    // hereda su origen_categoria y queda vinculada al enlace concreto. Si no llega por
    // ningún canal (o el código no existe), se atribuye al enlace WEB por defecto.
    let origen = "web";
    let canalLinkId: string | null = null;
    let canalNombre: string | null = null;
    if (canalCodigo) {
      const { data: link } = await supabase
        .from("empleo_links")
        .select("id, nombre, origen_categoria")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .ilike("codigo", canalCodigo)
        .maybeSingle();
      if (link) {
        origen = (link.origen_categoria as string) ?? "web";
        canalLinkId = link.id as string;
        canalNombre = (link.nombre as string) ?? null;
      }
    }
    if (!canalLinkId) {
      const web = await ensureWebLink(supabase, empresaId);
      if (web) {
        origen = web.origen_categoria ?? "web";
        canalLinkId = web.id;
        canalNombre = web.nombre ?? "Web";
      }
    }

    // «¿Por dónde nos has conocido?» — lo DECLARA el candidato (distinto del canal
    // automático de arriba). Solo aplica si el campo está activo en la config Y
    // la empresa tiene orígenes en el catálogo. Validamos contra el catálogo
    // activo (no nos fiamos del navegador) y guardamos el nombre tal cual
    // (snapshot) para que sobreviva aunque luego se borre del catálogo.
    let comoNosConocio: string | null = null;
    if (activo("como_nos_conocio")) {
      const { data: origenesRows } = await supabase
        .from("reclutamiento_origenes")
        .select("nombre")
        .eq("empresa_id", empresaId)
        .eq("activo", true);
      const catalogo = (origenesRows ?? []).map((r) => r.nombre as string);
      if (catalogo.length > 0) {
        const match = catalogo.find(
          (n) => n.toLowerCase() === comoNosConocioRaw.toLowerCase(),
        );
        if (!match && campos.como_nos_conocio.obligatorio) {
          return NextResponse.json(
            { ok: false, error: "Indícanos por dónde nos has conocido" },
            { status: 400 },
          );
        }
        comoNosConocio = match ?? null;
      }
    }

    // Subida del CV (solo si el campo está activo y se adjuntó).
    let cvUrl: string | null = null;
    if (activo("cv") && tieneCv && cv) {
      const candidatoTempId = crypto.randomUUID();
      const path = `${empresaId}/${candidatoTempId}.pdf`;
      const buffer = Buffer.from(await cv.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from("cvs-candidatos")
        .upload(path, buffer, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upErr) {
        console.error("[candidatura] cv upload error:", upErr.message);
      } else {
        cvUrl = path;
      }
    }

    // Insertar candidato
    const { data: candidato, error: insErr } = await supabase
      .from("candidatos")
      .insert({
        empresa_id: empresaId,
        vacante_id: vacante.id,
        nombre: normalizarNombre(nombre),
        apellidos: normalizarNombre(apellidos),
        email,
        telefono,
        // Campos configurables: se guarda null si el campo está desactivado
        // (el candidato no lo vio, no debemos persistir un valor fantasma).
        genero: activo("genero") ? (genero || null) : null,
        ubicacion: activo("ubicacion") ? (ubicacion.trim() || null) : null,
        disponibilidad: activo("disponibilidad") ? (disponibilidad || null) : null,
        experiencia_previa: activo("experiencia_previa") ? (experienciaPrevia || null) : null,
        cv_url: cvUrl,
        carta_presentacion: activo("carta_presentacion") ? (cartaPresentacion.trim() || null) : null,
        origen,
        canal_link_id: canalLinkId,
        canal_nombre: canalNombre,
        como_nos_conocio: comoNosConocio,
        fase: "nuevo",
        estado: "nuevo",
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[candidatura] insert error:", insErr.message);
      return NextResponse.json({ ok: false, error: "No se pudo registrar la candidatura" }, { status: 500 });
    }

    // Guardar respuestas + nota del cuestionario (snapshot verbatim) y reflejar
    // la nota en la ficha del candidato (`puntuacion`, entero 0–10).
    if (cuestionarioCalc) {
      const { error: respErr } = await supabase
        .from("candidato_cuestionario_respuestas")
        .insert({
          empresa_id: empresaId,
          candidato_id: candidato.id,
          cuestionario_plantilla_id: cuestionarioCalc.plantillaId,
          cuestionario_nombre: cuestionarioCalc.nombre,
          preguntas_snapshot: cuestionarioCalc.preguntas,
          respuestas: respuestasCuestionario,
          aciertos: cuestionarioCalc.aciertos,
          total_preguntas: cuestionarioCalc.total,
          nota: cuestionarioCalc.nota,
        });
      if (respErr) {
        console.error("[candidatura] cuestionario insert error:", respErr.message);
      } else {
        await supabase
          .from("candidatos")
          .update({ puntuacion: Math.round(cuestionarioCalc.nota) })
          .eq("id", candidato.id);
      }
    }

    // Correo de confirmación al candidato (plantilla «Nuevo» del estado inicial).
    // Best-effort: nunca rompe el alta si el envío falla o no hay plantilla/SMTP.
    try {
      const { enviarEmailCandidaturaNueva } = await import(
        "@/features/rrhh/lib/reclutamiento-email-publico"
      );
      const r = await enviarEmailCandidaturaNueva(supabase, {
        empresaId,
        candidato: { nombre: normalizarNombre(nombre), apellidos: normalizarNombre(apellidos), email, telefono },
        vacante: {
          id: vacante.id,
          titulo: vacante.titulo ?? null,
          ubicacion: vacante.ubicacion ?? null,
          tipo_jornada: vacante.tipo_jornada ?? null,
          departamento_id: vacante.departamento_id ?? null,
        },
      });
      if (!r.sent) {
        console.warn("[candidatura] email confirmación no enviado:", r.reason);
      } else {
        // Registra el envío del correo «Nuevo» en la Actividad del candidato,
        // igual que cualquier correo de fase posterior. Sin sesión (portal
        // público): el autor es el «Sistema». Best-effort.
        const { error: histErr } = await supabase.from("candidato_historial").insert({
          empresa_id: empresaId,
          candidato_id: candidato.id,
          fase_anterior: "nuevo",
          estado_anterior: "nuevo",
          fase_nueva: "nuevo",
          estado_nuevo: "nuevo",
          usuario_id: null,
          usuario_nombre: "Sistema",
          email_enviado: true,
          email_asunto: r.asunto ?? null,
          email_html: r.html ?? null,
        });
        if (histErr) console.error("[candidatura] historial email nuevo:", histErr.message);
      }
    } catch (e) {
      console.error("[candidatura] email confirmación:", e);
    }

    // Aviso al equipo de reclutamiento de que entró una nueva candidatura.
    // Best-effort: nunca rompe el alta si el aviso falla. Sin "reclutador
    // asignado" en el modelo, se notifica al área administrativa (RRHH).
    if (notificarNuevaCandidatura) {
      try {
        const { emitirNotificacion } = await import(
          "@/features/notificaciones/actions/notificaciones-actions"
        );
        const nombreCompleto = `${normalizarNombre(nombre)} ${normalizarNombre(apellidos)}`.trim();
        await emitirNotificacion({
          empresaId,
          system: true,
          tipo: "nueva_candidatura",
          titulo: `Nueva candidatura: ${nombreCompleto}`,
          mensaje: `${nombreCompleto} se ha inscrito en «${vacante.titulo ?? "una vacante"}».`,
          segmento: { tipo: "area", area: "ADMINISTRATIVA" },
          refTabla: "candidatos",
          refId: candidato.id,
          accionUrl: "/rrhh/reclutamiento",
          dedupeKey: `candidatura:${candidato.id}`,
        });
      } catch (e) {
        console.error("[candidatura] aviso nueva candidatura:", e);
      }
    }

    return NextResponse.json({ ok: true, id: candidato.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[candidatura] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
