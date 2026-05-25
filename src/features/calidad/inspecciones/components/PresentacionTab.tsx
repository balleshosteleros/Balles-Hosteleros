"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { getPresentacion, getEmpresaTheme } from "../actions";
import { PresentacionEditor } from "./PresentacionEditor";
import type { Slide, EmpresaTheme } from "../types";

export function PresentacionTab() {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [theme, setTheme] = useState<EmpresaTheme | null>(null);

  useEffect(() => {
    Promise.all([getPresentacion(), getEmpresaTheme()]).then(([p, t]) => {
      setSlides(p?.slides ?? []);
      setTheme(t);
    });
  }, []);

  if (!slides || !theme) {
    return (
      <div className="rounded-xl border bg-card py-16 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return <PresentacionEditor slidesInitial={slides} theme={theme} />;
}
