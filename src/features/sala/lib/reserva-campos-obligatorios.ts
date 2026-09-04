import { createAdminClient } from "@/lib/supabase/admin";
import {
  camposObligatoriosEfectivos,
  getSubmodulo,
  type ReglaSubmoduloRow,
} from "@/features/ajustes/lib/reglas-submodulos-catalogo";

/**
 * Campos del alta de reserva que cada empresa decide. Nombre, apellidos,
 * TELÉFONO, fecha, hora, comensales, turno, estado y mesa se exigen SIEMPRE por
 * código (la zona se deduce de la mesa), así que no se configuran.
 *
 * El teléfono aparece aquí fijado a `true`, no como interruptor: es el único
 * contacto que sirve para avisar al cliente de un cambio de última hora.
 */
export interface CamposObligatoriosReserva {
  email: boolean;
  /** Fecha de nacimiento del cliente. Configurable por empresa. */
  fechaNacimiento: boolean;
  /**
   * Siempre `true`. Se mantiene en el tipo (y no se borra de los consumidores)
   * porque el portal público pinta el asterisco de "campo obligatorio" leyendo
   * estos flags, y quitarlo dejaría el teléfono sin marcar aunque se exija.
   */
  telefono: true;
}

/**
 * Resuelve los campos obligatorios de reserva a partir del checklist de
 * Ajustes → Departamentos → Sala → Reservas.
 *
 * Existe porque el portal público de reservas NO tiene sesión: el cliente que
 * reserva no es usuario del software, así que el hook `useReglasSubmodulo` (que
 * deduce la empresa del usuario logueado) no sirve ahí. La empresa llega
 * resuelta desde el slug de la URL del portal y el servidor lee la regla por
 * `empresa_id` y se la manda ya calculada al navegador.
 *
 * Solo devuelve estos dos flags — nunca expone el resto de la configuración de
 * la empresa al portal público.
 */
export async function getCamposObligatoriosReserva(
  empresaId: string,
): Promise<CamposObligatoriosReserva> {
  const submodulo = getSubmodulo("sala", "reservas");
  if (!submodulo) return { email: false, fechaNacimiento: false, telefono: true };

  let regla: ReglaSubmoduloRow | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("empresa_reglas_submodulo")
      .select("id, empresa_id, modulo, submodulo, modo, campos_obligatorios, created_at, updated_at")
      .eq("empresa_id", empresaId)
      .eq("modulo", "sala")
      .eq("submodulo", "reservas")
      .maybeSingle();
    regla = (data as ReglaSubmoduloRow | null) ?? null;
  } catch {
    // Sin regla guardada se aplican los defaults del catálogo (email).
    regla = null;
  }

  const requeridos = camposObligatoriosEfectivos(submodulo, regla);
  return {
    email: requeridos.includes("email"),
    fechaNacimiento: requeridos.includes("fechaNacimiento"),
    // No se consulta la regla: el teléfono no es configurable.
    telefono: true,
  };
}
