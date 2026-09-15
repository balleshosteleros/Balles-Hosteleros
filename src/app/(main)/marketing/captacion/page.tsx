import { Bricolage_Grotesque, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import { CaptacionView } from "@/features/marketing/components/CaptacionView";

/**
 * Captación tiene tipografía propia: la del informe de canales —titulares de
 * palo seco con carácter, texto en serif y cifras en monoespaciada—, que es lo
 * que hace que una pantalla de números se lea como un informe y no como una
 * tabla más.
 *
 * Van con `next/font`, igual que la Inter del resto del software: así viajan
 * con la app y no dependen de que el ordenador que la abra las tenga
 * instaladas (ver la regla de la tipografía en la memoria del proyecto). Solo
 * se aplican dentro de esta pantalla, por las variables de abajo.
 */
const titulares = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--fuente-titulares",
  display: "swap",
});

const texto = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--fuente-texto",
  display: "swap",
});

const cifras = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fuente-cifras",
  display: "swap",
});

export default function CaptacionPage() {
  return (
    <div className={`${titulares.variable} ${texto.variable} ${cifras.variable}`}>
      <CaptacionView />
    </div>
  );
}
