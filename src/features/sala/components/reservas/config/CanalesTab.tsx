"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface CanalCard {
  id: string;
  nombre: string;
  descripcion: string;
  href: string;
  estado: "disponible" | "proximamente";
  logo: React.ReactNode;
}

const CANALES: CanalCard[] = [
  {
    id: "google",
    nombre: "Reserve with Google",
    descripcion: "Reservas nativas desde Google Maps y Google Search, sin comisiones.",
    href: "/ajustes/canales/google",
    estado: "disponible",
    logo: (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-white border text-base font-bold">
        <span className="text-[#4285F4]">G</span>
      </span>
    ),
  },
  {
    id: "instagram",
    nombre: "Instagram",
    descripcion: "Botón Reservar en tu perfil de Instagram Business.",
    href: "/ajustes/canales/instagram",
    estado: "proximamente",
    logo: (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-500 text-white text-base font-bold">
        IG
      </span>
    ),
  },
  {
    id: "facebook",
    nombre: "Facebook",
    descripcion: "Botón Reservar en tu página de Facebook.",
    href: "/ajustes/canales/facebook",
    estado: "proximamente",
    logo: (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-[#1877F2] text-white text-base font-bold">
        f
      </span>
    ),
  },
];

export function CanalesTab() {
  return (
    <div className="p-3 md:p-4 space-y-3">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold">Canales de reserva</h2>
        <p className="text-xs text-muted-foreground">
          Conecta tu restaurante con las plataformas donde tus clientes ya están reservando.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CANALES.map((c) => {
          const disabled = c.estado === "proximamente";
          const inner = (
            <div className="flex items-start gap-3">
              {c.logo}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{c.nombre}</p>
                  {disabled ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      Próximamente
                    </span>
                  ) : (
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                  {c.descripcion}
                </p>
              </div>
            </div>
          );
          if (disabled) {
            return (
              <div
                key={c.id}
                className="group rounded-md border bg-card p-3 flex flex-col gap-2 opacity-60 cursor-not-allowed"
              >
                {inner}
              </div>
            );
          }
          return (
            <Link
              key={c.id}
              href={c.href}
              className="group rounded-md border bg-card p-3 flex flex-col gap-2 transition-colors hover:bg-muted/40 hover:border-primary/40 cursor-pointer"
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
