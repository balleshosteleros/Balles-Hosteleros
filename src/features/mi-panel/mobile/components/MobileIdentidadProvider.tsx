"use client";

import { createContext, useContext } from "react";
import type { MobileIdentidad } from "../lib/mobile-identidad-data";

const VACIO: MobileIdentidad = {
  nombre: "Empleado",
  rolLabel: null,
  avatarUrl: null,
  empresaActual: null,
  empresas: [],
};

const Ctx = createContext<MobileIdentidad>(VACIO);

/**
 * Identidad del usuario móvil (nombre, foto, empresa activa y empresas
 * accesibles), cargada UNA vez en el layout de `/m` y disponible en toda la app.
 *
 * Existe para que el icono de empresa pueda pintarse en la cabecera de
 * cualquier pantalla —también dentro de módulos y submódulos— sin que cada
 * página tenga que ir a buscar el dato (Iván, 28-ago: "nunca puede desaparecer").
 */
export function MobileIdentidadProvider({
  value,
  children,
}: {
  value: MobileIdentidad;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMobileIdentidad(): MobileIdentidad {
  return useContext(Ctx);
}
