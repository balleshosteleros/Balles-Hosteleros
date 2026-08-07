import { PerfilPill } from "./PerfilPill";
import { NotificacionBell } from "@/features/notificaciones/components/NotificacionBell";
import type { MobileInicioData } from "../lib/mobile-inicio-data";

export function InicioHeader({ data }: { data: MobileInicioData }) {
  const { nombre, rolLabel, avatarUrl, empresaActual, empresas } = data;

  return (
    // OJO con el fondo: la columna de la app está centrada y limitada a 640px
    // (`max-w-screen-sm`). Si el fondo se pinta en el propio <header>, en un
    // móvil más ancho (Android de 720px) termina a 640px y quedan 40px de
    // FRANJA BLANCA a cada lado, porque el blanco del header no coincide con el
    // gris del fondo de la app (Iván, 07-ago: "se ve el recuadro con partes
    // blancas"). Por eso el fondo va en la capa `-inset-x-[100vw]` de abajo,
    // que se desborda hasta cubrir la pantalla entera.
    <header className="sticky top-0 z-40 px-5 pt-[max(env(safe-area-inset-top),12px)] pb-2">
      {/* Fondo + halo azulado de marca. Va recortado en su propio contenedor
          para NO tapar el desplegable de empresas (que se abre por debajo del
          header); el `overflow-hidden` en el <header> lo recortaba.
          `-inset-x-[100vw]` lo estira a lo ancho de CUALQUIER pantalla, así el
          fondo llega de borde a borde y no hay costura lateral. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-[100vw] inset-y-0 bg-background/95 backdrop-blur"
      >
        <div className="absolute inset-x-0 -top-24 h-56 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-2xl" />
      </div>

      {/* Fila superior: campana a la izquierda del todo; pill de perfil
          (logo empresa + nombre/rol + foto→menú) a la derecha. */}
      <div className="relative flex items-center justify-between gap-2">
        <NotificacionBell />
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
