import { PerfilPill } from "./PerfilPill";
import type { MobileInicioData } from "../lib/mobile-inicio-data";

export function InicioHeader({ data }: { data: MobileInicioData }) {
  const { nombre, rolLabel, avatarUrl, empresaActual, empresas } = data;

  return (
    <header className="relative overflow-hidden px-5 pt-[max(env(safe-area-inset-top),12px)] pb-2">
      {/* Halo azulado de marca de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-56 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-2xl"
      />

      {/* Fila superior: pill de perfil (logo empresa + nombre/rol + foto→menú) */}
      <div className="relative flex items-center gap-2">
        <PerfilPill
          nombre={nombre}
          rolLabel={rolLabel}
          avatarUrl={avatarUrl}
          empresaActual={empresaActual}
          empresas={empresas}
        />
      </div>
    </header>
  );
}
