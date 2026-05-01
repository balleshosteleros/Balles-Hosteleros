/**
 * Mapeo rol → módulo principal donde aterriza el usuario tras login.
 * Roles válidos = los 9 alineados a departamento.
 */
export const ROL_LANDING: Record<string, string> = {
  "Dirección": "/direccion",
  "Gerencia": "/gerencia",
  "RRHH": "/rrhh",
  "Logística": "/logistica",
  "Cocina": "/cocina",
  "Contabilidad": "/contabilidad",
  "Gestoría": "/gestoria",
  "Jurídico": "/juridico",
  "Marketing": "/marketing",
};

const FALLBACK = "/rrhh";

export function getRedirectByRolLabel(rolLabel: string | null | undefined): string {
  if (!rolLabel) return FALLBACK;
  return ROL_LANDING[rolLabel] ?? FALLBACK;
}
