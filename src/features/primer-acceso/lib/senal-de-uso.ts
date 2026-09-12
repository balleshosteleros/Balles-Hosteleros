/**
 * ¿CUÁNDO SE LE VIO POR ÚLTIMA VEZ EN LA APP? — fuente única.
 *
 * Existe por un fallo concreto, y su forma es la lección de ese fallo.
 *
 * El 12-09-2026 el parte diario sacó a los 8 pendientes bajo el título «todavía
 * no han abierto la app». Era falso: siete habían fichado esa misma semana y uno
 * la noche anterior. La causa no fue la etiqueta, fue la CONSULTA: los fichajes
 * se pedían `.gte(hora_entrada, AVISO_DESDE)` —la misma fecha que servía para
 * comparar— y con datos recortados se afirmaba algo absoluto. La ventana era de
 * dos horas, así que no se salvaba nadie.
 *
 * De ahí la regla que sostiene este módulo:
 *
 *   **Quien LEE no recorta. Quien COMPARA no consulta.**
 *
 * `leerUltimaSenal` no acepta fecha desde la que mirar, y no la va a aceptar: si
 * algún día hace falta acotar, se acota al comparar, con el dato completo ya en
 * la mano. Mientras la lectura no tenga por dónde recortarse, no hay forma de
 * volver a confundir «no lo ha visto todavía» con «no usa la app».
 *
 * Tres señales, y hacen falta las tres:
 *
 *   · `auth.users.last_sign_in_at` — solo cambia cuando alguien vuelve a
 *     identificarse. La plantilla lleva la sesión abierta en el móvil durante
 *     semanas, así que por sí sola dice «no ha entrado» de quien usa la app a
 *     diario.
 *   · `usuarios.ultima_actividad` — la marca que escribe el proxy en cualquier
 *     navegación. La más fina de las tres, pero estuvo rota hasta el 12-09-2026
 *     (el proxy se la saltaba en las rutas sin módulo, que son las del móvil),
 *     así que de 26 usuarios solo 3 tenían dato.
 *   · El último FICHAJE. Para fichar hay que abrir la app. Es la que cubre el
 *     histórico y la que de verdad demuestra que lo ha tenido delante.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** De dónde salió la marca, para poder contarlo en el correo. */
export type FuenteUso = "sesión" | "navegación" | "fichaje";

export interface UltimaSenal {
  /** Marca de tiempo ISO, la más reciente de las tres fuentes. */
  marca: string;
  fuente: FuenteUso;
}

/**
 * La última vez que se vio a cada cuenta, sin recortar por fecha.
 *
 * No hay parámetro `desde` a propósito: ver la cabecera del módulo. Un `null`
 * que salga de aquí significa de verdad «esta cuenta no ha entrado nunca».
 */
export async function leerUltimaSenal(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, UltimaSenal>> {
  const senales = new Map<string, UltimaSenal>();
  const cuentas = new Set(userIds);

  /** Se queda la más reciente; a igualdad manda la que ya estaba. */
  const anotar = (id: string, marca: string | null | undefined, fuente: FuenteUso) => {
    if (!marca || !cuentas.has(id)) return;
    const previa = senales.get(id);
    if (!previa || marca > previa.marca) senales.set(id, { marca, fuente });
  };

  const { data: usuariosAuth } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  for (const u of usuariosAuth?.users ?? []) anotar(u.id, u.last_sign_in_at, "sesión");

  const { data: navegacion } = await supabase
    .from("usuarios")
    .select("user_id, ultima_actividad")
    .not("ultima_actividad", "is", null);
  for (const u of navegacion ?? []) {
    if (u.user_id) anotar(String(u.user_id), String(u.ultima_actividad), "navegación");
  }

  /**
   * El último fichaje se pide de UNO EN UNO. PostgREST no agrupa, y traerlos
   * todos para quedarse con el máximo chocaría con el tope de 1000 filas de
   * Supabase justo donde más duele: el que se quedaría fuera es quien lleva más
   * tiempo sin fichar, o sea exactamente la persona a la que hay que reclamar.
   *
   * `fichajes.empleado_id` apunta a `auth.users`, no a `empleados`: es la misma
   * clave con la que se guarda el inicio de sesión, así que se comparan directas.
   */
  const ultimos = await Promise.all(
    [...cuentas].map(async (id) => {
      const { data } = await supabase
        .from("fichajes")
        .select("hora_entrada")
        .eq("empleado_id", id)
        .order("hora_entrada", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { id, marca: data?.hora_entrada ? String(data.hora_entrada) : null };
    }),
  );
  for (const { id, marca } of ultimos) anotar(id, marca, "fichaje");

  return senales;
}

/** En qué lista del parte cae cada persona. */
export type EstadoDeUso =
  /** Entró después de que saltara el aviso: lo ha tenido delante y ha pasado. */
  | "ha-visto-el-aviso"
  /** Usa la app, pero no ha vuelto desde el aviso: aún no lo ha visto. */
  | "aun-no-le-ha-saltado"
  /** Tiene cuenta y no ha entrado nunca. */
  | "nunca-ha-entrado"
  /** No tiene cuenta: no se puede afirmar NADA sobre su uso de la app. */
  | "sin-cuenta";

/** Fecha en día-mes-año, como en todo el software. */
function dia(marca: string): string {
  return marca.slice(0, 10).split("-").reverse().join("-");
}

/**
 * Traduce la señal a estado y a la frase que se lee en el correo.
 *
 * Única puerta por la que sale ese texto: mientras se escriba aquí, no puede
 * haber dos sitios diciendo cosas distintas del mismo dato — que es como nació
 * el fallo original.
 *
 * `sin cuenta` NO es «no ha entrado nunca». Un empleado puede estar dado de alta
 * sin usuario todavía; acusarle de no abrir la app sería inventarse un dato que
 * no tenemos, igual que un 0 € no es lo mismo que un salario sin poner.
 */
export function clasificarUso(
  senal: UltimaSenal | null,
  tieneCuenta: boolean,
  avisoDesde: string,
): { estado: EstadoDeUso; frase: string } {
  if (!tieneCuenta) {
    return { estado: "sin-cuenta", frase: "todavía no tiene usuario para entrar" };
  }
  if (!senal) {
    return { estado: "nunca-ha-entrado", frase: "nunca ha abierto la app" };
  }
  if (senal.marca > avisoDesde) {
    return { estado: "ha-visto-el-aviso", frase: `usó la app el ${dia(senal.marca)}` };
  }
  return {
    estado: "aun-no-le-ha-saltado",
    frase: `última vez en la app el ${dia(senal.marca)} · ${senal.fuente}`,
  };
}
