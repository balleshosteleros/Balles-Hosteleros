"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Smartphone, Megaphone, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProximamenteDialog } from "./ProximamenteDialog";

type CanalBoton =
  | { id: "email" | "whatsapp" | "sms"; label: string; href: string; icon: React.ElementType }
  | { id: "meta" | "google"; label: string; placeholder: "meta" | "google"; icon: React.ElementType };

const CANALES: CanalBoton[] = [
  { id: "email", label: "Email", href: "/marketing/campanas/email", icon: Mail },
  { id: "whatsapp", label: "WhatsApp", href: "/marketing/campanas/whatsapp", icon: MessageCircle },
  { id: "sms", label: "SMS", href: "/marketing/campanas/sms", icon: Smartphone },
  { id: "meta", label: "Meta", placeholder: "meta", icon: Megaphone },
  { id: "google", label: "Google", placeholder: "google", icon: Globe },
];

export function CampanasHubView() {
  const [proximamente, setProximamente] = useState<"meta" | "google" | null>(null);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* BARRA HORIZONTAL 1 — toolbar minimalista */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {CANALES.map((c) => {
            const Icon = c.icon;
            const esPlaceholder = "placeholder" in c;
            const inner = (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors",
                  esPlaceholder
                    ? "border-dashed border-border text-muted-foreground hover:bg-muted/40"
                    : "border-border bg-background hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {c.label}
                {esPlaceholder && <span className="text-[10px] uppercase ml-1 text-amber-600 dark:text-amber-400">Próx.</span>}
              </span>
            );
            return esPlaceholder ? (
              <button key={c.id} type="button" onClick={() => setProximamente(c.placeholder)}>
                {inner}
              </button>
            ) : (
              <Link key={c.id} href={c.href}>{inner}</Link>
            );
          })}
        </div>
      </div>

      {/* Tarjetas resumen por canal (Email / WhatsApp / SMS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CANALES.filter((c): c is Extract<CanalBoton, { href: string }> => "href" in c).map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.id}
              href={c.href}
              className="rounded-xl border bg-card p-5 hover:bg-accent/50 transition-colors shadow-sm group"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted/50 p-2.5 group-hover:bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-semibold">{c.label}</div>
                  <div className="text-xs text-muted-foreground">Ver campañas →</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <ProximamenteDialog
        open={proximamente !== null}
        onOpenChange={(open) => !open && setProximamente(null)}
        canal={proximamente ?? "meta"}
      />
    </div>
  );
}
