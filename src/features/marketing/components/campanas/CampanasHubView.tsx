"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Smartphone, Megaphone, Globe } from "lucide-react";
import { ProximamenteDialog } from "./ProximamenteDialog";

/**
 * Por dónde se manda una campaña.
 *
 * Antes esta pantalla tenía dos filas que hacían exactamente lo mismo: una
 * barra de botones pequeños arriba y las tarjetas debajo, las dos llevando al
 * mismo sitio. Dos caminos idénticos no dan a elegir, solo obligan a mirar dos
 * veces para descubrir que daba igual. Se queda la tarjeta, que es la que dice
 * de un vistazo qué hay en cada canal.
 */
type CanalTarjeta =
  | { id: "email" | "whatsapp" | "sms" | "meta"; label: string; descripcion: string; href: string; icon: React.ElementType }
  | { id: "google"; label: string; descripcion: string; placeholder: "google"; icon: React.ElementType };

const CANALES: CanalTarjeta[] = [
  { id: "email", label: "Email", descripcion: "Correos al cliente", href: "/marketing/campanas/email", icon: Mail },
  { id: "whatsapp", label: "WhatsApp", descripcion: "Mensajes al móvil", href: "/marketing/campanas/whatsapp", icon: MessageCircle },
  { id: "sms", label: "SMS", descripcion: "Mensajes de texto", href: "/marketing/campanas/sms", icon: Smartphone },
  { id: "meta", label: "Meta", descripcion: "Anuncios en Facebook e Instagram", href: "/marketing/campanas/meta", icon: Megaphone },
  { id: "google", label: "Google", descripcion: "Anuncios en el buscador", placeholder: "google", icon: Globe },
];

export function CampanasHubView() {
  const [proximamente, setProximamente] = useState<"google" | null>(null);

  return (
    <div className="p-4 md:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {CANALES.map((c) => {
          const Icon = c.icon;
          const esPlaceholder = "placeholder" in c;

          const contenido = (
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-muted/50 p-2.5 group-hover:bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">{c.label}</span>
                  {esPlaceholder && (
                    <span className="text-[10px] uppercase text-amber-600 dark:text-amber-400">Próx.</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{c.descripcion}</div>
              </div>
            </div>
          );

          return esPlaceholder ? (
            <button
              key={c.id}
              type="button"
              onClick={() => setProximamente(c.placeholder)}
              className="rounded-xl border border-dashed bg-card p-5 text-left hover:bg-accent/50 transition-colors shadow-sm group"
            >
              {contenido}
            </button>
          ) : (
            <Link
              key={c.id}
              href={c.href}
              className="rounded-xl border bg-card p-5 hover:bg-accent/50 transition-colors shadow-sm group"
            >
              {contenido}
            </Link>
          );
        })}
      </div>

      <ProximamenteDialog
        open={proximamente !== null}
        onOpenChange={(open) => !open && setProximamente(null)}
        canal={proximamente ?? "google"}
      />
    </div>
  );
}
