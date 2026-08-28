"use client";

import { EmpresaSwitcherMobile } from "./EmpresaSwitcherMobile";
import { EmpleadoMenuMobile } from "./EmpleadoMenuMobile";
import type { InicioEmpresa } from "../lib/mobile-identidad-data";

interface Props {
  nombre: string;
  avatarUrl: string | null;
  empresaActual: InicioEmpresa | null;
  empresas: InicioEmpresa[];
}

/**
 * Pill de perfil del Inicio móvil: logo de empresa (cambia de empresa) · foto
 * del empleado (menú).
 *
 * Mismo formato que el software de ordenador, pero SIN nombre ni puesto: en el
 * móvil ocupaban demasiado ancho (Iván, 28-ago). El fondo `bg-muted/40` del
 * pill es además lo que hace visible un isotipo de trazo fino como el de
 * BACANAL, que sobre blanco puro se pierde.
 */
export function PerfilPill({ nombre, avatarUrl, empresaActual, empresas }: Props) {
  return (
    <div className="relative shrink-0">
      <div className="flex items-center gap-0.5 rounded-full border bg-muted/40 px-1.5 py-1">
        {/* Logo de empresa → cambiar de empresa */}
        <EmpresaSwitcherMobile empresaActual={empresaActual} empresas={empresas} />

        <span className="mx-1 h-5 w-px shrink-0 bg-border" />

        {/* Foto del trabajador → menú (cambiar vista + cerrar sesión) */}
        <EmpleadoMenuMobile nombre={nombre} avatarUrl={avatarUrl} />
      </div>
    </div>
  );
}
