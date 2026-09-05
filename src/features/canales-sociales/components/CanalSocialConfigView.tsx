"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Info } from "lucide-react";
import { setCanalSocialActivo } from "@/features/canales-sociales/actions/canal-social-actions";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";
import type { CanalSocial } from "@/features/canales-sociales/data/canales-sociales";
import type { EstadoCanalSocial } from "@/features/canales-sociales/actions/canal-social-actions";

interface Props {
  canal: CanalSocial;
  estado: EstadoCanalSocial;
}

export function CanalSocialConfigView({ canal, estado }: Props) {
  const { empresaActual } = useEmpresa();
  const [activo, setActivo] = useState(estado.activo);
  const [copiado, setCopiado] = useState(false);
  const [pending, startTransition] = useTransition();

  const onToggle = (siguiente: boolean) => {
    const previo = activo;
    setActivo(siguiente);
    startTransition(async () => {
      const r = await setCanalSocialActivo(canal.id, siguiente);
      if (r.ok) {
        toast.success(siguiente ? `Canal ${canal.nombre} activado` : `Canal ${canal.nombre} desactivado`);
      } else {
        setActivo(previo);
        toast.error(r.error ?? "No se pudo guardar");
      }
    });
  };

  const onCopiar = async () => {
    if (!estado.url) return;
    await navigator.clipboard.writeText(estado.url);
    setCopiado(true);
    toast.success("Enlace copiado");
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-2xl">
      <header className="space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ajustes / Canales
        </span>
        <h1 className="text-base font-semibold">{canal.nombre}</h1>
        <p className="text-xs text-muted-foreground">{canal.descripcion}</p>
      </header>

      <div className="rounded-md border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Estado del canal en</p>
            <p className="text-sm font-medium">{estado.empresaNombre}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={
                "text-[10px] font-semibold uppercase px-2 py-1 rounded " +
                (activo ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")
              }
            >
              {activo ? "Activo" : "No configurado"}
            </span>
            <Switch checked={activo} onCheckedChange={onToggle} disabled={pending} />
          </div>
        </div>

        {estado.activoDesde && (
          <p className="text-[11px] text-muted-foreground">
            {estado.reservas === 0
              ? "Todavía no ha entrado ninguna reserva por el botón."
              : estado.reservas === 1
                ? "1 reserva ha entrado por el botón"
                : `${estado.reservas} reservas han entrado por el botón`}
            {estado.reservas > 0 &&
              ` desde el ${formatFechaEnZona(estado.activoDesde, empresaActual?.zonaHoraria)}.`}
          </p>
        )}
      </div>

      <div className="rounded-md border bg-muted/40 p-3 flex gap-2.5">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">{canal.limitacion}</p>
      </div>

      {activo && (
        <>
          <div className="rounded-md border bg-card p-4 space-y-2.5">
            <p className="text-sm font-medium">Tu enlace de reservas</p>
            {estado.url ? (
              <>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate rounded bg-muted px-2 py-1.5 font-mono text-[11px]">
                    {estado.url}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCopiar}
                    className="text-xs h-8 gap-1.5 shrink-0"
                  >
                    {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiado ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Toda reserva que entre por aquí queda marcada con origen «{canal.nombre}» en la
                  analítica de canales.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Esta empresa todavía no tiene dirección web configurada, así que no se puede generar
                el enlace.
              </p>
            )}
          </div>

          <div className="rounded-md border bg-card p-4 space-y-2.5">
            <p className="text-sm font-medium">Cómo poner el botón en {canal.nombre}</p>
            <ol className="space-y-1.5">
              {canal.pasos.map((paso, i) => (
                <li key={i} className="flex gap-2.5 text-[11px] text-muted-foreground leading-relaxed">
                  <span className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-[9px] font-semibold text-foreground mt-0.5">
                    {i + 1}
                  </span>
                  <span>{paso.texto}</span>
                </li>
              ))}
            </ol>
            <Button size="sm" variant="outline" asChild className="text-xs h-8 gap-1.5">
              <Link href={canal.ayudaUrl} target="_blank" rel="noopener noreferrer">
                {canal.ayudaLabel}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
