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
  // `?v=` al final del icono: al cambiar el dibujo hay que SUBIR ESE NÚMERO.
  // Next sirve `icon.png` siempre en la misma dirección aunque el archivo
  // cambie, y el navegador guarda los favicons en su propio archivo y no
  // vuelve a pedirlos: el icono redondo estaba servido y seguía viéndose el
  // cuadrado de antes. Cambiar la dirección es lo único que le hace bajarlo de
  // nuevo (mismo truco que en el manifest de la PWA).
  //
  // v3 = 08-09-2026, redondo y aligerado de 536 KB a 36 KB.
  // v4 = 10-09-2026. El dibujo NO ha cambiado: el archivo que se sirve ya es
  // redondo (esquinas transparentes), pero en los navegadores que se quedaron
  // con el cuadrado guardado seguía saliendo en pico — el archivo de favicons
  // del navegador no se vuelve a pedir si la dirección es la misma. Subir el
  // número es lo único que le obliga a bajarlo otra vez.
  icons: {
    icon: "/icon.png?v=4",
    shortcut: "/icon.png?v=4",
    // iOS sigue con el cuadrado: la pantalla de inicio lo recorta ella.
    apple: "/apple-icon.png?v=4",
  },
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
