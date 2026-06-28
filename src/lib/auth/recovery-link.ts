/**
 * Construye el enlace de "elige/recupera tu contraseña" a partir del resultado
 * de `admin.auth.admin.generateLink({ type: 'recovery', ... })`.
 *
 * Apuntamos a NUESTRO endpoint `/auth/confirm` con el `token_hash`, NO al
 * `action_link` que devuelve Supabase. Motivo: el action_link clásico canjea el
 * token en la primera petición HTTP que lo toque, y los clientes de correo /
 * antivirus hacen prefetch de los enlaces al recibirlos, consumiéndolo antes de
 * que la persona haga clic → "enlace caducado en menos de un minuto". El flujo
 * token_hash + verifyOtp (server-side, en /auth/confirm) no sufre ese problema.
 *
 * Devuelve null si el linkData no trae hashed_token (no debería ocurrir).
 */
export function buildRecoveryActionUrl(
  siteUrl: string,
  linkProperties: { hashed_token?: string; action_link?: string } | undefined,
  next: string = '/update-password',
): string | null {
  const base = siteUrl.replace(/\/$/, '')
  const hashedToken = linkProperties?.hashed_token
  if (hashedToken) {
    const params = new URLSearchParams({
      token_hash: hashedToken,
      type: 'recovery',
      next,
    })
    return `${base}/auth/confirm?${params.toString()}`
  }
  // Fallback defensivo: si por algún motivo no hay hashed_token, usamos el
  // action_link de Supabase (comportamiento antiguo) en vez de no enviar nada.
  return linkProperties?.action_link ?? null
}
