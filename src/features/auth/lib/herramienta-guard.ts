/**
 * Candado de SERVIDOR para las herramientas de la barra (AGENDA, CÁMARAS,
 * APLICACIONES, CONTRASEÑAS).
 *
 * Ocultar el icono en la barra no es seguridad: la acción de servidor sigue
 * ahí y se puede llamar desde fuera. Este ayudante es el que decide de verdad,
 * y lee lo mismo que la pantalla: `empresa_roles.permisos` del rol real del
 * usuario (Ajustes → Roles). Sin bypass de director, igual que en el cliente.
 *
 * No lleva "use server" a propósito: no es una acción, es una comprobación que
 * usan las acciones.
 */

import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeVerHerramienta } from "@/features/auth/lib/permisos";

/** ¿El usuario de la sesión tiene encendida esta herramienta en su rol? */
export async function tieneHerramienta(modulo: string): Promise<boolean> {
  const { permisos } = await getRolContext();
  return puedeVerHerramienta(permisos, modulo);
}
