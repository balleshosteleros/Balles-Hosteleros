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

export const metadata: Metadata = {
  title: "Carta Digital",
  description: "Consulta la carta del restaurante",
  robots: { index: true, follow: false },
};

export default function CartaPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${serifDefault.variable} ${sansDefault.variable} min-h-screen antialiased`}>
      {children}
    </div>
  );
}
