import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarEmail } from "./buzones";

/**
 * Alta automática de los buzones auditados (PRP-094, Fase 1).
 *
 * De dónde salen los buzones: de la ficha de la empresa. Los correos de la
 * empresa viven POR DEPARTAMENTO en `empresas.datos_generales`
 * (`correoDireccion`, `correoRrhh`, `correoGestoria`…); no hay correo general.
 * Esa es la lista natural y no hay que escribirla a mano en ningún sitio.
 *
 * Por qué esto es un servicio y no un script de una vez: la ficha cambia. Si
 * mañana se rellena `correoCalidad` de HABANA, ese buzón tiene que aparecer solo
 * en la lista de Ajustes, sin que nadie se acuerde de darlo de alta. Se llama al
 * abrir el panel, es idempotente y no pisa nada de lo ya conectado.
 *
 * Además ADOPTA las conexiones que ya existían: si alguien ya tenía vinculada
 * esa cuenta en su selector personal (`google_cuentas_usuario`), el permiso pasa
 * a estar también a nombre del buzón, y la empresa puede contar desde el primer
 * día sin pedirle a nadie que reconecte nada.
 */

/** Clave de `datos_generales` → nombre del departamento y etiqueta del panel. */
const BUZONES_DE_FICHA: Record<string, { etiqueta: string; departamento: string }> = {
  correoDireccion: { etiqueta: "Dirección", departamento: "DIRECCIÓN" },
  correoGerencia: { etiqueta: "Gerencia", departamento: "GERENCIA" },
  correoContabilidad: { etiqueta: "Contabilidad", departamento: "CONTABILIDAD" },
  correoGestoria: { etiqueta: "Gestoría", departamento: "GESTORÍA" },
  correoJuridico: { etiqueta: "Jurídico", departamento: "JURÍDICO" },
  correoLogistica: { etiqueta: "Logística", departamento: "LOGÍSTICA" },
  correoMarketing: { etiqueta: "Marketing", departamento: "MARKETING" },
  correoRrhh: { etiqueta: "Recursos humanos", departamento: "RECURSOS HUMANOS" },
  correoCalidad: { etiqueta: "Calidad", departamento: "CALIDAD" },
  correoReservas: { etiqueta: "Reservas", departamento: "SALA" },
  correoIncidencias: { etiqueta: "Incidencias", departamento: "MANTENIMIENTO" },
  correoAdmin: { etiqueta: "Administración", departamento: "" },
};

type CuentaGuardada = { email?: string; refreshToken?: string };

/**
 * Pone al día la lista de buzones de una empresa y devuelve cuántos hay.
 *
 * Nunca borra: si un correo desaparece de la ficha, su buzón se queda con el
 * histórico ya contado (borrarlo se llevaría por delante meses de datos). Lo que
 * hace es crear los que faltan y refrescar la etiqueta y el departamento.
 */
export async function sembrarBuzonesDeEmpresa(empresaId: string): Promise<number> {
  const admin = createAdminClient();

  const { data: empresa, error } = await admin
    .from("empresas")
    .select("datos_generales")
    .eq("id", empresaId)
    .maybeSingle();
  if (error || !empresa) return 0;

  const datos = (empresa.datos_generales ?? {}) as Record<string, unknown>;

  // Departamentos de la empresa, para colgar cada buzón del suyo. Es
  // informativo: si no casa el nombre, el buzón existe igual sin departamento.
  const { data: departamentos } = await admin
    .from("departamentos")
    .select("id, nombre")
    .eq("empresa_id", empresaId);
  const idPorDepartamento = new Map<string, string>(
    (departamentos ?? []).map((d) => [
      String(d.nombre ?? "").trim().toUpperCase(),
      d.id as string,
    ]),
  );

  const filas: {
    empresa_id: string;
    email: string;
    etiqueta: string;
    departamento_id: string | null;
  }[] = [];

  for (const [clave, meta] of Object.entries(BUZONES_DE_FICHA)) {
    const valor = datos[clave];
    if (typeof valor !== "string") continue;
    const email = normalizarEmail(valor);
    if (!email || !email.includes("@")) continue;

    filas.push({
      empresa_id: empresaId,
      email,
      etiqueta: meta.etiqueta,
      departamento_id: idPorDepartamento.get(meta.departamento) ?? null,
    });
  }

  if (filas.length) {
    // `onConflict` sobre (empresa_id, email): crea los nuevos y refresca
    // etiqueta/departamento de los que ya estaban. No toca `conexion` ni el
    // token: lo conectado sigue conectado.
    const { error: errUpsert } = await admin
      .from("correo_buzones")
      .upsert(filas, { onConflict: "empresa_id,email" });
    if (errUpsert) {
      console.error("[correo-auditoria] sembrar buzones:", errUpsert.message);
    }
  }

  await adoptarConexionesExistentes(empresaId);

  const { count } = await admin
    .from("correo_buzones")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  return count ?? 0;
}

/**
 * Aprovecha los permisos que ya dio alguien en su selector personal.
 *
 * Hoy hay 8 cuentas de Google vinculadas por el equipo, y varias son buzones de
 * empresa. Sería absurdo pedir que las reconecten una por una: el permiso ya
 * existe, solo hay que ponerlo también a nombre del buzón.
 *
 * A partir de aquí ese buzón ya no depende de esa persona: si mañana se quita la
 * cuenta de su selector, la auditoría sigue contando.
 */
async function adoptarConexionesExistentes(empresaId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: buzones } = await admin
    .from("correo_buzones")
    .select("id, email, conexion")
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo");
  if (!buzones?.length) return;

  // Solo interesan los que aún no tienen permiso propio.
  const pendientes = buzones.filter((b) => b.conexion !== "conectado");
  if (!pendientes.length) return;

  const { data: rosters } = await admin
    .from("google_cuentas_usuario")
    .select("user_id, cuentas");
  if (!rosters?.length) return;

  // Correo → (refresh_token, quién lo vinculó). Si dos personas tienen la misma
  // cuenta, vale cualquiera: el permiso es el mismo.
  const permisos = new Map<string, { token: string; userId: string }>();
  for (const fila of rosters) {
    const cuentas = Array.isArray(fila.cuentas)
      ? (fila.cuentas as CuentaGuardada[])
      : [];
    for (const cuenta of cuentas) {
      const email = normalizarEmail(cuenta?.email ?? "");
      const token = cuenta?.refreshToken;
      if (!email || !token) continue;
      if (!permisos.has(email)) {
        permisos.set(email, { token, userId: fila.user_id as string });
      }
    }
  }
  if (!permisos.size) return;

  const ahora = new Date().toISOString();

  for (const buzon of pendientes) {
    const permiso = permisos.get(normalizarEmail(String(buzon.email ?? "")));
    if (!permiso) continue;

    const { error: errToken } = await admin.from("correo_buzones_tokens").upsert(
      {
        buzon_id: buzon.id as string,
        refresh_token: permiso.token,
        actualizado: ahora,
      },
      { onConflict: "buzon_id" },
    );
    if (errToken) {
      console.error("[correo-auditoria] adoptar token:", errToken.message);
      continue;
    }

    await admin
      .from("correo_buzones")
      .update({
        conexion: "conectado",
        conectado_por: permiso.userId,
        conectado_at: ahora,
        ultimo_error: null,
      })
      .eq("id", buzon.id as string);
  }
}
