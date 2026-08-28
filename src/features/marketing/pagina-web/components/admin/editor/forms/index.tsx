"use client";

import type { Bloque } from "../../../../types";
import { HeroForm } from "./HeroForm";
import { GaleriaForm } from "./GaleriaForm";
import { MenuForm } from "./MenuForm";
import { ReservasForm } from "./ReservasForm";
import { TestimoniosForm } from "./TestimoniosForm";
import { CtaForm } from "./CtaForm";
import { FormularioForm } from "./FormularioForm";
import { MapaForm } from "./MapaForm";
import { FooterForm } from "./FooterForm";
import { TextoLibreForm } from "./TextoLibreForm";
import { VideoForm } from "./VideoForm";
import { BolsaInspectoresForm } from "./BolsaInspectoresForm";
import { RedesForm } from "./RedesForm";
import { CollageCartaForm } from "./CollageCartaForm";
import { PremiosForm } from "./PremiosForm";
import { HistoriaForm } from "./HistoriaForm";
import { InstagramForm } from "./InstagramForm";

export function BloqueForm({ bloque }: { bloque: Bloque }) {
  switch (bloque.tipo) {
    case "hero":
      return <HeroForm bloque={bloque} />;
    case "galeria":
      return <GaleriaForm bloque={bloque} />;
    case "menu":
      return <MenuForm bloque={bloque} />;
    case "reservas":
      return <ReservasForm bloque={bloque} />;
    case "testimonios":
      return <TestimoniosForm bloque={bloque} />;
    case "cta":
      return <CtaForm bloque={bloque} />;
    case "formulario":
      return <FormularioForm bloque={bloque} />;
    case "mapa":
      return <MapaForm bloque={bloque} />;
    case "footer":
      return <FooterForm bloque={bloque} />;
    case "texto_libre":
      return <TextoLibreForm bloque={bloque} />;
    case "video":
      return <VideoForm bloque={bloque} />;
    case "bolsa_inspectores":
      return <BolsaInspectoresForm bloque={bloque} />;
    case "redes":
      return <RedesForm bloque={bloque} />;
    case "collage_carta":
      return <CollageCartaForm bloque={bloque} />;
    case "premios":
      return <PremiosForm bloque={bloque} />;
    case "historia":
      return <HistoriaForm bloque={bloque} />;
    case "instagram":
      return <InstagramForm bloque={bloque} />;
  }
}
