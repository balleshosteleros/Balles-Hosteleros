/**
 * Tras login, todo usuario aterriza en /mis-departamentos (vista principal).
 * El acceso a Mi Panel queda disponible desde el sidebar.
 */
const LANDING = "/mis-departamentos";

export const ROL_LANDING: Record<string, string> = {
  "Dirección": LANDING,
  "Gerencia": LANDING,
  "RRHH": LANDING,
  "Logística": LANDING,
  "Cocina": LANDING,
  "Contabilidad": LANDING,
  "Gestoría": LANDING,
  "Jurídico": LANDING,
  "Marketing": LANDING,
};

export function getRedirectByRolLabel(_rolLabel: string | null | undefined): string {
  return LANDING;
}
