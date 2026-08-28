"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * MODO INMERSIVO — barra superior replegada.
 *
 * Reservas es la pantalla en la que sala se pasa el servicio entero. Durante
 * ese rato la barra superior del software (herramientas, correo, calendario,
 * avatar…) no se usa: solo ocupa alto y, al ser clara, canta sobre el tema
 * oscuro del plano. Aquí se permite que una vista pida "repliega la barra".
 *
 * NO se desmonta la barra: se repliega a altura cero. Así el contenido de la
 * cabecera sigue montado (los contadores de avisos, el reproductor de música,
 * los drawers abiertos) y volver a mostrarla es instantáneo, sin recargar nada.
 *
 * Quién la vuelve a bajar:
 *   - el menú lateral, al expandirse (es el mismo gesto: acercar el cursor al
 *     borde saca las dos cosas a la vez, apartarlo las recoge);
 *   - la propia vista, cuando deja de ser inmersiva — en Reservas, al entrar
 *     en Configuración, donde se está "trabajando en el software" y la barra
 *     tiene que estar donde siempre.
 *
 * Por defecto está DESACTIVADO: cualquier módulo que no lo pida expresamente
 * se comporta como siempre.
 */
interface ModoInmersivoContextValue {
  /** True si la vista activa ha pedido replegar la barra superior. */
  inmersivo: boolean;
  /** Lo activa/desactiva la vista montada (Reservas). */
  setInmersivo: (valor: boolean) => void;
}

const ModoInmersivoContext = createContext<ModoInmersivoContextValue | null>(null);

export function ModoInmersivoProvider({ children }: { children: ReactNode }) {
  const [inmersivo, setInmersivoState] = useState(false);

  const setInmersivo = useCallback((valor: boolean) => {
    setInmersivoState(valor);
  }, []);

  const value = useMemo<ModoInmersivoContextValue>(
    () => ({ inmersivo, setInmersivo }),
    [inmersivo, setInmersivo],
  );

  return (
    <ModoInmersivoContext.Provider value={value}>
      {children}
    </ModoInmersivoContext.Provider>
  );
}

/**
 * Devuelve el estado del modo inmersivo. Fuera del provider NO lanza: devuelve
 * el modo apagado. El provider vive en el layout del software, así que una
 * vista renderizada fuera de él (por ejemplo en una preview) debe seguir
 * funcionando en vez de romperse.
 */
export function useModoInmersivo(): ModoInmersivoContextValue {
  const ctx = useContext(ModoInmersivoContext);
  if (!ctx) return { inmersivo: false, setInmersivo: () => {} };
  return ctx;
}
