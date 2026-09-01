/**
 * Orquestador de envío: la única puerta por la que sale un WhatsApp o un SMS.
 *
 * El orden de los pasos importa y es deliberado:
 *
 *   1. ¿Está el canal encendido y hay número al que escribir?
 *   2. ¿Hay saldo y queda tope de gasto?
 *   3. Se COBRA el saldo.
 *   4. Se envía.
 *   5. Si falla, se DEVUELVE lo cobrado.
 *
 * Cobrar antes de enviar y devolver si falla es lo contrario de lo intuitivo,
 * pero es lo correcto: si se enviara primero, dos mensajes simultáneos podrían
 * salir con el saldo de uno, y eso es dinero que el software regala.
 *
 * Cuando no se puede enviar, el aviso NO se pierde: sale por correo. El cliente
 * final no puede quedarse sin su confirmación porque el restaurante se
 * descuidara con el saldo.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/features/accesos/lib/crypto";
import { twilio } from "./twilio";
import { normalizarTelefono, type CredencialesProveedor } from "./proveedor";
import type { CanalMensajeria } from "@/features/mensajeria/data/monedero";

/** El proveedor activo. Cambiar de proveedor es cambiar esta línea. */
const proveedor = twilio;

export type TipoMensaje =
  | "CONFIRMACION"
  | "RECONFIRMACION"
  | "RECORDATORIO"
  | "CANCELACION"
  | "CAMPANA";

export interface ActorMensaje {
  usuarioId?: string | null;
  usuarioNombre?: string | null;
  /** Mismos orígenes que el histórico de correos: una reserva llegada desde
   *  Google tiene que constar como tal también aquí. */
  origen?: "MANUAL" | "AUTOMATICO" | "PORTAL_PUBLICO" | "GOOGLE_RWG";
}

export type ResultadoMensaje =
  | { ok: true; canal: CanalMensajeria; envioId: string; costeCents: number }
  | {
      ok: false;
      /** Motivo en cristiano, para poder decírselo al restaurante. */
      motivo: string;
      /** true si el aviso debe salir por correo en su lugar. */
      caerACorreo: boolean;
    };

interface ConfigRow {
  proveedor_subcuenta_id: string | null;
  proveedor_token_cifrado: string | null;
  whatsapp_numero: string | null;
  sms_numero: string | null;
  estado_alta: string;
  whatsapp_activo: boolean;
  sms_activo: boolean;
  sms_respaldo_activo: boolean;
  avisos_activos: Record<string, boolean> | null;
  tope_mensual_cents: number | null;
}

export interface EnviarMensajeInput {
  empresaId: string;
  tipo: TipoMensaje;
  /** Teléfono tal cual está guardado; se normaliza aquí. */
  telefono: string | null | undefined;
  /** Identificador de la plantilla aprobada, para WhatsApp. */
  plantillaWhatsapp?: string;
  /** Valores de la plantilla, en orden. */
  variables?: string[];
  /** Texto del SMS. Sin él, el respaldo no puede entrar. */
  textoSms?: string;
  reservaId?: string | null;
  actor?: ActorMensaje;
}

/**
 * Envía un aviso por WhatsApp y, si no se puede entregar, por SMS.
 *
 * Nunca lanza: un fallo aquí no puede tumbar el cron de avisos ni la creación
 * de una reserva. Todo error se devuelve para que quien llama decida.
 */
export async function enviarMensaje(
  input: EnviarMensajeInput,
): Promise<ResultadoMensaje> {
  const admin = createAdminClient();

  // ── 1. ¿Se puede enviar? ────────────────────────────────────────────
  const { data: configRow } = await admin
    .from("empresa_mensajeria_config")
    .select("proveedor_subcuenta_id, proveedor_token_cifrado, whatsapp_numero, sms_numero, estado_alta, whatsapp_activo, sms_activo, sms_respaldo_activo, avisos_activos, tope_mensual_cents")
    .eq("empresa_id", input.empresaId)
    .maybeSingle();

  const config = configRow as ConfigRow | null;

  if (!config || config.estado_alta !== "ACTIVO") {
    return { ok: false, motivo: "La empresa no tiene la mensajería activa", caerACorreo: true };
  }
  if (!config.proveedor_subcuenta_id || !config.proveedor_token_cifrado) {
    return { ok: false, motivo: "Faltan las credenciales del proveedor", caerACorreo: true };
  }

  // Las campañas se piden explícitamente y no dependen de los interruptores de
  // los avisos automáticos de reserva.
  if (input.tipo !== "CAMPANA") {
    const avisos = config.avisos_activos ?? {};
    if (avisos[input.tipo] !== true) {
      return { ok: false, motivo: `El aviso ${input.tipo} está apagado`, caerACorreo: true };
    }
  }

  const telefono = normalizarTelefono(input.telefono);
  if (!telefono) {
    return { ok: false, motivo: "El cliente no tiene un teléfono válido", caerACorreo: true };
  }

  // ── 2. Qué canales se pueden usar, en orden de preferencia ──────────
  //
  // WhatsApp primero: cuesta la mitad y se lee mucho más.
  const canales: CanalMensajeria[] = [];
  if (config.whatsapp_activo && config.whatsapp_numero && input.plantillaWhatsapp) {
    canales.push("WHATSAPP");
  }
  if (config.sms_activo && config.sms_numero && input.textoSms) {
    canales.push("SMS");
  }
  if (canales.length === 0) {
    return { ok: false, motivo: "No hay ningún canal disponible", caerACorreo: true };
  }

  const credenciales: CredencialesProveedor = {
    subcuentaId: config.proveedor_subcuenta_id,
    token: decrypt(config.proveedor_token_cifrado),
    whatsappNumero: config.whatsapp_numero,
    smsNumero: config.sms_numero,
  };

  let ultimoMotivo = "No se pudo enviar";

  for (const canal of canales) {
    // El SMS solo entra como respaldo si la empresa lo tiene activado. Cuesta
    // el doble, así que es decisión suya.
    if (canal === "SMS" && canales[0] === "WHATSAPP" && !config.sms_respaldo_activo) {
      break;
    }

    const resultado = await enviarPorCanal({
      admin,
      canal,
      credenciales,
      telefono,
      input,
      topeMensualCents: config.tope_mensual_cents,
    });

    if (resultado.ok) return resultado;

    ultimoMotivo = resultado.motivo;
    // Si el fallo no es del canal (credenciales, tope, saldo), probar el
    // siguiente solo gastaría otro mensaje para el mismo error.
    if (!resultado.caerACorreo) return resultado;
  }

  return { ok: false, motivo: ultimoMotivo, caerACorreo: true };
}

/** Un intento por un canal concreto: cobra, envía y devuelve si falla. */
async function enviarPorCanal(args: {
  admin: ReturnType<typeof createAdminClient>;
  canal: CanalMensajeria;
  credenciales: CredencialesProveedor;
  telefono: string;
  input: EnviarMensajeInput;
  topeMensualCents: number | null;
}): Promise<ResultadoMensaje> {
  const { admin, canal, credenciales, telefono, input, topeMensualCents } = args;

  // Precio vigente del canal. Se lee de la base de datos para que la pantalla
  // del monedero y el cobro digan siempre lo mismo.
  const { data: precio } = await admin.rpc("tarifa_mensajeria", { p_canal: canal });
  const costeCents = (precio as number | null) ?? 0;
  if (costeCents <= 0) {
    return { ok: false, motivo: `No hay tarifa para ${canal}`, caerACorreo: true };
  }

  // El tope mensual es el segundo freno, después del saldo: protege de una
  // campaña disparada por error aunque el monedero esté lleno.
  if (topeMensualCents != null) {
    const { data: gastado } = await admin.rpc("gasto_mensajeria_mes", {
      p_empresa_id: input.empresaId,
    });
    if (((gastado as number | null) ?? 0) + costeCents > topeMensualCents) {
      return {
        ok: false,
        motivo: "Se alcanzó el tope de gasto del mes",
        caerACorreo: true,
      };
    }
  }

  const concepto = `${canal === "WHATSAPP" ? "WhatsApp" : "SMS"} · ${etiquetaTipo(input.tipo)}`;

  // ── Registrar el envío ANTES de cobrar ──────────────────────────────
  //
  // Se crea primero para tener su identificador y podérselo pasar al cobro:
  // así cada consumo del extracto apunta al mensaje que lo causó y se puede
  // explicar. Nace como PENDIENTE porque todavía no ha salido nada.
  const { data: filaEnvio, error: errEnvio } = await admin
    .from("mensajeria_envios")
    .insert({
      empresa_id: input.empresaId,
      reserva_id: input.reservaId ?? null,
      canal,
      tipo: input.tipo,
      destinatario: telefono,
      estado: "PENDIENTE",
      coste_cents: 0,
      origen: input.actor?.origen ?? "AUTOMATICO",
      usuario_id: input.actor?.usuarioId ?? null,
      usuario_nombre: input.actor?.usuarioNombre ?? null,
    })
    .select("id")
    .single();

  if (errEnvio || !filaEnvio) {
    return { ok: false, motivo: "No se pudo registrar el envío", caerACorreo: true };
  }
  const envioId = filaEnvio.id as string;

  // ── Cobrar ANTES de enviar ──────────────────────────────────────────
  const { error: errSaldo } = await admin.rpc("consumir_saldo_mensajeria", {
    p_empresa_id: input.empresaId,
    p_importe_cents: costeCents,
    p_concepto: concepto,
    p_mensaje_id: envioId,
    p_usuario_id: input.actor?.usuarioId ?? null,
    p_usuario_nombre: input.actor?.usuarioNombre ?? null,
  });

  if (errSaldo) {
    // SIN_SALDO es el caso normal, no una avería: el aviso sale por correo.
    // El registro queda como fallido para que se vea por qué no salió.
    await admin
      .from("mensajeria_envios")
      .update({
        estado: "FALLIDO",
        error_codigo: "SIN_SALDO",
        error_mensaje: "Saldo insuficiente",
        actualizado_at: new Date().toISOString(),
      })
      .eq("id", envioId);

    return { ok: false, motivo: "Sin saldo suficiente", caerACorreo: true };
  }

  // ── Enviar ──────────────────────────────────────────────────────────
  const envio = await proveedor.enviar(credenciales, {
    canal,
    para: telefono,
    plantilla: canal === "WHATSAPP" ? input.plantillaWhatsapp : undefined,
    variables: canal === "WHATSAPP" ? input.variables : undefined,
    texto: canal === "SMS" ? input.textoSms : undefined,
  });

  await admin
    .from("mensajeria_envios")
    .update({
      estado: envio.ok ? "ENVIADO" : "FALLIDO",
      proveedor_mensaje_id: envio.ok ? envio.proveedorMensajeId : null,
      error_codigo: envio.ok ? null : envio.codigo,
      error_mensaje: envio.ok ? null : envio.error,
      coste_cents: envio.ok ? costeCents : 0,
      actualizado_at: new Date().toISOString(),
    })
    .eq("id", envioId);

  if (!envio.ok) {
    // ── Devolver lo cobrado: el mensaje no salió ──────────────────────
    await admin.rpc("abonar_saldo_mensajeria", {
      p_empresa_id: input.empresaId,
      p_importe_cents: costeCents,
      p_tipo: "DEVOLUCION",
      p_concepto: `Devolución · ${concepto}`,
      p_mensaje_id: envioId,
    });

    return {
      ok: false,
      motivo: envio.error,
      // Solo se prueba el otro canal si el fallo era de este canal.
      caerACorreo: envio.reintentable,
    };
  }

  return { ok: true, canal, envioId, costeCents };
}

function etiquetaTipo(tipo: TipoMensaje): string {
  const etiquetas: Record<TipoMensaje, string> = {
    CONFIRMACION: "confirmación de reserva",
    RECONFIRMACION: "reconfirmación",
    RECORDATORIO: "recordatorio",
    CANCELACION: "cancelación",
    CAMPANA: "campaña",
  };
  return etiquetas[tipo];
}
