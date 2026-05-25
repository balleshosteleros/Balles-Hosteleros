/**
 * Lectura/escritura pública del módulo Inspecciones.
 * Usa service-role en server-side para resolver el token, leer la presentación,
 * la plantilla activa y los locales, y registrar el envío del inspector externo.
 * Mismo patrón que /carta/[slug].
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  InspeccionPublica,
  Slide,
  Seccion,
  Pregunta,
  EmpresaTheme,
  LocalPublico,
} from "./types";

interface PreguntaSnapshot {
  seccion_titulo: string;
  seccion_orden: number;
  enunciado: string;
  tipo: Pregunta["tipo"];
  orden: number;
  escala_max: number | null;
}

export async function fetchInspeccionPublica(
  token: string,
): Promise<InspeccionPublica | null> {
  if (!token) return null;
  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("inspeccion_tokens")
    .select("empresa_id, plantilla_activa_id, activo")
    .eq("token", token)
    .maybeSingle();
  if (!tokenRow || !tokenRow.activo || !tokenRow.plantilla_activa_id) {
    return null;
  }

  const empresaId = tokenRow.empresa_id as string;
  const plantillaId = tokenRow.plantilla_activa_id as string;

  // Empresa (tema)
  const { data: empresa } = await admin
    .from("empresas")
    .select("id, nombre, logo_url, color, color_secundario, color_texto")
    .eq("id", empresaId)
    .maybeSingle();
  if (!empresa) return null;
  const empresaTheme: EmpresaTheme = {
    id: empresa.id,
    nombre: empresa.nombre,
    logo_url: empresa.logo_url ?? null,
    color: empresa.color ?? null,
    color_secundario: empresa.color_secundario ?? null,
    color_texto: empresa.color_texto ?? null,
  };

  // Locales activos
  const { data: locales } = await admin
    .from("locales")
    .select("id, nombre, color, activo")
    .eq("empresa_id", empresaId)
    .order("nombre");
  const localesPublic: LocalPublico[] = (locales ?? [])
    .filter((l) => l.activo !== false)
    .map((l) => ({ id: l.id, nombre: l.nombre, color: l.color ?? null }));

  // Presentación
  const { data: pres } = await admin
    .from("inspeccion_presentaciones")
    .select("slides")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const slides: Slide[] = (pres?.slides as Slide[] | null) ?? [];

  // Plantilla activa (versión vigente)
  const { data: plantilla } = await admin
    .from("inspeccion_plantillas")
    .select("id, nombre")
    .eq("id", plantillaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!plantilla) return null;

  const { data: version } = await admin
    .from("inspeccion_plantilla_versiones")
    .select("id")
    .eq("plantilla_id", plantillaId)
    .eq("vigente", true)
    .maybeSingle();
  if (!version) return null;

  const { data: secciones } = await admin
    .from("inspeccion_secciones")
    .select("*")
    .eq("version_id", version.id)
    .order("orden");

  const { data: preguntas } = await admin
    .from("inspeccion_preguntas")
    .select("*")
    .in("seccion_id", (secciones ?? []).map((s) => s.id))
    .order("orden");

  const secs: Seccion[] = (secciones ?? []).map((s) => ({
    id: s.id,
    version_id: s.version_id,
    empresa_id: s.empresa_id,
    orden: s.orden,
    titulo: s.titulo,
    descripcion: s.descripcion,
    preguntas: (preguntas ?? [])
      .filter((p) => p.seccion_id === s.id)
      .map(
        (p): Pregunta => ({
          id: p.id,
          seccion_id: p.seccion_id,
          empresa_id: p.empresa_id,
          orden: p.orden,
          tipo: p.tipo,
          enunciado: p.enunciado,
          ayuda: p.ayuda,
          obligatoria: p.obligatoria,
          escala_min: p.escala_min,
          escala_max: p.escala_max,
          escala_label_min: p.escala_label_min,
          escala_label_max: p.escala_label_max,
          opciones: p.opciones,
          cuenta_para_nota: p.cuenta_para_nota,
        }),
      ),
  }));

  return {
    empresa: empresaTheme,
    locales: localesPublic,
    presentacion: slides,
    plantilla: {
      id: plantilla.id,
      version_id: version.id,
      nombre: plantilla.nombre,
      secciones: secs,
    },
  };
}

interface EnvioInput {
  token: string;
  local_id: string | null;
  nombre_inspector: string;
  telefono_inspector: string | null;
  fecha_inspeccion: string | null;
  nombre_encargado: string | null;
  respuestas: { pregunta_id: string; valor: string | number | null }[];
  ip?: string | null;
  user_agent?: string | null;
}

export async function submitInspeccion(
  input: EnvioInput,
): Promise<
  { ok: true; envioId: string; numero: number | null } | { ok: false; error: string }
> {
  const admin = createAdminClient();

  // 1) Validar token
  const { data: tokenRow } = await admin
    .from("inspeccion_tokens")
    .select("empresa_id, plantilla_activa_id, activo")
    .eq("token", input.token)
    .maybeSingle();
  if (!tokenRow || !tokenRow.activo || !tokenRow.plantilla_activa_id) {
    return { ok: false, error: "Enlace no válido" };
  }
  const empresaId = tokenRow.empresa_id as string;
  const plantillaId = tokenRow.plantilla_activa_id as string;

  // 2) Resolver versión vigente
  const { data: version } = await admin
    .from("inspeccion_plantilla_versiones")
    .select("id")
    .eq("plantilla_id", plantillaId)
    .eq("vigente", true)
    .maybeSingle();
  if (!version) return { ok: false, error: "Plantilla sin versión activa" };

  // 3) Resolver preguntas (para snapshot + nota)
  const { data: secciones } = await admin
    .from("inspeccion_secciones")
    .select("id, titulo, orden")
    .eq("version_id", version.id);
  const seccionesMap = new Map(
    (secciones ?? []).map((s) => [s.id, { titulo: s.titulo, orden: s.orden }]),
  );

  const preguntaIds = input.respuestas.map((r) => r.pregunta_id);
  const { data: preguntas } = await admin
    .from("inspeccion_preguntas")
    .select(
      "id, seccion_id, enunciado, tipo, orden, escala_max, cuenta_para_nota, obligatoria",
    )
    .in("id", preguntaIds.length ? preguntaIds : ["00000000-0000-0000-0000-000000000000"]);
  const preguntaMap = new Map((preguntas ?? []).map((p) => [p.id, p]));

  // 4) Validar obligatorias
  for (const pregId of preguntaIds) {
    const p = preguntaMap.get(pregId);
    if (!p) continue;
    const r = input.respuestas.find((rr) => rr.pregunta_id === pregId);
    if (
      p.obligatoria &&
      (r?.valor === null || r?.valor === undefined || r?.valor === "")
    ) {
      return { ok: false, error: `Falta una pregunta obligatoria` };
    }
  }

  // 5) Calcular nota_final (media de escalas con cuenta_para_nota = true)
  let suma = 0;
  let cuenta = 0;
  for (const r of input.respuestas) {
    const p = preguntaMap.get(r.pregunta_id);
    if (!p || !p.cuenta_para_nota || p.tipo !== "escala") continue;
    const max = p.escala_max ?? 5;
    if (typeof r.valor === "number" && max > 0) {
      suma += (r.valor / max) * 10;
      cuenta += 1;
    }
  }
  const notaFinal = cuenta > 0 ? Number((suma / cuenta).toFixed(2)) : null;

  // 6) Insertar envío
  const { data: envio, error: errEnvio } = await admin
    .from("inspeccion_envios")
    .insert({
      empresa_id: empresaId,
      local_id: input.local_id,
      plantilla_id: plantillaId,
      version_id: version.id,
      nombre_inspector: input.nombre_inspector,
      telefono_inspector: input.telefono_inspector,
      fecha_inspeccion: input.fecha_inspeccion,
      nombre_encargado: input.nombre_encargado,
      nota_final: notaFinal,
      estado: "pendiente_revision",
      ip_origen: input.ip,
      user_agent: input.user_agent,
    })
    .select("id, numero_secuencial")
    .maybeSingle();
  if (errEnvio || !envio) return { ok: false, error: errEnvio?.message ?? "Error" };

  // 7) Insertar respuestas con snapshot
  const filas = input.respuestas.map((r) => {
    const p = preguntaMap.get(r.pregunta_id);
    const sec = p ? seccionesMap.get(p.seccion_id) : null;
    const snapshot: PreguntaSnapshot = {
      seccion_titulo: sec?.titulo ?? "",
      seccion_orden: sec?.orden ?? 0,
      enunciado: p?.enunciado ?? "",
      tipo: p?.tipo ?? "texto_corto",
      orden: p?.orden ?? 0,
      escala_max: p?.escala_max ?? null,
    };
    return {
      envio_id: envio.id,
      empresa_id: empresaId,
      pregunta_id: r.pregunta_id,
      pregunta_snapshot: snapshot,
      valor_texto: typeof r.valor === "string" ? r.valor : null,
      valor_numero: typeof r.valor === "number" ? r.valor : null,
    };
  });

  if (filas.length > 0) {
    const { error: errResp } = await admin
      .from("inspeccion_respuestas")
      .insert(filas);
    if (errResp) {
      // Compensar el envío para no dejar huérfano
      await admin.from("inspeccion_envios").delete().eq("id", envio.id);
      return { ok: false, error: errResp.message };
    }
  }

  return { ok: true, envioId: envio.id, numero: envio.numero_secuencial };
}
