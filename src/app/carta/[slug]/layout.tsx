/**
 * Layout público de la Carta Digital (PRP-028).
 * NO incluye AppLayout, sidebar ni auth — vista limpia para clientes anónimos.
 * Tema claro fijo para legibilidad en cualquier dispositivo.
 */
import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Carta Digital",
  description: "Consulta la carta del restaurante",
  robots: { index: true, follow: false },
};

export default function CartaPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 antialiased">
      {children}
    </div>
  );
}
