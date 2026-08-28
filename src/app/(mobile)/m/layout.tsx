import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getEmpleadoGuardStatus } from "@/features/primer-acceso/data/empleado-status";
import { PWARegister } from "@/features/mi-panel/mobile/components/PWARegister";
import { MobileBottomNav } from "@/features/mi-panel/mobile/components/MobileBottomNav";
import { MobileFichajeProvider } from "@/features/mi-panel/mobile/components/MobileFichajeProvider";
import { VersionAutoUpdate } from "@/features/mi-panel/mobile/components/VersionAutoUpdate";
import { MobileIdentidadProvider } from "@/features/mi-panel/mobile/components/MobileIdentidadProvider";
import { getMobileIdentidad } from "@/features/mi-panel/mobile/lib/mobile-identidad-data";
// import { NotificacionesGate } from "@/features/notificaciones/components/NotificacionesGate"; // desactivado en pruebas

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Balles · Mi Panel",
  applicationName: "Balles Hosteleros",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    // En iPhone, ESTE valor gana al `short_name` del manifest al añadir a la
    // pantalla de inicio: es el que aparece en el campo editable. Tenía "Balles"
    // y por eso la app se guardaba con el nombre a medias aunque el manifest
    // dijera otra cosa (Iván, 06-ago). Los dos sitios deben ir a la vez.
    title: "Balles Hosteleros",
    statusBarStyle: "default",
    startupImage: [
      {
        url: "/splash/splash-1290x2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/splash-1170x2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/splash-750x1334.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  // Guardia de sesión: en producción el middleware deja pasar /m sin sesión
  // (fail-open), así que un usuario sin sesión (o caducada) veía un panel vacío
  // en vez de ir al login. ?auth=1 evita el rebote del redirect móvil "/"→"/m".
  const { shouldShowWizard, hasUser } = await getEmpleadoGuardStatus();
  if (!hasUser) {
    // `?auth=1` es OBLIGATORIO: sin él, la regla de `next.config.ts` devolvería
    // "/" → "/m" por user-agent móvil y entraríamos en un rebote infinito.
    // Es justo lo que pasaba al abrir la app instalada tras cerrar sesión: su
    // `start_url` es "/m" a secas, así que el arranque caía en el bucle.
    redirect("/?auth=1");
  }
  // Mismo guard de primer acceso que desktop.
  if (shouldShowWizard) {
    redirect("/primer-acceso");
  }

  // Identidad (quién eres + en qué empresa estás) una sola vez para toda la
  // app móvil: la cabecera de CUALQUIER pantalla pinta el icono de empresa
  // junto al del empleado, para poder cambiar de empresa desde donde estés.
  const identidad = await getMobileIdentidad();

  return (
    // Columna a altura de pantalla: el contenido crece y la barra queda abajo
    // pegada por `sticky`. Antes era `pb-24` a ojo sobre una barra `fixed`, y en
    // iPhone (con franja inferior) la barra tapaba el final de las listas.
    // --nav-h la publica la barra para que cada pantalla reserve el hueco justo.
    // `overflow-x-clip` es OBLIGATORIO: la cabecera estira su fondo más allá de
    // la columna de 640px para llegar a los bordes de móviles anchos, y sin
    // recortar aquí eso generaría scroll horizontal (documento de 1400px en una
    // pantalla de 720px). Es `clip` y NO `hidden` a propósito: `hidden` crea un
    // contenedor de scroll y rompería el `position: sticky` de la cabecera y de
    // la barra inferior.
    <MobileIdentidadProvider value={identidad}>
    <div
      className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground antialiased [--nav-h:calc(3.5rem+env(safe-area-inset-bottom))]"
    >
      <PWARegister />
      <VersionAutoUpdate />
      {/*
        Ancho de la columna. Antes era `max-w-screen-sm` fijo (640px) y eso daba
        DOS problemas:
          · En móviles anchos (Android de 720px) la cabecera y la tarjeta de
            avisos pintaban su fondo solo hasta 640px y asomaban FRANJAS BLANCAS
            a los lados (Iván, captura del panel de empleado). El fondo se pinta
            ahora a pantalla completa y la columna queda TRANSPARENTE encima.
          · En tablet y ordenador (esta app es alcanzable ahí con la cookie
            `bh_force_view=mobile`) todo se quedaba congelado en una banda de
            640px centrada, desaprovechando la pantalla. Ahora la columna crece
            por tramos hasta 1100px, que es donde la rejilla deja de estirarse.
      */}
      <main className="mx-auto w-full max-w-screen-sm flex-1 bg-transparent md:max-w-3xl lg:max-w-5xl xl:max-w-[1100px]">
        {children}
      </main>
      <MobileBottomNav />
      <MobileFichajeProvider />
      {/* Gate bloqueante de notificaciones desactivado durante las pruebas:
          los empleados no deben verse forzados a pulsar "Visto" para trabajar. */}
      {/* <NotificacionesGate /> */}
    </div>
    </MobileIdentidadProvider>
  );
}
