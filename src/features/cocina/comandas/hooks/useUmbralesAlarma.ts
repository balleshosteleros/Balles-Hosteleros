"use client";

import { useEffect, useState } from "react";
import { getUmbralesAlarma } from "../actions/umbrales-actions";
import { UMBRALES_DEFAULT, type UmbralesAlarma } from "../types";

const FALLBACK: UmbralesAlarma = {
  empresaId: "",
  ...UMBRALES_DEFAULT,
  updatedAt: new Date(0).toISOString(),
};

export function useUmbralesAlarma(): UmbralesAlarma {
  const [umbrales, setUmbrales] = useState<UmbralesAlarma>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getUmbralesAlarma();
      if (!cancelled && res.ok) setUmbrales(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return umbrales;
}
