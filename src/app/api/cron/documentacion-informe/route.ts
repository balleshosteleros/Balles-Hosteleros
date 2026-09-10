/**
 * Cron endpoint: parte diario de la RECOGIDA DE DOCUMENTACIÓN.
 *
 * Mientras la repesca está activa ([[repesca_documentacion_primer_acceso]]), a
 * quien le falte el DNI o el certificado bancario se le tapa la app hasta que lo
 * suba — salvo la pantalla de fichaje, que nunca se bloquea. Este correo cuenta
 * cómo va sin tener que entrar a mirar: quién lo ha entregado, y sobre todo
 * **quién ha entrado en la app y aun así no lo ha hecho**, que es la lista que
 * de verdad hace falta para poder reclamar.
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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A quién se le manda el parte. */
const DESTINO = "balleshosteleros@gmail.com";

/**
 * Día en que el aviso llegó DE VERDAD a producción (no en el que se escribió el
 * código). Quien entró antes de esta fecha no pudo verlo, y marcarlo como «ha
 * entrado y ha pasado del aviso» sería acusarle de ignorar algo que no existía.
 */
const REPESCA_DESDE = "2026-09-10T00:00:00Z";

interface FilaEmpleado {
  nombre: string;
  apellidos: string | null;
  empresa: string;
  user_id: string | null;
  doc_dni_anverso_path: string | null;
  doc_dni_reverso_path: string | null;
  doc_iban_path: string | null;
}

/** Qué le falta a esta ficha, en palabras. */
function faltantes(e: FilaEmpleado): string[] {
  const f: string[] = [];
  if (!e.doc_dni_anverso_path) f.push("DNI delante");
  if (!e.doc_dni_reverso_path) f.push("DNI detrás");
  if (!e.doc_iban_path) f.push("certificado bancario");
  return f;
}

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
    .select(
      "nombre, apellidos, user_id, doc_dni_anverso_path, doc_dni_reverso_path, doc_iban_path, empresas(nombre)",
    )
    .eq("estado", "Activo");

  if (error) {
    console.error("[cron/documentacion-informe]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const empleados: FilaEmpleado[] = (data ?? []).map((r) => {
    const emp = r as unknown as Record<string, unknown>;
    const rel = emp.empresas as { nombre?: string } | { nombre?: string }[] | null;
    const nombreEmpresa = Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre;
    return {
      nombre: String(emp.nombre ?? ""),
      apellidos: (emp.apellidos as string | null) ?? null,
      empresa: nombreEmpresa ?? "—",
      user_id: (emp.user_id as string | null) ?? null,
      doc_dni_anverso_path: (emp.doc_dni_anverso_path as string | null) ?? null,
      doc_dni_reverso_path: (emp.doc_dni_reverso_path as string | null) ?? null,
      doc_iban_path: (emp.doc_iban_path as string | null) ?? null,
    };
  });

  // Última vez que cada persona inició sesión, según el propio Supabase.
  const actividad = new Map<string, string | null>();
  const { data: cuentas } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of cuentas?.users ?? []) {
    actividad.set(u.id, u.last_sign_in_at ?? null);
  }

  const completos: string[] = [];
  const vistoSinHacer: string[] = [];
  const sinEntrar: string[] = [];

  for (const e of empleados) {
    const nombre = `${e.nombre} ${e.apellidos ?? ""}`.trim();
    const falta = faltantes(e);

    if (falta.length === 0) {
      completos.push(fila(nombre, e.empresa, "todo entregado"));
      continue;
    }

    const ultima = e.user_id ? actividad.get(e.user_id) ?? null : null;
    const haEntrado = Boolean(ultima && ultima > REPESCA_DESDE);
    const detalle = `falta ${falta.join(", ")}`;

    if (haEntrado) {
      const dia = String(ultima).slice(0, 10).split("-").reverse().join("-");
      vistoSinHacer.push(fila(nombre, e.empresa, `${detalle} · entró el ${dia}`));
    } else {
      sinEntrar.push(fila(nombre, e.empresa, `${detalle} · no ha entrado`));
    }
  }

  const pendientes = vistoSinHacer.length + sinEntrar.length;
  const total = empleados.length;

  const html = `
    <p style="font-size:15px;margin:0 0 4px"><b>Documentación: ${completos.length} de ${total}</b></p>
    <p style="margin:0;color:#666;font-size:13px">
      ${
        pendientes === 0
          ? "Ya está todo. Este es el último correo: no queda nadie pendiente."
          : `Quedan ${pendientes} por entregar.`
      }
    </p>
    ${tabla("Han entrado y NO lo han subido", "#b91c1c", vistoSinHacer)}
    ${tabla("Todavía no han entrado", "#a16207", sinEntrar)}
    ${tabla("Entregado", "#15803d", completos)}
    <p style="margin:24px 0 0;color:#999;font-size:11px">
      Los de arriba han visto el aviso en la app y han seguido sin subirlo.
    </p>`;

  const envio = await sendEmail({
    to: DESTINO,
    subject:
      pendientes === 0
        ? "Documentación: completada"
        : `Documentación: faltan ${pendientes} de ${total}`,
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
    },
    { status: envio.ok ? 200 : 502 },
  );
}
