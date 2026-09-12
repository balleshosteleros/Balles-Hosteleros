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
 * Son DOS preguntas distintas y no hay que confundirlas, que es justo lo que
 * pasaba hasta el 12-09-2026:
 *
 *   · ¿ha visto el aviso? → última señal POSTERIOR a `AVISO_DESDE`.
 *   · ¿usa la app? → última señal, sin recortar por fecha.
 *
 * Al mirar los fichajes solo desde el aviso, quien no hubiera entrado en esas
 * horas salía como «no ha abierto la app» — y el aviso se desplegó a las 07:00
 * del mismo día en que sale el parte, o sea que salían los 8 pendientes, siete
 * de ellos con fichajes de esa misma semana. La etiqueta acusaba de no usar el
 * software a gente que ficha a diario. «Todavía no lo ha visto» es la verdad;
 * «no ha abierto la app nunca» se reserva para quien no tiene NINGUNA señal.
 *
 * «Ha entrado» mira DOS señales, y hace falta mirar las dos:
 *
 *   · `auth.users.last_sign_in_at` — el último inicio de sesión. Lo escribe
 *     Supabase, está relleno para todos, pero SOLO cambia cuando alguien vuelve
 *     a identificarse. La plantilla lleva la sesión abierta en el móvil durante
 *     semanas, así que este campo dice «no ha entrado» de gente que usa la app
 *     a diario: de 17 personas, 14 habían fichado en septiembre y casi ninguna
 *     tenía un login reciente.
 *   · Su último FICHAJE. Para fichar hay que abrir la app, o sea que un fichaje
 *     posterior al aviso demuestra que lo ha tenido delante. Es la señal que de
 *     verdad sirve para reclamar.
 *
 *   · `usuarios.ultima_actividad` — la marca que escribe el proxy en cualquier
 *     navegación. Estuvo rota hasta el 12-09-2026 (un atajo del proxy la
 *     saltaba en las rutas sin módulo, que son justo las del móvil), así que de
 *     26 usuarios solo 3 tenían dato. Ya arreglada, es la señal más fina de las
 *     tres; las otras dos se quedan porque cubren el histórico anterior.
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
 * 12-sep-2026, 05:00 UTC: el aviso pasa a pedir la ficha entera y a taparlo
 * todo. La hora es la del despliegue, no la de medianoche: quien entró antes lo
 * hizo cuando todavía no se le pedía el teléfono, y sacarlo en la lista de «ha
 * pasado del aviso» sería acusarle de ignorar algo que aún no existía.
 *
 * OJO al poner esta fecha: el reloj del Mac desde el que se despliega puede ir
 * DESFASADO (el 12-09-2026 iba 13 horas por detrás). Sacarla de `date` dejó aquí
 * una hora del día anterior, y con ella salían como «han pasado del aviso»
 * personas que habían entrado antes de que el aviso existiera. La hora buena es
 * la de la base de datos: `select now()`.
 */
const AVISO_DESDE = "2026-09-12T05:00:00Z";

/** Fecha en día-mes-año, como en todo el software. */
function dia(marca: string): string {
  return marca.slice(0, 10).split("-").reverse().join("-");
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

  // Última vez que se le vio en la app. Se queda la MÁS RECIENTE de las tres
  // señales: el último inicio de sesión, la marca de navegación del proxy y el
  // último fichaje (para fichar hay que abrir la app).
  const actividad = new Map<string, string>();
  const { data: cuentas } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of cuentas?.users ?? []) {
    if (u.last_sign_in_at) actividad.set(u.id, u.last_sign_in_at);
  }

  const { data: navegacion } = await supabase
    .from("usuarios")
    .select("user_id, ultima_actividad")
    .not("ultima_actividad", "is", null);
  for (const u of navegacion ?? []) {
    const id = u.user_id ? String(u.user_id) : null;
    if (!id) continue;
    const cuando = String(u.ultima_actividad);
    const previa = actividad.get(id);
    if (!previa || cuando > previa) actividad.set(id, cuando);
  }

  // El ÚLTIMO fichaje de cada persona, sin recortar por fecha: una persona que
  // fichó anoche usa la app, aunque el aviso saltara esta mañana. Va de uno en
  // uno porque PostgREST no agrupa, y traer todos los fichajes para quedarse con
  // el máximo chocaría con el tope de 1000 filas (se perderían justo los de
  // quien lleva más tiempo sin fichar, que es a quien hay que reclamar).
  //
  // `fichajes.empleado_id` apunta a `auth.users`, no a `empleados`: es la misma
  // clave con la que se guarda el inicio de sesión, así que se comparan directas.
  const cuentasEmpleado = [...porPersona.values()]
    .map((p) => p.userId)
    .filter((id): id is string => Boolean(id));

  const ultimosFichajes = await Promise.all(
    cuentasEmpleado.map(async (id) => {
      const { data } = await supabase
        .from("fichajes")
        .select("hora_entrada")
        .eq("empleado_id", id)
        .order("hora_entrada", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { id, cuando: data?.hora_entrada ? String(data.hora_entrada) : null };
    }),
  );

  for (const { id, cuando } of ultimosFichajes) {
    if (!cuando) continue;
    const previa = actividad.get(id);
    if (!previa || cuando > previa) actividad.set(id, cuando);
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
      vistoSinHacer.push(fila(p.nombre, empresas, `${detalle} · usó la app el ${dia(ultima ?? "")}`));
    } else if (ultima) {
      // Usa la app, pero no ha vuelto a entrar desde que salta el aviso: aún no
      // ha tenido ocasión de verlo. No se le puede reclamar todavía.
      sinEntrar.push(
        fila(p.nombre, empresas, `${detalle} · última vez en la app el ${dia(ultima)}`),
      );
    } else {
      sinEntrar.push(fila(p.nombre, empresas, `${detalle} · nunca ha abierto la app`));
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
    ${tabla("Todavía no les ha saltado el aviso", "#a16207", sinEntrar)}
    ${tabla("Ficha completa", "#15803d", completos)}
    ${tabla("Lo ponemos NOSOTROS: condiciones sin salario", "#1d4ed8", sinCondiciones)}
    <p style="margin:24px 0 0;color:#999;font-size:11px">
      Los de la primera lista han abierto la app —han fichado o se han identificado— después de
      que saltara el aviso, y han seguido sin rellenarlo. El aviso les tapa el software entero:
      lo único que pueden hacer es fichar.
    </p>
    <p style="margin:6px 0 0;color:#999;font-size:11px">
      Los de la segunda usan la app —ahí está la última vez—, pero no han vuelto a entrar desde
      que saltó el aviso, así que todavía no lo han tenido delante. Saldrán en la lista de arriba
      en cuanto entren.
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
