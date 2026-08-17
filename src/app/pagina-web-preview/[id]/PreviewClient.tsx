"use client";

import { useCallback, useMemo, useState } from "react";
import { PaginaPublicaShell } from "@/features/marketing/pagina-web/components/public/PaginaPublicaShell";
import { useListenBloques } from "@/features/marketing/pagina-web/hooks/useLivePreview";
import type { Bloque } from "@/features/marketing/pagina-web/types";

interface Props {
  paginaId: string;
  bloquesIniciales: Bloque[];
  empresaId?: string | null;
  empresaSlug?: string | null;
}

export function PreviewClient({
  paginaId,
  bloquesIniciales,
  empresaId = null,
  empresaSlug = null,
}: Props) {
  const [bloques, setBloques] = useState<Bloque[]>(bloquesIniciales);
  const onMsg = useCallback((b: Bloque[]) => setBloques(b), []);
  useListenBloques(paginaId, onMsg);

  const contexto = useMemo(
    () => ({ empresaId, paginaId, empresaSlug }),
    [empresaId, paginaId, empresaSlug],
  );

  return <PaginaPublicaShell bloques={bloques} contexto={contexto} />;
}
