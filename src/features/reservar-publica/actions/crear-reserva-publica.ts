"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  completarFichaCliente,
  construirDatosDeclarados,
  deducirMotivoVinculacion,
  findOrLinkClienteSala,
  type CampoDistinto,
} from "@/features/sala/lib/cliente-link";
import { asignarMesaAutomatica } from "@/features/sala/planos/lib/asignacion-mesa";
import { validarMotorWebReserva } from "@/features/sala/lib/motor-web-validar";
import { getCamposObligatoriosReserva } from "@/features/sala/lib/reserva-campos-obligatorios";
import { notificarReservaCreada } from "@/lib/email/reservas/notificar-creada";
import { turnoDeHora } from "@/features/sala/lib/dia-negocio";
import {
  RESERVA_NOMBRE_MAX_CHARS,
  RESERVA_APELLIDOS_MAX_CHARS,
} from "@/features/sala/data/reservas";
import type { SupabaseClient } from "@supabase/supabase-js";

const inputSchema = z.object({
  empresaSlug: z.string().min(1).max(120),
  origen: z.string().regex(/^[A-Z0-9_]+$/).max(32).nullable().optional(),
  // Nombre y apellidos son siempre obligatorios. El teléfono y el email se
  // exigen o no según la configuración de cada empresa, así que aquí solo se
  // valida el formato; la obligatoriedad se comprueba abajo, con la config.
  nombre: z.string().min(1).max(RESERVA_NOMBRE_MAX_CHARS),
  apellidos: z.string().min(1).max(RESERVA_APELLIDOS_MAX_CHARS),
  telefono: z.string().max(40).optional().nullable(),
  email: z.string().email().max(160).optional().nullable(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  personas: z.number().int().min(1).max(50),
  notas: z.string().max(500).optional().nullable(),
  codigo: z.string().min(1).max(64).optional().nullable(),
  ticketProductoId: z.string().guid().optional().nullable(),
  ticketOnly: z.boolean().optional(),
  /**
   * Grupo de zonas elegido por el cliente ("Sala", "Terraza Exterior"). La
   * mesa se asigna solo entre las zonas internas de ese grupo. Obligatorio o
   * no según `exigir_zona_cliente` de la empresa.
   */
  grupoZonaId: z.string().guid().optional().nullable(),
  /** Datos que enriquecen la ficha del cliente. Ninguno bloquea la reserva. */
  fechaNacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  telefonoPrefijo: z.string().max(8).optional().nullable(),
  /** Consentimiento para comunicaciones comerciales (RGPD: nunca premarcado). */
  aceptaMarketing: z.boolean().optional(),
});

export type CrearReservaPublicaInput = z.infer<typeof inputSchema>;

export type CrearReservaPublicaResult =
  | {
      ok: true;
      clienteExistente: boolean;
      camposDistintos: CampoDistinto[];
      datosCliente: {
        nombre: string;
        apellidos: string | null;
        email: string | null;
        telefono: string | null;
      };
      /** PRP-052: si se aplicó un cupón, código + título visible al cliente. */
      cuponAplicado: { codigo: string; tituloCliente: string } | null;
    }
  | { ok: false; error: string };

export async function crearReservaPublicaAction(
  input: CrearReservaPublicaInput,
): Promise<CrearReservaPublicaResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos" };
  }
  const data = parsed.data;
  const admin = createAdminClient();

  const { data: empresa, error: errEmpresa } = await admin
    .from("empresas")
    .select("id, nombre")
    .eq("slug", data.empresaSlug)
    .maybeSingle();
  if (errEmpresa || !empresa) {
    return { ok: false, error: "Restaurante no encontrado" };
  }

  // Campos obligatorios configurables por empresa (email / teléfono), marcados
  // en Ajustes → Departamentos → Sala → Reservas. Se comprueba en servidor: el
  // navegador puede saltarse el `required` del formulario.
  const { email: exigeEmail, telefono: exigeTelefono } =
    await getCamposObligatoriosReserva(empresa.id as string);
  if (exigeTelefono && (data.telefono ?? "").trim().length < 5) {
    return { ok: false, error: "El teléfono es obligatorio." };
  }
  if (exigeEmail && !(data.email ?? "").trim()) {
    return { ok: false, error: "El email es obligatorio." };
  }
  // Sin teléfono ni email no hay forma de avisar al cliente ni de vincular su
  // ficha (la BD exige cliente_id cuando hay contacto), así que pedimos uno.
  if (!(data.telefono ?? "").trim() && !(data.email ?? "").trim()) {
    return { ok: false, error: "Indica un teléfono o un email de contacto." };
  }

  // Preferencias del motor web (cierre del día actual, tope personas/hora,
  // intervalos). Aplicar antes que cualquier otro side-effect.
  const turno = turnoDeHora(data.hora);
  const motor = await validarMotorWebReserva(admin, {
    empresaId: empresa.id as string,
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
    turno,
  });
  if (!motor.ok) {
    return { ok: false, error: motor.error };
  }

  // PRP-052: validar cupón y consumir stock atómicamente. Si falla, abortamos
  // sin crear reserva. Regla del dueño: cupón NO coexiste con ticket.
  let codigoId: string | null = null;
  let codigoTexto: string | null = null;
  let cuponTituloCliente: string | null = null;
  if (data.codigo) {
    if (data.ticketProductoId) {
      return { ok: false, error: "Una reserva con ticket no puede llevar cupón." };
    }
    const norm = data.codigo.toUpperCase().replace(/\s+/g, "");
    const { data: vRows, error: vErr } = await admin.rpc("validar_cupon", {
      p_empresa_id: empresa.id,
      p_codigo: norm,
      p_fecha: data.fecha,
      p_turno: turno,
    });
    if (vErr) {
      console.error("[reservar-publica] validar_cupon:", vErr);
      return { ok: false, error: "No se pudo validar el cupón." };
    }
    const row = (vRows ?? [])[0] as {
      ok: boolean;
      motivo: string | null;
      cupon_id: string | null;
      titulo_cliente_efectivo: string | null;
    } | undefined;
    if (!row?.ok) {
      const motivo = row?.motivo ?? "NO_EXISTE";
      const labelMap: Record<string, string> = {
        NO_EXISTE: "Cupón no válido.",
        INACTIVO: "Cupón inactivo.",
        CADUCADO: "Cupón caducado.",
        AGOTADO: "Cupón agotado.",
        DIA_NO_PERMITIDO: "El cupón no es válido este día.",
        TURNO_NO_PERMITIDO: "El cupón no es válido para este turno.",
      };
      return { ok: false, error: labelMap[motivo] ?? "Cupón no válido." };
    }
    const { error: cErr } = await admin.rpc("consumir_stock_cupon", {
      p_codigo_id: row.cupon_id,
      p_personas: data.personas,
    });
    if (cErr) {
      const msg = cErr.message ?? "";
      if (msg.includes("AGOTADO")) return { ok: false, error: "Cupón agotado." };
      console.error("[reservar-publica] consumir_stock_cupon:", cErr);
      return { ok: false, error: "No se pudo aplicar el cupón." };
    }
    codigoId = row.cupon_id;
    codigoTexto = norm;
    cuponTituloCliente = row.titulo_cliente_efectivo;
  }

  // Vincular o crear ficha de cliente (match por email O teléfono normalizado dentro de la empresa).
  const link = await findOrLinkClienteSala(admin, {
    empresaId: empresa.id,
    nombre: data.nombre,
    apellidos: data.apellidos,
    email: data.email,
    telefono: data.telefono,
  });
  if (!link.ok) {
    console.error("[reservar-publica] vincular cliente:", link.error);
    return { ok: false, error: "No pudimos vincular tu ficha de cliente" };
  }
  const cliente = link.result.cliente;

  // Datos extra de la ficha: rellenan huecos, nunca pisan lo que ya hubiera.
  await completarFichaCliente(admin as unknown as SupabaseClient, cliente.id, {
    fechaNacimiento: data.fechaNacimiento ?? null,
    telefonoPrefijo: data.telefonoPrefijo ?? null,
    aceptaMarketing: data.aceptaMarketing ?? false,
    origen: data.origen ?? "RESERVA_WEB",
  });

  // ────────────────────────────────────────────────────────────────
  // PRP-051: rama Ticket. Validar bloqueo + consumir stock atómico.
  // En enlaces "solo ticket" (`ticketOnly`) el producto es obligatorio.
  // Defensa: re-leemos `vende_tickets` desde BD usando el origen (= palabra
  // clave del link). Así, aunque el cliente envíe `ticketOnly=false`, si el
  // enlace está marcado como dedicado a ticket NO permitimos reserva sin producto.
  // ────────────────────────────────────────────────────────────────
  let ticketProductoIdFinal: string | null = null;
  let ticketUnidadesFinal: number | null = null;
  let ticketImporteFinal: number | null = null;
  let ticketIvaFinal: number | null = null;
  let tipoCategoriaFinal: string | null = null;
  let pagoPendienteFinal = false;

  let linkRequiereTicket = false;
  if (data.origen) {
    const { data: linkRow } = await admin
      .from("reserva_links")
      .select("vende_tickets")
      .eq("empresa_id", empresa.id)
      .eq("palabra_clave", data.origen)
      .eq("activo", true)
      .maybeSingle();
    linkRequiereTicket = Boolean(linkRow?.vende_tickets);
  }
  const ticketObligatorio = data.ticketOnly || linkRequiereTicket;

  if (ticketObligatorio && !data.ticketProductoId) {
    return { ok: false, error: "Este enlace solo acepta reservas con ticket y no quedan plazas disponibles. Contacta con el restaurante." };
  }
  if (data.ticketProductoId) {
    const bloqueo = await admin
      .from("cliente_ticket_bloqueos")
      .select("id", { head: true, count: "exact" })
      .eq("empresa_id", empresa.id)
      .eq("cliente_id", cliente.id)
      .is("desbloqueado_at", null);
    if (bloqueo.error) {
      console.error("[reservar-publica] check bloqueo:", bloqueo.error);
      return { ok: false, error: "No pudimos validar tu cuenta." };
    }
    if ((bloqueo.count ?? 0) > 0) {
      return {
        ok: false,
        error: "Tu cuenta tiene un bloqueo por inasistencia previa. Contacta con el restaurante.",
      };
    }
    const producto = await admin
      .from("reserva_ticket_productos")
      .select("id, precio, iva, modo_precio, activo, empresa_id")
      .eq("id", data.ticketProductoId)
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    if (producto.error || !producto.data) {
      return { ok: false, error: "Producto no disponible." };
    }
    if (!producto.data.activo) {
      return { ok: false, error: "Este producto ya no está disponible." };
    }
    const unidades = producto.data.modo_precio === "por_persona" ? data.personas : 1;
    const precio = Number(producto.data.precio);
    const iva = Number(producto.data.iva);
    const consumo = await admin.rpc("consumir_stock_ticket", {
      p_producto_id: data.ticketProductoId,
      p_unidades: unidades,
    });
    if (consumo.error) {
      const msg = consumo.error.message ?? "";
      if (msg.includes("AGOTADO")) {
        return { ok: false, error: "Producto agotado." };
      }
      console.error("[reservar-publica] consumir_stock_ticket:", consumo.error);
      return { ok: false, error: "No pudimos reservar el stock." };
    }
    ticketProductoIdFinal = data.ticketProductoId;
    ticketUnidadesFinal = unidades;
    ticketImporteFinal = Number((precio * unidades).toFixed(2));
    ticketIvaFinal = iva;
    tipoCategoriaFinal = "ticket";
    pagoPendienteFinal = true;
  }

  // Asignación automática de mesa OBLIGATORIA (regla de negocio):
  // o hay mesa libre, o NO se acepta la reserva. Coge el primer local de
  // la empresa (las empresas hoy tienen 1 local; cuando aparezcan
  // multi-local habrá que añadir selector en el form público).
  const { data: local } = await admin
    .from("locales")
    .select("id")
    .eq("empresa_id", empresa.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!local) {
    console.error("[reservar-publica] sin local para empresa", empresa.id);
    return { ok: false, error: "No podemos aceptar reservas online ahora mismo. Inténtalo más tarde." };
  }
  // CUPO DEL TURNO (manda sobre las mesas).
  // Si la empresa tiene tope de comensales, ese límite va PRIMERO: aunque
  // queden mesas, si el turno está al tope no se acepta. Si no hay tope,
  // `try_reservar_slot` concede siempre y el límite real son las mesas.
  //
  // Se reserva ANTES de la mesa y con el mismo candado que usa Google, para
  // que ambos canales cuenten sobre el mismo saldo y no se vendan dos veces
  // las mismas plazas.
  const { data: cupoOk, error: errCupo } = await admin.rpc("try_reservar_slot", {
    p_empresa_id: empresa.id,
    p_fecha: data.fecha,
    p_turno: turno,
    p_personas: data.personas,
  });
  if (errCupo) {
    console.error("[reservar-publica] try_reservar_slot:", errCupo);
    return { ok: false, error: "No pudimos procesar la reserva. Inténtalo de nuevo en unos minutos." };
  }
  if (cupoOk !== true) {
    // El tope es del TURNO completo: no se sugiere otra hora porque todas las
    // del turno están igual de llenas.
    return {
      ok: false,
      error: `Lo sentimos, ya no quedan mesas libres para ${turno === "COMIDA" ? "la comida" : "la cena"} del ${data.fecha}.`,
    };
  }

  /** El cupo ya está apartado: hay que devolverlo si la reserva no llega a crearse. */
  const liberarCupo = async () => {
    try {
      await admin.rpc("liberar_slot_manual", {
        p_empresa_id: empresa.id,
        p_fecha: data.fecha,
        p_turno: turno,
        p_personas: data.personas,
      });
    } catch (e) {
      console.error("[reservar-publica] liberar_slot_manual:", e);
    }
  };

  // Grupo de zonas: el cliente eligió "Sala" o "Terraza", que agrupa varias
  // zonas internas. La mesa debe salir de ahí y solo de ahí.
  let zonaIdsPermitidas: string[] | null = null;
  let grupoZonaIdFinal: string | null = null;
  {
    const { data: cfgZona } = await admin
      .from("empresa_reservas_config")
      .select("exigir_zona_cliente")
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    const exigeZona = (cfgZona?.exigir_zona_cliente as boolean) ?? false;

    if (data.grupoZonaId) {
      // El grupo debe ser de ESTE local y estar activo: si no, un id manipulado
      // podría colar mesas de otro sitio.
      const { data: grupo } = await admin
        .from("grupos_zonas")
        .select("id, local_id, activa")
        .eq("id", data.grupoZonaId)
        .maybeSingle();
      if (!grupo || grupo.local_id !== local.id || !grupo.activa) {
        await liberarCupo();
        return { ok: false, error: "La zona elegida ya no está disponible. Vuelve a elegir." };
      }
      const { data: rel } = await admin
        .from("grupo_zona_zonas")
        .select("zona_id")
        .eq("grupo_zona_id", data.grupoZonaId);
      const ids = (rel ?? []).map((r) => r.zona_id as string);
      if (ids.length === 0) {
        await liberarCupo();
        return { ok: false, error: "La zona elegida no tiene mesas configuradas." };
      }
      zonaIdsPermitidas = ids;
      grupoZonaIdFinal = data.grupoZonaId;
    } else if (exigeZona) {
      await liberarCupo();
      return { ok: false, error: "Elige una zona para completar la reserva." };
    }
  }

  const asign = await asignarMesaAutomatica(admin as unknown as SupabaseClient, {
    localId: local.id as string,
    empresaId: empresa.id,
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
    zonaIds: zonaIdsPermitidas,
  });
  if (!asign.ok || !asign.mesa) {
    await liberarCupo();
    // Diferenciamos config rota vs. lleno para que se vea en logs.
    if (!asign.ok && asign.razon === "SIN_PLANO_ACTIVO") {
      console.error("[reservar-publica] sin plano activo en local", local.id);
      return { ok: false, error: "No podemos aceptar reservas online ahora mismo. Inténtalo más tarde." };
    }
    if (!asign.ok) {
      console.error("[reservar-publica] error asignando mesa:", asign.detalle);
      return { ok: false, error: "No pudimos procesar la reserva. Inténtalo de nuevo en unos minutos." };
    }
    // mesa=null: SIN_CANDIDATAS o SIN_MESAS_LIBRES → local lleno para esa
    // combinación de fecha, hora y comensales.
    return {
      ok: false,
      // Aquí sí es de ESA hora concreta (faltan mesas, no cupo), así que probar
      // otra hora es un consejo útil.
      error: `Lo sentimos, no quedan mesas libres para ${data.personas} ${data.personas === 1 ? "persona" : "personas"} el ${data.fecha} a las ${data.hora.slice(0, 5)}. Prueba con otra hora.`,
    };
  }
  const mesaFinal: string = asign.mesa.codigo;
  const zonaFinal: string | null = asign.mesa.zonaNombre || null;

  // ────────────────────────────────────────────────────────────────
  // Vinculación pendiente de revisión.
  //
  // La reserva ha enganchado con una ficha que ya existía (por email o por
  // teléfono, nunca por nombre) pero el resto de datos no coinciden. Puede ser
  // la misma persona con otro nombre, o alguien distinto usando el móvil de un
  // familiar. Eso no lo puede decidir el sistema: se conserva lo que escribió
  // y lo resuelve el restaurante desde la ficha de la reserva.
  // ────────────────────────────────────────────────────────────────
  const camposDistintos = link.result.camposDistintos;
  const hayQueRevisar = link.result.existed && camposDistintos.length > 0;
  const datosDeclarados = hayQueRevisar
    ? construirDatosDeclarados(camposDistintos, {
        nombre: data.nombre,
        apellidos: data.apellidos,
        email: data.email,
        telefono: data.telefono,
      })
    : null;
  const motivoVinculacion = hayQueRevisar
    ? deducirMotivoVinculacion(camposDistintos, data.email)
    : null;

  // Id generado en código para poder disparar el correo sin releer la fila.
  const reservaId = crypto.randomUUID();
  const { error } = await admin.from("reservas").insert({
    id: reservaId,
    empresa_id: empresa.id,
    cliente_id: cliente.id,
    // Snapshot de la reserva = datos canónicos de la ficha (los originales mandan).
    cliente_nombre: cliente.nombre,
    cliente_apellidos: cliente.apellidos,
    cliente_telefono: cliente.telefono,
    // Excepción: el correo de confirmación tiene que llegarle a QUIEN ha
    // reservado, no al titular de la ficha. Si enganchó por teléfono y aportó
    // otro email, ése es su buzón; mandarlo al de la ficha avisaría a alguien
    // que no ha reservado (y le revelaría datos de un tercero).
    cliente_email: datosDeclarados?.email ?? cliente.email,
    datos_declarados: datosDeclarados,
    vinculacion_motivo: motivoVinculacion,
    vinculacion_estado: hayQueRevisar ? "PENDIENTE" : null,
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
    mesa: mesaFinal,
    // `zona` = zona interna real (la que ve el staff en el listado).
    // `grupo_zona_id` = lo que eligió el cliente (lo que lee en el correo).
    zona: zonaFinal,
    grupo_zona_id: grupoZonaIdFinal,
    notas: data.notas ?? null,
    // Esta reserva ENTRA por el motor de la web: aunque no venga con la palabra
    // clave de un enlace de campaña, su origen es la web y así debe constar.
    // Con `null` el listado la daba por "Manual", que es justo lo contrario:
    // parecía que la había metido alguien del restaurante a mano.
    origen: data.origen ?? "RESERVA_WEB",
    estado: "CONFIRMADA",
    turno,
    codigo_id: codigoId,
    codigo: codigoTexto,
    tipo_categoria: tipoCategoriaFinal,
    ticket_producto_id: ticketProductoIdFinal,
    ticket_unidades: ticketUnidadesFinal,
    ticket_importe: ticketImporteFinal,
    ticket_iva: ticketIvaFinal,
    pago_pendiente: pagoPendienteFinal,
  });
  if (error) {
    // Sin fila de reserva, el trigger de cancelación nunca devolvería el cupo:
    // hay que soltarlo a mano o el turno quedaría ocupado por una reserva
    // que no existe.
    await liberarCupo();
    console.error("[reservar-publica] insert error:", error);
    return { ok: false, error: "No pudimos crear la reserva" };
  }

  await admin.rpc("registrar_visita_cliente_sala", {
    p_cliente_id: cliente.id,
    p_fecha: data.fecha,
  });

  // Correo de confirmación. La reserva web se acepta al momento (o se rechaza
  // por falta de mesa), así que el cliente debe recibir su confirmación igual
  // que si la hubiéramos dado de alta desde Sala.
  //
  // Fire-and-forget A PROPÓSITO: la reserva YA está creada y es válida. Si el
  // correo falla (SMTP caído, plantilla desactivada), no se puede deshacer la
  // reserva ni tiene sentido mostrarle un error al cliente: se registra en log
  // y el restaurante la ve igualmente en Sala.
  notificarReservaCreada(reservaId).catch((e) =>
    console.error("[reservar-publica] mail CONFIRMACION:", e),
  );

  return {
    ok: true,
    clienteExistente: link.result.existed,
    camposDistintos: link.result.camposDistintos,
    datosCliente: {
      nombre: cliente.nombre,
      apellidos: cliente.apellidos,
      email: cliente.email,
      telefono: cliente.telefono,
    },
    cuponAplicado: codigoTexto && cuponTituloCliente
      ? { codigo: codigoTexto, tituloCliente: cuponTituloCliente }
      : null,
  };
}
