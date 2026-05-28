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
