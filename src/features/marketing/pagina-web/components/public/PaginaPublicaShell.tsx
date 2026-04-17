"use client";

import type { Bloque } from "../../types";
import { BloquePublico } from "./BloquePublico";

interface Props {
  bloques: Bloque[];
}

export function PaginaPublicaShell({ bloques }: Props) {
  const ordenados = [...bloques].sort((a, b) => a.orden - b.orden);
  return (
    <main className="min-h-screen bg-white text-black">
      {ordenados.map((b) => (
        <BloquePublico key={b.id} bloque={b} />
      ))}
    </main>
  );
}
