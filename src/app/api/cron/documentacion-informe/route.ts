/**
 * Cron endpoint: parte diario de la RECOGIDA DE DATOS DE LA FICHA.
 *
 * Desde el 12-sep-2026 no va solo de los tres papeles: cuenta TODO lo que le
 * falta a cada ficha de lo que depende del trabajador —teléfono, fecha de
 * nacimiento, Seguridad Social, cuenta, domicilio, contacto de emergencia,
 * talla y documentos—, que es exactamente lo mismo que le tapa la app hasta que
 * lo rellene. La lista sale de `ficha-incompleta.ts`, la MISMA que usa el
 * bloqueo: si cada uno tuviera la suya, el correo reclamaría cosas que la app da
 * por buenas.
 *
 * Lo que NO se le reclama a él y sí sale aparte, al final: las CONDICIONES
 * (salario). Las pone la empresa ficha a ficha, así que es una lista de deberes
 * nuestros, no suyos.
 *
 * El correo cuenta cómo va sin tener que entrar a mirar: quién lo ha entregado
 * y, sobre todo, **quién ha entrado en la app y aun así no lo ha hecho**, que es
 * la lista que de verdad hace falta para poder reclamar.
 *
 * «Ha entrado» sale del ÚLTIMO INICIO DE SESIÓN que guarda el propio Supabase
 * (`auth.users.last_sign_in_at`), no de `usuarios.ultima_actividad`: ese campo
 * está VACÍO en casi todo el mundo —lo mantiene la app y apenas se escribe—, y
 * apoyarse en él dejaba la lista de «han entrado y no lo han subido» siempre a
 * cero, que es justo la que sirve para reclamar. `last_sign_in_at` lo escribe
 * Supabase en cada login y está relleno para todos.
 *
 * Se apaga solo: cuando no queda nadie pendiente manda un último correo diciendo
 * que está cerrado y deja de escribir. No hay que acordarse de quitarlo.
 *
 * Solo acepta llamadas con header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import {
  COLUMNAS_REVISION,
  fundirFichas,
  loQueFalta,
} from "@/features/primer-acceso/lib/ficha-incompleta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A quién se le manda el parte. */
const DESTINO = "balleshosteleros@gmail.com";

/**
 * Día en que el aviso llegó DE VERDAD a producción (no en el que se escribió el
 * código). Quien entró antes de esta fecha no pudo verlo, y marcarlo como «ha
 * entrado y ha pasado del aviso» sería acusarle de ignorar algo que no existía.
 *
 * 12-sep-2026: el aviso pasa a pedir la ficha entera y a taparlo todo. La hora
 * es la del despliegue, no la de medianoche: quien entró esta misma mañana lo
 * hizo cuando todavía no se le pedía el teléfono, y sacarlo en la lista de «ha
 * pasado del aviso» sería acusarle de ignorar algo que aún no existía.
 */
const AVISO_DESDE = "2026-09-11T16:39:08Z";

function fila(nombre: string, empresa: string, detalle: string): string {
  return `<tr>
    <td style="padding:7px 10px;border-bottom:1px solid #eee">${nombre}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #eee;color:#666">${empresa}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #eee;color:#666">${detalle}</td>
  </tr>`;
}

function tabla(titulo: string, color: string, filas: string[]): string {
  if (filas.length === 0) return "";
  return `
    <h3 style="margin:22px 0 8px;font-size:14px;color:${color}">${titulo} (${filas.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">${filas.join("")}</table>`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/documentacion-informe] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("empleados")
    .select(`id, nombre, apellidos, user_id, empresas(nombre), ${COLUMNAS_REVISION}`)
    .eq("estado", "Activo");

  if (error) {
    console.error("[cron/documentacion-informe]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const filas = (data ?? []) as unknown as Record<string, unknown>[];

  /**
   * Se agrupa POR PERSONA, no por ficha. Quien trabaja en las dos sociedades
   * tiene dos fichas con los mismos datos personales: listarlo dos veces haría
   * reclamar dos veces lo mismo, y contar 28 pendientes donde hay 19 personas.
   */
  const porPersona = new Map<
    string,
    { nombre: string; empresas: Set<string>; fichas: Record<string, unknown>[]; userId: string | null }
  >();

  for (const f of filas) {
    const rel = f.empresas as { nombre?: string } | { nombre?: string }[] | null;
    const empresa = (Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre) ?? "—";
    const userId = (f.user_id as string | null) ?? null;
    // Sin `user_id` no hay con quién agruparla: la ficha va por su cuenta.
    const clave = userId ?? `ficha:${String(f.id)}`;
    const ya = porPersona.get(clave);
    if (ya) {
      ya.empresas.add(empresa);
      ya.fichas.push(f);
    } else {
      porPersona.set(clave, {
        nombre: `${String(f.nombre ?? "")} ${String(f.apellidos ?? "")}`.trim(),
        empresas: new Set([empresa]),
        fichas: [f],
        userId,
      });
    }
  }

  // Última vez que cada persona inició sesión, según el propio Supabase.
  const actividad = new Map<string, string | null>();
  const { data: cuentas } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of cuentas?.users ?? []) {
    actividad.set(u.id, u.last_sign_in_at ?? null);
  }

  const completos: string[] = [];
  const vistoSinHacer: string[] = [];
  const sinEntrar: string[] = [];

  for (const p of porPersona.values()) {
    const empresas = [...p.empresas].sort().join(" · ");
    const pendientes = loQueFalta(fundirFichas(p.fichas));

    if (pendientes.length === 0) {
      completos.push(fila(p.nombre, empresas, "ficha completa"));
      continue;
    }

    const ultima = p.userId ? actividad.get(p.userId) ?? null : null;
    const haEntrado = Boolean(ultima && ultima > AVISO_DESDE);
    const detalle = `falta ${pendientes.map((c) => c.etiqueta).join(", ")}`;

    if (haEntrado) {
      const dia = String(ultima).slice(0, 10).split("-").reverse().join("-");
      vistoSinHacer.push(fila(p.nombre, empresas, `${detalle} · entró el ${dia}`));
    } else {
      sinEntrar.push(fila(p.nombre, empresas, `${detalle} · no ha entrado`));
    }
  }

  /**
   * Lo que NO depende del trabajador: las condiciones (salario) las pone la
   * empresa, y van por FICHA —una persona en dos sociedades cobra en cada una—,
   * así que esta lista sí se cuenta ficha a ficha.
   */
  const { data: conCondiciones } = await supabase
    .from("empleado_condiciones")
    .select("empleado_id");
  const tieneCondiciones = new Set((conCondiciones ?? []).map((c) => String(c.empleado_id)));

  const sinCondiciones: string[] = [];
  for (const f of filas) {
    if (tieneCondiciones.has(String(f.id))) continue;
    const rel = f.empresas as { nombre?: string } | { nombre?: string }[] | null;
    const empresa = (Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre) ?? "—";
    const nombre = `${String(f.nombre ?? "")} ${String(f.apellidos ?? "")}`.trim();
    sinCondiciones.push(fila(nombre, empresa, "sin salario en la ficha"));
  }

  const pendientes = vistoSinHacer.length + sinEntrar.length;
  const total = porPersona.size;

  const html = `
    <p style="font-size:15px;margin:0 0 4px"><b>Fichas completas: ${completos.length} de ${total}</b></p>
    <p style="margin:0;color:#666;font-size:13px">
      ${
        pendientes === 0
          ? "Ya está todo lo que depende de ellos."
          : `Quedan ${pendientes} personas por completar su ficha.`
      }
    </p>
    ${tabla("Han entrado y NO lo han rellenado", "#b91c1c", vistoSinHacer)}
    ${tabla("Todavía no han entrado", "#a16207", sinEntrar)}
    ${tabla("Ficha completa", "#15803d", completos)}
    ${tabla("Lo ponemos NOSOTROS: condiciones sin salario", "#1d4ed8", sinCondiciones)}
    <p style="margin:24px 0 0;color:#999;font-size:11px">
      Los de la primera lista han visto el aviso en la app y han seguido sin rellenarlo. El aviso
      les tapa el software entero: solo pueden fichar.
    </p>`;

  // El parte deja de mandarse cuando no queda NADA que reclamar, ni a ellos ni a
  // nosotros: con condiciones pendientes sigue habiendo trabajo que recordar.
  const hayAlgoQueContar = pendientes > 0 || sinCondiciones.length > 0;

  const envio = await sendEmail({
    to: DESTINO,
    subject: hayAlgoQueContar
      ? `Fichas: faltan ${pendientes} de ${total}${
          sinCondiciones.length > 0 ? ` · ${sinCondiciones.length} sin salario` : ""
        }`
      : "Fichas: completadas",
    html,
    fromName: "Balles Hosteleros",
  });

  // El resultado del envío VIAJA en la respuesta: si el correo no sale (SMTP sin
  // configurar, Resend caído), el cron tiene que constar como fallido. Devolver
  // `ok: true` sin mirarlo dejaría un parte que nadie recibe y nadie echa de
  // menos — el fallo más silencioso posible en algo cuya única salida es el mail.
  if (!envio.ok) {
    console.error("[cron/documentacion-informe] no se pudo enviar el parte", envio);
  }

  return NextResponse.json(
    {
      ok: envio.ok,
      correoEnviado: envio.ok,
      total,
      completos: completos.length,
      vistoSinHacer: vistoSinHacer.length,
      sinEntrar: sinEntrar.length,
      sinCondiciones: sinCondiciones.length,
    },
    { status: envio.ok ? 200 : 502 },
  );
}
