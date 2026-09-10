"use client";

/**
 * Las cuatro cifras de cabecera del panel de correo (PRP-094, Fase 3).
 *
 * La media diaria está aquí a propósito: en un mes, «372 correos» no dice nada,
 * y «12,4 al día» sí. Y el número de contactos distintos es lo que da sentido al
 * ranking de debajo: 300 correos repartidos entre 4 contactos y entre 200 no son
 * el mismo problema ni se arreglan igual.
 */

import { ArrowDownLeft, ArrowUpRight, Gauge, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatoNumero } from "../lib/formato";

export function CorreoKpis({
  entrantes,
  salientes,
  mediaDiaria,
  contactos,
}: {
  entrantes: number;
  salientes: number;
  mediaDiaria: number;
  contactos: number;
}) {
  const tarjetas = [
    {
      etiqueta: "Recibidos",
      valor: formatoNumero(entrantes),
      icono: ArrowDownLeft,
      color: "text-sky-600",
    },
    {
      etiqueta: "Enviados",
      valor: formatoNumero(salientes),
      icono: ArrowUpRight,
      color: "text-emerald-600",
    },
    {
      etiqueta: "Media al día",
      valor: formatoNumero(mediaDiaria),
      icono: Gauge,
      color: "text-amber-600",
    },
    {
      etiqueta: "Contactos distintos",
      valor: formatoNumero(contactos),
      icono: Users,
      color: "text-violet-600",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tarjetas.map((t) => {
        const Icono = t.icono;
        return (
          <Card key={t.etiqueta} className="flex items-center gap-3 p-4">
            <Icono className={`h-5 w-5 shrink-0 ${t.color}`} aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-2xl font-semibold leading-none text-foreground">
                {t.valor}
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {t.etiqueta}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
