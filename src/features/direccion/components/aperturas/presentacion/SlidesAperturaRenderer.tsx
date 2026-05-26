"use client";

import type { EstudioApertura } from "@/features/direccion/data/aperturas";
import { SlidePortada } from "./slides/SlidePortada";
import { SlideConcepto } from "./slides/SlideConcepto";
import { SlideLocal } from "./slides/SlideLocal";
import { SlideMarca } from "./slides/SlideMarca";
import { SlideGastronomia } from "./slides/SlideGastronomia";
import { SlideOcupacion } from "./slides/SlideOcupacion";
import { SlideEscenarios } from "./slides/SlideEscenarios";
import { SlideInversion } from "./slides/SlideInversion";
import { SlideCierre } from "./slides/SlideCierre";
import { SlidePlaceholder } from "./slides/SlidePlaceholder";

/**
 * Define el orden y tipo de cada slide del dossier de apertura.
 */
export interface SlideAperturaItem {
  key: string;
  titulo: string;
}

export const SLIDES_APERTURA: SlideAperturaItem[] = [
  { key: "portada", titulo: "Portada" },
  { key: "concepto", titulo: "Concepto" },
  { key: "local", titulo: "Local" },
  { key: "marca", titulo: "Imagen de marca" },
  { key: "gastronomia", titulo: "Propuesta gastronómica" },
  { key: "ocupacion", titulo: "Ocupación estimada" },
  { key: "escenarios", titulo: "Escenarios financieros" },
  { key: "inversion", titulo: "Inversión" },
  { key: "cierre", titulo: "Cierre" },
];

export function SlidesAperturaRenderer({
  estudio,
  slideKey,
}: {
  estudio: EstudioApertura;
  slideKey: string;
}) {
  switch (slideKey) {
    case "portada":
      return <SlidePortada estudio={estudio} />;
    case "concepto":
      return <SlideConcepto estudio={estudio} />;
    case "local":
      return <SlideLocal estudio={estudio} />;
    case "marca":
      return <SlideMarca estudio={estudio} />;
    case "gastronomia":
      return <SlideGastronomia estudio={estudio} />;
    case "ocupacion":
      return <SlideOcupacion estudio={estudio} />;
    case "escenarios":
      return <SlideEscenarios estudio={estudio} />;
    case "inversion":
      return <SlideInversion estudio={estudio} />;
    case "cierre":
      return <SlideCierre estudio={estudio} />;
    default:
      return <SlidePlaceholder titulo={slideKey} />;
  }
}
