"use client";

import { useEffect } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

/**
 * EL SERVIDOR AVISA DE CON QUÉ EMPRESA HA RESPONDIDO
 * ==================================================
 * Al cambiar de empresa había un momento raro: el logotipo de arriba ya era el
 * de la empresa nueva mientras el menú seguía enseñando los módulos de la
 * anterior. Pasaba porque el navegador daba el cambio por hecho en cuanto se
 * pulsaba, y la pantalla (menú y contenido) la pinta el servidor, que tarda un
 * poco más.
 *
 * Este componente no pinta nada: solo le dice al software qué empresa está
 * sirviendo el servidor AHORA. Con eso, el logotipo espera y el recuadro de
 * "Cargando…" se mantiene hasta que toda la pantalla es ya de la empresa nueva.
 *
 * Va dentro del layout del software, que se vuelve a ejecutar en cada cambio de
 * empresa: cuando llega con la empresa nueva, esta señal se actualiza sola.
 */
export function EmpresaActivaSeed({ empresaActivaId }: { empresaActivaId: string | null }) {
  const { confirmarEmpresaServidor } = useEmpresa();

  useEffect(() => {
    confirmarEmpresaServidor(empresaActivaId);
  }, [empresaActivaId, confirmarEmpresaServidor]);

  return null;
}
