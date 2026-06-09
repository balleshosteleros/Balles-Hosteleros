import Image from "next/image";
import { EmpresaSwitcherMobile } from "./EmpresaSwitcherMobile";
import { CerrarSesionButton } from "./CerrarSesionButton";
import type { MobileInicioData } from "../lib/mobile-inicio-data";

/** Iniciales del nombre para el avatar de respaldo. */
function inicialesNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "·";
}

export function InicioHeader({ data }: { data: MobileInicioData }) {
  const { nombre, rolLabel, avatarUrl, empresaActual, empresas } = data;

  return (
    <header className="relative overflow-hidden px-5 pt-[max(env(safe-area-inset-top),12px)] pb-2">
      {/* Halo azulado de marca de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-56 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-2xl"
      />

      {/* Fila superior: selector / logo de empresa + cerrar sesión */}
      <div className="relative flex items-center justify-between">
        <EmpresaSwitcherMobile empresaActual={empresaActual} empresas={empresas} />
        <CerrarSesionButton />
      </div>

      {/* Identidad: avatar centrado + nombre + rol */}
      <div className="relative mt-3 flex flex-col items-center text-center">
        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-lg" aria-hidden />
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-primary/10 shadow-md ring-1 ring-primary/20">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={nombre}
                width={96}
                height={96}
                className="h-24 w-24 object-cover"
                unoptimized
                priority
              />
            ) : (
              <span className="text-2xl font-bold text-primary">
                {inicialesNombre(nombre)}
              </span>
            )}
          </div>
        </div>

        <h1 className="mt-3 text-xl font-semibold leading-tight">{nombre}</h1>
        {rolLabel && (
          <p className="mt-0.5 text-sm text-muted-foreground">{rolLabel}</p>
        )}
      </div>
    </header>
  );
}
