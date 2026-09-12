"use server";

/**
 * Devolver a un cliente dinero YA COBRADO por la pasarela.
 *
 * Hasta ahora el software solo sabía cobrar. Una devolución había que hacerla
 * a mano dentro de Revolut, y el software no se enteraba: la reserva seguía
 * diciendo "cobrada" para siempre y el dinero devuelto no aparecía en ningún
 * sitio. Así se perdió el rastro de dos devoluciones de 4 € del 03-09-2026.
 *
 * Tres candados, porque esto saca dinero de la cuenta del restaurante:
 *
 *   1. PERMISO — hace falta DIRECCIÓN con edición en Ajustes → Roles. No se
 *      mira el nombre del rol: manda el permiso configurado, como en todo el
 *      software. Cualquier rol al que se le dé ese permiso podrá devolver.
 *   2. CONTRASEÑA — se vuelve a pedir la del propio usuario. Que alguien pase
 *      por delante de una sesión abierta no puede bastar para mover dinero.
 *   3. MOTIVO — obligatorio y queda escrito con el nombre de quien devolvió.
 *
 * La devolución queda en `reserva_cobros` con importe NEGATIVO: sumar esa
 * columna por reserva da el neto real sin interpretar estados.
 *
 * ⚠️ Revolut NO devuelve su comisión de cobro. Devolver 4 € de un cobro de 4 €
 * deja al restaurante en -0,24 €. La pantalla lo avisa antes de confirmar.
 */

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { getCredencialesRevolut } from "@/features/ajustes/actions/revolut-config-actions";
import { devolverOrden } from "@/lib/revolut/merchant";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ConceptoDevolucion = "garantia" | "cancelacion" | "ticket";

export interface DevolverInput {
  reservaId: string;
  concepto: ConceptoDevolucion;
  /** Importe en euros. Puede ser menos de lo cobrado: devolución parcial. */
  importe: number;
  motivo: string;
  /** La contraseña del propio usuario, para confirmar que es él. */
  password: string;
}

type Result = { ok: true; devuelto: number } | { ok: false; error: string };

/** Lo cobrado y lo ya devuelto de un concepto, en euros. */
export async function getResumenDevolucion(
  reservaId: string,
  concepto: ConceptoDevolucion,
): Promise<{ cobrado: number; devuelto: number; disponible: number }> {
  const admin = createAdminClient();

  // Un ticket se pagó ANTES de existir la reserva: lo cobrado está en la
  // compra, no en las columnas de cobro de la reserva.
  let cobradoBase = 0;
  if (concepto === "ticket") {
    const { data: reserva } = await admin
      .from("reservas")
      .select("ticket_compra_id")
      .eq("id", reservaId)
      .maybeSingle();
    if (reserva?.ticket_compra_id) {
      const { data: compra } = await admin
        .from("reserva_ticket_compras")
        .select("importe_total, pagado_at")
        .eq("id", reserva.ticket_compra_id as string)
        .maybeSingle();
      if (compra?.pagado_at) cobradoBase = Number(compra.importe_total ?? 0);
    }
  }

  const { data } = await admin
    .from("reserva_cobros")
    .select("importe, estado")
    .eq("reserva_id", reservaId)
    .eq("concepto", concepto);

  let cobrado = cobradoBase;
  let devuelto = 0;
  for (const fila of (data ?? []) as { importe: number; estado: string }[]) {
    const importe = Number(fila.importe ?? 0);
    if (fila.estado === "cobrado") cobrado += importe;
    if (fila.estado === "devuelto") devuelto += Math.abs(importe);
  }
  return { cobrado, devuelto, disponible: Number((cobrado - devuelto).toFixed(2)) };
}

/**
 * ¿El departamento del usuario está autorizado a devolver?
 *
 * Lo mira la pantalla para enseñar u ocultar el botón, y LO VUELVE A MIRAR la
 * acción antes de mover un euro: esconder un botón no es un candado.
 */
export async function puedeDevolver(): Promise<boolean> {
  // El DEPARTAMENTO del usuario es global (es el mismo en todas sus empresas),
  // pero la autorización se configura en CADA empresa. Hay que leer la de la
  // empresa activa —la de la cookie—, no la de la ficha del usuario: quien
  // trabaja en dos restaurantes tiene su ficha en uno y puede estar mirando el
  // otro, y leería la configuración equivocada.
  const { departamento } = await getRolContext();
  if (!departamento) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  if (!empresaId) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("empresa_reservas_config")
    .select("devolucion_departamentos")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const autorizados = (data?.devolucion_departamentos as string[] | null) ?? [];
  // Se comparan sin mayúsculas ni acentos sueltos: "Dirección" y "DIRECCIÓN"
  // son el mismo departamento y nadie debería quedarse fuera por eso.
  const norm = (t: string) =>
    t.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return autorizados.some((d) => norm(d) === norm(departamento));
}

export async function devolverCobroAction(input: DevolverInput): Promise<Result> {
  const motivo = input.motivo?.trim() ?? "";
  if (motivo.length < 3) {
    return { ok: false, error: "Escribe el motivo de la devolución." };
  }
  if (!(input.importe > 0)) {
    return { ok: false, error: "El importe a devolver tiene que ser mayor que cero." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Sesión no válida." };

  // ── Candado 1: el departamento, no el rol ─────────────────────────
  //
  // Se decide en Reservas → Configuración, con la lista de departamentos
  // autorizados. De fábrica solo DIRECCIÓN.
  if (!(await puedeDevolver())) {
    return { ok: false, error: "Tu departamento no puede devolver cobros." };
  }

  // ── Candado 2: que vuelva a teclear su contraseña ─────────────────
  //
  // Se comprueba con un cliente APARTE, sin cookies: iniciar sesión con el
  // cliente de la petición sustituiría la sesión abierta del usuario.
  const verificador = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: errPass } = await verificador.auth.signInWithPassword({
    email: user.email,
    password: input.password ?? "",
  });
  if (errPass) return { ok: false, error: "La contraseña no es correcta." };

  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  if (!empresaId) return { ok: false, error: "No hay empresa activa." };

  const admin = createAdminClient();

  const { data: reserva } = await admin
    .from("reservas")
    .select(
      "id, empresa_id, cliente_nombre, garantia_revolut_order_id, cancelacion_revolut_order_id, ticket_compra_id",
    )
    .eq("id", input.reservaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!reserva) return { ok: false, error: "Reserva no encontrada." };

  let orderId: string | null = null;
  if (input.concepto === "garantia") {
    orderId = reserva.garantia_revolut_order_id as string | null;
  } else if (input.concepto === "cancelacion") {
    orderId = reserva.cancelacion_revolut_order_id as string | null;
  } else if (reserva.ticket_compra_id) {
    const { data: compra } = await admin
      .from("reserva_ticket_compras")
      .select("revolut_order_id")
      .eq("id", reserva.ticket_compra_id as string)
      .maybeSingle();
    orderId = (compra?.revolut_order_id as string | null) ?? null;
  }
  if (!orderId) {
    return { ok: false, error: "Este cobro no tiene un pago en la pasarela." };
  }

  // No se puede devolver más de lo que queda por devolver: Revolut lo
  // rechazaría, pero el aviso tiene que llegar antes y en cristiano.
  const resumen = await getResumenDevolucion(input.reservaId, input.concepto);
  if (resumen.disponible <= 0) {
    return { ok: false, error: "Este cobro ya está devuelto por completo." };
  }
  if (input.importe > resumen.disponible) {
    return {
      ok: false,
      error: `Solo quedan ${resumen.disponible.toFixed(2).replace(".", ",")} € por devolver.`,
    };
  }

  const cred = await getCredencialesRevolut(empresaId);
  if (!cred) return { ok: false, error: "La pasarela no está configurada." };

  const { data: usuario } = await admin
    .from("usuarios")
    .select("id, nombre")
    .eq("user_id", user.id)
    .maybeSingle();

  // El apunte se escribe ANTES de llamar a Revolut, igual que un cobro: si el
  // proceso muere a mitad, queda constancia de que se pidió la devolución en
  // lugar de desaparecer sin rastro.
  const referencia = `dev-${input.reservaId.slice(0, 8)}-${Date.now()}`;
  const { data: apunte, error: errApunte } = await admin
    .from("reserva_cobros")
    .insert({
      empresa_id: empresaId,
      reserva_id: input.reservaId,
      concepto: input.concepto,
      importe: -Math.abs(input.importe),
      estado: "lanzado",
      referencia,
      revolut_order_id: orderId,
      usuario_id: usuario?.id ?? null,
      error: motivo,
    })
    .select("id")
    .single();
  if (errApunte || !apunte) {
    console.error("[devolucion] apunte:", errApunte);
    return { ok: false, error: "No se pudo registrar la devolución." };
  }

  const res = await devolverOrden({
    secretKey: cred.secretKey,
    entorno: cred.entorno,
    orderId,
    importe: input.importe,
    descripcion: `${motivo} · ${usuario?.nombre ?? user.email}`,
  });

  if (!res.ok) {
    await admin
      .from("reserva_cobros")
      .update({ estado: "fallido", error: `${motivo} — ${res.error}` })
      .eq("id", apunte.id);
    return { ok: false, error: `Revolut rechazó la devolución: ${res.error}` };
  }

  await admin
    .from("reserva_cobros")
    .update({
      estado: "devuelto",
      revolut_estado: String(res.orden.state ?? ""),
      comprobado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", apunte.id);

  revalidatePath("/sala/reservas");
  return { ok: true, devuelto: input.importe };
}
