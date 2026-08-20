import { createAdminClient } from "@/lib/supabase/admin";
import {
  camposObligatoriosEfectivos,
  getSubmodulo,
  type ReglaSubmoduloRow,
} from "@/features/ajustes/lib/reglas-submodulos-catalogo";

/**
 * Campos del alta de reserva que cada empresa decide. Nombre, apellidos, fecha,
 * hora, comensales, turno, estado y mesa se exigen SIEMPRE por código (la zona
 * se deduce de la mesa), así que no aparecen aquí.
 */
export interface CamposObligatoriosReserva {
  email: boolean;
  telefono: boolean;
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
  if (!submodulo) return { email: false, telefono: false };

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
    // Sin regla guardada se aplican los defaults del catálogo (email y teléfono).
    regla = null;
  }

  const requeridos = camposObligatoriosEfectivos(submodulo, regla);
  return {
    email: requeridos.includes("email"),
    telefono: requeridos.includes("telefono"),
  };
}
