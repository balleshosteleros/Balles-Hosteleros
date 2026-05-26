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
  EmpleadoPublico,
  EmpleadoSeleccionado,
  InspectorPublico,
  JefeSalaFirma,
  QrTokenPublic,
  VerificacionResultado,
} from "./types";
import { generateQrToken, qrExpiresAt, qrVerifyUrl } from "./qr-tokens";

function normalizarDni(d: string | null | undefined): string | null {
  if (!d) return null;
  const limpio = d.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  return limpio.length > 0 ? limpio : null;
}

// Si el usuario escribe en MAYÚSCULAS ("DAYANA LANZURI"), lo convertimos a
// formato nombre ("Dayana Lanzuri"). Si ya hay alguna minúscula, respetamos el
// casing del usuario para no romper apellidos tipo "McCarthy" o conectores "y".
function normalizarNombre<T extends string | null | undefined>(s: T): T {
  if (!s) return s;
  const trimmed = s.trim();
  if (!trimmed) return trimmed as T;
  if (/\p{Ll}/u.test(trimmed)) return trimmed as T;
  return trimmed
    .toLocaleLowerCase("es-ES")
    .replace(/(^|[\s\-'])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase("es-ES")) as T;
}

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
    .select("id, nombre, numero_secuencial")
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

  // Empleados activos de la empresa (para preguntas tipo empleado_select)
  const { data: empleadosRows } = await admin
    .from("empleados")
    .select("id, nombre, apellidos, puesto, departamento_id, estado, departamentos:departamento_id(nombre)")
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo")
    .order("nombre");

  const empleados: EmpleadoPublico[] = (empleadosRows ?? []).map((e) => {
    const dept = Array.isArray(e.departamentos) ? e.departamentos[0] : e.departamentos;
    const nombreCompleto = `${e.nombre ?? ""}${e.apellidos ? " " + e.apellidos : ""}`.trim();
    return {
      id: e.id as string,
      nombre_completo: nombreCompleto,
      puesto: (e.puesto as string | null) ?? null,
      departamento: (dept as { nombre: string } | null)?.nombre ?? null,
    };
  });

  // Inspectores en "proceso de colaboración" (fases prueba/activo).
  // Son los únicos que pueden rellenar el formulario público.
  const { data: inspectoresRows } = await admin
    .from("inspectores")
    .select("id, nombre, apellidos, telefono, email, fase")
    .eq("empresa_id", empresaId)
    .in("fase", ["prueba", "activo"])
    .order("nombre");

  const inspectores: InspectorPublico[] = (inspectoresRows ?? []).map((i) => ({
    id: i.id as string,
    nombre_completo: `${i.nombre ?? ""}${i.apellidos ? " " + i.apellidos : ""}`.trim(),
    telefono: (i.telefono as string | null) ?? "",
    email: (i.email as string | null) ?? null,
  }));

  return {
    empresa: empresaTheme,
    locales: localesPublic,
    presentacion: slides,
    plantilla: {
      id: plantilla.id,
      version_id: version.id,
      nombre: plantilla.nombre,
      numero_secuencial: (plantilla.numero_secuencial as number | null) ?? null,
      secciones: secs,
    },
    empleados,
    inspectores,
  };
}

interface EnvioInput {
  token: string;
  local_id: string | null;
  inspector_id: string | null;
  nombre_inspector: string;
  telefono_inspector: string | null;
  fecha_inspeccion: string | null;
  nombre_jefe_sala: string | null;
  respuestas: { pregunta_id: string; valor: string | number | null }[];
  ip?: string | null;
  user_agent?: string | null;
}

export async function submitInspeccion(
  input: EnvioInput,
): Promise<
  | {
      ok: true;
      envioId: string;
      numero: number | null;
      qr: QrTokenPublic;
    }
  | { ok: false; error: string }
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

  // 1b) Validar inspector: debe existir, pertenecer a la empresa y estar
  // en una fase de colaboración (prueba/activo). Sin esto no se acepta
  // envío: el formulario no permite avanzar sin escogerlo.
  if (!input.inspector_id) {
    return { ok: false, error: "Debes elegirte en el desplegable de inspectores" };
  }
  const { data: inspectorRow } = await admin
    .from("inspectores")
    .select("id, nombre, apellidos, telefono, fase, empresa_id")
    .eq("id", input.inspector_id)
    .maybeSingle();
  if (
    !inspectorRow ||
    inspectorRow.empresa_id !== empresaId ||
    !["prueba", "activo"].includes(inspectorRow.fase as string)
  ) {
    return { ok: false, error: "Inspector no autorizado" };
  }

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

  // Extraer empleado_id del jefe de sala a partir de la respuesta tipo empleado_select.
  // El valor llega serializado como JSON: { empleado_id, nombre_completo, ... }.
  let jefeSalaEmpleadoId: string | null = null;
  for (const r of input.respuestas) {
    const p = preguntaMap.get(r.pregunta_id);
    if (!p || p.tipo !== "empleado_select") continue;
    if (typeof r.valor !== "string" || !r.valor) continue;
    try {
      const parsed = JSON.parse(r.valor) as EmpleadoSeleccionado;
      if (parsed?.empleado_id) {
        jefeSalaEmpleadoId = parsed.empleado_id;
        break;
      }
    } catch {
      // ignorar valores corruptos
    }
  }

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
      nombre_inspector: normalizarNombre(input.nombre_inspector),
      telefono_inspector: input.telefono_inspector,
      fecha_inspeccion: input.fecha_inspeccion,
      nombre_jefe_sala: normalizarNombre(input.nombre_jefe_sala),
      jefe_sala_empleado_id: jefeSalaEmpleadoId,
      nota_final: notaFinal,
      estado: "pendiente_revision",
      ip_origen: input.ip,
      user_agent: input.user_agent,
    })
    .select("id, numero_secuencial")
    .maybeSingle();
  if (errEnvio || !envio) return { ok: false, error: errEnvio?.message ?? "Error" };

  // 6b) Vincular envío ↔ inspector (ficha de la bolsa).
  // Hacemos upsert por envio_id por idempotencia. Si fallase, no abortamos el
  // envío entero: el responsable de calidad podrá vincular manualmente luego.
  await admin
    .from("inspector_asignaciones")
    .upsert(
      {
        empresa_id: empresaId,
        inspector_id: input.inspector_id,
        envio_id: envio.id,
      },
      { onConflict: "envio_id" },
    );

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

  // 8) Generar QR token de verificación in-situ (PRP-041)
  const qrToken = generateQrToken();
  const expiresAt = qrExpiresAt();
  const { error: errQr } = await admin.from("inspeccion_qr_tokens").insert({
    envio_id: envio.id,
    empresa_id: empresaId,
    token: qrToken,
    expires_at: expiresAt.toISOString(),
  });
  if (errQr) {
    return {
      ok: false,
      error: `Inspección guardada pero no se pudo generar el QR: ${errQr.message}`,
    };
  }

  return {
    ok: true,
    envioId: envio.id,
    numero: envio.numero_secuencial,
    qr: {
      token: qrToken,
      expires_at: expiresAt.toISOString(),
      verify_url: qrVerifyUrl(qrToken),
    },
  };
}

// ─── Regeneración pública del QR ───────────────────────────────────────
// El inspector que cerró el envío (con su token público de inspección) puede
// pedir regenerar el QR si el anterior caducó sin escanearse.
export async function regenerarQrTokenPublico(input: {
  publicToken: string; // token de inspeccion_tokens del inspector
  envioId: string;
}): Promise<{ ok: true; qr: QrTokenPublic } | { ok: false; error: string }> {
  const admin = createAdminClient();

  // 1) Validar token público del inspector
  const { data: tokenRow } = await admin
    .from("inspeccion_tokens")
    .select("empresa_id, activo")
    .eq("token", input.publicToken)
    .maybeSingle();
  if (!tokenRow || !tokenRow.activo) {
    return { ok: false, error: "Enlace no válido" };
  }
  const empresaId = tokenRow.empresa_id as string;

  // 2) Validar que el envío pertenece a esa empresa y no está verificado aún
  const { data: envio } = await admin
    .from("inspeccion_envios")
    .select("id, empresa_id, verificado_at")
    .eq("id", input.envioId)
    .maybeSingle();
  if (!envio || envio.empresa_id !== empresaId) {
    return { ok: false, error: "Envío no encontrado" };
  }
  if (envio.verificado_at) {
    return { ok: false, error: "Esta inspección ya está verificada" };
  }

  // 3) Revocar todos los tokens previos del envío
  await admin
    .from("inspeccion_qr_tokens")
    .update({ revoked: true })
    .eq("envio_id", input.envioId)
    .is("used_at", null);

  // 4) Crear token nuevo
  const qrToken = generateQrToken();
  const expiresAt = qrExpiresAt();
  const { error: errInsert } = await admin
    .from("inspeccion_qr_tokens")
    .insert({
      envio_id: input.envioId,
      empresa_id: empresaId,
      token: qrToken,
      expires_at: expiresAt.toISOString(),
    });
  if (errInsert) return { ok: false, error: errInsert.message };

  return {
    ok: true,
    qr: {
      token: qrToken,
      expires_at: expiresAt.toISOString(),
      verify_url: qrVerifyUrl(qrToken),
    },
  };
}

// ─── Verificación pública del QR por DNI del jefe de sala ──────────────
//
// Modelo de identidad: la firma del envío exige el DNI del empleado que el
// inspector marcó como "jefe de sala" en el formulario (campo
// empleado_select). No basta con tener sesión iniciada. Esto evita que un
// empleado distinto del designado pueda firmar la inspección por otro,
// aunque su teléfono quede a mano. Sin contador de intentos: si el DNI no
// coincide, el botón vuelve a estar disponible.

/**
 * Lee los colores corporativos de la empresa a la que pertenece el QR.
 * Se usa en la página de verificación para tematizar las pantallas de
 * error con el branding del restaurante en vez de rojo/ámbar genéricos.
 */
export async function fetchEmpresaThemeFromQrToken(
  qrToken: string,
): Promise<EmpresaTheme | null> {
  if (!qrToken) return null;
  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from("inspeccion_qr_tokens")
    .select("empresa_id")
    .eq("token", qrToken)
    .maybeSingle();
  if (!tokenRow) return null;
  const { data: empresa } = await admin
    .from("empresas")
    .select("id, nombre, logo_url, color, color_secundario, color_texto")
    .eq("id", tokenRow.empresa_id)
    .maybeSingle();
  if (!empresa) return null;
  return {
    id: empresa.id,
    nombre: empresa.nombre,
    logo_url: empresa.logo_url ?? null,
    color: empresa.color ?? null,
    color_secundario: empresa.color_secundario ?? null,
    color_texto: empresa.color_texto ?? null,
  };
}

/**
 * Carga los datos públicos necesarios para pintar la pantalla de firma:
 * estado del QR (caducado/usado/revocado) y nombre + puesto del jefe de
 * sala. No expone el DNI nunca.
 */
export async function fetchJefeSalaFirma(qrToken: string): Promise<
  | { ok: true; data: JefeSalaFirma }
  | { ok: false; motivo: NonNullable<VerificacionResultado["motivo"]>; envio?: VerificacionResultado["envio"] }
> {
  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("inspeccion_qr_tokens")
    .select("id, envio_id, empresa_id, expires_at, used_at, revoked")
    .eq("token", qrToken)
    .maybeSingle();
  if (!tokenRow) return { ok: false, motivo: "token_invalido" };

  const { data: envio } = await admin
    .from("inspeccion_envios")
    .select(
      "id, numero_secuencial, local_id, empresa_id, fecha_inspeccion, nombre_inspector, jefe_sala_empleado_id, verificado_at, verificado_por_empleado_id, local:locales(nombre)",
    )
    .eq("id", tokenRow.envio_id)
    .maybeSingle();
  if (!envio) return { ok: false, motivo: "token_invalido" };

  const localNombre =
    (Array.isArray(envio.local)
      ? envio.local[0]?.nombre
      : (envio.local as { nombre: string } | null)?.nombre) ?? null;

  if (envio.verificado_at) {
    let verifNombre: string | null = null;
    if (envio.verificado_por_empleado_id) {
      const { data: emp } = await admin
        .from("empleados")
        .select("nombre, apellidos")
        .eq("id", envio.verificado_por_empleado_id)
        .maybeSingle();
      if (emp) verifNombre = `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim();
    }
    return {
      ok: false,
      motivo: "ya_verificado",
      envio: {
        id: envio.id,
        numero_secuencial: envio.numero_secuencial,
        local_nombre: localNombre,
        fecha_inspeccion: envio.fecha_inspeccion,
        nombre_inspector: envio.nombre_inspector,
        verificado_at: envio.verificado_at,
        verificado_por_nombre: verifNombre ?? undefined,
      },
    };
  }

  if (tokenRow.revoked) return { ok: false, motivo: "token_revocado" };
  if (tokenRow.used_at) return { ok: false, motivo: "token_usado" };
  if (new Date(tokenRow.expires_at) < new Date()) {
    return { ok: false, motivo: "token_caducado" };
  }

  // El envío debe traer jefe_sala_empleado_id; sin él no podemos pedir DNI.
  if (!envio.jefe_sala_empleado_id) {
    return { ok: false, motivo: "sin_jefe_sala_asignado" };
  }

  const { data: emp } = await admin
    .from("empleados")
    .select("id, nombre, apellidos, puesto, dni_nie")
    .eq("id", envio.jefe_sala_empleado_id)
    .maybeSingle();
  if (!emp) return { ok: false, motivo: "sin_jefe_sala_asignado" };
  if (!emp.dni_nie) return { ok: false, motivo: "jefe_sala_sin_dni" };

  return {
    ok: true,
    data: {
      envio_id: envio.id,
      numero_secuencial: envio.numero_secuencial,
      local_nombre: localNombre,
      nombre_inspector: envio.nombre_inspector,
      jefe_sala: {
        empleado_id: emp.id as string,
        nombre_completo: `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim(),
        puesto: (emp.puesto as string | null) ?? null,
      },
    },
  };
}

/**
 * Firma el envío comparando el DNI introducido contra el del empleado
 * que el inspector marcó como jefe de sala. Sin límite de intentos.
 */
export async function verificarEnvioConDni(input: {
  qrToken: string;
  dniIntroducido: string;
}): Promise<VerificacionResultado> {
  const admin = createAdminClient();

  const dniNorm = normalizarDni(input.dniIntroducido);
  if (!dniNorm) return { ok: false, motivo: "dni_no_coincide" };

  // 1) Resolver token + envío
  const { data: tokenRow } = await admin
    .from("inspeccion_qr_tokens")
    .select("id, envio_id, empresa_id, expires_at, used_at, revoked")
    .eq("token", input.qrToken)
    .maybeSingle();
  if (!tokenRow) return { ok: false, motivo: "token_invalido" };

  const { data: envio } = await admin
    .from("inspeccion_envios")
    .select(
      "id, numero_secuencial, local_id, empresa_id, fecha_inspeccion, nombre_inspector, jefe_sala_empleado_id, verificado_at, verificado_por_empleado_id, local:locales(nombre)",
    )
    .eq("id", tokenRow.envio_id)
    .maybeSingle();
  if (!envio) return { ok: false, motivo: "token_invalido" };

  const localNombre =
    (Array.isArray(envio.local)
      ? envio.local[0]?.nombre
      : (envio.local as { nombre: string } | null)?.nombre) ?? null;

  if (envio.verificado_at) return { ok: false, motivo: "ya_verificado" };
  if (tokenRow.revoked) return { ok: false, motivo: "token_revocado" };
  if (tokenRow.used_at) return { ok: false, motivo: "token_usado" };
  if (new Date(tokenRow.expires_at) < new Date()) {
    return { ok: false, motivo: "token_caducado" };
  }
  if (!envio.jefe_sala_empleado_id) {
    return { ok: false, motivo: "sin_jefe_sala_asignado" };
  }

  // 2) Cargar empleado jefe de sala + su DNI
  const { data: emp } = await admin
    .from("empleados")
    .select("id, nombre, apellidos, dni_nie")
    .eq("id", envio.jefe_sala_empleado_id)
    .maybeSingle();
  if (!emp) return { ok: false, motivo: "sin_jefe_sala_asignado" };
  const dniEmpleado = normalizarDni(emp.dni_nie as string | null);
  if (!dniEmpleado) return { ok: false, motivo: "jefe_sala_sin_dni" };

  // 3) Comparar DNI. Sin contador, sin revocación.
  if (dniNorm !== dniEmpleado) return { ok: false, motivo: "dni_no_coincide" };

  // 4) UPDATE atómico del token + envío
  const { data: updated, error: errUpd } = await admin
    .from("inspeccion_qr_tokens")
    .update({
      used_at: new Date().toISOString(),
      used_by_empleado_id: emp.id,
    })
    .eq("id", tokenRow.id)
    .is("used_at", null)
    .eq("revoked", false)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (errUpd || !updated) return { ok: false, motivo: "token_caducado" };

  const verifiedAt = new Date().toISOString();
  const { error: errEnvio } = await admin
    .from("inspeccion_envios")
    .update({
      verificado_at: verifiedAt,
      verificado_por_empleado_id: emp.id,
      verificado_qr_token_id: tokenRow.id,
    })
    .eq("id", envio.id);
  if (errEnvio) return { ok: false, motivo: "token_invalido" };

  return {
    ok: true,
    envio: {
      id: envio.id,
      numero_secuencial: envio.numero_secuencial,
      local_nombre: localNombre,
      fecha_inspeccion: envio.fecha_inspeccion,
      nombre_inspector: envio.nombre_inspector,
      verificado_at: verifiedAt,
      verificado_por_nombre: `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim(),
    },
  };
}
