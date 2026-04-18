import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Sitio web",
  description: "Página web del restaurante",
};

export default function PublicSiteLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white text-black antialiased">{children}</div>;
}
