import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Balles Hosteleros — Software de gestión integral para hostelería",
  description:
    "El software que conecta cocina, sala, equipo, proveedores y números en un solo lugar. Hecho por hosteleros, para hosteleros. Desde 120€/mes.",
  keywords: [
    "software hostelería",
    "gestión restaurantes",
    "ERP hostelería",
    "escandallos",
    "nóminas hostelería",
    "APPCC",
    "Balles Hosteleros",
  ],
  openGraph: {
    title: "Balles Hosteleros — Software de gestión para hostelería",
    description:
      "Cocina, equipo, proveedores, números y operativa. Todo conectado, todo medido, todo bajo control.",
    url: "https://balleshosteleros.com/software",
    siteName: "Balles Hosteleros",
    images: [
      {
        url: "/images/landing/hero.jpg",
        width: 2400,
        height: 1600,
        alt: "Balles Hosteleros — Software de gestión para hostelería",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Balles Hosteleros — Software de gestión para hostelería",
    description:
      "El control de tu negocio, en un solo lugar. Desde 120€/mes, sin permanencia.",
    images: ["/images/landing/hero.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SoftwareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
