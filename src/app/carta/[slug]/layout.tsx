/**
 * Layout público de la Carta Digital (PRP-028).
 * NO incluye AppLayout, sidebar ni auth — vista limpia para clientes anónimos.
 * El tema visual (colores, fuentes) lo aplica CartaPublicaShell vía CSS custom
 * properties cargadas desde BD por empresa.
 */
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "@/app/globals.css";

// Pre-cargamos los defaults razonables del sistema. Si la empresa configura
// otras fuentes vía Google Fonts, CartaPublicaShell las inyecta en runtime.
const serifDefault = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-carta-serif-default",
  display: "swap",
});

const sansDefault = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-carta-sans-default",
  display: "swap",
});

// OJO: sin `icons` ni `title` aquí. Este layout envuelve a `page.tsx`, que ya
// resuelve AMBOS por empresa (`iconsDeUrl()` con su isotipo, y "Carta · <empresa>").
// Declararlos también aquí los dejaba compitiendo en la cascada de metadata de
// Next, y la carta de un restaurante podía salir en la pestaña con el icono del
// software —el de Balles Hosteleros— en vez del suyo.
export const metadata: Metadata = {
  robots: { index: true, follow: false },
};

export default function CartaPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${serifDefault.variable} ${sansDefault.variable} min-h-screen antialiased`}>
      {children}
    </div>
  );
}
