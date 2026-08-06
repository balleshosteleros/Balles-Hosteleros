"use client";

import { useCallback, useState } from "react";
import { PaginaPublicaShell } from "@/features/marketing/pagina-web/components/public/PaginaPublicaShell";
import { useListenBloques } from "@/features/marketing/pagina-web/hooks/useLivePreview";
import type { Bloque } from "@/features/marketing/pagina-web/types";

interface Props {
  paginaId: string;
  bloquesIniciales: Bloque[];
}

export function PreviewClient({ paginaId, bloquesIniciales }: Props) {
  const [bloques, setBloques] = useState<Bloque[]>(bloquesIniciales);
  const onMsg = useCallback((b: Bloque[]) => setBloques(b), []);
  useListenBloques(paginaId, onMsg);
  return <PaginaPublicaShell bloques={bloques} />;
}
