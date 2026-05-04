/**
 * Tras login, todo usuario aterriza en /mi-panel para fichar entrada.
 * El acceso a su módulo de rol queda en los accesos rápidos del propio panel.
 */
const LANDING = "/mi-panel";

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
