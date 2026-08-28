"use client";

import { EmpresaSwitcherMobile } from "./EmpresaSwitcherMobile";
import { EmpleadoMenuMobile } from "./EmpleadoMenuMobile";
import type { InicioEmpresa } from "../lib/mobile-identidad-data";

interface Props {
  nombre: string;
  rolLabel: string | null;
  avatarUrl: string | null;
  empresaActual: InicioEmpresa | null;
  empresas: InicioEmpresa[];
}

/**
 * Pill de perfil del Inicio móvil (mismo formato que el de ordenador):
 * logo de empresa (sirve para cambiar de empresa) · nombre + rol · foto.
 */
export function PerfilPill({
  nombre,
  rolLabel,
  avatarUrl,
  empresaActual,
  empresas,
}: Props) {
  return (
    <div className="relative min-w-0">
      <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card py-1 pl-1 pr-1.5 shadow-sm">
        {/* Logo de empresa → cambiar de empresa */}
        <EmpresaSwitcherMobile empresaActual={empresaActual} empresas={empresas} />

        <div className="mx-0.5 h-6 w-px shrink-0 bg-border" />

        {/* Nombre + rol */}
        <div className="flex min-w-0 max-w-[150px] flex-col justify-center px-0.5">
          <span
            className="truncate text-sm font-semibold leading-tight text-foreground"
            title={nombre}
          >
            {nombre}
          </span>
          {rolLabel && (
            <span className="truncate text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
              {rolLabel}
            </span>
          )}
        </div>

        {/* Foto del trabajador → menú (cambiar vista + cerrar sesión) */}
        <EmpleadoMenuMobile nombre={nombre} avatarUrl={avatarUrl} />
      </div>
    </div>
  );
}
