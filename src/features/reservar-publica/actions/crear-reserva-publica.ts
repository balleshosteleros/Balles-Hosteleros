"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrLinkClienteSala, type CampoDistinto } from "@/features/sala/lib/cliente-link";
import { asignarMesaAutomatica } from "@/features/sala/planos/lib/asignacion-mesa";
import { validarMotorWebReserva } from "@/features/sala/lib/motor-web-validar";
import type { SupabaseClient } from "@supabase/supabase-js";

const inputSchema = z.object({
  empresaSlug: z.string().min(1).max(120),
  origen: z.string().regex(/^[A-Z0-9_]+$/).max(32).nullable().optional(),
  nombre: z.string().min(1).max(120),
  apellidos: z.string().max(120).optional().nullable(),
  telefono: z.string().min(5).max(40),
  email: z.string().email().max(160).optional().nullable(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  personas: z.number().int().min(1).max(50),
  notas: z.string().max(500).optional().nullable(),
  codigo: z.string().min(1).max(64).optional().nullable(),
  ticketProductoId: z.string().guid().optional().nullable(),
  ticketOnly: z.boolean().optional(),
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

  // Preferencias del motor web (cierre del día actual, tope personas/hora,
  // intervalos). Aplicar antes que cualquier otro side-effect.
  const horaMin = parseInt(data.hora.slice(0, 2), 10) * 60
    + parseInt(data.hora.slice(3, 5), 10);
  const turno: "COMIDA" | "CENA" = horaMin < 18 * 60 ? "COMIDA" : "CENA";
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
    return { ok: false, error: "No podemos aceptar reservas online ahora mismo. Llámanos para reservar." };
  }
  const asign = await asignarMesaAutomatica(admin as unknown as SupabaseClient, {
    localId: local.id as string,
    empresaId: empresa.id,
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
  });
  if (!asign.ok || !asign.mesa) {
    // Diferenciamos config rota vs. lleno para que se vea en logs.
    if (!asign.ok && asign.razon === "SIN_PLANO_ACTIVO") {
      console.error("[reservar-publica] sin plano activo en local", local.id);
      return { ok: false, error: "No podemos aceptar reservas online ahora mismo. Llámanos para reservar." };
    }
    if (!asign.ok) {
      console.error("[reservar-publica] error asignando mesa:", asign.detalle);
      return { ok: false, error: "No pudimos procesar la reserva. Inténtalo de nuevo o llámanos." };
    }
    // mesa=null: SIN_CANDIDATAS o SIN_MESAS_LIBRES → local lleno para esa
    // combinación de fecha, hora y comensales.
    return {
      ok: false,
      error: `Lo sentimos, no quedan mesas libres para ${data.personas} ${data.personas === 1 ? "persona" : "personas"} el ${data.fecha} a las ${data.hora.slice(0, 5)}. Prueba con otra hora o llámanos.`,
    };
  }
  const mesaFinal: string = asign.mesa.codigo;
  const zonaFinal: string | null = asign.mesa.zonaNombre || null;

  const { error } = await admin.from("reservas").insert({
    empresa_id: empresa.id,
    cliente_id: cliente.id,
    // Snapshot de la reserva = datos canónicos de la ficha (los originales mandan).
    cliente_nombre: cliente.nombre,
    cliente_apellidos: cliente.apellidos,
    cliente_telefono: cliente.telefono,
    cliente_email: cliente.email,
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
    mesa: mesaFinal,
    zona: zonaFinal,
    notas: data.notas ?? null,
    origen: data.origen ?? null,
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
    console.error("[reservar-publica] insert error:", error);
    return { ok: false, error: "No pudimos crear la reserva" };
  }

  await admin.rpc("registrar_visita_cliente_sala", {
    p_cliente_id: cliente.id,
    p_fecha: data.fecha,
  });

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
