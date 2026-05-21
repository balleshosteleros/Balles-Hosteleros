import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/shared/providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://sistema.balleshosteleros.com"),
  title: "BallesHosteleros",
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
