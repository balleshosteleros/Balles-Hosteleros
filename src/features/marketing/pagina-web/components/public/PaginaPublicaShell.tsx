"use client";

import type { Bloque } from "../../types";
import { BloquePublico } from "./BloquePublico";

export interface PaginaContexto {
  empresaId: string | null;
  paginaId: string | null;
  empresaSlug?: string | null;
}

interface Props {
  bloques: Bloque[];
  contexto?: PaginaContexto;
}

export function PaginaPublicaShell({ bloques, contexto }: Props) {
  const ordenados = [...bloques].sort((a, b) => a.orden - b.orden);
  return (
    <main className="min-h-screen bg-white text-black">
      {ordenados.map((b) => (
        <BloquePublico key={b.id} bloque={b} contexto={contexto} />
      ))}
    </main>
  );
}
