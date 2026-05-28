// Edge-safe device detection (sin Node APIs).
// Usado por middleware.ts para decidir routing móvil vs desktop.
//
// REGLA: la detección autoritativa es por User-Agent en server.
// El hook cliente `useIsMobile` solo enriquece UI dentro de páginas, no decide routing.

const MOBILE_UA_REGEX = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone/i;
const TABLET_UA_REGEX = /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i;

export type DeviceKind = "mobile" | "tablet" | "desktop";

export function detectDeviceKind(userAgent: string | null | undefined): DeviceKind {
  if (!userAgent) return "desktop";
  if (TABLET_UA_REGEX.test(userAgent) && !MOBILE_UA_REGEX.test(userAgent)) return "tablet";
  if (MOBILE_UA_REGEX.test(userAgent)) return "mobile";
  return "desktop";
}

// Para el portal Balles, tablets vertical < 768px caen como móvil.
// Como el middleware no conoce viewport, tratamos `mobile` como móvil y `tablet` como desktop.
// Si en el futuro queremos forzar móvil en tablet vertical, se hace con cookie `bh_force_view=mobile`.
export function shouldServeMobileUI(userAgent: string | null | undefined, forceView?: string): boolean {
  if (forceView === "mobile") return true;
  if (forceView === "desktop") return false;
  return detectDeviceKind(userAgent) === "mobile";
}
