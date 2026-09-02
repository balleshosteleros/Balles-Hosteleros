import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/shared/providers";

// En local (y en previews de Vercel) la pestaña avisa de que NO es producción.
const esProduccion = process.env.VERCEL_ENV === "production";

// La tipografía del software VIAJA CON LA APP, no se busca en el ordenador de
// quien mira. Antes globals.css pedía 'Inter' sin cargarla en ningún sitio: en
// los equipos que la tienen instalada (los de diseño) se veía como toca, y en
// el resto el navegador caía a la fuente del sistema —- que dibuja las letras
// más pequeñas y hacía que en producción el menú, la barra superior y las
// tablas salieran encogidos respecto a local.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sistema.balleshosteleros.com"),
  title: esProduccion ? "Balles Hosteleros" : "Balles Hosteleros - PRUEBAS",
  description: "Sistema de gestión integral para hostelería",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
