"use client";

import { useEffect, useState } from "react";
import { Loader2, Inbox, Check } from "lucide-react";
import {
  listarComunicadosVisibles,
  type ComunicadoVisible,
} from "@/features/mi-panel/actions/mi-panel-actions";
import { marcarComunicadosVistos } from "@/features/mi-panel/actions/comunicados-vistos-actions";
import { formatFechaHoraEnZona, claveDiaEnZona } from "@/features/empresa/lib/zona-horaria";
import { tipoComunicado } from "@/features/rrhh/data/comunicados";
import { BannerAltaMedica } from "@/features/mi-panel/components/BannerAltaMedica";
import { ComunicadoTarjeta } from "@/features/gerencia/components/ComunicadoTarjeta";

/**
 * Los comunicados del trabajador.
 *
 * Van todos PLEGADOS, uno debajo de otro, y solo se abre el que se pulsa: así se
 * ve de un vistazo lo que hay sin bajar media pantalla por cada uno. Cada
 * comunicado lleva su recuadro del color de su tipo, y mientras no se ha abierto
 * lleva la etiqueta «Nuevo» en verde; al abrirlo por primera vez queda visto
 * (Iván, 10-09-2026).
 */

/** En qué montón va cada comunicado: hoy, esta semana o antiguos. */
function grupoDe(iso: string, tz: string): "hoy" | "semana" | "antes" {
  const hoy = claveDiaEnZona(new Date().toISOString(), tz);
  const dia = claveDiaEnZona(iso, tz);
  if (dia === hoy) return "hoy";
  const diff = Date.now() - new Date(iso).getTime();
  return diff < 7 * 86_400_000 ? "semana" : "antes";
}

const GRUPO_LABEL: Record<string, string> = {
  hoy: "Hoy",
  semana: "Esta semana",
  antes: "Anteriores",
};

function TarjetaComunicado({
  c,
  abierto,
  onAbrir,
}: {
  c: ComunicadoVisible;
  abierto: boolean;
  onAbrir: () => void;
}) {
  return (
    <ComunicadoTarjeta
      abierto={abierto}
      onAbrir={onAbrir}
      datos={{
        titulo: c.titulo,
        tipo: tipoComunicado(c.tipo),
        contenido: c.contenido ?? "",
        enlace: c.enlace,
        enlaceTexto: c.enlaceTexto,
        adjuntos: c.adjuntos,
        empresaNombre: c.empresaNombre,
        isotipoUrl: c.isotipoUrl,
        fechaTexto: formatFechaHoraEnZona(c.createdAt, c.zonaHoraria, { month: "long" }),
        nuevo: !c.vistoEl,
      }}
      pie={
        c.vistoEl ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Visto el {formatFechaHoraEnZona(c.vistoEl, c.zonaHoraria, { month: "long" })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Sin leer</p>
        )
      }
    />
  );
}

export function MisComunicadosView() {
  const [items, setItems] = useState<ComunicadoVisible[]>([]);
  const [loading, setLoading] = useState(true);
  /** Solo hay uno abierto a la vez: el que se acaba de pulsar. */
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    listarComunicadosVisibles().then((res) => {
      if (cancel) return;
      setItems(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, []);

  /**
   * Abrir un comunicado es leerlo: de ahí sale el «visto» del trabajador y el
   * alcance que ve quien lo publicó. Se apunta la primera vez y ya no cambia.
   */
  const abrir = (c: ComunicadoVisible) => {
    if (abierto === c.id) {
      setAbierto(null);
      return;
    }
    setAbierto(c.id);
    if (!c.vistoEl) {
      const ahora = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, vistoEl: ahora } : x)));
      void marcarComunicadosVistos([c.id]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <BannerAltaMedica />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center text-muted-foreground">
          <Inbox className="mb-3 h-8 w-8" />
          <p className="text-sm font-medium">Sin comunicados</p>
          <p className="mt-1 text-xs">No hay anuncios publicados por el momento.</p>
        </div>
      </div>
    );
  }

  const tz = items[0]?.zonaHoraria ?? "Europe/Madrid";
  const grupos: { clave: string; lista: ComunicadoVisible[] }[] = [];
  for (const c of items) {
    const g = grupoDe(c.createdAt, tz);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.clave === g) ultimo.lista.push(c);
    else grupos.push({ clave: g, lista: [c] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7 p-4 md:p-6">
      <BannerAltaMedica />
      {grupos.map((g, i) => (
        <section key={`${g.clave}-${i}`} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {GRUPO_LABEL[g.clave]}
            </h2>
            <span className="h-px flex-1 bg-border" />
          </div>
          {g.lista.map((c) => (
            <TarjetaComunicado
              key={c.id}
              c={c}
              abierto={abierto === c.id}
              onAbrir={() => abrir(c)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
