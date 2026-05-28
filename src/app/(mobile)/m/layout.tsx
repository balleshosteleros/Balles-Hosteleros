import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getEmpleadoGuardStatus } from "@/features/primer-acceso/data/empleado-status";
import { PWARegister } from "@/features/mi-panel/mobile/components/PWARegister";
import { MobileBottomNav } from "@/features/mi-panel/mobile/components/MobileBottomNav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Balles · Mi Panel",
  applicationName: "Balles Hosteleros",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Balles",
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
  // Mismo guard de primer acceso que desktop.
  const { shouldShowWizard } = await getEmpleadoGuardStatus();
  if (shouldShowWizard) {
    redirect("/primer-acceso");
  }

  return (
    <div className="min-h-dvh bg-background text-foreground antialiased">
      <PWARegister />
      <main className="mx-auto w-full max-w-screen-sm pb-24">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
