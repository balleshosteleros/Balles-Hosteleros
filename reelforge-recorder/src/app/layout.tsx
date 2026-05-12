import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ReelForge Recorder — Graba y gestiona tu pantalla localmente",
  description:
    "La herramienta de grabación de pantalla más rápida y privada. Guarda tus tutoriales y demos directamente en tu equipo.",
  keywords: ["video automatico", "ia videos", "reels automaticos", "marketing video"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
