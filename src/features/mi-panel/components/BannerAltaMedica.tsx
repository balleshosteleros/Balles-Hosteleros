"use client";

/**
 * El aviso de «comunica tu alta» dentro de Comunicados.
 *
 * Quien está de baja no puede fichar, y el mensaje que le sale al intentarlo le
 * manda aquí. Así que aquí tiene que estar el botón: si le mandamos a una
 * sección y al llegar no encuentra nada, el aviso no sirve de nada.
 *
 * No se pinta cuando no hay baja abierta, que es lo normal: entonces Comunicados
 * es lo que era, el tablón de avisos de la empresa.
 */

import { useCallback, useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AltaMedicaModal } from "@/features/mi-panel/components/AltaMedicaModal";
import {
  getMiBajaMedicaAbierta,
  type BajaMedicaAbierta,
} from "@/features/mi-panel/actions/comunicaciones-actions";

function fechaEs(iso: string): string {
  const [y, m, d] = (iso ?? "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function BannerAltaMedica() {
  const [baja, setBaja] = useState<BajaMedicaAbierta | null>(null);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(() => {
    getMiBajaMedicaAbierta().then((res) => setBaja(res.data));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!baja) return null;

  return (
    <>
      <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900 dark:bg-rose-950/40">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 dark:bg-rose-900/50">
            <HeartPulse className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </span>
          <div className="min-w-[200px] flex-1">
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
              Estás de baja médica desde el {fechaEs(baja.fechaInicio)}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-rose-800/80 dark:text-rose-200/80">
              Cuando te den el alta, comunícala aquí. Hasta entonces no podrás fichar.
            </p>
          </div>
          <Button onClick={() => setAbierto(true)} className="shrink-0">
            <HeartPulse className="mr-2 h-4 w-4" />
            Comunicar mi alta médica
          </Button>
        </div>
      </div>

      <AltaMedicaModal
        open={abierto}
        onOpenChange={setAbierto}
        solicitudId={baja.solicitudId}
        fechaInicioBaja={baja.fechaInicio}
        onComunicada={cargar}
      />
    </>
  );
}
