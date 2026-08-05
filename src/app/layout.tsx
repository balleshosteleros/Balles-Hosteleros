import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/shared/providers";

// En local (y en previews de Vercel) la pestaña avisa de que NO es producción.
const esProduccion = process.env.VERCEL_ENV === "production";

export const metadata: Metadata = {
  metadataBase: new URL("https://sistema.balleshosteleros.com"),
  title: esProduccion ? "Balles Hosteleros" : "Balles Hosteleros - PRUEBAS",
  description: "Sistema de gestión integral para hostelería",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
